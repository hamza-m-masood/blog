---
title: "Part 6 - OAuth Token Types"
published: 2026-09-20
draft: false
description: ""
tags: ["OAuth", "Security"]
series: "OAuth Simplified"
---

## Introduction

Up until this point I have been mentioning the Access Token, but never went
into detail into what an Access Token actually looks like. So far we have
just seen it as a jumble of characters, with a `Bearer` type:

```bash
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{
  "access_token": "vN2vXLpQ4mZ7wRt1yHb3cJd6fGs0aV",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "page_post"
}
```

This is because the OAuth specification does not specify what the contents
of an Access Token should look like.

:::shockedDuck

Whaaat?! How could the OAuth specification leave out something so
fundamental?! Defining the contents of an Access Token seems pretty
important to mention in the spec!

:::

There is an excellent reason behind the omission. OAuth tries to be as
flexible and extendable as possible. It is left up to you how you would
like to define the contents of your token. Access Tokens can be used in a
wide variety of deployments, they can represent all users, or one user, or
no user at all! They can have some structure or no structure at all. It is
totally up to you. This allows OAuth to adapt to many scenarios.

This blogpost will go through common techniques and industry standards in
which an OAuth Access Token can be defined. Especially in relation to how
an Access Token can be secured.

## What are OAuth Tokens?

The OAuth Access Token is result of the delegation act. Keeping to our
Strava example we have been using throughout this blog series, the creation
of the Access Token means you have successfully delegated your
authorizations to Strava in order to create a Facebook post on your behalf.

The Access Token can define anything that is relevant to the authorization
decision. For example, the scopes that are granted to the client, the ID of
the user who delegated their permissions, the expiration time etc...

:::thinkMe

Let's have a closer look at the OAuth Access Tokens we have been defining
so far.

:::

## Opaque Tokens

So far in this blog series we have been using a jumble of characters to
represent the Access Token. This is valid since from the start the
Protected Resource and the Authorization Server share a database. If the
Authorization Server saves an Access Token on a table within the shared
database, it becomes immediately available to the Protected Resource.

We also went through a concept called [Token Introspection](add-link). With
this protocol, it is not necessary for the Authorization Server and the
Protected Resource to share the same database. The Protected Resource is
able to query the Authorization Server to ask certain things about the
Access Token. For example, the Protected Resource can ask the Authorization
Server if the Access Token is still valid and has not reached its
expiration time, or what scopes the client was granted.

Token Introspection has a tendency to overload the Authorziation Server.
Imagine if you had 1000 Protected Resources and all of them were making
calls to the same Authorization Server. The solution to the problem of
overloading the Authorization Server is to create a cache. For example, the
Authorization Server could create a cache of when a token expires, so when
a Protected Resource asks if a token is valid, the request could be routed
to the cache instead of going directly to the database.

Having a cache for Access Token metadata can get dangerous. According to
[RFC 7662 section 4](https://www.rfc-editor.org/rfc/rfc7662#section-4):

> "A more aggressive cache with a longer duration will minimize network
> traffic and load on the introspection endpoint, but at the risk of stale
> information about the token. For example, the token may be revoked while
> the protected resource is relying on the value of the cached response to
> make authorization decisions. This creates a window during which a
> revoked token could be used at the protected resource."

:::readingDuck

What if instead of caching the token metadata inside the Authorization
Server, the token itself could include the metadata? Would that be a good
idea?

:::

Exactly! That's a great idea! These class of Access Tokens are known as
structured tokens. They include all the data related to the delegation act.
Such as the relevant granted scopes of the client, and the expiry! This
would make the Protected Resource more independant. There would be no need
to send requests to the Authorization Server when the database is not
shared between them since all the token metadata is embedded in the token
itself!

:::me

We now have a good overview of what Access Tokens are and why it would be a
good idea to include the metadata of an Access Token inside the Access
Token itself.

:::

:::thinkMe

Let's look at how data can be included inside an Access Token.

:::

## Structured Tokens

Let's think about the negative side-effects of adding token data into the
Access Token itself and the Protected Resource not performing Token
Introspection:

- The Protected Resource is not able to validate the authenticity of the
  Access Token. Any user or client could have created the token. The
  Protected Resource would have no choice but to accept since it can't make
  a call to the Authorization Server to verify.
- Since all metadata is already available within the token itself, the data
  becomes exposed to everyone, including the OAuth Client who has no
  business reading the token data. The client is simply meant to pass the
  token along to the Protected Resource.

:::thinkMe

Let's now go into detail on how these two problems can be solved.

:::

### Token Signing

The first problem (validating token authenticity) can be solved by token
signing. Think of the authorization server as a notary. It writes a
statement ("this token belongs to user Alice, may create public Facebook
posts, expires at 10:15"), then stamps it with a seal only the
Authorization Server owns. Anyone can read the statement, and anyone can
check the seal against the notary's publicly posted sample, **but nobody
else can forge the seal**. The seal only exists with the Authorization
Server. We will look at how exactly token signing actually works later on
in this blog. We will go through two types of token signing in this blog:

- Symmetric signing with HS256
- Asymmetric signing with RS256

:::armsCrossedDuck

It's great that Access Tokens can be verified by the Protected Resource
through Token Signing, but attackers can still read the contents of the
token!! It's still unsafe!

:::

:::me

That is why the Authorization Server must also encrypt the token on top of
signing it.

:::

### Token Encryption

As stated, only the Protected Resources needs to parse the token and read
its contents. The client or anyone else has no business in reading the
token. This is why the token should be encrypted from the Authorization
Server and the Protected Resource should have a method of decrypting and
parsing the token. We will touch on token encryption near the end of this
blog.

:::staringDuck

Wow! Token signing and token encryption solved the problem of validating
token authenticity, and also the problem of having the data exposed to
other than the Protected Resource! That's great!

:::

:::me

Let's look at how we can structure data inside of a token so it can be
efficiently signed and encrypted.

:::

## JWT Tokens

There are many ways in which we could structure data inside of an Access
Token. Turns out there is already a general-purpose, lightweight way to
securely pass data between separate web entities like the Client, Protected
Resource and Authorization Server. This method of structuring data inside a
payload (Access Token), is called JWT(JSON Web Token).

OAuth predates the existence of JWT. Before JWT, Access Tokens were mainly
opaque, and causing a lot of load on the Authorization Server as we saw
when discussing token introspection. When JWT was created, it was clear
that this could be used for an Access Token.

### JWT Claims

A JWT is written in JSON, and is shaped in a way where it can be reliably
and safely sent across the network. The names of the JSON fields can be
anything. The JWT spec has defined a certain set of claims (also known as
fileds). Here are the main claims that will be available in an Access
Token:

- `iss`: The issuer of the token. Meaning, who created this token. This is
  typically the URL of the Authorization Server.
- `sub`: The subject of the token. Meaning, who the token is about.
  Typically this would be the owner of the private resource. In our example
  carried through the blogposts, this would be you, the owner of your
  Facebook account.
- `aud`: The audience of the token. Meaning, what OAuth component the token
  is destined for. In most cases this is the Protected Resource.
- `exp`: The expiration timestamp of the token.
- `nbf`: The not-before timestamp of the token. Meaning, when the token
  will start to be valid.
- `iat`: The issued-at timestamp of the token. Meaning, when the token was
  created.
- `jti`: The unique identifier of the token. This is a value that is unique
  to each issuer (Authorization Server). This is value is what separates
  each token. All other values can be the same except this.

If you would like to see the full set of registered claim names defined by
the OAuth spec, then please view
[RFC 9068](https://www.rfc-editor.org/info/rfc9068/#section-2.2).

## JWT Structure

Here is an example JWT token:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJzdWIiOiJ1c2VyLTEyMzQ1IiwiYXVkIjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20iLCJleHAiOjE4OTM0NTYwMDAsIm5iZiI6MTg5MzQ1MjQwMCwiaWF0IjoxODkzNDUyNDAwLCJqdGkiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjEyMzQ1Njc4OTAifQ.dL90gFA78Oero6mMxAMZmmT6REnj4otiU1TWEhEu-g4
```

:::sweatingDuck

That's just a jumble of characters. You said that there would be
structure!!

:::

:::me

Don't worry! Let's try to make sense of these characters.

:::

Notice that there are 3 sections separated by a period:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
.
eyJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJzdWIiOiJ1c2VyLTEyMzQ1IiwiYXVkIjoiaHR0cHM6Ly9hcGkuZXhhbXBsZS5jb20iLCJleHAiOjE4OTM0NTYwMDAsIm5iZiI6MTg5MzQ1MjQwMCwiaWF0IjoxODkzNDUyNDAwLCJqdGkiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjEyMzQ1Njc4OTAifQ
.
dL90gFA78Oero6mMxAMZmmT6REnj4otiU1TWEhEu-g4
```

Every section is base64 encoded.

:::thinkMe

Let's go through each section of a JWT token and see the purpose.

:::

### Header

The first section of the JWT token is called the `header`. Its purpose is
to store metadata about the JWT token. Let's decode the first section and
see the content. Here is the formatted JSON output:

```json
{
  "typ": "JWT"
}
```

It simply tells us that the token type is JWT. Other information can also
be included such as the algorithm used to sign the token. We will see this
later down in the blog.

### Payload

The second section of the JWT token is called te `payload`. Its purpose is
to store the actual data of the Access Token. Let's decode the first
section and see the content. Here is the formatted JSON output:

```json
{
  "iss": "https://auth.example.com",
  "sub": "user-12345",
  "aud": "https://api.example.com",
  "exp": 1893456000,
  "nbf": 1893452400,
  "iat": 1893452400,
  "jti": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

We can see the same claims we mentioned in the previous section.

### Signatre

The third and last section of the JWT token is called the `signature`. Its
purpose is to make sure the JWT token was dispensed by the issuer (`iss`).
It is used to verify that the token was not changed along the way. In this
case the issuer is our Authorization Server. It is not possible to simply
base64 decode the `signature` section.

:::magnifyingglassme

Let's dive deeper into the signature section and see how it truly works.

:::

## Token Signing Methods

:::sleepingDuck

Remind me again why token signing is important. I fell asleep when you were
explaining it before.

:::

:::lastNerveMe

Sure... Let's use our Strava/Facebook example once again.

:::

The client is Strava, and the Protected Resource is Facebook. Strava is
trying to make a Facebook post on your behalf. Also, let's assume that
Strava has successfully requested an Access Token from the Authorization
Server that is an unsigned JWT token meaning, the token has the first two
sections (header, payload) and not the last (signature).

Some time has passed, and now the JWT token has expired. What is stopping
Strava from making another self-contained JWT token itself, instead of
requesting one from the Authorization Server? There is no token
introspection from the Protected Resource. The Authorization Server is
can't validate that the token originated from it.

This is why Token Signing is needed. A way for the Protected Resource to
validate that an Access Token originated from the Authorization Server
without making a request to the Authorization Server.

Thankfully there is a whole suite of specifications that tell us exactly
how we can sign tokens. The JSON Object Signing and Encryption standards,
or JOSE, provides multiples specifications that are useful to us:

- Signatures: JSON Web Signatures (JWS)
- Encryption: JSON Web Encryption (JWE)
- Key storage formats: (JSON Web Keys, JWk)

A JWT token with only the first two sections (no signature section) is
simply an unsigned JWS object with a JSON based payload.

:::readingDuck

It's clear now why a JWT Access Token needs to be signed and the
specifications that allow us to do that. I would like to see some examples
of token signing.

:::

:::me

Let's do it!

:::

Although there are many ways to sign a JWT token, let's look at two widely
used methods:

- Symmetric Signing with HS256

- Asymmetric Signing with RS256

:::note

HS256 and RS256 are simply signature schemes. Meaning a group of algorithms
that allow you to generate, sign and veriy a key. While a signature
specification is defining how a signature is formatted, and transported.
You can think of Symmetric/Asymmetric signing as the signature
specifications, and HS256/RS256 as the signature schemes.

:::

### Symmetric Signatures With HS256

The premise of a symmetric signature is to have a shared secret between the
Authorization Server and the Protected Resource. The Authorization Server
would sign the token with the shared secret, then the Protected Resource
would validate the signed token with the same shared secret.

In order to sign an already existing JWT token that is currently unsigned,
we would first need to modify the head of the JWT token to signify what
signing algorithm we are using. In this case we are using `HS256`. Here is
what the JWT header would look like after modification:

```json
{
  "typ": "JWT",
  "alg": "HS256"
}
```

Next, we need to decide on a shared secret between the Authorization Server
and Protected Resource.

:::proudDuck

I know! I know! Let's use a shared called "quack"!

:::

:::lastNerveMe

_sigh_... fine.

:::

Normally the shared secret "quack" would be managed by a credential
management process like [Vault](https://developer.hashicorp.com/vault).
This is a good method when the Procted Resrouce and the Authorization
Server and closely tied together. The shared secret can be thought of as an
API key.

Let's assume now that we have our shared secret configured in both our
Authorization Server and Protected Resource. Also, we have modified the JWT
`Header` to include the signing algorithm.

The final step is to actually sign the JWT token. For this example, I will
use the [JWT library for Golang](https://github.com/golang-jwt/jwt). This
library gives us a number of helper functions to both sign and encrypt JWT
tokens.

We will first create a new unsigned JWT token, making sure to specify all
our claims listed in the `payload` variable. Then, we will sign the token
by specifying the shared secret:

```
unsignedToken := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims(payload))
accessToken, err := unsignedToken.SignedString([]byte(sharedTokenSecret))
```

The `accessToken` variable now includes a symmetrically signed JWT token
with HS256 signing algorithm.

Here is an example of what the `accessToken` might include:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJodHRwczovL2FwaS5leGFtcGxlLmNvbSIsImV4cCI6MTg5MzQ1NjAwMCwiaWF0IjoxODkzNDUyNDAwLCJpc3MiOiJodHRwczovL2F1dGguZXhhbXBsZS5jb20iLCJqdGkiOiJhMWIyYzNkNC1lNWY2LTc4OTAtYWJjZC1lZjEyMzQ1Njc4OTAiLCJuYmYiOjE4OTM0NTI0MDAsInN1YiI6InVzZXItMTIzNDUifQ.lC8obUSOx8CXqkKo39BoaaMGg0rB6qLuPiIUNu6U81o
```

Try to validate the above JWT signature by going to
[jwt.io](https://www.jwt.io/). Under the "JWT Signature Verification"
section, type in "quack" and you will notice that it is a valid secret and
the token is verified:
![JWT Token signature is valid!](../images//jwt.png "JWT token is valid!")

The critical thinkers among you might have spotted a problem with this
approach. The Protected Resource can alos create signed JWT tokens! This is
because both the Protected Resource and the Authorization Server are using
the same shared secret for signing tokens. So the Protected Resource can
sign newly created tokens, mimicing a stamp of approval from the
Authorization Server.

:::magnifyingglassme

Let's look at another way of signing tokens which addresses the problem of
non-repudiation (the Protected Resource signing tokens).

:::

### Asymmetric Signatures With RS256

We are once again going to sign the token with a secret key but this time
we are going to use
[public key cryptography](https://www.youtube.com/watch?v=GSIDS_lvRv4).

The Authorization Server will have both the public and private key. When a
new token is generated, the Authorization Server will sign the token with
it's private key.

The public key of the Authorization Server is shared with the Protected
Resource. The signed token can be verified with the public key.

Unlike a shared secret with symmetric signing, the Protected Resource only
has access to the Authorization Server's public key, so it has no way of
generating it's own token.

This is what a generated key pair looks like. It is a 2048-bit RSA key,
which is the minimum recommended size. It is stored in the JSON-based JWK
format:

```json
{
  "alg": "RS256",
  "d": "EJ4DY1yAe-D9dWTm261KYiewmVBTzuo4pSrWXmnkl2OfPPpkeokBYguFlZKlRIminF1fJMqzD79uOXOJHWsvYAjOEguubrFACZPxgLtQdDQHQSUxKbD0v9MdnwOwDDeB7OKlhpPqg5X2zgYAPGBWhyIQGbkI-Rc8LERCKYsHCT-SkFGMPcOGQJb-It3SHFEbYpBHNH0wtGQvQtgVYZskokFZ0Pzz1kmPs-uLn3IfaddSal0SdIv1LhyzKadq9j8tchP3KuhYY2BzVMoh5OqHYiUGB1Fz4PQbB53FAHfWGjY_cBx029t9TjRxz22R4A68CWBuO2zdL6zJFrT_d-W4Ow",
  "e": "AQAB",
  "n": "xuf1pzRCQZslclQwb4l1lxjm5lHEcYa9WeGCNJULafvWOknFpPjVqg6WF89Rp0BiCG5SkGx35523ZakzFFRqyWOSsRYxWHzP0yzV5WcNZ4SpeDFrpstFelEQyK2UMMMLO25TZJ4OnIw5wmWdOJQywL4bh5O2kSBkKRKLH2fpkdx_38VrJP9d3xcNzsKGuU9cYeE3F5FdcxLZD94VAWP7WkutKdPaGNOJvxJZrmbYr8fylP04v18sgL8X26Js3ngiDrtYsBIPzfQ_5HGdxKDRJwjqClBOMDoAKzjqOaChI_XOXX5CS8DDyNZOAEdY2fTDDjX5k7FSjjjU-Iva0X6KmQ",
  "kty": "RSA",
  "kid": "authserver"
}
```

Notice the `kid`, meaning key ID. In a production system, if the
Authorization Server has multiple Protected Resources registered, then a
unique key should be registered for each service.

Now that we have our public, private key pair, we are able to sign the
token with the private key and send the public key to the private resource.
Also, remembering to modify the header of the JWT token, as we did before:

```json
{
  "typ": "JWT",
  "alg": "RS256",
  "kid": "authserver"
}
```

Notice that we have the key ID embedded in the header. This is to help the
Protected Resource make sure that you used the right key.

:::suspiciousDuck

Wait... if I had 100 Protected Resources, would I have to update each one
when generating a new public key from the Authorization Server? That's a
lot of work!

:::

Thankfully the OAuth spec gives us a way around by providing a `well-known`
URL. It returns a JSON document describing the issuer,
authorization_endpoint, token_endpoint, scopes_supported and so on. It also
has a `jwks_uri` field pointing to where the public signing keys are
published. So your private resources can automatically grab the public
certificate instead of you having to manually change it.

:::joyfulDuck

I'm glad I finally understand the concepts of symmetric and asymmetric
token signing. That was fun!

:::

:::sweatingDuck

What about token encryption? We can now prove that the token originated
fromt he Authorization Server, but everyone can still read the contents of
the token! Even the OAuth client. The client has no business reading the
token!

:::

:::dabMe

Let's discuss Token Encryption!

:::

## Token Encryption Method

To make our life easy, JOSE also provides an encryption mechanism called
JSON Web Encryption (JWE). Instead of a 3 part JWT structure, you now have
a 5 part structure. Covering the JWE structure is a bit much for this blog
post. But for an advanced exercise, try adding JWE to the JWT tokens
mentioned.

First, give the resource server a key pair and give the authorization
server access to the public key portion of this key pair. Then use the
public key to encrypt the contents of the token using JWE. Finally, have
the resource server decrypt the contents of the token using its own private
key and pass the payload of the token along to the application.

## Token Lifecycle

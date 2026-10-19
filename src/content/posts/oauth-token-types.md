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
just seen it as a jumble of characters, with a `Bearer` type.:

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
creating overloading the Authorization Server is to create a cache. For
example, the Authorization Server could create a cache of when a token
expires, so when a Protected Resrouce asks if a token is valid, the request
could be routed to the cache instead of going directly to the database.

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
structured tokens. They include the all the data related to the delegation
act. Such as the relevant granted scopes of the client, and the expiry!
This would make the Protected Resource more independant. There would be no
need to send requests to the Authorization Server when the database is not
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

Let's think about the side-effect problems of adding token data into the
Access Token itself and the Protected Resource not performing Token
Introspection by sending requests to the Authorization Server:

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
else can forge the seal**. We will look at how token signing actually works
later on in this blog. We will go through two types of token signing in
this blog:

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
token. This why it should be encrypted from the Authorization Server and
the Protected Resource should have a method of decrypting and parsing the
token. We will touch on token encryption near the end of this blog.

## JWT Tokens

There are many ways in which we could structure data inside of an Access
Token. Turns out there is already a general-purpose, lightweight way to
securely pass data between separate web entities like the Client, Protected
Resource and Authorization Server. This method of structuring data inside a
payload, is called JWT(JSON Web Token).

OAuth predates the existence of JWT. Before JWT, Access Tokens were mainly
opaque, and causing a lot of load on the Authorization Server as we
discussed above. When JWT was created, it was clear that this could be used
for an Access Token.

A JWT is written in JSON, and is shaped in a way where it can be reliably
and safely sent across the network.

### JWT Claims

## Token Signing Method

### Symmetric Signatures With HS256

### Asymmetric Signatures With RS256

## Token Encryption Method

## Token Lifecycle

---
title: "Part 7 - OpenID Connect"
published: 2026-09-20
draft: false
description:
  "Why an Access Token can never tell you who the user is, what the ID
  Token adds, and how nonce, aud and the UserInfo sub-check stop code
  injection and token substitution."
tags: ["OAuth", "Security", "Authentication"]
series: "OAuth Simplified"
---

## Introduction

OAuth 2.0 is a **delegation protocol**. It is used to gather the consent of
a resource owner (user) and performa an action on a secure system
(Protected Resource). Because of this functionality, many engineers would
confuse OAuth 2.0 as an authentication protocol. This is totally flase.

:::warning

OAuth 2.0 is not an authentication protocl!

:::

In this blog post we will discuss how you can introduce user authentication
on top of an already working OAuth 2.0 setup.

Let's dive in!

## Why OAuth 2.0 is Not An Authentication Protocol

Confusing OAuth 2.0 with supporting authentication is understandable. OAuth
2.0 embeds many authentication events inside, and OAuth 2.0 itself can be
embedded in an authentication protocol.

:::confusedDuck

What exactly is authentication?

:::

Authenticaton tells a system two things:

- Who the user is.
- If the user is currently present and using the application.

An authentication protocl would most likely tell you a number of things
about the user, such as the unique identifier of the logged in user, the
first name, last name, email adress. OAuth 2.0 does not tell you any of
that. Neither does OAuth 2.0 guarantee that the user is currently present
and is using using the application, or who the user is. All OAuth 2.0 is
designed to do is obtaining an Access Token for use where the user is not
able to interactively authorize the application.

For example, lets say you are logged into Strava and you are also logged
into Facebook. Althrough Strava can make Facebook posts on your behalf
using OAuth 2.0, you are not actively facilitating the connection between
Strava and Facebook. This is where the power of OAuth 2.0 lies.

:::confusedDuck

What if I want to login to my Strava running app through Facebook?

:::

:::me

This is not possible with OAuth 2.0 alone.

:::

Signing into Strava with your Facebook account would require authentication
which OAuth 2.0 inherently does not support. Here is what the login screent
would look like:

![Option to sign in with Facebook on Strava.](../images/sign-in-with-facebook.png "Option to sign in with Facebook on Strava.")

It should be now apparent that this will not be possible with any of the
OAuth flows we just discussed. As mentioned above, in order for us to
implement the "sign in with Facebook" login method on Strava, we would need
to know who the user is, and if the user is curerntly present, and using
the application.

The rest of this blog post will discuss how this "Sing In With Facebook"
button can be implemented by adding extra features on top of OAuth 2.0. We
are now taking advantage of the extensible nature of OAuth!

:::dabMe

Let's find out how this would work!

:::

## Figuring Out An Authentication Protocol

:::me

Let's work from first principles and build our way up to an authentication
protocl that we are fully able to trust and work seemlessly with Oauth 2.0.

:::

First of all we need a _user_, that has a Facebook email and password of an
existing Facebook account.

Next, we need a trusted place to store and validate user credentials. In
this case, the user's Facebook email and password. Let's say we have a
server which will store multiple Facebook emails and passwords for various
users. This server will simply validate credentials when a request with a
Facebook email and password comes in. Let's call this server an \_Identity
Provider.

So now we have a _user_ with a Facebook email and password. We also have an
Identity Provider which can store the user's credentials and validate them
at login. The final piece we need for this authentication protocol is
Facebook itself! We will simply call Facebook the \_Relying Party. A
Relying Party simply wants to authenticate a user through an external
Identity Provider.

:::readingDuck

We have the user, Identity Provider, and a Relying Party for our
authentication protocol. It would be nice if we could walk through a simple
authentication flow so these elements become more concrete.

:::

Here is what a simple authentication flow would look like:

1. User sends an authentication request to the Identity provider with their
   credentials to access the Relying Party.
2. Identity Provider successfully validates the credentials.
3. Identity Provider redirects the user to their account on the Protected
   Resource.

:::armsCrossedDuck

What's the point of having the Identity Provider anyway? Can't the Relying
Party handle it's own user credentials?

:::

:::me{align="right"}

Yes, if you have only one application, it would make sense. But what if you
now have multiple applications? Let's say you have Instagram, and Snapchat
alongside Facebook. It's better to have a central place to manage
credentials in this case. You will have one place to control users across
multiple applications.

:::

We now have the ability to sign in users and redirect them to the Protected
Resource.

:::eyesDuck{align="left"}

Okaaay, it's nice that we have a simple authentication protocol but this
has nothing to do with OAuth 2.0.

:::

:::starEyesMe{align="right"}

Patience! We are just about to get to the juicy part of the blog!

:::

## Extending OAuth 2.0 for User Authentication

Let's see how we can match our authentication protocol elements with
elements of OAuth 2.0.

Here are the elements of OAuth 2.0 that should be very familiar at this
point:

- Resource Owner
- Authorization Server
- Client
- Protected Resource

Here are the elements of our authentication protocol we discussed in the
last section:

- User
- Identity Provider
- Relying Party

The Resource Owner from OAuth matches quite nicely with the user in our
authentication protocol. Same goes for the Authorization Server and the
Identity Provider.

The same can't be said for the Relying Party in our authentication
protocol. The Relying Party could either be matched with the OAuth Client
or the OAuth Protected Resource.

Here are the matchings between both protocols:

- User ➡️ OAuth Resource Owner
- Identity Provider ➡️ OAuth Authorization Server
- Relying Party ➡️ OAuth Protected Resource / OAuth Client

:::cryingDuck

The Relying Party from our authentication protocol doesn't cleanly match a
single element in OAuth 2.0. Which remaining OAuth component should Relying
Party match with? The OAuth Client or the OAuth Protected Resource?

:::

:::me

Let's try both! But first let's clear up the meaning behind the "Login With
Facebook" button

:::

Let's go back to our Strava/Facebook example for a moment and only focus on
the OAuth components for now:

Here are the OAuth components:

- User: you
- Client: Strava
- Protected Resource: Facebook API
- Authorization Server: Facebook's own server that handles all the
  responsibilites of an [Authorization Server](insert link to auth server
  blog)

Notice the difference between the Protected Resource and the Authorization
Server. They are both owned by Facebook, but the Protected Resource is
simply a Facebook API to make posts. Facebook also has it's own
Authorization Server that can dispense Access Tokens. They are two
different OAuth entities.

If the user clicks on "Login with Facebook", this would mean that the
Facebook Authorization Server needs to be extended to support this
functionality. NOT the Facebook API (Protected Resource). This is why the
Identity Provider is matching with the Authorization Server. I am
mentioning this point so people do not get confused with the "login with
Facebok" button. After pressing this button, the request will go straight
to the Facebook Identity Provider, which can be an extension of the
Facebook Authorization Server. We will see exactly how this is done later
on in this blog.

### Relying Party As The OAuth Protected Resource

Let's maps out all the elements involved, and walk through a flow of the
user pressing the "Login With Facebook" button on Strava. We will assume
that all OAuth enttities have been extended with functionalities to perform
the authentication flow we mentioned in the previous section.

- OAuth Resource Owner (authentication flow user): You
- OAuth Client: Strava
- OAuth Protected Resource (authentication flow Relying Party): Facebook
  API
- OAuth Authorization Server (authentication flow Identity Provider):
  Facebook Authorization

1. User goes to the Strava website.
2. User clicks on the "Login with Facebook" button
3. User is redirected to the Facebook Identity Provider
4. User logs in successfully
5. User is redirected to the Relying Party, which in this case is the
   Facebook API!

:::gaspDuck

That's not what we want!!

:::

The user should have been redirected back to Strava. Not the Facebook API.
The Facebook API doesn't even have a UI to show the user. It's just an API
to make a Facebook post on the user's behalf.

:::runningMe

Time to jog your brain! Try to pause here and think exactly what went
wrong. Reread the "Figuring Out an Authentiation Protocol" section again.

:::

The root cause of the problem is that our authentication protocol is
designed to redirect the user to the Relying Party after successful login.
In this case, the relying party is the Facebook API.

This problems also breaks the OAuth protocol. The user is now directly
communicated with the Protected Resource (Relying party). The user should
only directly communicate with either the Client or the Authorization
Server (Identity Provider). Never the Protected Resource. Thinking about
our example: there is no need for the user to interact with the Facebook
API in order for Strava to make a Facebook post on the user's behalf.

:::sickDuck

What a mess! Let's see if we can fix this redirect problem in the next
section.

:::

### Relying Party As The OAuth Client

---

There is also another OpenID Connect is a layer on top of OAuth 2.0 that
fills exactly this gap. Its own abstract describes it as "a simple identity
layer on top of the OAuth 2.0 protocol," and it is a genuine layer — the
flow you already know does not change shape.

The trigger is a single scope value:

```bash
GET /authorize?response_type=code
  &client_id=strava
  &redirect_uri=https%3A%2F%2Fstrava.com%2Fcallback
  &scope=openid%20post
  &state=af0ifjsldkj
  &nonce=n-0S6_WzA2Mj
  &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
  &code_challenge_method=S256
```

That is the same authorization request from
[Part 4](/posts/oauth-authorization-server#the-authorization-endpoint),
with two additions: `openid` at the front of the scope, and a `nonce`. Ask
for the `openid` scope and the Authorization Server becomes an **OpenID
Provider**, Strava becomes a **Relying Party**, and the token response
comes back with one extra field in it.

:::readingDuck

OpenID Connect Core section 3.1.2.1 on the scope parameter: "OpenID Connect
requests MUST contain the `openid` scope value. If the `openid` scope value
is not present, the behavior is entirely unspecified."

:::

Note the wording — not "the server must reject it," but that you have
wandered outside what the spec covers. Without `openid` you are doing plain
OAuth, and you get plain OAuth's answer: an Access Token and no statement
about anybody.

Exchange the code at `/token` exactly as before, and the response has
grown:

```json
{
  "access_token": "987tghjkiu6trfghjuytrghj",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "j2r3oj32r23rmasd98uhjrk2o3i",
  "scope": "openid post",
  "id_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMjYtMDMtMzAifQ..."
}
```

## The ID Token

That `id_token` is the entire point of OpenID Connect. And you already know
what it is, because you spent Part 6 taking one apart — it is a JWT.

```bash wrap
eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjIwMjYtMDMtMzAifQ.eyJpc3MiOiJodHRwczovL2F1dGhvcml6YXRpb24tc2VydmVyOjkwMDEvIiwic3ViIjoiaGFtemEiLCJhdWQiOiJzdHJhdmEiLCJleHAiOjE3NzQ4NzU2MDAsImlhdCI6MTc3NDg3MjAwMCwiYXV0aF90aW1lIjoxNzc0ODcxOTQwLCJub25jZSI6Im4tMFM2X1d6QTJNaiJ9.<signature>
```

:::magnifyingglassme

The header first:

:::

```json
{
  "alg": "RS256",
  "typ": "JWT",
  "kid": "2026-03-30"
}
```

:::pointingDuck

`"typ": "JWT"` — not `at+jwt`. This is the other side of the check Part 6
told you to run.

:::

Part 6 said a protected resource must reject any JWT whose `typ` is not
`at+jwt`, because an ID Token and a JWT Access Token have nearly identical
shapes and are signed by the same key. This is the token they were being
protected against. An ID Token is addressed to Strava and says who the user
is; an Access Token is addressed to Facebook and says what may be done. Mix
them up and a client can hand its own ID Token to an API as if it were an
Access Token.

Now the payload:

```json
{
  "iss": "https://authorization-server:9001/",
  "sub": "hamza",
  "aud": "strava",
  "exp": 1774875600,
  "iat": 1774872000,
  "auth_time": 1774871940,
  "nonce": "n-0S6_WzA2Mj"
}
```

| Claim       | Level       | What it says                                                               |
| ----------- | ----------- | -------------------------------------------------------------------------- |
| `iss`       | REQUIRED    | Which OpenID Provider is making this statement.                            |
| `sub`       | REQUIRED    | Who authenticated. The identifier for the user at this issuer.             |
| `aud`       | REQUIRED    | **Who this statement is for.** Must contain Strava's `client_id`.          |
| `exp`       | REQUIRED    | When the statement stops being accepted.                                   |
| `iat`       | REQUIRED    | When it was issued.                                                        |
| `auth_time` | Conditional | When the user actually authenticated. Required if `max_age` was requested. |
| `nonce`     | Conditional | Required in the token if it was sent in the request.                       |
| `acr`/`amr` | OPTIONAL    | How strongly, and by what method, they authenticated.                      |

:::surprisedDuck

`aud` is `strava`. In the Access Token from Part 6, `aud` was
`https://api.facebook.com`.

:::

:::me

That is the fix, and it is worth stopping on. The ID Token is **addressed
to the client**. Strava checks that `aud` contains its own `client_id` and
rejects the token otherwise, so an ID Token issued to some other client
cannot be pushed into your login. The thing an Access Token could never say
is the first thing an ID Token says.

:::

And because it is signed by the OpenID Provider, Strava does not have to
take the client's word for any of it. That combination — signed, and
addressed to me — is what makes an ID Token an authentication statement
where an Access Token is not.

### Identifying The User

`sub` is the user's identifier, and it comes with rules that matter the
moment you put it in a database.

:::readingDuck

Core section 5.7: "the only guaranteed unique identifier for a given
End-User is the combination of the `iss` Claim and the `sub` Claim."

:::

So the key is the pair, not `sub` alone. `sub` is unique and never
reassigned _within one issuer_ — two different providers can hand you the
same `sub` for two entirely different people. It is at most 255 ASCII
characters and it is case-sensitive.

:::facepalmDuck

I was going to key my users table on their email address.

:::

:::me

Almost everybody does it once. The spec closes that door explicitly:
`email`, `phone_number`, `preferred_username` and `name` "MUST NOT be used
as unique identifiers for the End-User." An issuer is allowed to let an
email address change, and is even allowed to reuse one across different
users at different times. Key on `(iss, sub)`, and treat everything else as
display data that may change tomorrow.

:::

Notice too that `sub` here is the same `hamza` that appeared in the Access
Token in Part 6. Same user, same issuer, so the same subject identifier —
that is exactly the consistency `sub` is promising.

:::note

Real providers use opaque values like `24400320` rather than a readable
`hamza`. This series uses the readable one because it is easier to follow
across seven posts, but an opaque identifier is the better habit: it avoids
leaking a username, and it survives the user changing theirs.

:::

### Getting A Name And An Email

The ID Token proves who authenticated. It does not, by default, carry much
_about_ them. For that you add more scopes:

| Scope     | Claims requested                                                                                                                                                                 |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profile` | `name`, `family_name`, `given_name`, `middle_name`, `nickname`, `preferred_username`, `profile`, `picture`, `website`, `gender`, `birthdate`, `zoneinfo`, `locale`, `updated_at` |
| `email`   | `email`, `email_verified`                                                                                                                                                        |
| `address` | `address`                                                                                                                                                                        |
| `phone`   | `phone_number`, `phone_number_verified`                                                                                                                                          |

Two things about this table surprise people, and both are worth knowing
before you design around it.

The first is where those claims arrive. When an Access Token is issued —
which it is, in the flow we are using — the spec says these claims come
back from the **UserInfo endpoint**, not inside the ID Token. Some
providers put them in the ID Token as well, but that is them being
generous, not the default.

The second is that none of them are guaranteed. They are **Voluntary
Claims**, and a provider may decline to return any of them for privacy
reasons. As the spec puts it: "It is not an error condition to not return a
requested Claim." Code that assumes `email` will always be there will
eventually meet a user for whom it is not.

## The UserInfo Endpoint

UserInfo is an ordinary OAuth protected resource — the same kind of thing
Part 3 was entirely about. Strava calls it with the Access Token:

```bash
GET /userinfo HTTP/1.1
Host: authorization-server:9001
Authorization: Bearer 987tghjkiu6trfghjuytrghj
```

```json
{
  "sub": "hamza",
  "name": "Hamza Masood",
  "preferred_username": "hamza",
  "email": "hamza@example.com",
  "email_verified": true,
  "picture": "https://example.com/hamza.jpg"
}
```

`sub` is the only claim guaranteed to be in that response, and it is there
for a good reason.

:::suspiciousDuck

Wait. That call was authenticated with the **Access Token**. You told me an
Access Token does not say who it was issued to.

:::

:::me

Right. If an Access Token ever reaches Strava by some route other than its
own token request, for example sent up by a mobile app, it could have been
issued to anyone. The spec has a hard rule for precisely this.

:::

:::readingDuck

Core section 5.3.2: "Due to the possibility of token substitution attacks,
the UserInfo Response is not guaranteed to be about the End-User identified
by the `sub` (subject) element of the ID Token. The `sub` Claim in the
UserInfo Response MUST be verified to exactly match the `sub` Claim in the
ID Token; if they do not match, the UserInfo Response values MUST NOT be
used."

:::

UserInfo answers "who does _this Access Token_ belong to," which is the one
question an attacker gets to influence by swapping the token. The ID Token
answers "who authenticated, in the flow that _you_ started." Comparing the
two `sub` values is what ties them together, and it is a `!==` and a
rejection — not a warning, not a log line.

:::thumbsDownDuck

Calling `/userinfo` and trusting what comes back, without an ID Token to
check it against, is the original broken pattern wearing a nicer endpoint.

:::

:::note

The UserInfo endpoint is only **RECOMMENDED**, not required — a conformant
provider is allowed not to have one. Read `userinfo_endpoint` from the
discovery document rather than assuming the path, and cope with it being
absent.

:::

## nonce, And How It Differs From state

We slipped a `nonce` into that authorization request and it came back
inside the ID Token. Time to say what it is for, because the usual
one-liner about it is not quite right.

`state`, from [Part 2](/posts/oauth-client#the-state-parameter), comes back
as a **query parameter on the redirect**. `nonce` comes back **inside the
signed ID Token**. That difference in delivery is the whole story.

:::armsCrossedDuck

I have read that `state` stops CSRF and `nonce` stops replay, and that they
are two separate jobs. Is that not the answer?

:::

:::me

It is the usual answer and it is too tidy. The current OAuth security
guidance, [RFC 9700](https://www.rfc-editor.org/rfc/rfc9700#section-2.1),
says outright that "in OpenID Connect flows, the `nonce` parameter provides
CSRF protection" — so they overlap. The distinction worth carrying is a
different one.

:::

The thing `nonce` catches that `state` cannot is **authorization code
injection**, the attack from the top of this post: an attacker who obtains
a valid authorization code and injects it into your session. A returned
`state` proves the response belongs to a flow you started. It says nothing
about where the _code_ inside that response came from. Because `nonce`
travels back inside a token the OpenID Provider signed, an injected code
produces an ID Token whose `nonce` does not match the one Strava stored —
and the flow dies.

:::note

`nonce` is **OPTIONAL** in the Authorization Code Flow. It is only strictly
required for the implicit and hybrid flows. You will see it described as
mandatory in a lot of places; that is not what the spec says.

Send it anyway. It costs one random value, and along with
[PKCE](/posts/oauth-authorization-server#pkce) it is one of only two
defences against code injection. Note that for public clients PKCE is the
one that matters — `nonce` does not protect a public client's code, because
an attacker with the code can simply call `/token` directly.

:::

## Validating The ID Token

An ID Token you have not checked is worth no more than the Access Token we
started this post by rejecting. Core section 3.1.3.7 sets out what Strava
must do, and the interesting steps are the ones people skip:

1. **Decrypt it**, if encryption was agreed at registration time.
2. **`iss` exactly matches** the OpenID Provider Strava expects.
3. **`aud` contains Strava's `client_id`.** Reject it if not — and also
   reject it if it names other audiences Strava does not trust.
4. **Validate `azp`** if extensions are in play that make it appear. Most
   implementations are encouraged to ignore it.
5. **Verify the signature** using the provider's keys, from the `jwks_uri`
   in its discovery document — the same JWKS machinery as Part 6.
6. **`exp` has not passed**, with a little leeway for clock skew.
7. **`iat`** is recent enough for Strava's taste. The acceptable range is
   the client's call.
8. **`nonce` matches** the value Strava sent, if it sent one.
9. **`acr` and `auth_time`** are acceptable, if they were requested.

:::confusedDuck

Step 5 says verify the signature. Is that not the whole basis of trusting
the thing?

:::

:::me

It is — and yet the spec is softer here than almost every blog post claims.
For an ID Token collected **directly from the token endpoint**, as in the
code flow, section 3.1.3.7 permits TLS server validation to stand in place
of checking the signature. The reasoning is that you fetched it over an
authenticated TLS connection straight from the provider, so nothing
untrusted ever touched it.

:::

:::bothThumbsUpDuck

Verify the signature anyway.

:::

That is the strongest recommendation in this series and it is deliberate.
The carve-out only holds while the token never leaves that direct channel,
which is an assumption about your whole deployment — proxies, gateways,
service meshes, a future refactor — rather than about your code. Signature
verification is a few lines, libraries do it for you, and it keeps being
true when the surrounding architecture changes. In the implicit and hybrid
flows, where the token has been through the browser, the check is
unconditional anyway.

## Discovery

Part 4 introduced the Authorization Server's
[metadata document](/posts/oauth-authorization-server#authorization-server-metadata)
and the duck asked whether `/.well-known/openid-configuration` was the same
thing. Here is the real answer.

They are two different documents at two different well-known paths. OpenID
Connect's carries everything RFC 8414's does plus identity-specific fields
— `userinfo_endpoint`, `id_token_signing_alg_values_supported`,
`subject_types_supported`, `claims_supported`. In practice most providers
serve both with largely overlapping content, which is why they get treated
as interchangeable.

:::sweatingDuck

Mostly the same. So what happens on the day they are not?

:::

The two specs build their URLs by different rules, and it only shows up
when the issuer has a path component — which is exactly what multi-tenant
providers use for tenants and realms. OpenID Connect **appends** the
well-known string to the issuer. RFC 8414 **inserts** it between the host
and the path:

| Issuer                        | OpenID Connect Discovery                                       | RFC 8414                                                             |
| ----------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| `https://example.com`         | `https://example.com/.well-known/openid-configuration`         | `https://example.com/.well-known/oauth-authorization-server`         |
| `https://example.com/issuer1` | `https://example.com/issuer1/.well-known/openid-configuration` | `https://example.com/.well-known/oauth-authorization-server/issuer1` |

Note where `issuer1` lands in each. Same issuer, two genuinely different
URLs.

One more rule worth enforcing: the `issuer` value inside the document you
fetch MUST be identical to the issuer you built the URL from, and identical
to the `iss` in the ID Tokens it signs. Checking that is what stops a
provider — or something impersonating one — from claiming to be somebody
else's issuer.

## Which Flow

Part 5 sorted OAuth's grant types into the ones to use and the ones being
retired. OpenID Connect defines its own `response_type` values on top, and
the same verdict holds:

| `response_type`       | Flow               | Verdict                                                                |
| --------------------- | ------------------ | ---------------------------------------------------------------------- |
| `code`                | Authorization Code | Use this, with PKCE.                                                   |
| `id_token`            | Implicit           | No access token issued, but still browser-exposed. Avoid for new work. |
| `id_token token`      | Implicit           | Issues an access token in the redirect. Avoid.                         |
| `code id_token`       | Hybrid             | Was the high-security pattern; superseded.                             |
| `code token`          | Hybrid             | Avoid.                                                                 |
| `code id_token token` | Hybrid             | Avoid.                                                                 |

:::pointingDuck

There are exactly six, and plain `token` is not one of them. OAuth has a
`response_type=token`; OpenID Connect deliberately does not, because it
would return no ID Token and therefore say nothing about anybody.

:::

:::note

The OpenID Connect spec itself does **not** deprecate the implicit flow —
its implicit-specific security section is quite mild, and a conformant
dynamic provider is still required to support `id_token` and
`id_token token`. The discouragement comes from
[RFC 9700](https://www.rfc-editor.org/rfc/rfc9700#section-2.1), the current
OAuth security best practice, which says clients "SHOULD NOT use the
implicit grant." Spec conformance and current best practice genuinely
diverge here, which is worth knowing when a provider offers you a flow the
security guidance tells you to refuse.

:::

So the recommendation is the one this series has been building toward since
Part 1: **Authorization Code flow, with PKCE, plus `scope=openid` and a
`nonce`.** Nothing exotic. The same flow, asked one extra question.

## Conclusion

OAuth 2.0 delegates access. That is all it was ever designed to do, and it
does it well: a client ends up holding a token that opens a specific door,
for a specific user, for a specific while. What it never produces is a
statement about _who that user is_ — and Part 6 showed that the client is
not even permitted to look inside its Access Token to guess.

OpenID Connect adds exactly one thing to close that: a second token, signed
by the provider and addressed to the client by `client_id`. Every other
piece follows from those two properties. `nonce` is what makes an injected
code, like the one at the top of this post, fail. `aud` is what stops an ID
Token issued to another client from being used in your login. The `sub`
check on the UserInfo response is what stops a swapped Access Token from
silently changing whose profile you read. Take away the signature or the
audience and all three protections collapse back into the broken login at
the top of this post.

And it is a genuine layer, not a replacement. The redirect, the
Authorization Code, PKCE, the token endpoint, refresh tokens, scopes,
introspection, the metadata document — all of it is the OAuth you already
knew from the first six posts. You asked for one more scope and got one
more token.

That is the end of **OAuth Simplified**. Across seven posts we went from
"why can't Strava just have my password" to authorization codes, clients
and their redirect URIs, protected resources and scope enforcement, the
Authorization Server that issues everything, the full family of grant
types, what an Access Token is actually made of, and finally the identity
layer sitting on top of all of it.

:::armsUpDuck

You finished the series!

:::

:::me

Go and read
[the animation in Part 4](/posts/oauth-authorization-server#the-whole-flow-at-a-glance)
one last time. Every step, every parameter and every check in those twenty
steps should now be something you can explain to somebody else — which is,
after all, what the duck was for.

:::

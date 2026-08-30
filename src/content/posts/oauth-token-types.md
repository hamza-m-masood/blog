---
title: "Part 6 - OAuth Token Types"
published: 2026-09-06
draft: false
description:
  "Opaque tokens versus JWT Access Tokens, how a protected resource
  validates one without ever calling the Authorization Server, and what you
  give up when it stops asking."
tags: ["OAuth", "Security"]
series: "OAuth Simplified"
---

## Introduction

[Part 3](/posts/oauth-protected-resource) left two IOUs sitting in the
middle of it. One promised a closer look at bearer tokens and the other
token types. The other promised an alternative to
[token introspection](/posts/oauth-protected-resource#token-introspection),
because calling the Authorization Server on every single API request is a
lot of calling. This post pays both of them off, and they turn out to be
the same conversation.

Here is the thing we have quietly avoided for five posts: we have never
once looked inside an Access Token. We have passed it around, attached it
to headers, refreshed it and revoked it, but the token itself has always
been an anonymous blob. That is not an accident — it is a design choice,
and it has an alternative.

## Opaque Tokens

Everything this series has done so far used an **opaque** token. Back in
Part 3, Facebook received this from Strava:

```bash
POST /me/feed
Host: facebook.com
Authorization: Bearer 987tghjkiu6trfghjuytrghj
```

`987tghjkiu6trfghjuytrghj` means nothing. It is a random handle. There is
no user in it, no scope, no expiry — nothing but enough randomness that
nobody can guess another one. Every fact about that token lives in the
Authorization Server's database, filed under that string.

Which is exactly why Part 3 had to introduce introspection. Facebook cannot
answer a single question about the token on its own, so it asks:

```bash
POST /introspect HTTP/1.1
Host: authorization-server:9001
Accept: application/json
Content-Type: application/x-www-form-urlencoded
Authorization: Basic cHJvdGVjdGVkLXJlc291cmNlLTE6cHJvdGVjdGVkLXJlc291cmNlLXNlY3JldC0x

token=987tghjkiu6trfghjuytrghj
```

```json
{
  "active": true,
  "scope": "post",
  "client_id": "strava",
  "username": "Hamza",
  "iss": "https://authorization-server:9001/",
  "sub": "hamza",
  "aud": "https://api.facebook.com",
  "iat": 1774872000,
  "exp": 1774875600
}
```

:::suspiciousDuck

Hang on. Facebook does that on _every_ request? Facebook serves billions of
requests. That is billions of extra calls to the Authorization Server.

:::

:::me

Yes, and you are right to slow down here. That is the real cost of opaque
tokens, and it is not a small one.

:::

Every API call now costs a second network round trip before any work
happens. The Authorization Server sits in the hot path of every request to
every protected resource that trusts it, which makes it both a latency tax
and a single point of failure. If it goes down, every API that depends on
it stops being able to authorize anything, even though those APIs are
perfectly healthy.

In practice this gets softened with caching — the protected resource
remembers an introspection answer for a few seconds or a minute. But
caching an authorization decision is exactly the thing introspection
existed to avoid, and the introspection spec says so itself.

:::readingDuck

[RFC 7662 section 4](https://www.rfc-editor.org/rfc/rfc7662#section-4): "A
more aggressive cache with a longer duration will minimize network traffic
and load on the introspection endpoint, but at the risk of stale
information about the token. For example, the token may be revoked while
the protected resource is relying on the value of the cached response to
make authorization decisions. This creates a window during which a revoked
token could be used at the protected resource."

:::

Hold onto that last sentence. A cache window in which a revoked token still
works is the exact trade we are about to make on purpose, permanently.

:::confusedDuck

So why not just put the answer inside the token, and skip the phone call?

:::

:::me

That is precisely the idea, and it is the other half of what Part 3
promised. Let's build it.

:::

## Self-Contained Tokens

Look again at that introspection response. `iss`, `sub`, `aud`, `iat`,
`exp`, `scope`, `client_id` — that is the complete answer to "what is this
token good for." Right now Facebook has to make a network call to get it.

A **self-contained** token carries those fields inside itself. Facebook
reads them straight off the token, with no call to anyone.

:::armsCrossedDuck

Then what stops Strava from writing its own token that says whatever it
likes? If the answer is inside the token, and the token is in Strava's
hands, Strava controls the answer.

:::

:::me

That is the objection the whole design has to survive, and it is the right
one to raise. The answer is a signature. The Authorization Server signs the
token, and Facebook checks that signature before it believes a single field
inside. A forged token fails that check.

:::

The format that does this is the **JSON Web Token**, defined in
[RFC 7519](https://www.rfc-editor.org/rfc/rfc7519). A JWT is three chunks
of [Base64URL](https://www.rfc-editor.org/rfc/rfc4648#section-5), separated
by periods:

```bash
header.payload.signature
```

Here is a real one. Every field in it comes from that introspection
response above:

```bash wrap
eyJhbGciOiJSUzI1NiIsInR5cCI6ImF0K2p3dCIsImtpZCI6IjIwMjYtMDMtMzAifQ.eyJpc3MiOiJodHRwczovL2F1dGhvcml6YXRpb24tc2VydmVyOjkwMDEvIiwic3ViIjoiaGFtemEiLCJhdWQiOiJodHRwczovL2FwaS5mYWNlYm9vay5jb20iLCJjbGllbnRfaWQiOiJzdHJhdmEiLCJleHAiOjE3NzQ4NzU2MDAsImlhdCI6MTc3NDg3MjAwMCwianRpIjoiYjdjMWYwZTItOWEzZC00ZTU4Iiwic2NvcGUiOiJwb3N0In0.<signature>
```

:::sweatingDuck

That is not what I would call readable.

:::

:::me

It is not meant to be read by you, it is meant to be read by Facebook. But
it is not encrypted either — Base64URL is an encoding, not a cipher.
Anything that can split on a period can read it. Let's pull it apart.

:::

:::magnifyingglassme

Decoding the first chunk, the **header**, gives us this:

:::

```json
{
  "alg": "RS256",
  "typ": "at+jwt",
  "kid": "2026-03-30"
}
```

- `alg` is the algorithm the Authorization Server signed with. `RS256` is
  RSA with SHA-256 — an _asymmetric_ signature, which matters a great deal
  in a moment.
- `typ` declares what kind of token this is.
- `kid` is the **key ID**, which tells Facebook _which_ of the
  Authorization Server's keys signed this token.

:::pointingDuck

`"typ": "at+jwt"`. That one field is doing more work than it looks.

:::

A JWT is a general-purpose container. Plenty of different things are JWTs,
and some of them are not access tokens at all — you will meet one, the ID
Token, in Part 7. If a protected resource accepts any old JWT, an attacker
can hand it a JWT that was legitimately issued for a completely different
purpose and have it accepted as an access token.

`at+jwt` is the marker that says "this one is an OAuth **a**ccess
**t**oken." A protected resource is expected to check it and reject
anything else. It is a one-line check that closes off an entire family of
token confusion attacks.

### What Is Inside The Payload

Decoding the middle chunk gives the **claims** — the actual assertions the
Authorization Server is making:

```json
{
  "iss": "https://authorization-server:9001/",
  "sub": "hamza",
  "aud": "https://api.facebook.com",
  "client_id": "strava",
  "exp": 1774875600,
  "iat": 1774872000,
  "jti": "b7c1f0e2-9a3d-4e58",
  "scope": "post"
}
```

Compare that to the introspection response at the top of this post. It is
the same information. The only thing that changed is _where it lives_.

The shape of an access token JWT is not left to taste. It is pinned down by
[RFC 9068](https://www.rfc-editor.org/rfc/rfc9068), the JWT Profile for
OAuth 2.0 Access Tokens, which is the spec Part 3 pointed at:

| Claim       | What it says                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------- |
| `iss`       | Which Authorization Server issued this. Facebook only trusts issuers it knows.                                            |
| `exp`       | When it stops being valid.                                                                                                |
| `aud`       | Who the token is _for_. This is the [Audience](/posts/oauth-authorization-server#static-client-registration) from Part 4. |
| `sub`       | Who the token is _about_ — the user who consented.                                                                        |
| `client_id` | Which client is holding it. Strava.                                                                                       |
| `iat`       | When it was issued.                                                                                                       |
| `jti`       | A unique ID for this specific token.                                                                                      |

All seven of those are REQUIRED by the profile. `scope` is not among them —
the spec makes it a SHOULD, included when the original request carried a
`scope` parameter — but in practice it is nearly always there, carrying the
same space-separated permission list
[Part 3 built the whole scope discussion around](/posts/oauth-protected-resource#scope).

:::confusedDuck

You said `sub` is "the user who consented." What goes in there for the
[Client Credentials Grant](/posts/oauth-grant-types#client-credentials-grant)
from Part 5, where there is no user at all?

:::

:::me

The spec answers exactly that. Where a resource owner is involved, `sub`
should be the user's identifier. Where none is — Client Credentials being
the example it names — `sub` should be an identifier the Authorization
Server uses for the client application itself. The token always says who it
is about. For a machine-to-machine token, the answer is just "the machine."

:::

:::confusedDuck

Why does `aud` matter so much? Facebook knows the token was sent to
Facebook.

:::

:::me

Because without it, a token is valid _everywhere_. Say you also gave Strava
access to your calendar API using the same Authorization Server. Without
`aud`, Strava could take the token meant for the calendar and replay it
against Facebook, and Facebook would have no way to notice. The `aud` claim
is what makes a token addressed rather than universal. Facebook rejects any
token that is not addressed to Facebook.

:::

## Validating A JWT Without Calling Anyone

Facebook now has a token that claims a great deal about itself. The whole
scheme rests on Facebook being able to check that the Authorization Server
really said all of it.

:::equationme

`RS256` is asymmetric, and that asymmetry is the entire point. The
Authorization Server signs with a **private** key that it never shares.
Facebook verifies with the matching **public** key, which is safe to give
to anybody. Verifying proves the token came from the holder of the private
key, and — critically — being able to verify does _not_ give Facebook the
ability to sign. Facebook can check tokens all day and still cannot mint
one.

:::

Facebook fetches those public keys once from the Authorization Server's
**JWKS** (JSON Web Key Set) endpoint, a document defined by
[RFC 7517](https://www.rfc-editor.org/rfc/rfc7517) whose location comes
from the
[metadata document](/posts/oauth-authorization-server#authorization-server-metadata)
Part 4 covered, under `jwks_uri`. It holds an array under a `keys` member,
one entry per key, each labelled with a `kid`.

That is what the `kid` in the header is for. The Authorization Server
rotates its signing keys periodically, so at any moment the JWKS document
may hold several. `kid` tells Facebook which one to reach for instead of
trying each in turn.

:::pointingDuck

Note that this fetch happens _once_, not per request. That single
difference is the whole reason this post exists.

:::

With the key in hand, Facebook can validate. This part is not left to taste
either.

:::readingDuck

[RFC 9068 section 4](https://www.rfc-editor.org/rfc/rfc9068#section-4)
opens with "Resource servers receiving a JWT access token MUST validate it
in the following manner," and then lists exactly six checks.

:::

1. **`typ` is `at+jwt`.** Reject anything else. A conformant resource
   server accepts the long form `application/at+jwt` here too, so check for
   both.
2. **Decrypt it**, if encryption was agreed with the Authorization Server
   at registration time.
3. **`iss` exactly matches** an Authorization Server that Facebook trusts.
4. **`aud` contains an identifier Facebook expects for itself.** A token
   addressed elsewhere is refused right here.
5. **The signature verifies**, using the key the Authorization Server
   published and the algorithm named in `alg`.
6. **`exp` has not passed.** The spec permits "some small leeway, usually
   no more than a few minutes, to account for clock skew."

Every one of those is local. No network call, no Authorization Server in
the hot path, no shared database. Facebook can validate a token while the
Authorization Server is completely offline.

:::surprisedDuck

Oh — that is the same list of things introspection was answering. It just
moved from a question to a calculation.

:::

:::attackerDuck

Step five says use the algorithm named in `alg`. So I will set `alg` to
`none`, leave the signature off entirely, and let you check my token
against my own instructions. heheee!

:::

:::me

That is the most famous JWT attack there is, and it works against any
library naive enough to let the token dictate how the token gets checked.
The spec shuts the door in the same breath: "The resource server MUST
reject any JWT in which the value of `alg` is `none`."

:::

The broader lesson outlives that one algorithm. A protected resource should
decide in advance which algorithms it is willing to accept and refuse
everything else, rather than trusting an attacker-supplied header to pick.
RFC 9068 also requires that JWT access tokens be signed, recommends
asymmetric cryptography, and requires that `RS256` be among the supported
algorithms so that two conformant implementations always have at least one
in common.

:::note

Scope is deliberately absent from those six checks. Enforcing `scope` is a
separate decision the spec leaves as a SHOULD, because only Facebook knows
which operations need which permission. That is the same
`insufficient_scope` logic from
[Part 3](/posts/oauth-protected-resource#sending-the-access-token),
unchanged — validating the token and authorizing the operation remain two
different jobs.

:::

## What You Give Up

:::suspiciousDuck

If Facebook never asks the Authorization Server anything, how does it find
out when a token gets revoked? A user disconnecting Strava does not
magically change what is written inside a token Strava already has.

:::

:::me

It does not. You have found the trade, and it is exactly as bad as you
suspect: a revoked JWT keeps working until it expires.

:::

This is the one genuine loss, and it is worth being blunt about it.
Consider the revocation story from
[Part 4](/posts/oauth-authorization-server#issuing-refresh-tokens): the
user disconnects Strava from their Facebook account, and the Authorization
Server revokes the grant. With opaque tokens, the very next introspection
call returns `active: false` and Strava is locked out within milliseconds.

With a JWT, nothing happens. The token in Strava's hands still has a valid
signature and an `exp` in the future, so Facebook keeps accepting it. The
revocation only really lands when the token expires on its own.

That is the window RFC 7662 warned about when it described an over-eager
introspection cache — except a JWT is not a cache you tuned to a few
seconds by accident. The window is the token's entire lifetime, and you
chose it when you set `exp`.

:::armsCrossedDuck

Then this is just worse. You traded correctness for speed.

:::

:::me

You traded _freshness_ for speed, and how bad that is depends entirely on
the size of the window. That is why the window is the thing you control.

:::

The standard answers, roughly in order of how often they are reached for:

- **Keep `exp` short.** This is the main lever. An access token that lives
  five minutes means a revocation takes at most five minutes to bite. The
  [Refresh Token](/posts/oauth-authorization-server#issuing-refresh-tokens)
  is what makes this bearable — the client silently gets a new access token
  whenever the old one dies, and _that_ request does go to the
  Authorization Server, where the revocation is noticed immediately.
- **Introspect the operations that deserve it.** Nothing forces a single
  strategy. Validate the JWT locally for ordinary reads, and make the
  genuinely dangerous operations — deleting an account, moving money — pay
  for a live introspection call.
- **Keep a revocation list** of `jti` values that have been killed early,
  and check tokens against it. This works, and it also quietly reintroduces
  the shared state that JWTs were adopted to escape, so it tends to be
  reserved for emergencies rather than run as a default.

:::note

Notice that short lifetimes are load-bearing here, not a nice-to-have. A
JWT access token with a long `exp` is a token you have no practical way to
take back. If you take one idea from this section, it is that the `exp` you
choose _is_ your revocation delay.

:::

## Choosing Between Them

Neither format is the correct one. They fail in different directions:

|                                               | Opaque                          | JWT                            |
| --------------------------------------------- | ------------------------------- | ------------------------------ |
| Where the facts live                          | Authorization Server's database | Inside the token               |
| Cost per API request                          | A network call                  | Local computation              |
| Revoked instantly?                            | Yes                             | No — only when it expires      |
| Survives the Authorization Server being down? | No                              | Yes                            |
| Readable by whoever holds it                  | No                              | Yes, so keep secrets out of it |
| Size                                          | Tiny                            | Hundreds of bytes and up       |

:::thumbsUpDuck

Reach for JWTs when request volume is high and you can live with a
revocation delay measured in minutes. Reach for opaque tokens when
revocation has to be immediate, or when the token's contents are sensitive.

:::

The "readable by whoever holds it" row catches people out, so it is worth
saying plainly: **a JWT is signed, not encrypted.** Anyone who intercepts
one — or any client that holds one — can read every claim in it. Signing
guarantees nobody _changed_ the contents. It does nothing to hide them. An
email address, an internal user ID or a role name inside a JWT is
effectively public to everyone the token passes through.

:::coverEyesDuck

```json
{
  "sub": "hamza",
  "internal_user_id": 40219,
  "email": "hamza@example.com",
  "is_admin": false,
  "salary_band": "L5"
}
```

:::

Do not do that. `salary_band` is now visible to the client, to every proxy
on the path, and to anything that ever logs a request header.

There is a matching rule pointing the other way, and it catches people out
just as often: **the client is not supposed to read the access token
either.** RFC 9068 is blunt about it — "the client MUST NOT inspect the
content of the access token" — because the Authorization Server is free to
change the format whenever it likes, including switching back to opaque
tokens. A client that parses claims out of its own access token has built a
dependency it was never promised, and it breaks silently on the day the
format changes.

:::confusedDuck

Then how is a client ever supposed to find out who the user is? It is
holding a token full of information about them.

:::

:::me

Not through that token, and that restriction is the whole reason the next
post exists. Hold that thought.

:::

## Bearer Is Not The Only Option

Opaque versus JWT is a question about the token's _format_. There is a
second, completely independent question hiding underneath it, and Part 3
named it without dwelling on it:

> A bearer token means whoever holds (bears) this string is authorized to
> use it, and no additional proof is required.

:::attackerDuck

Whoever holds it, you say. So if I steal it, I hold it. heheee!

:::

That is the weakness in one sentence, and it applies to opaque tokens and
JWTs equally. A bearer token is a bus ticket. It does not care who is
holding it. Every protection this series has built — TLS everywhere, PKCE,
short expiries, the `state` parameter — exists partly to keep a bearer
token from being stolen, because once it is stolen there is nothing left to
stop it being used.

:::strongme

A **sender-constrained** token closes that. Instead of "whoever holds
this," the token means "whoever holds this _and_ can prove they own the
matching key." Stealing the token alone is no longer enough.

:::

There are two ways this is done in practice:

- **DPoP** ([RFC 9449](https://www.rfc-editor.org/rfc/rfc9449)),
  Demonstrating Proof of Possession. The client generates a key pair and
  sends the public key when it asks for a token. On every request
  afterwards it attaches a second, short-lived JWT in a `DPoP` header,
  signed with the private key, naming the HTTP method and URI it is meant
  for. Facebook checks that proof against the key the access token is bound
  to. A stolen token replayed without the private key has no valid proof to
  travel with.
- **Mutual TLS** ([RFC 8705](https://www.rfc-editor.org/rfc/rfc8705)),
  where the binding is to the client's TLS client certificate instead. It
  is heavier to operate, but the proof comes free with the connection —
  which is why it is common between banks and other places where the client
  is a server holding a real certificate.

Both record the binding the same way: a `cnf` — confirmation — claim inside
the token naming the key it is tied to. DPoP puts a `jkt` member in there,
a SHA-256 thumbprint of the client's public key. mTLS puts an `x5t#S256`
member, a SHA-256 thumbprint of the client's certificate. Either way, the
protected resource refuses the token unless the caller proves it holds the
matching key.

:::pointingDuck

A DPoP-bound token also comes back with `"token_type": "DPoP"` rather than
`"Bearer"`, and gets sent as `Authorization: DPoP <token>`. That is the
client's signal that the protection is really in place — if it asked for a
bound token and got `Bearer` back, it did not get one.

:::

:::confusedDuck

If this is strictly better, why is anything still a bearer token?

:::

:::me

Because it costs something. Every client now has to manage a key pair and
sign every single request, and every protected resource has to verify those
proofs. For a mobile app posting to Facebook, TLS plus a short expiry is
usually judged enough. For an API moving money, it is not. Bearer tokens
are not wrong, they are just an assumption — that the token will not be
stolen — and sender-constraining is what you do when you are not willing to
assume that.

:::

:::note

Sender-constraining is not a cure-all, and RFC 9449 is honest about its
limits. DPoP defeats an attacker who has only the token — lifted from a
log, a proxy, or a leaked backup. It does nothing against an attacker
running code _inside_ the client, because that code can simply ask the
client's own key to sign a fresh proof. The spec names that case and puts
it out of scope.

:::

## Conclusion

The Access Token has been a black box since Part 1, and it does not have to
be. An opaque token keeps every fact on the Authorization Server, which
buys instant revocation at the price of a network call on every request. A
JWT moves those same facts into the token behind a signature, which buys
local validation at the price of a revocation delay you control with `exp`.
Underneath that choice sits a second one: whether merely holding the token
is enough, or whether the caller also has to prove it owns a key.

None of this changes the flow. Every grant type from
[Part 5](/posts/oauth-grant-types) ends in an Access Token, and everything
in this post is about what that token is made of once it arrives.

There is one more thing an OAuth Access Token cannot tell you, no matter
which format you pick: **who the user actually is.** Look back at that JWT
payload — `sub` is an identifier, and that is all it is. There is no name,
no email, and no statement that the user was even present when the token
was issued.

:::wizardDuck

I have waved at that gap twice now. Part 7 unwraps it.

:::

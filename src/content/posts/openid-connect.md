---
title: "Part 7 - OpenID Connect"
published: 2026-09-13
draft: false
description:
  "Why an Access Token can never tell you who the user is, what the ID
  Token adds, and how nonce, aud and the UserInfo sub-check close the token
  substitution attack."
tags: ["OAuth", "Security", "Authentication"]
series: "OAuth Simplified"
---

## Introduction

Part 4 waved at this twice. Once when the
[metadata document](/posts/oauth-authorization-server#authorization-server-metadata)
turned out to have an OpenID Connect twin, and again when the user
authenticated to the Authorization Server and we noted that OAuth says
nothing about _how_ that happened or how the client would ever learn who
they were. [Part 6](/posts/oauth-token-types) ended on the same gap from
the other side: the client is not even allowed to read its own Access
Token, so it cannot go looking for the answer in there.

This post closes it, and it is the last one in the series.

Strava has a new requirement. Alongside posting to your Facebook feed, it
wants a **Log in with Facebook** button. Not "let me act on your behalf" —
that part is solved — but "tell me who you are so I can create your Strava
account."

:::confusedDuck

Surely that is the same thing? Strava already gets an Access Token that the
Authorization Server issued after I logged in. Does that not prove I logged
in?

:::

:::me

It does not, and this is the single most important idea in the post.
Everything else follows from it, so let's take it slowly.

:::

## Why An Access Token Is Not A Login

Here is the tempting shortcut. Strava finishes an ordinary Authorization
Code flow, gets an Access Token, calls some Facebook API that returns the
user's profile, and logs them in as whoever comes back.

:::coverEyesDuck

```javascript
// Do NOT do this.
const token = await exchangeCodeForAccessToken(code);
const profile = await fetch("https://api.facebook.com/me", {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

loginAs(profile.id); // ← Strava has just been had
```

:::

That code has a hole in it, and it is not a subtle one.

:::attackerDuck

I have my own Strava account, and I have my own Facebook account. So I
start a flow, get an Access Token issued for _me_, and then I take that
token and paste it into _your_ login attempt. heheee!

:::

:::me

And Strava calls the API with that token, gets the attacker's profile back,
and logs you in as the attacker — or, run the other way round, logs the
attacker in as you. Strava had no way to tell the tokens apart, because an
Access Token does not say who it was issued to.

:::

This is called a **token substitution** attack, and it is old enough to
have its own section in the original OAuth spec.
[RFC 6749 section 10.16](https://www.rfc-editor.org/rfc/rfc6749#section-10.16)
says it plainly:

> For public clients using implicit flows, this specification does not
> provide any method for the client to determine what client an access
> token was issued to.

and then, in the same section:

> Any public client that makes the assumption that only the resource owner
> can present it with a valid access token for the resource is vulnerable
> to this type of attack.

:::pointingDuck

Read that first quote once more. The problem is not that the token is
_forgeable_ — the attacker's token is completely genuine. The problem is
that it does not say **who it is for**.

:::

That is the whole gap. Everything this series built — scopes, PKCE,
introspection, `state` — was about controlling access to a resource. None
of it produces a statement, addressed to Strava, saying "this person
authenticated." An Access Token is a key to a room. It is not an ID card,
and it never was.

:::note

The slogan usually attached to this is "OAuth is not authentication." That
is a good summary, but it is not a quote from any specification — the specs
make the narrower and more useful point above. If you want the citation, it
is RFC 6749 §10.16, not a slogan.

:::

## One Word Turns It On

OpenID Connect is a layer on top of OAuth 2.0 that fills exactly this gap.
Its own abstract describes it as "a simple identity layer on top of the
OAuth 2.0 protocol," and it is a genuine layer — the flow you already know
does not change shape.

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
rejects the token otherwise, so the attacker's ID Token — issued with `aud`
set to the attacker's own client — cannot be pushed into your login. The
thing an Access Token could never say is the first thing an ID Token says.

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
for a reason that takes us straight back to the attack at the top of this
post.

:::suspiciousDuck

Wait. That call was authenticated with the **Access Token**. That is the
exact thing you told me could belong to an attacker.

:::

:::me

Yes. You have just re-derived the attack, and the spec has a hard rule for
precisely this.

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
injection**: an attacker who obtains a valid authorization code and injects
it into your session. A returned `state` proves the response belongs to a
flow you started. It says nothing about where the _code_ inside that
response came from. Because `nonce` travels back inside a token the OpenID
Provider signed, an injected code produces an ID Token whose `nonce` does
not match the one Strava stored — and the flow dies.

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
piece follows from those two properties. `aud` is what makes an attacker's
token useless in your login. `nonce` is what makes an injected code fail.
The `sub` check on the UserInfo response is what stops a swapped Access
Token from silently changing whose profile you read. Take away the
signature or the audience and all three protections collapse back into the
broken snippet at the top of this post.

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

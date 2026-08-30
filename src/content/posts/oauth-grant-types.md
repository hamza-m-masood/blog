---
title: "Part 5 - OAuth Grant Types"
published: 2026-08-30
draft: false
description:
  "Client Credentials for machine-to-machine calls, Device Authorization
  for screens without a keyboard, and why the Implicit and Password grants
  got retired."
tags: ["OAuth", "Security", "Authentication"]
series: "OAuth Simplified"
---

## Introduction

Every previous post in this series has walked through the same flow: you
open Strava, Strava sends you to Facebook's Authorization Server, you log
in and approve, and Strava gets back an
[Authorization Code](/posts/introduction-to-oauth#enhancing-security) it
can trade for an Access Token. That recipe has a name. It's called the
**Authorization Code Grant Type**, and in
[Part 4](/posts/oauth-authorization-server#client-registration) we saw that
"grant type" is literally a field the Authorization Server stores against
every registered client: the list of flows that client is allowed to use.

:::confusedDuck

Why would a client need more than one flow? Strava only ever needs to post
to Facebook on behalf of a user.

:::

:::me

That's true for Strava-the-phone-app talking to
Facebook-on-behalf-of-a-user. But not every request that needs an Access
Token looks like that. Sometimes there's no user sitting in a browser at
all. Sometimes there's a user, but no browser to redirect them through. The
Authorization Code Grant assumes both of those things are true, so when
they aren't, OAuth needs a different recipe.

:::

In this post we'll look at two flows that cover those gaps, and two more
that used to fill them badly enough that the spec is retiring them:

- **Client Credentials Grant** — no user at all. The client is acting on
  its own behalf.
- **Device Authorization Grant** — there's a user, but the device asking
  for access doesn't have a way to show them a login page.
- **Resource Owner Password Credentials Grant** — the flow that
  reintroduces the exact problem
  [Part 1](/posts/introduction-to-oauth#oauth-20-definition) was written to
  solve. Deprecated.
- **Implicit Grant** — the flow we quietly walked past in
  [Part 1](/posts/introduction-to-oauth#delegating-access) before hardening
  it into the Authorization Code Grant. Also deprecated.

## Client Credentials Grant

Strava's marketing team runs its own official Facebook Page, separate from
any individual user's account. Every morning, a backend job at Strava
publishes a scheduled post to that Page: "route of the day," a leaderboard
highlight, whatever the content calendar says.

:::confusedDuck

Isn't that the exact same thing we've been describing this whole series?
Strava posting to a Facebook account?

:::

:::me

Look closely at _whose_ account. Every flow so far delegated **your**
authorization for **your** account to Strava. Here there is no "you." The
Facebook Page belongs to Strava, the backend job is Strava, and it's asking
for access to a resource it already owns. There's no Resource Owner to
redirect anywhere, so there's nothing to delegate.

:::

When the resource owner and the client are the same party, the entire front
channel disappears. No redirect, no login screen, no consent screen, no
Authorization Code. The client just authenticates directly to the token
endpoint and asks for a token in one request:

```bash
POST /token HTTP/1.1
Host: auth.facebook.com
Authorization: Basic c3RyYXZhLW1hcmtldGluZzo4ZjNlMWMwMi1hOWI3
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=page_post
```

The Authorization Server checks the client credentials in the
`Authorization` header exactly like it checks them at the
[token endpoint](/posts/oauth-authorization-server#the-token-endpoint)
during an Authorization Code exchange, confirms `client_credentials` is a
grant type this client is registered for, and confirms `page_post` is
within the scopes it registered for. If all of that checks out, it hands
back a token straight away:

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

:::confusedDuck

No Refresh Token this time?

:::

:::me

Right, and that's not an oversight.
[RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749#section-4.4.3) is
explicit here: "A refresh token SHOULD NOT be included." A Refresh Token
exists to spare a **user** from being dragged through consent again. There
is no user here to spare, and the client's own credentials are sitting
right there the whole time. When the token expires, the client just sends
the exact same `client_credentials` request again.

:::

This is the grant type behind almost every server-to-server integration you
don't think of as "OAuth": a billing service pulling exchange rates from a
partner API, a CI pipeline pushing build artifacts to a registry, a
monitoring tool reading metrics out of a cloud provider. In every case the
"user" delegating access and the client asking for it are the same
organization, so the whole point of the front channel — proving a specific
human consented — doesn't apply.

## Device Authorization Grant

Now picture Strava running on a Garmin watch, or on the display inside a
gym's treadmill. You want that device to post your run to Facebook, same as
your phone does. This time there **is** a resource owner — you — but the
device has no browser to redirect you through, and typing a Facebook
password on a watch bezel isn't happening.

:::sweatingDuck

I am not logging into Facebook using five buttons and a 1.3 inch screen.

:::

:::me

Nobody expects you to! The Device Authorization Grant, defined in
[RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628), solves this by
moving the login step onto a device you actually want to type on, like your
phone.

:::

Here's how the watch gets your Facebook Access Token:

1. **The watch asks for a code, not a redirect.** It calls a new endpoint,
   conventionally `/device_authorization`, with just its `client_id` and
   the scope it wants. There's no `redirect_uri` because nothing is ever
   going to redirect on this device.

   ```bash
   POST /device_authorization HTTP/1.1
   Host: auth.facebook.com
   Content-Type: application/x-www-form-urlencoded

   client_id=strava-watch&scope=post
   ```

2. **The Authorization Server hands back two codes.** A `device_code` that
   only the watch will ever see, and a short `user_code` that's small
   enough for a human to type.

   ```bash
   HTTP/1.1 200 OK
   Content-Type: application/json

   {
     "device_code": "8V1pr0rJ-4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
     "user_code": "WDJB-MJHT",
     "verification_uri": "https://facebook.com/device",
     "verification_uri_complete": "https://facebook.com/device?user_code=WDJB-MJHT",
     "expires_in": 600,
     "interval": 5
   }
   ```

3. **The watch shows you the short version.** Its little screen displays
   just enough to act on:

   ```bash
   Go to facebook.com/device
   Enter code: WDJB-MJHT
   ```

4. **You finish the login on your phone.** You open that URL in a real
   browser, log into Facebook like normal, type in `WDJB-MJHT` (or skip
   typing it entirely if you tapped the QR code version of
   `verification_uri_complete`), and see the same consent screen from
   [Part 4](/posts/oauth-authorization-server#the-consent-screen) asking
   whether the watch can post on your behalf. You approve.
5. **The watch polls for you in the background.** While you were busy on
   your phone, the watch has been quietly asking `/token` every `interval`
   seconds (5, in our example) whether you're done yet:

   ```bash
   POST /token HTTP/1.1
   Host: auth.facebook.com
   Content-Type: application/x-www-form-urlencoded

   grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=8V1pr0rJ-4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk&client_id=strava-watch
   ```

   Before you've approved anything, every one of those polls comes back the
   same way:

   ```bash
   HTTP/1.1 400 Bad Request
   Content-Type: application/json

   {
     "error": "authorization_pending"
   }
   ```

6. **The moment you approve, the next poll gets a real token.** Same
   `access_token` / `refresh_token` shape we've seen since Part 4, no
   different from what your phone would have received.

Polling is new to this flow, so the
[token endpoint](/posts/oauth-authorization-server#errors-from-the-token-endpoint)
grows a few error codes on top of the ones Part 4 already covered:

| Error                   | Meaning                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------ |
| `authorization_pending` | You haven't finished approving on your phone yet. Keep polling.                      |
| `slow_down`             | The watch is polling faster than the `interval` allowed. Back off and add 5 seconds. |
| `access_denied`         | You looked at the consent screen and said no.                                        |
| `expired_token`         | The `device_code` outlived its `expires_in` window before you approved anything.     |

:::confusedDuck

That `user_code` is only eight characters. Couldn't someone just guess
codes until they hit one that works?

:::

:::me

That is why
[RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628#section-5.1) puts
two demands on that short code. It needs enough entropy that guessing is
impractical, and the Authorization Server has to rate-limit how many codes
someone can try at the verification page. The spec even works the example:
eight characters drawn from a twenty-character alphabet gives you about 34
bits, which only holds up if the server cuts you off after a handful of
wrong attempts.

:::

:::note

This is a different rate limit from the `interval` the watch polls on. The
`interval` keeps a single device from hammering `/token`. This one keeps a
human — or a script — from hammering the verification page with guessed
codes. Two separate limits, two separate attacks.

:::

:::attackerDuck

Forget guessing! I'll start the flow on _my_ device, then email you _my_
code and ask you nicely to type it in. heheee!

:::

:::me

That one is real, and it has been used against actual users. It's called
device code phishing, and it works because nothing in the flow so far
proves that the code on your screen came from a device you are actually
holding. If you enter the attacker's code, it's the attacker's device that
walks away with a token for your account.

:::

[Section 5.4](https://datatracker.ietf.org/doc/html/rfc8628#section-5.4) of
the spec is written for exactly this attack. It tells the Authorization
Server to confirm the device is genuinely in the user's possession, which
in practice means showing the code on the consent page and asking the user
to check that it matches what the watch is displaying. It is the one place
in this flow where the security depends on the user actually reading the
screen.

## Grant Types We Leave Behind

Not every flow OAuth ever defined earned its keep. The two below were aimed
at real problems — a client with no browser to redirect the user through,
and a browser-based app with nowhere safe to keep a `client_secret` — but
they answered those problems in ways that current guidance, and the
upcoming OAuth 2.1 spec, drop entirely. Both should look familiar, because
we already met them earlier in this series, before we knew their names.

### Resource Owner Password Credentials

Remember the very first "solution" from
[Part 1](/posts/introduction-to-oauth#client-authorization)? Strava asks
you for your actual Facebook username and password, and uses them directly.

That is, word for word, the **Resource Owner Password Credentials Grant**
(RFC 6749,
[section 4.3](https://datatracker.ietf.org/doc/html/rfc6749#section-4.3)).
The only difference from Part 1's example is that OAuth gave it a shape:

```bash
POST /token HTTP/1.1
Host: auth.facebook.com
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=hamza&password=hunter2&client_id=strava
```

We spent all of Part 1 explaining why this is a bad idea, so the list
should sound familiar:

- Facebook has no way to tell you apart from Strava. Both of you are
  presenting the exact same password.
- Strava has to see and, in practice, store your real password to be able
  to send it.
- Nothing about this survives you having two-factor authentication turned
  on, since there's no login page for Facebook to challenge on.
- There's no independent way to revoke just Strava's access. Revoking means
  changing your Facebook password, which logs out every other client too.

The only reason this grant type existed at all was to give a company's own
first-party client — its own app talking to its own backend — a lightweight
way to get a token during a migration off an older, non-OAuth login system.
Even in that narrow case it's discouraged today. OAuth 2.1 removes it
outright.

### Implicit Grant

Now go back to the animation in
[Part 1](/posts/introduction-to-oauth#delegating-access), the one before
the "Enhancing Security" section introduced the Authorization Code. In that
version, the Authorization Server redirected the user straight back to
Strava with the **Access Token itself** sitting in the URL:

```bash
HTTP/1.1 302 Found
Location: https://strava.com/callback#access_token=8kNq2vXpL4mZ7wRt1yHb3cJd6fGs0aVe&token_type=Bearer&expires_in=3600
```

That's the **Implicit Grant** (RFC 6749,
[section 4.2](https://datatracker.ietf.org/doc/html/rfc6749#section-4.2)).
It looks convenient: one redirect, no back-channel round trip needed to
swap a code for a token. Part 1 already showed you exactly why that
convenience wasn't worth it:

- The Access Token travels on the
  [front channel](/posts/oauth-client#back-channel-vs-front-channel), so it
  lands in browser history and is readable by every piece of JavaScript
  running on that callback page — including any third-party analytics
  script or browser extension the user happens to have installed.
- There's no `client_secret` and no `code_verifier` anywhere in the
  exchange, so nothing proves that token was issued to Strava for this
  particular flow. An attacker holding a token obtained somewhere else can
  inject it into the redirect, and Strava has no way to tell the
  difference.
- [RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749#section-4.2.2)
  forbids a Refresh Token here outright: "The authorization server MUST NOT
  issue a refresh token." So the session simply dies when the Access Token
  expires, and the user gets dragged through login again.

:::note

Notice the `#` in that redirect. The token sits in the URL _fragment_, and
browsers never send fragments to a server, so it does at least stay out of
Strava's own access logs. That is the one thing the Implicit Grant got
right, and it is nowhere near enough — everything on the browser side of
that line still sees the token in full.

:::

The fix for all three problems is the one this series has already spent two
posts on: keep the front channel for an opaque, single-use Authorization
Code, and move the actual Access Token to a back-channel `/token` call,
hardened further with [PKCE](/posts/oauth-authorization-server#pkce) for
clients that have no `client_secret` to authenticate with. OAuth 2.1
removes the Implicit Grant for the same reason it removes the Password
Grant: there's a strictly better flow already covered in this series that
does its job.

## Choosing A Grant Type

Pulling all five together, the decision mostly comes down to two questions:
is there a specific person delegating access, and does the device that
person is holding have a browser?

| Grant Type                  | User involved?          | Needs a browser on that device? | Refresh Token?  | Status      |
| --------------------------- | ----------------------- | ------------------------------- | --------------- | ----------- |
| Authorization Code (+ PKCE) | Yes                     | Yes                             | Yes             | Recommended |
| Client Credentials          | No                      | N/A                             | No (re-request) | Recommended |
| Device Authorization        | Yes, on a second device | No                              | Yes             | Recommended |
| Resource Owner Password     | Yes                     | No                              | Yes             | Deprecated  |
| Implicit                    | Yes                     | Yes                             | No              | Deprecated  |

This is also exactly what that `grant_types` array from
[client registration](/posts/oauth-authorization-server#static-client-registration)
in Part 4 is for. `strava-mobile` gets registered with
`"grant_types": ["authorization_code", "refresh_token"]`, while
`strava-marketing-bot` gets registered with
`"grant_types": ["client_credentials"]`, and `strava-watch` gets
`"grant_types": ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"]`.
The Authorization Server won't hand out a token through a flow the client
wasn't registered for, no matter how correctly formed the request is.

:::confusedDuck

Two of those arrays list `refresh_token` next to the actual flow. Is
redeeming a Refresh Token a grant type as well?

:::

:::me

It is. `grant_type=refresh_token` is the exact request
[Part 4 walked through](/posts/oauth-authorization-server#issuing-refresh-tokens)
when the Access Token expired. It didn't earn its own section here because
it can never start a flow on its own — it only continues one that another
grant type already began. Notice that `strava-marketing-bot` doesn't list
it, because it has no user consent to continue and can ask for a fresh
token whenever it likes.

:::

:::note

The device flow's long `urn:ietf:params:oauth:grant-type:device_code` value
looks out of place next to plain words like `password` and
`client_credentials`. That's because the grant types defined in RFC 6749
itself got to claim short names, while anything added later — the device
flow included — is an _extension grant_ and has to namespace itself with a
URN to avoid collisions. The shape of the value tells you which spec it
came from.

:::

## Conclusion

"OAuth flow" was never one flow. It's a family of them, each one shaped
around who's asking and what they have access to at the moment they ask.
The Authorization Code Grant this series has focused on assumes a person
with a browser, present right now, willing to click approve. Client
Credentials drops the person entirely, for the cases where the client is
acting as itself. Device Authorization keeps the person but moves their
half of the conversation onto a second screen, for the cases where the
client's own screen can't be trusted with a password. The Password Grant
and the Implicit Grant went after real problems too — a client with no
browser, and a browser app with nowhere to keep a secret — but each one
recreated the exact risks the rest of this series has spent four posts
closing off. That is why both are being retired, and why the three above
are what you reach for instead.

Whichever grant type a client uses, it lands in the exact same place every
other post in this series has led to: an Access Token, checked by a
protected resource, scoped to only what the user — or in Client
Credentials' case, no user at all — actually approved.

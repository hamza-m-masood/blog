---
title: "Part 5 - OAuth Grant Types"
published: 2026-09-15
draft: false
description:
  "Client Credentials for machine-to-machine calls, Device Authorization
  for screens without a keyboard, and why the Implicit grant got retired."
tags: ["OAuth", "Security", "Authentication"]
series: "OAuth Simplified"
---

## Introduction

Ever since the start of this blog series, we have used a single example and
looked at it from different perspectives:

- **Resource Owner**: you 🫵, the owner of the Facebook account.
- **Client**: Strava, the running app that wants to post your workout to
  Facebook on your behalf.
- **Protected Resource**: Facebook, the API that holds your account.
- **Authorization Server**: the component this post is about. It is the one
  that registers Strava, authenticates you, asks whether you are happy for
  Strava to post on your behalf, and hands Strava the tokens that Facebook
  will accept.

The OAuth flow would remain mostly the same: You open Strava, Strava sends
you to Facebook's Authorization Server, you log in and approve, and Strava
gets back an
[Authorization Code](/posts/introduction-to-oauth#enhancing-security) it
can trade for an Access Token. Then Strava can use that Access Token to
make a post on your Facebook account.

This type of flow has a name. It is called the **Authorization Code Grant
Type**. We have reused this flow in all posts and looked at it from
different angles. We have looked at this flow from
[the client's perspective](/posts/oauth-client), from
[the Protected Resource's perspective](/posts/oauth-protected-resource),
and
[the Authorization Server's perspective](/posts/oauth-authorization-server).

In this post we'll look at three grant types:

- **Client Credentials Grant** — no user at all. The client is acting on
  its own behalf.
- **Device Authorization Grant** — there's a user, but the device asking
  for access doesn't have a way to show them a login page.
- **Implicit Grant** — the flow we quietly walked past in
  [Part 1](/posts/introduction-to-oauth#delegating-access) before hardening
  it into the Authorization Code Grant. Also deprecated.

:::confusedDuck

That's great, but what is a grant type?

:::

:::thinkMe

Let me explain.

:::

## OAuth Grant Type

A grant type simply refers to a specific type of OAuth flow. For example,
what happens if the user and browser are not involved in the OAuth flow and
only the client and Authorization Server are involved? In that case, this
grant type would be known as the **Client Credentials Grant Type**. It is
simply a different flow of events under the OAuth umbrella.

By now, you should have a good understanding of the Authorization Code
grant type.

In [Part 4](/posts/oauth-authorization-server#client-registration) we saw
that "grant type" is literally a field the Authorization Server stores
against every registered client. This is because the Authorization Server
needs to know what grant types a client can support. For example, can a
client operate without a user and browser present, or must they always be
present? This creates the ceiling of capabilities for the client.

:::confusedDuck

Why would a client need more than one flow? Strava only ever needs to post
to Facebook on behalf of a user.

:::

:::me

That's true for the use cases you have mentioned, but let's think about
other use cases where the user is not relevant anymore.

:::

## Client Credentials Grant

Strava's marketing team runs its own official Facebook Page, separate from
any individual user's account. Every morning, a backend job at Strava
publishes a scheduled post to that Page: "route of the day," which is a
leaderboard highlight.

:::confusedDuck

Isn't that the exact same thing we've been describing this whole series?
Strava posting to a Facebook account? The Authorization Code Grant Type
suits perfectly here.

:::

:::susMe

Are you sure about that? Look closer! Whose account are we connecting to?
Every flow so far delegated **your** authorization for **your** account to
Strava. Here there is no "you." The Facebook Page belongs to Strava.

:::

The client is Strava, and it's asking for access to a resource it already
owns. You don't own Strava's Facebook account. Strava (the client) does!

Broadly speaking, if the client already owns or has the necessary
authorization to access the private resource, then the user becomes
irrelevant.

There is no need to support the front channel anymore, since front-channel
calls go through the browser, and there is no user here, so there is no
browser. When the resource owner and the client are the same party, the
entire front channel disappears. No redirect, no login screen, no consent
screen, and no Authorization Code. The flow becomes very simple.

This means that the client just authenticates directly to the token
endpoint and asks for a token in one request. This is how the OAuth flow is
started:

```bash
POST /token HTTP/1.1
Host: https://auth-server.com
Authorization: Basic c3RyYXZhLW1hcmtldGluZzo4ZjNlMWMwMi1hOWI3
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=page_post
```

The Authorization Server checks the client credentials in the
`Authorization` header exactly like it checks them at the
[token endpoint](/posts/oauth-authorization-server#the-token-endpoint)
during an Authorization Code exchange.

The Authorization Server confirms `client_credentials` is a grant type this
client is registered for, and also confirms `page_post` is within the
scopes that the client was registered for.

If all the above checks out, the Authorization Server hands back an Access
Token straight away, which ends the OAuth flow:

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

:::suspiciousDuck

That's it?? The entire Client Credentials Grant Type is made up of two HTTP
requests?

:::

:::dabMe

Yeah! Turns out when you take the human out of the flow, things become very
simple.

:::

Finally, note that there is no Refresh Token.
[RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749#section-4.4.3)
states: "A refresh token SHOULD NOT be included." A Refresh Token exists to
spare a **user** from being dragged through consent again. There is no user
here, so there is no need for a Refresh Token. The only credentials that
are required are the client ID and client secret, which are readily
available to the client. When the token expires, the client just sends the
exact same `client_credentials` request again.

:::note

The Client Credentials Grant Type is the grant type behind almost every
server-to-server integration. The Access Token from this grant type can
also sometimes be referred to as a machine-to-machine token (M2M token).

:::

## Device Authorization Grant

Now picture Strava running on a Garmin watch, or on the display inside a
gym's treadmill. You want that device to post your run to Facebook, same as
your phone does. This time there **is** a resource owner — you — but your
Garmin watch does not have a browser to redirect you to the Authorization
Server and neither does the treadmill in your gym.

:::sweatingDuck

What am I going to do!! I want Strava to work on my Garmin watch.

:::

:::strongme

Never fear! OAuth has an answer.

:::

The Device Authorization Grant, defined in
[RFC 8628](https://datatracker.ietf.org/doc/html/rfc8628), solves this by
moving the login step onto a different device you can actually be
redirected on, like your phone. This means you can delegate your
authorization to Strava (on the Garmin watch) through your phone, so the
OAuth flow can continue.

In other words, this grant type allows you to give consent on a different
device from the one you started the OAuth flow with.

Here's how the watch gets your Facebook Access Token:

1. **The Garmin watch directly asks the Authorization Server for a device
   code, instead of redirecting the user.** It calls a new
   endpoint, conventionally `/device_authorization`, with just its
   `client_id` and the scope it wants. There's no `redirect_uri` because
   nothing is ever going to redirect on this device.

   ```bash
   POST /device_authorization HTTP/1.1
   Host: https://auth-server.com
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

3. If the response is successful, then here is what is displayed on the
   screen of the Garmin watch:

   ```
   Go to facebook.com/device
   Enter code: WDJB-MJHT
   ```

4. You open that URL in a browser on your phone. You log into Facebook like
   normal, type in `WDJB-MJHT`, and see the same consent screen from
   [Part 4](/posts/oauth-authorization-server#the-consent-screen) asking
   whether the watch can post on your behalf. You approve.
5. **The watch polls for you in the background.** While you were busy on
   your phone, the watch has been intermittently polling `/token` on the
   Authorization Server every `interval` seconds (5, in our example) to
   check whether you're done yet. Here is what the polling request from the
   Garmin watch looks like:

   ```bash
   POST /token HTTP/1.1
   Host: https://auth-server.com
   Content-Type: application/x-www-form-urlencoded

   grant_type=urn:ietf:params:oauth:grant-type:device_code&device_code=8V1pr0rJ-4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk&client_id=strava-watch
   ```

   If you are still in the process of approving on your phone, then this is
   the response that your Garmin watch will get back from the poll:

   ```bash
   HTTP/1.1 400 Bad Request
   Content-Type: application/json

   {
     "error": "authorization_pending"
   }
   ```

6. The moment you approve, the next poll gets an Access Token. Same
   `access_token` / `refresh_token` shape we've seen since Part 4, no
   different from what your phone would have received.

:::note

This is a different rate limit from the `interval` the watch polls on. The
`interval` keeps a single device from hammering `/token`. This one keeps a
human — or a script — from hammering the verification page with guessed
codes. Two separate limits, two separate attacks.

:::

:::attackerDuck

I'll start the flow on _my_ device, then email you _my_ code and ask you
nicely to type it in. heheee!

:::

:::me

This is known as device code phishing. It can work well because nothing in
the flow so far proves that the code on the Garmin watch came from a device
you are actually holding. Meaning, the Authorization Server does not know
if the Garmin watch is actually yours.

:::

[Section 5.4](https://datatracker.ietf.org/doc/html/rfc8628#section-5.4) of
the spec is written for exactly this attack. It tells the Authorization
Server to confirm the device is genuinely in the user's possession, which
in practice means showing the code on the consent page and asking the user
to check that it matches what the watch is displaying. It is the one place
in this flow where the security depends on the user actually reading the
screen.

## Choosing a Grant Type

Pulling these three together, the decision mostly comes down to two questions:
is there a specific person delegating access, and does the device that
person is holding have a browser?

| Grant Type                  | User involved?          | Needs a browser on that device? | Refresh Token?  |
| --------------------------- | ----------------------- | ------------------------------- | --------------- |
| Authorization Code (+ PKCE) | Yes                     | Yes                             | Yes             |
| Client Credentials          | No                      | N/A                             | No (re-request) |
| Device Authorization        | Yes, on a second device | No                              | Yes             |

This is exactly what that `grant_types` array from
[client registration](/posts/oauth-authorization-server#static-client-registration)
in Part 4 is for. `strava-mobile` gets registered with
`"grant_types": ["authorization_code", "refresh_token"]`. The Authorization
Server won't hand out a token through a flow the client wasn't registered
for.

## Conclusion

OAuth was designed to be extremely flexible. It accounts for users not
being present, devices not supporting redirects on the browser, etc. There
are still many flows that we did not cover, and new ones are being created
even today. The three flows we discussed today are the most important, in
my opinion.

Whichever grant type a client uses, it lands in the exact same place every
other post in this series has led to: an Access Token, checked by a
protected resource, scoped to only what the user approved.

:::me

Hope you enjoyed the blog!

:::

:::wavingDuck

Byeee!

:::

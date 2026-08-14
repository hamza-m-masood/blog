---
title: "Part 4 - The OAuth Authorization Server"
published: 2026-06-09
draft: false
description: "Learning about the OAuth Authorization Server"
tags: ["OAuth"]
series: "OAuth Simplified"
---

## What is an Authorization Server?

The Authorization Server is the final component in the OAuth dance. It is
the most critical and the most complex. It's the trusted middle-man making
sure users can share their details without exposing their password to the
client or the protected resource. As much complexity as possible is moved
to the Authorization Server so clients and protected resources can be as
simple as possible.

The Authorization Server is responsible for the following:

- Authenticating both the user and the client (discussed in an upcoming
  blog)
- Authorizing clients and making sure the correct permissions are delegated
  from the user to the client
- Dispensing Authorization Codes and Access Tokens to clients
- Introspecting Access Tokens for the protected resources it is responsible
  for

## Client Registration

### Static Client Registration

So far, in previous blog posts, we have been statically registering the
OAuth clients in the Authorization Server before the OAuth flow starts.
This results in the Authorization Server having a list of pre-approved
clients that can authenticate and have user authorizations delegated to
them.

This setup does not work in every case. It works well in our
Strava/Facebook example that we have been carrying through our posts. This
is because, a typical user has one Strava app and one Facebook account.

What about email? An organization might host multiple email servers for
their employees: Thunderbird, Apple Mail, Gmail, Outlook etc.

You can't expect the IT department to pre-register every possible email
client every employee might want to use. This is not scalable.

:::confusedDuck

What if an email client were to use the same client ID for all the
different Authorization Servers?

:::

:::me

This could potentially work for public clients but not for private clients,
since each private client instance requires a client secret.

:::

### Dynamic Client Registration

The solution to the above scalability problem is Dynamic Client
Registration: A way for clients to dynamically register themselves on an
Authorization Server that accepts this protocol. Typically, this is done by
the authorization server exposing an endpont called`/register`. When the
client sends a request to this endpoint, the authorization server would
send back a client ID and client secret. Which the client can then use to
further communicate with the authorization server.

## The Authorization Endpoint

The authorization endpoint is exposed by the Authorization Server to accept
redirected users from the Client. Typically the endpoint is named
`/authorize`. The redirect flow was discussed in the
[OAuth Client deep-dive blog](/posts/oauth-client#url-redirect-for-user)

## The Consent Screen

Once the user is redirected to the Authorization Server. The user is then
presented with options

![Strava Consent](../images/strava-consent.png)

## The Token Endpoint

## Client Authentication

## Conclusion

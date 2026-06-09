---
title: "Part 3 - The OAuth Protected Resource"
published: 2026-03-30
draft: false
description: "Learning about the OAuth protected resource"
tags: ["OAuth"]
series: "OAuth Simplified"
---

## What is a Protected Resource

A protected resource is the API that the OAuth client wishes to access. It
is the API that the client is interested in accessing.

In previous blog posts, we used Facebook as an example protected resource to
walk through the authorization code grant type. We will continue to do the
same in this blog post as well!

## Scope

:::confusedDuck

How does the protected resource know to only allow the client application
to make Facebook posts, and not any other action such as add friends or
read private messages?

:::

:::me

This is where the concept of scope comes into play! Let's discuss why it
is important to include a scope in the Access Token when a request is
received by a protected resource.

:::

A scope limits the level of access a client can be given to a protected
resource. Let's recap the example that we have been using since the start
of our series:

- User: you 🫵
- Client: Strava
- Protected Resource: Facebook

When Strava accesses your Facebook account, the only action that Strava
should be allowed to do is to make a Facebook post on your behalf. Facebook
would parse the received Access Token and look for the scope field. Strava
will only receive the privileges listed in the scope field. For the sake of
our example, the scope field would only have the "post" value, so Strava
has just enough privileges to make a Facebook post on your behalf:

```yaml
scope: "post"
```

A client can have one or more scopes assigned to it. Let's say we also want
to give Strava the permission to send a personal message on your behalf. So
we would add "personal-message" scope as well:

```yaml
scope: "post personal-message"
```

Notice how the scopes are space-separated. This makes the scopes URL
parameter friendly and Authorization Server agnostic.

## Scope and The Authorization Server

When the client initially redirects the user to the Authorization Server,
the client has a choice to also send a scope field with space-separated
values.

:::confusedDuck

What is the point of the client sending the list of scopes to the
Authorization Server when the scopes only matter for the Protected
Resource?

:::

When the user is redirected to the Authorization Server, the user can see
what scopes the client is requesting. The user then has a choice to do the
following in the Authorization Server:

- Reject the authorization request from the client.
- Remove certain scopes from the client and approve the authorization
  request.
- Add more scopes for the client and approve the authorization request.

This is why it is important for the scope to first be validated by the user
in the Authorization Server, before the client can reach the protected
resource.

:::attackerDuck

What if the client modifies the Access Token and adds extra scopes before
it is received by the protected resource? Wouldn't that lead to the client
gaining elevated permissions?

:::

:::strongme

Not so fast! OAuth 2.0 has an answer for these kinds of attacks. It's
possible for the protected resource to validate the Access Token before it
is used. In OAuth terms, it's known as Token Introspection. Before we dive
into the inner workings of Token Introspection, we must first learn how a
token can be parsed by the protected resource.

:::

## Parsing The Token

The first step is for the protected resource to parse the Access Token. The
Access Token can be sent to the protected resource as a bearer token.
According to the
[OAuth bearer token usage specification](https://tools.ietf.org/html/rfc6750),
the bearer token can be passed to the protected resource in 3 different
ways:

- The HTTP Authorization header
- Inside a form-encoded POST body
- A query parameter

The best method is to pass the token through the HTTP Authorization header
because it has the least chance of being logged or leaked.

:::me

In a future blog post we will discuss what exactly a bearer token is along
with other token types in the OAuth flow!

:::

## Validating The Access Token - Token Introspection

The introspection request (defined in
[RFC 7662](https://datatracker.ietf.org/doc/html/rfc7662)) is a
form-encoded HTTP request to the Authorization Server’s introspection
endpoint, which allows the protected resource to ask the Authorization Server:
“Someone gave me this token; what is it good for?” This means the
protected resource doesn't have to trust the token at face value. Normally
the protected resource would send a query to the endpoint path
`/introspect` to check the validity of the token received by the client.

This solves our problem of the client artificially elevating its
permissions by manually editing the scope field. The protected resource
would check on each request whether the token is valid.

### Token Expiration/Revocation

Since the protected resource now validates the token on each request, it
can also check if a token has been rejected by the Authorization Server or
the TTL (time to live) of the token has been reached and is now expired. If
the protected resource finds out from the Authorization Server that the
token is either rejected or expired, then it will not accept that token.

:::me

In a future blog post we will discuss an alternative to token
introspection, known as the
[JWT Profile for OAuth 2.0 Access Tokens](https://datatracker.ietf.org/doc/html/rfc9068)

:::

## The Introspection Endpoint

As stated, the Authorization Server would normally accept introspection
requests on the path `/introspect`.

Here is what a query from the protected resource would look like once it
receives a token from the client:

```bash
POST /introspect HTTP/1.1
Host: authorization-server:9001
Accept: application/json
Content-type: application/x-www-form-urlencoded
Authorization: Basic
cHJvdGVjdGVkLXJlc291cmNlLTE6cHJvdGVjdGVkLXJlc291cmNlLXNlY3JldC0x
token=987tghjkiu6trfghjuytrghj
```

The response from the Authorization Server will normally be a JSON document
that describes the token, similar to the contents of a JWT.

```json
{
  "active": true,
  "scope": "post",
  "client_id": "strava",
  "username": "Hamza",
  "iss": "http://authorization-server:9001/",
  "sub": "hamza",
  "aud": "http://facebook.com",
  "iat": 1775865600,
  "exp": 1783641600
}
```

According to our example, the scope is correct. Strava will only get
permissions to post on behalf of the user Hamza. And from the time of
writing this blog post, the token is also not expired.

:::me

Quick tip! If you want to parse the timestamps listed above, then you can
do so on a bash commandline as follows:

```bash
date -r 1783641600
# Fri 10 Jul 2026 01:00:00 IST
```

:::

## TLS Requirement

In a production system, proper TLS usage is a hard-and-fast requirement.
TLS makes sure that a middle-man can't tamper with the communication
between two systems. TLS protects all three communication paths on OAuth:

- Client → Authorization Server (where the Access Token is issued)
- Client → Protected Resource (where the token is used)
- Protected Resource → Authorization Server (the introspection call)

For example, when a client communicates with the protected resource,
without TLS, the Access Token lives in the HTTP header unencrypted. Anyone
on the same network can grab the Access Token using a basic packet sniffer.

## Conclusion

The job of the Protected Resource is to validate the token, enforce the
scope and trust nothing! This ends our deep-dive into the Protected
Resource.

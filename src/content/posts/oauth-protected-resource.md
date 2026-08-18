---
title: "Part 3 - The OAuth Protected Resource"
published: 2026-03-30
draft: false
description: "Learning about the OAuth protected resource"
tags: ["OAuth"]
series: "OAuth Simplified"
---

## What is a Protected Resource

A protected resource is the API that the OAuth client wishes to access. The
protected resource does not need to have a UI since it will never interact
with the user directly. Only the client will send API requests to the
protected resource.

In previous blog posts, we used Facebook as an example protected resource
to walk through the authorization code grant type. We will continue to do
the same in this blog post as well!

## Scope

:::confusedDuck

How does the protected resource know the client application is only allowed
to make Facebook posts, and not any other action such as add friends or
read private messages?

:::

:::me

This is where the concept of scope comes into play! Let's discuss why it is
important to include a scope in the Access Token when a request is received
by a protected resource.

:::

A scope limits the level of access a client can be given to a protected
resource. Let's recap the example that we have been using since the start
of our series:

- User: you 🫵
- Client: Strava (your running app that wants access to your Facebook
  account.)
- Protected Resource: Facebook

When Strava accesses your Facebook account, the only action that Strava
should be allowed to do is to make a Facebook post on your behalf. As
discussed in previous blog posts, Facebook would receive an Access Token
from Strava.

The Access Token is usually an opaque string. It is a random handle with
nothing inside it for Facebook to read. The `scope` belonging to that
Access Token is held by the Authorization Server, which records it the
moment you approve the request from Strava. Facebook does not read the
scope out of the token. It looks the token up on the Authorization Server
and gets the scope back.

Whatever comes back to the protected resource from the Authorization Server
is a whitelist of allowed actions a client can take on a protected
resource. Strava will only receive the privileges listed in the `scope`
field. We will discuss more on how the protected resource can validate the
Access Token further down in this blog.

For the sake of our example, the `scope` that the Authorization Server has
on record for this token would only have the "post" value, so Strava has
just enough privileges to make a Facebook post on your behalf:

```yaml
scope: "post"
```

The `scope` field can have pretty much any string value. We need to make
sure that our protected resource (Facebook) recognizes this value and knows
what to do with it.

A client can have one or more scopes assigned to it. Let's say we also want
to give Strava the permission to send a personal message on your behalf. So
we would add "personal-message" scope as well:

```yaml
scope: "post personal-message"
```

Now Strava has access to send a post on your feed, and also send a
private-message to one of your Facebook friends.

:::sweatingDuck

Don't blame the OAuth client if your ex-wife gets Strava running updates.
You already delegated the authorizations!

:::

Notice how the scope values are space-separated. This makes the scope
values URL parameter friendly and Authorization Server agnostic.

## Scope and The Authorization Server

Now that we know what the `scope` parameter is in an OAuth context, let's
see how it fits in the overall OAuth flow.

When the client initially redirects the user to the Authorization Server,
the client has a choice to also send a scope field with space-separated
values. This will inform you (the user), if you would like to delegate the
scope of authorizations that the client is requesting. In this case, the
client will only request to send a Facebook post on your behalf according
to it's scope.

Here is a list of parameters that can by added to the redirect URL from the
client to the Authorization Server, which includes the scope:

```bash
response_type: code
client_id: strava
redirect_uri: https://strava.com/callback
scope: post
```

Here is what these parameters would look like in an HTTP redirect request
to the Authorization Server:

```bash
HTTP/1.1 302 Found
Location: https://auth-server/authorize?response_type=code&scope=post&client_id=strava&redirect_uri=https%3A%2F%2Fstrava.com%2Fcallback
Content-Type: text/html
```

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

Not so fast! Remember that the token is an opaque string. There is no scope
field inside it to edit.

:::

It's not possible for the client to edit the token. It would be useless.
Even if a single character is changed in the Access Token, the
Authorization server would recognize it. The lookup would fail and Facebook
would reject the request from the client. The scope you approved never
traveled inside the token. It stayed with the Authorization Server the
whole time.

That lookup is what OAuth calls
[Token Introspection](https://datatracker.ietf.org/doc/html/rfc7662).
Before we dive into the inner workings of Token Introspection, we must
first learn how a token is sent to the protected resource.

## Sending The Token

Once Strava has an Access Token, it needs to attach it to every request it
makes to Facebook. According to the
[OAuth bearer token usage specification](https://tools.ietf.org/html/rfc6750),
there are 3 ways to do this. Let's say Strava received the Access Token
`987tghjkiu6trfghjuytrghj` and now wants to create a post on your feed via
`POST /me/feed`.

A Form-Encoded POST Body:

```bash
POST /me/feed
Host: facebook.com
Content-Type: application/x-www-form-urlencoded

access_token=987tghjkiu6trfghjuytrghj
```

A Query Parameter:

```bash
POST /me/feed?access_token=987tghjkiu6trfghjuytrghj
Host: facebook.com
```

The HTTP Authorization Header:

```bash
POST /me/feed
Host: facebook.com
Authorization: Bearer 987tghjkiu6trfghjuytrghj
```

Notice the `Bearer` keyword in front of the token. This tells Facebook what
_type_ of token it's receiving. A bearer token means whoever holds (bears)
this string is authorized to use it, no additional proof is required.

:::magnifyingglassme

We'll dive deeper into bearer tokens and other token types in a future blog
post.

:::

The Authorization header is the best method to pass the Access Token
because it has the least chance of being logged or leaked:

- A query parameter gets written to Facebook's server access logs, shows up
  in your browser history, and can leak to third parties through the
  `Referer` header if Facebook's response ever links out somewhere.
- A form-encoded body only exists on requests that already have a body.
  It's useless for a `GET` request, so it can't be relied on universally.

The Authorization header avoids all of these problems, which is why it's
the recommended method.

:::confusedDuck

What happens if Strava forgets to send the token, or sends a garbage value?

:::

Facebook would reject the request with a `401 Unauthorized`, along with a
`WWW-Authenticate` header describing what went wrong:

```bash
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer realm="facebook", error="invalid_token"
```

## Token Introspection

The introspection request (defined in
[RFC 7662](https://datatracker.ietf.org/doc/html/rfc7662)) is a
form-encoded HTTP request to the Authorization Server’s introspection
endpoint. This allows the protected resource to ask the Authorization
Server: “An OAuth client gave me this Access Token, what is it good for?”
This means the protected resource doesn't have to trust the token at face
value. Normally the protected resource would send a query to the endpoint
path `/introspect` to check the validity of the token received by the
client.

This is why the client cannot inflate its own permissions. The scope that
comes back belongs to the Authorization Server, not to anything the client
sent along. The protected resource checks on each request whether the token
is still valid and what it is actually allowed to do.

### Token Expiration/Revocation

Since the protected resource now validates the token on each request, it
can also check if a token has been rejected by the Authorization Server or
the TTL (time to live) of the token has been reached and is now expired. If
the protected resource finds out from the Authorization Server that the
token is either rejected or expired, then protected resource will not
accept that token.

:::me

In a future blog post we will discuss an alternative to token
introspection, known as the
[JWT Profile for OAuth 2.0 Access Tokens](https://datatracker.ietf.org/doc/html/rfc9068)

:::

### The Introspection Endpoint

As stated, the Authorization Server would normally accept introspection
requests on the path `/introspect`.

Here is what a query from the protected resource to the Authorization
Server would look like once it receives a token from the client:

```bash
POST /introspect HTTP/1.1
Host: authorization-server:9001
Accept: application/json
Content-Type: application/x-www-form-urlencoded
Authorization: Basic cHJvdGVjdGVkLXJlc291cmNlLTE6cHJvdGVjdGVkLXJlc291cmNlLXNlY3JldC0x

token=987tghjkiu6trfghjuytrghj
```

Notice the `Authorization: Basic` header. The introspection endpoint is not
open to the world, so the protected resource has to authenticate itself the
same way a client does. Without this authentication step, anyone could
throw stolen tokens at `/introspect` and learn which ones are still live.

The response from the Authorization Server will normally be a JSON document
that describes the token:

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

The first field to check is `active`. If it comes back `false`, then
nothing else in the response matters and Facebook rejects the request. A
token can be inactive for many reasons. For example, it expired, or it was
revoked, or because it was never issued by this Authorization Server in the
first place.

According to our example, `active` is true and the scope is correct. Strava
will only get permissions to post on behalf of the user Hamza. And from the
time of writing this blog post, the token is also not expired.

:::tip

Quick tip! If you want to parse the timestamps listed above, then you can
do so on a bash commandline as follows:

```bash
# macOS and BSD
date -r 1783641600
# Fri 10 Jul 2026 01:00:00 IST

# GNU coreutils, so most Linux distributions
date -d @1783641600
# Fri Jul 10 01:00:00 IST 2026
```

:::

## TLS Requirement

In a production OAuth system, proper TLS usage is a hard-and-fast
requirement. TLS makes sure that a middle-man can't tamper with the
communication between two systems. TLS protects all three communication
paths on OAuth:

- Client → Authorization Server (where the Access Token is issued)
- Client → Protected Resource (where the token is used)
- Protected Resource → Authorization Server (the introspection call)

TLS is particularly important when a client communicates with the protected
resource. Without TLS, the Access Token lives in the HTTP header
unencrypted. Anyone on the same network can grab the Access Token using a
basic packet sniffer.

## Conclusion

At this point you should have a solid foundation of what a protected
resource is and it's role in the OAuth flow. The job of the Protected
Resource is to validate the token, enforce the scope and trust nothing!

This ends our deep-dive into the Protected Resource.

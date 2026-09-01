---
title: "Setting Up Microsoft Entra ID for Camunda 8"
published: 2026-09-24
draft: false
description:
  "The provider side of the wire: six app registrations, the token version
  setting that breaks everything, and the 8.9 userinfo bug the docs do not
  mention yet."
tags: ["Camunda", "Authentication", "OAuth"]
---

## Introduction

[The Helm post](/posts/camunda-helm-oidc) walked through every OIDC
parameter in Camunda's `values.yaml`, and at one point it said this:

> So you create one client per component in your provider, then tell the
> chart what you named them.

And then moved straight on, which was a bit of a cheat. Half of connecting
Camunda to an identity provider happens on the **provider's** side, and
that half is where the fiddly, undocumented failures live.

This post is that half, for Microsoft Entra ID specifically.

:::note

Prerequisites, in order:

1. [The Two Identity Systems in Camunda 8](/posts/camunda-two-identity-systems)
   — why you need more than one app registration.
2. [Connecting the Camunda Helm Chart to an OIDC Provider](/posts/camunda-helm-oidc)
   — the Camunda side of the same wire.

Checked against **camunda-platform chart 14.8.5** (app 8.9.x). Entra's
admin UI moves around; the underlying objects do not.

:::

## What You Are Building

Six app registrations, one per component. Entra calls them "applications";
they are the OAuth clients from
[Part 4](/posts/oauth-authorization-server#client-registration).

| Component             | Platform type           | Client secret? | Identity system     |
| --------------------- | ----------------------- | -------------- | ------------------- |
| Management Identity   | Web                     | Yes            | Management Identity |
| Orchestration Cluster | Web                     | Yes            | Admin               |
| Optimize              | Web                     | Yes            | Management Identity |
| Web Modeler API       | Web                     | Yes            | Management Identity |
| Console               | Single-page application | No             | Management Identity |
| Web Modeler UI        | Single-page application | No             | Management Identity |

:::confusedDuck

Why do the last two not get a secret?

:::

:::me

Because they run in the browser, and a browser cannot keep a secret. Those
are [public clients](/posts/oauth-client#client-types) from Part 2, and
Entra's "Single-page application" platform is how you declare it: it turns
on CORS for the token endpoint and requires
[PKCE](/posts/oauth-authorization-server#pkce) on the authorization code
flow.

Entra will not actually stop you creating a secret on an SPA registration.
What it does instead is refuse to _honour_ one — it rejects client
credentials on any request carrying an `Origin` header, specifically so
that secrets cannot be used from inside a browser.

:::

Note also that Web Modeler needs **two** registrations — a UI and an API —
and only the UI gets a redirect URI. The API registration is a resource
server; nothing ever redirects to it.

## Registering One Application

The following is per registration. It is repetitive, and the repetition is
the point — six nearly-identical apps that differ in type, redirect URI and
which Helm key they end up in.

:::chefDuck

Entra admin center → **Identity** → **Applications** → **App
registrations** → **New registration**. Keep a scratch file open; you will
be collecting a client ID and a secret from each one.

:::

**1. Register it.** Name it after the component. For supported account
types, "Accounts in this organizational directory only" is the normal
choice for an internal deployment.

**2. Record the Client ID.** It is on the Overview page, a GUID. In Entra
this doubles as the **audience** — you will use the same GUID for both
`clientId` and `audience` in Helm.

**3. Add a platform.** Under **Authentication** → **Add a platform**,
choose **Web** or **Single-page application** per the table above.

**4. Add the redirect URI.** These are exact paths, and each component
wants a different one:

| Component             | Redirect URI                                 | Local                                               |
| --------------------- | -------------------------------------------- | --------------------------------------------------- |
| Management Identity   | `<IDENTITY_URL>/auth/login-callback`         | `http://localhost:8084/auth/login-callback`         |
| Orchestration Cluster | `<OC_URL>/sso-callback`                      | `http://localhost:8080/sso-callback`                |
| Optimize              | `<OPTIMIZE_URL>/api/authentication/callback` | `http://localhost:8083/api/authentication/callback` |
| Web Modeler UI        | `<WEB_MODELER_URL>/login-callback`           | `http://localhost:8070/login-callback`              |
| Console               | `<CONSOLE_URL>/`                             | `http://localhost:8087/`                            |
| Web Modeler API       | none                                         | none                                                |

:::pointingDuck

Console's redirect URI ends in a bare `/`. That trailing slash is part of
the value, and Entra compares these exactly.

:::

The `*_URL` placeholders are the base URL **as reached from your users'
browsers** — your ingress hostname, not a service name. This is the same
constraint as `redirectUrl` in the Helm values, and the two must agree
character for character.

:::note

Entra does a
[strict comparison](https://learn.microsoft.com/en-us/troubleshoot/entra/entra-id/app-integration/error-code-aadsts50011-redirect-uri-mismatch)
on these. `http://` and `https://` are different values, and case matters.

It also takes **three to five minutes** for a redirect URI change to take
effect. If you fix one and immediately retry, you will get the same error
and conclude the fix did not work. Change it, then go and do something else
for five minutes.

:::

**5. Create a client secret** — Web apps only. Under **Certificates &
secrets** → **New client secret**. Copy the **Value**, not the Secret ID.

:::sweatingDuck

The value is only shown once, and the column next to it looks just as much
like a secret.

:::

:::me

It does, and copying the Secret ID instead is a rite of passage. If you
lose the value you cannot recover it — you delete the secret and create a
new one. And note that Entra client secrets **expire**: whatever you set up
today has a date on which authentication silently stops working. Put that
date in a calendar while you are still looking at it.

:::

**6. Set the access token version.** This is the step that quietly breaks
everything if you skip it, and it gets its own section below. In the app's
**Manifest**, under `api`, set:

```json
api: {
  ...
  "requestedAccessTokenVersion": 2,
  ...
}
```

:::note

Microsoft's own docs are inconsistent about this property's name. The
current Graph-format manifest — the default editor — calls it
`requestedAccessTokenVersion` under `api`. Some older pages still call it
`accessTokenAcceptedVersion`. Same setting, same values; if you only find
the other name in your portal, set that one.

:::

**7. Add the `preferred_username` optional claim.** Under **Token
configuration** → **Add optional claim**. This is what lets you map a
Camunda user to an email address rather than a GUID. It is delivered by the
`profile` scope, which Camunda already requests.

## The Token Version Trap

Step 6 deserves more than a bullet, because skipping it produces a failure
that looks like nothing to do with token versions.

Entra can issue access tokens in two formats, v1.0 and v2.0, and
`requestedAccessTokenVersion` decides which. The difference that matters
here is the **audience**.

:::readingDuck

Microsoft's
[access token claims reference](https://learn.microsoft.com/en-us/entra/identity-platform/access-token-claims-reference)
on `aud`: "In v2.0 tokens, this value is always the client ID of the API.
In v1.0 tokens, it can be the client ID or the resource URI used in the
request."

:::

Camunda sets `audience` to the bare client ID GUID, which is exactly what a
v2.0 token always carries. A v1.0 token carries no such guarantee — its
audience depends on how the token was requested, and it is commonly
`api://<guid>`. When it is, Camunda compares `api://<guid>` against
`<guid>` and rejects the token.

And the default is not the one you want:

:::pointingDuck

`requestedAccessTokenVersion` defaults to `null`, and null means **1**. A
registration you have not deliberately changed issues v1.0 tokens.

:::

:::confusedDuck

But `authUrl` and `tokenUrl` in the Camunda config both end in `/v2.0`.
Doesn't calling the v2.0 endpoint get me v2.0 tokens?

:::

:::me

That is the trap, and it is an entirely reasonable assumption. The endpoint
version only decides the **ID token**. The access token's version is chosen
by the _resource_ — the application the token is for — in its own manifest.
Microsoft states it plainly: "The endpoint used, v1.0 or v2.0, is chosen by
the client and only impacts the version of id_tokens."

Which is also why the fix always belongs on the API's registration, never
the caller's. As the docs put it, "Resources always own their tokens using
the `aud` claim and are the only applications that can change their token
details."

:::

:::confusedDuck

So login works, and then the component says no?

:::

:::me

Exactly that shape, and it is the single most confusing failure in this
setup. The user authenticates fine — Entra is happy, the redirect comes
back, a real token is issued. Then the component refuses it. Nothing in the
login flow hints that a manifest property is the cause.

:::

This is the same `aud` mismatch from
[Part 6](/posts/oauth-token-types#what-is-inside-the-payload), just
delivered by a checkbox. If you ever see Camunda rejecting a token that
looks perfectly valid, decode it and look at `aud` before you look at
anything else.

## Claims: `preferred_username` and `azp`

Camunda needs to know which claim identifies a **person** and which
identifies a **machine**. Entra's answers are not the chart defaults.

| Helm value      | Chart default        | Entra needs            |
| --------------- | -------------------- | ---------------------- |
| `usernameClaim` | `preferred_username` | `preferred_username` ✓ |
| `clientIdClaim` | `client_id`          | `azp`                  |

`usernameClaim` happens to match, provided you added the optional claim in
step 7. `clientIdClaim` does not: Entra puts the calling application's ID
in `azp`, so leaving the chart default of `client_id` means
machine-to-machine callers are never identified and every Connectors
request is refused.

:::suspiciousDuck

Part 7 said `preferred_username` must not be used as a stable identifier,
and here it is being used as the username.

:::

:::me

The same tension as in the Helm post, and it is worth restating because
Entra makes it concrete. `preferred_username` in Entra normally carries the
user's email address, and email addresses at a company do change. When one
does, that person's Camunda role assignments no longer match them and have
to be re-granted by hand.

The stable alternative is `oid`, Entra's immutable object ID for the user.
It is a GUID, so every authorization rule becomes unreadable — which is why
most people accept the trade and use `preferred_username` anyway. Just
choose it knowingly rather than by default.

:::

## Consent, Grant Types and Scopes

Three tenant-level things that are easy to miss because they are not part
of any single app registration.

**Admin consent.** Users cannot consent to these applications themselves in
most tenants. Either grant admin consent on their behalf or configure an
admin consent workflow. Without it, login stops at a Microsoft page asking
for an approval the user cannot give.

**Grant types.** Camunda needs `authorization_code` (browser login),
`refresh_token` (session renewal) and `client_credentials` (Connectors and
other M2M). These are enabled by default, but organizational policies can
restrict them — worth confirming if you are in a tightly governed tenant.

**Scopes.** Camunda requests `openid`, `profile`, `email`,
`offline_access`, and `<client-id>/.default`. The `.default` scope is
Entra's way of saying "every permission already consented for this
application," and it is what makes Entra issue a token audienced to _your_
application rather than to Microsoft Graph.

`offline_access` is optional but wanted: it is what gets you a
[Refresh Token](/posts/oauth-authorization-server#issuing-refresh-tokens),
and without it users get bounced back to Entra to log in again every time
their access token expires.

:::suspiciousDuck

Who exactly can get a token audienced to my Camunda application?

:::

:::me

By default, any application in your tenant that asks. Entra issues app-only
tokens without requiring that the caller be authorised for the target API —
the docs say so directly, and put the burden on the API: "applications that
expose APIs must implement permission checks in order to accept tokens."

Camunda does implement them. A client only gets anywhere if it holds a
role, which is what `defaultRoles.connectors.clients` grants. But you can
shut the door one step earlier by enabling **assignment required** on the
app registration, so Entra declines to mint the token in the first place.

:::

## The 8.9 Login Bug

Now the one you will not find in the documentation, because at the time of
writing it is still an open issue.

On Camunda **8.9**, following the official Entra guide exactly, logging
into the Orchestration Cluster fails at the callback:

:::cameraDuck

```json
{
  "type": "about:blank",
  "title": "Internal Server Error",
  "status": 500,
  "detail": "[invalid_user_info_response] An error occurred while attempting to retrieve the UserInfo Resource: 401 Unauthorized on GET request for \"https://graph.microsoft.com/oidc/userinfo\": {\"error\":{\"code\":\"InvalidAuthenticationToken\",\"message\":\"Access token validation failure. Invalid audience.\"}}",
  "instance": "/sso-callback"
}
```

:::

:::armsCrossedDuck

I followed the documented configuration and it does not work. That is not a
misconfiguration on my side.

:::

:::me

It is not, and you are right to be annoyed. This one is a genuine
interaction bug between three moving parts, and it is worth understanding
because the fix looks arbitrary otherwise.

:::

Here is the chain, and it lands squarely on
[the UserInfo endpoint from Part 7](/posts/openid-connect#the-userinfo-endpoint):

1. 8.9 upgraded to Spring Security 7, which now calls `/userinfo`
   **unconditionally** after an authorization code login. Spring Security 6
   only called it when the granted scopes looked like standard OIDC scopes
   — which Entra's resource-qualified scopes never do — so 8.8 skipped the
   call and never hit this.
2. Spring reuses the access token from the code exchange to make that call.
3. Because you asked for `<client-id>/.default`, that token is audienced to
   **your Camunda application**.
4. Entra's UserInfo endpoint is served by Microsoft Graph, which only
   accepts tokens audienced to Graph itself.
5. Graph returns `401 Invalid audience`, Spring surfaces it as a 500, and
   the login dies.

:::pointingDuck

An access token has exactly one audience. Camunda needs it audienced to
Camunda so it can validate the signature locally. Graph needs it audienced
to Graph. Both cannot be true.

:::

The fix is to stop making the call. `user-info-enabled` defaults to `true`
and has no dedicated Helm value in 14.8.5, so it goes in through the
chart's configuration escape hatch:

```yaml
orchestration:
  extraConfiguration:
    - file: "additional-security.yaml"
      content: |
        camunda:
          security:
            authentication:
              oidc:
                user-info-enabled: false
```

Nothing is lost by turning it off here. Microsoft's own documentation notes
that their UserInfo endpoint returns no claims that are not already in the
ID Token — which is the Part 7 point that the ID Token, not UserInfo, is
the authentication artifact.

:::note

This is a moving target. The issue is open and the maintainers have
discussed making the userinfo call fail-soft — attempt it, log a warning,
fall back to ID Token claims — rather than requiring the flag. Check
whether your version still needs this before adding it.

The underlying audience conflict is not Entra-specific, incidentally. Auth0
with an `audience` parameter, and Okta with a custom authorization server,
land in the same place for the same reason.

:::

## The Resulting Helm Values

Everything above produces this. Each `<...>` is something you wrote down
while clicking through Entra:

```yaml
global:
  identity:
    auth:
      enabled: true
      type: "MICROSOFT"
      issuer: https://login.microsoftonline.com/<tenant-id>/v2.0
      issuerBackendUrl: https://login.microsoftonline.com/<tenant-id>/v2.0
      authUrl: https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/authorize
      tokenUrl: https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token
      jwksUrl: https://login.microsoftonline.com/<tenant-id>/discovery/v2.0/keys

      identity:
        clientId: "<mgmt-identity-app-id>"
        audience: "<mgmt-identity-app-id>"
        initialClaimName: preferred_username
        initialClaimValue: "<your-admin-email>"
        secret:
          existingSecret: "entra-credentials"
          existingSecretKey: "identity-client-secret"

      optimize:
        clientId: "<optimize-app-id>"
        audience: "<optimize-app-id>"
        redirectUrl: "<OPTIMIZE_URL>"
        secret:
          existingSecret: "entra-credentials"
          existingSecretKey: "optimize-client-secret"

      webModeler:
        clientId: "<web-modeler-ui-app-id>"
        clientApiAudience: "<web-modeler-ui-app-id>"
        publicApiAudience: "<web-modeler-api-app-id>"
        redirectUrl: "<WEB_MODELER_URL>"

      console:
        clientId: "<console-app-id>"
        audience: "<console-app-id>"
        redirectUrl: "<CONSOLE_URL>"

  security:
    authentication:
      method: oidc

orchestration:
  security:
    authentication:
      oidc:
        clientId: "<oc-app-id>"
        audience: "<oc-app-id>"
        usernameClaim: preferred_username
        clientIdClaim: azp
        preferUsernameClaim: true
        redirectUrl: "<OC_URL>"
        scope:
          - openid
          - profile
          - offline_access
          - "<oc-app-id>/.default"
        secret:
          existingSecret: "entra-credentials"
          existingSecretKey: "orchestration-cluster-client-secret"
    initialization:
      defaultRoles:
        admin:
          users:
            - "<your-admin-email>"
        connectors:
          clients:
            - "<oc-app-id>"

connectors:
  security:
    authentication:
      oidc:
        clientId: "<oc-app-id>"
        audience: "<oc-app-id>"
        tokenScope: "<oc-app-id>/.default"
        secret:
          existingSecret: "entra-credentials"
          existingSecretKey: "orchestration-cluster-client-secret"
```

:::pointingDuck

`initialClaimValue` and `defaultRoles.admin.users` are the same email
address. That is the two-bootstrap rule from the Helm post: two identity
systems, one administrator.

:::

Connectors reuses the Orchestration Cluster's registration rather than
getting its own — it authenticates as that client to reach the cluster API.
Note it takes no `redirectUrl`, because it is a pure
[Client Credentials](/posts/oauth-grant-types#client-credentials-grant)
caller with no browser anywhere in sight.

## Verify Before You Deploy

You can check most of this without installing anything, by asking Entra for
a token and looking at it:

```bash
curl -s -X POST \
  "https://login.microsoftonline.com/<tenant-id>/oauth2/v2.0/token" \
  -d "client_id=<oc-app-id>" \
  -d "client_secret=<secret>" \
  -d "scope=<oc-app-id>/.default" \
  -d "grant_type=client_credentials" \
  | jq -r .access_token | cut -d. -f2 | base64 -d 2>/dev/null | jq
```

Three things to check in the output:

- **`aud`** is the bare GUID, not `api://<guid>`. If it is the latter, go
  back and set `requestedAccessTokenVersion`.
- **`azp`** is present and holds the client ID. That is what
  `clientIdClaim: azp` is reading.
- **`iss`** ends in `/v2.0`.

:::magnifyingglassme

That is a machine token, so it will not contain `preferred_username` —
there is no user in a Client Credentials flow. To check the user claims you
have to complete a real browser login and inspect the resulting token.

:::

## When It Does Not Work

| Symptom                                                   | Cause                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------- |
| `AADSTS50011` redirect URI mismatch                       | The URI in Entra does not exactly match `redirectUrl`.                    |
| Login succeeds, component returns `401`                   | `aud` mismatch — usually `requestedAccessTokenVersion` still 1.           |
| `500` at `/sso-callback` mentioning `graph.microsoft.com` | The 8.9 userinfo bug. Set `user-info-enabled: false`.                     |
| Connectors cannot reach the cluster                       | `clientIdClaim` still `client_id` instead of `azp`.                       |
| Logged in but everything forbidden                        | `initialClaimValue` / `defaultRoles.admin.users` do not match your claim. |
| Worked for months, then stopped                           | The client secret expired.                                                |
| Login stops at a Microsoft approval page                  | Admin consent was never granted.                                          |

## Conclusion

The Entra side is six app registrations and about seven clicks each, and
almost all of the difficulty is concentrated in three of those clicks: the
platform type, which decides whether you get a secret; the redirect URI,
which has to match exactly; and `requestedAccessTokenVersion`, which
decides whether the `aud` claim will be the thing Camunda is comparing
against.

Then there is the 8.9 userinfo bug, which is not your fault and not in the
documentation, and which you now know to recognise from a 500 mentioning
`graph.microsoft.com`.

If you have read [the OAuth series](/series/oauth-simplified) before this,
none of the underlying mechanics were new. Public versus confidential
clients, the registered redirect URI, the `aud` claim, Client Credentials
for machines, the ID Token versus UserInfo — all of it was covered
protocol-first, vendor-neutral, several posts ago. This is what it looks
like when you have to click it into a real portal.

:::proudDuck

Six registrations, one working login.

:::

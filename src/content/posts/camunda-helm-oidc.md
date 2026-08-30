---
title: "Connecting the Camunda Helm Chart to an OIDC Provider"
published: 2026-09-20
draft: false
description:
  "Every OIDC parameter in the Camunda Helm chart, what it actually does,
  and which OAuth concept it maps to — including the issuer and
  publicIssuerUrl confusion."
tags: ["OAuth", "Camunda", "Kubernetes"]
---

## Introduction

The [OAuth Simplified](/series/oauth-simplified) series spent seven posts
on the protocol: authorization codes, clients, scopes, tokens, grant types
and finally [OpenID Connect](/posts/openid-connect). All of it was
deliberately vendor-neutral, with Strava posting to a fictional Facebook.

This post is the other half. It takes a real product — the Camunda Helm
chart — points it at a real OIDC provider, and walks through what every
parameter in `values.yaml` is actually doing. Almost all of them are
something from the series wearing a YAML key.

:::note

**Read
[The Two Identity Systems in Camunda 8](/posts/camunda-two-identity-systems)
first.** Camunda splits identity into Management Identity (Console, Web
Modeler, Optimize) and Admin (Operate, Tasklist, Zeebe). That split is why
this values file configures OIDC in two separate places, and it is much
easier to follow the parameters below once you know which system each one
belongs to.

:::

:::chefDuck

Have your editor open. We are building a values file from nothing, a block
at a time.

:::

:::note

Everything here is checked against **camunda-platform chart 14.8.5** (app
version 8.9.x), and quotes come from that chart's own `values.yaml`. Helm
values move between versions — the 8.8/8.9 charts reorganised this area
substantially — so check yours:

```bash
helm show values camunda/camunda-platform --version 14.8.5
```

:::

## Three Ways To Do This

Before touching a parameter, you have to know which of three setups you are
in, because it decides which values are even required. The chart's own
comments spell them out:

| Mode                      | What it means                                 | `identityKeycloak.enabled` |
| ------------------------- | --------------------------------------------- | -------------------------- |
| **A** — Internal Keycloak | The chart deploys a Keycloak for you.         | `true`                     |
| **B** — External Keycloak | You already run a Keycloak elsewhere.         | `false`                    |
| **C** — External OIDC     | Entra ID, Okta, Auth0, Google, anything else. | `false`                    |

In Mode A you barely configure OIDC at all — the chart derives every
endpoint from the Keycloak it just deployed. That is why the getting
started guides are so short, and why the first real production deployment
is such a shock.

This post is about **Mode C**, the generic external provider, because it is
the one where you have to supply everything yourself and therefore the one
where understanding the parameters matters.

## Step 1: Ask Your Provider For Its Endpoints

Part 7 ended on [discovery](/posts/openid-connect#discovery), and this is
where that pays off. Every OIDC provider publishes its configuration at a
well-known path, so you do not have to guess at any URL:

```bash
curl -s https://login.example.com/.well-known/openid-configuration | jq
```

:::cameraDuck

```json
{
  "issuer": "https://login.example.com",
  "authorization_endpoint": "https://login.example.com/oauth/authorize",
  "token_endpoint": "https://login.example.com/oauth/token",
  "jwks_uri": "https://login.example.com/.well-known/jwks.json"
}
```

:::

Four of those map directly onto Helm values:

| Discovery field          | Helm value                      |
| ------------------------ | ------------------------------- |
| `issuer`                 | `global.identity.auth.issuer`   |
| `authorization_endpoint` | `global.identity.auth.authUrl`  |
| `token_endpoint`         | `global.identity.auth.tokenUrl` |
| `jwks_uri`               | `global.identity.auth.jwksUrl`  |

:::confusedDuck

If the provider publishes all of this at a well-known URL, why does the
chart make me copy them in by hand?

:::

:::me

Because the four URLs are not all used from the same place, and two of them
have to work from somewhere a discovery document knows nothing about. That
is the next section, and it is the thing people actually get wrong.

:::

## Step 2: The Global Block

Here is the minimum that turns authentication on:

```yaml
global:
  security:
    authentication:
      method: oidc

  identity:
    auth:
      enabled: true
      type: "GENERIC"

      issuer: https://login.example.com
      issuerBackendUrl: https://login.example.com
      authUrl: https://login.example.com/oauth/authorize
      tokenUrl: https://login.example.com/oauth/token
      jwksUrl: https://login.example.com/.well-known/jwks.json
```

`global.security.authentication.method` is the master switch. It takes
`basic` or `oidc`, and every component inherits it unless it overrides the
value under its own `security.authentication.method`. `type` tells the
chart which provider dialect to expect and takes `KEYCLOAK` (the default),
`MICROSOFT`, or `GENERIC`.

### Which URL Is Called From Where

This is the part worth slowing down on, and it is
[front channel versus back channel](/posts/oauth-client#back-channel-vs-front-channel)
from Part 2, wearing a Kubernetes hat.

:::pointingDuck

Some of these URLs are opened by **your user's browser**. Others are called
by a **pod inside the cluster**. Those are two different network positions,
and a URL that works from one may be unreachable from the other.

:::

| Value              | Called by           | Must be reachable from |
| ------------------ | ------------------- | ---------------------- |
| `authUrl`          | The user's browser  | The public internet    |
| `issuer`           | Browser and backend | Both                   |
| `issuerBackendUrl` | Camunda pods        | Inside the cluster     |
| `tokenUrl`         | Camunda pods        | Inside the cluster     |
| `jwksUrl`          | Camunda pods        | Inside the cluster     |

`authUrl` is a redirect — the browser is sent there to log in, exactly as
in [Part 2](/posts/oauth-client#url-redirect). `tokenUrl` is the
back-channel code exchange, and `jwksUrl` is where the components fetch
signing keys to validate JWTs, which is
[the JWKS endpoint from Part 6](/posts/oauth-token-types#validating-a-jwt-without-calling-anyone).
Both of those are server-to-server, so they resolve from the pod's network,
not yours.

:::sweatingDuck

So if I put a `.svc.cluster.local` address in `authUrl`, the login page
just... never loads?

:::

:::me

Correct, and the error will not say so. The browser is handed a redirect to
a hostname that only exists inside the cluster and simply fails to
navigate. It is one of the most common ways this setup breaks, and the
symptom looks nothing like the cause.

:::

:::note

Splitting internal and external URLs like this is supported when your
provider is **Keycloak**. For a **generic** OIDC provider, Camunda does not
support split-horizon DNS — the issuer has to be one URL that resolves and
is reachable from both the browser and the pods. Plan the network before
you plan the values file.

:::

### `issuer` vs `publicIssuerUrl`

If you have read the Camunda docs you may have noticed that the generic
OIDC page uses `publicIssuerUrl` while the Microsoft Entra page uses
`issuer`, with no explanation of the difference. Both keys are real, and
they are not the same key.

:::readingDuck

From the chart's own `values.yaml`, on `issuer`: "External OIDC: either
this or publicIssuerUrl must be set (Microsoft Entra docs use issuer;
generic OIDC docs use publicIssuerUrl)."

And on `publicIssuerUrl`: "External OIDC: required when issuer is not set
(generic OIDC pattern); **not consulted if issuer is set**."

:::

So the rule is simple once you have it in one place:

- Set **one** of them. `issuer` wins if both are set.
- `publicIssuerUrl` has a default —
  `http://localhost:18080/auth/realms/camunda-platform` — which points at
  the internal Keycloak on a port-forward. `issuer` defaults to empty.

:::thumbsUpDuck

For an external provider, set `issuer` and leave `publicIssuerUrl` alone.
It is the unambiguous one, and it avoids inheriting a localhost default you
did not intend.

:::

## Step 3: A Client Per Component

Camunda is not one application. Console, Management Identity, Web Modeler,
Optimize, the Orchestration Cluster and Connectors are separate
deployments, split across the
[two identity systems](/posts/camunda-two-identity-systems), and each one
authenticates as **its own OAuth client**.

:::confusedDuck

Why not one client for all of Camunda? It is one product and one install.

:::

:::me

For the same reason
[Part 4](/posts/oauth-authorization-server#client-registration) registered
Strava once with its own credentials. A client registration carries a
redirect URI, a set of allowed scopes and a secret. Web Modeler and the
Orchestration Cluster have different URLs, need different permissions, and
should be independently revocable. One shared client would mean one shared
blast radius.

:::

So you create one client per component in your provider, then tell the
chart what you named them. These are the chart's defaults, which are what
you get if you say nothing:

| Component             | Default `clientId` | Default `audience`                           |
| --------------------- | ------------------ | -------------------------------------------- |
| Management Identity   | `camunda-identity` | `camunda-identity-resource-server`           |
| Orchestration Cluster | `orchestration`    | `orchestration-api`                          |
| Connectors            | `connectors`       | —                                            |
| Console               | `console`          | `console-api`                                |
| Optimize              | `optimize`         | `optimize-api`                               |
| Web Modeler           | `web-modeler`      | `web-modeler-api` + `web-modeler-public-api` |

Most providers will not let you choose your own client IDs — Entra hands
you a GUID — so in practice you override all of these:

```yaml
global:
  identity:
    auth:
      identity:
        clientId: <identity-client-id>
        audience: <identity-audience>
        secret:
          existingSecret: oidc-credentials
          existingSecretKey: identity-client-secret
        initialClaimName: <user-claim-name>
        initialClaimValue: <admin-user-value>

      optimize:
        clientId: <optimize-client-id>
        audience: <optimize-audience>
        redirectUrl: <optimize-url>
        secret:
          existingSecret: oidc-credentials
          existingSecretKey: optimize-client-secret

      webModeler:
        clientId: <web-modeler-ui-client-id>
        redirectUrl: <web-modeler-url>
        clientApiAudience: <web-modeler-ui-audience>
        publicApiAudience: <web-modeler-api-audience>

      console:
        clientId: <console-client-id>
        audience: <console-audience>
        redirectUrl: <console-url>
```

### `audience`

`audience` is the `aud` claim from
[Part 6](/posts/oauth-token-types#what-is-inside-the-payload), and it is
the reason a token issued for Optimize cannot be replayed against the
Orchestration Cluster. Each component checks that incoming tokens name
**it** as the audience and rejects everything else.

Get this wrong and you get a `401` from a component while the login itself
appears to succeed — because the login genuinely did succeed. The token is
real, signed, unexpired, and addressed to somebody else.

### `redirectUrl`

`redirectUrl` is the registered redirect URI from
[Part 2](/posts/oauth-client#url-redirect), and it must be the URL **the
user's browser** reaches the component on — your ingress hostname, not a
service name. It also has to match what you registered in the provider
exactly, because the provider compares it character for character before it
will redirect anywhere.

:::facepalmDuck

I left it as `http://localhost:8080` from the port-forward tutorial and
then wondered why login broke behind the ingress.

:::

:::me

That default is genuinely useful while you are testing with
`kubectl port-forward`, which is exactly what makes it so easy to forget.
Every component that renders a UI has one of these, and every one of them
needs updating the moment you put a real hostname in front of it.

:::

Web Modeler is the odd one out, with two audiences rather than one:
`clientApiAudience` for its own browser UI talking to its backend, and
`publicApiAudience` for external callers using its public API. They are
separate because they are genuinely separate consumers.

### Secrets

Every client that can hold a secret — a
[confidential client](/posts/oauth-client#client-types), in Part 2's terms
— needs one. The chart takes it three ways:

```yaml
secret:
  existingSecret: oidc-credentials
  existingSecretKey: identity-client-secret
  inlineSecret: ""
```

:::thumbsDownDuck

`inlineSecret` puts the client secret in plain text in your values file.
The chart's own comment scopes it to "non-production usage," and a values
file is exactly the sort of thing that ends up in Git.

:::

Create the Kubernetes Secret separately and reference it. One secret object
with a key per component reads well:

```bash
kubectl create secret generic oidc-credentials \
  --from-literal=identity-client-secret='...' \
  --from-literal=optimize-client-secret='...' \
  --from-literal=orchestration-client-secret='...'
```

Console and Web Modeler are
[public clients](/posts/oauth-client#client-types) — they run in the
browser and cannot keep a secret — so neither has a `secret` block in the
chart at all. That is the same public/confidential split from Part 2, and
the reason [PKCE](/posts/oauth-authorization-server#pkce) exists.

:::note

Console has one parameter the others do not: `wellKnown`, the URL of your
provider's discovery document. Its default is the placeholder
`https://well-known-uri`, so for an external provider set it to the same
`/.well-known/openid-configuration` URL you curled in step one.

:::

## Step 4: The Orchestration Cluster

The Orchestration Cluster (Zeebe, Operate, Tasklist and Admin) is
configured under its own top-level key rather than under `global`, and it
is where the interesting claim mapping lives:

```yaml
orchestration:
  enabled: true
  security:
    authentication:
      method: oidc
      oidc:
        clientId: <orchestration-client-id>
        audience: <orchestration-audience>
        redirectUrl: <orchestration-url>
        secret:
          existingSecret: oidc-credentials
          existingSecretKey: orchestration-client-secret
        usernameClaim: preferred_username
        clientIdClaim: client_id
    authorizations:
      enabled: true
```

### Claim Mapping

Part 7 made the point that
[an ID Token's claims vary by provider](/posts/openid-connect#identifying-the-user).
This is where you tell Camunda which claim to read. The chart defaults are:

| Parameter             | Default              | What it does                                 |
| --------------------- | -------------------- | -------------------------------------------- |
| `usernameClaim`       | `preferred_username` | Which claim identifies a **human** at login. |
| `clientIdClaim`       | `client_id`          | Which claim identifies a **machine** client. |
| `preferUsernameClaim` | `false`              | Prefer the username claim over the subject.  |
| `groupsClaim`         | `""` (unset)         | Which claim carries the user's groups.       |

Two claims rather than one, because two different kinds of caller arrive
here. A person logging into Operate is identified by `usernameClaim`. A
Connectors pod calling the API with a
[Client Credentials](/posts/oauth-grant-types#client-credentials-grant)
token has no user at all and is identified by `clientIdClaim`.

Providers disagree on both. Entra puts the client ID in `azp` rather than
`client_id`, so `clientIdClaim: azp` is a common override. The way to find
out is not to guess — get a real token out of your provider and decode it,
exactly as Part 6 did.

:::suspiciousDuck

`usernameClaim` defaults to `preferred_username`, and Part 7 said
`preferred_username` is one of the claims you must **not** use as a unique
identifier. Is the default not then wrong?

:::

:::me

You have found a real tension, and it is worth being clear about. Part 7's
rule stands: the only guaranteed stable identifier is `(iss, sub)`, and
`preferred_username` is explicitly not stable. What this setting controls
is which claim Camunda matches against the usernames in its own
authorization rules — so it is a mapping key, not a global identity.

The practical consequence is real, though. If a user's `preferred_username`
changes at your provider, their Camunda permissions no longer match them.
If your provider lets that value change, map to something that does not —
many people use `email`, or `sub` where they can tolerate the
unreadability.

:::

### Bootstrapping The First Admin

There is a chicken-and-egg problem in every OIDC deployment: permissions
live in Camunda, but nobody has any yet, and you cannot log in to grant
them.

Two settings solve it, and there are two of them because there are
[two identity systems](/posts/camunda-two-identity-systems) — one
bootstraps Management Identity, the other bootstraps Admin.

```yaml
global:
  identity:
    auth:
      identity:
        initialClaimName: email
        initialClaimValue: admin@example.com

orchestration:
  security:
    initialization:
      defaultRoles:
        admin:
          users:
            - admin@example.com
        connectors:
          clients:
            - <orchestration-client-id>
```

`initialClaimName` and `initialClaimValue` bootstrap Management Identity:
whoever arrives holding a token where that claim has that value becomes the
first admin. `defaultRoles` does the equivalent for the Orchestration
Cluster, and note that it grants to `users` by the claim you mapped above,
and to `clients` by client ID — the same two-kinds-of-caller split again.

:::pointingDuck

`initialClaimValue` and `defaultRoles.admin.users` should name the **same
person**. They are two settings, but there is only one of you.

:::

Camunda's docs are explicit about this: the admin in the Orchestration
Cluster's default roles should match the value used for Management
Identity's initial claim, so that one human administers both systems.
Setting only one is the single most direct way to lock yourself out of half
of your deployment.

:::note

`initialClaimName` defaults to `oid`, which is an Entra-ism. For most
generic providers you will set it to `email` or `sub`.

More importantly: these values are read **only on first startup**. Once
Management Identity has written them to its database, changing them in Helm
does nothing. Getting this wrong means a database reset, not a
`helm upgrade`, so check it before the first install rather than after.

:::

## Step 5: Connectors

Connectors is the one component with no human in front of it. It is a
backend process that calls the Orchestration Cluster API on its own behalf,
which makes it the
[Client Credentials Grant](/posts/oauth-grant-types#client-credentials-grant)
from Part 5, in production:

```yaml
connectors:
  enabled: true
  security:
    authentication:
      method: oidc
      oidc:
        clientId: <orchestration-client-id>
        tokenScope: <scope-if-your-provider-needs-one>
        secret:
          existingSecret: oidc-credentials
          existingSecretKey: orchestration-client-secret
```

Notice what is absent: no `redirectUrl`, because nothing ever redirects,
and no user claim, because there is no user. Connectors authenticates with
its client ID and secret, gets a token, and calls the API. That is the
entire grant.

`tokenScope` exists because some providers will not issue a usable token
unless you ask for a specific scope — Entra wants `<app-id>/.default`.
Leave it empty if your provider does not need it.

For the Orchestration Cluster to accept those calls, the client has to hold
the `connectors` role, which is what the `defaultRoles.connectors.clients`
entry above was doing.

## Step 6: Turn Off What You Are Replacing

The last piece is easy to forget. If you are bringing your own provider,
the bundled Keycloak should not be running, and Management Identity needs
its own database now that it is not sharing Keycloak's:

```yaml
identityKeycloak:
  enabled: false

identity:
  enabled: true
  fullURL: <identity-base-url>

identityPostgresql:
  enabled: true
  auth:
    existingSecret: camunda-credentials
    secretKeys:
      adminPasswordKey: identity-postgresql-admin-password
      userPasswordKey: identity-postgresql-user-password
```

:::note

This catches people migrating from a Mode A install. In Mode A, Identity
leans on Keycloak's database. Turn Keycloak off without giving Identity a
database of its own and the pod will not start.

:::

## When It Does Not Work

Most failures here are one of a small number of things, and the error
messages are rarely pointed at the cause:

| Symptom                                      | Usual cause                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| Login page never loads                       | `authUrl` is not reachable from the browser.                                   |
| Pod logs show connection timeouts on startup | `issuerBackendUrl` / `jwksUrl` not reachable from inside the cluster.          |
| `redirect_uri_mismatch` from the provider    | `redirectUrl` does not exactly match the provider's registration.              |
| Login succeeds, then `401` from a component  | `audience` does not match what the provider puts in `aud`.                     |
| Login succeeds, but everything is forbidden  | `usernameClaim` points at a claim your tokens do not carry, so no rules match. |
| Locked out entirely after install            | `initialClaimValue` did not match anyone. Needs a DB reset.                    |

:::magnifyingglassme

When you are stuck, get a real token and decode it. Every one of the
mismatches above is visible in the token's claims, and the token is the one
artifact both sides agree on.

:::

:::tip

The chart is the most accurate documentation for its own version — every
parameter above carries an `@param` comment in the file:

```bash
helm show values camunda/camunda-platform --version 14.8.5 | less
```

:::

## Conclusion

Nothing in this values file is a Camunda invention. `authUrl` and
`tokenUrl` are the front and back channel. `jwksUrl` is where signing keys
come from. `audience` is the `aud` claim that stops tokens being replayed
between components. `redirectUrl` is a registered redirect URI. Connectors
is a Client Credentials grant. `usernameClaim` is the question of which
claim identifies a person, which the ID Token spent a whole post being
careful about.

If the parameters felt arbitrary before, that is usually not a Helm
problem. It is the protocol showing through a configuration file — and it
is much easier to configure something you can already picture.

:::proudDuck

You configured it, and you know why each line is there.

:::

---
title: "The Two Identity Systems in Camunda 8"
published: 2026-09-17
draft: false
description:
  "Camunda Self-Managed splits identity into Management Identity and
  Orchestration Cluster Admin. Knowing which governs what is the difference
  between an IdP that works and one that half works."
tags: ["Camunda", "Authentication"]
---

## Introduction

Here is a failure that is oddly specific, and oddly common. You connect
Camunda Self-Managed to your identity provider. You test it. You can log
into Console. Everything looks finished.

Then somebody tries to open Operate and cannot get in.

:::confusedDuck

Same deployment, same identity provider, same user. How does half of it log
in?

:::

:::me

Because it is not one system. Camunda Self-Managed has **two** identity
subsystems, they are configured separately, and you have just configured
one of them.

:::

This is not an obscure edge case. Camunda's own documentation calls it out
as "a common misconfiguration — connecting your identity provider to one
system but not the other, so some components authenticate while others
don't."

This post is about that split: what the two systems are, why there are two,
and which one owns what. It is the piece of background that makes a Camunda
`values.yaml` stop looking arbitrary, so it comes before
[wiring the Helm chart up to a provider](/posts/camunda-helm-oidc).

## The Split

```text
                     Your identity provider
                     (one IdP, two registrations)
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
      app registration 1                  app registration 2
              │                                   │
              ▼                                   ▼
   ┌──────────────────────┐        ┌────────────────────────────┐
   │  Management Identity │        │  Orchestration Cluster     │
   │  (separate service)  │        │  → Admin (built in)        │
   ├──────────────────────┤        ├────────────────────────────┤
   │  Console             │        │  Operate                   │
   │  Web Modeler         │        │  Tasklist                  │
   │  Optimize            │        │  Zeebe                     │
   │                      │        │  Orchestration Cluster API │
   └──────────────────────┘        └────────────────────────────┘
       management plane                  execution plane
```

:::paintingDuck

If you take one thing from this post, take that picture. Every confusing
thing below is a consequence of the two boxes.

:::

The dividing line is **management versus execution**:

|                             | Management Identity            | Admin                                 |
| --------------------------- | ------------------------------ | ------------------------------------- |
| Governs                     | Console, Web Modeler, Optimize | Operate, Tasklist, Zeebe, Cluster API |
| Ships as                    | A separate deployment          | Built into the Orchestration Cluster  |
| Scope                       | The whole installation         | Per cluster                           |
| Authorization model         | Role-based (RBAC)              | Fine-grained, per resource            |
| Default identity source     | Keycloak                       | Built-in user management              |
| Enabled by default in 8.8+? | No                             | Yes                                   |

That last row surprises people who upgrade. In 8.8 and later, the default
deployment is the Orchestration Cluster and Connectors. Console, Management
Identity, Web Modeler and Optimize all have to be turned on explicitly.

## Why There Are Two

It has not always been this way, and the history matters because most of
the confusing material you will find was written on one side of the change.

Before 8.8, there was one component called **Identity**, backed by Keycloak
and Postgres, and it managed access for everything — including Zeebe,
Operate and Tasklist. Every Self-Managed install carried Keycloak and a
database whether it wanted them or not.

8.8 split that in two. The Orchestration Cluster took over its own
authentication and authorization, and the old component kept the management
tools and was renamed **Management Identity**.

:::pointingDuck

The upshot: an Orchestration Cluster no longer needs Keycloak, Postgres, or
Management Identity at all. Those are only needed for Console, Web Modeler
and Optimize.

:::

### A Note On The Names

The execution-side system has been called three things in about two years,
and you will meet all three:

| Name                           | Where you will see it                                            |
| ------------------------------ | ---------------------------------------------------------------- |
| Identity                       | Pre-8.8 docs, and confusingly also the _other_ system's old name |
| Orchestration Cluster Identity | 8.8 docs and release notes                                       |
| **Admin**                      | 8.9 onward — the current name                                    |

:::facepalmDuck

So "Identity" can mean either subsystem depending on which page I landed
on.

:::

:::me

Yes, and that is most of why this is hard to research. A forum post from
early 2025 saying "configure Identity" may mean either one. The reliable
tell is _what it governs_: if the sentence is about Operate, Tasklist or
Zeebe, it means Admin. If it is about Console, Web Modeler or Optimize, it
means Management Identity.

:::

The Helm chart carries the rename too — `orchestration.profiles.identity`
is deprecated in favour of `orchestration.profiles.admin`.

## Two Systems Means Two Registrations

The practical consequence, and the one that causes the half-working login:
**each subsystem is a separate OAuth client and needs its own registration
in your provider.**

That is not a quirk. It is the same reasoning from
[Part 4 of the OAuth series](/posts/oauth-authorization-server#client-registration):
a client registration carries its own credentials, redirect URI and
audience. Management Identity and the Orchestration Cluster live at
different URLs, are reachable independently, and should be revocable
independently.

:::armsCrossedDuck

I manage users in one place. Why should I have to register two applications
for one product?

:::

:::me

You still manage users in one place — the IdP. What is doubled is the
_application registration_, not the user directory. Both subsystems point
at the same IdP and the same people; each just needs its own client
identity to authenticate as. One user directory, two relying parties.

:::

Camunda's docs recommend doing them in a fixed order, and it is worth
following because it fails loudly rather than subtly:

1. **Management Identity first.** Verify you can log into Console.
2. **Admin second.** Verify you can log into Operate and Tasklist.

If you configure both at once and something is wrong, you cannot tell which
half broke.

## Who Owns What

Once you are on OIDC, entities are split across the IdP and Camunda, and
knowing which is which saves a lot of hunting through UIs.

| Entity         | Managed in                              |
| -------------- | --------------------------------------- |
| Users          | Your identity provider                  |
| Clients        | Your identity provider                  |
| Groups         | Your identity provider (or the cluster) |
| Roles          | Camunda                                 |
| Authorizations | Camunda                                 |
| Tenants        | Camunda                                 |
| Mapping rules  | Camunda                                 |

The rule of thumb: **the IdP owns who exists, Camunda owns what they may
do.**

:::suspiciousDuck

If users are not stored in Camunda, what happens when I go looking for a
user in the Admin UI to grant them something?

:::

:::me

You will not find them, and that is expected rather than broken. With OIDC,
user information is not stored in the Orchestration Cluster, so user
search, user validation when assigning authorizations, and user management
are all unavailable in the Admin UI. You grant access to a claim value, not
to a row Camunda holds.

:::

That is the mental shift OIDC demands here. There is no user list. There is
a stream of tokens with claims in them, and rules that say what a token
carrying a particular claim is allowed to do.

## Mapping Rules

Which is exactly what a **mapping rule** is: the bridge from a claim in a
JWT to something Camunda understands.

A rule is two fields:

- **Claim name** — a claim in the access token, or a JSONPath expression
  for a nested one.
- **Claim value** — the value that has to be present for the rule to match.

Then you assign the rule to a role, group, tenant or authorization.

Given a token like this:

```json
{
  "sub": "1234567890",
  "name": "John Doe",
  "isAdmin": true,
  "orggroups": ["acct", "finance"],
  "iat": 1516239022
}
```

a rule with claim name `isAdmin` and claim value `true`, assigned to the
`admin` role, makes every user holding that claim an admin. A rule on
`orggroups` with value `acct` can put everyone in that organizational group
into a Camunda group.

:::magnifyingglassme

This is the direct payoff from
[Part 6](/posts/oauth-token-types#what-is-inside-the-payload). A mapping
rule is a predicate over the claims in a decoded access token — so the
first step in writing one is always to get a real token from your provider
and look inside it. You cannot write rules against claims you have not
seen.

:::

Both subsystems have mapping rules, and they are not equally powerful:

|                            | Management Identity | Admin                                  |
| -------------------------- | ------------------- | -------------------------------------- |
| Can assign                 | Roles, tenants      | Roles, groups, tenants, authorizations |
| Available with basic auth? | n/a                 | No — OIDC only                         |

:::note

Mapping rules only exist under OIDC. With basic authentication the
Orchestration Cluster manages its own users and groups directly, and there
are no tokens to write rules about.

:::

### Bringing Your Own Groups

If your IdP already knows who is in which group, the Orchestration Cluster
can read them straight out of the token rather than making you re-model
them as mapping rules. Point `groupsClaim` at the claim holding them and
its values are treated as Camunda group IDs.

The claim has to be a JSON array of strings, and the match is exact and
case-sensitive — Camunda treats group IDs as opaque strings, so `Finance`
and `finance` are two different groups.

## Bootstrapping, Twice

Now the thing that looks so strange in a values file. Each subsystem has a
cold-start problem — permissions live inside it, but nobody has any yet —
and each solves it its own way.

**Management Identity** takes an initial claim name and value. On first
startup it creates a `Default` mapping rule from them, and whoever presents
a token carrying that claim gets in.

**Admin** takes a list of users for its default roles, matched against the
username claim you configured.

:::sweatingDuck

Two bootstraps. So I can absolutely give myself admin on one and lock
myself out of the other.

:::

:::me

Easily, and it is the standard way to end up half-configured. Camunda's
docs are explicit that the admin user in the Orchestration Cluster's
default roles should be **the same value** you used for Management
Identity's initial claim, so that one person administers both.

:::

:::note

Management Identity reads its initial claim **only on first startup**.
After that the value is in its database and changing your configuration
does nothing. Getting this wrong is a database reset, not a redeploy — so
decide the value before the first install.

:::

## Do You Need Both?

Not necessarily, and this is the cheapest simplification available.

| What you are running             | What to configure                                  |
| -------------------------------- | -------------------------------------------------- |
| Operate, Tasklist, Zeebe only    | **Admin only.** Skip Management Identity entirely. |
| Console, Web Modeler or Optimize | Both.                                              |

If you are not running any of the management components, you do not need
Management Identity, Keycloak, or the Postgres that goes with them. That is
the whole point of the 8.8 split, and a lot of Self-Managed deployments can
take it.

:::thumbsUpDuck

Before configuring anything, write down which components you are actually
deploying. It decides how much of this you have to do.

:::

## How This Looks In Helm

The split is visible in the shape of the values file, once you know to look
for it. Two subsystems, two places:

```yaml
global:
  identity:
    auth:
      # Management Identity, and the components it governs
      identity: { ... }
      console: { ... }
      webModeler: { ... }
      optimize: { ... }

orchestration:
  security:
    authentication:
      # Admin — the Orchestration Cluster's own identity
      oidc: { ... }
```

Everything under `global.identity.auth` configures the management plane.
Everything under `orchestration.security.authentication` configures the
execution plane. They take similar-looking keys because both are OIDC
clients, and they are separate because they are separate systems.

:::surprisedDuck

The two top-level blocks are the two boxes from the diagram.

:::

That is the whole reason the layout is what it is — and it is where
[the next post](/posts/camunda-helm-oidc) picks up, parameter by parameter.

## Conclusion

Camunda Self-Managed splits identity along the line between managing
processes and running them. **Management Identity** covers Console, Web
Modeler and Optimize. **Admin**, built into the Orchestration Cluster,
covers Operate, Tasklist, Zeebe and the cluster API. They were one
component before 8.8, which is why so much of the surrounding material
disagrees with itself and why the same word means different things on
different pages.

Two systems means two client registrations, two bootstrap settings that
ought to name the same person, and two places in a values file. It also
means the IdP owns who exists while Camunda owns what they may do, with
mapping rules spanning the gap.

None of that is difficult once the picture is in your head. Almost all of
it is baffling without it — which is why it belongs before the YAML rather
than after.

:::proudDuck

Now the values file will read like a consequence instead of a list.

:::

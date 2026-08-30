---
title: "Meet the Ducks"
published: 2026-08-30
draft: false
description:
  "A reference for the cast that narrates this blog. Each duck explains, in
  its own words, what it means when it shows up."
tags: ["Meta", "Writing"]
---

## Why there is a duck

<!-- markdownlint-disable -->
<!-- prettier-ignore-start -->
:::wavingDuck
I open posts. That is my whole job, and I am doing it right now.
:::
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

There is an old debugging trick where you keep a rubber duck on your desk
and explain your problem to it, line by line, out loud. You almost never
finish. Somewhere around the third sentence you hear the flaw yourself, and
the duck takes no credit for it.

Long-form technical writing has the same shape. The hard part is not
explaining the thing — it is noticing the exact sentence where a reader
stops following, and answering _that_ instead of continuing.

So my posts have two speakers. A duck, who asks what you are probably
already thinking, and me, who has to answer it. In a post, that looks like
this:

<!-- markdownlint-disable -->
<!-- prettier-ignore-start -->
:::confusedDuck
Wait. Why does the client need the state parameter if the redirect URI
is already registered with the authorization server?
:::

:::me
Because the registered redirect URI proves *where* the response lands.
It says nothing about *who started the request*. Those are two different
guarantees, and CSRF lives in the gap between them.
:::
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

The duck's face tells you what kind of moment you are in before you read a
word of it. Below, each one says what it stands for.

## The ducks that ask

<!-- markdownlint-disable -->
<!-- prettier-ignore-start -->
:::confusedDuck
I turn up when something has not landed. If you see me, the paragraph
above me did not do its job, and what comes next is the second attempt.
Already following along? Skip ahead.
:::

:::suspiciousDuck
I understand the material fine. I have just spotted something that
smells wrong. When I speak, the answer is nearly always "yes, that is
exactly as bad as you think" — so slow down here.
:::

:::armsCrossedDuck
I am the one who disagrees with him. I exist so your objection gets
said out loud and answered properly instead of quietly avoided. If you
were about to argue with your screen, I am usually making your point.
:::

:::angryDuck
I only come out for things that deserve it — a useless error message, a
default that traps people. When I am here, the frustration is the
point, and he is not going to defend whatever caused it.
:::
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

## The ducks that react

<!-- markdownlint-disable -->
<!-- prettier-ignore-start -->
:::shockedDuck
I mean this is genuinely surprising and alarm is the correct response.
Some protocol behavior only makes sense once you accept that it really
does work that way.
:::

:::gaspDuck
I am the interruption. Where the shocked duck reacts to a design, I am
the moment a consequence lands before he has finished the sentence
explaining it.
:::

:::surprisedDuck
I am the good kind of surprise — the pieces just connected. Look for me
where something clicks, not where something breaks.
:::

:::coverEyesDuck
Whatever is next to me is deliberately bad. It is the naive or insecure
version, shown so you can recognise it. Do not copy it — the fixed one
is further down.
:::

:::facepalmDuck
I am the mistake everyone makes exactly once. Nothing next to me is a
judgment: if it has earned me, it has happened to him too.
:::

:::cryingDuck
I am debugging pain. Not a hard problem — a miserable one. The fix is
always closer than it feels.
:::

:::sweatingDuck
Same pain, except production is watching. I mark the failures that
happen under time pressure, where the order you do things in starts to
matter.
:::

:::tearDuck
I am disappointment rather than pain. Work that was correct and still
did not pay off. I usually turn up at the end of a story, not the
middle.
:::

:::giggleDuck
I am a joke and nothing more. Nothing beside me is load-bearing, so if
you are skimming for substance I am the safest thing here to skip.
:::

:::staringDuck
Sometimes the honest reaction to a piece of design is no reaction at
all. That is me.
:::
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

## The ducks for when it worked

<!-- markdownlint-disable -->
<!-- prettier-ignore-start -->
:::joyfulDuck
I am relief. The thing finally works, usually after a long build-up.
:::

:::proudDuck
I am not relief — I am earned competence. I show up where you have
built something that a more careless version of you would have broken.
:::

:::armsUpDuck
I am the big one. Save me for the end of an entire series or a build
that took several posts. If I am here, you have finished something.
:::
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

## The ducks that give a verdict

<!-- markdownlint-disable -->
<!-- prettier-ignore-start -->
:::thumbsUpDuck
Do this. I only ever summarise an argument made just above me, so if
you read the section, you already know why.
:::

:::thumbsDownDuck
Do not do this. Same rule: the reasoning is directly above me, never
hidden inside me.
:::

:::bothThumbsUpDuck
I am the strongest recommendation he makes, and I am rare on purpose.
One thumb is advice for the situation at hand. Two means it holds
almost everywhere, and he would push back on a review that skipped it.
:::
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

## The ducks that play a part

<!-- markdownlint-disable -->
<!-- prettier-ignore-start -->
:::attackerDuck
I am the attacker, in every walkthrough of an attack! In something like
CSRF there are four parties moving at once — I am how you keep track of
which one is hostile. heheee!
:::

:::readingDuck
When I speak, you are reading the specification word for word, not his
summary of it. Anything he is merely asserting comes from him instead.
:::

:::letterDuck
I carry whatever is in transit — a code, a token, a request. Which, it
turns out, is most of what OAuth actually is.
:::

:::pointingDuck
Look at the exact line I am pointing at. I only appear when a single
field in a URL, a config, or a payload is doing all of the work.
:::

:::wizardDuck
I mean something just got hand-waved. I am a promise, not a dodge:
whatever I wave at gets unwrapped before the section ends. If you are
unsure whether you missed a step, check whether I have been past.
:::

:::chefDuck
We are building something from an empty file. I open the practical
sections, the ones where a config or a manifest grows a piece at a
time. Have your editor open.
:::

:::paintingDuck
A diagram is doing the explaining here, not a paragraph. If you learn
better from pictures, find me first.
:::

:::cameraDuck
I am a snapshot of something real — a screenshot, or captured output.
This is how it actually looked on screen, not how he described it.
:::

:::eyesDuck
Keep watching something while the walkthrough moves on. Logs, metrics,
a resource changing state. I ask you to hold one eye somewhere else.
:::
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

## The ducks for broken and waiting

<!-- markdownlint-disable -->
<!-- prettier-ignore-start -->
:::sickDuck
I am an unhealthy workload. Failing probes, crash loops, a service that
is up but not well.
:::

:::sleepingDuck
I am idle, blocked, or timing out. Anything where the problem is that
nothing is happening at all.
:::

:::nurseDuck
I am the remedy for whatever just broke. I follow the sick duck almost
everywhere I appear, so if you have found the failure, look for me
below it.
:::
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

## And me

<!-- markdownlint-disable -->
<!-- prettier-ignore-start -->
:::me
I am the one answering. Most explanations on this blog come from here.
:::

:::magnifyingglassme
I am here for close inspection — pulling a token or a request apart
field by field, until there is nothing left to be vague about.
:::

:::equationme
I handle the genuinely mathematical parts, like what S256 actually does
to a code verifier.
:::

:::strongme
I mean hardening. Sections where the whole point is making something
harder to break.
:::
<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

## One promise

Nothing important lives only in a duck.

People skim, and speech bubbles are the first thing skipped. So no fact you
need appears solely inside one — if it matters, it is in the prose too.
Read the ducks for the shape of the thing, and the paragraphs for the
substance.

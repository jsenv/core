---
name: performance
description: How a report that something is slow (a lag after a press, a frozen frame, a long task) is measured before anything is changed, and how a change is proved faster — in the app the report came from, built from the working tree, against the state before, with the one change isolated, over interleaved runs. Use before building a fix a performance report proposes, and before claiming that a change made something faster.
---

# What we want, before how

A performance change is proved **in the app the report came from, built from
the working tree, against the state before it, with that one change isolated,
over runs taken in alternation** — never argued from the code, never read off
one run.

Three reasons, each met the hard way:

- **A report's diagnosis is a hypothesis**, however precise its trace. One
  report was right about the forced restyles in the click and right about the
  focus hand-back; its proposal to "warm the transition at the press" had
  nothing to warm; and the restyle it called "needed" turned out to be one CSS
  rule written for text highlights, nowhere near the code under suspicion.
- **The prize is measured before the work.** Two proposals of the same size
  can be worth 20 ms and nothing. Build the cheapest experiment that shows how
  much a change can win — a patch of the served bundle, a stylesheet disabled
  from the console — before designing it for real.
- **Noise is larger than most effects.** Two series taken minutes apart on the
  same build differ by more than a 15 ms fix, and a single run says nothing
  either way. Only runs taken in alternation compare.

And one reason a faster version is not automatically a good one: **it must
still do the same thing.** A change that makes something cheaper by keeping
something alive, deferring it, or skipping it changes what else can see it
(see "Check that it still does the same thing").

## How

### Reproduce where it was reported

- **In the app, built from the working tree, without touching the app.** Build
  the package into a scratch directory (a package build writes its
  `package.json` `"sideEffects"` from where it wrote the build: back the file up
  and put it back), then build the app with a jsenv plugin whose
  `redirectReference` sends the package's `dist` entry to that scratch build,
  serve the result statically, and stub its API in Playwright. Build both the
  published version and the working tree the same way: the only difference
  between two builds must be the code under test.
- **At full speed and throttled** (`Emulation.setCPUThrottlingRate`, 4× to 6×):
  what is noise at 1× decides how it feels on a phone.
- **Press like a finger.** Playwright's `touchscreen.tap` holds for ~4 ms; a
  real tap holds ~100 ms. Anything that is supposed to happen during the press
  needs a real hold (`Input.dispatchTouchEvent` start, wait, end).
- Unminified builds: a profile is read by function name.

### Measure what the user waits for

- **From the press to the first frame that shows the change**: a
  `requestAnimationFrame` loop labelling each frame with what is on screen,
  started before the press. It waits for the main thread; a movement played on
  the compositor may already be on screen — see the animations skill for what
  the main thread cannot tell.
- **The task of the press itself** (Event Timing, or the trace's
  `EventDispatch`): what the finger waits for before anything can paint.
- **Restyles**: every `UpdateLayoutTree` trace event carries `elementCount`.
  One close to the size of the document is a whole-document restyle; its stack
  says whether JS forced it (and which read) or a frame did.

### Compare in alternation, and isolate one change

- **Alternate the variants one run at a time**, 5 to 7 rounds at least, more
  when the spreads overlap. Report medians with the spread, never a single
  number.
- **Isolate a change by removing it from the same build** — rewrite its line in
  the served bundle (Playwright `page.route`) — rather than comparing two builds
  or stashing work: what is measured is then the one thing in doubt and nothing
  else. A change bundled with others is only credited once it is shown alone.

### Find out what a cost is made of

- **A CPU profile, sliced by time after the press**, and the stacks under what
  is hot: who calls it tells more than its self time. A render at the top of a
  stack with no caller of the app's own is the render queue flushing — the
  question is then who queued it.
- **Who queued a render**: in the served bundle, wrap preact's render hook to
  count the components rendered in a time window, and
  `Component.prototype.setState` to record who got queued, with
  `new Error().stack`. A render nobody should do shows who asked for it.
- **A whole-document restyle**: record the trace with the
  `disabled-by-default-devtools.timeline.invalidationTracking` category for the
  reason Chrome gives; then bisect — turn the page's stylesheets off one at a
  time (`sheet.disabled`, `document.adoptedStyleSheets`), then the rules of the
  one that matters — and confirm the culprit in a bare page, where it is the
  only thing left.

### Check that it still does the same thing

A change that makes something cheaper by keeping something alive, deferring
it, or skipping it changes what else can see it: a page kept mounted still
fills its slots, still registers its title, still re-renders on the address.
Read what defines the result, before and after:

- the DOM once everything has settled (what is left behind, what is open,
  what holds the focus, where the scroll is when coming back);
- a movement's pseudo-elements with the animations pinned (see "Verifying" in
  the animations skill), in Chrome and in WebKit;
- the tests of the code's consumers (see
  [.agents/instructions.md](../../instructions.md#constraints) — for a router,
  the integration tests that navigate, not the router's unit tests).

## Reference

- The route transition pass of 2026-09-29 (from navi 0.29.412), on wematch: a press on a link inside a callout, a slide-x to a profile, a list of
  30 cards. What it found is written where it applies —
  [route_transitions.md](../../../packages/frontend/navi/docs/route_transitions.md#what-a-transition-costs),
  [view_transitions.md](../../../packages/frontend/navi/docs/view_transitions.md#what-makes-a-transition-restyle-the-whole-document) —
  and the harness it used had four parts worth rebuilding the same way: an API
  stub per endpoint the page reads, a warm-up navigation (so first-transition
  costs do not pollute every run), a frame-labelling rAF loop, and trace/profile
  collection over a fixed window after the click.

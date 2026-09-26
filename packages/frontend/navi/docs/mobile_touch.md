# What a mobile browser does with a touch

A finger on a touchscreen is read twice. The page reads it through pointer and
touch events. The browser reads it too, because it wants it for its own
answers: a pan (scrolling, the back swipe), a zoom, and a tap (the click). Any
gesture navi reads from a finger — a travel, a swipe, something carried, a
wheel spun — is a negotiation with those answers. The browser's terms are
fixed, they differ between engines, and **none of them shows with a mouse**. A
gesture can pass a whole session of desktop testing and still fail one swipe
in three on a phone.

What follows is measured, not remembered: Chromium 153 through its mobile touch
emulator, and Safari on the iOS 26.5 simulator driven with real touches (see
[Verifying without a device](#verifying-without-a-device)). When an engine
changes, measure again before trusting a number here.

- [The browser decides about 8px in, and does not wait](#the-browser-decides-about-8px-in-and-does-not-wait)
- [touch-action stops at the first scroller](#touch-action-stops-at-the-first-scroller)
- [Only the start is contested](#only-the-start-is-contested)
- [The click is the browser's call as much as ours](#the-click-is-the-browsers-call-as-much-as-ours)
- [A tap dropped after a touch drag](#a-tap-dropped-after-a-touch-drag)
- [A finger never makes a wheel event](#a-finger-never-makes-a-wheel-event)
- [Verifying without a device](#verifying-without-a-device)

## The browser decides about 8px in, and does not wait

Where the browser may pan — the direction is allowed by `touch-action` — it
**commits the touch to its own pan after about 8px of movement**. From then on,
refusing a `touchmove` changes nothing. The pointer stream gets a
`pointercancel`, and the gesture the page was reading is dead: the swipe does
nothing, or a travel that had already started goes back.

The two engines reach that moment differently:

- **Chrome** does not send a `touchmove` inside its slop: 8px with the mobile
  configuration, 15px on a desktop touchscreen. It still sends the
  `pointermove`s. The first `touchmove` it sends IS its decision. Refuse that
  one, and the page keeps the whole touch: no scroll for its whole length, and
  every later `touchmove` stays cancelable. Leave it alone, and Chrome pans if
  `touch-action` allows the direction. Chrome reads that direction evenly: a
  start with `|dy| ≥ |dx|` is vertical. From then on every `touchmove` arrives
  `cancelable: false`.
- **Safari** sends `touchmove`s from the first pixel, all cancelable. Refusing
  them from any point before about 9px keeps the whole touch for the page, and
  so does refusing the first one alone: native scrolling never starts, even
  when the later ones are left alone. If the one at about 9px goes unrefused,
  Safari pans. It does not wait for the page's
  answer to a report that jumps over that distance in one go: after a small
  unrefused report, a report that jumps past 9px is already too late.

So **a gesture that shares a surface with the page's pan has to read its
intent before about 8px**, and measure it as a distance (`Math.hypot`), not per
axis: the browser measures its slop as a distance, and a per-axis threshold is
up to 1.4 times later on a diagonal. Waiting for more evidence is not
available, because whatever is read after the browser's moment is read about
a pointer that has already been cancelled. The travel reads a finger's intent
at 6px for exactly this reason (`DRAG_START_THRESHOLD_TOUCH` in
`@jsenv/dom`'s `drag_to_travel.js`). Its bias toward the box's own axis only
means something because it is read before the browser reads the same pixels
evenly.

Whether a `touchmove` can be refused at all is settled even earlier, when the
finger lands: a non-passive listener must already be on the touch's path (see
`keepTouchRefusable`, and
[drag_to_travel.md](./drag_to_travel.md#on-a-touchscreen-the-browser-takes-the-gesture-unless-it-is-refused)).
Being refusable is decided at the touchstart; being refused, before 8px.

## touch-action stops at the first scroller

The `touch-action` in effect under a finger is the intersection of the values
from the touched element up to its **nearest scroll container** (an element
with `overflow: auto | scroll`). At that container it starts again from `auto`.
That is the Pointer Events spec, and Blink and WebKit both do it. So
`touch-action: pan-y` on a box that travels sideways says nothing about a slide
inside it with `overflow="auto"`, nor about a `List` or a scrolling body: under
the finger there, every direction is open again.

The engines do not use that opening the same way:

- **Chrome** pans in any direction there, **even one in which nothing can
  scroll**, and cancels the pointer. A sideways swipe over a slide that only
  scrolls vertically is taken by Chrome for a sideways pan of nothing.
- **Safari** does not pan a scroller sideways when it cannot scroll sideways:
  the same swipe stays the page's.

So `touch-action` on a box is not what protects a gesture over content that
scrolls; reading the intent before the browser does is. It covers this case
with no rule on the scrollers — which matters, because restating the box's
`touch-action` on them would take the finger scroll away from a row that
scrolls sideways inside a slide.

## Only the start is contested

Once the browser has let a touch go, a later change of direction does not bring
it back:

- On Chrome, a start that its even reading calls horizontal, over `pan-y`,
  drops Chrome's scroll for the whole touch. The thumb can bend vertical halfway
  through and nothing scrolls, whether or not the later `touchmove`s are
  refused.
- On Safari, once a `touchmove` has been refused, a later vertical bend starts
  no native scroll either.

A gesture that has won the start keeps the touch. What loses gestures is the
first ~8px.

## The click is the browser's call as much as ours

- **Chrome** clicks after a touch that moved up to 8px and never beyond, whether
  or not its `touchmove`s were refused.
- **Safari** does not click at all once a `touchmove` has been refused, even
  after 6px. A touch that was never refused still clicks: an unrefused sideways
  movement over `pan-y` clicks even after 20px.

A gesture that reads its intent early therefore costs the click of a tap that
shook more than its threshold. Safari drops that click on its own, and on
Chrome the gesture's click suppression swallows it up to 8px. That is the price
of the deadline above, paid by the sloppiest taps only. Beyond the browser's
own slop there was never a click to lose.

## A tap dropped after a touch drag

On Chrome for Android, the tap that follows a finger-driven drag does not fire
its `click` when it comes quickly: `pointerdown` and `pointerup` arrive, the
synthesized `click` (and the `mousedown`/`mouseup` compat events) does not. Wait
about half a second and the same tap works. It is what makes a wheel feel
broken — spin it, tap "Définir" at once, and the command never runs.

It is the browser's, not ours: a bare `div` moved by hand under `pointermove`,
with no framework, reproduces it. An un-prevented touch drag feeds Chromium's
gesture recognizer, which then treats the next tap as not clean enough to be a
click. `touch-action` changes nothing (`none`, `manipulation`, `pan-y` all drop
it), `preventDefault()` on the pointer events changes nothing either — only
`preventDefault()` on the **touch** events, `touchstart` or `touchmove`, keeps
the following click alive. A native scroll owned by the browser leaves it alive
too, which is no help to a surface moved by JS.

So a surface that moves under a finger by JS refuses `touchmove` while a drag is
active, from a non-passive listener. `touchmove` rather than `touchstart`: the
move is the event whose default the drag actually owns, and preventing
`touchstart` also suppresses the surface's own focus and synthesized events.

```js
const onTouchMove = (e) => {
  if (drag) {
    e.preventDefault();
  }
};
viewport.addEventListener("touchmove", onTouchMove, { passive: false });
```

Two theories were tried first and disproven on the device, so they are not
worth trying again: pointer capture on touch, and a momentum re-render moving
the element under the tap.

Reference: `onTouchMove` in `src/control/wheel/wheel.jsx`; the reductions, one
variable per row, in `src/control/demos/lab/` (`tap_after_drag_experiment.html`,
`surface_css_matrix_experiment.html`, `preventdefault_matrix_experiment.html`);
Chromium's `gesture_provider.cc` (`ignore_single_tap_`, reset on the next down)
and `tap_suppression_controller.cc` (the tap that stops a fling, 180ms) for the
two mechanisms that do NOT explain it.

## A finger never makes a wheel event

No mobile browser turns a touch into `wheel` events: those come from a mouse
wheel or a trackpad, including a trackpad on an iPad. When a gesture works with
the wheel and fails under a finger, the wheel path is not the suspect. The two
paths differ in timing: a wheel gesture is claimed and refused on its very first
event, so the browser never gets a moment to decide, while a finger has to
travel a few pixels before anything can be read.

## Verifying without a device

Both engines can show the browser's own answers — the pan, the
`pointercancel`, the click withheld — without a phone. Only through the paths
below, though: the obvious ones hide the race.

**Chrome**: drive DevTools' touch emulator, which goes through Chrome's
gesture detector with the **mobile** configuration (8px slop):

- a headed Chromium (`chromium.launch({ headless: false })`) — headless
  delivers nothing through this path;
- on a CDP session, `Emulation.setEmitTouchEventsForMouse({ enabled: true,
configuration: "mobile" })`, then `Input.dispatchMouseEvent` with
  `mousePressed` / `mouseMoved` / `mouseReleased` (`buttons: 1` while down). The
  page receives real touches and pointer events of type `touch`;
- those calls are **never acknowledged**: send them without awaiting, with a
  sleep between moves (~16ms is a frame).

`Input.dispatchTouchEvent` — what Playwright's `touchscreen` uses — goes
through the desktop configuration instead: a 15px slop. Anything deciding at
10px wins there, and the race that loses swipes on a phone is invisible.

**Safari**: the iOS simulator, driven by `safaridriver`, which turns W3C touch
actions into real UIKit touches — Safari's own pan recognizers compete for
them exactly as on a phone:

- boot a simulator (`xcrun simctl boot <udid>`), start `safaridriver -p 4444`,
  and create a session with
  `{ platformName: "iOS", "safari:useSimulator": true, "safari:deviceUDID": "<udid>" }`;
- a pointer action source with `parameters: { pointerType: "touch" }`: a
  `pointerMove` with `origin: "viewport"`, a `pointerDown`, one `pointerMove`
  per frame (`duration: 16`), a `pointerUp` — then `DELETE /session/<id>/actions`,
  without which the `pointerup`, `touchend` and click are never delivered;
- **a native scroll hangs the actions call**, and every call after it. Treat the
  hang as the observation — "Safari took the touch" — put a timeout on every
  call, then recover with `xcrun simctl terminate <udid> com.apple.mobilesafari`
  and a restarted `safaridriver`. The page's `localStorage` does not survive
  that, so whatever must be read is read before the swipe.

What to synthesize is the hand's imperfection, as
[drag_to_travel.md](./drag_to_travel.md#verifying-a-gesture) says: a slow start
landing a report between 6 and 9px, steep first pixels, a report that jumps. What
to read: the `touchmove`s with `cancelable` and `defaultPrevented`, the
`pointercancel`, `scrollY`, and what the gesture itself says (for a travel,
`data-drag-travel-walking` on `:root` and the slide that ends up current).

What neither path shows: the lift of a real finger (the last reports before
`pointerup`), a real device's event timing (the order in which the browser's
cancel and the next report reach the page), a momentum tail killed by a landing
finger. Those remain device questions.

Reference: `src/layout/demos/lab/slide_container_touch_race.html` — a row of
slides that do not scroll and a row that do, for the two cases above.

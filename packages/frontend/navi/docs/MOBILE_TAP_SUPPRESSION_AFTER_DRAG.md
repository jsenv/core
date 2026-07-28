# Mobile tap suppression after a drag

## What happens

On **Chrome for Android**, after you drag on a surface with your finger, the
**next quick tap on any element does not fire a `click`**. The tap still produces
`pointerdown` and `pointerup` — only the browser-synthesized `click` (and the
`mousedown`/`mouseup` compat events) is silently dropped.

Observed on a real device:

```
# device: Chrome 150.0.0 · Android 10
[experiment] SURFACE pointerdown (id=2)
[experiment] SURFACE pointerup (id=2)
[experiment] TARGET pointerdown
[experiment] TARGET pointerup
                              ← no "TARGET click"
```

This is what makes the picker feel broken: drag the wheel, then quickly tap
**Définir** — the button gets `pointerdown`/`pointerup` but never `click`, so the
command never runs. Wait ~½ second and the same tap works fine.

## It is a browser behavior, not ours

The reproduction was reduced all the way down to a **bare div with no framework
at all** — no navi, no Preact, no momentum, no pointer capture, no
`preventDefault`:

```html
<div style="width:64px; height:160px; overflow:hidden; touch-action:none;">
  <div id="inner">▤▤▤▤▤</div>
</div>
<button id="target">Tap me</button>
```

```js
surface.addEventListener("pointerdown", (e) => (start = e.clientY));
surface.addEventListener("pointermove", (e) => {
  inner.style.transform = `translateY(${e.clientY - start}px)`;
});
// drag this, then quickly tap #target → its "click" never fires
```

Dragging this rectangle and then tapping the button reproduces the dropped
`click` exactly. So nothing in navi's wheel (its momentum, its synthetic `input`
events, its per-crossing re-render) is required — the browser suppresses the
click on its own.

Reproductions live in
[`src/control/demos/lab/`](../src/control/demos/lab/):

- [`tap_after_drag_experiment.html`](../src/control/demos/lab/tap_after_drag_experiment.html) —
  the minimal one-surface + one-button case above.
- [`surface_css_matrix_experiment.html`](../src/control/demos/lab/surface_css_matrix_experiment.html) —
  the same repro with one variable changed per row (`touch-action` values,
  `overflow`, movement on/off, `preventDefault`, pointer capture, touch events,
  and a real native-scroll control), each button flipping green (click fired) or
  red (suppressed), to isolate exactly which trait arms the suppression.

## Why the browser does it

Chromium has two distinct mechanisms that drop a tap's `click`. The subtle part:
**neither one cleanly explains the bare-surface repro**, which is the whole
reason it is worth documenting.

### 1. `ignore_single_tap_` — within one touch sequence

In [`ui/events/gesture_detection/gesture_provider.cc`](https://chromium.googlesource.com/chromium/src/+/HEAD/ui/events/gesture_detection/gesture_provider.cc),
once a scroll is recognized during a touch sequence, that sequence's
`GestureTap` (which becomes the synthesized `click`) is suppressed. **But this
flag resets on the next `DOWN`**, so it cannot reach across from the surface drag
to a *separate* tap on another element.

### 2. `TapSuppressionController` — the tap that stops a fling

In [`components/input/tap_suppression_controller.cc`](https://chromium.googlesource.com/chromium/src/+/HEAD/components/input/tap_suppression_controller.cc),
after a `GestureFlingCancel` (the user taps to stop an in-flight fling), taps are
suppressed for a window:

```
max_cancel_to_down_time = base::Milliseconds(180)
```

This matches the "~½ second and it works again" feel, **but it requires a real
fling** — and in the bare-surface repro **no scroll and no fling ever fire**
(`touch-action: none` means the browser never scrolls, and the `scroll` /
`touchcancel` / `gesturestart` probes stay silent).

### 3. Android's "click is a compatibility event" rule

Per the cross-browser touch-event notes, on **Android specifically**:

> `click` is a compatibility event, fired only for a _clean_ tap without too much
> movement; on Android, `touchmove` is effectively mutually exclusive with
> `click`.

Android is far more aggressive here than iOS or desktop. The bare-surface case
looks like a variant of this rule leaking across the very short gap between the
drag's release and the next tap. `touch-action: none` — which per spec should
cause a normal `click` on release — does **not** prevent it.

## Workarounds

The matrix experiment is what pins the exact trait to neutralize; until then, the
candidate fixes, in order of preference:

1. **Don't depend on the synthesized `click` for touch.** Treat a clean
   `pointerup` (`pointerType === "touch"`, no movement since `pointerdown`) as
   the activation, instead of waiting for `click`. This is the robust fix but
   must be scoped carefully — it was explicitly rejected as a blanket change for
   the wheel commit, so it belongs on the _target_ activation path, not the wheel.
2. **Insert a settle delay** so the tap lands outside the ~180ms window — only
   viable if the mechanism is genuinely time-boxed (the matrix ms-gap column
   confirms this).
3. **Stop the surface from looking like a drag to the browser** — if the matrix
   shows that _movement_ (the `transform` during `pointermove`) is the trigger
   rather than `touch-action`, moving the content a different way (or not at all
   on the final frame) may avoid arming the suppressor.

## Summary

| Mechanism                         | Scope                          | Window | Fires in our repro?               |
| --------------------------------- | ------------------------------ | ------ | --------------------------------- |
| `ignore_single_tap_`              | within one touch sequence      | n/a    | No — resets on the next `DOWN`    |
| `TapSuppressionController`        | the tap that stops a fling     | 180ms  | No — no scroll/fling occurs       |
| Android "click = clean-tap-only"  | touch → click compat synthesis | short  | Most likely — but spec says `touch-action:none` should exempt it |

The confirmed fact: **a bare `touch-action: none` draggable surface suppresses
the next quick tap's `click` on Chrome Android**, with no navi involved. The
matrix experiment isolates which trait arms it, which then selects the fix.

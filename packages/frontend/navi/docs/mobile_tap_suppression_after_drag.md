# A tap dropped after a touch drag

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

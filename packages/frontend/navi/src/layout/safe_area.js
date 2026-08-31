/**
 * The part of the window an app actually has, in two levels.
 *
 * Two, and not one, for a reason worth stating up front: a fixed bar is one of
 * the things that reduce the free region, so it cannot ALSO be placed against
 * that region — it would push itself off the edge it is pinned to. What is
 * anchored and what is anchored-inside are two different rectangles.
 *
 * 1. `--navi-app-inset-{top,right,bottom,left}` — from the window's edges to
 *    the app's own rectangle. Whatever is pinned to an edge (a fixed bar, a
 *    side panel, a popup aimed at a corner) is pinned to THAT, so an app
 *    pretending to be a 600px handheld inside a 1500px window stays one
 *    rectangle instead of a column with its furniture spread across the glass.
 *
 * 2. `--navi-safe-area-inset-{top,right,bottom,left}` — from the window's edges
 *    to the band left free INSIDE that rectangle. Whatever flows, scrolls, or
 *    gets painted keeps to it.
 *
 * Level 2 is a sum, and the contract for taking part in it is only "publish
 * what you take on one edge": the device's own notch (`env(safe-area-inset-*)`,
 * which is the browser's version of this very idea), the fixed bars
 * (fixed_bar_space.js), and anything an app adds. That is the point of naming
 * it at all — a component that must stay clear of what covers the screen reads
 * ONE set of numbers, and never has to learn what is covering it.
 *
 * `max()` between the notch and the bars rather than a sum: a bar pinned to an
 * edge already reaches under the notch and counts it in its own size (see
 * fixed_bar.jsx), so adding both would reserve it twice.
 *
 * Sizes only, not placement, for the time being — see "Current limitations" in
 * docs/css_architecture.md.
 */

const SAFE_AREA_CSS = /* css */ `
  /* Declared as lengths so that they COMPUTE to one: an unregistered custom
     property keeps the calc() it was written as, and the sum below is then a
     string no one can read back. Reading it off the computed style — which a
     route transition does, to keep the band the page being left had (see
     nav/transition_window.js) — only works for a registered property. */
  @property --navi-safe-area-inset-top {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }
  @property --navi-safe-area-inset-right {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }
  @property --navi-safe-area-inset-bottom {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }
  @property --navi-safe-area-inset-left {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }

  @layer navi {
    /* Layered whole, rules included: the two rules below are offers, not
       structure. [data-navi-safe-area] is an attribute the app puts on its own
       scroller, so the app's own padding on that element has to win over what
       navi suggests for it. */
    :root {
      /* The room each kind of furniture takes, declared here at zero and
         written by whoever takes it. A slot rather than a value: the sum below
         has to be readable whether or not the app ever mounts a fixed bar. */
      --navi-fixed-bar-space-top: 0px;
      --navi-fixed-bar-space-right: 0px;
      --navi-fixed-bar-space-bottom: 0px;
      --navi-fixed-bar-space-left: 0px;

      /* What the on-screen keyboard covers — and ONLY where it overlays the
         content rather than shrinking the viewport, which is navi's default
         wherever the browser has the VirtualKeyboard API (see
         layout/virtual_keyboard.js). Zero on Firefox/Safari, which have no
         such API, and zero for an app that called
         disableVirtualKeyboardOverlay(): both get a keyboard that shrinks the
         visual viewport instead, which --navi-vvh already tracks. Reading
         env() rather than a JS-written value keeps it live: the keyboard
         slides in over several frames and this follows it without a
         listener. */
      --navi-keyboard-inset-bottom: env(keyboard-inset-height, 0px);

      /* Level 1. Centered bands, so that declaring one ceiling
         (--navi-app-max-width) is all an app has to do to be a narrow screen in
         a wide window; an app that wants them uneven writes these directly. */
      --navi-app-inset-top: max(
        0px,
        (var(--navi-vvh) - var(--navi-app-max-height, var(--navi-vvh))) / 2
      );
      /* The keyboard on top of the band, and on this edge only: it eats into
         the app's own rectangle exactly like a viewport that shrank, which is
         what makes both paths end up at the same --navi-app-height (and so at
         the same dialog/popover ceiling). Not part of the centering, hence
         added here rather than folded into --navi-app-inset-top: a keyboard
         takes the bottom, it doesn't re-center anything. */
      --navi-app-inset-bottom: calc(
        var(--navi-app-inset-top) + var(--navi-keyboard-inset-bottom)
      );
      --navi-app-inset-left: max(
        0px,
        (var(--navi-vvw) - var(--navi-app-max-width, var(--navi-vvw))) / 2
      );
      --navi-app-inset-right: var(--navi-app-inset-left);

      /* Level 2. */
      --navi-safe-area-inset-top: calc(
        var(--navi-app-inset-top) +
          max(env(safe-area-inset-top), var(--navi-fixed-bar-space-top))
      );
      --navi-safe-area-inset-right: calc(
        var(--navi-app-inset-right) +
          max(env(safe-area-inset-right), var(--navi-fixed-bar-space-right))
      );
      --navi-safe-area-inset-bottom: calc(
        var(--navi-app-inset-bottom) +
          max(env(safe-area-inset-bottom), var(--navi-fixed-bar-space-bottom))
      );
      --navi-safe-area-inset-left: calc(
        var(--navi-app-inset-left) +
          max(env(safe-area-inset-left), var(--navi-fixed-bar-space-left))
      );

      /* The document is the scrollport in the common case, and something the
         browser scrolls to — an anchor, a focused field, a restored position —
         landing under a bar is never what anyone wants. */
      scroll-padding-top: var(--navi-safe-area-inset-top);
      scroll-padding-right: var(--navi-safe-area-inset-right);
      scroll-padding-bottom: var(--navi-safe-area-inset-bottom);
      scroll-padding-left: var(--navi-safe-area-inset-left);
    }

    /* Put this on whatever scrolls under the furniture.

       There are TWO rooms to give back, and forgetting the second one is the
       classic bug:

       - padding, so the end of the content can be scrolled out from under it.
         Without it the last screenful stays covered, unreachable.
       - scroll-padding, so anything the browser scrolls TO lands in front of it
         rather than under. The padding above does not help here: it moves the
         content, not the place the browser scrolls the target to.

       Marked by the app rather than picked by navi: which element scrolls is
       the app's business, and an app with more than one would have to fight a
       component that chose for it. An app is free to read the variables itself
       instead. */
    [data-navi-safe-area] {
      padding-top: var(--navi-safe-area-inset-top);
      padding-right: var(--navi-safe-area-inset-right);
      padding-bottom: var(--navi-safe-area-inset-bottom);
      padding-left: var(--navi-safe-area-inset-left);

      scroll-padding-top: var(--navi-safe-area-inset-top);
      scroll-padding-right: var(--navi-safe-area-inset-right);
      scroll-padding-bottom: var(--navi-safe-area-inset-bottom);
      scroll-padding-left: var(--navi-safe-area-inset-left);
    }
  }
`;
import.meta.css = SAFE_AREA_CSS;

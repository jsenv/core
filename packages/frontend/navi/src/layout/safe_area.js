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
 * Level 2 gathers what takes an edge: the device's own notch
 * (`env(safe-area-inset-*)`, which is the browser's version of this very idea)
 * and the fixed bars (fixed_bar_space.js, the one slot per edge — something
 * else covering an edge is published by being drawn as a FixedBar). That is
 * the point of naming it at all — a component that must stay clear of what
 * covers the screen reads ONE set of numbers, and never has to learn what is
 * covering it.
 *
 * `max()` between the notch and the bars rather than a sum: a bar pinned to an
 * edge already reaches under the notch and counts it in its own size (see
 * fixed_bar.jsx), so adding both would reserve it twice.
 *
 * JS placement answers to the level-1 rectangle too: getAppInsets
 * (layout/responsive.js) reads these same bands back off the computed style,
 * and hands them to pickPositionRelativeTo via setPlacementViewportInsets (see
 * navi_css_vars.js).
 */

const SAFE_AREA_CSS = /* css */ `
  /* Declared as lengths so that they COMPUTE to one: an unregistered custom
     property keeps the calc() it was written as, and the sums below are then
     strings no one can read back. Reading them off the computed style only
     works for a registered property, and both levels are read there: level 1
     by popup placement, which must keep to the same rectangle as the CSS
     whether the bands are centered or written by the app (getAppInsets in
     layout/responsive.js); level 2 by a route transition, to keep the band the
     page being left had (nav/transition_window.js). The keyboard's strip
     allowance is read by the reveal of the focused field
     (layout/virtual_keyboard.js). */
  @property --navi-app-inset-top {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }
  @property --navi-app-inset-right {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }
  @property --navi-app-inset-bottom {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }
  @property --navi-app-inset-left {
    syntax: "<length>";
    inherits: true;
    initial-value: 0px;
  }
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
  @property --navi-keyboard-strip-allowance {
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
      /* What Chrome paints right above the keyboard without counting it in
         the keyboard's geometry: the autofill/suggestion strip, which neither
         env(keyboard-inset-height) nor geometrychange reports (see
         window_size.js in @jsenv/dom). 49–64px measured on Android 10 /
         Chrome 153; 0 while no keyboard is up.

         Kept out of --navi-keyboard-inset-bottom: the strip is not always
         there, and whatever sits against the keyboard (a fixed bar, a popup)
         would float above it with a gap when it is missing. Only the room to
         scroll into and the reveal of the focused field take it, where an
         excess costs nothing. */
      --navi-keyboard-strip-allowance: min(
        var(--navi-keyboard-inset-bottom),
        64px
      );

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
      padding-bottom: calc(
        var(--navi-safe-area-inset-bottom) +
          var(--navi-keyboard-strip-allowance)
      );
      padding-left: var(--navi-safe-area-inset-left);

      scroll-padding-top: var(--navi-safe-area-inset-top);
      scroll-padding-right: var(--navi-safe-area-inset-right);
      scroll-padding-bottom: var(--navi-safe-area-inset-bottom);
      scroll-padding-left: var(--navi-safe-area-inset-left);
    }

    /* The keyboard's room, for a page that marked nothing: the document is
       then what scrolls under the keyboard, and a field near its end needs as
       much room below it as the keyboard and its strip are tall to be brought
       out from under them (layout/virtual_keyboard.js). Unlike the bars, this
       is owed without the app asking: the keyboard only covers the page
       because navi made it overlay. A marked element already gives that room
       in its padding-bottom, hence the :has().

       A pseudo-element rather than a padding on :root, which the common reset
       zeroing html's padding would take away. */
    :root:not(:has([data-navi-safe-area]))::after {
      display: block;
      height: calc(
        var(--navi-keyboard-inset-bottom) + var(--navi-keyboard-strip-allowance)
      );
      content: "";
    }
  }
`;
import.meta.css = SAFE_AREA_CSS;

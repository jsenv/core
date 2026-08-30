/**
 * How two routes move against each other, said one relation at a time —
 * without putting them in a row, and without a box in the tree.
 *
 * A page one goes INTO (a game, a profile, a place) is entered from wherever
 * one opened it, and left back out the same way. That is a fact about a PAIR
 * of pages, and only about the pairs it is written for:
 *
 *   defineRouteTransition(MY_GAMES_PAGE, GAME_PAGE, "slide-x");
 *   defineRouteTransition(RADAR_PAGE, GAME_PAGE, "slide-x");
 *
 * Going from the first page to the second plays forward, the reverse plays
 * back, and two pages never written in the same relation play nothing between
 * each other — two tabs of a bottom bar are side by side, neither is before
 * the other, and being animated by the same mechanism does not order them.
 * This is what tells this apart from <RouteTravel>: a travel box is a ROW — a
 * total order, plus a drag gesture that walks it — while this declares
 * individual relations and nothing else.
 *
 * A relation is reciprocal by DEFAULT, not by decree: the way back is the same
 * movement run the other way, because that is what lets a user build a map of
 * the app — but a relation written for the exact way travelled wins over being
 * the reverse of another, so B → A can be given a movement of its own, or
 * silenced with "none", by writing it (see findRelation).
 *
 * The relation says WHEN something plays and which way; the transition says
 * WHAT plays — a movement navi ships, or a name the application defines in its
 * own CSS (see the JSDoc below). Said without one, the relation plays the
 * browser's cross-fade.
 *
 * A relation holds for every way of reaching a page, and one navigation may
 * know better: the rare way round a pair — a badge that jumps back OUT to the
 * game it belongs to, a card that leads to the player it describes — is walked
 * against the map, and there is no telling it from the common way by the
 * routes alone. So the navigation itself may ask for something: a `<Link
 * routeTransition>`, or navTo(url, { routeTransition }). What it asks holds
 * for THAT
 * navigation and no other, and only for the fields it names — `{ direction:
 * "back" }` keeps the pair's movement and turns it round (see
 * readNavigationRequest). A pair no relation was ever written for animates the
 * same way, for the one press that asks.
 *
 * There is no box in the tree: by default what animates is the document itself
 * (its `root` view transition group), which is right for pages that ARE the
 * whole viewport. An application whose pages live between fixed bars marks the
 * region they live in with `data-navi-route-transition-area` — one attribute
 * on an element it already has — and the movement then plays on that region's
 * own pictures, clipped at its bounds, while the bars simply never move (see
 * TRANSITION_AREA_ATTRIBUTE for why the root pictures cannot do this job).
 *
 * The URL leads and the picture follows, as everywhere in navi: the change is
 * a navigation somebody else started (a <Link>, the back button), this only
 * watches it land and photographs the page being left in time (see
 * rendering_hold.js for how the picture is kept honest). A browser without
 * view transitions navigates without the movement.
 *
 * However many relations are defined, there is ONE watcher: every definition
 * lands in a shared registry, and the watcher is rebuilt over the whole of it
 * — a navigation is a single fact about the document, and the first relation
 * that speaks about it answers for it.
 */

import { computed } from "@preact/signals";

import {
  observeAfterRouting,
  observeBeforeRouting,
} from "./browser_integration/before_routing.js";
import { Box } from "../box/box.jsx";
import { observeRouteRender } from "./route.jsx";
import {
  holdRenderingForRouting,
  releaseRoutingRenderingHold,
  takeoverRoutingRenderingHold,
} from "./rendering_hold.js";
import {
  holdTransitionDestination,
  releaseTransitionDestination,
} from "./transition_destination.js";
import {
  FURNITURE_NAME_PREFIX,
  nameTransitionFurniture,
  releaseTransitionFurniture,
} from "./transition_furniture.js";
import {
  holdTransitionWindow,
  measureTransitionWindowState,
  releaseTransitionWindow,
  TRANSITION_WINDOW_CSS,
} from "./transition_window.js";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { ensureDocumentStartViewTransition } from "../transition/start_view_transition_polyfill.js";

const startViewTransition = ensureDocumentStartViewTransition();

const TRANSITION_ATTRIBUTE = "data-navi-route-transition";
const TRANSITION_TYPE_ATTRIBUTE = "data-navi-route-transition-type";
const TRANSITION_DURATION_PROPERTY = "--navi-route-transition-duration";
// What the movement is played on. The root snapshot spans the viewport, and
// the regions of elements captured on their own (a named bar) are BLANK in it
// — a page sliding vertically then drags a blank band across the screen where
// the top bar was. An application with fixed bars therefore marks the region
// its pages live in with this attribute: the marked element is captured on its
// own, the movement plays on ITS pictures, clipped at its bounds, and the bars
// simply never move. Without the mark the document itself travels, which is
// right for a page that IS the whole viewport.
const TRANSITION_AREA_ATTRIBUTE = "data-navi-route-transition-area";
const TRANSITION_TARGET_ATTRIBUTE = "data-navi-route-transition-target";
// What ONE navigation asks for, over whatever the relations say: worn by the
// link being pressed (see <Link routeTransition>), or handed to navTo(). It answers
// for that navigation and for no other — the next one is back to the relations.
const TRANSITION_REQUEST_ATTRIBUTE = "data-navi-route-transition-request";
const AREA_NAME = "navi-route-transition";
// route_travel.jsx wears this on the root for the length of one of its
// travels (its TRAVEL_ATTRIBUTE — a comment there mirrors this one). Read by
// name rather than imported: importing route_travel.jsx would pull the whole
// travel machinery into an application that only defines transitions.
const ROUTE_TRAVEL_ATTRIBUTE = "data-navi-route-travel";

// The same movements, written once and played on either target: the document,
// or the marked area. The guard keeps the two exclusive — with an area marked,
// the root pictures must NOT move (they carry the whole viewport, blank bands
// included).

const css = /* css */ `
  ${TRANSITION_WINDOW_CSS}

  /* The marked region is a picture of its own for the length of a transition of
     OURS, and only then — the name is what makes the pages a picture the
     movement below can carry.

     Named outside that, it would be a picture during every view transition the
     APPLICATION starts — two rows swapping, a list changing — and a page is
     several screens tall: its picture is the whole element, drawn in the top
     layer from wherever the element starts, so it paints over the fixed bars
     and past the bottom of the screen for the length of a movement that has
     nothing to do with the pages. Unnamed, it stays part of the document's own
     picture, where the browser cuts it at the viewport like everything else. */
  :root[data-navi-route-transition] [data-navi-route-transition-area] {
    view-transition-name: navi-route-transition;
  }

  /* A named descendant — a thumbnail named for a morph, a row named for a
     reorder gesture — is a hole in the area's picture and a group of its own.
     Nested groups keep that group inside the area's, which is what cuts it at
     the pages' edge instead of letting it paint across the screen. What it does
     NOT do is make it travel: the movement is carried by the area's two
     pictures, and a group is not one of them, so a named descendant stands
     where it was captured while the pages slide under it. A morph wants exactly
     that; a component that names its parts for changes of its own does not, and
     drops its names for the length of the movement (see list.jsx). A browser
     without nested groups is warned instead (see
     warnAboutNamesEscapingArea). */
  @supports (view-transition-group: contain) {
    :root[data-navi-route-transition] [data-navi-route-transition-area] {
      view-transition-group: contain;
    }
  }

  /* Only while a transition of OURS is playing: everything below changes how
     the document animates, and the document belongs to the application the
     rest of the time. */
  :root[data-navi-route-transition] {
    /* With an area marked, the page AROUND it is not taken as one picture —
       so exactly one of the two names below exists at a time, and the
       movements can be written once for both. It is also the only way the
       furniture can take part in the movement: photographed with the whole
       document it is one picture the size of the screen, and a bar can be
       neither held where it stands nor moved with the page it belongs to
       inside it. Each bar is photographed on its own instead (see
       transition_furniture.js), and nothing shows through where the pages are
       — their two pictures cover the area's rectangle between them at every
       moment. */
    &[data-navi-route-transition-target="area"] {
      view-transition-name: none;

      /* The pages travel OVER the furniture. Everything else captured while an
         area is marked is a fixed bar wearing a name of navi's own for the
         length of the movement (transition_furniture.js): a bar the two states
         share is one group the browser holds where it stands, and a bar only
         one of them has stands there too, with no counterpart to move to. Both
         belong under the pages — that is what lets a page come over a bar that
         is going away, and a page leaving uncover the bar arriving behind it.

         Ordered here rather than left to the DOM, which decides it otherwise:
         where an application puts its bars relative to the area is its own
         business. A name and \`*\` weigh the same, so the two rules are read in
         the order they are written. */
      &::view-transition-group(*) {
        z-index: 0;
      }
      &::view-transition-group(navi-route-transition) {
        z-index: 1;
      }
    }

    &::view-transition-old(root),
    &::view-transition-new(root),
    &::view-transition-old(navi-route-transition),
    &::view-transition-new(navi-route-transition) {
      /* Written on the direction alone, so a relation with no type — the
         browser's cross-fade — answers to it like every other. */
      animation-duration: var(--navi-route-transition-duration, 300ms);
    }

    /* The window the pages are seen through, when it is an area. Nothing here
       names \`root\`: the root picture IS the window when the whole document
       travels, already the size of the screen and already cut by it. */
    &::view-transition-group(navi-route-transition),
    &::view-transition-image-pair(navi-route-transition) {
      /* The pages are cut at the edge of the area they move in. Said HERE and
         nowhere else: these pictures are drawn in the top layer, so no
         overflow on any element of the document can reach them. */
      overflow: clip;
    }
    /* The nested groups of named descendants, cut at that same edge. On its own
       rule: a selector a browser cannot parse takes the whole list it is
       written in down with it, and the pages must be cut everywhere. */
    &::view-transition-group-children(navi-route-transition) {
      overflow: clip;
    }
    &::view-transition-group(navi-route-transition) {
      /* Held still for the whole transition, at the rectangle that contains
         both states (see transition_window.js). Held by dropping the group's
         animation rather than by winning against it with !important. The
         browser puts the group where the ARRIVING area stands, so it is moved
         from there back to the window's own corner. */
      top: calc(
        var(--navi-transition-window-top) - var(
            --navi-transition-window-new-top
          )
      );
      left: calc(
        var(--navi-transition-window-left) - var(
            --navi-transition-window-new-left
          )
      );
      width: var(--navi-transition-window-width);
      height: var(--navi-transition-window-height);
      animation-name: none;

      /* Cut at what covers the area, on top of being cut at the area's own
         box. The pictures are drawn in the top layer, so they cover a fixed bar
         as easily as anything else — and the area runs UNDER the bars by
         design: that is what a fixed bar is for, and what the room it gives
         back is for. An area taller than the screen therefore ends below the
         bottom bar, and a scrolled one starts above the top bar, so the
         movement would be watched painting over them for its whole length.

         Two bands are left free, and they answer for two different things: the
         app's own safe area (layout/safe_area.js), everything pinned to the
         WINDOW's edges, and --navi-transition-cover-* (transition_window.js),
         what covers the area from inside the document — a sticky header above
         the pages covers the top of the area exactly as a fixed bar covers the
         top of the screen. Both are read rather than asked for, so one that
         grows, shrinks or unmounts mid-transition is followed without anything
         being told.

         Read live, though, they describe the state ARRIVING and nothing else,
         so the cut is taken at the smaller of that and the band the state
         being left kept free (--navi-transition-old-band-*, photographed while
         both still existed). Furniture standing in BOTH states is the frame:
         the pages move behind it and are cut at it. Furniture standing in one
         of them is part of what changes, and cutting the page being left at a
         bar it never had shows its own header being sliced instead of
         leaving. */
      --navi-route-transition-clip-top: max(
        0px,
        min(
            var(--navi-safe-area-inset-top) + var(--navi-transition-cover-top),
            var(--navi-transition-old-band-top)
          ) - var(--navi-transition-window-top)
      );
      --navi-route-transition-clip-left: max(
        0px,
        min(
            var(--navi-safe-area-inset-left) + var(--navi-transition-cover-left),
            var(--navi-transition-old-band-left)
          ) - var(--navi-transition-window-left)
      );
      --navi-route-transition-clip-bottom: max(
        0px,
        var(--navi-transition-window-top) +
          var(--navi-transition-window-height) +
          min(
            var(--navi-safe-area-inset-bottom) +
              var(--navi-transition-cover-bottom),
            var(--navi-transition-old-band-bottom)
          ) -
          100dvh
      );
      --navi-route-transition-clip-right: max(
        0px,
        var(--navi-transition-window-left) +
          var(--navi-transition-window-width) +
          min(
            var(--navi-safe-area-inset-right) +
              var(--navi-transition-cover-right),
            var(--navi-transition-old-band-right)
          ) -
          100dvw
      );
      clip-path: inset(
        var(--navi-route-transition-clip-top)
          var(--navi-route-transition-clip-right)
          var(--navi-route-transition-clip-bottom)
          var(--navi-route-transition-clip-left)
      );

      /* How far a page travels: the WINDOW it is seen through, not its own
         size. A page is as tall as its content — several screens of it — and a
         movement measured on the picture would send it thousands of pixels
         away, off screen for most of the transition and flying past at the
         end. What one page crossing another means is one window's worth of
         movement, whatever the pages are made of. Inherited by the pictures,
         which is where it is used (see the keyframes). */
      --navi-route-transition-travel-x: calc(
        var(--navi-transition-window-width) - var(
            --navi-route-transition-clip-left
          ) - var(--navi-route-transition-clip-right)
      );
      --navi-route-transition-travel-y: calc(
        var(--navi-transition-window-height) - var(
            --navi-route-transition-clip-top
          ) - var(--navi-route-transition-clip-bottom)
      );
    }
    /* Each picture at the corner its own state stood at, which is not the
       window's: the window contains both states, and a state that is scrolled
       — or that stands under a bar the other one does not have — is somewhere
       inside it (see transition_window.js). Offset here rather than by
       \`translate\`, which the movement itself uses. */
    &::view-transition-old(navi-route-transition) {
      top: calc(
        var(--navi-transition-window-old-top) - var(
            --navi-transition-window-top
          )
      );
      left: calc(
        var(--navi-transition-window-old-left) - var(
            --navi-transition-window-left
          )
      );
    }
    &::view-transition-new(navi-route-transition) {
      top: calc(
        var(--navi-transition-window-new-top) - var(
            --navi-transition-window-top
          )
      );
      left: calc(
        var(--navi-transition-window-new-left) - var(
            --navi-transition-window-left
          )
      );
    }

    /* ------------------------------------------------------------------
       The movements. One of \`root\` and \`navi-route-transition\` exists at a
       time (see the opt-out above), so each is written for both.
       ------------------------------------------------------------------ */
    /* What a NAMED movement is made of, whatever the movement is — the types
       navi ships and the ones an application writes alike. The attribute is
       present for a type and only for a type ("cross-fade" normalizes to no
       type at all, "none" starts nothing), so the browser's own cross-fade
       keeps every default below: scaling one picture into the other and seeing
       through both IS the movement there. */
    &[data-navi-route-transition-type] {
      &::view-transition-old(root),
      &::view-transition-new(root),
      &::view-transition-old(navi-route-transition),
      &::view-transition-new(navi-route-transition) {
        width: auto;
        /* Each picture at the size it was taken at: a page is not resized by
           the page it crosses. The picture is as wide as the box the browser
           gives it — the arriving one's — so a page leaving a narrower box (a
           scrollbar appeared, a side panel closed) would be seen zooming over
           the length of the movement, and one leaving a shorter box would be
           seen inflating. */
        height: auto;
        object-fit: none;
        object-position: top left;
        /* Two pages crossing are two solid things, and seeing through one to
           the other says they are the same page changing its mind. A movement
           that keeps the browser's fade on one of its two sides wants the
           opposite, and says so — see zoom below. */
        mix-blend-mode: normal;
        animation-fill-mode: both;
      }
    }

    /* Eased, which is a taste about THESE four: a custom type says its own
       curve. */
    &[data-navi-route-transition-type="slide-x"],
    &[data-navi-route-transition-type="slide-y"],
    &[data-navi-route-transition-type="cover-x"],
    &[data-navi-route-transition-type="cover-y"] {
      &::view-transition-old(root),
      &::view-transition-new(root),
      &::view-transition-old(navi-route-transition),
      &::view-transition-new(navi-route-transition) {
        animation-timing-function: ease;
      }
    }

    &[data-navi-route-transition-type="slide-x"] {
      &[data-navi-route-transition="forward"] {
        &::view-transition-old(root),
        &::view-transition-old(navi-route-transition) {
          animation-name: navi-route-transition-leave-towards-start;
        }
        &::view-transition-new(root),
        &::view-transition-new(navi-route-transition) {
          animation-name: navi-route-transition-enter-from-end;
        }
      }
      &[data-navi-route-transition="back"] {
        &::view-transition-old(root),
        &::view-transition-old(navi-route-transition) {
          animation-name: navi-route-transition-leave-towards-end;
        }
        &::view-transition-new(root),
        &::view-transition-new(navi-route-transition) {
          animation-name: navi-route-transition-enter-from-start;
        }
      }
    }

    /* The same four movements, along the other axis: the start of a column is
       its top, so going forward there is the page rising and the next one
       coming up from below. */
    &[data-navi-route-transition-type="slide-y"] {
      &[data-navi-route-transition="forward"] {
        &::view-transition-old(root),
        &::view-transition-old(navi-route-transition) {
          animation-name: navi-route-transition-leave-towards-top;
        }
        &::view-transition-new(root),
        &::view-transition-new(navi-route-transition) {
          animation-name: navi-route-transition-enter-from-bottom;
        }
      }
      &[data-navi-route-transition="back"] {
        &::view-transition-old(root),
        &::view-transition-old(navi-route-transition) {
          animation-name: navi-route-transition-leave-towards-bottom;
        }
        &::view-transition-new(root),
        &::view-transition-new(navi-route-transition) {
          animation-name: navi-route-transition-enter-from-top;
        }
      }
    }

    /* One page over the other, the way a sheet covers a desk: the page
       arriving slides in ON TOP of one that does not move, and going back it
       slides off, uncovering it. The still page is animated all the same — to
       a keyframe that goes nowhere — because left to the browser it would
       fade. */
    &[data-navi-route-transition-type="cover-x"] {
      &[data-navi-route-transition="forward"] {
        &::view-transition-old(root),
        &::view-transition-old(navi-route-transition) {
          animation-name: navi-route-transition-still;
        }
        &::view-transition-new(root),
        &::view-transition-new(navi-route-transition) {
          animation-name: navi-route-transition-enter-from-end;
        }
      }
      &[data-navi-route-transition="back"] {
        &::view-transition-old(root),
        &::view-transition-old(navi-route-transition) {
          /* The page leaving is the cover: it must slide off ABOVE the one it
             uncovers, against the browser's default of drawing the new page on
             top. */
          z-index: 1;
          animation-name: navi-route-transition-leave-towards-end;
        }
        &::view-transition-new(root),
        &::view-transition-new(navi-route-transition) {
          animation-name: navi-route-transition-still;
        }
      }
    }
    &[data-navi-route-transition-type="cover-y"] {
      &[data-navi-route-transition="forward"] {
        &::view-transition-old(root),
        &::view-transition-old(navi-route-transition) {
          animation-name: navi-route-transition-still;
        }
        &::view-transition-new(root),
        &::view-transition-new(navi-route-transition) {
          animation-name: navi-route-transition-enter-from-bottom;
        }
      }
      &[data-navi-route-transition="back"] {
        &::view-transition-old(root),
        &::view-transition-old(navi-route-transition) {
          z-index: 1;
          animation-name: navi-route-transition-leave-towards-bottom;
        }
        &::view-transition-new(root),
        &::view-transition-new(navi-route-transition) {
          animation-name: navi-route-transition-still;
        }
      }
    }

    /* Going deeper is coming closer: the page arriving lands from slightly too
       big, and going back it is the page leaving that grows away. The other
       side keeps the browser's own fade under it. */
    &[data-navi-route-transition-type="zoom"] {
      &::view-transition-old(root),
      &::view-transition-new(root),
      &::view-transition-old(navi-route-transition),
      &::view-transition-new(navi-route-transition) {
        /* One side of this one is the browser's fade, and a fade is two
           half-transparent pictures: they must ADD up rather than cover each
           other, or the page behind shows through the middle of the
           movement. */
        mix-blend-mode: plus-lighter;
      }
      &[data-navi-route-transition="forward"] {
        &::view-transition-new(root),
        &::view-transition-new(navi-route-transition) {
          animation-name: navi-route-transition-zoom-in;
        }
      }
      &[data-navi-route-transition="back"] {
        &::view-transition-old(root),
        &::view-transition-old(navi-route-transition) {
          animation-name: navi-route-transition-zoom-out;
        }
      }
    }
  }

  /* One window's worth of movement. The fallback is the picture's own size,
     which is what the window is when the whole document travels: the root
     picture IS the viewport. */
  @keyframes navi-route-transition-leave-towards-start {
    to {
      translate: calc(-1 * var(--navi-route-transition-travel-x, 100%)) 0;
    }
  }
  @keyframes navi-route-transition-enter-from-end {
    from {
      translate: var(--navi-route-transition-travel-x, 100%) 0;
    }
  }
  @keyframes navi-route-transition-leave-towards-end {
    to {
      translate: var(--navi-route-transition-travel-x, 100%) 0;
    }
  }
  @keyframes navi-route-transition-enter-from-start {
    from {
      translate: calc(-1 * var(--navi-route-transition-travel-x, 100%)) 0;
    }
  }
  @keyframes navi-route-transition-leave-towards-top {
    to {
      translate: 0 calc(-1 * var(--navi-route-transition-travel-y, 100%));
    }
  }
  @keyframes navi-route-transition-enter-from-bottom {
    from {
      translate: 0 var(--navi-route-transition-travel-y, 100%);
    }
  }
  @keyframes navi-route-transition-leave-towards-bottom {
    to {
      translate: 0 var(--navi-route-transition-travel-y, 100%);
    }
  }
  @keyframes navi-route-transition-enter-from-top {
    from {
      translate: 0 calc(-1 * var(--navi-route-transition-travel-y, 100%));
    }
  }
  @keyframes navi-route-transition-zoom-in {
    from {
      opacity: 0;
      scale: 1.1;
    }
  }
  @keyframes navi-route-transition-zoom-out {
    to {
      opacity: 0;
      scale: 1.1;
    }
  }
  /* Standing still, said as an animation: naming it replaces the browser's own
     fade on that side, which is the whole point. */
  @keyframes navi-route-transition-still {
    to {
      translate: 0 0;
    }
  }
`;

/**
 * The region the pages live in — where the movements play.
 *
 * Wrap the `<Route>` tree with it in an application that has fixed furniture
 * (a top bar, a tab bar): the movements then play on THIS element's pictures,
 * clipped at its bounds, and the bars never move. Without it the document
 * itself travels, which is right only when the pages are the whole viewport —
 * with bars around, the moving root picture drags a blank band across the
 * screen where they stand.
 *
 * It is a real box, and it must be: what is photographed and clipped IS its
 * rectangle. So `display: contents` cannot be used on it — an element with no
 * box is never captured, the movement plays on nothing and the browser aborts
 * the transition. Give it the layout the pages need instead — it is a `Box`,
 * so `flex`, `className`, `style` and the rest are there for that. An
 * application that already has an element holding its pages can mark that one
 * with `data-navi-route-transition-area` rather than nesting another.
 *
 * @type {import("preact").FunctionComponent<{ children?: any, [key: string]: any }>}
 */
export const RouteTransitionArea = ({ children, ...rest }) => {
  import.meta.css = css;
  const props = { ...rest, [TRANSITION_AREA_ATTRIBUTE]: "" };
  return <Box {...props}>{children}</Box>;
};

/**
 * Declare how a pair of routes moves against each other.
 *
 * @param {object} from - a route, or `{ route, params }` when the page is a
 *   param of a route rather than a route of its own.
 * @param {object} to - same forms. Going from `from` to `to` plays forward,
 *   the reverse plays back — unless the reverse is written as a relation of
 *   its own, which then owns that way (a movement of its own, or `"none"` for
 *   a plain cut). A change between two pages no relation was written for plays
 *   nothing.
 * @param {string|{type?: string, duration?: number|string}} [transition] -
 *   what plays: a type name, or `{ type, duration }` to also say how long
 *   (`--navi-route-transition-duration` says it for everyone otherwise).
 *   Omitted, the browser's own cross-fade. Shipped with navi:
 *   - `"slide-x"`, `"slide-y"`: the two pages slide past each other, forward
 *     towards the start of the axis;
 *   - `"cover-x"`, `"cover-y"`: the page arriving slides in OVER one that does
 *     not move, and slides off it on the way back;
 *   - `"zoom"`: the deeper page is the closer one — it lands from slightly too
 *     big, and grows away when left;
 *   - `"none"`: nothing, said out loud — written on one way of a pair, it cuts
 *     where the reverse of the other way (or the default) would have played;
 *   - `"cross-fade"`: the omitted case, nameable — so one way of a pair can
 *     fade while the other way moves.
 *   Every type plays on the document, or on the element marked
 *   `data-navi-route-transition-area` when the application has one (see the
 *   top of this file). Any other name belongs to the application: for the
 *   length of the transition the root carries
 *   `data-navi-route-transition-type="<type>"` next to
 *   `data-navi-route-transition="forward"|"back"`, and the application's CSS
 *   defines the movement against the view transition pseudo-elements:
 *
 *     :root[data-navi-route-transition-type="spin"][data-navi-route-transition="forward"] {
 *       &::view-transition-new(root) {
 *         animation-name: my-spin-in;
 *       }
 *     }
 *
 *   Whatever is written here is what EVERY crossing of the pair plays. One
 *   crossing can ask for something else — `<Link routeTransition>`, or
 *   navTo(url, { routeTransition }) — which overrides this field by field, for
 *   that
 *   navigation alone.
 * @returns {() => void} remove this relation.
 */
export const defineRouteTransition = (from, to, transition) => {
  import.meta.css = css;
  const { type, duration } = normalizeTransition(transition);
  const relation = {
    from: normalizePage(from),
    to: normalizePage(to),
    type,
    duration,
  };
  relations.push(relation);
  rebuildWatcher();
  return () => {
    const index = relations.indexOf(relation);
    if (index > -1) {
      relations.splice(index, 1);
      rebuildWatcher();
    }
  };
};

/**
 * What plays on a navigation no relation was written for: every route change
 * then plays this transition, and the written relations keep their own.
 *
 * A default has no direction — nothing says which of two arbitrary pages is
 * "before" the other — so give it a movement that does not need one:
 * `"cross-fade"`, or a custom type whose CSS is keyed on the type alone.
 *
 * @param {string|{type?: string, duration?: number|string}} transition - same
 *   forms as defineRouteTransition's. `"none"` (or removing the default) puts
 *   the silence back.
 * @returns {() => void} remove this default.
 */
export const defineRouteDefaultTransition = (transition) => {
  import.meta.css = css;
  const value = normalizeTransition(transition);
  defaultTransition = value;
  return () => {
    if (defaultTransition === value) {
      defaultTransition = null;
    }
  };
};

// "cross-fade" is a name for what plays when nothing is asked for — the
// browser's own animation — so it normalizes to asking for nothing. Having the
// name lets one way of a pair say it out loud while the other way slides.
const normalizeTransition = (transition) => {
  const { type, duration } =
    typeof transition === "string" ? { type: transition } : transition || {};
  return { type: type === "cross-fade" ? undefined : type, duration };
};

/**
 * What THIS navigation asked for, whatever the relations say.
 *
 * A relation is about the map of the app and holds for every way of reaching a
 * page; a request is about one crossing of it. The rare way round a pair — a
 * badge that jumps back out to the game it belongs to, a card that leads to
 * the player it describes — is a navigation that knows something the pair does
 * not, and this is where it says it.
 *
 * Two mouths, one meaning: the element being pressed wears it (a `<Link
 * routeTransition>`, or the attribute by hand on any anchor), or navTo() is
 * handed
 * it. Both arrive here through the announcement the navigation makes before it
 * writes anything (see before_routing.js).
 *
 * A request answers FIELD BY FIELD: what it does not say, the relation — or
 * the default — still answers for. So `{ direction: "back" }` keeps the pair's
 * movement and only turns it round, and `"none"` cuts where something would
 * have played.
 */
const readNavigationRequest = ({ routeTransition, element }) => {
  if (routeTransition !== undefined && routeTransition !== null) {
    return normalizeRequest(routeTransition);
  }
  if (element && element.getAttribute) {
    const asked = element.getAttribute(TRANSITION_REQUEST_ATTRIBUTE);
    if (asked === null) {
      return null;
    }
    const value = asked.trim();
    if (value === "") {
      return null;
    }
    // A type is a name, and a name is all most links have to say. Anything
    // more — a way round, a pace — is the same object the API takes
    // everywhere else, written as JSON so that it travels on an attribute
    // (and so that a plain <a> can say it too).
    if (value[0] === "{") {
      let parsed;
      try {
        parsed = JSON.parse(value);
      } catch {
        console.warn(
          `${TRANSITION_REQUEST_ATTRIBUTE} is neither a type name nor JSON: ${value}`,
        );
        return null;
      }
      return normalizeRequest(parsed);
    }
    return normalizeRequest(value);
  }
  return null;
};

const normalizeRequest = (transition) => {
  const { type, duration, direction } =
    typeof transition === "string" ? { type: transition } : transition;
  return {
    type: type === "cross-fade" ? undefined : type,
    // Whether a type was SAID, which is not the same as having one: asking for
    // "cross-fade" is asking for the browser's own animation, and a request
    // that names no type at all keeps the relation's.
    typeSaid: type !== undefined,
    duration,
    direction,
  };
};

// The request first, field by field, then what was defined for this pair (or
// for everything). Written as one function because both ends of the file
// resolve the same way: the one that knows the pair, and the one that only
// knows a navigation landed.
const resolveTransition = (request, base) => {
  const baseType = base ? base.type : undefined;
  const baseDuration = base ? base.duration : undefined;
  if (!request) {
    return { type: baseType, duration: baseDuration };
  }
  return {
    type: request.typeSaid ? request.type : baseType,
    duration: request.duration === undefined ? baseDuration : request.duration,
  };
};

// Every relation defined, and the single watcher standing over all of them.
const relations = [];
let watcher = null;
const rebuildWatcher = () => {
  if (watcher) {
    watcher.stop();
    watcher = null;
  }
  if (relations.length === 0) {
    return;
  }
  // Every page any relation mentions, each once: the position of the current
  // page in this list is what turns "some signal moved" into "the document
  // went from page A to page B".
  const pages = [];
  for (const { from, to } of relations) {
    if (pageIndexOf(pages, from) === -1) {
      pages.push(from);
    }
    if (pageIndexOf(pages, to) === -1) {
      pages.push(to);
    }
  }
  const currentIndexSignal = computed(() => currentPageIndex(pages));
  let currentIndex;
  let firstReading = true;
  const onMove = (index) => {
    const fromIndex = currentIndex;
    currentIndex = index;
    if (firstReading) {
      // Where the document already is — nothing changed, there is nothing to
      // animate. Also the first reading after a definition landed mid-life:
      // the watcher is standing again on whatever page is current.
      firstReading = false;
      return;
    }
    if (index === -1 || fromIndex === -1 || fromIndex === index) {
      return;
    }
    const found = findRelation(pages[fromIndex], pages[index]);
    if (!found && !navigationRequest) {
      // No relation says anything about these two and this navigation asked
      // for nothing: they are side by side, and silence is the fact — not a
      // missing case.
      return;
    }
    const { type, duration } = resolveTransition(
      navigationRequest,
      found ? found.relation : null,
    );
    if (type === "none") {
      // Silence said out loud: this way of the pair was written to play
      // nothing — or this one navigation asked for nothing — where the reverse
      // of the other way, or the default, would have played.
      navigationAnimated = true;
      return;
    }
    beginTransition({
      page: pages[index],
      url: navigationUrl,
      // Which way it plays: what the navigation itself said first — the link
      // being pressed is where the way the app is being walked is known — then
      // the relation, and forward for a navigation that asked for a movement
      // between two pages no relation orders.
      direction:
        (navigationRequest && navigationRequest.direction) ||
        (found && found.direction) ||
        "forward",
      type,
      duration,
    });
  };
  // `subscribe` rather than `effect`: it hands the value to a callback that is
  // not being tracked, and starting a view transition releases holds that make
  // the very signals this is watched through move again.
  const unsubscribe = currentIndexSignal.subscribe(onMove);
  watcher = { stop: unsubscribe };
};

// What plays when no relation matched (see defineRouteDefaultTransition), what
// the navigation now landing asked for on its own (see readNavigationRequest),
// where it goes, and whether it found an answer already — a relation's
// transition, a "none", a RouteTravel travel. The last three are read at the
// start of every navigation, so they are always about the latest one.
let defaultTransition = null;
let navigationRequest = null;
let navigationUrl = null;
let navigationAnimated = false;

// The two ends of every navigation, watched from here on. The picture of the
// page being left has to be honest, so rendering is held from before the
// navigation's first write (see rendering_hold.js) — but only when something
// could be photographed: a document where nothing is defined and nothing is
// asked for holds nothing. It is given back at the far end, which is also the
// one moment the DEFAULT can decide: every relation has had its say by then.
observeBeforeRouting((details) => {
  navigationAnimated = false;
  navigationRequest = readNavigationRequest(details);
  navigationUrl = details.url;
  if (relations.length === 0 && !defaultTransition && !navigationRequest) {
    return;
  }
  holdRenderingForRouting();
});
observeAfterRouting(() => {
  const request = navigationRequest;
  const url = navigationUrl;
  // Read here and dropped here: a request answers for the navigation it was
  // made on, and the next one is back to the relations.
  navigationRequest = null;
  navigationUrl = null;
  if (!navigationAnimated && (request || defaultTransition)) {
    const { type, duration } = resolveTransition(request, defaultTransition);
    if (type !== "none") {
      beginTransition({
        page: null,
        url,
        // A default has no direction: nothing says which of two arbitrary
        // pages is before the other, and the attribute is then worn empty —
        // present for whoever keys on "one of ours is playing", silent on the
        // way. A request is the other case: a navigation IS a way round, so a
        // press that names the movement means forward unless it says
        // otherwise — and a movement of navi's is written on the direction,
        // so left empty it would play nothing at all.
        direction:
          (request && request.direction) ||
          (request && request.typeSaid ? "forward" : ""),
        type,
        duration,
      });
    }
  }
  releaseRoutingRenderingHold();
});

// The exact way travelled first, over the whole registry, and only then the
// reverses: a relation written B → A owns that way, and being the reverse of
// one written A → B never outranks it. This is what makes reciprocity a
// default rather than a decree — write the way back to give it a movement of
// its own, or "none" to silence it.
const findRelation = (fromPage, toPage) => {
  for (const relation of relations) {
    if (samePage(relation.from, fromPage) && samePage(relation.to, toPage)) {
      return { direction: "forward", relation };
    }
  }
  for (const relation of relations) {
    if (samePage(relation.from, toPage) && samePage(relation.to, fromPage)) {
      return { direction: "back", relation };
    }
  }
  return null;
};

// The transition whose direction the document is currently wearing. One per
// document, as with view transitions themselves: a new one starting takes the
// attributes over, and only their owner may take them off.
let currentTransition = null;

const beginTransition = ({ page, url, direction, type, duration }) => {
  navigationAnimated = true;
  const documentElement = document.documentElement;
  // One navigation, one animator. A RouteTravel box already travelling this
  // change owns the document's transition — and possibly a finger; starting
  // one here on top would skip its pictures mid-slide. A pair of routes must
  // be animated by RouteTravel or by a route transition, never both.
  if (documentElement.hasAttribute(ROUTE_TRAVEL_ATTRIBUTE)) {
    console.warn(
      "A RouteTravel is animating this navigation; the route transition defined between these routes is skipped. Animate a pair of routes with RouteTravel or defineRouteTransition, not both.",
    );
    return;
  }
  const transition = {};
  currentTransition = transition;
  // Said before the picture is taken: whoever names something for a movement
  // between two pages decides on it now (see transition_destination.js).
  holdTransitionDestination(transition, url);
  documentElement.setAttribute(TRANSITION_ATTRIBUTE, direction);
  if (type) {
    documentElement.setAttribute(TRANSITION_TYPE_ATTRIBUTE, type);
  }
  // Looked up per transition, not once: the area is the application's own
  // element and follows its lifecycle — a page layout without bars has none,
  // and the movement then plays on the document itself.
  const areaElements = document.querySelectorAll(
    `[${TRANSITION_AREA_ATTRIBUTE}]`,
  );
  if (areaElements.length > 1) {
    warnOnce(
      "several-areas",
      `${areaElements.length} elements carry ${TRANSITION_AREA_ATTRIBUTE}. They all take the same view-transition-name, and a name belongs to one element at a time: the browser refuses EVERY view transition of the document while this holds. Mark the one element the pages live in.`,
    );
  }
  const areaElement = areaElements.length > 0 ? areaElements[0] : null;
  // The area as it stands before anything moves, and the band the furniture
  // around it leaves free: rendering is held, so both are still the page being
  // left (see transition_window.js).
  let areaStateBefore = null;
  if (areaElement) {
    documentElement.setAttribute(TRANSITION_TARGET_ATTRIBUTE, "area");
    // Said before the picture is taken, like every name (see
    // transition_furniture.js): what the bars are wearing when the transition
    // starts is what the browser photographs.
    nameTransitionFurniture(transition, areaElement);
    areaStateBefore = measureTransitionWindowState(areaElement);
  }
  // A duration of this relation's own, worn for the length of the transition —
  // and whatever the application had written inline put back afterwards, not
  // erased.
  let restoreDuration = null;
  if (duration !== undefined) {
    const durationBefore = documentElement.style.getPropertyValue(
      TRANSITION_DURATION_PROPERTY,
    );
    documentElement.style.setProperty(
      TRANSITION_DURATION_PROPERTY,
      typeof duration === "number" ? `${duration}ms` : duration,
    );
    restoreDuration = () => {
      if (durationBefore) {
        documentElement.style.setProperty(
          TRANSITION_DURATION_PROPERTY,
          durationBefore,
        );
      } else {
        documentElement.style.removeProperty(TRANSITION_DURATION_PROPERTY);
      }
    };
  }
  const releaseRendering = takeoverRoutingRenderingHold();
  // Armed from here rather than from inside the callback below: the browser
  // calls that callback a frame later, and a navigation that has already
  // been decided renders its page in between — a wait armed then waits for
  // something that has already happened.
  const renderWait = armRouteRenderWait();
  // What the browser ACTUALLY captured, read once the pictures exist: it is
  // the only place the silent misconfigurations show. They are all about the
  // same thing — a movement playing on pictures that are not the pages.
  const viewTransitionReady = () => {
    const capturedNames = capturedViewTransitionNames();
    if (areaElements.length > 0) {
      if (!capturedNames.has(AREA_NAME)) {
        warnOnce(
          "area-not-captured",
          `The element marked ${TRANSITION_AREA_ATTRIBUTE} was not captured, so the movement plays on nothing. An element is captured only if it generates a box: \`display: contents\` (or an element not rendered) cannot be the area — its rectangle is what gets photographed and clipped.`,
        );
      }
      warnAboutNamesEscapingArea(areaElement, capturedNames);
      return;
    }
    for (const name of capturedNames) {
      if (name === "root") {
        continue;
      }
      // Something stands still while the whole document travels under it. The
      // root picture spans the viewport and has a HOLE where that thing was
      // captured, so what crosses the screen is a blank band.
      warnOnce(
        "pages-travel-under-named-elements",
        `The movement plays on the whole document while "${name}" is captured on its own, so a blank band travels where it stands. Wrap the pages in <RouteTransitionArea> (or mark their element with ${TRANSITION_AREA_ATTRIBUTE}) so the movement plays on them rather than on the document.`,
      );
      break;
    }
  };
  const viewTransition = startViewTransition(async () => {
    // The picture the browser is about to take must be of the page that was
    // asked for, and a route matching is not yet a page rendered. Whatever
    // is awaited here must be able to resolve without a frame: the document
    // is frozen for the whole of this callback.
    try {
      // Releasing flushes the held render synchronously, so a route that
      // rendered has already resolved the wait by the next line.
      releaseRendering();
      if (page === null) {
        // A default transition: which page is arriving is unknown, and some
        // navigations render no route at all (a search param bound to a
        // signal) — waited on, those would freeze the page until the browser
        // gives up. The wait is raced with a short timer instead.
        await Promise.race([renderWait.rendered, waitMs(50)]);
      } else if (pageIsCurrent(page)) {
        await renderWait.rendered;
      }
    } finally {
      renderWait.stop();
    }
    // The page arriving is in the DOM and the transition has not started
    // playing: the one moment both states of the area can be known.
    if (areaElement) {
      // A bar the arriving state mounted has to wear its name before the
      // second picture is taken; one that survived the render keeps the name
      // it already has, which is what pairs its two pictures.
      nameTransitionFurniture(transition, areaElement);
      holdTransitionWindow(transition, areaElement, areaStateBefore);
    }
  });
  const end = () => {
    // Whatever ends it — played out, skipped by another transition starting,
    // failed before its callback ever ran — the hold is given back and the
    // document is handed back to the application. Both are idempotent, and
    // the attributes belong to the LAST transition begun: an earlier one
    // ending late must not strip what a later one is wearing.
    renderWait.stop();
    releaseRendering();
    if (currentTransition === transition) {
      currentTransition = null;
      documentElement.removeAttribute(TRANSITION_ATTRIBUTE);
      documentElement.removeAttribute(TRANSITION_TYPE_ATTRIBUTE);
      documentElement.removeAttribute(TRANSITION_TARGET_ATTRIBUTE);
      releaseTransitionWindow(transition);
      releaseTransitionDestination(transition);
      releaseTransitionFurniture(transition);
      if (restoreDuration) {
        restoreDuration();
      }
    }
  };
  viewTransition.ready.then(viewTransitionReady, ignoreSkipped);
  viewTransition.finished.then(end, end);
};

// A transition skipped by another one starting is an outcome, not a failure.
const ignoreSkipped = () => {};

// The names the browser captured, read off the pictures themselves: what was
// asked for in CSS and what was taken are not the same question (see
// viewTransitionReady).
const capturedViewTransitionNames = () => {
  const names = new Set();
  for (const animation of document.getAnimations()) {
    const pseudoElement = animation.effect?.pseudoElement;
    if (!pseudoElement || !pseudoElement.startsWith("::view-transition")) {
      continue;
    }
    const nameStart = pseudoElement.indexOf("(");
    if (nameStart === -1) {
      continue;
    }
    names.add(pseudoElement.slice(nameStart + 1, -1));
  }
  return names;
};

// Nested groups keep a name written inside the area inside its picture (see
// the @supports block in the CSS above). Without them the name escapes to the
// top of the ::view-transition tree and the element it belongs to stands still,
// fading on its own, while the pages move under it.
const NESTED_GROUPS_SUPPORTED = window.CSS.supports(
  "view-transition-group",
  "contain",
);
const warnAboutNamesEscapingArea = (areaElement, capturedNames) => {
  if (NESTED_GROUPS_SUPPORTED) {
    return;
  }
  let escapedName = null;
  for (const name of capturedNames) {
    if (
      name === "root" ||
      name === AREA_NAME ||
      name.startsWith(FURNITURE_NAME_PREFIX)
    ) {
      continue;
    }
    escapedName = name;
    break;
  }
  // A name captured next to the area is not necessarily inside it — a bar the
  // application animates on the same clock is named on purpose. The subtree is
  // walked only once something is there to find, so the common case reads
  // nothing.
  if (!escapedName) {
    return;
  }
  for (const descendant of areaElement.querySelectorAll("*")) {
    const { viewTransitionName } = getComputedStyle(descendant);
    if (!viewTransitionName || viewTransitionName === "none") {
      continue;
    }
    warnOnce(
      "names-escaping-area",
      `"${viewTransitionName}" is a view-transition-name written inside the element marked ${TRANSITION_AREA_ATTRIBUTE}, and this browser has no nested groups (view-transition-group: contain): the element it names is lifted out of the area's picture, so it stands still and fades on its own while the pages move. Give that name only for the length of the gesture it serves, or drop it while a route transition plays (:root[${TRANSITION_ATTRIBUTE}] { view-transition-name: none }).`,
    );
    return;
  }
};

// Said once per kind, whatever the number of navigations: a misconfiguration
// is one fact about the application, and repeating it every time the user
// moves would bury it.
const warningsSaid = new Set();
const warnOnce = (id, message) => {
  if (warningsSaid.has(id)) {
    return;
  }
  warningsSaid.add(id);
  console.warn(message);
};

// A route matching is a signal changing; how many passes Preact takes to
// answer it is its own business, and the render is the moment the picture can
// be taken. Listening starts before the change, or a render landing while the
// change settles is a render nobody heard.
const armRouteRenderWait = () => {
  let stopListening;
  const rendered = new Promise((resolve) => {
    stopListening = observeRouteRender(resolve);
  });
  return { rendered, stop: () => stopListening() };
};

const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizePage = (page) =>
  page.isRoute ? { route: page, params: undefined } : page;

// Two pages are the same page when they select the same thing, not when they
// were written by the same hand.
const samePage = (a, b) => {
  if (a === b) {
    return true;
  }
  if (!a || !b) {
    return false;
  }
  return a.route === b.route && compareTwoJsValues(a.params, b.params);
};
const pageIndexOf = (pages, page) =>
  pages.findIndex((candidate) => samePage(candidate, page));

// Whether this page is the one on screen — same reading as route_travel.jsx's
// own: matchingSignal is the necessary condition and is read whatever happens,
// params only for a route that matches (the params of a route that does not
// match are not params).
const pageIsCurrent = ({ route, params }) => {
  if (!route.matchingSignal.value) {
    return false;
  }
  return params ? route.matchesParams(params) : true;
};
// The FIRST page that answers, and every page read all the same: a page that
// is not the current one today is the one that must wake the reader tomorrow.
//
// Two of them answering at once is the one thing this reading cannot get right.
// Relations are declared one pair at a time, so the row read here is the order
// they happened to be written in — an order nothing in the application shows —
// and the movement then played is the one written for whichever page was
// mentioned first. A movement is a movement: it looks deliberate, which is why
// the overlap is said out loud here, where both pages are known.
const currentPageIndex = (pages) => {
  let currentIndex = -1;
  for (let i = 0; i < pages.length; i++) {
    const isCurrent = pageIsCurrent(pages[i]);
    if (!isCurrent) {
      continue;
    }
    if (currentIndex === -1) {
      currentIndex = i;
      continue;
    }
    warnPagesBothCurrent(pages[currentIndex], pages[i]);
  }
  return currentIndex;
};

const warnPagesBothCurrent = (pageKept, pageIgnored) => {
  const kept = describePage(pageKept);
  const ignored = describePage(pageIgnored);
  warnOnce(
    `both-current:${kept}|${ignored}`,
    `${kept} and ${ignored} are both current on "${window.location.pathname}": two relations claim this url. A relation is resolved through which page is current, so the one mentioned first in a defineRouteTransition call wins — ${kept} — and its movement plays whichever of the two the application is really showing. Make one of them decline this url with a param constraint (see navigation.md, "Which values a param accepts").`,
  );
};

const describePage = ({ route, params }) =>
  params ? `${route} with ${JSON.stringify(params)}` : `${route}`;

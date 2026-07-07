/**
 * A popup positioned via `anchor`/`anchorArea`, driven either by
 * --navi-toggle/--navi-open/--navi-close commands or the `open` prop.
 *
 * Two entirely separate rendering strategies exist in this one file, each
 * its own real component: `PopoverViaAttribute` (native Popover API,
 * `popover="manual"`, `showPopover()`/`hidePopover()`, promoted to the top
 * layer) and `PopoverCustom` (a plain `position: absolute` div, genuinely
 * relative to its nearest positioned ancestor — clipped by that ancestor's
 * own `overflow: hidden`/`auto`, unlike the top layer). The exported
 * `Popover` component first picks between an internally-managed open
 * controller (Uncontrolled) and one owned by the caller (Controlled, used
 * by picker_custom.jsx/side_panel.jsx) — kept as its own separate step so
 * `useOpenControllerByProps` (a whole controller instance) is only ever
 * created when actually needed, not unconditionally on every render.
 * `ControlledPopover` then picks which rendering strategy actually mounts,
 * from the `anchor` prop alone (`anchor === "scrollContainer"` →
 * `PopoverCustom`, everything else → `PopoverViaAttribute`) — by this
 * point an `openController` is always already resolved.
 *
 * Both components share the exact same `usePopoverProps(props)` hook for
 * everything that doesn't genuinely differ between them, once an
 * `openController` is already resolved: focus/debug/id plumbing, capture
 * setup, animation-attribute resolution, the open-commit sequence, the
 * close handler, and — inlined directly in the hook's own `openEffect`,
 * branching on a single `isCustom` flag rather than living in two separate
 * functions — the open/position/close sequence itself. Keeping it inline
 * (instead of splitting into two functions the way an earlier version of
 * this file did) makes the actual, genuine differences between the two
 * renderers easier to see at each point they occur — backdrop show/hide
 * mechanics and anchor-positioning math — rather than having to diff two
 * separately-scrolled functions to find them; everything else in the
 * sequence (capture setup, animation resolution, the commit/close steps)
 * is one shared call either way. `PopoverViaAttribute`/`PopoverCustom`
 * themselves stay two separate, real components (see below) even though
 * their own JSX bodies are trivial and identical today — they're expected
 * to diverge in DOM structure later (e.g. one of them needing an extra
 * wrapper), so collapsing them into one now would just mean re-splitting
 * them apart again once that need arrives.
 *
 * - `anchor="scrollContainer"` → the custom renderer, docked to the
 *   popover's own positioned ancestor. Always ignores whatever the
 *   triggering event carried as `detail.anchor`/`.source` — that's the only
 *   thing this value does, and it's unconditional (unlike the via-attribute
 *   cases below, it's not affected by `ignoreEventAnchor`, since this
 *   renderer never has a real-anchor case to begin with — a ref/DOM element
 *   `anchor` always selects the via-attribute renderer instead, never this
 *   one).
 * - Anything else (`undefined`, `"viewport"`, a ref, a DOM element) → the
 *   via-attribute renderer. `anchor="viewport"` and `anchor={undefined}`
 *   both mean "no real anchor supplied via the prop" — by default that
 *   falls back to the triggering event's own carried anchor
 *   (`detail.anchor`/`.source`) if present, else docks to the viewport;
 *   `ignoreEventAnchor` skips that fallback, forcing the viewport-dock
 *   placement regardless of what triggered the open (used by the demo's
 *   "Ignoring the anchor" section). A ref/DOM element is always used as a
 *   real anchor directly, regardless of `ignoreEventAnchor`.
 *   `resolvePositioningAnchor` resolves this down to a single value: either
 *   a real anchor element, or `undefined` — `hasAnchorElement` (just
 *   `Boolean(anchor)`) is what the rest of the code branches on from there.
 *   ("Real anchor" isn't quite the right word for that boolean either,
 *   since a container being docked to is arguably a real anchor in its own
 *   right too — `hasAnchorElement` is meant narrowly: is there a specific
 *   *element* being positioned against, as opposed to sticking to a
 *   container's own rect.)
 *
 * `aria-expanded` lives on the popover element itself, toggled imperatively
 * in sync with showPopover()/hidePopover() (or, for the custom renderer, a
 * plain inline `display` toggle — see the custom branch's own comments
 * below) so popup_css.js can key its CSS off one selector for both Popover
 * and Dialog. Both renderers share the exact same `.navi_popover`/
 * `.navi_popover_backdrop` classes — CSS that differs between them keys off
 * the native popover element's own `[popover]` attribute (present only for
 * the via-attribute renderer) rather than an extra class.
 *
 * `pointerInteractionOutsideEffect` ("none" default / "close" / "capture")
 * is implemented via a backdrop, a sibling element (not a descendant of the
 * real popover — a stacking-context root's own background/border always
 * paints *below* even its own negative-z-index children, so a z-index trick
 * on a *descendant* backdrop could never truly sit behind the real
 * popover's own background). For the via-attribute renderer it's a
 * top-layer sibling (promoted the same way, so it naturally stacks above
 * normal page content without needing z-index); for the custom renderer
 * it's a plain `position: absolute; inset: 0` sibling confined to the
 * *same* positioned ancestor as its popover (not the whole viewport —
 * natural DOM order alone puts it behind the popover content, both being
 * plain positioned siblings with no special stacking involved).
 * It opens/closes together with the real popover, freshly re-shown (hidden
 * first if still open) on every open so its top-layer position resets to
 * just below the real popover — this matters when several via-attribute
 * popovers are open at once, since an older backdrop left in its original
 * top-layer slot would sit above a more-recently-opened popover, and an
 * outside click on that popover would never reach it.
 * Hiding is deferred until the browser's matching "click" fires when the
 * close was triggered by a mousedown (an outside click): hiding it
 * synchronously would make the mousedown's target vanish before mouseup,
 * silently dropping that click (see armSuppressNextOpenRequest in
 * open_controller.js, which depends on that click too) — aria-expanded is
 * still set to "false" immediately, so the backdrop stops intercepting
 * anything right away even while it's still pending. Not rendered at all
 * when the effect is "none" (`backdropProps` is `null` in that case).
 *
 * anchorArea's grammar (loosely inspired by CSS position-area): two
 * space-separated words, order-independent. y: above/aligned-top/center/
 * aligned-bottom/below. x: on-the-left/aligned-left/center/aligned-right/
 * on-the-right. A bare word means no overlap with the anchor; "aligned-"
 * means edges touching. A single word implies "center" on the other axis.
 * The 4 corners (top-left, top-right, bottom-left, bottom-right) are presets
 * for the "aligned-" pair on both axes.
 *
 * When there's no real anchor element (`!hasAnchorElement`), the
 * via-attribute renderer docks against the viewport itself by feeding
 * `pickPositionRelativeTo` its own `document.documentElement` sentinel
 * value (see that function's own comment in visible_rect.js) — the same
 * function a real anchor uses, not a separate implementation. Docking
 * doesn't have a "float away with a gap" concept the way a real anchor's
 * "above"/"below" do, so `toDockPosition` first collapses the bare
 * directions to their "aligned-*" equivalent (`above` → `aligned-top`,
 * etc.) and passes them as both `positionX/Y` *and* `positionX/YFixed`,
 * skipping `pickPositionRelativeTo`'s own flip-on-overflow check entirely —
 * a docked corner/edge never flips to the other side. The custom renderer
 * never reaches `pickPositionRelativeTo` at all: it's genuinely relative to
 * its own ancestor rather than the viewport, a different coordinate space
 * that function isn't built for (see its own "should be used only for
 * document-relative element" warning) — it keeps its own
 * `computeStickToPosition` doing the equivalent math in ancestor-local
 * coordinates instead.
 *
 * `animation="auto"` resolves to "scaling" for any real anchor, or for a
 * point/corner placed dead-center (an "aligned-"/"center" axis means the
 * popover overlaps the anchor there, so a translate reads oddly — see
 * resolveDirectionValue below); "sliding" otherwise (a point/corner with a
 * direction, no anchor edge to grow out of) — concretely as one of
 * popup_css.js's `slide-from-*` values, computed here in JS (not left for
 * CSS to puzzle out from raw position attributes) so there's a single,
 * inspectable `navi-animation` value driving one direct CSS rule per
 * direction, no attribute-cascade indirection.
 * `animation="expanding"` (grows out of a real anchor's own edge, `expand-*`
 * concretely — via-attribute only, since the custom renderer never has a
 * real anchor) and `animation="fading"` (opacity only, no motion) are both
 * explicit-only — never auto-picked.
 *
 * A genuinely satisfying popup-opening animation is hard to pull off —
 * "scaling" is the kind that reads best in practice, which is why it's the
 * auto-pick for any real anchor. "expanding" (growing out of the anchor's
 * own edge) comes close, but "scaling" still does it better, hence staying
 * explicit-only rather than becoming a second auto-pick.
 *
 * A `spawnFromPointer`-style option (growing from the click/pointer position
 * instead of the anchor/center) was tried and dropped: it's a tempting idea
 * on paper, but in practice it adds motion that competes for attention with
 * the popover's own content, which is what should actually draw the eye
 * once it opens — not where it came from.
 *
 * Each `navi-animation` value's own CSS rule (popup_css.js) includes its
 * own fade in/out — no separate `fadeAnimation` prop or attribute.
 * `resolvedAnimation` is mirrored onto the backdrop's own `navi-animation`
 * too, which only ever fades regardless of which kind it is (see the
 * backdrop's own CSS comment for why).
 *
 * The via-attribute renderer's own `.navi_popover` switches to
 * `position: fixed` whenever the resolved animation is a `slide-from-*`
 * value (`&[popover][navi-animation^="slide-from"]` below) — regardless of
 * whether there's a real anchor or not. The point is avoiding a scrollbar:
 * a `slide-from-*` entrance genuinely translates the box up to 100% of its
 * own size off past one edge for the *closed* frame, which, for a
 * `position: absolute` box, would contribute to the document's scrollable
 * area while that frame is committed (the same "closed" frame this file's
 * `commitOpen`/reflow-trick machinery always briefly renders before
 * flipping `aria-expanded`) — `position: fixed` never contributes to
 * document scroll size, sidestepping it. Since `resolvedAnimationKind ===
 * "sliding"` (the only kind that can ever resolve to `slide-from-*` — see
 * `resolveDirectionValue`) is knowable immediately from `parsedAnchorArea`
 * alone, before positioning ever runs, `navi-animation` is given an early,
 * placeholder `slide-from-*` value (any one works — only the attribute's
 * own `slide-from` *prefix* matters for the CSS selector above) right after
 * `resolvedAnimationKind` is known, so `position: fixed` is already in
 * effect by the time the first `pickPositionRelativeTo` call measures
 * scroll offset — getting this order wrong would measure/position the
 * popover as if it were still `absolute`, one frame before the CSS
 * actually made it `fixed`, visibly offsetting it by the page's scroll
 * amount on that first paint. `applyResolvedAnimation` (further down, after
 * positioning) then overwrites that placeholder with the real, final
 * direction — "expanding" is the only other kind resolved that late (it
 * needs `pickPositionRelativeTo`'s own already-resolved
 * `data-position-y/x-current`), but it can never produce a `slide-from-*`
 * value, so its own later timing is never a problem for `position: fixed`.
 *
 * `data-anchor-out-of-view` marks a real anchor that's scrolled out of view
 * (`visibilityRatio <= 0.2`) — never set at all when `!hasAnchorElement`,
 * since visibility ratio is meaningless for something docked to the
 * viewport/ancestor rather than a specific element.
 */

import {
  createPubSub,
  findEvent,
  getBorderSizes,
  getPositionedParent,
  pickPositionRelativeTo,
  snapToPixel,
  trapFocusInside,
  trapScrollInside,
  visibleRectEffect,
} from "@jsenv/dom";
import { useId, useLayoutEffect, useRef } from "preact/hooks";

import { onNaviCommand } from "@jsenv/navi/src/control/commands.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { Box } from "../box/box.jsx";
import { resolveSpacingSize } from "../box/box_style_util.js";
import { onRequestInteraction } from "../control/rules/control_interaction.js";
import { createOnKeyDownForShortcuts } from "../keyboard/keyboard_shortcuts.js";
import {
  useDebugFocus,
  useDebugInteraction,
  useDebugPopup,
} from "../navi_debug.jsx";
import { useOpenControllerByProps } from "./open_controller.js";
import { popupCss } from "./popup_css.js";

const css = /* css */ `
  @layer navi {
    .navi_popover {
      --popover-max-height: 300px; /* soft: user-configurable preferred max-height */
      --popover-maxmax-height: calc(0.95 * var(--navi-vvh));
      --popover-maxmax-width: calc(0.95 * var(--navi-vvw));

      --popover-box-shadow: var(--navi-popup-box-shadow);
      --popover-border-radius: var(--navi-popup-border-radius);
      --popover-border-width: 1px;
      --popover-border-color: var(--navi-popup-border-color);
      --popover-outline-width: var(--navi-focus-outline-width);
      --popover-outline-offset: calc(-1 * var(--popover-outline-width) / 2);
      --popover-outline-color: var(--navi-focus-outline-color);
    }
  }

  .navi_popover {
    /* Shared by both renderers: the via-attribute one is absolute rather
       than fixed by default because an element in the top layer always uses
       the initial containing block regardless of "position", and an
       absolute element scrolls in lockstep with the document with no JS
       involved, unlike fixed (see the [popover][navi-animation^="slide-from"]
       override below for the one case that actually wants fixed). The
       custom renderer is *always* absolute for real: its containing block
       is genuinely its nearest positioned ancestor. */
    position: absolute;
    inset: unset;
    max-width: min(
      var(--popover-max-width, var(--popover-maxmax-width)),
      var(--popover-maxmax-width)
    );
    max-height: min(
      var(--popover-max-height),
      var(--space-available, var(--popover-maxmax-height)),
      var(--popover-maxmax-height)
    );
    border-width: var(--popover-border-width);
    border-style: solid;
    border-color: var(--popover-border-color);
    border-radius: var(--popover-border-radius);
    outline-width: var(--popover-outline-width);
    outline-color: var(--popover-outline-color);
    outline-offset: 0px;
    box-shadow: var(--popover-box-shadow);
    overflow: auto;
    overscroll-behavior: none;

    &[data-focus-visible] {
      outline-style: solid;
    }

    /* See this file's top comment for why a slide-from-* animation forces
       the via-attribute renderer into position: fixed regardless of anchor
       mode (avoiding a scrollbar) — the custom renderer (no [popover]
       attribute) never matches this, it's always absolute. */
    &[popover][navi-animation^="slide-from"] {
      position: fixed;
    }

    &[data-anchor-out-of-view] {
      opacity: 0;
      pointer-events: none;
    }
  }

  /* Sibling element, not a descendant of .navi_popover — see this file's
     top comment for why. */
  .navi_popover_backdrop {
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
    pointer-events: none;
    --popup-animation-duration: 0.18s;

    /* The via-attribute renderer's backdrop: a top-layer sibling, so it
       needs to cover the whole viewport itself (width/height: auto
       overrides the [popover] UA default sizing). */
    &[popover] {
      position: fixed;
      inset: 0;
      width: auto;
      height: auto;
    }
    /* The custom renderer's backdrop: a plain sibling confined to the same
       positioned ancestor as its popover (see this file's top comment) —
       inset: 0 within that ancestor, not the viewport. */
    &:not([popover]) {
      position: absolute;
      inset: 0;
    }

    &[aria-expanded="true"] {
      pointer-events: auto;

      /* Makes pointerInteractionOutsideEffect have a visible impact on backdrop */
      &[data-pointer-interaction-outside="close"] {
        background: rgba(0, 0, 0, 0.1);
      }
      &[data-pointer-interaction-outside="capture"] {
        background: rgba(0, 0, 0, 0.7);
      }
    }

    /* navi-animation mirrors the content popover's own resolved value (set
       imperatively in openEffect) — the backdrop only ever fades, regardless
       of which kind it is (translate/scale wouldn't mean anything on it).
       display is included alongside opacity (+ allow-discrete) for the same
       reason popup_css.js's own .navi_popover rule includes it — see this
       file's top comment. */
    &[navi-animation] {
      opacity: 1;
      transition-property: display, opacity;
      transition-duration: var(--popup-animation-duration);
      transition-timing-function: ease;
      transition-behavior: allow-discrete;

      &[aria-expanded="false"] {
        opacity: 0;
      }
    }
  }

  ${popupCss}
`;

/**
 * Entry point: picks between an internally-managed open controller
 * (Uncontrolled) and one owned by the caller (Controlled, used by
 * picker_custom.jsx/side_panel.jsx) so `useOpenControllerByProps` — which
 * creates a whole controller instance — is only ever called when it's
 * actually needed, not on every render regardless. Which rendering strategy
 * (native Popover API vs. plain div) mounts is decided one level further
 * in, by `ControlledPopover` — see this file's top comment.
 */
export const Popover = (props) => {
  import.meta.css = css;

  if (props.openController) {
    return <ControlledPopover {...props} />;
  }
  return <UncontrolledPopover {...props} />;
};

// No openController passed: this Popover is used declaratively (e.g. driven
// by --navi-toggle/--navi-open/--navi-close commands, or by the `open` prop)
// rather than owned by a parent component.
const UncontrolledPopover = (props) => {
  const openController = useOpenControllerByProps(props);

  return (
    <ControlledPopover
      {...props}
      open={undefined}
      onClose={undefined}
      openController={openController}
      onnavi_request_open={(e) => {
        openController.open(e, {
          anchor: e.detail?.anchor ?? e.detail?.source,
        });
      }}
      onnavi_request_close={(e) => {
        openController.requestClose(e, { isCancel: e.detail?.isCancel });
      }}
    />
  );
};

// Picks which rendering strategy actually mounts, from the `anchor` prop
// alone (see this file's top comment) — done here, after the
// controlled/uncontrolled split above, so an openController is always
// already resolved by the time PopoverViaAttribute/PopoverCustom (and the
// usePopoverProps hook they share) ever run.
const ControlledPopover = (props) => {
  if (props.anchor === "scrollContainer") {
    return <PopoverCustom {...props} />;
  }
  return <PopoverViaAttribute {...props} />;
};

// See this file's top comment for why this and PopoverCustom are two
// components sharing one hook, rather than one component branching
// internally.
const PopoverViaAttribute = (props) => {
  const [backdropProps, contentProps] = usePopoverProps(props);
  return (
    <>
      {backdropProps && <Box {...backdropProps} />}
      <Box {...contentProps} />
    </>
  );
};

const PopoverCustom = (props) => {
  const [backdropProps, contentProps] = usePopoverProps(props);
  return (
    <>
      {backdropProps && <Box {...backdropProps} />}
      <Box {...contentProps} />
    </>
  );
};

/**
 * Everything both rendering strategies share once an `openController` is
 * already resolved (by `ControlledPopover`'s callers above): focus/debug/id
 * plumbing, capture setup, animation-attribute resolution, the open-commit
 * sequence, the close handler, and the open/position/close sequence itself
 * — inlined here, branching on `isCustom` at each point the two renderers
 * genuinely differ (see this file's top comment for why it's inlined
 * rather than split into two functions). Returns `[backdropProps,
 * contentProps]` — two plain prop objects ready to spread onto a
 * backdrop/content element each.
 *
 * `options.usesCustomRenderer` overrides the default derivation from the
 * `anchor` prop — nothing passes it yet; it exists so a future caller can
 * force a strategy without relying on `anchor`'s own value.
 */
const usePopoverProps = (props, options = {}) => {
  const {
    openController,
    anchor: anchorProp,
    // Only meaningful when anchorProp isn't a real ref/DOM element — see
    // this file's top comment.
    ignoreEventAnchor = false,
    // see the anchorArea grammar in the file's top comment
    anchorArea = "below",
    anchorAreaFixed,
    scrollCapture,
    pointerInteractionOutsideEffect = "none",
    focusCapture,
    animation,
    children,
    anchorSpacing = 0,
    containerSpacing = 0,
    // Makes the popover itself a valid focus target so autoFocus="fallback"
    // below has somewhere to land when it contains nothing focusable of its
    // own — -1 keeps it out of the normal Tab order (it's only ever reached
    // programmatically).
    tabIndex = -1,
    // See use_auto_focus.js's own docs for why this must never reach the DOM
    // as a plain `autofocus` attribute — useAutoFocus below takes over
    // instead, so it's read here rather than left in `rest`.
    autoFocus = "fallback",
    ...rest
  } = props;

  // Decided once per render from the raw prop (never from the
  // event-carried anchor) — see this file's top comment.
  const isCustom =
    options.usesCustomRenderer ?? anchorProp === "scrollContainer";

  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const backdropRef = useRef();
  // Disarms a still-pending backdrop hide from a previous close (see
  // armPointerDownOutsideClose below) — set at close time, read at the next
  // open, two separate invocations of openEffect that don't otherwise share
  // any scope, hence the ref.
  const disarmBackdropHideRef = useRef(null);
  const defaultId = useId();
  const id = rest.id || defaultId;
  const backdropId = `${id}-backdrop`;
  const debugPopup = useDebugPopup();
  const debugFocus = useDebugFocus();
  const debugInteraction = useDebugInteraction();
  const autoFocusProps = useAutoFocus(ref, autoFocus);
  // animation={true} or "auto" always resolves to "sliding" or "scaling"
  // (see resolveAutoAnimationKind).
  const isAutoAnimation = animation === true || animation === "auto";

  const hasBackdrop = pointerInteractionOutsideEffect !== "none";
  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.setAttribute("aria-expanded", "false");
      // The custom renderer has no native show/hide mechanism to lean on —
      // starts hidden via a plain inline style instead, managed entirely in
      // JS from here on (see the isCustom branch below).
      if (isCustom) {
        ref.current.style.display = "none";
      }
    }
    if (backdropRef.current) {
      backdropRef.current.setAttribute("aria-expanded", "false");
      if (isCustom) {
        backdropRef.current.style.display = "none";
      }
    }
  }, [isCustom]);

  openController.openEffect = (e) => {
    const popoverEl = ref.current;
    // backdropEl is null when pointerInteractionOutsideEffect is "none" —
    // the backdrop isn't rendered at all in that case.
    const backdropEl = backdropRef.current;
    if (!popoverEl) {
      return undefined;
    }

    const [cleanup, addCleanup] = createPubSub(true);

    // Anchor resolution is the first genuine fork: the custom renderer
    // never has a real anchor at all (see this file's top comment) — it
    // always sticks to its own positioned ancestor instead.
    const anchor = isCustom
      ? undefined
      : resolvePositioningAnchor(anchorProp, e, {
          ignoreEventAnchor,
          noRealAnchorValue: "viewport",
        });
    const hasAnchorElement = Boolean(anchor);
    const positionedAncestor = isCustom ? getPositionedParent(popoverEl) : null;

    const { parsedAnchorArea, slideDirectionKey, resolvedAnimationKind } =
      resolveAnchorAreaAndAnimationKind({
        anchorArea,
        isAutoAnimation,
        animation,
        animationAnchor: anchor,
      });

    // Must be resolved (at least the "is this going to be a slide-from-*
    // value" fact) before the popover is ever measured/positioned below —
    // see this file's top comment for why.
    if (!isCustom) {
      if (resolvedAnimationKind === "sliding") {
        popoverEl.setAttribute("navi-animation", "slide-from-top");
      } else {
        popoverEl.removeAttribute("navi-animation");
      }
    }

    // Suppressed until the popover is actually measured/positioned below —
    // see this file's top comment for why @starting-style can't drive the
    // opening transition (it needs the popover's actual resting position
    // already in place, which requires a layout box that only exists once
    // shown).
    popoverEl.style.transitionProperty = "none";

    if (isCustom) {
      // Not "showPopover()" — just making it visible again, synchronously,
      // so it's measurable below even though aria-expanded is still
      // "false" (see this file's top comment for why the two are
      // deliberately decoupled).
      popoverEl.style.display = "";
    } else {
      popoverEl.showPopover();
      // aria-expanded stays "false" here — transitions are still
      // suppressed, so this doesn't matter yet — and only flips once
      // positioned below.
    }

    if (backdropEl) {
      // Disarm a still-pending hide from a previous close: a click
      // arriving later must not hide the fresh instance this open is
      // about to show.
      disarmBackdropHideRef.current?.();
      disarmBackdropHideRef.current = null;
      if (isCustom) {
        backdropEl.style.transitionProperty = "none";
        backdropEl.style.display = "";
        backdropEl.setAttribute("aria-expanded", "true");
        backdropEl.getBoundingClientRect();
        backdropEl.style.transitionProperty = "";
      } else {
        // Hidden first if a previous close's deferred hidePopover() (see
        // the close handler below) hasn't run yet — showPopover() throws
        // on an already-open element. Showing it fresh here (rather than
        // reusing an older still-open instance) resets its top-layer
        // position to right below the real popover, which matters when
        // other popovers already opened in between.
        if (backdropEl.matches(":popover-open")) {
          backdropEl.hidePopover();
        }
        // Same reflow trick as the real popover below (no @starting-style):
        // the backdrop's own fade needs a genuinely rendered "closed" frame
        // to transition from, not a jump straight from not-rendered to
        // aria-expanded="true".
        backdropEl.style.transitionProperty = "none";
        backdropEl.showPopover();
        backdropEl.getBoundingClientRect();
        backdropEl.style.transitionProperty = "";
        backdropEl.setAttribute("aria-expanded", "true");
      }
    }

    // What we observe for repositioning on resize/scroll/visibility
    // changes: the positioned ancestor for the custom renderer, the anchor
    // when anchored, otherwise the whole document.
    const effectiveAnchor = isCustom
      ? positionedAncestor
      : anchor || document.documentElement;

    const positionPopover = (positionEvent) => {
      let appliedLeft;
      let top;

      if (isCustom) {
        const ancestorRect = positionedAncestor.getBoundingClientRect();
        const ancestorBorders = getBorderSizes(positionedAncestor);
        // Container rect already expressed in the ancestor's own local
        // coordinate space (origin at its own padding-box top-left) — no
        // document-relative conversion needed, unlike the via-attribute
        // renderer.
        const containerRect = {
          left: 0,
          top: 0,
          right:
            ancestorRect.width - ancestorBorders.left - ancestorBorders.right,
          bottom:
            ancestorRect.height - ancestorBorders.top - ancestorBorders.bottom,
          width:
            ancestorRect.width - ancestorBorders.left - ancestorBorders.right,
          height:
            ancestorRect.height - ancestorBorders.top - ancestorBorders.bottom,
        };
        const spacingPx = resolveSpacingSize(anchorSpacing);
        const stickPosition = computeStickToPosition(
          popoverEl,
          containerRect,
          slideDirectionKey,
          spacingPx,
          {
            scrollLeft: positionedAncestor.scrollLeft,
            scrollTop: positionedAncestor.scrollTop,
          },
        );
        appliedLeft = stickPosition.left;
        top = stickPosition.top;
      } else if (hasAnchorElement) {
        const { width, height } = anchor.getBoundingClientRect();
        const {
          left: borderLeft,
          right: borderRight,
          top: borderTop,
          bottom: borderBottom,
        } = getBorderSizes(anchor);
        popoverEl.style.setProperty(
          "--anchor-width",
          `${snapToPixel(width)}px`,
        );
        popoverEl.style.setProperty(
          "--anchor-height",
          `${snapToPixel(height)}px`,
        );
        popoverEl.style.setProperty(
          "--anchor-inner-width",
          `${snapToPixel(width - borderLeft - borderRight)}px`,
        );
        popoverEl.style.setProperty(
          "--anchor-inner-height",
          `${snapToPixel(height - borderTop - borderBottom)}px`,
        );
        const minLeft = 1;
        // Remove max-height constraint so pickPositionRelativeTo measures the natural
        // (unconstrained) height of the popover. This ensures the 60% flip threshold
        // compares against the real content height, not the already-truncated one.
        popoverEl.style.removeProperty("--space-available");
        let effectivePositionXFixed;
        let effectivePositionYFixed;
        if (anchorAreaFixed) {
          const parsedAnchorAreaFixed = parseAnchorArea(anchorAreaFixed);
          if (!parsedAnchorAreaFixed) {
            console.warn(
              `Popover: invalid anchorAreaFixed="${anchorAreaFixed}"`,
            );
          } else {
            effectivePositionXFixed = parsedAnchorAreaFixed.x;
            effectivePositionYFixed = parsedAnchorAreaFixed.y;
          }
        }
        const {
          left,
          top: pickedTop,
          positionY: pickedPositionY,
          spaceAbove,
          spaceBelow,
        } = pickPositionRelativeTo(popoverEl, anchor, {
          positionX: parsedAnchorArea.x,
          positionY: parsedAnchorArea.y,
          positionXFixed: effectivePositionXFixed,
          positionYFixed: effectivePositionYFixed,
          spacing: resolveSpacingSize(anchorSpacing),
          viewportSpacing: resolveSpacingSize(containerSpacing),
          minLeft,
        });
        const spaceAvailable =
          pickedPositionY === "above" || pickedPositionY === "aligned-bottom"
            ? spaceAbove
            : spaceBelow;
        popoverEl.style.setProperty("--space-available", `${spaceAvailable}px`);
        appliedLeft = Math.max(left, minLeft);
        top = pickedTop;
      } else {
        // No real anchor: dock against the viewport itself, via
        // pickPositionRelativeTo's own document.documentElement sentinel —
        // see this file's top comment for why (and for toDockPosition's
        // own role). --space-available is deliberately left untouched here
        // (cleared, not set) — a docked popover always relies on the CSS's
        // own --popover-maxmax-height ceiling instead, same as before this
        // reused pickPositionRelativeTo for this case.
        popoverEl.style.removeProperty("--space-available");
        const dockX = toDockPosition(parsedAnchorArea.x);
        const dockY = toDockPosition(parsedAnchorArea.y);
        const { left, top: pickedTop } = pickPositionRelativeTo(
          popoverEl,
          document.documentElement,
          {
            positionX: dockX,
            positionY: dockY,
            positionXFixed: dockX,
            positionYFixed: dockY,
            viewportSpacing: resolveSpacingSize(anchorSpacing),
          },
        );
        appliedLeft = left;
        top = pickedTop;
      }

      debugPopup(
        positionEvent,
        `positionPopover() -> left: ${appliedLeft}, top: ${top}`,
      );
      popoverEl.style.top = `${top}px`;
      popoverEl.style.left = `${appliedLeft}px`;
    };

    setupPositionalCaptures(popoverEl, {
      scrollCapture,
      focusCapture,
      debugFocus,
      addCleanup,
    });

    const rectEffect = visibleRectEffect(
      effectiveAnchor,
      ({ visibilityRatio }, { event }) => {
        // Only a real anchor can meaningfully go "out of view" — gating on
        // document.documentElement's own visibilityRatio (used for
        // anchorless/docked popups) would wrongly skip positioning on a
        // tall page, since its ratio is often low even when nothing's
        // hidden. hasAnchorElement is already false for the custom
        // renderer, so this never triggers for it either.
        if (hasAnchorElement && visibilityRatio <= 0.2) {
          popoverEl.setAttribute("data-anchor-out-of-view", "");
          return;
        }
        popoverEl.removeAttribute("data-anchor-out-of-view");
        positionPopover(event);
      },
      {
        event: e,
        // it's ok for the popover to become unsync with the anchor size
        // (we could even argue it's a feature as it helps to keep the popover position stable)
        skipElementResize: true,
      },
    );
    // Re-run positioning whenever the popover's own content changes size
    // while open (e.g. an expand/collapse toggle inside it) — not just when
    // the anchor itself moves/resizes/re-anchors.
    rectEffect.observeSize(popoverEl);
    addCleanup(() => {
      rectEffect.disconnect();
    });

    // Resolved here, once, now that rectEffect's own setup has already
    // called positionPopover() above and the actual position is known —
    // see applyResolvedAnimation's own comment for why this timing matters,
    // and this file's top comment for why the "is it slide-from-*"
    // question was already answered earlier, before positioning, for
    // position: fixed's own sake.
    const hasCssTransitionAnimation = applyResolvedAnimation(
      popoverEl,
      backdropEl,
      resolvedAnimationKind,
      parsedAnchorArea,
    );

    const { cancelOpenInteractionSuppression, restoreFocus } = commitOpen({
      popoverEl,
      hasCssTransitionAnimation,
      openController,
      e,
      debugPopup,
      logMessage: isCustom
        ? `openPopover() -> scroll-container (local)`
        : `openPopover() -> anchor: ${anchor?.tagName}, hasAnchorElement: ${hasAnchorElement}`,
    });

    return buildCloseHandler({
      popoverEl,
      backdropEl,
      cancelOpenInteractionSuppression,
      hasCssTransitionAnimation,
      disarmBackdropHideRef,
      restoreFocus,
      cleanup,
      debugPopup,
      hidePopoverImpl: isCustom
        ? () => {
            popoverEl.style.display = "none";
          }
        : () => popoverEl.hidePopover(),
      hideBackdropImpl: isCustom
        ? () => {
            backdropEl.style.display = "none";
          }
        : () => backdropEl.hidePopover(),
    });
  };

  const onKeyDownShortcuts = createOnKeyDownForShortcuts({
    escape: (e) => {
      if (!openController.opened) {
        return null;
      }
      return {
        name: "escape_to_cancel",
        allowed: () => {
          openController.requestClose(e, { isCancel: true });
        },
      };
    },
  });

  const backdropProps = hasBackdrop
    ? {
        "ref": backdropRef,
        "id": backdropId,
        // See this file's top comment for the backdrop's design. No
        // document.body/createPortal needed either way: for the
        // via-attribute renderer, top-layer promotion (not DOM position) is
        // what puts it above normal page content; for the custom renderer,
        // it's a plain sibling confined to the same positioned ancestor.
        "popover": isCustom ? undefined : "manual",
        "baseClassName": "navi_popover_backdrop",
        "aria-hidden": "true",
        "styleCSSVars": POPUP_STYLE_CSS_VARS,
        "animationDuration": rest.animationDuration,
        "data-pointer-interaction-outside": pointerInteractionOutsideEffect,
        "onMouseDown": (mouseDownEvent) => {
          if (mouseDownEvent.button !== 0) {
            return;
          }
          // Ignore clicks that land inside the popover's bounding rect
          // (padding and border area are part of the popover box but can
          // forward pointer events to the backdrop behind them).
          const rect = ref.current.getBoundingClientRect();
          const isOutside =
            mouseDownEvent.clientX < rect.left ||
            mouseDownEvent.clientX > rect.right ||
            mouseDownEvent.clientY < rect.top ||
            mouseDownEvent.clientY > rect.bottom;
          if (!isOutside) {
            return;
          }
          // "capture" absorbs the click so it doesn't reach whatever's
          // behind the popover, without closing it. "none" never reaches
          // here at all — the backdrop isn't rendered in that case.
          if (pointerInteractionOutsideEffect === "capture") {
            mouseDownEvent.preventDefault();
            return;
          }
          if (pointerInteractionOutsideEffect === "close") {
            openController.requestClose(mouseDownEvent, { isCancel: true });
            return;
          }
        },
      }
    : null;

  const contentProps = {
    id,
    "popover": isCustom ? undefined : "manual",
    tabIndex,
    "navi-animation": isAutoAnimation ? undefined : animation,
    "styleCSSVars": POPUP_STYLE_CSS_VARS,
    ...rest,
    ...autoFocusProps,
    ref,
    "baseClassName": "navi_popover",
    "pseudoClasses": POPOVER_PSEUDO_CLASSES,
    "onnavi_command": (e) => {
      onNaviCommand(e);
    },
    "onnavi_request_interaction": (e) => {
      onRequestInteraction(e, { debugInteraction });
    },
    "onKeyDown": onKeyDownShortcuts,
    children,
    // onnavi_request_open/onnavi_request_close: for the uncontrolled case,
    // already arrive here as plain props via ...rest (wired by
    // UncontrolledPopover above, forwarded through ControlledPopover's own
    // {...props} spread) — nothing extra to add here. A controlled caller
    // (picker_custom.jsx/side_panel.jsx) wires its own equivalent handling
    // directly against its own openController instead.
  };

  return [backdropProps, contentProps];
};

/* ============================================================
 * Shared helpers
 * ============================================================ */

const POPOVER_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":focus-within",
];

// Lets consumers pass animationDuration="0.5s"/borderRadius="8px" as regular
// props; Box maps them to the CSS vars for us (see box.jsx's styleCSSVars
// handling).
const POPUP_STYLE_CSS_VARS = {
  animationDuration: "--popup-animation-duration",
  maxWidth: "--popover-max-width",
  maxHeight: "--popover-max-height",
};

/**
 * Resolves the `anchor` prop (and, unless `ignoreEventAnchor`, the event's
 * own carried anchor) into a real anchor element, or `undefined` — the
 * caller derives `hasAnchorElement`/`Boolean(anchor)` from that itself, see
 * this file's top comment for why it isn't named "isRealAnchor"/similar.
 * `noRealAnchorValue` is the one string value this renderer accepts for
 * "no anchor" ("viewport" for the via-attribute renderer — the custom
 * renderer never calls this at all, since it never has a real-anchor case).
 * @returns {HTMLElement|undefined}
 */
const resolvePositioningAnchor = (
  anchorProp,
  e,
  { ignoreEventAnchor, noRealAnchorValue },
) => {
  if (anchorProp === noRealAnchorValue) {
    if (!ignoreEventAnchor && e.detail.anchor) {
      return e.detail.anchor;
    }
    return undefined;
  }
  if (typeof anchorProp === "string") {
    console.warn(
      `Popover: unknown anchor="${anchorProp}" (expected "${noRealAnchorValue}", "scrollContainer", a ref, or a DOM element)`,
    );
    return undefined;
  }
  if (anchorProp) {
    // anchor prop is a ref or a DOM element — always a real anchor,
    // regardless of ignoreEventAnchor.
    return anchorProp.current ?? anchorProp;
  }
  if (!ignoreEventAnchor && e.detail.anchor) {
    return e.detail.anchor;
  }
  return undefined;
};

// See the anchorArea grammar in this file's top comment.
const ANCHOR_AREA_X_VALUES = new Set([
  "on-the-left",
  "aligned-left",
  "center",
  "aligned-right",
  "on-the-right",
]);
const ANCHOR_AREA_Y_VALUES = new Set([
  "above",
  "aligned-top",
  "center",
  "aligned-bottom",
  "below",
]);
const ANCHOR_AREA_PRESETS = {
  "top-left": { y: "aligned-top", x: "aligned-left" },
  "top-right": { y: "aligned-top", x: "aligned-right" },
  "bottom-left": { y: "aligned-bottom", x: "aligned-left" },
  "bottom-right": { y: "aligned-bottom", x: "aligned-right" },
};

/**
 * Parses an anchorArea string into a { y, x } pair, or null if it's not a
 * recognized preset/word/pair.
 */
const parseAnchorArea = (
  value,
  { defaultX = "center", defaultY = "center" } = {},
) => {
  if (ANCHOR_AREA_PRESETS[value]) {
    return ANCHOR_AREA_PRESETS[value];
  }
  const tokens = value.split(" ");
  if (tokens.length === 1) {
    const [token] = tokens;
    if (token === "center") {
      return { y: "center", x: "center" };
    }
    if (ANCHOR_AREA_Y_VALUES.has(token)) {
      return { y: token, x: defaultX };
    }
    if (ANCHOR_AREA_X_VALUES.has(token)) {
      return { y: defaultY, x: token };
    }
    return null;
  }
  if (tokens.length === 2) {
    const [a, b] = tokens;
    // Every value but "center" is unique to one axis, so either order
    // works — whichever token is the Y value becomes y, the other x.
    if (ANCHOR_AREA_Y_VALUES.has(a) && ANCHOR_AREA_X_VALUES.has(b)) {
      return { y: a, x: b };
    }
    if (ANCHOR_AREA_X_VALUES.has(a) && ANCHOR_AREA_Y_VALUES.has(b)) {
      return { y: b, x: a };
    }
  }
  return null;
};

/**
 * Collapses a bare anchorArea value ("above"/"below"/"on-the-left"/
 * "on-the-right") to its "aligned-*" equivalent — "aligned-*"/"center"
 * values pass through unchanged. Used only by the via-attribute renderer's
 * own docked (no real anchor) positioning case — see this file's top
 * comment for why: docking has no "float away with a gap" concept, so the
 * bare/aligned distinction (meaningful only against a real anchor box)
 * would be nonsensical left as-is.
 */
const toDockPosition = (value) => {
  if (value === "above") {
    return "aligned-top";
  }
  if (value === "below") {
    return "aligned-bottom";
  }
  if (value === "on-the-left") {
    return "aligned-left";
  }
  if (value === "on-the-right") {
    return "aligned-right";
  }
  return value;
};

/**
 * Collapses an anchorArea y/x pair into the 8-compass-point + "center"
 * vocabulary computeStickToPosition keys off — the overlap distinction
 * (above/aligned-top, etc.) doesn't apply to the custom renderer's own
 * docked positioning (it has no anchor box to overlap with).
 */
const toSlideDirectionKey = (y, x) => {
  const yKey =
    y === "above" || y === "aligned-top"
      ? "top"
      : y === "below" || y === "aligned-bottom"
        ? "bottom"
        : "center";
  const xKey =
    x === "on-the-left" || x === "aligned-left"
      ? "left"
      : x === "on-the-right" || x === "aligned-right"
        ? "right"
        : "center";
  if (yKey === "center") {
    return xKey;
  }
  if (xKey === "center") {
    return yKey;
  }
  return `${yKey}-${xKey}`;
};

/**
 * Shared by both renderers: parses `anchorArea`, derives the compass-point
 * key the custom renderer's own `computeStickToPosition` needs, and
 * resolves `animation="auto"`/`true`. `animationAnchor` is the real anchor
 * element for the via-attribute renderer's auto-animation resolution, or
 * `undefined` for the custom renderer (which never has one — see
 * resolveAutoAnimationKind's own comment).
 */
const resolveAnchorAreaAndAnimationKind = ({
  anchorArea,
  isAutoAnimation,
  animation,
  animationAnchor,
}) => {
  const anchorAreaParseResult = parseAnchorArea(anchorArea);
  if (!anchorAreaParseResult) {
    console.warn(`Popover: invalid anchorArea="${anchorArea}"`);
  }
  const parsedAnchorArea = anchorAreaParseResult ?? {
    y: "below",
    x: "center",
  };
  const slideDirectionKey = toSlideDirectionKey(
    parsedAnchorArea.y,
    parsedAnchorArea.x,
  );
  const resolvedAnimationKind = isAutoAnimation
    ? resolveAutoAnimationKind(animationAnchor, parsedAnchorArea)
    : animation;
  return { parsedAnchorArea, slideDirectionKey, resolvedAnimationKind };
};

/**
 * Maps an anchorArea y/x pair to a concrete `navi-animation` value (a
 * `prefix` plus a direction word), or `null` if both axes overlap the anchor
 * (no direction at all — that's `resolvedAnimation === "scaling"` territory
 * instead, see applyResolvedAnimation).
 *
 * `isRealAnchor: false` (no real anchor, used only with `prefix:
 * "slide-from"`) keeps the word as the compass direction the popover comes
 * from: placed "above" (a point/corner), it slides in from the top.
 * `isRealAnchor: true` (a real anchor, used only with `prefix: "expand"` —
 * via-attribute only) uses the motion/growth direction instead, the
 * opposite compass point: placed "above" the anchor, it moves/grows up,
 * away from the anchor (which sits below it).
 *
 * "aligned-*"/"center" contribute no direction on their axis either way.
 */
const resolveDirectionValue = (y, x, { isRealAnchor, prefix }) => {
  const yWord =
    y === "above"
      ? isRealAnchor
        ? "up"
        : "top"
      : y === "below"
        ? isRealAnchor
          ? "down"
          : "bottom"
        : null;
  const xWord =
    x === "on-the-left" ? "left" : x === "on-the-right" ? "right" : null;
  if (!yWord && !xWord) {
    return null;
  }
  return yWord && xWord
    ? `${prefix}-${yWord}-${xWord}`
    : `${prefix}-${yWord || xWord}`;
};

/**
 * "sliding"/"expanding" need a concrete direction (see
 * resolveDirectionValue) — must be called only once the popover has
 * actually been positioned (pickPositionRelativeTo, for a real anchor, may
 * have picked a different side than requested, written onto
 * data-position-y/x-current — reading that back is what makes "expanding"
 * point the right way), and before transitions are re-enabled (same
 * constraint as positioning itself). Mirrors the resolved value onto the
 * backdrop too (see the backdrop's own CSS comment for why it only ever
 * fades regardless of which kind it is). Returns whether there's an actual
 * CSS transition to account for elsewhere (pointer-event suppression,
 * commitOpen/buildCloseHandler).
 */
const applyResolvedAnimation = (
  popoverEl,
  backdropEl,
  resolvedAnimationKind,
  parsedAnchorArea,
) => {
  let resolvedAnimation = resolvedAnimationKind;
  if (resolvedAnimationKind === "sliding") {
    resolvedAnimation =
      resolveDirectionValue(parsedAnchorArea.y, parsedAnchorArea.x, {
        isRealAnchor: false,
        prefix: "slide-from",
      }) ?? "slide-from-top";
  } else if (resolvedAnimationKind === "expanding") {
    resolvedAnimation =
      resolveDirectionValue(
        popoverEl.getAttribute("data-position-y-current"),
        popoverEl.getAttribute("data-position-x-current"),
        { isRealAnchor: true, prefix: "expand" },
      ) ?? "expand-up";
  }
  if (resolvedAnimation) {
    popoverEl.setAttribute("navi-animation", resolvedAnimation);
    // The backdrop mirrors the same value, but only ever fades
    // regardless of which kind it is — see the backdrop's own CSS
    // comment for why.
    backdropEl?.setAttribute("navi-animation", resolvedAnimation);
  } else {
    popoverEl.removeAttribute("navi-animation");
    backdropEl?.removeAttribute("navi-animation");
  }
  return Boolean(resolvedAnimationKind);
};

/**
 * Places the popover pinned to an anchor point of `containerRect` — the
 * custom renderer's own positioned ancestor, in its own local coordinate
 * space (see this file's top comment for why the via-attribute renderer's
 * equivalent docked case uses `pickPositionRelativeTo` directly instead, via
 * its `document.documentElement` sentinel, rather than this function).
 */
const computeStickToPosition = (
  popoverEl,
  containerRect,
  anchorPoint,
  spacingPx,
  scrollOffset,
) => {
  // offsetWidth/offsetHeight (layout box), not getBoundingClientRect(): the
  // popover may have an active CSS scale transform mid-animation (e.g.
  // animation="scaling"), which would otherwise report a shrunk size and
  // throw off the position math (see the matching fix in pickPositionRelativeTo).
  const width = popoverEl.offsetWidth;
  const height = popoverEl.offsetHeight;
  const { scrollLeft, scrollTop } = scrollOffset;

  let left;
  if (
    anchorPoint === "top-left" ||
    anchorPoint === "bottom-left" ||
    anchorPoint === "left"
  ) {
    left = containerRect.left + spacingPx;
  } else if (
    anchorPoint === "top-right" ||
    anchorPoint === "bottom-right" ||
    anchorPoint === "right"
  ) {
    left = containerRect.right - spacingPx - width;
  } else {
    left = containerRect.left + containerRect.width / 2 - width / 2;
  }

  let top;
  if (
    anchorPoint === "top-left" ||
    anchorPoint === "top" ||
    anchorPoint === "top-right"
  ) {
    top = containerRect.top + spacingPx;
  } else if (
    anchorPoint === "bottom-left" ||
    anchorPoint === "bottom" ||
    anchorPoint === "bottom-right"
  ) {
    top = containerRect.bottom - spacingPx - height;
  } else {
    top = containerRect.top + containerRect.height / 2 - height / 2;
  }

  return {
    left: snapToPixel(left + scrollLeft),
    top: snapToPixel(top + scrollTop),
  };
};

/**
 * Shared `animation="auto"`/`true` resolution: "scaling" reads best overall
 * (see this file's top comment) — picked for any real anchor, or for a
 * point/corner placed dead-center (both anchorArea axes overlapping —
 * there's no sensible direction to slide from in that case). "sliding"
 * otherwise. `anchor` is always `undefined` for the custom renderer (it
 * never has a real anchor — see this file's top comment), so this
 * collapses to "scaling" there only for the dead-center case, "sliding"
 * otherwise.
 */
const resolveAutoAnimationKind = (anchor, parsedAnchorArea) => {
  const yOverlapsAnchor =
    parsedAnchorArea.y !== "above" && parsedAnchorArea.y !== "below";
  const xOverlapsAnchor =
    parsedAnchorArea.x !== "on-the-left" &&
    parsedAnchorArea.x !== "on-the-right";
  return anchor || (yOverlapsAnchor && xOverlapsAnchor) ? "scaling" : "sliding";
};

/**
 * Shared by both renderers: arms scroll/focus capture on the popover
 * element, registering cleanup via the caller's own `addCleanup`
 * (createPubSub, scoped to this one open/close cycle).
 */
const setupPositionalCaptures = (
  popoverEl,
  { scrollCapture, focusCapture, debugFocus, addCleanup },
) => {
  if (scrollCapture) {
    addCleanup(trapScrollInside(popoverEl));
  }
  if (focusCapture) {
    addCleanup(trapFocusInside(popoverEl, { debug: debugFocus }));
  }
};

/**
 * Shared by both renderers: the final step of every open — commits the
 * correctly positioned "closed" frame set up by the caller as a real
 * rendered state (the reflow), re-enables transitions, flips
 * `aria-expanded="true"` (only then does the CSS transition play, from
 * that just-committed frame to the open one, with no @starting-style
 * involved at all — see this file's top comment), suppresses pointer
 * events until it settles, and transfers focus in. Returns the two values
 * the caller's own close handler needs later.
 */
const commitOpen = ({
  popoverEl,
  hasCssTransitionAnimation,
  openController,
  e,
  debugPopup,
  logMessage,
}) => {
  popoverEl.getBoundingClientRect();
  popoverEl.style.transitionProperty = "";
  popoverEl.setAttribute("aria-expanded", "true");
  const cancelOpenInteractionSuppression = hasCssTransitionAnimation
    ? suppressPointerEventsDuringTransition(popoverEl)
    : null;
  const restoreFocus = openController.transferFocusOnOpen(popoverEl);
  debugPopup(e, logMessage);
  return { cancelOpenInteractionSuppression, restoreFocus };
};

/**
 * Shared by both renderers: builds the close callback `openEffect` returns.
 * `hidePopoverImpl`/`hideBackdropImpl` are the one thing that genuinely
 * differs — `hidePopover()` for the via-attribute renderer, a plain
 * `style.display = "none"` for the custom one (see this file's top comment
 * for why neither needs extra JS-side deferral to still animate out
 * correctly).
 */
const buildCloseHandler = ({
  popoverEl,
  backdropEl,
  cancelOpenInteractionSuppression,
  hasCssTransitionAnimation,
  disarmBackdropHideRef,
  restoreFocus,
  cleanup,
  debugPopup,
  hidePopoverImpl,
  hideBackdropImpl,
}) => {
  return (closeEvent) => {
    debugPopup(closeEvent, `closePopover()`);
    popoverEl.setAttribute("aria-expanded", "false");
    hidePopoverImpl();
    // Not interactive while it's leaving either — cancel the open side's
    // still-pending suppression first, since a fresh one below fully
    // replaces it (nothing ever needs to cancel this one in turn: a closed
    // popover can stay non-interactive indefinitely, and the next open is
    // its own separate call with no way to reach back into this one).
    cancelOpenInteractionSuppression?.();
    if (hasCssTransitionAnimation) {
      suppressPointerEventsDuringTransition(popoverEl);
    }
    if (backdropEl) {
      backdropEl.setAttribute("aria-expanded", "false");
      disarmBackdropHideRef.current = armPointerDownOutsideClose(
        closeEvent,
        hideBackdropImpl,
      );
    }
    restoreFocus(closeEvent);

    cleanup();
  };
};

/**
 * Disables pointer-events on `el` until its current CSS transition settles
 * (via `transitionend`, with a safety `setTimeout` fallback matching the
 * longest `transition-duration` in case nothing actually transitions or an
 * event is missed) — avoids the cursor changing/something becoming
 * clickable while the popover is still visually moving into or out of
 * place.
 *
 * Returns a "cancel" function: doesn't restore pointer-events (a fresh call
 * for the next open/close is about to set its own state) — only prevents
 * this stale instance's `transitionend` listener/timeout from firing later
 * and clobbering that fresh state.
 */
const suppressPointerEventsDuringTransition = (el) => {
  el.style.pointerEvents = "none";
  let settled = false;
  const onTransitionEnd = (transitionEvent) => {
    if (transitionEvent.target === el) {
      finish();
    }
  };
  const finish = () => {
    if (settled) {
      return;
    }
    settled = true;
    el.style.pointerEvents = "";
    el.removeEventListener("transitionend", onTransitionEnd);
    clearTimeout(safetyTimeoutId);
  };
  el.addEventListener("transitionend", onTransitionEnd);
  const durationsInSeconds = getComputedStyle(el)
    .transitionDuration.split(",")
    .map((value) => parseFloat(value) || 0);
  const longestDurationMs = Math.max(0, ...durationsInSeconds) * 1000;
  const safetyTimeoutId = setTimeout(finish, longestDurationMs + 50);
  return () => {
    if (settled) {
      return;
    }
    settled = true;
    el.removeEventListener("transitionend", onTransitionEnd);
    clearTimeout(safetyTimeoutId);
  };
};

/**
 * Hides the backdrop, deferring until the browser's matching "click" fires
 * when `closeEvent` was triggered by a mousedown (see this file's top
 * comment for why) — same capture-phase-on-document pattern as
 * armSuppressNextOpenRequest in open_controller.js, which a plain timeout
 * can't safely replace: mouseup (and the click that follows it) can land an
 * arbitrarily long time after mousedown (the user is still holding the
 * button down), so a short timeout can fire first and hide the backdrop
 * before its own click ever arrives. A capture-phase listener on document
 * fires for every click regardless of what any bubble-phase handler does
 * downstream, so no fallback timer is needed.
 *
 * `hide` is the caller's own way to actually hide the backdrop
 * (`hidePopover()` for the via-attribute renderer's top-layer backdrop, a
 * plain `style.display = "none"` for the custom renderer's plain div) —
 * this helper only owns the mousedown/click timing.
 *
 * Returns a disarm function (or undefined if hidden immediately), so a
 * fresh open can cancel a pending hide it's about to make redundant.
 */
const armPointerDownOutsideClose = (closeEvent, hide) => {
  const mousedownEvent = findEvent(closeEvent, "mousedown");
  if (!mousedownEvent) {
    hide();
    return undefined;
  }
  const onClick = () => {
    document.removeEventListener("click", onClick, { capture: true });
    hide();
  };
  document.addEventListener("click", onClick, { capture: true });
  return () => {
    document.removeEventListener("click", onClick, { capture: true });
  };
};

/**
 * A popup positioned via `anchor`/`positionArea`, driven either by
 * --navi-toggle/--navi-open/--navi-close commands, the `open` prop
 * (controlled), or `defaultOpen` (uncontrolled, mount-only — see
 * useOpenControllerByProps in open_controller.js). Whichever of these
 * starts the popover already open at mount plays no entrance animation —
 * nothing was ever shown as "closed" for the user to see it transition away
 * from (see openEffect's own `silent` handling below).
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
 * from the `anchor`/`layer` props alone (no `anchor` given *and*
 * `layer="local"` → `PopoverCustom`, everything else → `PopoverViaAttribute`)
 * — by this point an `openController` is always already resolved.
 *
 * Both components share the exact same `usePopoverProps(props)` hook for
 * everything that doesn't genuinely differ between them, once an
 * `openController` is already resolved: focus/debug/id plumbing, capture
 * setup, animation-attribute resolution, the open-commit sequence, the
 * close handler, and — inlined directly in the hook's own `openEffect`,
 * branching on a single `isTopLayer` flag rather than living in two separate
 * functions — the open/position/close sequence itself. Keeping it inline
 * (instead of splitting into two functions the way an earlier version of
 * this file did) makes the actual, genuine differences between the two
 * renderers easier to see at each point they occur — backdrop show/hide
 * mechanics and anchor-positioning math — rather than having to diff two
 * separately-scrolled functions to find them; everything else in the
 * sequence (capture setup, animation resolution, the commit/close steps)
 * is one shared call either way. `PopoverViaAttribute`/`PopoverCustom`
 * themselves stay two separate, real components (see below) rather than one
 * component branching internally on `isTopLayer` — their JSX bodies already
 * diverge (`PopoverCustom` wraps its content box in an extra
 * `.navi_popover_clip_wrapper` div, see its own CSS comment for why;
 * `PopoverViaAttribute` doesn't need one), and collapsing them into one
 * would just mean re-splitting them apart again the next time that
 * divergence grows.
 *
 * `layer` (`"top"` default | `"local"`) picks the rendering strategy
 * directly — it's *not* about anchor resolution at all, deliberately: it
 * answers "which layer does this popup live in", not "what do we fall back
 * to when there's no anchor". `"top"` → the via-attribute renderer, in the
 * browser's own top layer. `"local"` → the custom renderer, resolved to the
 * popover's own positioned ancestor instead — respects that ancestor's own
 * `overflow: hidden`/`auto`, unlike the top layer (see
 * `getPositioningContainer` in visible_rect.js/offset_parent.js for how
 * it's found). `anchor` (a ref or a DOM element — no other value is
 * accepted anymore; a plain string is a near-certain leftover from an
 * older API and gets a dev warning, then treated the same as omitting it)
 * always wins over `layer` regardless of its value — a real anchor works
 * with either renderer. The custom renderer's popover is still `position:
 * absolute` relative to its own positioned ancestor either way; when a
 * real anchor is also given, it positions against that anchor's own edges
 * instead of the ancestor's, with `pickPositionRelativeTo`'s own
 * `container` option (see visible_rect.js) doing the ancestor-relative
 * coordinate conversion regardless. Whether that anchor happens to live in
 * the same layer as the popover's own container is the integrating dev's
 * own responsibility, not something guarded against here.
 *
 * The logic that a *container* (the viewport, or the positioned ancestor —
 * whichever `layer` resolves to) stands in *as* the thing `element` is
 * positioned relative to whenever there's no real anchor belongs entirely
 * to `pickPositionRelativeTo` itself (its own `container` option, used
 * whenever its own `anchor` argument is omitted — see its own doc in
 * visible_rect.js) — not to this file. `layer` only ever decides the
 * rendering strategy and which container to hand `pickPositionRelativeTo`;
 * it has no opinion on anchor resolution, which is a fully separate
 * question answered below.
 *
 * When there's no `anchor` prop, the triggering event's own carried anchor
 * (`detail.anchor`/`.source`) is used instead, for either renderer — the
 * custom renderer is allowed to be relative to an anchor too, even though
 * it isn't in the top layer; if that anchor turns out to live in a
 * different layer than the popover's own container, that's the
 * integrating dev's own responsibility, not something guarded against here
 * — unless `anchorCustomEventDetail="ignore"` (default `"override"`), which
 * skips that fallback entirely, forcing the `layer`-resolved container
 * placement regardless of what triggered the open (used by the demo's
 * "Ignoring the anchor" section).
 *
 * All of this is resolved down to a single value inline in `openEffect`
 * (only one call site, not worth a standalone function): either a real
 * anchor element, or `undefined` — `hasAnchorElement` (just
 * `Boolean(anchor)`) is what the rest of the code branches on from there,
 * and what gets handed (or not) to `pickPositionRelativeTo`'s own `anchor`
 * argument. Whether we have one or not is now explicit and unambiguous:
 * either there's a real anchor element, or we're positioned relative to the
 * container instead — there's no "anchor fallback" blurring the two.
 * ("Real anchor" isn't quite the right word for `hasAnchorElement` either,
 * since a container being positioned relative to is arguably a real anchor
 * in its own right too — it's meant narrowly: is there a specific *element*
 * being positioned against, as opposed to the container's own rect.)
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
 * `positionArea` (named for what it actually is — not `anchorArea` — since
 * what it positions relative to isn't always a real anchor; loosely
 * inspired by CSS `position-area`) grammar: two space-separated words,
 * order-independent. y: above/aligned-top/center/aligned-bottom/below. x:
 * on-the-left/aligned-left/center/aligned-right/on-the-right. A bare word
 * means no overlap with whatever it's positioned relative to; "aligned-"
 * means edges touching. A single word implies "center" on the other axis
 * (e.g. a corner is spelled out as "aligned-top aligned-left", no
 * dedicated corner presets).
 *
 * When there's no real anchor element (`!hasAnchorElement`, for either
 * renderer whenever no anchor was resolved), both renderers position
 * relative to a container
 * instead — the viewport itself for via-attribute, this popover's own
 * positioned ancestor for the custom renderer — via the *same*
 * `pickPositionRelativeTo` call either way, simply omitting its `anchor`
 * argument (see that function's own doc in visible_rect.js for what its
 * own no-anchor, container-relative mode changes: the "float away with a
 * gap" bare directions collapse to their "aligned-*" equivalent
 * internally, flipping is skipped entirely, and the coordinate space/clamp
 * bounds become the container's own instead of the document's). The
 * via-attribute renderer leaves `container` unspecified —
 * `pickPositionRelativeTo` resolves it to the viewport on its own, since
 * the popover element's own `[popover]` attribute signals that (see
 * `getPositioningContainer`); the custom renderer passes its own
 * positioned ancestor explicitly, already computed above for
 * `visibleRectEffect`'s own observation target.
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
 * concretely — works with either renderer, since a real anchor works with
 * either) and `animation="fading"` (opacity only, no motion) are both
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
 * The via-attribute renderer's own `.navi_popover` is `position: fixed` by
 * default (`&[popover]` below) — genuinely anchored to a real element
 * overrides that back to `position: absolute` instead (`&[popover]
 * [data-anchor]`, `data-anchor` set/removed alongside `hasAnchorElement`,
 * well before any positioning ever runs, so there's no ordering subtlety
 * to get wrong here). The two need opposite defaults for opposite reasons:
 * a real anchor needs `position: absolute` so the popover scrolls in
 * lockstep with the document — and thus stays visually attached to its
 * anchor, which scrolls the same way — whereas `position: fixed` would
 * leave it pinned to the viewport while the anchor scrolls away
 * underneath it; docked-to-the-viewport (no real anchor) has no such
 * anchor to stay attached to, so `position: fixed` is simply the more
 * direct way to express "pinned to the viewport" (and incidentally avoids
 * ever contributing to the document's own scrollable area, which a
 * `position: absolute` box docked near an edge — or animating via a
 * `slide-from-*` entrance, briefly extending further still for its closed
 * frame — otherwise could).
 *
 * `data-anchor-out-of-view` marks a real anchor that's scrolled out of view
 * (`visibilityRatio <= 0.2`) — never set at all when `!hasAnchorElement`,
 * since visibility ratio is meaningless for something docked to the
 * viewport/ancestor rather than a specific element.
 */

import {
  createPubSub,
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
import {
  armPointerDownOutsideClose,
  parsePositionArea,
  resolveAutoAnimationKind,
  resolveDirectionValue,
  suppressPointerEventsDuringTransition,
} from "./popup_shared.js";

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
    --x-popover-max-width: min(
      var(--popover-max-width, var(--popover-maxmax-width)),
      var(--popover-maxmax-width)
    );
    --x-popover-max-height: min(
      var(--popover-max-height),
      var(--space-available, var(--popover-maxmax-height)),
      var(--popover-maxmax-height)
    );

    /* Base default: also the custom renderer's own permanent value — its
       containing block is genuinely its nearest positioned ancestor,
       regardless of anchor. See the [popover] rules below for why the
       via-attribute renderer overrides this differently depending on
       whether it has a real anchor — this file's top comment has the full
       reasoning. */
    position: absolute;
    inset: unset;
    min-width: min(var(--popover-min-width, 0px), var(--x-popover-max-width));
    max-width: var(--x-popover-max-width);
    min-height: min(
      var(--popover-min-height, 0px),
      var(--x-popover-max-height)
    );
    max-height: var(--x-popover-max-height);
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

    /* The via-attribute renderer's own default: an element in the top layer
       always uses the initial containing block regardless of "position",
       so this is really "pinned to the viewport" either way — fixed is
       just the more direct way to say so. Overridden back to absolute
       below when genuinely anchored to a real element — see this file's
       top comment for why the two need opposite defaults. The custom
       renderer (no [popover] attribute) never matches either of these
       rules, it's always the base "position: absolute" above. */
    &[popover] {
      position: fixed;
    }
    &[popover][data-anchor] {
      position: absolute;
    }

    &[data-anchor-out-of-view] {
      opacity: 0;
      pointer-events: none;
    }
  }

  /* Custom renderer only (see this file's top comment) — a plain,
     borderless div sized to exactly match the popover's own positioned
     ancestor (inset: 0 relative to it), existing solely to absorb the
     scrollable-overflow growth some browsers attribute to a translate/scale
     transform mid-animation: without this, a container with overflow:
     hidden/auto can transiently gain a scrollbar while the popover slides
     or scales into/out of place, even though the transform never actually
     moves its layout box. overflow: hidden here clips that growth before it
     ever reaches the real container, whose own geometry this wrapper
     matches exactly, so the wrapper itself never overflows in turn.
     pointer-events: none so the otherwise-empty space around the popover
     doesn't intercept clicks meant for whatever else lives in the same
     container — .navi_popover re-enables it below. */
  .navi_popover_clip_wrapper {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;

    .navi_popover {
      pointer-events: auto;
    }
  }

  /* Sibling element, not a descendant of .navi_popover — see this file's
     top comment for why. */
  .navi_popover_backdrop {
    margin: 0;
    padding: 0;
    background: transparent;
    border: none;
    /* Always clickable while actually rendered (display: none/hidePopover()
       while genuinely closed already makes it non-interactive on its own)
       — an outside click should close the popover even while it's still
       animating in, not just once the entrance transition settles. Only
       the content itself (.navi_popover, via suppressPointerEventsDuringTransition
       in openEffect) gets pointer-events: none mid-transition. */
    pointer-events: auto;
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

    /* Makes pointerInteractionOutsideEffect have a visible impact on backdrop */
    &[data-pointer-interaction-outside="close"] {
      background: var(--navi-backdrop-close-background);
    }
    &[data-pointer-interaction-outside="capture"] {
      background: var(--navi-backdrop-capture-background);
      backdrop-filter: var(--navi-backdrop-capture-backdrop-filter);
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

// Picks which rendering strategy actually mounts, from `layer` alone (see
// this file's top comment) — done here, after the controlled/uncontrolled
// split above, so an openController is always already resolved by the time
// PopoverViaAttribute/PopoverCustom (and the usePopoverProps hook they
// share) ever run. `anchor` doesn't factor into this choice: the custom
// renderer is perfectly compatible with a real anchor too — it's still
// `position: absolute` relative to its own positioned ancestor either way,
// it just positions against the anchor's own edges instead of the
// ancestor's when one is given (see usePopoverProps' own real-anchor
// branch, and pickPositionRelativeTo's own `container` option in
// visible_rect.js for how the ancestor-relative coordinate conversion
// still applies regardless).
const ControlledPopover = (props) => {
  if (props.layer === "local") {
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
      {/* Own positioned ancestor for the popover below, not the backdrop —
          the backdrop only ever fades (no translate/scale), so it can never
          contribute overflow the way the popover's own slide/scale
          animation can (see this file's top comment for why that clip
          wrapper exists at all). */}
      <div className="navi_popover_clip_wrapper">
        <Box {...contentProps} />
      </div>
    </>
  );
};

/**
 * Everything both rendering strategies share once an `openController` is
 * already resolved (by `ControlledPopover`'s callers above): focus/debug/id
 * plumbing, capture setup, animation-attribute resolution, the open-commit
 * sequence, the close handler, and the open/position/close sequence itself
 * — inlined here, branching on `isTopLayer` at each point the two renderers
 * genuinely differ (see this file's top comment for why it's inlined
 * rather than split into two functions). Returns `[backdropProps,
 * contentProps]` — two plain prop objects ready to spread onto a
 * backdrop/content element each.
 */
const usePopoverProps = (props) => {
  const backdropProps = {};
  const contentProps = {};
  const {
    openController,
    anchor: anchorProp,
    // "top" (default) → via-attribute, in the browser's own top layer;
    // "local" → custom, resolved to the popover's own positioned ancestor.
    // Picks the rendering strategy directly — not an "anchor fallback", see
    // this file's top comment for why that distinction matters. Independent
    // of anchorProp — a real anchor works with either renderer.
    layer = "top",
    // "override" (default) lets the triggering event's own carried anchor
    // serve as the real anchor when anchorProp itself is absent; "ignore"
    // skips that fallback. Applies to either renderer — see this file's
    // top comment.
    anchorCustomEventDetail = "override",
    // see the positionArea grammar in the file's top comment
    positionArea = "below",
    positionAreaFixed,
    scrollCapture,
    pointerInteractionOutsideEffect = "none",
    focusCapture,
    animation,
    children,
    marginWithAnchor = 0,
    marginWithContainer = 0,
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
  const isTopLayer = layer === "top";
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
      if (isTopLayer) {
        // Native [popover] starts hidden automatically — nothing to do.
      } else {
        // No native show/hide mechanism to lean on — starts hidden via a
        // plain inline style instead
        ref.current.style.display = "none";
      }
    }
    if (backdropRef.current) {
      backdropRef.current.setAttribute("aria-expanded", "false");
      if (isTopLayer) {
        // Native [popover] starts hidden automatically — nothing to do.
      } else {
        backdropRef.current.style.display = "none";
      }
    }
  }, [isTopLayer]);

  openController.openEffect = (e) => {
    const popoverEl = ref.current;
    // backdropEl is null when pointerInteractionOutsideEffect is "none" —
    // the backdrop isn't rendered at all in that case.
    const backdropEl = backdropRef.current;
    if (!popoverEl) {
      return undefined;
    }

    // Set by useOpenControllerByProps for the very first open triggered by
    // `open`/`defaultOpen` already being truthy at mount — there's nothing
    // to visually transition away from (nothing was ever shown as "closed"
    // to the user), so this open skips the animation entirely instead of
    // playing it against a closed frame that was never actually seen. See
    // the final commit step below for how that's done.
    const silent = Boolean(e.detail.silent);

    const [cleanup, addCleanup] = createPubSub(true);

    // Anchor resolution is the first genuine fork: a real anchorProp works
    // for either renderer (the custom renderer is still `position:
    // absolute` relative to its own positioned ancestor either way — see
    // pickPositionRelativeTo's own `container` option below for how the
    // ancestor-relative coordinate conversion still applies) — only the
    // triggering event's own carried anchor is via-attribute-only, since
    // the custom renderer's own positioned ancestor is already an explicit,
    // deliberate choice, not something to infer from whatever happened to
    // trigger the open. Inlined rather than a standalone function since it
    // only has this one call site.
    let anchor;
    if (typeof anchorProp === "string") {
      // A plain string is a near-certain leftover from an older API
      // (anchor used to accept "viewport"/"scrollContainer" directly) —
      // anchor is a ref or a DOM element only now; layer/
      // anchorCustomEventDetail cover what those strings used to mean.
      console.warn(
        `Popover: anchor="${anchorProp}" is no longer supported — anchor only accepts a ref or a DOM element now. Use layer="local" (was anchor="scrollContainer") or anchorCustomEventDetail="ignore" (was ignoreEventAnchor) instead.`,
      );
      anchor = undefined;
    } else if (anchorProp) {
      // anchor prop is a ref or a DOM element — always a real anchor,
      // regardless of anchorCustomEventDetail.
      anchor = anchorProp.current ?? anchorProp;
    } else if (anchorCustomEventDetail === "override") {
      anchor = e.detail.anchor;
    } else {
      anchor = undefined;
    }
    const hasAnchorElement = Boolean(anchor);
    const positionedAncestor = isTopLayer
      ? null
      : getPositionedParent(popoverEl);
    // Drives the via-attribute renderer's own position: fixed/absolute
    // switch (see this file's top comment) — set here, well before any
    // positioning/measurement runs, so there's no ordering subtlety to get
    // wrong (unlike the CSS this replaced, which keyed off the resolved
    // animation instead, known too late relative to the first measurement).
    if (hasAnchorElement) {
      popoverEl.setAttribute("data-anchor", "");
    } else {
      popoverEl.removeAttribute("data-anchor");
    }

    const { parsedPositionArea, resolvedAnimationKind } =
      resolvePositionAreaAndAnimationKind({
        positionArea,
        isAutoAnimation,
        animation,
        animationAnchor: anchor,
      });

    // Suppressed until the popover is actually measured/positioned below —
    // see this file's top comment for why @starting-style can't drive the
    // opening transition (it needs the popover's actual resting position
    // already in place, which requires a layout box that only exists once
    // shown).
    popoverEl.style.transitionProperty = "none";

    if (backdropEl) {
      // Disarm a still-pending hide from a previous close: a click
      // arriving later must not hide the fresh instance this open is
      // about to show.
      disarmBackdropHideRef.current?.();
      disarmBackdropHideRef.current = null;
      // transitionProperty stays "none" here for both — reset later, in the
      // final commit step alongside popoverEl's own (not resumed early the
      // way it briefly was), so a `silent` open (see above) can keep both
      // elements' transitions suppressed right up until after their
      // aria-expanded flip, the same way it does for popoverEl.
      backdropEl.style.transitionProperty = "none";
      if (isTopLayer) {
        // Hidden first if a previous close's deferred hidePopover() (see
        // the close handler below) hasn't run yet — showPopover() throws
        // on an already-open element. Showing it fresh here (rather than
        // reusing an older still-open instance) resets its top-layer
        // position to right below whatever shows next, which matters when
        // other popovers already opened in between.
        if (backdropEl.matches(":popover-open")) {
          backdropEl.hidePopover();
        }
        // Same reflow trick as the real popover below (no @starting-style):
        // the backdrop's own fade needs a genuinely rendered "closed" frame
        // to transition from, not a jump straight from not-rendered to
        // aria-expanded="true". Shown *before* popoverEl below — the top
        // layer stacks later showPopover() calls above earlier ones, so the
        // backdrop must go first for the real popover to end up on top.
        backdropEl.showPopover();
        backdropEl.getBoundingClientRect();
      } else {
        backdropEl.style.display = "";
        backdropEl.getBoundingClientRect();
      }
      // aria-expanded stays "false" here — flipped later, once
      // navi-animation has actually been set on the backdrop (see the final
      // commit step below): flipping it here, before that attribute exists,
      // would mean the "closed"→"open" opacity change happens while the
      // CSS's own [navi-animation] rule doesn't match yet, so no transition
      // would ever play.
    }

    if (isTopLayer) {
      popoverEl.showPopover();
      // aria-expanded stays "false" here — transitions are still
      // suppressed, so this doesn't matter yet — and only flips once
      // positioned below. Shown *after* the backdrop above so it stacks on
      // top of it in the top layer.
    } else {
      // Not "showPopover()" — just making it visible again, synchronously,
      // so it's measurable below even though aria-expanded is still
      // "false" (see this file's top comment for why the two are
      // deliberately decoupled).
      popoverEl.style.display = "";
    }

    // What we observe for repositioning on resize/scroll/visibility
    // changes: the anchor itself whenever there's a real one (either
    // renderer), otherwise whatever we're docked against instead — the
    // positioned ancestor for the custom renderer, the document for
    // via-attribute.
    const effectiveAnchor = hasAnchorElement
      ? anchor
      : isTopLayer
        ? document.documentElement
        : positionedAncestor;

    const positionPopover = (positionEvent) => {
      let appliedLeft;
      let top;

      if (hasAnchorElement) {
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
        if (positionAreaFixed) {
          const parsedPositionAreaFixed = parsePositionArea(positionAreaFixed);
          if (!parsedPositionAreaFixed) {
            console.warn(
              `Popover: invalid positionAreaFixed="${positionAreaFixed}"`,
            );
          } else {
            effectivePositionXFixed = parsedPositionAreaFixed.x;
            effectivePositionYFixed = parsedPositionAreaFixed.y;
          }
        }
        const {
          left,
          top: pickedTop,
          positionY: pickedPositionY,
          spaceAbove,
          spaceBelow,
        } = pickPositionRelativeTo(popoverEl, anchor, {
          positionX: parsedPositionArea.x,
          positionY: parsedPositionArea.y,
          positionXFixed: effectivePositionXFixed,
          positionYFixed: effectivePositionYFixed,
          marginWithAnchor: resolveSpacingSize(marginWithAnchor),
          marginWithContainer: resolveSpacingSize(marginWithContainer),
          // Only meaningful for the custom renderer: popoverEl is always
          // position: absolute relative to its own positioned ancestor,
          // real anchor or not — this tells pickPositionRelativeTo to
          // convert the computed coordinates into that ancestor's own
          // local space instead of assuming document-relative absolute
          // (see its own doc in visible_rect.js).
          container: isTopLayer ? undefined : positionedAncestor,
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
        // No real anchor: dock against a container instead — omitting
        // pickPositionRelativeTo's own `anchor` argument entirely puts it
        // in its own container-docked mode (see its own doc for what that
        // changes). For the via-attribute renderer, its `container` is
        // left unspecified too — pickPositionRelativeTo auto-resolves it
        // to the viewport on its own, since popoverEl's own [popover]
        // attribute signals that (see getPositioningContainer). For the
        // custom renderer, its own positioned ancestor is passed
        // explicitly instead, since it's already computed above for
        // visibleRectEffect's own observation target. --space-available is
        // deliberately left untouched here (cleared, not set) — a docked
        // popover always relies on the CSS's own --popover-maxmax-height
        // ceiling instead.
        popoverEl.style.removeProperty("--space-available");
        const { left, top: pickedTop } = pickPositionRelativeTo(
          popoverEl,
          null,
          {
            positionX: parsedPositionArea.x,
            positionY: parsedPositionArea.y,
            container: isTopLayer ? undefined : positionedAncestor,
            marginWithContainer: resolveSpacingSize(marginWithContainer),
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

    if (scrollCapture) {
      addCleanup(trapScrollInside(popoverEl));
    }
    if (focusCapture) {
      addCleanup(trapFocusInside(popoverEl, { debug: debugFocus }));
    }

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

    // "sliding"/"expanding" need a concrete direction (see
    // resolveDirectionValue) — resolved here, once, now that rectEffect's
    // own setup has already called positionPopover() above and the actual
    // position is known (pickPositionRelativeTo, for a real anchor, may
    // have picked a different side than requested, written onto
    // data-position-y/x-current — reading that back is what makes
    // "expanding" point the right way), and before transitions are
    // re-enabled below (same constraint as positioning itself). Mirrored
    // onto the backdrop too (see the backdrop's own CSS comment for why it
    // only ever fades regardless of which kind it is).
    let resolvedAnimation = resolvedAnimationKind;
    if (resolvedAnimationKind === "sliding") {
      resolvedAnimation =
        resolveDirectionValue(parsedPositionArea.y, parsedPositionArea.x, {
          prefix: "slide-from",
        }) ?? "slide-from-top";
    } else if (resolvedAnimationKind === "expanding") {
      resolvedAnimation =
        resolveDirectionValue(
          popoverEl.getAttribute("data-position-y-current"),
          popoverEl.getAttribute("data-position-x-current"),
          { prefix: "expand" },
        ) ?? "expand-up";
    }
    if (resolvedAnimation) {
      popoverEl.setAttribute("navi-animation", resolvedAnimation);
      backdropEl?.setAttribute("navi-animation", resolvedAnimation);
    } else {
      popoverEl.removeAttribute("navi-animation");
      backdropEl?.removeAttribute("navi-animation");
    }
    const hasCssTransitionAnimation = Boolean(resolvedAnimationKind);

    // The final step of open — commits the correctly positioned "closed"
    // frame set up above as a real rendered state (the reflow), re-enables
    // transitions, flips aria-expanded="true" (only then does the CSS
    // transition play, from that just-committed frame to the open one,
    // with no @starting-style involved at all — see this file's top
    // comment), suppresses pointer events until it settles, and transfers
    // focus in. Inlined rather than a standalone function since it only
    // has this one call site.
    //
    // `silent` (mounting already open via `open`/`defaultOpen`) flips the
    // order instead: aria-expanded first, *then* re-enable transitions, with
    // its own forced reflow in between the two — without that reflow, the
    // browser coalesces "flip aria-expanded" and "re-enable transitions"
    // into a single style recalculation where, by the time anything is
    // actually computed, transitions are already back on — which is
    // transition-eligible against the earlier "closed" frame below and
    // plays the animation anyway, JS statement order notwithstanding.
    popoverEl.getBoundingClientRect();
    if (!silent) {
      // Re-enabled before the flip below, so the change is genuinely
      // transition-able when it happens. For `silent`, this happens further
      // down instead — after, not before, the flip.
      popoverEl.style.transitionProperty = "";
      if (backdropEl) {
        backdropEl.style.transitionProperty = "";
      }
    }
    popoverEl.setAttribute("aria-expanded", "true");
    // Backdrop flips here too, not in the earlier show block above — by now
    // navi-animation has already been set on it (right above), so this is
    // the first point its own opacity transition can actually fire.
    backdropEl?.setAttribute("aria-expanded", "true");
    if (silent) {
      // Commits the just-applied "open" state as its own observed frame,
      // still with transitions fully suppressed, before re-enabling them —
      // see the comment above for why this forced reflow can't be skipped.
      popoverEl.getBoundingClientRect();
      popoverEl.style.transitionProperty = "";
      if (backdropEl) {
        backdropEl.style.transitionProperty = "";
      }
    }
    const cancelOpenInteractionSuppression =
      !silent && hasCssTransitionAnimation
        ? suppressPointerEventsDuringTransition(popoverEl)
        : null;
    const restoreFocus = openController.transferFocusOnOpen(popoverEl);
    debugPopup(
      e,
      isTopLayer
        ? `openPopover() -> anchor: ${anchor?.tagName}, hasAnchorElement: ${hasAnchorElement}`
        : `openPopover() -> scroll-container (local)`,
    );

    // The close callback openEffect returns — also inlined for the same
    // reason: only ever built here.
    return (closeEvent) => {
      debugPopup(closeEvent, `closePopover()`);
      popoverEl.setAttribute("aria-expanded", "false");
      if (isTopLayer) {
        popoverEl.hidePopover();
      } else {
        popoverEl.style.display = "none";
      }
      // Not interactive while it's leaving either — cancel the open side's
      // still-pending suppression first, since a fresh one below fully
      // replaces it (nothing ever needs to cancel this one in turn: a
      // closed popover can stay non-interactive indefinitely, and the next
      // open is its own separate call with no way to reach back into this
      // one).
      cancelOpenInteractionSuppression?.();
      if (hasCssTransitionAnimation) {
        suppressPointerEventsDuringTransition(popoverEl);
      }
      if (backdropEl) {
        backdropEl.setAttribute("aria-expanded", "false");
        disarmBackdropHideRef.current = armPointerDownOutsideClose(
          closeEvent,
          isTopLayer
            ? () => backdropEl.hidePopover()
            : () => {
                backdropEl.style.display = "none";
              },
        );
      }
      restoreFocus(closeEvent);

      // pickPositionRelativeTo (visible_rect.js) writes data-position-y/x-
      // current unconditionally on every call, and treats their mere
      // *presence* as "already positioned this session — stay on this
      // side unless it no longer fits" (its own anti-oscillation guard for
      // repositioning mid-open, e.g. on scroll/resize). Popover's own CSS
      // doesn't read these anymore (slide direction is resolved in JS now,
      // see resolveDirectionValue), which is why the clearing that used to
      // live here was removed — but that removal missed this second,
      // still-live purpose: without clearing them on close, a later reopen
      // sees a stale, "already positioned" value left over from a
      // *previous* open (e.g. the container-aligned collapse from an
      // anchorless silent open) and wrongly stays sticky to it instead of
      // resolving fresh from the current positionArea/anchor — a real,
      // reproduced bug, not just a leftover no-op.
      popoverEl.removeAttribute("data-position-y-current");
      popoverEl.removeAttribute("data-position-x-current");

      cleanup();
    };
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

  if (isTopLayer) {
    backdropProps["popover"] = "manual";
    contentProps["popover"] = "manual";
  }
  Object.assign(backdropProps, {
    "ref": backdropRef,
    "id": backdropId,
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
  });
  Object.assign(contentProps, {
    id,
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
  });

  return [hasBackdrop ? backdropProps : null, contentProps];
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
  minWidth: "--popover-min-width",
  maxWidth: "--popover-max-width",
  minHeight: "--popover-min-height",
  maxHeight: "--popover-max-height",
};

// parsePositionArea/POSITION_AREA_X/Y_VALUES moved to popup_shared.js — same
// grammar Dialog's own layer="local"/"top" now shares.

/**
 * Shared by both renderers: parses `positionArea` and resolves
 * `animation="auto"`/`true`. `animationAnchor` is the real anchor element
 * for the via-attribute renderer's auto-animation resolution, or
 * `undefined` for the custom renderer (which never has one — see
 * resolveAutoAnimationKind's own comment).
 */
const resolvePositionAreaAndAnimationKind = ({
  positionArea,
  isAutoAnimation,
  animation,
  animationAnchor,
}) => {
  const positionAreaParseResult = parsePositionArea(positionArea);
  if (!positionAreaParseResult) {
    console.warn(`Popover: invalid positionArea="${positionArea}"`);
  }
  const parsedPositionArea = positionAreaParseResult ?? {
    y: "below",
    x: "center",
  };
  const resolvedAnimationKind = isAutoAnimation
    ? resolveAutoAnimationKind(animationAnchor, parsedPositionArea)
    : animation;
  return { parsedPositionArea, resolvedAnimationKind };
};

// resolveDirectionValue/resolveAutoAnimationKind moved to popup_shared.js —
// same logic Dialog's own auto-animation resolution now shares, since it
// never has a real anchor either (always the "anchor === undefined" path).

// suppressPointerEventsDuringTransition/armPointerDownOutsideClose moved to
// popup_shared.js — same helpers Dialog's own custom renderer needs, no
// Popover-specific knowledge in either.

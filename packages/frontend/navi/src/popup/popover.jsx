/**
 * A popup positioned via `anchor`/`positionArea`. Two real rendering
 * strategies live in this file, each its own component: `PopoverViaAttribute`
 * (native Popover API, top layer) and `PopoverCustom` (`position: absolute`
 * relative to its own nearest positioned ancestor, clipped by that
 * ancestor's own `overflow` unlike the top layer). Kept as two separate
 * components rather than one branching internally — their JSX already
 * diverges (`PopoverCustom` wraps its content in an extra clip-wrapper div)
 * and collapsing them would just mean re-splitting later. `layer` picks
 * between them directly and has no opinion on anchor resolution — a real
 * `anchor` always wins over `layer` and works with either renderer.
 *
 * The backdrop (`pointerInteractionOutsideEffect`) is a sibling, not a
 * descendant, of the real popover — a stacking-context root's own
 * background always paints below even its own negative-z-index children, so
 * a z-index trick on a descendant backdrop could never sit behind the
 * popover's own background. Its hide is deferred until the browser's
 * matching "click" fires when close was triggered by a mousedown (an
 * outside click) — hiding synchronously would make the mousedown's target
 * vanish before mouseup, silently dropping that click.
 *
 * `animation="auto"` resolves to "scaling" for a real anchor or a
 * dead-center placement, "sliding" otherwise. "scaling" is the auto-pick
 * (over "expanding") because it simply reads best in practice for a popup
 * opening. A `spawnFromPointer`-style option (growing from the pointer
 * position) was tried and dropped — it added motion that competed with the
 * popover's own content for attention.
 *
 * The via-attribute renderer defaults to `position: fixed`, overridden to
 * `absolute` only when there's a real anchor: a real anchor needs the
 * popover to scroll in lockstep with the document to stay visually attached
 * to it, whereas `fixed` is the more direct way to stay pinned to the
 * viewport when there's none (and avoids ever extending the document's own
 * scrollable area).
 */

import {
  applyNewPosition,
  createPubSub,
  getBorderSizes,
  getPositionedParent,
  parsePositionArea,
  pickPositionRelativeTo,
  snapToPixel,
  trapFocusInside,
  trapScrollInside,
  visibleRectEffect,
} from "@jsenv/dom";
import { useId, useRef } from "preact/hooks";

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
      --popover-background-color: var(--navi-popup-background-color);
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
    /* Otherwise-invisible itself, but sits between the popover and its real
       positioned ancestor — a consumer styling border-radius: inherit on
       the popover itself (e.g. side_panel.jsx) would otherwise inherit
       this wrapper's own (unset) radius instead of the real ancestor's. */
    border-radius: inherit;
    pointer-events: none;
    overflow: hidden;

    .navi_popover {
      pointer-events: auto;
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
    z-index: 1000;
    min-width: min(var(--popover-min-width, 0px), var(--x-popover-max-width));
    max-width: var(--x-popover-max-width);
    min-height: min(
      var(--popover-min-height, 0px),
      var(--x-popover-max-height)
    );
    max-height: var(--x-popover-max-height);
    background-color: var(--popover-background-color);
    border-width: var(--popover-border-width);
    border-style: solid;
    border-color: var(--popover-border-color);
    border-radius: var(--popover-border-radius);
    outline-width: var(--popover-outline-width);
    outline-color: var(--popover-outline-color);
    outline-offset: 0px;
    box-shadow: var(--popover-box-shadow);
    /* Duration driven by applyNewPosition (visible_rect.js) — 0s (no
       transition) for most repositions (scroll, in particular, needs to
       track its target in lockstep), a real duration only when the
       reposition was itself triggered by a resize. */
    transition-property: left, top;
    transition-duration: var(--popup-position-transition-duration, 0s);
    transition-timing-function: ease-out;
    overflow: auto;
    overscroll-behavior: none;

    &[popover] {
      z-index: unset;
    }

    /* The via-attribute renderer starts hidden for free (native UA default
       for any [popover] element, same as <dialog> without [open]) — the
       custom renderer is a plain div with no such native default, so
       without this it would flash visible for one frame on mount, before
       openEffect's own JS ever gets a chance to hide it. [navi-hidden] is
       set from usePopoverProps' own contentProps (recomputed from
       openController.opened on every render, present from the very first
       one — see there for why), then toggled by plain
       removeAttribute/setAttribute in openEffect/close, never an explicit
       display override: removing the attribute just lets this rule stop
       matching, so whatever display the box would otherwise have applies
       on its own.

       Applies regardless of [popover] (not scoped to the custom renderer
       alone) and !important: CSS origin rules mean *any* author rule beats
       the UA stylesheet's own [popover]:not(:popover-open) default,
       regardless of specificity — a consumer combining layer="top" with
       another authored display property (e.g. Popup's own flex prop)
       silently defeats showPopover()/hidePopover()'s native hide otherwise,
       since nothing then actually toggles display back off when closed.
       This rule is the real, load-bearing hide mechanism whenever that
       happens; harmless/redundant the rest of the time. */
    &[navi-hidden] {
      display: none !important;
    }

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
      padding: 0;
    }
    &[popover][data-anchor] {
      position: absolute;
    }

    &[data-anchor-out-of-view] {
      opacity: 0;
      pointer-events: none;
    }
  }

  /* Sibling element, not a descendant of .navi_popover — see this file's
     top comment for why. */
  .navi_popover_backdrop {
    --popup-animation-duration: 0.18s;

    position: absolute;
    inset: 0;
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

    /* The via-attribute renderer's backdrop: a top-layer sibling, so it
       needs to cover the whole viewport itself (width/height: auto
       overrides the [popover] UA default sizing). */
    &[popover] {
      position: fixed;
      inset: 0;
      width: auto;
      height: auto;
    }

    /* Same reasoning/mechanism as .navi_popover's own rule above (including
       the unconditional-plus-!important reasoning) — a plain div, no native
       starting-hidden default to lean on for the custom renderer, and the
       same authored-CSS-beats-the-UA-stylesheet risk for the via-attribute
       one. */
    &[navi-hidden] {
      display: none !important;
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
 * An anchored (or container-docked) popup — via the native Popover API by
 * default (`layer="top"`, real top-layer stacking), or a plain positioned
 * div confined to a local container via `layer="local"`. See this file's
 * own top comment for the full architecture (positionArea grammar, anchor
 * resolution, backdrop mechanics, animation resolution).
 *
 * @param {object} props
 * @param {"top"|"local"} [props.layer="top"] - `"top"`: rendered via the
 *   native Popover API (`popover="manual"` + `showPopover()`), in the
 *   browser's own top layer. `"local"`: a plain `position: absolute` div,
 *   positioned relative to its own nearest positioned ancestor and clipped
 *   by it — genuinely confined to (and by) that container instead of the
 *   whole viewport. A real `anchor` works with either.
 * @param {string} [props.positionArea="bottom"] - Where to place the popover
 *   relative to its `anchor` (or its container, if there is none). Same
 *   grammar as `Dialog`'s own `positionArea` (see `popup_shared.js`'s
 *   `parsePositionArea`): a single compass token — `top`/`top-start`/
 *   `top-end`/`top-left`/`top-right`, `right`/`right-start`/`right-end`,
 *   `bottom`/`bottom-start`/`bottom-end`/`bottom-left`/`bottom-right`,
 *   `left`/`left-start`/`left-end`, or `center`. A bare token means no
 *   overlap with the anchor; wrap it in `inset(...)` (e.g. `inset(top)`,
 *   `inset(top-left)`) to overlap the anchor instead (edges touching or
 *   inside it).
 * @param {string} [props.positionAreaFixed] - Overrides `positionArea` once
 *   the popover has actually been positioned once, so a live reposition
 *   (e.g. anchor moved) doesn't jump to a different side.
 * @param {string} [props.positionAreaWhenAnchorIsInvalid="center"] - `positionArea`
 *   used instead, as a plain no-anchor dock, whenever a real anchor is too
 *   big to bother anchoring to (`isAnchorTooBig`, always checked — see
 *   `pickPositionRelativeTo`'s own doc in visible_rect.js).
 * @param {string|number} [props.marginWithContainer=0] - Extra spacing kept
 *   between the popover and the edges of its container.
 * @param {string|number} [props.marginWithAnchor=0] - Extra spacing kept
 *   between the popover and the edges of its anchor.
 * @param {"close"|"capture"|"none"} [props.pointerInteractionOutsideEffect="none"]
 *   - `"none"` (default): no backdrop at all, outside clicks pass straight
 *   through. `"close"` closes the popover on an outside click. `"capture"`
 *   absorbs the click (dims the backdrop) without closing. Note this
 *   default differs from `Dialog`'s own (`"close"`) — a popover is
 *   typically a lightweight, non-modal affordance.
 * @param {boolean} [props.scrollCapture] - Traps scroll gestures inside the
 *   popover so the page/container behind it can't scroll while it's open.
 * @param {boolean} [props.focusCapture] - Traps Tab navigation inside the
 *   popover (see `focus_trap.js`).
 * @param {boolean|"auto"|"fading"|"scaling"|"sliding"|`slide-from-${string}`} [props.animation]
 *   - `true`/`"auto"` resolves to a concrete `"slide-from-*"` direction
 *   based on `positionArea`. Any other explicit value is used as-is.
 * @param {string} [props.animationDuration] - Maps to
 *   `--popup-animation-duration`.
 * @param {Element|{current: Element}} [props.anchor] - The element the
 *   popover is positioned relative to. Defaults to whatever triggered the
 *   open (`e.detail.anchor`/`e.detail.source`), if any — with no anchor at
 *   all, the popover docks to its container instead (viewport for
 *   `layer="top"`, positioned ancestor for `layer="local"`).
 * @param {"override"|"ignore"} [props.anchorCustomEventDetail="override"] -
 *   Whether an explicit `anchor` prop takes precedence over
 *   (`"override"`, default) or is ignored in favor of
 *   (`"ignore"`) whatever anchor the triggering event itself carried.
 * @param {string} [props.minWidth] - Maps to `--popover-min-width`; clamped
 *   so it can never push the popover past `--popover-maxmax-width` (the
 *   viewport/container-spacing ceiling) regardless of how large a value is
 *   passed.
 * @param {string} [props.maxWidth] - Maps to `--popover-max-width`.
 * @param {string} [props.minHeight] - Maps to `--popover-min-height`, same
 *   clamping as `minWidth`.
 * @param {string} [props.maxHeight] - Maps to `--popover-max-height`.
 * @param {number} [props.tabIndex=-1] - Set on the popover element itself
 *   so `autoFocus="fallback"` below has somewhere to land when the popover
 *   has no other focusable descendant of its own.
 * @param {boolean|"fallback"} [props.autoFocus="fallback"] - See
 *   `use_auto_focus.js` — `"fallback"` focuses the popover itself if it has
 *   no other focusable descendant.
 * @param {boolean} [props.open] - Controlled open state.
 * @param {boolean} [props.defaultOpen] - Uncontrolled, mount-only initial
 *   open state — plays no entrance animation (nothing was ever shown as
 *   "closed" for the user to see it transition away from).
 * @param {(event: Event) => void} [props.onClose] - Called when the popover
 *   actually closes — not preventable (see `open_controller.js`'s own
 *   `onRequestClose`/`onClose` distinction; `onRequestClose` is where you'd
 *   veto a close instead).
 * @param {object} [props.openController] - Advanced: an externally-owned
 *   open controller (see `open_controller.js`) for a caller that wants to
 *   drive open/close itself instead of `open`/`defaultOpen`/`onClose` (used
 *   by `picker_custom.jsx`/`side_panel.jsx`).
 * @param {import("preact").ComponentChildren} props.children
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
      defaultOpen={undefined}
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
    // "top" (default) → via-attribute, in the browser's own top layer;
    // "local" → custom, resolved to the popover's own positioned ancestor.
    // Picks the rendering strategy directly — not an "anchor fallback", see
    // this file's top comment for why that distinction matters. Independent
    // of anchorProp — a real anchor works with either renderer.
    layer = "top",
    // see the positionArea grammar in the file's top comment
    positionArea = "bottom",
    positionAreaFixed,
    // positionArea used instead whenever a real anchor is too big to bother
    // anchoring to (pickPositionRelativeTo's own isAnchorTooBig, always
    // checked — see its doc in visible_rect.js) — forwarded as-is, same
    // "center" default.
    positionAreaWhenAnchorIsInvalid,
    marginWithContainer = 0,
    pointerInteractionOutsideEffect = "none",
    scrollCapture,
    focusCapture,
    animation,
    anchor,
    anchorCustomEventDetail = "override",
    marginWithAnchor = 0,
    // Makes the popover itself a valid focus target so autoFocus="fallback"
    // below has somewhere to land when it contains nothing focusable of its
    // own — -1 keeps it out of the normal Tab order (it's only ever reached
    // programmatically).
    tabIndex = -1,
    // See use_auto_focus.js's own docs for why this must never reach the DOM
    // as a plain `autofocus` attribute — useAutoFocus below takes over
    // instead, so it's read here rather than left in `rest`.
    autoFocus = "fallback",
    onKeyDown,
    children,
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
  // The custom renderer's own starting-hidden state is a stylesheet default
  // now (&:not([popover]) { display: none } on .navi_popover/
  // .navi_popover_backdrop above) rather than set here imperatively — a
  // plain div has no native default the way [popover]/<dialog> do, so
  // leaving this to a layout effect meant an actual (if narrow) window
  // where the browser could paint it visible before this ever ran.
  // aria-expanded starts "false" the same way, but via a static literal
  // JSX prop on contentProps/backdropProps below instead of a layout
  // effect — see that prop's own comment for why a *constant* value there
  // is safe to combine with the imperative setAttribute("aria-expanded", …)
  // toggling done elsewhere in this file (open/close), and for why it
  // needs to be present synchronously from the very first commit, not a
  // layout effect later: a descendant relying on useDisplayedLayoutEffect
  // (see that file) to detect "this ancestor just opened" checks for
  // aria-expanded's mere presence at its own, earlier-firing layout effect
  // (Preact fires child effects before parent effects) — if this file set
  // it via its own layout effect instead, that check would run too early
  // and see no aria-expanded at all yet, wrongly falling back to the
  // slower, flash-prone `toggle` event instead of the fast, pre-paint
  // MutationObserver path.

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
    let anchorElement;
    if (typeof anchor === "string") {
      // A plain string is a near-certain leftover from an older API
      // (anchor used to accept "viewport"/"scrollContainer" directly) —
      // anchor is a ref or a DOM element only now; layer/
      // anchorCustomEventDetail cover what those strings used to mean.
      console.warn(
        `Popover: anchor="${anchor}" is no longer supported — anchor only accepts a ref or a DOM element now. Use layer="local" (was anchor="scrollContainer") or anchorCustomEventDetail="ignore" (was ignoreEventAnchor) instead.`,
      );
    } else if (anchor) {
      // anchor prop is a ref or a DOM element — always a real anchor,
      // regardless of anchorCustomEventDetail.
      anchorElement = anchor.current ?? anchor;
    } else if (anchorCustomEventDetail === "override") {
      anchorElement = e.detail.anchor;
    }
    const hasAnchorElement = Boolean(anchorElement);
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
        animationAnchor: anchorElement,
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
        // Also cleared here, not just in the custom-renderer branch below:
        // showPopover() alone only wins over [navi-hidden] { display: none }
        // (see that rule's own comment) when nothing *else* authored also
        // sets display on this element — a consumer combining layer="top"
        // with e.g. Popup's own flex prop does exactly that, and CSS origin
        // rules mean *any* author rule beats the UA stylesheet's own
        // [popover]:not(:popover-open) default regardless of specificity,
        // so showPopover() toggling :popover-open alone isn't sufficient in
        // that case — this is the actual, load-bearing hide mechanism then.
        backdropEl.removeAttribute("navi-hidden");
        backdropEl.getBoundingClientRect();
      } else {
        backdropEl.removeAttribute("navi-hidden");
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
      // See the backdrop's own identical call above for why this is
      // needed even in the native/top-layer case, not just the custom
      // renderer's own branch below.
      popoverEl.removeAttribute("navi-hidden");
      // aria-expanded stays "false" here — transitions are still
      // suppressed, so this doesn't matter yet — and only flips once
      // positioned below. Shown *after* the backdrop above so it stacks on
      // top of it in the top layer.
    } else {
      // Not "showPopover()" — just making it visible again, synchronously,
      // so it's measurable below even though aria-expanded is still
      // "false" (see this file's top comment for why the two are
      // deliberately decoupled).
      popoverEl.removeAttribute("navi-hidden");
    }

    // What we observe for repositioning on resize/scroll/visibility
    // changes: the anchor itself whenever there's a real one (either
    // renderer), otherwise whatever we're docked against instead — the
    // positioned ancestor for the custom renderer, the document for
    // via-attribute.
    const effectiveAnchor = hasAnchorElement
      ? anchorElement
      : isTopLayer
        ? document.documentElement
        : positionedAncestor;

    const positionPopover = (positionEvent) => {
      let position;

      if (hasAnchorElement) {
        const { width, height } = anchorElement.getBoundingClientRect();
        const {
          left: borderLeft,
          right: borderRight,
          top: borderTop,
          bottom: borderBottom,
        } = getBorderSizes(anchorElement);
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
        position = pickPositionRelativeTo(popoverEl, anchorElement, {
          positionArea,
          positionAreaFixed,
          positionAreaWhenAnchorIsInvalid,
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
          event: positionEvent,
        });
        position = { ...position, left: Math.max(position.left, minLeft) };
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
        position = pickPositionRelativeTo(popoverEl, null, {
          positionArea,
          container: isTopLayer ? undefined : positionedAncestor,
          marginWithContainer: resolveSpacingSize(marginWithContainer),
          event: positionEvent,
        });
      }
      // Only meaningful once actually anchored — rejected (too big,
      // falls back to center) means spaceAbove/spaceBelow describe the
      // container, not a real anchor, and would collapse max-height to ~0.
      if (position.hasValidAnchor) {
        const spaceAvailable =
          position.positionY === "top" || position.positionY === "inset-bottom"
            ? position.spaceAbove
            : position.spaceBelow;
        popoverEl.style.setProperty("--space-available", `${spaceAvailable}px`);
      } else {
        popoverEl.style.removeProperty("--space-available");
      }

      debugPopup(
        positionEvent,
        `positionPopover() -> left: ${position.left}, top: ${position.top}`,
      );
      applyNewPosition(popoverEl, position);
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
        ? `openPopover() -> anchor: ${anchorElement?.tagName}, hasAnchorElement: ${hasAnchorElement}`
        : `openPopover() -> scroll-container (local)`,
    );

    // The close callback openEffect returns — also inlined for the same
    // reason: only ever built here.
    return (closeEvent) => {
      debugPopup(closeEvent, `closePopover()`);
      popoverEl.setAttribute("aria-expanded", "false");
      // Set regardless of isTopLayer — see the open side's own identical
      // comment (openEffect above) for why hidePopover() alone isn't
      // reliably sufficient once a consumer's own CSS also sets display.
      popoverEl.setAttribute("navi-hidden", "");
      if (isTopLayer) {
        popoverEl.hidePopover();
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
          () => {
            // Set regardless of isTopLayer — see openEffect's own identical
            // comment for why hidePopover() alone isn't reliably sufficient.
            backdropEl.setAttribute("navi-hidden", "");
            if (isTopLayer) {
              backdropEl.hidePopover();
            }
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
    // Recomputed fresh on every render from openController.opened (not a
    // frozen mount-time constant, same pattern as navi-hidden just below)
    // rather than driven through a mount-time layout effect — its own
    // actual open/close toggling is still done entirely imperatively
    // (setAttribute("aria-expanded", …) in openEffect/close), deliberately
    // outside Preact's render cycle, for the same
    // precise-ordering-relative-to-forced-reflows reasons as
    // navi-animation. That doesn't fight this prop: Preact only ever
    // writes a prop to the DOM when it differs from the previous render's
    // value (see diff/index.js's own oldProps[i] !== value check), so as
    // long as this always reflects the *current* truth, a re-render
    // between imperative toggles never stomps on them. What *does* matter
    // is that it's present in the DOM synchronously from the very first
    // commit (a plain prop is, no effect needed) — see
    // use_displayed_layout_effect.js's own comments for why a descendant
    // relying on aria-expanded's mere presence needs that.
    "aria-expanded": openController.opened ? "true" : "false",
    // Read fresh on every render (not frozen at mount), so it stays
    // correct even across a re-render that happens to occur while open —
    // see contentProps' own identical prop just below for the full
    // reasoning (kept once, not repeated here).
    "navi-hidden": openController.opened ? undefined : "",
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
    "data-layer": layer,
    "navi-animation": isAutoAnimation ? undefined : animation,
    // See backdropProps' own identical prop above for the full reasoning
    // (kept once, not repeated here).
    "aria-expanded": openController.opened ? "true" : "false",
    // Only load-bearing for the custom renderer (see its own &:not([popover])
    // CSS rule) — present from this very first render so there's no gap for
    // the browser to ever paint the custom renderer visible before anything
    // has actually opened it. Recomputed fresh on every render from
    // openController.opened (not a frozen mount-time constant) — Preact
    // only touches the DOM for a prop whose value actually changed since
    // the last render, so as long as this always reflects the *current*
    // truth, it never fights the imperative
    // removeAttribute/setAttribute openEffect/close do directly.
    "navi-hidden": openController.opened ? undefined : "",
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
    "onKeyDown": (e) => {
      onKeyDown?.(e);
      onKeyDownShortcuts(e);
    },
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
    y: "bottom",
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

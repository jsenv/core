/**
 * A popup positioned via `anchor`/`positionArea`, driven either by
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
 * from the `anchor`/`layer` props alone (no `anchor` given *and*
 * `layer="auto"` → `PopoverCustom`, everything else → `PopoverViaAttribute`)
 * — by this point an `openController` is always already resolved.
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
 * `layer` (`"top"` default | `"auto"`) picks the rendering strategy
 * directly — it's *not* about anchor resolution at all, deliberately: it
 * answers "which layer does this popup live in", not "what do we fall back
 * to when there's no anchor". `"top"` → the via-attribute renderer, in the
 * browser's own top layer. `"auto"` → the custom renderer, resolved to the
 * popover's own positioned ancestor instead — respects that ancestor's own
 * `overflow: hidden`/`auto`, unlike the top layer (see
 * `getPositioningContainer` in visible_rect.js/offset_parent.js for how
 * it's found). `anchor` (a ref or a DOM element — no other value is
 * accepted anymore; a plain string is a near-certain leftover from an
 * older API and gets a dev warning, then treated the same as omitting it)
 * always wins over `layer` regardless of its value — the custom renderer
 * structurally never has a real-anchor case (its popover is `position:
 * absolute` relative to its own ancestor, not the document root — a real
 * anchor's own coordinate math assumes the latter), so `layer="auto"`
 * together with a real `anchor` would be a contradiction; `anchor` simply
 * takes priority, same as it always did.
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
 * (`detail.anchor`/`.source`) is used instead, *only* for the via-attribute
 * renderer (the custom renderer never considers it, unconditionally — its
 * own container-relative positioning can't use a real anchor either way) —
 * unless `anchorCustomEventDetail="ignore"` (default `"override"`), which
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
 * means edges touching. A single word implies "center" on the other axis.
 * The 4 corners (top-left, top-right, bottom-left, bottom-right) are
 * presets for the "aligned-" pair on both axes.
 *
 * When there's no real anchor element (`!hasAnchorElement`, true for the
 * custom renderer always, and for the via-attribute renderer whenever no
 * anchor was resolved), both renderers position relative to a container
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
 * open-commit reflow-trick sequence always briefly renders before
 * flipping `aria-expanded`) — `position: fixed` never contributes to
 * document scroll size, sidestepping it. Since `resolvedAnimationKind ===
 * "sliding"` (the only kind that can ever resolve to `slide-from-*` — see
 * `resolveDirectionValue`) is knowable immediately from `parsedPositionArea`
 * alone, before positioning ever runs, `navi-animation` is given an early,
 * placeholder `slide-from-*` value (any one works — only the attribute's
 * own `slide-from` *prefix* matters for the CSS selector above) right after
 * `resolvedAnimationKind` is known, so `position: fixed` is already in
 * effect by the time the first `pickPositionRelativeTo` call measures
 * scroll offset — getting this order wrong would measure/position the
 * popover as if it were still `absolute`, one frame before the CSS
 * actually made it `fixed`, visibly offsetting it by the page's scroll
 * amount on that first paint. The final resolution step (further down,
 * after positioning) then overwrites that placeholder with the real, final
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

// Picks which rendering strategy actually mounts, from the `anchor`/`layer`
// props alone (see this file's top comment) — done here, after the
// controlled/uncontrolled split above, so an openController is always
// already resolved by the time PopoverViaAttribute/PopoverCustom (and the
// usePopoverProps hook they share) ever run. A real `anchor` always wins
// over `layer`, regardless of its value — the custom renderer structurally
// never has a real-anchor case (see this file's top comment).
const ControlledPopover = (props) => {
  if (!props.anchor && props.layer === "auto") {
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
 * `anchor`/`layer` props — nothing passes it yet; it exists so a future
 * caller can force a strategy without relying on their value.
 */
const usePopoverProps = (props, options = {}) => {
  const {
    openController,
    anchor: anchorProp,
    // "top" (default) → via-attribute, in the browser's own top layer;
    // "auto" → custom, resolved to the popover's own positioned ancestor.
    // Picks the rendering strategy directly — not an "anchor fallback", see
    // this file's top comment for why that distinction matters. Only
    // consulted when anchorProp isn't a real ref/DOM element.
    layer = "top",
    // "override" (default) lets the triggering event's own carried anchor
    // serve as the real anchor when anchorProp itself is absent; "ignore"
    // skips that fallback. Only meaningful for the via-attribute renderer
    // — see this file's top comment.
    anchorCustomEventDetail = "override",
    // see the positionArea grammar in the file's top comment
    positionArea = "below",
    positionAreaFixed,
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

  // Decided once per render from the raw props (never from the
  // event-carried anchor) — a real anchorProp always wins regardless of
  // layer, see this file's top comment.
  const isCustom =
    options.usesCustomRenderer ?? (!anchorProp && layer === "auto");

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
    // always sticks to its own positioned ancestor instead. Inlined rather
    // than a standalone function since it only has this one call site.
    let anchor;
    if (isCustom) {
      anchor = undefined;
    } else if (typeof anchorProp === "string") {
      // A plain string is a near-certain leftover from an older API
      // (anchor used to accept "viewport"/"scrollContainer" directly) —
      // anchor is a ref or a DOM element only now; layer/
      // anchorCustomEventDetail cover what those strings used to mean.
      console.warn(
        `Popover: anchor="${anchorProp}" is no longer supported — anchor only accepts a ref or a DOM element now. Use layer="auto" (was anchor="scrollContainer") or anchorCustomEventDetail="ignore" (was ignoreEventAnchor) instead.`,
      );
      anchor = undefined;
    } else if (anchorProp) {
      // anchor prop is a ref or a DOM element — always a real anchor,
      // regardless of anchorCustomEventDetail.
      anchor = anchorProp.current ?? anchorProp;
    } else {
      anchor =
        anchorCustomEventDetail !== "ignore" && e.detail.anchor
          ? e.detail.anchor
          : undefined;
    }
    const hasAnchorElement = Boolean(anchor);
    const positionedAncestor = isCustom ? getPositionedParent(popoverEl) : null;

    const { parsedPositionArea, resolvedAnimationKind } =
      resolvePositionAreaAndAnimationKind({
        positionArea,
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
          anchorSpacing: resolveSpacingSize(anchorSpacing),
          containerSpacing: resolveSpacingSize(containerSpacing),
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
            container: isCustom ? positionedAncestor : undefined,
            containerSpacing: resolveSpacingSize(anchorSpacing),
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

    // "sliding"/"expanding" need a concrete direction (see
    // resolveDirectionValue) — resolved here, once, now that rectEffect's
    // own setup has already called positionPopover() above and the actual
    // position is known (pickPositionRelativeTo, for a real anchor, may
    // have picked a different side than requested, written onto
    // data-position-y/x-current — reading that back is what makes
    // "expanding" point the right way), and before transitions are
    // re-enabled below (same constraint as positioning itself). This file's
    // top comment explains why the "is it slide-from-*" question was
    // already answered earlier, before positioning, for position: fixed's
    // own sake — this is the *final*, authoritative resolution, mirrored
    // onto the backdrop too (see the backdrop's own CSS comment for why it
    // only ever fades regardless of which kind it is).
    let resolvedAnimation = resolvedAnimationKind;
    if (resolvedAnimationKind === "sliding") {
      resolvedAnimation =
        resolveDirectionValue(parsedPositionArea.y, parsedPositionArea.x, {
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
    popoverEl.getBoundingClientRect();
    popoverEl.style.transitionProperty = "";
    popoverEl.setAttribute("aria-expanded", "true");
    const cancelOpenInteractionSuppression = hasCssTransitionAnimation
      ? suppressPointerEventsDuringTransition(popoverEl)
      : null;
    const restoreFocus = openController.transferFocusOnOpen(popoverEl);
    debugPopup(
      e,
      isCustom
        ? `openPopover() -> scroll-container (local)`
        : `openPopover() -> anchor: ${anchor?.tagName}, hasAnchorElement: ${hasAnchorElement}`,
    );

    // The close callback openEffect returns — also inlined for the same
    // reason: only ever built here.
    return (closeEvent) => {
      debugPopup(closeEvent, `closePopover()`);
      popoverEl.setAttribute("aria-expanded", "false");
      if (isCustom) {
        popoverEl.style.display = "none";
      } else {
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
          isCustom
            ? () => {
                backdropEl.style.display = "none";
              }
            : () => backdropEl.hidePopover(),
        );
      }
      restoreFocus(closeEvent);

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

// See the positionArea grammar in this file's top comment.
const POSITION_AREA_X_VALUES = new Set([
  "on-the-left",
  "aligned-left",
  "center",
  "aligned-right",
  "on-the-right",
]);
const POSITION_AREA_Y_VALUES = new Set([
  "above",
  "aligned-top",
  "center",
  "aligned-bottom",
  "below",
]);
const POSITION_AREA_PRESETS = {
  "top-left": { y: "aligned-top", x: "aligned-left" },
  "top-right": { y: "aligned-top", x: "aligned-right" },
  "bottom-left": { y: "aligned-bottom", x: "aligned-left" },
  "bottom-right": { y: "aligned-bottom", x: "aligned-right" },
};

/**
 * Parses an positionArea string into a { y, x } pair, or null if it's not a
 * recognized preset/word/pair.
 */
const parsePositionArea = (
  value,
  { defaultX = "center", defaultY = "center" } = {},
) => {
  if (POSITION_AREA_PRESETS[value]) {
    return POSITION_AREA_PRESETS[value];
  }
  const tokens = value.split(" ");
  if (tokens.length === 1) {
    const [token] = tokens;
    if (token === "center") {
      return { y: "center", x: "center" };
    }
    if (POSITION_AREA_Y_VALUES.has(token)) {
      return { y: token, x: defaultX };
    }
    if (POSITION_AREA_X_VALUES.has(token)) {
      return { y: defaultY, x: token };
    }
    return null;
  }
  if (tokens.length === 2) {
    const [a, b] = tokens;
    // Every value but "center" is unique to one axis, so either order
    // works — whichever token is the Y value becomes y, the other x.
    if (POSITION_AREA_Y_VALUES.has(a) && POSITION_AREA_X_VALUES.has(b)) {
      return { y: a, x: b };
    }
    if (POSITION_AREA_X_VALUES.has(a) && POSITION_AREA_Y_VALUES.has(b)) {
      return { y: b, x: a };
    }
  }
  return null;
};

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

/**
 * Maps an positionArea y/x pair to a concrete `navi-animation` value (a
 * `prefix` plus a direction word), or `null` if both axes overlap the anchor
 * (no direction at all — that's `resolvedAnimation === "scaling"` territory
 * instead, see the "sliding"/"expanding" resolution step in `openEffect`).
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
 * Shared `animation="auto"`/`true` resolution: "scaling" reads best overall
 * (see this file's top comment) — picked for any real anchor, or for a
 * point/corner placed dead-center (both positionArea axes overlapping —
 * there's no sensible direction to slide from in that case). "sliding"
 * otherwise. `anchor` is always `undefined` for the custom renderer (it
 * never has a real anchor — see this file's top comment), so this
 * collapses to "scaling" there only for the dead-center case, "sliding"
 * otherwise.
 */
const resolveAutoAnimationKind = (anchor, parsedPositionArea) => {
  const yOverlapsAnchor =
    parsedPositionArea.y !== "above" && parsedPositionArea.y !== "below";
  const xOverlapsAnchor =
    parsedPositionArea.x !== "on-the-left" &&
    parsedPositionArea.x !== "on-the-right";
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

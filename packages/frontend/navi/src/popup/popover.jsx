/**
 * A popup positioned via `anchor`/`anchorArea`, opened imperatively via
 * showPopover()/hidePopover() and driven either by --navi-toggle/
 * --navi-open/--navi-close commands or the `open` prop.
 *
 * `aria-expanded` lives on the popover element itself, toggled imperatively
 * in sync with showPopover()/hidePopover() (not through Preact's vdom) so
 * popup_animation.js can key its CSS off one selector for both Popover and
 * Dialog.
 *
 * `pointerInteractionOutsideEffect` ("none" default / "close" / "capture")
 * is implemented via a backdrop: a sibling top-layer element, not a
 * descendant of the real popover. An element promoted to the top layer
 * establishes its own stacking context regardless of its `position` value,
 * and a stacking-context root's own background/border always paints
 * *below* even its own negative-z-index children — so a z-index trick on a
 * *descendant* backdrop could never truly sit behind the real popover's own
 * background, only behind its later (content) children, which reads as the
 * backdrop's tint landing on top of the popup. Being a separate element
 * sidesteps that rule entirely.
 * It opens/closes together with the real popover, freshly re-shown (hidden
 * first if still open) on every open so its top-layer position resets to
 * just below the real popover — this matters when several popovers are
 * open at once, since an older backdrop left in its original top-layer slot
 * would sit above a more-recently-opened popover, and an outside click on
 * that popover would never reach it.
 * hidePopover() is deferred (armBackdropHideOnClick, below) until the
 * browser's matching "click" fires when the close was triggered by a
 * mousedown (an outside click): hiding it synchronously would make the
 * mousedown's target vanish before mouseup, silently dropping that click
 * (see armSuppressNextOpenRequest in open_controller.js, which depends on
 * that click too) — aria-expanded is still set to "false" immediately, so
 * the backdrop stops intercepting anything right away even while its
 * hidePopover() is still pending. Not rendered at all when the effect is
 * "none".
 *
 * anchorArea's grammar (loosely inspired by CSS position-area): two
 * space-separated words, order-independent. y: above/aligned-top/center/
 * aligned-bottom/below. x: on-the-left/aligned-left/center/aligned-right/
 * on-the-right. A bare word means no overlap with the anchor; "aligned-"
 * means edges touching. A single word implies "center" on the other axis.
 * The 4 corners (top-left, top-right, bottom-left, bottom-right) are presets
 * for the "aligned-" pair on both axes.
 */

import {
  createPubSub,
  findEvent,
  getBorderSizes,
  getPositionedParent,
  getPositioningScrollOffset,
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
import { useDebugFocus, useDebugPopup } from "../navi_debug.jsx";
import { useOpenControllerByProps } from "./open_controller.js";
import { buildPopupAnimationCss } from "./popup_animation.js";

const css = /* css */ `
  .navi_popover {
    /* absolute, not fixed: a fixed element stays pinned to the viewport by
       default, so scrolling instantly drags it out of sync with its
       anchor until our own scroll listener catches up and repositions it —
       a visible lag the user would see on every scroll. An absolute
       element is document-relative, so it already scrolls in lockstep with
       its anchor with no JS involved; repositioning is only needed for
       flips/resizes, not to chase the anchor on every scroll tick. */
    position: absolute;
    inset: unset;
    /* Set --popup-border-radius instead of border-radius directly: it's
       also what the "clip" animation rounds its clip-path shape to (see
       popup_animation.js), so the two can never drift out of sync. */
    border-radius: var(--popup-border-radius, 0);

    /* anchor="viewport" has no real anchor to stay in scroll-lockstep with
       in the first place — it's meant to stay pinned to the viewport itself,
       exactly what position: fixed already does natively. Staying absolute
       here would instead let it contribute to the document's own scrollable
       area once it extends past the current viewport edge, growing the
       page's scrollbar for no reason. */
    &[data-anchor-reference="viewport"] {
      position: fixed;
    }

    &[data-anchor-out-of-view] {
      opacity: 0;
      pointer-events: none;
    }
  }

  /* Sibling top-layer element, not a descendant of .navi_popover — see this
     file's top comment for why. */
  .navi_popover_backdrop {
    position: fixed;
    inset: 0;
    width: auto; /* Override user-agent */
    height: auto; /* Override user-agent */
    padding: 0; /* Override user-agent */
    background: transparent;
    border: none; /* Override user-agent */
    pointer-events: none;
    --popup-animation-duration: 0.18s;

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

    /* Mirrors the content popover's own fadeAnimation, so the backdrop's
       tint fades in/out alongside it instead of snapping abruptly. */
    &[navi-fade-animation] {
      opacity: 1;
      transition-property: opacity;
      transition-duration: var(--popup-animation-duration);
      transition-timing-function: ease;
    }
    &[aria-expanded="false"][navi-fade-animation] {
      opacity: 0;
    }
  }

  ${buildPopupAnimationCss(".navi_popover")}
`;

/**
 * Entry point: picks between an internally-managed open controller
 * (UncontrolledPopover) and one owned by the caller (ControlledPopover, used
 * by picker_custom.jsx/side_panel.jsx) so we don't instantiate a default
 * controller when it would just be thrown away.
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

const ControlledPopover = (props) => {
  const {
    openController,
    anchor: anchorProp,
    // see the anchorArea grammar in the file's top comment
    anchorArea = "below",
    anchorAreaFixed,
    scrollLock,
    pointerInteractionOutsideEffect = "none",
    focusTrap,
    animation,
    fadeAnimation,
    children,
    anchorSpacing = 0,
    viewportSpacing = 0,
    ...rest
  } = props;

  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const backdropRef = useRef();
  // Disarms a still-pending backdrop hide from a previous close (see
  // armBackdropHideOnClick below) — set at close time, read at the next
  // open, two separate invocations of openEffect that don't otherwise share
  // any scope, hence the ref.
  const disarmBackdropHideRef = useRef(null);
  const defaultId = useId();
  const id = rest.id || defaultId;
  const backdropId = `${id}-backdrop`;
  const debugPopup = useDebugPopup();
  const debugFocus = useDebugFocus();
  const autoFocusProps = useAutoFocus(ref, props.autoFocus);
  // animation={true} or "auto" picks the animation that best fits the anchor
  // resolved dynamically in openEffect (below) once it's actually known for
  // *this* open: "slide" when anchored to a point other than "center"
  // (anchor="right", "top-left", ...) — sliding in to land exactly centered
  // would look odd, so "center" gets "clip" too — "clip" otherwise, whether
  // anchored to a real element (vertical-only clip out of its edge) or not
  // (clip both axes, see data-clip-axis below).
  const isAutoAnimation = animation === true || animation === "auto";

  const hasBackdrop = pointerInteractionOutsideEffect !== "none";
  useLayoutEffect(() => {
    ref.current?.setAttribute("aria-expanded", "false");
    backdropRef.current?.setAttribute("aria-expanded", "false");
  }, []);

  openController.openEffect = (e) => {
    const popoverEl = ref.current;
    // backdropEl is null when pointerInteractionOutsideEffect is "none" —
    // the backdrop isn't rendered at all in that case (see the JSX below).
    const backdropEl = backdropRef.current;
    if (!popoverEl) {
      return undefined;
    }
    const [cleanup, addCleanup] = createPubSub(true);
    let anchor;
    let anchorReference; // "viewport" | "offsetParent" — set when not a real anchor
    if (anchorProp === "viewport" || anchorProp === "offsetParent") {
      anchorReference = anchorProp;
    } else if (typeof anchorProp === "string") {
      console.warn(
        `Popover: unknown anchor="${anchorProp}" (expected "viewport", "offsetParent", a ref, or a DOM element)`,
      );
    } else if (anchorProp) {
      // anchor prop is a ref or a DOM element
      anchor = anchorProp.current ?? anchorProp;
    } else if (e.detail.anchor) {
      anchor = e.detail.anchor;
    }
    if (!anchor && !anchorReference) {
      anchorReference = "viewport";
    }
    // popoverEl.offsetParent is always null for an open top-layer [popover]
    // element, so getPositionedParent walks the DOM ancestor chain directly.
    const relativeContainer =
      anchorReference === "offsetParent"
        ? getPositionedParent(popoverEl)
        : null;
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
    // "slide" whenever there's a direction to slide from — a real anchor's
    // own position (data-position-y/x-current) or a point/corner's
    // slideDirectionKey (data-anchor) — "clip" only for the directionless
    // dead-center case (see popup_animation.js for how each reads its
    // direction).
    const resolvedAnimation = isAutoAnimation
      ? slideDirectionKey !== "center"
        ? "slide"
        : "clip"
      : animation;
    popoverEl.setAttribute("navi-animation", resolvedAnimation);
    // Keys the CSS that switches back to position: fixed for anchor="viewport"
    // specifically (see the CSS comment above for why).
    if (anchorReference === "viewport") {
      popoverEl.setAttribute("data-anchor-reference", "viewport");
    } else {
      popoverEl.removeAttribute("data-anchor-reference");
    }
    // "clip" reveals vertically only by default (grows out of the anchor's
    // edge), which only makes sense against a real anchor element. Without
    // one — anchorReference (viewport/offsetParent) or nothing at all — it
    // clips both axes around a point instead (see popup_animation.js). A
    // real anchor with a centered Y (pure "on-the-left"/"on-the-right"
    // placement) clips horizontally instead of vertically — anything with a
    // non-center Y (including corner combos) keeps the vertical default.
    if (!anchor) {
      popoverEl.setAttribute("data-clip-axis", "xy");
    } else if (
      parsedAnchorArea.y === "center" &&
      parsedAnchorArea.x !== "center"
    ) {
      popoverEl.setAttribute("data-clip-axis", "x");
    } else {
      popoverEl.removeAttribute("data-clip-axis");
    }
    // Mirrors how the anchor was resolved, in DOM-inspectable form:
    // slideDirectionKey when anchorReference is set, a structural relation
    // to the popover ("previousSibling"/"nextSibling"/"parent" — the only
    // relations worth naming; anything else is too indirect to be useful at
    // a glance), "#id" when the anchor element has one, or "custom" as the
    // last resort.
    popoverEl.setAttribute(
      "data-anchor",
      resolveAnchorAttrValue(
        popoverEl,
        anchor,
        anchorReference && slideDirectionKey,
      ),
    );
    // anchorArea's y/x vocabulary is pickPositionRelativeTo's own
    // positionY/positionX vocabulary (see visible_rect.js) — no translation
    // needed, only meaningful against a real anchor (pickPositionRelativeTo
    // below); anchorReference mode uses slideDirectionKey directly instead,
    // feeding computeStickToPosition, which speaks the 9-compass-point
    // vocabulary natively.
    const effectivePositionX = parsedAnchorArea.x;
    const effectivePositionY = parsedAnchorArea.y;
    let effectivePositionXFixed;
    let effectivePositionYFixed;
    if (anchorAreaFixed) {
      const parsedAnchorAreaFixed = parseAnchorArea(anchorAreaFixed);
      if (!parsedAnchorAreaFixed) {
        console.warn(`Popover: invalid anchorAreaFixed="${anchorAreaFixed}"`);
      } else {
        effectivePositionXFixed = parsedAnchorAreaFixed.x;
        effectivePositionYFixed = parsedAnchorAreaFixed.y;
      }
    }
    // data-position-y/x-current persists across renders (pickPositionRelativeTo
    // avoids flicker by favoring the current side), so it must be cleared here
    // to decide fresh on every open rather than carrying over a stale side
    // from before the popover was closed. The Fixed case is the exception:
    // the side is already known synchronously, no measurement needed.
    if (effectivePositionYFixed) {
      popoverEl.setAttribute(
        "data-position-y-current",
        effectivePositionYFixed,
      );
    } else {
      popoverEl.removeAttribute("data-position-y-current");
    }
    if (effectivePositionXFixed) {
      popoverEl.setAttribute(
        "data-position-x-current",
        effectivePositionXFixed,
      );
    } else {
      popoverEl.removeAttribute("data-position-x-current");
    }

    // Suppressed until the popover is actually measured/positioned below —
    // see this file's top comment for why @starting-style can't drive the
    // opening transition (it needs the *correct* clip-path direction already
    // in place, which requires a layout box that only exists once shown).
    popoverEl.style.transitionProperty = "none";

    if (backdropEl) {
      // Disarm a still-pending hide from a previous close: a click arriving
      // later must not hide the fresh instance this open is about to show.
      disarmBackdropHideRef.current?.();
      disarmBackdropHideRef.current = null;
      // Hidden first if a previous close's deferred hidePopover() (see the
      // close cleanup below) hasn't run yet — showPopover() throws on an
      // already-open element. Showing it fresh here (rather than reusing an
      // older still-open instance) resets its top-layer position to right
      // below the real popover, which matters when other popovers already
      // opened in between.
      if (backdropEl.matches(":popover-open")) {
        backdropEl.hidePopover();
      }
      // Same reflow trick as the real popover below (no @starting-style):
      // the backdrop's own fadeAnimation needs a genuinely rendered "closed"
      // frame to transition from, not a jump straight from not-rendered to
      // aria-expanded="true".
      backdropEl.style.transitionProperty = "none";
      backdropEl.showPopover();
      backdropEl.getBoundingClientRect();
      backdropEl.style.transitionProperty = "";
      backdropEl.setAttribute("aria-expanded", "true");
    }
    popoverEl.showPopover();
    // aria-expanded stays "false" here — still transitions-suppressed, so
    // this doesn't matter yet — and only flips once positioned below.

    // What we observe for repositioning on resize/scroll/visibility changes:
    // the anchor when anchored, otherwise the relative container (or the
    // whole document when the anchor point is viewport-relative).
    const effectiveAnchor =
      anchor || relativeContainer || document.documentElement;

    const positionPopover = (positionEvent) => {
      let appliedLeft;
      let top;

      if (anchorReference) {
        // An element in the top layer always uses the initial containing
        // block, regardless of `position` (absolute or fixed) and regardless
        // of where it actually sits in the DOM — so popoverEl's own
        // containing block is the document root here even in "offsetParent"
        // mode, same as "viewport". relativeContainer is only where to
        // visually position against, not a containing block: containerRect
        // stays viewport-relative, converted like any other case by
        // getPositioningScrollOffset inside computeStickToPosition.
        const containerRect = relativeContainer
          ? relativeContainer.getBoundingClientRect()
          : {
              left: 0,
              top: 0,
              right: document.documentElement.clientWidth,
              bottom: document.documentElement.clientHeight,
              width: document.documentElement.clientWidth,
              height: document.documentElement.clientHeight,
            };
        const spacingPx = resolveSpacingSize(anchorSpacing);
        const stickPosition = computeStickToPosition(
          popoverEl,
          containerRect,
          slideDirectionKey,
          spacingPx,
        );
        appliedLeft = stickPosition.left;
        top = stickPosition.top;
      } else {
        const { width, height } = effectiveAnchor.getBoundingClientRect();
        const {
          left: borderLeft,
          right: borderRight,
          top: borderTop,
          bottom: borderBottom,
        } = getBorderSizes(effectiveAnchor);
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
        const {
          left,
          top: pickedTop,
          positionY: pickedPositionY,
          spaceAbove,
          spaceBelow,
        } = pickPositionRelativeTo(popoverEl, effectiveAnchor, {
          positionX: effectivePositionX,
          positionY: effectivePositionY,
          positionXFixed: effectivePositionXFixed,
          positionYFixed: effectivePositionYFixed,
          spacing: resolveSpacingSize(anchorSpacing),
          viewportSpacing: resolveSpacingSize(viewportSpacing),
          minLeft,
        });
        const finalPositionY = pickedPositionY;
        const spaceAvailable =
          finalPositionY === "above" || finalPositionY === "aligned-bottom"
            ? spaceAbove
            : spaceBelow;
        popoverEl.style.setProperty("--space-available", `${spaceAvailable}px`);
        appliedLeft = Math.max(left, minLeft);
        top = pickedTop;
      }

      debugPopup(
        positionEvent,
        `positionPopover() -> left: ${appliedLeft}, top: ${top}`,
      );
      popoverEl.style.top = `${top}px`;
      popoverEl.style.left = `${appliedLeft}px`;

      if (resolvedAnimation !== "clip" || anchor) {
        // Anchored "clip" is vertical-only (see popup_animation.js): it
        // reads data-position-y-current directly, no origin/translate to
        // compute here.
        return;
      }
      // Not anchored: translate from the click/pointer position — expressed
      // as an offset from the box's own center, since that's what the CSS
      // translates back to 0 0 — to the final resting position, while
      // clip-path grows outward from the box's own center (in local
      // percentages, so no JS measurement needed for that part). Falls back
      // to growing in place (no translate) when there's no pointer to read.
      const pointerEvent = findEvent(
        e,
        (candidate) => typeof candidate.clientX === "number",
      );
      if (!pointerEvent) {
        popoverEl.style.removeProperty("--popup-animation-origin-x");
        popoverEl.style.removeProperty("--popup-animation-origin-y");
        return;
      }
      // appliedLeft/top are document-relative (popoverEl is position:
      // absolute — see getPositioningScrollOffset), while clientX/clientY
      // are always viewport-relative — apply the same offset to them before
      // diffing so both sides are in the same space, otherwise the computed
      // origin drifts off by the scroll amount as soon as the page isn't
      // scrolled to the top.
      const { scrollLeft, scrollTop } = getPositioningScrollOffset(popoverEl);
      const boxCenterX = appliedLeft + popoverEl.offsetWidth / 2;
      const boxCenterY = top + popoverEl.offsetHeight / 2;
      popoverEl.style.setProperty(
        "--popup-animation-origin-x",
        `${snapToPixel(pointerEvent.clientX + scrollLeft - boxCenterX)}px`,
      );
      popoverEl.style.setProperty(
        "--popup-animation-origin-y",
        `${snapToPixel(pointerEvent.clientY + scrollTop - boxCenterY)}px`,
      );
    };

    if (scrollLock) {
      addCleanup(trapScrollInside(popoverEl));
    }
    if (focusTrap) {
      addCleanup(trapFocusInside(popoverEl, { debug: debugFocus }));
    }
    const rectEffect = visibleRectEffect(
      effectiveAnchor,
      ({ visibilityRatio }, { event }) => {
        // Only a real anchor can meaningfully go "out of view" — gating on
        // document.documentElement's own visibilityRatio (used for
        // anchorless/anchor-point popups) would wrongly skip positioning on
        // a tall page, since its ratio is often low even when nothing's
        // hidden.
        if (anchor && visibilityRatio <= 0.2) {
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
    addCleanup(() => {
      rectEffect.disconnect();
    });

    // The reflow forces the browser to actually commit the correctly
    // positioned/clipped "closed" frame set up above as a real rendered
    // state, before transitions are re-enabled and aria-expanded flips to
    // "true" — only then does the CSS transition play, from that
    // just-committed frame to the open one, with no @starting-style
    // involved at all.
    popoverEl.getBoundingClientRect();
    popoverEl.style.transitionProperty = "";
    popoverEl.setAttribute("aria-expanded", "true");

    const restoreFocus = openController.transferFocusOnOpen(popoverEl);
    debugPopup(
      e,
      `openPopover() -> anchor: ${anchor?.tagName}, anchorReference: ${anchorReference}, relativeContainer: ${relativeContainer?.tagName}`,
    );

    return (closeEvent) => {
      debugPopup(closeEvent, `closePopover()`);
      popoverEl.setAttribute("aria-expanded", "false");
      popoverEl.hidePopover();
      if (backdropEl) {
        backdropEl.setAttribute("aria-expanded", "false");
        disarmBackdropHideRef.current = armBackdropHideOnClick(
          backdropEl,
          closeEvent,
        );
      }
      restoreFocus(closeEvent);

      cleanup();
    };
  };

  return (
    <>
      {/* See this file's top comment for the backdrop's design. No
          document.body/createPortal needed: top-layer promotion, not DOM
          position, is what puts it above normal page content. */}
      {hasBackdrop && (
        <Box
          ref={backdropRef}
          id={backdropId}
          popover="manual"
          baseClassName="navi_popover_backdrop"
          aria-hidden="true"
          navi-fade-animation={fadeAnimation ? "" : undefined}
          styleCSSVars={POPUP_STYLE_CSS_VARS}
          animationDuration={rest.animationDuration}
          data-pointer-interaction-outside={pointerInteractionOutsideEffect}
          onMouseDown={(e) => {
            if (e.button !== 0) {
              return;
            }
            // Ignore clicks that land inside the popover's bounding rect
            // (padding and border area are part of the popover box but can
            // forward pointer events to the backdrop behind them).
            const rect = ref.current.getBoundingClientRect();
            const isOutside =
              e.clientX < rect.left ||
              e.clientX > rect.right ||
              e.clientY < rect.top ||
              e.clientY > rect.bottom;
            if (!isOutside) {
              return;
            }
            // "capture" absorbs the click so it doesn't reach whatever's
            // behind the popover, without closing it. "none" never reaches
            // here at all — the backdrop isn't rendered in that case.
            if (pointerInteractionOutsideEffect === "capture") {
              e.preventDefault();
              return;
            }
            if (pointerInteractionOutsideEffect === "close") {
              openController.requestClose(e, { isCancel: true });
              return;
            }
          }}
        />
      )}
      <Box
        id={id}
        popover="manual"
        navi-animation={isAutoAnimation ? undefined : animation}
        navi-fade-animation={fadeAnimation ? "" : undefined}
        styleCSSVars={POPUP_STYLE_CSS_VARS}
        {...rest}
        {...autoFocusProps}
        ref={ref}
        baseClassName="navi_popover"
        pseudoClasses={POPOVER_PSEUDO_CLASSES}
        onnavi_command={(e) => {
          onNaviCommand(e);
        }}
      >
        {children}
      </Box>
    </>
  );
};

const POPOVER_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":focus-within",
];

// Lets consumers pass animationDuration="0.5s"/borderRadius="8px" as regular
// props; Box maps them to the CSS vars for us (see box.jsx's styleCSSVars
// handling). borderRadius drives both the popover's own visible corners and
// what "clip" animations round their clip-path to (see popup_animation.js).
const POPUP_STYLE_CSS_VARS = {
  animationDuration: "--popup-animation-duration",
  borderRadius: "--popup-border-radius",
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
 * downstream, so no fallback timer is needed. Returns a disarm function (or
 * undefined if hidden immediately), so a fresh open can cancel a pending
 * hide it's about to make redundant.
 */
const armBackdropHideOnClick = (backdropEl, closeEvent) => {
  const mousedownEvent = findEvent(closeEvent, "mousedown");
  if (!mousedownEvent) {
    backdropEl.hidePopover();
    return undefined;
  }
  const onClick = () => {
    document.removeEventListener("click", onClick, { capture: true });
    if (backdropEl.matches(":popover-open")) {
      backdropEl.hidePopover();
    }
  };
  document.addEventListener("click", onClick, { capture: true });
  return () => {
    document.removeEventListener("click", onClick, { capture: true });
  };
};

const resolveAnchorAttrValue = (popoverEl, anchor, anchorPoint) => {
  if (anchorPoint) {
    return anchorPoint;
  }
  if (anchor) {
    if (anchor === popoverEl.previousElementSibling) {
      return "previousSibling";
    }
    if (anchor === popoverEl.nextElementSibling) {
      return "nextSibling";
    }
    if (anchor === popoverEl.parentElement) {
      return "parent";
    }
    if (anchor.id) {
      return `#${anchor.id}`;
    }
    return "custom";
  }
  return "viewport";
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
 * @param {string} value
 * @param {object} [options]
 * @param {string} [options.defaultX] - fills the x axis when `value` is a
 *   single y-only word (e.g. a picker defaulting to "below" on its own axis)
 * @param {string} [options.defaultY] - same, for the y axis
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
 * Collapses an anchorArea y/x pair into the 8-compass-point + "center"
 * vocabulary popup_animation.js's slide CSS and computeStickToPosition key
 * off — the overlap distinction (above/aligned-top, etc.) doesn't apply to a
 * point/corner, which has no anchor box to overlap with.
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
 * Places the popover pinned to an anchor point of `containerRect` (the
 * viewport by default, or the popover's own positioned ancestor when
 * anchor="offsetParent") instead of relative to an anchor. Returns
 * { left, top } in whatever coordinate space popoverEl's own computed
 * position needs (see getPositioningScrollOffset), matching
 * pickPositionRelativeTo's convention — viewport rect math, converted at the
 * very end, continuously recomputed by visibleRectEffect on scroll/resize.
 */
const computeStickToPosition = (
  popoverEl,
  containerRect,
  anchorPoint,
  spacingPx,
) => {
  // offsetWidth/offsetHeight (layout box), not getBoundingClientRect(): the
  // popover may have an active CSS scale transform mid-animation (e.g.
  // animation="scale"), which would otherwise report a shrunk size and throw
  // off the position math (see the matching fix in pickPositionRelativeTo).
  const width = popoverEl.offsetWidth;
  const height = popoverEl.offsetHeight;
  const { scrollLeft, scrollTop } = getPositioningScrollOffset(popoverEl);

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

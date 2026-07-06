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
    position: fixed;
    inset: unset;
    /* Set --popup-border-radius instead of border-radius directly: it's
       also what the "clip" animation rounds its clip-path shape to (see
       popup_animation.js), so the two can never drift out of sync. */
    border-radius: var(--popup-border-radius, 0);

    &[data-anchor-out-of-view] {
      opacity: 0;
      pointer-events: none;
    }
  }

  /* A sibling top-layer popover, not a descendant of .navi_popover (see the
     backdrop's own JSX comment for why) — position: fixed alone makes an
     element a stacking-context root, and a stacking-context root's own
     background/border always paints *below* even its own negative-z-index
     children. A z-index trick on a descendant backdrop can therefore never
     truly sit behind .navi_popover's own background, only behind its later
     (content) children — which read as the backdrop's tint landing on top
     of the popup. Being a separate element sidesteps that rule entirely. */
  .navi_popover_backdrop {
    position: fixed;
    inset: 0;
    width: auto; /* Override user-agent */
    height: auto; /* Override user-agent */
    padding: 0; /* Override user-agent */
    background: transparent;
    border: none; /* Override user-agent */
    pointer-events: none;

    &[aria-expanded="true"] {
      pointer-events: auto;
    }
    /* Makes pointerInteractionOutsideEffect have a visible impact on backdrop */
    &[data-pointer-interaction-outside="close"] {
      background: rgba(0, 0, 0, 0.1);
    }
    &[data-pointer-interaction-outside="capture"] {
      background: rgba(0, 0, 0, 0.7);
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
    // anchorArea="above aligned-left"/"on-the-left"/"top-left"/etc — see
    // ANCHOR_AREA_Y_VALUES/ANCHOR_AREA_X_VALUES/ANCHOR_AREA_PRESETS below
    // for the full grammar. Two space-separated words, order-independent
    // (loosely inspired by CSS position-area), with single-word and
    // hyphenated presets for the common cases.
    anchorArea = "below",
    anchorAreaFixed,
    scrollLock,
    pointerInteractionOutsideEffect = "none",
    focusTrap,
    animation,
    fadeAnimation,
    children,
    spacing = 0,
    viewportSpacing = 0,
    ...rest
  } = props;

  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const backdropRef = useRef();
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

  // aria-expanded lives on the popover element itself (not driven through
  // Preact's vdom — openEffect/its cleanup toggle it imperatively in sync
  // with showPopover()/hidePopover(), see below) so popup_animation.js can
  // key its CSS off a single selector regardless of Popover vs Dialog.
  //
  // The backdrop (rendered only when pointerInteractionOutsideEffect isn't
  // "none" — see the JSX below) is shown here, once, and never hidden again
  // for the component's lifetime (only its aria-expanded/pointer-events
  // toggle, in openEffect below) — not opened/closed in lockstep with the
  // real popover. Two reasons:
  // - Stacking: each showPopover() call pushes an element to the very top
  //   of the browser's top layer. Showing the backdrop once, before the
  //   real popover is ever shown, guarantees the real popover — shown
  //   fresh on every open — always ends up visually above it, with no
  //   z-index involved (see the CSS comment above for why z-index can't
  //   reliably do this for a *descendant* backdrop, which is why it's a
  //   sibling top-layer element).
  // - The exact same "keep it there to keep the browser dispatching a
  //   click" reasoning that applies to the backdrop's onMouseDown handler
  //   below (see that comment) also rules out hiding it here: hidePopover()
  //   is display:none in disguise, so closing it synchronously inside the
  //   same mousedown-triggered close would silently drop the very click
  //   armSuppressNextOpenRequest depends on.
  // The effect re-runs whenever the backdrop's existence toggles (mount, or
  // pointerInteractionOutsideEffect moving away from "none") so a
  // freshly-mounted backdrop always gets this same once-shown treatment.
  const hasBackdrop = pointerInteractionOutsideEffect !== "none";
  useLayoutEffect(() => {
    ref.current?.setAttribute("aria-expanded", "false");
    const backdropEl = backdropRef.current;
    if (backdropEl && !backdropEl.matches(":popover-open")) {
      backdropEl.showPopover();
    }
  }, [hasBackdrop]);

  // Sync the DOM open and return how to sync it back closed, fresh on every
  // render so it closes over the latest props (scrollLock, etc.). The
  // controller (owned by the caller, or by UncontrolledPopover) decides
  // *when* this runs. openEffect runs outside of render (triggered by
  // openController.open()), so it cannot call hooks — cleanup is a plain
  // pub/sub.
  openController.openEffect = (e) => {
    const popoverEl = ref.current;
    // backdropEl is null when pointerInteractionOutsideEffect is "none" —
    // the backdrop isn't rendered at all in that case (see the JSX below).
    const backdropEl = backdropRef.current;
    if (!popoverEl) {
      return undefined;
    }
    const [cleanup, addCleanup] = createPubSub(true);
    // `anchor` describes *what* to position against: a ref/DOM element (a
    // real anchor), "viewport", or "offsetParent" (the popover's own nearest
    // positioned DOM ancestor — see relativeContainer below). If it's set at
    // all (to anything), the request's own carried anchor (e.g. a
    // --navi-toggle button, forwarded as detail.source) is never consulted —
    // only when the prop is left undefined does the request get to supply
    // one. To force viewport-relative placement even though the request
    // carries an anchor, pass anchor="viewport" explicitly.
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
    // For this to resolve to anything but document.body, the popover must be
    // rendered inside that ancestor in the DOM (the trigger button doesn't
    // have to be). Not `popoverEl.offsetParent`: an open [popover] element
    // sits in the top layer, whose containing block is always the initial
    // containing block (the viewport) — no DOM ancestor ever qualifies as
    // its containing block, so offsetParent is spec'd to return null
    // regardless of DOM position or timing. getPositionedParent walks the
    // plain DOM ancestor chain instead, so it's unaffected by that.
    const relativeContainer =
      anchorReference === "offsetParent"
        ? getPositionedParent(popoverEl)
        : null;
    // Parse anchorArea into a { y, x } pair (see ANCHOR_AREA_Y_VALUES/
    // ANCHOR_AREA_X_VALUES/ANCHOR_AREA_PRESETS below), falling back to the
    // default ("below center") on an invalid value rather than crashing.
    const anchorAreaParseResult = parseAnchorArea(anchorArea);
    if (!anchorAreaParseResult) {
      console.warn(`Popover: invalid anchorArea="${anchorArea}"`);
    }
    const parsedAnchorArea = anchorAreaParseResult ?? {
      y: "below",
      x: "center",
    };
    // slideDirectionKey collapses the y/x pair into the 8-compass-point +
    // "center" vocabulary popup_animation.js's slide CSS keys off
    // (data-anchor="top"/"top-left"/etc) — "above"/"aligned-top" both slide
    // from the top, "below"/"aligned-bottom" both slide from the bottom,
    // regardless of the overlap distinction, since that's a purely visual
    // "which way does it enter from" concern.
    const slideDirectionKey = toSlideDirectionKey(
      parsedAnchorArea.y,
      parsedAnchorArea.x,
    );
    const resolvedAnimation = isAutoAnimation
      ? anchorReference && slideDirectionKey !== "center"
        ? "slide"
        : "clip"
      : animation;
    // These must be set *before* showPopover()/aria-expanded below: the
    // element is about to go from not-rendered to rendered (that's what
    // makes @starting-style apply at all), and the "before" state it
    // captures is whatever these attributes say at that exact moment. Set
    // them after instead, and the first open silently skips the animation
    // (the browser already treated it as "no navi-animation" at first
    // paint) — only later opens/closes, once the attributes persist
    // between renders, actually animate.
    popoverEl.setAttribute("navi-animation", resolvedAnimation);
    // "clip" reveals vertically only by default (grows out of the anchor's
    // edge), which only makes sense against a real anchor element. Without
    // one — anchorReference (viewport/offsetParent) or nothing at all — it
    // clips both axes around a point instead (see popup_animation.js).
    if (anchor) {
      popoverEl.removeAttribute("data-clip-axis");
    } else {
      popoverEl.setAttribute("data-clip-axis", "xy");
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
    // pickPositionRelativeTo persists data-position-y/x-current across calls
    // on purpose (it avoids flicker while *this* popover stays open and
    // repositions on scroll/resize). But the attribute lingers on the DOM
    // node between separate open/close cycles too, and its hysteresis ("stay
    // on the current side unless it clearly stops fitting") then gets
    // applied to a fresh open as if it were a continuation of the last one —
    // if the page was scrolled while closed, the *correct* side for this
    // open can take a couple of open/close cycles to actually take effect
    // (the clip animation reads data-position-y-current too, so it lags in
    // sync). Clearing them here makes every open decide the side from
    // scratch, matching the current scroll/viewport state right away — except
    // when Fixed, in which case the final side is already known synchronously
    // (no measurement needed) and must be set right here, same as
    // navi-animation/data-anchor above: it's read by the "clip" animation's
    // @starting-style rules, which snapshot whatever this attribute says the
    // moment the box starts rendering. Waiting for pickPositionRelativeTo to
    // set it (it only runs once the popover already has a layout box, after
    // showPopover()) is too late for that first snapshot.
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

    // The backdrop (when rendered — see backdropEl's own definition above)
    // is already open (shown once, on mount — see that effect); only its
    // aria-expanded (which its own CSS keys pointer-events off) needs to
    // flip here, in sync with the real popover.
    backdropEl?.setAttribute("aria-expanded", "true");
    popoverEl.showPopover();
    popoverEl.setAttribute("aria-expanded", "true");
    // What we observe for repositioning on resize/scroll/visibility changes:
    // the anchor when anchored, otherwise the relative container (or the
    // whole document when the anchor point is viewport-relative).
    const effectiveAnchor =
      anchor || relativeContainer || document.documentElement;
    const restoreFocus = openController.transferFocusOnOpen(popoverEl);
    debugPopup(
      e,
      `openPopover() -> anchor: ${anchor?.tagName}, anchorReference: ${anchorReference}, relativeContainer: ${relativeContainer?.tagName}`,
    );

    const positionPopover = (positionEvent) => {
      let appliedLeft;
      let top;

      if (anchorReference) {
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
        const spacingPx = resolveSpacingSize(spacing);
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
          spacing: resolveSpacingSize(spacing),
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
      // appliedLeft/top are in whatever coordinate space pickPositionRelativeTo/
      // computeStickToPosition produced for popoverEl's own computed position
      // (document-relative if position: absolute, viewport-relative if
      // position: fixed — see getPositioningScrollOffset), while clientX/
      // clientY are always viewport-relative — apply the same offset to them
      // before diffing so both sides are in the same space, otherwise the
      // computed origin drifts off by the scroll amount for an absolute
      // popover as soon as the page isn't scrolled to the top.
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
        // Only a real anchor element can meaningfully scroll "out of view" —
        // document.documentElement (used for anchorless/anchor-point popups)
        // is a huge, mostly-off-screen box on any tall page, so its own
        // visibilityRatio is often well under the 0.2 threshold even though
        // there's nothing actually hidden. Applying this gate there would
        // skip positionPopover() on scroll (stale top/left/origin — wrong
        // place on close, wrong transform origin on the next open) and even
        // on the very first synchronous check right after opening.
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

    return (closeEvent) => {
      debugPopup(closeEvent, `closePopover()`);
      popoverEl.setAttribute("aria-expanded", "false");
      popoverEl.hidePopover();
      // Not backdropEl.hidePopover() — see the mount effect's comment for
      // why the backdrop itself always stays open once shown.
      backdropEl?.setAttribute("aria-expanded", "false");
      restoreFocus(closeEvent);

      cleanup();
    };
  };

  return (
    <>
      {/*
        A separate top-layer popover element, not a descendant of the real
        one below — see the CSS comment on .navi_popover_backdrop for why a
        descendant can never reliably paint behind the real popover's own
        background. Being a sibling, shown first (see the mount effect),
        means the real popover — shown fresh on every open — naturally ends
        up above it in the browser's own top-layer stacking, no z-index
        involved.

        No document.body/createPortal needed: both popovers render wherever
        this component sits in the tree, which is enough, since top-layer
        promotion (not DOM position) is what puts them above normal page
        content.

        aria-hidden since it's purely decorative/interactive, never meant to
        be perceived as its own UI element.

        Not rendered at all when pointerInteractionOutsideEffect is "none":
        it would have pointer-events: none and a transparent background,
        i.e. no observable effect, so there's nothing to justify keeping an
        always-open top-layer element around for the component's lifetime.
      */}
      {hasBackdrop && (
        <Box
          ref={backdropRef}
          id={backdropId}
          popover="manual"
          baseClassName="navi_popover_backdrop"
          aria-hidden="true"
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

// anchorArea's grammar, loosely inspired by CSS position-area:
// https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/position-area
//
// Written as two space-separated words (e.g. "aligned-top aligned-left"),
// each axis independently one of:
//   y: "above" (no overlap, entirely above) / "aligned-top" (top edges
//      aligned, overlapping downward) / "center" / "aligned-bottom" (bottom
//      edges aligned, overlapping upward) / "below" (no overlap, entirely
//      below)
//   x: "on-the-left" (no overlap) / "aligned-left" (left edges aligned,
//      overlapping) / "center" / "aligned-right" (right edges aligned,
//      overlapping) / "on-the-right" (no overlap)
// Every value except "center" belongs to exactly one axis, so word order in
// the string doesn't matter — "on-the-left below" and "below on-the-left"
// are the same thing. The plain words ("above"/"below"/"on-the-left"/
// "on-the-right") mean "outside the anchor, no overlap"; the "aligned-"
// prefix means "edges aligned, overlapping the anchor" (deliberately no
// bare "top"/"bottom"/"left"/"right" shortcut — those read as ambiguous on
// their own between the two).
// A single recognized word is shorthand for pairing it with "center" on the
// other axis — "on-the-left" alone means "center on-the-left". The 4 corner
// compass names (top-left, top-right, bottom-left, bottom-right) are also
// accepted directly as hyphenated presets — see ANCHOR_AREA_PRESETS — using
// the "aligned-" (overlapping) pair on both axes, so the popover's corner
// actually touches the anchor's corner.

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

// Parses anchorArea into a { y, x } pair, or null if it's not a recognized
// preset/word/pair. defaultX/defaultY fill in whichever axis a single-word
// value doesn't specify — both default to "center", but a caller with its
// own typical placement (e.g. a picker defaulting to "below") can override
// either.
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

// Collapses anchorArea's y/x pair into the 8-compass-point + "center"
// vocabulary popup_animation.js's slide CSS and computeStickToPosition below
// key off — "above"/"aligned-top" both slide from (and pin to) the top,
// "below"/"aligned-bottom" both slide from (and pin to) the bottom,
// regardless of the overlap distinction, which doesn't apply to a
// point/corner in the first place (there's no anchor box to overlap with
// there).
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

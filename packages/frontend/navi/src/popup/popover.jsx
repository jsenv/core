import {
  createPubSub,
  findEvent,
  getBorderSizes,
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
    position: absolute;
    inset: unset;
    /* Set --popup-border-radius instead of border-radius directly: it's
       also what the "clip" animation rounds its clip-path shape to (see
       popup_animation.js), so the two can never drift out of sync. */
    border-radius: var(--popup-border-radius, 0);

    &[data-anchor-out-of-view] {
      opacity: 0;
      pointer-events: none;
    }

    .navi_popover_backdrop {
      position: fixed;
      inset: 0;
      z-index: -1;
      background: transparent;
      pointer-events: none;
    }

    &:popover-open {
      .navi_popover_backdrop {
        pointer-events: auto;
      }
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
    stickToContainerRef,
    scrollLock,
    pointerLock,
    focusTrap,
    animation,
    fadeAnimation = true,
    children,
    positionX,
    positionY,
    positionXFixed,
    positionYFixed,
    spacing = 0,
    viewportSpacing = 0,
    ...rest
  } = props;

  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const defaultId = useId();
  const id = rest.id || defaultId;
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
  useLayoutEffect(() => {
    ref.current?.setAttribute("aria-expanded", "false");
  }, []);

  // Sync the DOM open and return how to sync it back closed, fresh on every
  // render so it closes over the latest props (scrollLock, etc.). The
  // controller (owned by the caller, or by UncontrolledPopover) decides
  // *when* this runs. openEffect runs outside of render (triggered by
  // openController.open()), so it cannot call hooks — cleanup is a plain
  // pub/sub.
  openController.openEffect = (e) => {
    const popoverEl = ref.current;
    if (!popoverEl) {
      return undefined;
    }
    const [cleanup, addCleanup] = createPubSub(true);
    // anchor="ignore" forces the popover to behave as anchorless even when
    // the request carries one (e.g. a --navi-toggle button that should not
    // double as the visual anchor). anchor="top"/"top-left"/"center"/etc
    // (optionally "relative-" prefixed, see below) pins the popover to that
    // anchor point instead of a real element. Otherwise a ref/DOM element
    // wins; then the anchor carried by the request (e.g. the button that
    // triggered a --navi-toggle/--navi-open command, forwarded as
    // detail.source).
    let anchor;
    let anchorPoint; // e.g. "top-right" — set when anchorProp is one of ANCHOR_POINT_VALUES
    let anchorPointIsRelative = false; // anchorPoint was "relative-<point>"
    if (anchorProp === "ignore") {
      // anchorless, centered — nothing to resolve
    } else if (typeof anchorProp === "string") {
      const isRelative = anchorProp.startsWith("relative-");
      const point = isRelative
        ? anchorProp.slice("relative-".length)
        : anchorProp;
      if (ANCHOR_POINT_VALUES.has(point)) {
        anchorPoint = point;
        anchorPointIsRelative = isRelative;
      } else {
        console.warn(`Popover: unknown anchor="${anchorProp}"`);
      }
    } else if (anchorProp) {
      // anchor prop is a ref or a DOM element
      anchor = anchorProp.current ?? anchorProp;
    } else if (e.detail.anchor) {
      anchor = e.detail.anchor;
    }
    const stickToContainer = anchorPointIsRelative
      ? (stickToContainerRef?.current ?? null)
      : null;
    // What we observe for repositioning on resize/scroll/visibility changes:
    // the anchor when anchored, otherwise the stickTo container (or the
    // whole document when the anchor point is viewport-relative).
    const effectiveAnchor =
      anchor || stickToContainer || document.documentElement;
    const resolvedAnimation = isAutoAnimation
      ? anchorPoint && anchorPoint !== "center"
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
    // one — anchorPoint (e.g. anchor="center") or nothing at all — it clips
    // both axes around a point instead (see popup_animation.js).
    if (anchor) {
      popoverEl.removeAttribute("data-clip-axis");
    } else {
      popoverEl.setAttribute("data-clip-axis", "xy");
    }
    // Mirrors how the anchor was resolved, in DOM-inspectable form: one of
    // the 9 anchor points, "viewport" (no anchor at all), a structural
    // relation to the popover ("previousSibling"/"nextSibling"/"parent" —
    // the only relations worth naming; anything else is too indirect to be
    // useful at a glance), "#id" when the anchor element has one, or
    // "custom" as the last resort.
    popoverEl.setAttribute(
      "data-anchor",
      resolveAnchorAttrValue(popoverEl, anchor, anchorPoint),
    );
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
    // scratch, matching the current scroll/viewport state right away.
    popoverEl.removeAttribute("data-position-y-current");
    popoverEl.removeAttribute("data-position-x-current");

    popoverEl.showPopover();
    popoverEl.setAttribute("aria-expanded", "true");
    const restoreFocus = openController.transferFocusOnOpen(popoverEl);
    debugPopup(
      e,
      `openPopover() -> anchor: ${anchor?.tagName}, anchorPoint: ${anchorPoint}, stickToContainer: ${stickToContainer?.tagName}`,
    );

    const positionPopover = (positionEvent) => {
      let appliedLeft;
      let top;

      if (anchorPoint) {
        const containerRect = stickToContainer
          ? stickToContainer.getBoundingClientRect()
          : {
              left: 0,
              top: 0,
              right: document.documentElement.clientWidth,
              bottom: document.documentElement.clientHeight,
              width: document.documentElement.clientWidth,
              height: document.documentElement.clientHeight,
            };
        const spacingPx = resolveSpacingSize(spacing);
        const position = computeStickToPosition(
          popoverEl,
          containerRect,
          anchorPoint,
          spacingPx,
        );
        appliedLeft = position.left;
        top = position.top;
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
        const effectivePositionX = anchor ? positionX : "center";
        const effectivePositionY = anchor ? positionY : "center";
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
          positionXFixed,
          positionYFixed,
          spacing: resolveSpacingSize(spacing),
          viewportSpacing: resolveSpacingSize(viewportSpacing),
          minLeft,
        });
        const finalPositionY = pickedPositionY;
        const spaceAvailable =
          finalPositionY === "above" || finalPositionY === "above-overlap"
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
      // appliedLeft/top are document-relative (pickPositionRelativeTo/
      // computeStickToPosition both add the current scroll offset, since the
      // popover is position: absolute), while clientX/clientY are
      // viewport-relative — the scroll offset must be added to them too
      // before diffing, otherwise the computed origin drifts off by the
      // scroll amount as soon as the page isn't scrolled to the top.
      const { scrollLeft, scrollTop } = document.documentElement;
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
      restoreFocus(closeEvent);

      cleanup();
    };
  };

  return (
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
      {/*
        The backdrop is placed inside the popover element rather than appended to
        document.body (which would require createPortal).

        Keeping it inside the popover avoids:
        - Polluting the root DOM with one extra element per popover instance.
        - The need for createPortal, which adds conceptual overhead.
        - Any z-index juggling: because the popover is in the browser top layer,
          all its children are automatically painted above normal page content.

        "position: fixed; inset: 0" still covers the full visual viewport when the
        element lives inside a top-layer popover, because the top layer establishes
        its own stacking context that is not affected by ancestor transforms, clips,
        or overflow. No known limitation prevents the backdrop from covering the
        whole document in this configuration.

        ---

        The backdrop is kept in the DOM at all times and toggled via pointer-events
        (CSS :popover-open) rather than mounted/unmounted.

        Why this matters: when the popover closes on a mousedown (e.g. clicking
        outside), the browser records the target element of that mousedown. If the
        same element is still in the DOM at mouseup, the browser dispatches a
        "click" event — targeting document.body because the backdrop has
        pointer-events:none by then and is no longer "hittable".

        If we removed the backdrop from the DOM between mousedown and mouseup,
        the browser would see that the recorded target is gone and would NOT
        dispatch a click at all.

        That silent missing click is a problem: open_controller.js's
        armSuppressNextOpenRequest guards against it, making the popup ignore
        the next open() request so this mousedown-driven click doesn't
        immediately reopen it. That guard needs an actual click to arm/disarm
        correctly (plus a microtask fallback) — keeping the backdrop in the
        DOM is what guarantees the browser dispatches one.
      */}
      <div
        className="navi_popover_backdrop"
        aria-hidden="true"
        onMouseDown={(e) => {
          if (e.button !== 0) {
            return;
          }
          if (pointerLock) {
            e.preventDefault();
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
          openController.requestClose(e, { isCancel: true });
        }}
      />
      {children}
    </Box>
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

// Values the `anchor` prop accepts besides a ref/DOM element, "ignore", or
// undefined — pins the popover to that point instead of a real element.
// Optionally "relative-" prefixed (e.g. "relative-right") to make it relative
// to `stickToContainerRef` instead of the viewport.
const ANCHOR_POINT_VALUES = new Set([
  "top",
  "top-right",
  "right",
  "bottom-right",
  "bottom",
  "bottom-left",
  "left",
  "top-left",
  "center",
]);

/**
 * Places the popover pinned to an anchor point of `containerRect` (the
 * viewport by default, or a `stickToContainerRef` element) instead of
 * relative to an anchor. Returns document-relative { left, top }, matching
 * pickPositionRelativeTo's convention (viewport rect math + current scroll,
 * continuously recomputed by visibleRectEffect on scroll/resize).
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
  const { scrollLeft, scrollTop } = document.documentElement;

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

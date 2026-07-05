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
import {
  getFocusedBeforeTransfer,
  markAutofocusRestoreOnClose,
  transferFocus,
} from "../utils/focus/focus_transfer.js";
import { useOpenControllerByProps } from "./open_controller.js";
import { buildPopupAnimationCss } from "./popup_animation.js";

const css = /* css */ `
  .navi_popover {
    position: absolute;
    inset: unset;

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
    scrollTrap,
    pointerTrap,
    focusTrap,
    animation,
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
  // *this* open: "grow" when anchored to a real element, "slide" when
  // anchored to a point (anchor="right", "top-left", ...), "scale" when
  // there's no anchor at all.
  const isAutoAnimation = animation === true || animation === "auto";

  // aria-expanded lives on the popover element itself (not driven through
  // Preact's vdom — openEffect/its cleanup toggle it imperatively in sync
  // with showPopover()/hidePopover(), see below) so popup_animation.js can
  // key its CSS off a single selector regardless of Popover vs Dialog.
  useLayoutEffect(() => {
    ref.current?.setAttribute("aria-expanded", "false");
  }, []);

  // Sync the DOM open and return how to sync it back closed, fresh on every
  // render so it closes over the latest props (scrollTrap, etc.). The
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
    const focusedBeforeOpen = getFocusedBeforeTransfer(e);
    popoverEl.showPopover();
    popoverEl.setAttribute("aria-expanded", "true");
    transferFocus(popoverEl, debugFocus, e, focusedBeforeOpen);
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
      ? anchor
        ? "grow"
        : anchorPoint
          ? "slide"
          : "scale"
      : animation;
    popoverEl.setAttribute("navi-animation", resolvedAnimation);
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

      if (resolvedAnimation !== "scale") {
        return;
      }
      // appliedLeft/top are document-relative (pickPositionRelativeTo/
      // computeStickToPosition both add the current scroll offset, since the
      // popover is position: absolute). anchorRect/clientX/clientY below are
      // viewport-relative (getBoundingClientRect()/MouseEvent), so the scroll
      // offset must be added to them too before diffing — otherwise the
      // computed transform-origin drifts off by the scroll amount as soon as
      // the page isn't scrolled to the top.
      const { scrollLeft, scrollTop } = document.documentElement;
      if (anchor) {
        // Scale origin = the anchor's center, so the popover visually grows
        // out of whatever triggered it rather than from its own center.
        // When anchored, animating from the pointer instead would be
        // misleading for stuff like pickers: the content should grow from
        // the anchor edge it's attached to, not from wherever the user
        // happened to click.
        const anchorRect = effectiveAnchor.getBoundingClientRect();
        const anchorCenterX =
          anchorRect.left + anchorRect.width / 2 + scrollLeft;
        const anchorCenterY =
          anchorRect.top + anchorRect.height / 2 + scrollTop;
        popoverEl.style.setProperty(
          "--popup-animation-origin-x",
          `${snapToPixel(anchorCenterX - appliedLeft)}px`,
        );
        popoverEl.style.setProperty(
          "--popup-animation-origin-y",
          `${snapToPixel(anchorCenterY - top)}px`,
        );
        return;
      }
      // Not anchored: animate from the pointer that triggered the open, so
      // the popover feels like it grows out from under the click.
      const pointerEvent = findEvent(
        e,
        (candidate) => typeof candidate.clientX === "number",
      );
      if (pointerEvent) {
        popoverEl.style.setProperty(
          "--popup-animation-origin-x",
          `${snapToPixel(pointerEvent.clientX + scrollLeft - appliedLeft)}px`,
        );
        popoverEl.style.setProperty(
          "--popup-animation-origin-y",
          `${snapToPixel(pointerEvent.clientY + scrollTop - top)}px`,
        );
      } else {
        popoverEl.style.removeProperty("--popup-animation-origin-x");
        popoverEl.style.removeProperty("--popup-animation-origin-y");
      }
    };

    if (scrollTrap) {
      addCleanup(trapScrollInside(popoverEl));
    }
    if (focusTrap) {
      addCleanup(trapFocusInside(popoverEl, { debug: debugFocus }));
    }
    const rectEffect = visibleRectEffect(
      effectiveAnchor,
      ({ visibilityRatio }, { event }) => {
        if (visibilityRatio <= 0.2) {
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
    // Picker's openController.open() reads this back synchronously right
    // after openEffect() returns (see picker_custom.jsx useOpenController).
    e.detail.focusedBeforeOpen = focusedBeforeOpen;

    return (closeEvent) => {
      debugPopup(closeEvent, `closePopover()`);
      markAutofocusRestoreOnClose(popoverEl);
      popoverEl.setAttribute("aria-expanded", "false");
      popoverEl.hidePopover();

      restore_focus: {
        const focusoutEvent = findEvent(closeEvent, "focusout");
        if (focusoutEvent) {
          debugFocus(closeEvent, `closed by focusout -> let focus go away`);
        } else {
          const mousedownEvent = findEvent(closeEvent, "mousedown");
          if (mousedownEvent) {
            debugFocus(
              closeEvent,
              "closed by mousedown -> prevent browser focus (mousedown.preventDefault())",
            );
            mousedownEvent.preventDefault();
          }
          debugFocus(
            closeEvent,
            `restore focus to previously focused element`,
            focusedBeforeOpen,
          );
          focusedBeforeOpen.focus({ preventScroll: true });
        }
      }

      cleanup();
    };
  };

  return (
    <Box
      id={id}
      popover="manual"
      navi-animation={isAutoAnimation ? undefined : animation}
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
          if (pointerTrap) {
            e.preventDefault();
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

// Lets consumers pass animationDuration="0.5s" as a regular prop; Box maps
// it to the CSS var for us (see box.jsx's styleCSSVars handling).
const POPUP_STYLE_CSS_VARS = {
  animationDuration: "--popup-animation-duration",
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
  const { width, height } = popoverEl.getBoundingClientRect();
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

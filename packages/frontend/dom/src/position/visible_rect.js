import { getScrollContainer } from "../interaction/scroll/scroll_container.js";
import { createPubSub } from "../pub_sub.js";
import { getBorderSizes } from "../size/get_border_sizes.js";
import { getPaddingSizes } from "../size/get_padding_sizes.js";
import { snapToPixel } from "../size/snap_to_pixel.js";
import { getPositioningScrollOffset } from "./dom_coords.js";

const DEBUG = false;

// Minimum fraction of element width/height that must be visible on the preferred side
// before flipping to the opposite side. Prevents flickering near the flip threshold.
const MIN_CONTENT_VISIBILITY_RATIO = 0.6;

/**
 * Tracks how much of an element is visible within its scrollable parent and within the
 * document viewport. Calls update() on initialization and whenever visibility changes
 * (scroll, resize, intersection changes, ancestor open/close).
 *
 * @param {HTMLElement} element - The element to observe.
 * @param {function(visibleRect: VisibleRect, info: VisibleRectInfo): void} update - Called on every visibility change.
 *
 * @typedef {Object} VisibleRect
 * @property {number} left   - Left edge of the visible area, document-relative (px).
 * @property {number} top    - Top edge of the visible area, document-relative (px).
 * @property {number} right  - Right edge of the visible area, document-relative (px).
 * @property {number} bottom - Bottom edge of the visible area, document-relative (px).
 * @property {number} width  - Width of the visible area (px).
 * @property {number} height - Height of the visible area (px).
 * @property {number} visibilityRatio - Fraction of the element's area truly visible on screen (0–1).
 *   For document scroll containers: viewport-clipped fraction.
 *   For custom containers: fraction clipped by both the container and the viewport.
 *   Is 0 when ancestorClosed is true.
 *
 * @typedef {Object} VisibleRectInfo
 * @property {Event}   event          - The DOM event (or CustomEvent) that triggered the check.
 * @property {number}  width          - Raw getBoundingClientRect() width of the element.
 * @property {number}  height         - Raw getBoundingClientRect() height of the element.
 * @property {boolean} ancestorClosed - True when a popover, dialog, or details ancestor is
 *   currently closed so the element is not rendered. All visibleRect values are 0 in that case.
 *   update() is called immediately on ancestor close and again (with false) on reopen.
 *
 * update() is called:
 *   - Once synchronously on initialization (event.type = "initialization")
 *   - On document/container scroll, window resize, element resize, intersection changes, touch move
 *   - Immediately when an ancestor popover/dialog/details opens or closes
 *
 * A bit like https://tetherjs.dev/ but different
 */
export const visibleRectEffect = (
  element,
  update,
  {
    event: initialEvent = new CustomEvent("initialization"),
    skipElementResize,
  } = {},
) => {
  const [teardown, addTeardown] = createPubSub();
  const scrollContainer = getScrollContainer(element);
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  let lastMeasuredWidth;
  let lastMeasuredHeight;
  let ancestorClosedCount = 0;
  const check = (event) => {
    if (DEBUG) {
      console.group(`visibleRect.check("${event.type}")`);
    }

    // 1. Calculate element position relative to scrollable parent
    const { scrollLeft, scrollTop } = scrollContainer;
    const visibleAreaLeft = scrollLeft;
    const visibleAreaTop = scrollTop;

    // Get element position relative to its scrollable parent
    let elementAbsoluteLeft;
    let elementAbsoluteTop;
    if (scrollContainerIsDocument) {
      // For document scrolling, use offsetLeft/offsetTop relative to document
      const rect = element.getBoundingClientRect();
      elementAbsoluteLeft = rect.left + scrollLeft;
      elementAbsoluteTop = rect.top + scrollTop;
    } else {
      // For custom container, get position relative to the container
      const elementRect = element.getBoundingClientRect();
      const scrollContainerRect = scrollContainer.getBoundingClientRect();
      elementAbsoluteLeft =
        elementRect.left - scrollContainerRect.left + scrollLeft;
      elementAbsoluteTop =
        elementRect.top - scrollContainerRect.top + scrollTop;
    }

    const leftVisible =
      visibleAreaLeft < elementAbsoluteLeft
        ? elementAbsoluteLeft - visibleAreaLeft
        : 0;
    const topVisible =
      visibleAreaTop < elementAbsoluteTop
        ? elementAbsoluteTop - visibleAreaTop
        : 0;
    // Convert to overlay coordinates (adjust for custom scrollable container)
    let overlayLeft = leftVisible;
    let overlayTop = topVisible;
    if (!scrollContainerIsDocument) {
      const { left: scrollableLeft, top: scrollableTop } =
        scrollContainer.getBoundingClientRect();
      overlayLeft += scrollableLeft;
      overlayTop += scrollableTop;
    }

    // 2. Calculate element visible width/height
    const { width, height } = element.getBoundingClientRect();
    lastMeasuredWidth = width;
    lastMeasuredHeight = height;
    const visibleAreaWidth = scrollContainer.clientWidth;
    const visibleAreaHeight = scrollContainer.clientHeight;
    const visibleAreaRight = visibleAreaLeft + visibleAreaWidth;
    const visibleAreaBottom = visibleAreaTop + visibleAreaHeight;
    // 2.1 Calculate visible width
    let widthVisible;
    {
      const maxVisibleWidth = visibleAreaWidth - leftVisible;
      const elementAbsoluteRight = elementAbsoluteLeft + width;
      const elementLeftIsVisible = elementAbsoluteLeft >= visibleAreaLeft;
      const elementRightIsVisible = elementAbsoluteRight <= visibleAreaRight;
      if (elementLeftIsVisible && elementRightIsVisible) {
        // Element fully visible horizontally
        widthVisible = width;
      } else if (elementLeftIsVisible && !elementRightIsVisible) {
        // Element left is visible, right is cut off
        widthVisible = visibleAreaRight - elementAbsoluteLeft;
      } else if (!elementLeftIsVisible && elementRightIsVisible) {
        // Element left is cut off, right is visible
        widthVisible = elementAbsoluteRight - visibleAreaLeft;
      } else {
        // Element spans beyond both sides, show only visible area portion
        widthVisible = maxVisibleWidth;
      }
    }
    // 2.2 Calculate visible height
    let heightVisible;
    {
      const maxVisibleHeight = visibleAreaHeight - topVisible;
      const elementAbsoluteBottom = elementAbsoluteTop + height;
      const elementTopIsVisible = elementAbsoluteTop >= visibleAreaTop;
      const elementBottomIsVisible = elementAbsoluteBottom <= visibleAreaBottom;
      if (elementTopIsVisible && elementBottomIsVisible) {
        // Element fully visible vertically
        heightVisible = height;
      } else if (elementTopIsVisible && !elementBottomIsVisible) {
        // Element top is visible, bottom is cut off
        heightVisible = visibleAreaBottom - elementAbsoluteTop;
      } else if (!elementTopIsVisible && elementBottomIsVisible) {
        // Element top is cut off, bottom is visible
        heightVisible = elementAbsoluteBottom - visibleAreaTop;
      } else {
        // Element spans beyond both sides, show only visible area portion
        heightVisible = maxVisibleHeight;
      }
    }

    // Calculate visibilityRatio: fraction of element area truly visible on screen.
    // For custom containers we intersect the container-clipped visible size (widthVisible x
    // heightVisible) with the viewport bounds, so an element scrolled out of its container
    // correctly reports 0 rather than the raw viewport intersection of its bounding rect.
    let visibilityRatio;
    if (scrollContainerIsDocument) {
      visibilityRatio = (widthVisible * heightVisible) / (width * height);
    } else {
      // widthVisible/heightVisible are already clipped to the scroll container.
      // Now clip their viewport-relative counterparts against the viewport.
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      // Container-clipped visible rect in viewport coordinates
      const visibleLeft = overlayLeft;
      const visibleTop = overlayTop;
      const visibleRight = overlayLeft + widthVisible;
      const visibleBottom = overlayTop + heightVisible;
      // Intersect with viewport
      const clippedLeft = visibleLeft < 0 ? 0 : visibleLeft;
      const clippedTop = visibleTop < 0 ? 0 : visibleTop;
      const clippedRight =
        visibleRight > viewportWidth ? viewportWidth : visibleRight;
      const clippedBottom =
        visibleBottom > viewportHeight ? viewportHeight : visibleBottom;
      const clippedWidth =
        clippedRight > clippedLeft ? clippedRight - clippedLeft : 0;
      const clippedHeight =
        clippedBottom > clippedTop ? clippedBottom - clippedTop : 0;
      visibilityRatio = (clippedWidth * clippedHeight) / (width * height);
    }

    const visibleRect = {
      left: overlayLeft,
      top: overlayTop,
      right: overlayLeft + widthVisible,
      bottom: overlayTop + heightVisible,
      width: widthVisible,
      height: heightVisible,
      visibilityRatio,
    };

    if (DEBUG) {
      console.log(`update(${JSON.stringify(visibleRect, null, "  ")})`);
      console.groupEnd();
    }
    update(visibleRect, {
      event,
      width,
      height,
      ancestorClosed: ancestorClosedCount > 0,
    });
  };

  check(initialEvent);

  const [publishBeforeAutoCheck, onBeforeAutoCheck] = createPubSub();
  auto_check: {
    const autoCheck = (event) => {
      const beforeCheckResults = publishBeforeAutoCheck(event);
      check(event);
      for (const beforeCheckResult of beforeCheckResults) {
        if (typeof beforeCheckResult === "function") {
          beforeCheckResult();
        }
      }
    };
    // let rafId = null;
    // const scheduleCheck = (reason) => {
    //   cancelAnimationFrame(rafId);
    //   rafId = requestAnimationFrame(() => {
    //     autoCheck(reason);
    //   });
    // };
    // addTeardown(() => {
    //   cancelAnimationFrame(rafId);
    // });

    on_scroll: {
      // If scrollable parent is not document, also listen to document scroll
      // to update UI position when the scrollable parent moves in viewport
      const onDocumentScroll = (e) => {
        autoCheck(e);
      };
      document.addEventListener("scroll", onDocumentScroll, {
        passive: true,
      });
      addTeardown(() => {
        document.removeEventListener("scroll", onDocumentScroll, {
          passive: true,
        });
      });
      if (!scrollContainerIsDocument) {
        const onScroll = (e) => {
          autoCheck(e);
        };
        scrollContainer.addEventListener("scroll", onScroll, {
          passive: true,
        });
        addTeardown(() => {
          scrollContainer.removeEventListener("scroll", onScroll, {
            passive: true,
          });
        });
      }
    }
    on_visual_viewport_scroll: {
      // visualViewport scroll fires when the visual viewport pans independently
      // of the layout viewport (e.g. during pinch-zoom). This is distinct from
      // document scroll and must be observed separately.
      if (window.visualViewport) {
        const onVisualViewportScroll = (e) => {
          autoCheck(e);
        };
        window.visualViewport.addEventListener(
          "scroll",
          onVisualViewportScroll,
        );
        addTeardown(() => {
          window.visualViewport.removeEventListener(
            "scroll",
            onVisualViewportScroll,
          );
        });
      }
    }
    on_visual_viewport_resize: {
      if (window.visualViewport) {
        // visualViewport resize fires when the virtual keyboard opens/closes on mobile.
        // On mobile, tapping from one input to another triggers a resize because
        // the virtual keyboard briefly starts to close before the new input receives
        // focus and the keyboard reopens. Debouncing prevents repositioning the
        // during that transient state, which would cause a visible flicker.
        let resizeTimeout;
        const cancelDelayedAutoCheck = () => {
          clearTimeout(resizeTimeout);
        };
        const onVisualViewportResize = (e) => {
          cancelDelayedAutoCheck();
          resizeTimeout = setTimeout(() => {
            autoCheck(e);
          }, 100);
        };
        window.visualViewport.addEventListener(
          "resize",
          onVisualViewportResize,
        );
        addTeardown(() => {
          window.visualViewport.removeEventListener(
            "resize",
            onVisualViewportResize,
          );
        });
      }
      const onWindowResize = (e) => {
        autoCheck(e);
      };
      window.addEventListener("resize", onWindowResize);
      addTeardown(() => {
        window.removeEventListener("resize", onWindowResize);
      });
    }
    on_element_resize: {
      if (skipElementResize) {
        break on_element_resize;
      }

      let isFirst = true;
      let handlingResize = false;
      const resizeObserver = new ResizeObserver(() => {
        if (isFirst) {
          isFirst = false;
          return;
        }
        if (handlingResize) {
          return;
        }
        // we use directly the result of getBoundingClientRect() instead of the resizeEntry.contentRect or resizeEntry.borderBoxSize
        // so that:
        // - We can compare the dimensions measure in the last check and the current one
        // - We don't have to check element boz-sizing to know what to compare
        // - resizeEntry.borderBoxSize browser support is not that great
        const { width, height } = element.getBoundingClientRect();
        const widthDiff = Math.abs(width - lastMeasuredWidth);
        const heightDiff = Math.abs(height - lastMeasuredHeight);
        if (widthDiff === 0 && heightDiff === 0) {
          return;
        }
        handlingResize = true;
        autoCheck(
          new CustomEvent("element_size_change", { detail: { width, height } }),
        );
        handlingResize = false;
      });
      resizeObserver.observe(element);
      // Temporarily disconnect ResizeObserver to prevent feedback loops eventually caused by update function
      onBeforeAutoCheck(() => {
        resizeObserver.unobserve(element);
        return () => {
          // This triggers a new call to the resive observer that will be ignored thanks to
          // the widthDiff/heightDiff early return
          resizeObserver.observe(element);
        };
      });
      addTeardown(() => {
        resizeObserver.disconnect();
      });
    }
    on_intersection_change: {
      const documentIntersectionObserver = new IntersectionObserver(
        () => {
          autoCheck(
            new CustomEvent("element_intersection_with_document_change"),
          );
        },
        {
          root: null,
          rootMargin: "0px",
          threshold: [0, 0.1, 0.9, 1],
        },
      );
      documentIntersectionObserver.observe(element);
      addTeardown(() => {
        documentIntersectionObserver.disconnect();
      });
      if (!scrollContainerIsDocument) {
        const scrollIntersectionObserver = new IntersectionObserver(
          () => {
            autoCheck(
              new CustomEvent("element_intersection_with_scroll_change"),
            );
          },
          {
            root: scrollContainer,
            rootMargin: "0px",
            threshold: [0, 0, 1, 0.9, 1],
          },
        );
        scrollIntersectionObserver.observe(element);
        addTeardown(() => {
          scrollIntersectionObserver.disconnect();
        });
      }
    }
    on_window_touchmove: {
      const onWindowTouchMove = (e) => {
        autoCheck(e);
      };
      window.addEventListener("touchmove", onWindowTouchMove, {
        passive: true,
      });
      addTeardown(() => {
        window.removeEventListener("touchmove", onWindowTouchMove, {
          passive: true,
        });
      });
    }
    on_ancestor_events: {
      let current = element.parentElement;
      while (current) {
        if (
          current.hasAttribute("popover") ||
          current.tagName === "DIALOG" ||
          current.tagName === "DETAILS"
        ) {
          const ancestor = current;
          const isInitiallyClosed =
            ancestor.tagName === "DIALOG" || ancestor.tagName === "DETAILS"
              ? !ancestor.open
              : !ancestor.matches(":popover-open");
          if (isInitiallyClosed) {
            ancestorClosedCount++;
          }
          // eslint-disable-next-line no-loop-func
          const onToggle = (e) => {
            const isClosed =
              ancestor.tagName === "DETAILS"
                ? !ancestor.open
                : e.newState === "closed";
            if (isClosed) {
              ancestorClosedCount++;
              update(
                {
                  left: 0,
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: 0,
                  height: 0,
                  visibilityRatio: 0,
                },
                { event: e, width: 0, height: 0, ancestorClosed: true },
              );
            } else {
              if (ancestorClosedCount > 0) {
                ancestorClosedCount--;
              }
              if (ancestorClosedCount === 0) {
                check(e);
              }
            }
          };
          ancestor.addEventListener("toggle", onToggle);

          const onNaviPositionUpdate = (e) => {
            autoCheck(e);
          };
          ancestor.addEventListener(
            "navi_position_update",
            onNaviPositionUpdate,
          );
          addTeardown(() => {
            ancestor.removeEventListener("toggle", onToggle);
            ancestor.removeEventListener(
              "navi_position_update",
              onNaviPositionUpdate,
            );
          });
        }
        current = current.parentElement;
      }
    }
  }

  return {
    check,
    onBeforeAutoCheck,
    disconnect: () => {
      teardown();
    },
  };
};

/**
 * Places element relative to anchor with independent control of horizontal and vertical axes.
 *
 * Horizontal axis — positionX / positionXFixed (left → right):
 *   "on-the-left"   element.right  = anchor.left   (sits entirely to the left of anchor)
 *   "left-aligned"  element.left   = anchor.left   (left edges aligned, overlapping)
 *   "center"        element centered horizontally over anchor  (default)
 *   "right-aligned" element.right  = anchor.right  (right edges aligned, overlapping)
 *   "on-the-right"  element.left   = anchor.right  (sits entirely to the right of anchor)
 *
 * Vertical axis — positionY / positionYFixed (top → bottom):
 *   "above"          element.bottom = anchor.top    (sits above, no overlap)
 *   "top-aligned"    element.top    = anchor.top    (top edges aligned, overlapping)
 *   "center"         element centered vertically over anchor
 *   "bottom-aligned" element.bottom = anchor.bottom (bottom edges aligned, overlapping)
 *   "below"          element.top    = anchor.bottom (sits below, no overlap)  (default)
 *
 * positionX / positionY attempt the requested placement and automatically flip to the
 * logical opposite when the element does not fit in the viewport:
 *   above ↔ below,   top-aligned ↔ bottom-aligned,   on-the-left ↔ on-the-right,   left-aligned ↔ right-aligned
 *
 * positionXFixed / positionYFixed skip the fit check entirely.
 *
 * The resolved X and Y are persisted as data-position-x-current / data-position-y-current
 * on the element so subsequent calls start from the last resolved position (avoids
 * flickering when the element is near the flip threshold) and so other CSS/JS can read
 * "which side is this on right now" — including for a fixed axis, even though a fixed
 * axis never reads the attribute back itself (positionXFixed/positionYFixed always win).
 *
 * @param {HTMLElement} element - The element to position (position: absolute or
 *   fixed — detected from its own computed style, see the scroll offset comment below)
 * @param {HTMLElement} anchor - The anchor element to position against
 * @param {object} [options]
 * @param {string} [options.positionX="center"] - Preferred X placement, with viewport fallback.
 *   "on-the-left"   — element.right  = anchor.left   (sits entirely to the left of anchor)
 *   "left-aligned"  — element.left   = anchor.left   (left edges aligned, overlapping)
 *   "center"        — element centered horizontally over anchor  (default)
 *   "right-aligned" — element.right  = anchor.right  (right edges aligned, overlapping)
 *   "on-the-right"  — element.left   = anchor.right  (sits entirely to the right of anchor)
 * @param {string} [options.positionY="below"] - Preferred Y placement, with viewport fallback.
 *   "above"          — element.bottom = anchor.top    (sits above, no overlap)
 *   "top-aligned"    — element.top    = anchor.top    (top edges aligned, overlapping)
 *   "center"         — element centered vertically over anchor
 *   "bottom-aligned" — element.bottom = anchor.bottom (bottom edges aligned, overlapping)
 *   "below"          — element.top    = anchor.bottom (sits below, no overlap)  (default)
 * @param {string} [options.positionXFixed] - Force X placement, skipping the fit-check. Same values as positionX.
 * @param {string} [options.positionYFixed] - Force Y placement, skipping the fit-check. Same values as positionY.
 * @param {number} [options.alignToViewportEdgeWhenAnchorNearEdge=0] - Snap to viewport left
 *   edge when anchor is within this many px of the left edge and element is wider than anchor.
 * @param {number} [options.minLeft=0] - Minimum left coordinate (document-relative).
 * @returns {{ positionX, positionY, left, top, width, height, anchorLeft, anchorTop, anchorRight, anchorBottom, spaceLeft, spaceRight, spaceAbove, spaceBelow }}
 */
export const pickPositionRelativeTo = (
  element,
  anchor,
  {
    positionX = "center",
    positionY = "below",
    positionXFixed,
    positionYFixed,
    alignToViewportEdgeWhenAnchorNearEdge = 0,
    minLeft = 0,
    spacing = 0,
    alignToAnchorBox = "border-box",
    viewportSpacing = 0,
  } = {},
) => {
  if (
    import.meta.dev &&
    getScrollContainer(element) !== document.documentElement
  ) {
    // The idea behind this warning is that pickPositionRelativeTo is meant to position a tooltip/dropdown etc
    // And for this use case the element to position should be document-relative
    // (position: absolute with first scrollable parent being the document)
    // Because this is how you achieve the best results:
    // 1. The element naturally follow document scroll
    // Which gives the best experience when user scrolls the page or the container
    // 2. The element can take more visible size in case target is within a scrollable container
    // or uses overflow: hidden somewhere in its ancestor chain
    console.warn(
      "pickPositionRelativeTo should be used only for document-relative element",
    );
  }

  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  // document.documentElement is used as a sentinel "no real anchor" value
  // (see popover.jsx's effectiveAnchor fallback): an anchorless popup should
  // center/place itself against the visual viewport, not against <html>'s own
  // box — which, unlike the viewport, grows with document content and can be
  // far taller than what's on screen (its top is also negative once the page
  // is scrolled). Using the viewport rect here fixes that; the scroll offset
  // is still applied below like any other case (see getPositioningScrollOffset).
  const anchorIsViewport = anchor === document.documentElement;
  // Get viewport-relative positions
  const anchorRect = anchorIsViewport
    ? { left: 0, top: 0, right: viewportWidth, bottom: viewportHeight }
    : anchor.getBoundingClientRect();
  const anchorLeft = snapToPixel(anchorRect.left);
  const anchorTop = snapToPixel(anchorRect.top);
  const anchorRight = snapToPixel(anchorRect.right);
  const anchorBottom = snapToPixel(anchorRect.bottom);
  // offsetWidth/offsetHeight (layout box), not getBoundingClientRect() (the
  // painted/transformed box): the element being positioned may have an
  // active CSS `scale`/`translate` transform mid-animation (e.g. a popover
  // using animation="scale"/"grow", still at its @starting-style value the
  // instant it's first shown) — getBoundingClientRect() would then report
  // its *shrunk* transformed size, throwing off any math that centers/fits
  // against the element's own dimensions.
  const elementWidth = element.offsetWidth;
  const elementHeight = element.offsetHeight;
  const anchorWidth = anchorRight - anchorLeft;
  const anchorHeight = anchorBottom - anchorTop;

  // alignToAnchorBox controls whether the element aligns to the anchor's border-box (outer edge)
  // or content-box (inner content area, ignoring padding and border).
  // content-box lets the arrow point into the content area instead of the outer edge.
  // Insets are directional: top/bottom for Y-axis, left/right for X-axis.
  // When positioning above, only the top inset applies (content-box top edge).
  // When positioning below, only the bottom inset applies (content-box bottom edge).
  let insetTop = 0;
  let insetBottom = 0;
  let insetLeft = 0;
  let insetRight = 0;
  if (alignToAnchorBox === "content-box") {
    const anchorBorderSizes = getBorderSizes(anchor);
    const anchorPaddingSizes = getPaddingSizes(anchor);
    insetTop = anchorBorderSizes.top + anchorPaddingSizes.top;
    insetBottom = anchorBorderSizes.bottom + anchorPaddingSizes.bottom;
    insetLeft = anchorBorderSizes.left + anchorPaddingSizes.left;
    insetRight = anchorBorderSizes.right + anchorPaddingSizes.right;
  }
  const spaceAbove = anchorTop + insetTop;
  const spaceBelow = viewportHeight - anchorBottom + insetBottom;
  const effectiveAnchorLeft = anchorLeft + insetLeft;
  const effectiveAnchorRight = anchorRight - insetRight;
  const spaceLeft = anchorLeft + insetLeft;
  const spaceRight = viewportWidth - anchorRight + insetRight;

  // Resolve active X and Y, and whether each is fixed (no flip fallback)
  let activeX;
  let activeY;
  const xIsFixed = Boolean(positionXFixed);
  const yIsFixed = Boolean(positionYFixed);
  const hasStoredY = Boolean(element.getAttribute("data-position-y-current"));
  const hasStoredX = Boolean(element.getAttribute("data-position-x-current"));
  if (xIsFixed) {
    activeX = positionXFixed;
  } else {
    const storedX = element.getAttribute("data-position-x-current");
    activeX = storedX ?? positionX;
  }
  if (yIsFixed) {
    activeY = positionYFixed;
  } else {
    const storedY = element.getAttribute("data-position-y-current");
    activeY = storedY ?? positionY;
  }

  // Resolve final Y
  let finalY;
  {
    const oppositeY = {
      "above": "below",
      "below": "above",
      "top-aligned": "bottom-aligned",
      "bottom-aligned": "top-aligned",
    };
    // Compute effective space for a given Y value
    const spaceFor = (y) => {
      if (y === "above") {
        return spaceAbove - spacing - viewportSpacing;
      }
      if (y === "bottom-aligned") {
        return spaceAbove + anchorHeight - viewportSpacing;
      }
      if (y === "below") {
        return spaceBelow - spacing - viewportSpacing;
      }
      if (y === "top-aligned") {
        return spaceBelow + anchorHeight - viewportSpacing;
      }
      return Infinity; // center
    };
    if (yIsFixed || activeY === "center") {
      finalY = activeY;
    } else if (!hasStoredY) {
      // Never positioned before — pick the best side from scratch.
      const preferred = positionY;
      const opposite = oppositeY[preferred];
      const preferredFits = spaceFor(preferred) >= elementHeight;
      const oppositeFits = spaceFor(opposite) >= elementHeight;
      if (preferredFits) {
        // Preferred fits completely — use it (even if opposite also fits)
        finalY = preferred;
      } else if (oppositeFits) {
        // Only opposite fits completely — flip
        finalY = opposite;
      } else {
        // Neither fits completely — use whichever meets the minimum ratio
        const preferredMeetsRatio =
          spaceFor(preferred) / elementHeight >= MIN_CONTENT_VISIBILITY_RATIO;
        finalY = preferredMeetsRatio ? preferred : opposite;
      }
    } else {
      // Previously positioned — stay as long as current side meets minimum ratio
      const currentFitsEnough =
        spaceFor(activeY) / elementHeight >= MIN_CONTENT_VISIBILITY_RATIO;
      if (currentFitsEnough) {
        finalY = activeY;
      } else {
        // Only flip if the opposite side has more space — avoids oscillation
        // when neither side has enough room (both fail the ratio).
        const opposite = oppositeY[activeY];
        const oppositeHasMoreSpace = spaceFor(opposite) > spaceFor(activeY);
        finalY = oppositeHasMoreSpace ? opposite : activeY;
      }
    }
  }

  // Resolve final X
  let finalX;
  {
    const oppositeX = {
      "on-the-left": "on-the-right",
      "on-the-right": "on-the-left",
      "left-aligned": "right-aligned",
      "right-aligned": "left-aligned",
    };
    // Compute effective space for a given X value
    const spaceFor = (x) => {
      if (x === "on-the-left") {
        return spaceLeft - spacing - viewportSpacing;
      }
      if (x === "left-aligned") {
        return viewportWidth - anchorLeft - viewportSpacing;
      }
      if (x === "right-aligned") {
        return anchorRight - viewportSpacing;
      }
      if (x === "on-the-right") {
        return spaceRight - spacing - viewportSpacing;
      }
      return Infinity; // center
    };
    if (xIsFixed || activeX === "center") {
      finalX = activeX;
    } else if (!hasStoredX) {
      // Never positioned before — pick the best side from scratch.
      const preferred = positionX;
      const opposite = oppositeX[preferred];
      const preferredFits = spaceFor(preferred) >= elementWidth;
      const oppositeFits = spaceFor(opposite) >= elementWidth;
      if (preferredFits) {
        finalX = preferred;
      } else if (oppositeFits) {
        finalX = opposite;
      } else {
        const preferredMeetsRatio =
          spaceFor(preferred) / elementWidth >= MIN_CONTENT_VISIBILITY_RATIO;
        finalX = preferredMeetsRatio ? preferred : opposite;
      }
    } else {
      // Previously positioned — stay as long as current side meets minimum ratio
      const currentFitsEnough =
        spaceFor(activeX) / elementWidth >= MIN_CONTENT_VISIBILITY_RATIO;
      if (currentFitsEnough) {
        finalX = activeX;
      } else {
        finalX = oppositeX[activeX];
      }
    }
  }

  // Calculate horizontal position (viewport-relative)
  let elementPositionLeft;
  {
    if (finalX === "on-the-left") {
      elementPositionLeft = effectiveAnchorLeft - elementWidth - spacing;
    } else if (finalX === "left-aligned") {
      elementPositionLeft = effectiveAnchorLeft;
    } else if (finalX === "center") {
      // Complex logic handles wide anchors and viewport-edge snapping
      const anchorIsWiderThanViewport = anchorWidth > viewportWidth;
      if (anchorIsWiderThanViewport) {
        const anchorLeftIsVisible = effectiveAnchorLeft >= 0;
        const anchorRightIsVisible = effectiveAnchorRight <= viewportWidth;
        if (!anchorLeftIsVisible && anchorRightIsVisible) {
          const viewportCenter = viewportWidth / 2;
          const distanceFromRightEdge = viewportWidth - effectiveAnchorRight;
          elementPositionLeft =
            viewportCenter - distanceFromRightEdge / 2 - elementWidth / 2;
        } else if (anchorLeftIsVisible && !anchorRightIsVisible) {
          const viewportCenter = viewportWidth / 2;
          const distanceFromLeftEdge = -effectiveAnchorLeft;
          elementPositionLeft =
            viewportCenter - distanceFromLeftEdge / 2 - elementWidth / 2;
        } else {
          elementPositionLeft = viewportWidth / 2 - elementWidth / 2;
        }
      } else {
        elementPositionLeft =
          effectiveAnchorLeft +
          (effectiveAnchorRight - effectiveAnchorLeft) / 2 -
          elementWidth / 2;
        if (alignToViewportEdgeWhenAnchorNearEdge) {
          const effectiveAnchorWidth =
            effectiveAnchorRight - effectiveAnchorLeft;
          const elementIsWiderThanAnchor = elementWidth > effectiveAnchorWidth;
          const anchorIsNearLeftEdge =
            effectiveAnchorLeft < alignToViewportEdgeWhenAnchorNearEdge;
          if (elementIsWiderThanAnchor && anchorIsNearLeftEdge) {
            elementPositionLeft = minLeft;
          }
        }
      }
    } else if (finalX === "right-aligned") {
      elementPositionLeft = effectiveAnchorRight - elementWidth;
    } else {
      // "on-the-right"
      elementPositionLeft = effectiveAnchorRight + spacing;
    }
    // Constrain horizontal position to viewport boundaries (with viewportSpacing margin)
    if (elementPositionLeft < viewportSpacing) {
      elementPositionLeft = viewportSpacing;
    } else if (
      elementPositionLeft + elementWidth >
      viewportWidth - viewportSpacing
    ) {
      elementPositionLeft = viewportWidth - viewportSpacing - elementWidth;
    }
  }

  // Calculate vertical position (viewport-relative)
  let elementPositionTop;
  {
    if (finalY === "above") {
      // top is always anchorTop + insetTop - elementHeight - spacing — max-height truncates if needed.
      const idealTop = anchorTop + insetTop - elementHeight - spacing;
      elementPositionTop =
        idealTop < viewportSpacing ? viewportSpacing : idealTop;
    } else if (finalY === "bottom-aligned") {
      const idealTop = anchorBottom - elementHeight;
      elementPositionTop =
        idealTop < viewportSpacing ? viewportSpacing : idealTop;
    } else if (finalY === "center") {
      elementPositionTop = anchorTop + anchorHeight / 2 - elementHeight / 2;
    } else if (finalY === "top-aligned") {
      const idealTop = anchorTop;
      elementPositionTop =
        idealTop % 1 === 0 ? idealTop : Math.floor(idealTop) + 1;
    } else {
      // "below"
      // top is always anchorBottom - insetBottom + spacing — max-height (via --space-available) truncates
      // the element height so it doesn't overflow the viewport bottom.
      const idealTop = anchorBottom - insetBottom + spacing;
      elementPositionTop =
        idealTop % 1 === 0 ? idealTop : Math.floor(idealTop) + 1;
    }
  }

  // Persist resolved X/Y so subsequent calls start from here (avoids
  // flickering) — and so CSS consumers (e.g. Popover's "clip" animation,
  // which reads data-position-y-current to pick which edge to reveal from)
  // can rely on it always reflecting the current side, fixed or not. A fixed
  // axis is never read back from this attribute (xIsFixed/yIsFixed always
  // wins over the stored value above), so persisting it here is purely for
  // those outside readers, not for this function's own flip logic.
  element.setAttribute("data-position-x-current", finalX);
  element.setAttribute("data-position-y-current", finalY);

  // Convert the viewport-relative math above into whatever coordinate space
  // `element.style.top/left` actually needs: none added for position: fixed
  // (already viewport-relative — adding scroll would double-count it), the
  // current scroll offset added for position: absolute (relative to the
  // initial containing block, i.e. document-relative) — including when
  // anchorIsViewport, so the result lands at the visual center of the
  // viewport at its current scroll position. visibleRectEffect recomputes
  // this on every scroll tick, which is what keeps it looking anchored as
  // the page scrolls either way.
  const { scrollLeft, scrollTop } = getPositioningScrollOffset(element);
  const elementDocumentLeft = snapToPixel(elementPositionLeft + scrollLeft);
  const elementDocumentTop = snapToPixel(elementPositionTop + scrollTop);
  const anchorDocumentLeft = anchorLeft + scrollLeft;
  const anchorDocumentTop = anchorTop + scrollTop;
  const anchorDocumentRight = anchorRight + scrollLeft;
  const anchorDocumentBottom = anchorBottom + scrollTop;

  // For overlap variants the element starts at the anchor edge (not past it),
  // so the usable space includes the anchor dimension.
  // spacing (gap between anchor and element) and viewportSpacing are subtracted
  // so callers get the net usable space directly.
  const effectiveSpaceAbove =
    (finalY === "bottom-aligned" ? spaceAbove + anchorHeight : spaceAbove) -
    (finalY === "above" ? spacing : 0) -
    viewportSpacing;
  const effectiveSpaceBelow =
    (finalY === "top-aligned" ? spaceBelow + anchorHeight : spaceBelow) -
    (finalY === "below" ? spacing : 0) -
    viewportSpacing;

  return {
    positionX: finalX,
    positionY: finalY,
    left: elementDocumentLeft,
    top: elementDocumentTop,
    width: elementWidth,
    height: elementHeight,
    anchorLeft: anchorDocumentLeft,
    anchorTop: anchorDocumentTop,
    anchorRight: anchorDocumentRight,
    anchorBottom: anchorDocumentBottom,
    spaceLeft: spaceLeft - viewportSpacing,
    spaceRight: spaceRight - viewportSpacing,
    spaceAbove: effectiveSpaceAbove,
    spaceBelow: effectiveSpaceBelow,
  };
};

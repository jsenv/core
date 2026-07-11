import { dispatchCustomEvent } from "../dom_events.js";
import { getScrollContainer } from "../interaction/scroll/scroll_container.js";
import { createPubSub } from "../pub_sub.js";
import { getBorderSizes } from "../size/get_border_sizes.js";
import { getPaddingSizes } from "../size/get_padding_sizes.js";
import { snapToPixel } from "../size/snap_to_pixel.js";
import { getStyle } from "../style/dom_styles.js";
import {
  closestOpenableAncestor,
  isAncestorOpen,
  observeAncestorOpenState,
} from "./ancestor_open.js";
import { getPositioningScrollOffset } from "./dom_coords.js";
import { getPositionedParent } from "./offset_parent.js";
import {
  subscribeVisualViewportResizeSettled,
  subscribeWindowResizeSettled,
} from "./window_size.js";

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
 * @property {Event}   event                 - The DOM event (or CustomEvent) that triggered the check.
 * @property {number}  width                 - Raw getBoundingClientRect() width of the element.
 * @property {number}  height                - Raw getBoundingClientRect() height of the element.
 * @property {boolean} ancestorClosed        - True when a popover, dialog, or details ancestor is
 *   currently closed so the element is not rendered. All visibleRect values are 0 in that case.
 *   update() is called immediately on ancestor close and again (with false) on reopen.
 * @property {boolean} ancestorRepositioning - True while an ancestor dialog/popover is itself
 *   mid-repositioning — its own left/top Web Animations API animation actually running, dispatched
 *   via navi_position_transition (distinct from navi_position_change, which fires once with the
 *   final target, not per animation frame — see applyNewPosition's own notifyPositionTransition for
 *   where navi_position_transition itself comes from). The element's own anchor may be inside
 *   that ancestor and mid-flight, so any position computed while this is true is unreliable —
 *   consumers (Popover, Callout) hide themselves for its duration and reposition once it clears.
 *
 * update() is called:
 *   - Once synchronously on initialization (event.type = "initialization")
 *   - On document/container scroll, window resize, element resize, intersection changes, touch move
 *   - Immediately when an ancestor popover/dialog/details opens or closes
 *   - Immediately when an ancestor popover/dialog starts or stops repositioning itself
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
  // getScrollContainer(document.documentElement) returns null specifically
  // when the document itself has no overflow to scroll (e.g. a small
  // dialog/popover on an otherwise short page) — document.documentElement
  // is still a perfectly valid fallback in that case (scrollLeft/scrollTop
  // are just 0), so this never needs to crash the way a bare
  // `getScrollContainer(element)` result would below.
  const scrollContainer =
    getScrollContainer(element) ?? document.documentElement;
  const scrollContainerIsDocument =
    scrollContainer === document.documentElement;
  let lastMeasuredWidth;
  let lastMeasuredHeight;
  let ancestorClosedCount = 0;
  // Set while an ancestor dialog/popover is itself mid-repositioning (its
  // own `left`/`top` CSS transition actually running — see
  // navi_position_transition below) — as opposed to navi_position_change,
  // dispatched once with the *final* target position, not per animation
  // frame. A descendant anchored to something inside that
  // ancestor has no correct position to compute during that window (the
  // anchor is still mid-flight) and no way to keep tracking it smoothly
  // either (that would need its own per-frame loop) — consumers exposing
  // this flag (Popover/Callout) hide themselves for its duration instead of
  // showing a stale or lagging position, and reposition for real once it
  // clears.
  let ancestorRepositioningCount = 0;
  // Every ResizeObserver this effect owns (its own element-resize watcher
  // below, plus one per observeSize() call) subscribes here and unobserves
  // itself the moment an ancestor closes, reobserving once it reopens — see
  // on_ancestor_events below for the publish side, and each subscriber
  // (on_element_resize, observeSize) for the unobserve/reobserve itself.
  // Closing a dialog/popover/details containing several independently-
  // watched elements (an anchor, a popover's own content) can make them all
  // collapse to zero size in the same reflow; leaving their ResizeObservers
  // watching through that is what trips the browser's own same-frame
  // notification-count heuristic ("ResizeObserver loop completed with
  // undelivered notifications"), even though our own reaction to it
  // (check()'s own ancestorClosed flag) is already a no-op for consumers
  // like Callout. Proactively unobserving avoids generating those
  // notifications in the first place instead of just ignoring them.
  let resizeWatchingPaused = false;
  const [publishResizeWatchingPausedChange, onResizeWatchingPausedChange] =
    createPubSub();
  const pauseResizeWatching = () => {
    if (resizeWatchingPaused) {
      return;
    }
    resizeWatchingPaused = true;
    publishResizeWatchingPausedChange(true);
  };
  const resumeResizeWatching = () => {
    if (!resizeWatchingPaused) {
      return;
    }
    resizeWatchingPaused = false;
    publishResizeWatchingPausedChange(false);
  };
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
      // visualViewport, not window.innerWidth/Height: the layout viewport
      // doesn't shrink when the on-screen keyboard opens, only the visual
      // one does (same reasoning as pickPositionRelativeTo's own identical
      // choice, visible_rect.js's own doc further down). Its own
      // offsetLeft/Top matter here too, not just width/height: pinch-zoomed
      // and panned, the visual viewport's own top-left can sit anywhere
      // within the layout viewport instead of always at (0, 0) — the same
      // coordinate space getBoundingClientRect() (what overlayLeft/Top and
      // widthVisible/heightVisible are ultimately derived from) uses, so
      // clamping against a hardcoded 0 would clip to the wrong edge once
      // the visual viewport is offset.
      const visualViewport = window.visualViewport;
      const viewportWidth = visualViewport
        ? visualViewport.width
        : window.innerWidth;
      const viewportHeight = visualViewport
        ? visualViewport.height
        : window.innerHeight;
      const viewportOffsetLeft = visualViewport ? visualViewport.offsetLeft : 0;
      const viewportOffsetTop = visualViewport ? visualViewport.offsetTop : 0;
      // Container-clipped visible rect in viewport coordinates
      const visibleLeft = overlayLeft;
      const visibleTop = overlayTop;
      const visibleRight = overlayLeft + widthVisible;
      const visibleBottom = overlayTop + heightVisible;
      // Intersect with viewport
      const clippedLeft =
        visibleLeft < viewportOffsetLeft ? viewportOffsetLeft : visibleLeft;
      const clippedTop =
        visibleTop < viewportOffsetTop ? viewportOffsetTop : visibleTop;
      const viewportRight = viewportOffsetLeft + viewportWidth;
      const viewportBottom = viewportOffsetTop + viewportHeight;
      const clippedRight =
        visibleRight > viewportRight ? viewportRight : visibleRight;
      const clippedBottom =
        visibleBottom > viewportBottom ? viewportBottom : visibleBottom;
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
      ancestorRepositioning: ancestorRepositioningCount > 0,
    });
  };

  check(initialEvent);

  const [publishBeforeAutoCheck, onBeforeAutoCheck] = createPubSub();
  const autoCheck = (event) => {
    const beforeCheckResults = publishBeforeAutoCheck(event);
    check(event);
    for (const beforeCheckResult of beforeCheckResults) {
      if (typeof beforeCheckResult === "function") {
        beforeCheckResult();
      }
    }
  };
  auto_check: {
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
    on_resize: {
      // See window_size.js's own module comment for why both of these go
      // through their shared debounce instead of each keeping its own timer.
      addTeardown(subscribeVisualViewportResizeSettled(autoCheck));
      addTeardown(subscribeWindowResizeSettled(autoCheck));
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
      const unsubscribeResizeWatchingPausedChange =
        onResizeWatchingPausedChange((paused) => {
          if (paused) {
            resizeObserver.unobserve(element);
          } else {
            resizeObserver.observe(element);
          }
        });
      // Temporarily disconnect ResizeObserver to prevent feedback loops eventually caused by update function
      onBeforeAutoCheck(() => {
        resizeObserver.unobserve(element);
        return () => {
          // Not reobserved at all while an ancestor is closed (see
          // pauseResizeWatching/resumeResizeWatching above) — resumeResizeWatching's
          // own publish is what reobserves once it reopens instead.
          if (!resizeWatchingPaused) {
            // This triggers a new call to the resive observer that will be ignored thanks to
            // the widthDiff/heightDiff early return
            resizeObserver.observe(element);
          }
        };
      });
      addTeardown(() => {
        unsubscribeResizeWatchingPausedChange();
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
      let currentOpenableAncestor = closestOpenableAncestor(element);
      while (currentOpenableAncestor) {
        const openableAncestor = currentOpenableAncestor;
        if (!isAncestorOpen(openableAncestor)) {
          ancestorClosedCount++;
          pauseResizeWatching();
        }
        const removeOpenStateObserver = observeAncestorOpenState(
          openableAncestor,
          // eslint-disable-next-line no-loop-func
          ({ isOpen, toggleEvent }) => {
            if (!isOpen) {
              ancestorClosedCount++;
              pauseResizeWatching();
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
                {
                  event: toggleEvent ?? new CustomEvent("ancestor_close"),
                  width: 0,
                  height: 0,
                  ancestorClosed: true,
                  ancestorRepositioning: ancestorRepositioningCount > 0,
                },
              );
              return;
            }
            if (ancestorClosedCount > 0) {
              ancestorClosedCount--;
            }
            if (ancestorClosedCount === 0) {
              resumeResizeWatching();
              check(toggleEvent ?? new CustomEvent("ancestor_open"));
            }
          },
        );

        const onNaviPositionChange = (e) => {
          autoCheck(e);
        };
        openableAncestor.addEventListener(
          "navi_position_change",
          onNaviPositionChange,
        );
        // Dispatched by applyNewPosition's own notifyPositionTransition
        // around this ancestor's own left/top Web Animations API animation
        // (distinct from navi_position_change, fired once with the final
        // target, not per animation frame) — see ancestorRepositioningCount's
        // own doc above for the full reasoning. e.detail.onEnd registers our
        // own reaction to when that animation actually ends, rather than
        // this needing its own separate listener/event pair for that.
        // eslint-disable-next-line no-loop-func
        const onNaviPositionTransition = (e) => {
          ancestorRepositioningCount++;
          check(e);
          e.detail.onEnd(() => {
            if (ancestorRepositioningCount > 0) {
              ancestorRepositioningCount--;
            }
            check(e);
          });
        };
        openableAncestor.addEventListener(
          "navi_position_transition",
          onNaviPositionTransition,
        );
        addTeardown(() => {
          removeOpenStateObserver();
          openableAncestor.removeEventListener(
            "navi_position_change",
            onNaviPositionChange,
          );
          openableAncestor.removeEventListener(
            "navi_position_transition",
            onNaviPositionTransition,
          );
        });
        currentOpenableAncestor = closestOpenableAncestor(
          currentOpenableAncestor,
        );
      }
    }
  }

  // Re-checks whenever `elementToObserve` (some other element than the one
  // this effect tracks — e.g. a popover/callout's own content) changes size,
  // not just when `element` itself is scrolled/resized/re-anchored. Useful
  // when the tracked element's *position* depends on a size that lives
  // elsewhere (a callout re-measuring itself against its message body, a
  // popover reconsidering "top" vs "bottom" once its own content grows).
  // Can be called more than once, once per element worth watching.
  const observeSize = (elementToObserve) => {
    let lastWidth;
    let lastHeight;
    // Set right before a deferred check() runs, read right after — see
    // below for why a pending frame needs to be cancelable.
    let pendingFrame = null;
    const resizeObserver = new ResizeObserver((entries) => {
      const [entry] = entries;
      const { width, height } = entry.contentRect;
      // Debounce tiny changes that are likely sub-pixel rounding.
      if (lastWidth !== undefined) {
        const widthDiff = Math.abs(width - lastWidth);
        const heightDiff = Math.abs(height - lastHeight);
        const threshold = 1;
        if (widthDiff < threshold && heightDiff < threshold) {
          return;
        }
      }
      lastWidth = width;
      lastHeight = height;
      // Deferred to the next frame rather than calling check() here
      // directly: check() (via update()) commonly mutates
      // elementToObserve's own size again as a side effect of repositioning
      // it (e.g. a popover clearing then re-setting its own max-height
      // while reconsidering "top" vs "bottom" once it no longer fits where
      // it was) — when elementToObserve is the very element this observer
      // watches (a popover watching its own content, not some other
      // element), doing that synchronously from inside this callback is a
      // same-frame observer-triggers-itself loop, which the browser detects
      // and reports as "ResizeObserver loop completed with undelivered
      // notifications." The debounce above only guards against oscillation
      // across separate ResizeObserver deliveries — it does nothing for
      // this single legitimate resize-causes-a-reposition-causes-another-
      // resize step, since each individual size change here is real, not
      // sub-pixel noise. Deferring one frame breaks the synchronous chain:
      // by the time the reposition runs, this callback has already
      // returned, so any size change it causes is observed as a fresh,
      // later delivery instead of a nested one. Cancels/replaces any
      // still-pending frame from an earlier, superseded delivery, so only
      // the latest size ever actually gets checked.
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
      }
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        check(
          new CustomEvent("observed_element_size_change", {
            detail: { width, height },
          }),
        );
      });
    });
    resizeObserver.observe(elementToObserve);
    // An ancestor may already be closed by the time a consumer calls
    // observeSize (e.g. Callout's own observeSize(calloutMessageElement)
    // call happens after visibleRectEffect itself returns) — keep this new
    // observer consistent with that already-paused state instead of
    // observing it only to immediately generate a closed-container
    // notification.
    if (resizeWatchingPaused) {
      resizeObserver.unobserve(elementToObserve);
    }
    const unsubscribeResizeWatchingPausedChange = onResizeWatchingPausedChange(
      (paused) => {
        if (paused) {
          resizeObserver.unobserve(elementToObserve);
        } else {
          resizeObserver.observe(elementToObserve);
        }
      },
    );
    const cleanupAutoCheck = onBeforeAutoCheck(() => {
      resizeObserver.unobserve(elementToObserve);
      return () => {
        // Not reobserved at all while an ancestor is closed (see
        // pauseResizeWatching/resumeResizeWatching) — resumeResizeWatching's
        // own publish is what reobserves once it reopens instead.
        if (!resizeWatchingPaused) {
          resizeObserver.observe(elementToObserve);
        }
      };
    });
    addTeardown(() => {
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
      }
      unsubscribeResizeWatchingPausedChange();
      resizeObserver.disconnect();
    });
    return () => {
      cleanupAutoCheck();
      unsubscribeResizeWatchingPausedChange();
      if (pendingFrame !== null) {
        cancelAnimationFrame(pendingFrame);
      }
      resizeObserver.disconnect();
    };
  };

  return {
    check,
    onBeforeAutoCheck,
    observeSize,
    disconnect: () => {
      teardown();
    },
  };
};

/**
 * The `positionArea` grammar `pickPositionRelativeTo` accepts (also reused
 * as-is by `@jsenv/navi`'s Popover/Dialog/Callout): a single compass token
 * (loosely inspired by CSS `position-area`'s own naming), optionally wrapped
 * in `inset(...)` when the element should overlap the anchor instead of
 * sitting fully to one side of it. Resolves internally to a { y, x } pair —
 * y: top/inset-top/center/inset-bottom/bottom, x: left/inset-left/center/
 * inset-right/right — the same vocabulary the rest of this file's
 * positioning math (spaceFor, oppositeX/Y, etc.) actually operates on: a
 * bare `top`/`bottom`/`left`/`right` means outside the anchor (no overlap on
 * that axis), `inset-*` means flush against/overlapping it.
 *
 * Outside the anchor (bare token — element placed fully to one side, no
 * overlap on that side's axis):
 *
 *   top-left     top-start   top   top-end     top-right
 *   right-start                    right                  right-end
 *   bottom-right bottom-end  bottom bottom-start bottom-left
 *   left-end                       left                   left-start
 *
 * A corner token fixes one axis outside (top/bottom/left/right) and the
 * other the same way (a true corner, no cross-axis overlap at all).
 * "-start"/"-end" keep one axis outside but align the cross axis flush with
 * the anchor's near/far edge instead (`top-start` is above the anchor,
 * left-edges flush). The bare direction word centers the cross axis on the
 * anchor.
 *
 * Overlapping the anchor (wrapped in `inset(...)`, the classic 3×3 grid):
 *
 *   inset(top-left)     inset(top)    inset(top-right)
 *   inset(left)          center       inset(right)
 *   inset(bottom-left)  inset(bottom) inset(bottom-right)
 *
 * `center` and `inset(center)` are equivalent aliases for dead-center.
 */
const OUTSIDE_POSITION_AREA_TOKENS = {
  "top-left": { y: "top", x: "left" },
  "top-start": { y: "top", x: "inset-left" },
  "top": { y: "top", x: "center" },
  "top-end": { y: "top", x: "inset-right" },
  "top-right": { y: "top", x: "right" },

  "right-start": { y: "inset-top", x: "right" },
  "right": { y: "center", x: "right" },
  "right-end": { y: "inset-bottom", x: "right" },

  "bottom-right": { y: "bottom", x: "right" },
  "bottom-end": { y: "bottom", x: "inset-right" },
  "bottom": { y: "bottom", x: "center" },
  "bottom-start": { y: "bottom", x: "inset-left" },
  "bottom-left": { y: "bottom", x: "left" },

  "left-end": { y: "inset-bottom", x: "left" },
  "left": { y: "center", x: "left" },
  "left-start": { y: "inset-top", x: "left" },

  "center": { y: "center", x: "center" },
};
const INSET_POSITION_AREA_TOKENS = {
  "top-left": { y: "inset-top", x: "inset-left" },
  "top": { y: "inset-top", x: "center" },
  "top-right": { y: "inset-top", x: "inset-right" },

  "right": { y: "center", x: "inset-right" },

  "bottom-right": { y: "inset-bottom", x: "inset-right" },
  "bottom": { y: "inset-bottom", x: "center" },
  "bottom-left": { y: "inset-bottom", x: "inset-left" },

  "left": { y: "center", x: "inset-left" },

  "center": { y: "center", x: "center" },
};
const INSET_TOKEN_RE = /^inset\(\s*([a-z-]+)\s*\)$/;

/**
 * Parses a positionArea string into a { y, x } pair, or null if it's not a
 * recognized token.
 */
export const parsePositionArea = (value) => {
  const insetMatch = INSET_TOKEN_RE.exec(value);
  if (insetMatch) {
    const parsed = INSET_POSITION_AREA_TOKENS[insetMatch[1]];
    return parsed ? { ...parsed } : null;
  }
  const parsed = OUTSIDE_POSITION_AREA_TOKENS[value];
  return parsed ? { ...parsed } : null;
};

/**
 * Collapses a bare position value ("top"/"bottom"/"left"/"right") to its
 * "inset-*" equivalent — "inset-*"/"center" values pass through unchanged.
 * Only used by pickPositionRelativeTo's own no-anchor (container-docked)
 * mode — see its own doc for why.
 */
const toContainerAlignedPosition = (value) => {
  if (value === "top") {
    return "inset-top";
  }
  if (value === "bottom") {
    return "inset-bottom";
  }
  if (value === "left") {
    return "inset-left";
  }
  if (value === "right") {
    return "inset-right";
  }
  return value;
};

/**
 * Places element relative to anchor with independent control of horizontal and vertical axes.
 *
 * `positionArea` (see its own doc above `parsePositionArea`) is a single
 * compass token that resolves to a { y, x } pair internally:
 *
 * Horizontal (x) axis:
 *   "left"        element.right  = anchor.left   (sits entirely to the left of anchor)
 *   "inset-left"  element.left   = anchor.left   (left edges aligned, overlapping)
 *   "center"      element centered horizontally over anchor
 *   "inset-right" element.right  = anchor.right  (right edges aligned, overlapping)
 *   "right"       element.left   = anchor.right  (sits entirely to the right of anchor)
 *
 * Vertical (y) axis:
 *   "top"          element.bottom = anchor.top    (sits above, no overlap)
 *   "inset-top"    element.top    = anchor.top    (top edges aligned, overlapping)
 *   "center"       element centered vertically over anchor
 *   "inset-bottom" element.bottom = anchor.bottom (bottom edges aligned, overlapping)
 *   "bottom"       element.top    = anchor.bottom (sits below, no overlap)
 *
 * The resolved x/y attempt the requested placement and automatically flip to the
 * logical opposite when the element does not fit in the viewport:
 *   top ↔ bottom,   inset-top ↔ inset-bottom,   left ↔ right,   inset-left ↔ inset-right
 *
 * `positionAreaFixed` skips the fit check entirely on both axes.
 *
 * The resolved X and Y are persisted as data-position-x-current / data-position-y-current
 * on the element so subsequent calls start from the last resolved position (avoids
 * flickering when the element is near the flip threshold) and so other CSS/JS can read
 * "which side is this on right now" — including for a fixed axis, even though a fixed
 * axis never reads the attribute back itself (`positionAreaFixed` always wins).
 *
 * @param {HTMLElement} element - The element to position (position: absolute or
 *   fixed — detected from its own computed style, see the scroll offset comment below)
 * @param {HTMLElement} [anchor] - The anchor element to position against. Omit (or pass
 *   `null`/`undefined`) when there's no real anchor to dock `element` against a *container*
 *   instead — see `container` below; in that mode, "top"/"bottom"/"left"/"right" are
 *   collapsed to their "inset-*" equivalent internally (docking has no "float away with
 *   a gap" concept the way a real anchor does) and x/y always behave as if
 *   `positionAreaFixed` were set (a docked edge/corner never flips to the other side —
 *   there's no "other side" of a container the way there is of a real anchor).
 * @param {object} [options]
 * @param {string} [options.positionArea="bottom"] - Preferred placement, with viewport
 *   fallback — see `parsePositionArea`'s own doc for the full token grammar (a single
 *   compass token, optionally `inset(...)`-wrapped).
 * @param {string} [options.positionAreaFixed] - Forces this placement, skipping the
 *   fit-check on both axes. Same grammar as `positionArea`.
 * @param {string} [options.positionAreaWhenAnchorIsInvalid="center"] - `positionArea`
 *   used instead, as a plain no-anchor dock, whenever the anchor is too big to leave
 *   room on the axis `positionArea` places it outside of. `hasValidAnchor` in the return
 *   value reports which way it went.
 * @param {Event|CustomEvent} [options.event] - The event that triggered this particular
 *   reposition (a scroll/resize/etc. handler simply forwarding whatever it was itself
 *   called with) — purely informational, never changes the computed `left`/`top`
 *   themselves, only `shouldTransition` in the return value (see `applyNewPosition`'s
 *   own doc for how that's meant to be used).
 * @param {number} [options.alignToContainerEdgeWhenAnchorNearEdge=0] - When centering
 *   (positionArea's x is "center") an element wider than its anchor, snap to the available area's own
 *   left edge (the page viewport normally, or the container's edge — see `container` below —
 *   whenever there's no real `anchor`) instead of centering, once the anchor is within this
 *   many px of that same edge — avoids the (wider) element overflowing past it. 0 disables
 *   the snap entirely.
 * @param {number} [options.minLeft=0] - Minimum left coordinate (document-relative).
 * @param {HTMLElement|null} [options.container] - The container `element` is genuinely
 *   `position: absolute` relative to (its own containing block) — decoupled from whether
 *   there's a real `anchor`, since `element` can be container-relative either way (e.g. the
 *   custom renderer in popover.jsx, always relative to its own positioned ancestor whether
 *   or not it also has a real anchor). Whenever not explicitly given, this is always
 *   resolved automatically via `getPositionedParent(element)` instead — regardless of
 *   `hasValidAnchor` — so a caller that never thinks about `container` at all still gets the
 *   right behavior on its own: `document.documentElement` from `getPositionedParent` (an
 *   `element` promoted to the top layer — a `[popover]` while shown, or a `<dialog>` while
 *   actually modal — or one with no positioned ancestor at all, e.g. Callout's own element)
 *   falls back to the traditional document-relative path below, exactly as if `container`
 *   genuinely didn't apply; anything else `getPositionedParent` finds (a real positioned
 *   ancestor) is used the same way an explicit `container` would be. A container that
 *   resolves to `document.documentElement` (the viewport) produces identical output to the
 *   plain document-relative path either way, since the document's own scroll and the
 *   viewport's own origin already coincide with what this generically computes for any other
 *   container element. When there's a real container (explicit or resolved) either way: the final
 *   `left`/`top` (and the returned `anchorLeft/Top/Right/Bottom`) are expressed relative to
 *   its own padding-box origin plus its own scroll, instead of the document's — `element`'s
 *   own computed `position` is *not* consulted in that case, unlike the traditional path.
 *   When `anchor` is also omitted (no real anchor at all), the container additionally
 *   becomes what's positioned against, and the boundary clamp uses its own (padding-box)
 *   edges instead of the page viewport's, on both axes (the Y axis otherwise has no such
 *   clamp at all — see the clamp's own comment) — that part *is* gated on `hasValidAnchor`,
 *   unlike the coordinate-space conversion itself.
 * @returns {{ hasValidAnchor, shouldTransition, positionX, positionY, left, top, width, height, anchorLeft, anchorTop, anchorRight, anchorBottom, spaceLeft, spaceRight, spaceAbove, spaceBelow }}
 */
export const pickPositionRelativeTo = (
  element,
  anchor,
  {
    positionArea = "bottom",
    positionAreaFixed,
    positionAreaWhenAnchorIsInvalid = "center",
    event,
    alignToContainerEdgeWhenAnchorNearEdge = 0,
    minLeft = 0,
    marginWithAnchor = 0,
    alignToAnchorBox = "border-box",
    marginWithContainer = 0,
    container,
  } = {},
) => {
  // Needed before hasValidAnchor below. visualViewport, not
  // document.documentElement.clientWidth/Height: the layout viewport
  // doesn't shrink when the on-screen keyboard opens, only the visual one
  // does.
  const visualViewport = window.visualViewport;
  const viewportWidth = visualViewport
    ? visualViewport.width
    : document.documentElement.clientWidth;
  const viewportHeight = visualViewport
    ? visualViewport.height
    : document.documentElement.clientHeight;
  const viewportLeft = visualViewport ? visualViewport.offsetLeft : 0;
  const viewportTop = visualViewport ? visualViewport.offsetTop : 0;

  // Resolved early: everything below that would otherwise reach for
  // viewportLeft/Top/Width/Height instead uses these, so a "local" popover
  // never gets offered more room (anchor-too-big check, flip decisions,
  // clamp) than its own container — resolvedContainer's own padding-box
  // edges when there is one — actually has.
  // Always a real element now (never null/undefined) — getPositionedParent
  // itself never returns anything falsy, document.documentElement (the
  // viewport) included.
  const resolvedContainer = container ?? getPositionedParent(element);
  const hasRealContainer = resolvedContainer !== document.documentElement;
  const containerRect = hasRealContainer
    ? resolvedContainer.getBoundingClientRect()
    : null;
  const containerBorders = hasRealContainer
    ? getBorderSizes(resolvedContainer)
    : { left: 0, top: 0, right: 0, bottom: 0 };
  const availableLeft = hasRealContainer
    ? snapToPixel(containerRect.left) + containerBorders.left
    : viewportLeft;
  const availableTop = hasRealContainer
    ? snapToPixel(containerRect.top) + containerBorders.top
    : viewportTop;
  const availableRight = hasRealContainer
    ? snapToPixel(containerRect.right) - containerBorders.right
    : viewportLeft + viewportWidth;
  const availableBottom = hasRealContainer
    ? snapToPixel(containerRect.bottom) - containerBorders.bottom
    : viewportTop + viewportHeight;
  const availableWidth = availableRight - availableLeft;
  const availableHeight = availableBottom - availableTop;

  // Rejected only on the axis positionArea actually places `element`
  // outside of ("left"/"right" or "top"/"bottom") — that's the only axis
  // where the anchor's own size eats into the room available. Docks via
  // positionAreaWhenAnchorIsInvalid instead of `positionArea` once rejected.
  const requestedPositionArea = parsePositionArea(positionArea);
  const anchorRejected =
    Boolean(anchor) &&
    (() => {
      const rect = anchor.getBoundingClientRect();
      const { x, y } = requestedPositionArea ?? {};
      if (
        (y === "top" || y === "bottom") &&
        rect.height > availableHeight - 50
      ) {
        return true;
      }
      if ((x === "left" || x === "right") && rect.width > availableWidth - 50) {
        return true;
      }
      return false;
    })();
  const hasValidAnchor = Boolean(anchor) && !anchorRejected;
  const effectivePositionArea = anchorRejected
    ? positionAreaWhenAnchorIsInvalid
    : positionArea;

  const parsedPositionArea = parsePositionArea(effectivePositionArea);
  if (!parsedPositionArea) {
    console.warn(
      `pickPositionRelativeTo: invalid positionArea="${effectivePositionArea}"`,
    );
  }
  let positionX = parsedPositionArea ? parsedPositionArea.x : "center";
  let positionY = parsedPositionArea ? parsedPositionArea.y : "bottom";
  let positionXFixed;
  let positionYFixed;
  if (positionAreaFixed) {
    const parsedPositionAreaFixed = parsePositionArea(positionAreaFixed);
    if (!parsedPositionAreaFixed) {
      console.warn(
        `pickPositionRelativeTo: invalid positionAreaFixed="${positionAreaFixed}"`,
      );
    } else {
      positionXFixed = parsedPositionAreaFixed.x;
      positionYFixed = parsedPositionAreaFixed.y;
    }
  }
  // No real anchor (or a rejected one): dock against a container instead.
  if (!hasValidAnchor) {
    positionX = toContainerAlignedPosition(positionX);
    positionY = toContainerAlignedPosition(positionY);
    positionXFixed = positionX;
    positionYFixed = positionY;
  }
  // resolvedContainer was already resolved above. document.documentElement
  // from getPositionedParent (a popover/dialog element, e.g. Callout's own,
  // or one with no positioned ancestor at all) falls through to the
  // traditional document-relative path below all the same, so an existing
  // caller that never thinks about `container` at all keeps behaving
  // exactly as before.
  const effectiveAnchor = hasValidAnchor ? anchor : resolvedContainer;
  // document.documentElement is used as a sentinel "the viewport" value: an
  // anchorless popup should center/place itself against the visual
  // viewport, not against <html>'s own box — which, unlike the viewport,
  // grows with document content and can be far taller than what's on
  // screen (its top is also negative once the page is scrolled). Using the
  // viewport rect here fixes that; the scroll offset is still applied
  // below like any other case (see getPositioningScrollOffset).
  const anchorIsViewport = effectiveAnchor === document.documentElement;
  // Get viewport-relative positions
  const anchorRect = anchorIsViewport
    ? {
        left: viewportLeft,
        top: viewportTop,
        right: viewportLeft + viewportWidth,
        bottom: viewportTop + viewportHeight,
      }
    : effectiveAnchor.getBoundingClientRect();
  const anchorLeft = snapToPixel(anchorRect.left);
  const anchorTop = snapToPixel(anchorRect.top);
  const anchorRight = snapToPixel(anchorRect.right);
  const anchorBottom = snapToPixel(anchorRect.bottom);
  // Horizontal clamp bounds — see availableLeft/availableRight above.
  const clampLeftBound = availableLeft;
  const clampRightBound = availableRight;
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
    const anchorBorderSizes = getBorderSizes(effectiveAnchor);
    const anchorPaddingSizes = getPaddingSizes(effectiveAnchor);
    insetTop = anchorBorderSizes.top + anchorPaddingSizes.top;
    insetBottom = anchorBorderSizes.bottom + anchorPaddingSizes.bottom;
    insetLeft = anchorBorderSizes.left + anchorPaddingSizes.left;
    insetRight = anchorBorderSizes.right + anchorPaddingSizes.right;
  }
  const spaceAbove = anchorTop + insetTop - availableTop;
  const spaceBelow = availableBottom - anchorBottom + insetBottom;
  const effectiveAnchorLeft = anchorLeft + insetLeft;
  const effectiveAnchorRight = anchorRight - insetRight;
  const spaceLeft = anchorLeft + insetLeft - availableLeft;
  const spaceRight = availableRight - anchorRight + insetRight;

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
      "top": "bottom",
      "bottom": "top",
      "inset-top": "inset-bottom",
      "inset-bottom": "inset-top",
    };
    // Compute effective space for a given Y value
    const spaceFor = (y) => {
      if (y === "top") {
        return spaceAbove - marginWithAnchor - marginWithContainer;
      }
      if (y === "inset-bottom") {
        return spaceAbove + anchorHeight - marginWithContainer;
      }
      if (y === "bottom") {
        return spaceBelow - marginWithAnchor - marginWithContainer;
      }
      if (y === "inset-top") {
        return spaceBelow + anchorHeight - marginWithContainer;
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
      "left": "right",
      "right": "left",
      "inset-left": "inset-right",
      "inset-right": "inset-left",
    };
    // Compute effective space for a given X value
    const spaceFor = (x) => {
      if (x === "left") {
        return spaceLeft - marginWithAnchor - marginWithContainer;
      }
      if (x === "inset-left") {
        return availableRight - anchorLeft - marginWithContainer;
      }
      if (x === "inset-right") {
        return anchorRight - availableLeft - marginWithContainer;
      }
      if (x === "right") {
        return spaceRight - marginWithAnchor - marginWithContainer;
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
        // Only flip if the opposite side has more space — avoids oscillation
        // when neither side has enough room (both fail the ratio). Mirrors
        // the Y-axis branch above; missing here was the actual cause of a
        // real left/right flicker on a narrow viewport (neither side ever
        // "fits enough", so this branch ran on every reposition).
        const opposite = oppositeX[activeX];
        const oppositeHasMoreSpace = spaceFor(opposite) > spaceFor(activeX);
        finalX = oppositeHasMoreSpace ? opposite : activeX;
      }
    }
  }

  // Calculate horizontal position (viewport-relative)
  let elementPositionLeft;
  {
    if (finalX === "left") {
      elementPositionLeft =
        effectiveAnchorLeft - elementWidth - marginWithAnchor;
    } else if (finalX === "inset-left") {
      elementPositionLeft = effectiveAnchorLeft;
    } else if (finalX === "center") {
      // Complex logic handles wide anchors and container-edge snapping
      const anchorIsWiderThanAvailable = anchorWidth > availableWidth;
      if (anchorIsWiderThanAvailable) {
        const anchorLeftIsVisible = effectiveAnchorLeft >= availableLeft;
        const anchorRightIsVisible = effectiveAnchorRight <= availableRight;
        if (!anchorLeftIsVisible && anchorRightIsVisible) {
          const availableCenter = availableLeft + availableWidth / 2;
          const distanceFromRightEdge = availableRight - effectiveAnchorRight;
          elementPositionLeft =
            availableCenter - distanceFromRightEdge / 2 - elementWidth / 2;
        } else if (anchorLeftIsVisible && !anchorRightIsVisible) {
          const availableCenter = availableLeft + availableWidth / 2;
          const distanceFromLeftEdge = availableLeft - effectiveAnchorLeft;
          elementPositionLeft =
            availableCenter - distanceFromLeftEdge / 2 - elementWidth / 2;
        } else {
          elementPositionLeft =
            availableLeft + availableWidth / 2 - elementWidth / 2;
        }
      } else {
        elementPositionLeft =
          effectiveAnchorLeft +
          (effectiveAnchorRight - effectiveAnchorLeft) / 2 -
          elementWidth / 2;
        if (alignToContainerEdgeWhenAnchorNearEdge) {
          const effectiveAnchorWidth =
            effectiveAnchorRight - effectiveAnchorLeft;
          const elementIsWiderThanAnchor = elementWidth > effectiveAnchorWidth;
          const anchorIsNearContainerEdge =
            effectiveAnchorLeft - clampLeftBound <
            alignToContainerEdgeWhenAnchorNearEdge;
          if (elementIsWiderThanAnchor && anchorIsNearContainerEdge) {
            elementPositionLeft = clampLeftBound + minLeft;
          }
        }
      }
    } else if (finalX === "inset-right") {
      elementPositionLeft = effectiveAnchorRight - elementWidth;
    } else {
      // "right"
      elementPositionLeft = effectiveAnchorRight + marginWithAnchor;
    }
    // Constrain horizontal position to the available area's boundaries
    // (with marginWithContainer margin).
    if (elementPositionLeft < clampLeftBound + marginWithContainer) {
      elementPositionLeft = clampLeftBound + marginWithContainer;
    } else if (
      elementPositionLeft + elementWidth >
      clampRightBound - marginWithContainer
    ) {
      elementPositionLeft =
        clampRightBound - marginWithContainer - elementWidth;
    }
  }

  // Calculate vertical position (viewport-relative)
  let elementPositionTop;
  {
    if (finalY === "top") {
      // top is always anchorTop + insetTop - elementHeight - marginWithAnchor — max-height truncates if needed.
      const idealTop = anchorTop + insetTop - elementHeight - marginWithAnchor;
      elementPositionTop =
        idealTop < marginWithContainer ? marginWithContainer : idealTop;
    } else if (finalY === "inset-bottom") {
      const idealTop = anchorBottom - elementHeight;
      elementPositionTop =
        idealTop < marginWithContainer ? marginWithContainer : idealTop;
    } else if (finalY === "center") {
      elementPositionTop = anchorTop + anchorHeight / 2 - elementHeight / 2;
    } else if (finalY === "inset-top") {
      const idealTop = anchorTop;
      elementPositionTop =
        idealTop % 1 === 0 ? idealTop : Math.floor(idealTop) + 1;
    } else {
      // "bottom"
      // top is always anchorBottom - insetBottom + marginWithAnchor — max-height (via --container-position-remaining-height) truncates
      // the element height so it doesn't overflow the viewport bottom.
      const idealTop = anchorBottom - insetBottom + marginWithAnchor;
      elementPositionTop =
        idealTop % 1 === 0 ? idealTop : Math.floor(idealTop) + 1;
    }
    // Unlike the horizontal clamp above, there's normally no universal
    // vertical boundary clamp at all — "top"/"bottom" already clamp their
    // own idealTop inline, "inset-*"/"center" don't, and changing that
    // for every existing consumer (real-anchor "bottom" near the viewport
    // bottom relies on --container-position-remaining-height/max-height truncation instead of
    // repositioning) is out of scope here. Scoped strictly to the no-anchor
    // (container-docked) case, where it's new and safe: a container is
    // always meant to be respected on both axes.
    if (!hasValidAnchor) {
      if (elementPositionTop < availableTop + marginWithContainer) {
        elementPositionTop = availableTop + marginWithContainer;
      } else if (
        elementPositionTop + elementHeight >
        availableBottom - marginWithContainer
      ) {
        elementPositionTop =
          availableBottom - marginWithContainer - elementHeight;
      }
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
  // `element.style.top/left` actually needs. This is decided independently
  // of whether there's a real anchor: `element` might be `position:
  // absolute` relative to some container regardless (e.g. the custom
  // renderer in popover.jsx, which is always relative to its own
  // positioned ancestor whether or not it also has a real anchor) — that's
  // what `resolvedContainer` (explicit or auto-resolved above) communicates
  // even when `anchor` is also given. The container to convert into is
  // `resolvedContainer` when there's a real anchor, or (in the no-anchor
  // case) `effectiveAnchor` itself, since there the container *is* what's
  // being positioned against.
  const coordinateContainer = hasValidAnchor
    ? resolvedContainer
    : effectiveAnchor;
  let scrollLeft;
  let scrollTop;
  if (coordinateContainer && coordinateContainer !== document.documentElement) {
    // Reuse anchorRect/containerBorders when the coordinate container is
    // the same element already measured above (the no-anchor case);
    // otherwise (a real anchor positioned within a *different*, explicitly
    // given container) measure the container separately — the anchor's own
    // rect only matters for the positioning math above, not for this.
    const isSameAsEffectiveAnchor = coordinateContainer === effectiveAnchor;
    const coordinateRect = isSameAsEffectiveAnchor
      ? anchorRect
      : coordinateContainer.getBoundingClientRect();
    const coordinateBorders = isSameAsEffectiveAnchor
      ? containerBorders
      : getBorderSizes(coordinateContainer);
    scrollLeft =
      -coordinateRect.left -
      coordinateBorders.left +
      coordinateContainer.scrollLeft;
    scrollTop =
      -coordinateRect.top -
      coordinateBorders.top +
      coordinateContainer.scrollTop;
  } else {
    // No container to convert into (a plain real anchor, the common case
    // for Callout/Picker/Popover's own via-attribute renderer), or the
    // container is the viewport itself (Popover's via-attribute renderer
    // when docked, no real anchor) — either way, `element`'s own computed
    // `position` (fixed vs absolute, detected dynamically) decides whether
    // any scroll offset applies at all: none for position: fixed (already
    // viewport-relative — adding scroll would double-count it), the
    // document's own scroll for position: absolute (relative to the
    // initial containing block, i.e. document-relative) — including when
    // docked to the viewport, so the result lands at the visual center of
    // the viewport at its current scroll position.
    ({ scrollLeft, scrollTop } = getPositioningScrollOffset(element));
  }
  // visibleRectEffect recomputes this on every scroll tick, which is what
  // keeps it looking anchored as the page (or the container) scrolls
  // either way.
  const elementDocumentLeft = snapToPixel(elementPositionLeft + scrollLeft);
  const elementDocumentTop = snapToPixel(elementPositionTop + scrollTop);
  const anchorDocumentLeft = anchorLeft + scrollLeft;
  const anchorDocumentTop = anchorTop + scrollTop;
  const anchorDocumentRight = anchorRight + scrollLeft;
  const anchorDocumentBottom = anchorBottom + scrollTop;

  // For overlap variants the element starts at the anchor edge (not past it),
  // so the usable space includes the anchor dimension.
  // marginWithAnchor (gap between anchor and element) and marginWithContainer are subtracted
  // so callers get the net usable space directly.
  const effectiveSpaceAbove =
    (finalY === "inset-bottom" ? spaceAbove + anchorHeight : spaceAbove) -
    (finalY === "top" ? marginWithAnchor : 0) -
    marginWithContainer;
  const effectiveSpaceBelow =
    (finalY === "inset-top" ? spaceBelow + anchorHeight : spaceBelow) -
    (finalY === "bottom" ? marginWithAnchor : 0) -
    marginWithContainer;
  const effectiveSpaceLeft =
    (finalX === "inset-right" ? spaceLeft + anchorWidth : spaceLeft) -
    (finalX === "left" ? marginWithAnchor : 0) -
    marginWithContainer;
  const effectiveSpaceRight =
    (finalX === "inset-left" ? spaceRight + anchorWidth : spaceRight) -
    (finalX === "right" ? marginWithAnchor : 0) -
    marginWithContainer;

  return {
    // Whether a real anchor actually ended up used — false when there's no
    // `anchor`, or it was rejected as too big.
    hasValidAnchor,
    // True only when `event` is a "resize" — see applyNewPosition's own
    // doc for why only resize-triggered repositions are meant to animate.
    shouldTransition: event?.type === "resize",
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
    spaceLeft: effectiveSpaceLeft,
    spaceRight: effectiveSpaceRight,
    spaceAbove: effectiveSpaceAbove,
    spaceBelow: effectiveSpaceBelow,
  };
};

// Per-element bookkeeping for the currently in-flight, self-driven position
// transition, if any — see notifyPositionTransition's own doc for why this
// is animation-driven rather than listening for the browser's own
// transitionrun/transitionend: element -> { animation, endCallbacks }.
const pendingPositionTransitions = new WeakMap();

// Reads `cssVarName` off `element` (getComputedStyle, so it's whatever the
// cascade resolves to — a consumer can set it inline, in its own CSS rule,
// or not at all) and converts it to milliseconds: "0.25s" -> 250, "250ms" ->
// 250. Falls back to `fallbackMs` when unset/empty/unparsable, so a caller
// never has to declare the CSS var itself just to get a sane default
// duration — it only needs to when it actually wants to override it.
const parseTransitionDurationMs = (element, cssVarName, fallbackMs) => {
  const trimmed = getStyle(element, cssVarName).trim();
  if (!trimmed) {
    return fallbackMs;
  }
  if (trimmed.endsWith("ms")) {
    return parseFloat(trimmed);
  }
  if (trimmed.endsWith("s")) {
    return parseFloat(trimmed) * 1000;
  }
  const parsed = parseFloat(trimmed);
  return Number.isNaN(parsed) ? fallbackMs : parsed;
};

/**
 * Dispatches a single "navi_position_transition" event on `element`,
 * self-driven rather than confirmed by the browser's own `transitionrun`:
 * `applyNewPosition` calls this exactly when it *knows* it just started a
 * left/top `animation` (a Web Animations API `Animation`, not a CSS
 * transition), so there's nothing to wait for. This sidesteps two real
 * problems with listening for `transitionrun`/`transitionend` instead:
 *   - Reacting to *any* CSS transition on the element would also fire for
 *     an unrelated one sharing it (e.g. a scale/opacity entrance animation
 *     on the same Popover) — wrongly hiding a descendant for that too.
 *   - Filtering to a specific `propertyName` (`"left"`, say) to avoid that
 *     is itself unreliable: which of `left`/`top` the browser reports
 *     `transitionrun` for first isn't guaranteed to stay whichever one
 *     appears first in a `transition-property` list — it was observed
 *     firing for `"top"` instead in practice.
 * Driving left/top through `element.animate()` sidesteps both: it's a
 * dedicated Animation object with its own real `finished` promise, entirely
 * independent of whatever CSS transitions the element also has running.
 *
 * A descendant anchored to something inside `element` (a Callout, a nested
 * Popover — see visible_rect.js's own ancestorRepositioningCount doc for the
 * full reasoning) has no correct position to compute until this animation
 * actually ends, and no way to keep tracking it smoothly without a
 * per-frame loop of its own — it hides itself for the duration instead.
 * `event.detail.onEnd(callback)` is how it registers to be told when that
 * is, rather than needing its own separate "end" event/listener.
 *
 * If another position animation starts on the same element before this
 * one's own `finished` promise ever settles (a second reposition landing
 * mid-way), the pending one is cancelled and its own registered callbacks
 * are flushed immediately (same spirit as a real `transitioncancel`) before
 * the new one begins, so nothing is ever left stuck hidden waiting for an
 * `onEnd` that was actually superseded.
 *
 * `applyNewPosition` already sets `element.style.left`/`top` to their final
 * target before this animation ever starts, so `animation.commitStyles()`
 * below is not what makes the final position correct — with the default
 * `fill: "none"`, the animation stops overriding the computed style once
 * its active duration elapses either way, and the specified style (already
 * final) takes back over. `commitStyles()` + `cancel()` just makes that
 * explicit and immediate rather than relying on that fill/timing nuance,
 * and drops the now-finished Animation instead of leaving it around.
 */
const notifyPositionTransition = (element, animation) => {
  const pending = pendingPositionTransitions.get(element);
  if (pending) {
    pending.animation.cancel();
    for (const callback of pending.endCallbacks) {
      callback();
    }
  }
  const endCallbacks = [];
  dispatchCustomEvent(element, "navi_position_transition", {
    onEnd: (callback) => {
      endCallbacks.push(callback);
    },
  });
  const current = { animation, endCallbacks };
  pendingPositionTransitions.set(element, current);
  animation.finished
    .then(() => {
      if (pendingPositionTransitions.get(element) === current) {
        pendingPositionTransitions.delete(element);
      }
      try {
        animation.commitStyles();
      } catch {
        // Element no longer rendered (removed/hidden mid-animation) —
        // nothing to commit to, and left/top were already final anyway.
      }
      animation.cancel();
      for (const callback of endCallbacks) {
        callback();
      }
    })
    .catch(() => {
      // Cancelled by a subsequent reposition — already flushed above.
    });
};

/**
 * Applies a `pickPositionRelativeTo` result to `element`. `left`/`top` are
 * set instantly (no scroll-triggered reposition should ever lag behind its
 * target); when `shouldTransition` is set (a resize-triggered reposition,
 * not a scroll one), the visual move from the previous position to this one
 * is instead played out via `element.animate()` — a Web Animations API
 * animation kept deliberately independent of any CSS transition
 * Popover/Dialog/Callout also run on the same element (opacity/scale/
 * display), so it can't clobber or be clobbered by them, and gives a real
 * `Animation.finished` promise to key off instead of a fragile
 * `transitionend`/`propertyName` filter (see notifyPositionTransition's own
 * doc for why that matters). Its duration comes from the
 * `--popup-position-transition-duration` CSS var (parseTransitionDurationMs),
 * read straight off `element` — falls back to 180ms unset, but a consumer
 * can override it in its own CSS same as any other custom property.
 * Also dispatches navi_position_transition (see notifyPositionTransition's
 * own doc) whenever it starts such an animation, and navi_position_change
 * unconditionally — every caller of this function already wants both
 * (Dialog, Popover, Callout all set their own position through here), so
 * there's nothing to opt into separately: a descendant anchored to
 * something inside `element` (visible_rect.js's own on_ancestor_events)
 * needs to recheck its own position whenever `element` itself moves,
 * whichever of the three it actually is.
 */
export const applyNewPosition = (
  element,
  {
    left,
    top,
    shouldTransition,
    positionX,
    positionY,
    spaceLeft,
    spaceRight,
    spaceAbove,
    spaceBelow,
  },
) => {
  if (positionY === "top" || positionY === "inset-bottom") {
    element.style.setProperty(
      "--container-position-remaining-height",
      `${spaceAbove}px`,
    );
  } else if (positionY === "bottom" || positionY === "inset-top") {
    element.style.setProperty(
      "--container-position-remaining-height",
      `${spaceBelow}px`,
    );
  } else {
    element.style.removeProperty("--container-position-remaining-height");
  }
  if (positionX === "left" || positionX === "inset-right") {
    element.style.setProperty(
      "--container-position-remaining-width",
      `${spaceLeft}px`,
    );
  } else if (positionX === "right" || positionX === "inset-left") {
    element.style.setProperty(
      "--container-position-remaining-width",
      `${spaceRight}px`,
    );
  } else {
    element.style.removeProperty("--container-position-remaining-width");
  }

  // A single implicit keyframe turned out not to work here: the WAAPI
  // "neutral" start keyframe isn't frozen at `animate()` call time, it's
  // resolved from the underlying value when the animation is first
  // *sampled* (the next frame) — by then `element.style.left`/`top` below
  // has already been overwritten with the new target, so start === end and
  // nothing visibly moves (observed as the dialog just jumping). Reading
  // the previous value ourselves, before overwriting it, and passing both
  // keyframes explicitly sidesteps that entirely.
  const previousLeft = parseFloat(element.style.left) || left;
  const previousTop = parseFloat(element.style.top) || top;
  if (shouldTransition) {
    const animation = element.animate(
      [
        { left: `${previousLeft}px`, top: `${previousTop}px` },
        { left: `${left}px`, top: `${top}px` },
      ],
      {
        duration: parseTransitionDurationMs(
          element,
          "--popup-position-transition-duration",
          250,
        ),
        easing: "ease",
      },
    );
    notifyPositionTransition(element, animation);
  }
  // The specified `left`/`top` are set to their final target right away,
  // regardless of `shouldTransition` — the animation above only plays the
  // visual move from the old position, it never becomes the actual
  // specified style (see notifyPositionTransition's own commitStyles for
  // why that matters once it ends).
  element.style.left = `${left}px`;
  element.style.top = `${top}px`;
  dispatchCustomEvent(element, "navi_position_change");
};

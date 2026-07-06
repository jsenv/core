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
 * for the "aligned-" pair on both axes. Exposed to CSS as
 * `data-anchor-area-y`/`data-anchor-area-x` (see popup_animation.js): an
 * "aligned-"/"center" axis means the popover overlaps the anchor there, so a
 * translate-based slide on that axis reads oddly — `animation="auto"` picks
 * "scale" instead of "slide" whenever *both* axes overlap, and "slide"
 * itself zeroes out any overlapping axis rather than dropping the whole
 * animation.
 *
 * `data-anchor` mirrors the `anchor` prop's own reference mode ("viewport"/
 * "offsetParent"), absent when anchored to a real element.
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
import { createOnKeyDownForShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { useDebugFocus, useDebugPopup } from "../navi_debug.jsx";
import { useOpenControllerByProps } from "./open_controller.js";
import { buildPopupAnimationCss } from "./popup_animation.js";

const css = /* css */ `
  /* animation="view-transition" (experimental, see openEffect below): these
     pseudo-elements are rooted at the document, not nested inside
     .navi_popover, so they can't key off --popup-animation-duration (set on
     the popover itself) directly — openEffect mirrors it onto
     --popup-view-transition-duration on the document root right before
     starting each transition instead. */
  ::view-transition-group(*),
  ::view-transition-old(*),
  ::view-transition-new(*) {
    animation-duration: var(--popup-view-transition-duration, 0.18s);
  }

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
    border-radius: var(--popup-border-radius, 0);

    /* Neither anchorReference case has a real anchor to stay in
       scroll-lockstep with: anchor="viewport" is meant to stay pinned to the
       viewport itself, exactly what position: fixed already does natively —
       staying absolute would instead let it contribute to the document's own
       scrollable area once it extends past the current viewport edge,
       growing the page's scrollbar for no reason. anchor="offsetParent" is
       set to fixed too, experimentally, to see how it behaves. */
    &[data-anchor] {
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
  // animation={true} or "auto" always resolves to "slide" (see
  // popup_animation.js for how it reads its direction).
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
    // "aligned-"/"center" means the popover overlaps the anchor on that axis
    // (see the CSS comment above) — a slide reads oddly when it overlaps on
    // *both* axes at once (it'd look like it's sliding out from inside the
    // anchor itself), so auto-animation picks "scale" there instead.
    const yOverlapsAnchor =
      parsedAnchorArea.y !== "above" && parsedAnchorArea.y !== "below";
    const xOverlapsAnchor =
      parsedAnchorArea.x !== "on-the-left" &&
      parsedAnchorArea.x !== "on-the-right";
    const resolvedAnimation = isAutoAnimation
      ? yOverlapsAnchor && xOverlapsAnchor
        ? "scale"
        : "slide"
      : animation;
    popoverEl.setAttribute("navi-animation", resolvedAnimation);
    // Experimental: swaps the CSS-transition machinery below for
    // document.startViewTransition() (see runOpen/runClose below) —
    // unsupported browsers just fall back to no animation at all.
    const useViewTransition =
      resolvedAnimation === "view-transition" &&
      typeof document.startViewTransition === "function";
    if (resolvedAnimation === "view-transition") {
      // Unique per instance: view-transition-name must be a <custom-ident>
      // (no colons, which useId()'s default id contains) and can't be
      // shared by two simultaneously-open popovers.
      popoverEl.style.viewTransitionName = `navi-popover-vt-${id}`.replace(
        /[^a-zA-Z0-9_-]/g,
        "-",
      );
    } else {
      popoverEl.style.removeProperty("view-transition-name");
    }
    // Keys the CSS that switches to position: fixed for both anchorReference
    // cases (see the CSS comment above for why), and mirrors the `anchor`
    // prop's own reference mode in DOM-inspectable form — absent when
    // anchored to a real element.
    if (anchorReference) {
      popoverEl.setAttribute("data-anchor", anchorReference);
    } else {
      popoverEl.removeAttribute("data-anchor");
    }
    // The requested anchorArea, exposed per-axis for popup_animation.js to
    // key its slide direction/scale-vs-slide choice off (see the file's top
    // comment) — set for both anchorReference and real-anchor modes.
    popoverEl.setAttribute("data-anchor-area-y", parsedAnchorArea.y);
    popoverEl.setAttribute("data-anchor-area-x", parsedAnchorArea.x);
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
    // Cleared here (not at the previous close): popup_animation.js's slide
    // CSS reads these live, so removing them there — in the very same
    // synchronous tick as flipping aria-expanded to start the close
    // transition — changes what the *closing* transition animates towards
    // mid-flight (both the direction's sign and --popup-slide-distance's
    // unit, 20px vs 100%, briefly interpolating between incompatible units).
    // Cleared fresh on every open instead: harmless even though
    // pickPositionRelativeTo unconditionally overwrites both right after
    // anyway (below) — this only matters for the point/corner
    // (anchorReference) case, which never sets them at all, so a stale value
    // from a *previous* real-anchor open must not leak into this one. The
    // Fixed case is known synchronously, no measurement needed — set right
    // away instead of merely cleared.
    popoverEl.removeAttribute("data-position-y-current");
    popoverEl.removeAttribute("data-position-x-current");
    if (effectivePositionYFixed) {
      popoverEl.setAttribute(
        "data-position-y-current",
        effectivePositionYFixed,
      );
    }
    if (effectivePositionXFixed) {
      popoverEl.setAttribute(
        "data-position-x-current",
        effectivePositionXFixed,
      );
    }

    if (!useViewTransition) {
      // Suppressed until the popover is actually measured/positioned below —
      // see this file's top comment for why @starting-style can't drive the
      // opening transition (it needs the popover's actual resting position
      // already in place, which requires a layout box that only exists once
      // shown). Not needed for view-transition mode: startViewTransition()
      // does its own before/after snapshot diffing instead.
      popoverEl.style.transitionProperty = "none";
    }

    // Wrapped in document.startViewTransition() below for the experimental
    // "view-transition" mode: everything from showPopover() through the
    // final aria-expanded="true" flip must run as that API's single
    // synchronous mutation callback, so it captures the popover's real
    // "new" state (backdrop show/positioning aren't part of the transition
    // itself, but nothing here yields control before aria-expanded flips,
    // so bundling them in doesn't change anything for the non-view-transition
    // path).
    const runOpen = () => {
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
      // aria-expanded stays "false" here — still transitions-suppressed
      // (non-view-transition mode) or simply not-yet-flipped, so this
      // doesn't matter yet — and only flips once positioned below.

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
          popoverEl.style.setProperty(
            "--space-available",
            `${spaceAvailable}px`,
          );
          appliedLeft = Math.max(left, minLeft);
          top = pickedTop;
        }

        debugPopup(
          positionEvent,
          `positionPopover() -> left: ${appliedLeft}, top: ${top}`,
        );
        popoverEl.style.top = `${top}px`;
        popoverEl.style.left = `${appliedLeft}px`;
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

      if (!useViewTransition) {
        // The reflow forces the browser to actually commit the correctly
        // positioned "closed" frame set up above as a real rendered state,
        // before transitions are re-enabled and aria-expanded flips to "true" —
        // only then does the CSS transition play, from that just-committed
        // frame to the open one, with no @starting-style involved at all.
        popoverEl.getBoundingClientRect();
        popoverEl.style.transitionProperty = "";
      }
      popoverEl.setAttribute("aria-expanded", "true");
    };

    let viewTransition;
    if (useViewTransition) {
      syncViewTransitionDuration(popoverEl);
      viewTransition = document.startViewTransition(runOpen);
    } else {
      runOpen();
    }

    // The popover's elements are momentarily unfocusable while
    // view-transition's snapshot covers them (see transferFocus's own
    // comment) — deferred until `.finished` in that case, immediate
    // otherwise.
    const restoreFocus = openController.transferFocusOnOpen(
      popoverEl,
      viewTransition ? { readyPromise: viewTransition.ready } : undefined,
    );
    debugPopup(
      e,
      `openPopover() -> anchor: ${anchor?.tagName}, anchorReference: ${anchorReference}, relativeContainer: ${relativeContainer?.tagName}`,
    );

    return (closeEvent) => {
      debugPopup(closeEvent, `closePopover()`);
      const runClose = () => {
        popoverEl.setAttribute("aria-expanded", "false");
        popoverEl.hidePopover();
      };
      if (useViewTransition) {
        syncViewTransitionDuration(popoverEl);
        document.startViewTransition(runClose);
      } else {
        runClose();
      }
      // data-position-y/x-current is deliberately *not* cleared here — see
      // the comment where it's cleared instead (start of the next open).
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
        onKeyDown={onKeyDownShortcuts}
      >
        {children}
      </Box>
    </>
  );
};

/**
 * `::view-transition-*` pseudo-elements are rooted at the document, not
 * nested inside `.navi_popover`, so they can't read `--popup-animation-duration`
 * directly off the popover — mirrors it onto the document root right before
 * each `document.startViewTransition()` call (see the CSS at the top of this
 * file).
 */
const syncViewTransitionDuration = (popoverEl) => {
  const duration = getComputedStyle(popoverEl)
    .getPropertyValue("--popup-animation-duration")
    .trim();
  document.documentElement.style.setProperty(
    "--popup-view-transition-duration",
    duration || "0.18s",
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
// handling).
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

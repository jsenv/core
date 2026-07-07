/**
 * A dialog is centered in the viewport by default, with no anchor to grow
 * out of or slide in from — `animation={true}`/`"auto"` resolves to
 * `"scaling"` (see popover.jsx's own top comment for why that reads best),
 * the same kind Popover picks for a dead-center placement. Any other
 * explicit kind (`"fading"`, `"scaling"`, or a literal
 * `"slide-from-{top,bottom,left,right}"` + diagonals) is passed straight
 * through as-is: these are all self-contained CSS selectors in the shared
 * popup_css.js, so unlike Popover there's no direction to resolve in JS —
 * Dialog never needs to flip anything after measuring.
 *
 * `positionArea` (default `"center"`) can dock the dialog flush to an edge
 * instead: `"on-the-left"`/`"on-the-right"`/`"above"`/`"below"` — a
 * deliberately small subset of Popover's own positionArea vocabulary (no
 * `"aligned-*"`, no two-word combos): a dialog dock always means "flush to
 * that edge, full-length along the other axis", never a partial overlap, so
 * the richer grammar wouldn't add anything here. The docked axis's own size
 * stays whatever the consumer's own CSS/width/height says — only the
 * perpendicular axis is forced to 100%.
 *
 * `anchor` only ever affects the `--anchor-width`/`--anchor-height` CSS vars
 * (used to size the dialog relative to whatever opened it, e.g. `min-width:
 * var(--anchor-width, 0px)`) — Dialog's own positioning (`positionArea`
 * above) is never relative to it, unlike Popover.
 *
 * Two rendering strategies, picked via `layer` (`"top"` default | `"local"`,
 * same prop/values as Popover): `DialogViaAttribute` (a real `<dialog>`,
 * `showModal()`/`close()`, promoted to the top layer — gets a native focus
 * trap, `Escape`-to-cancel via the browser's own "cancel" event, and (on
 * platforms that support it) hardware/gesture back-button dismissal, all for
 * free) and `DialogCustom` (`layer="local"` — also a real `<dialog>`, for
 * its free implicit ARIA `role="dialog"`, but shown via the non-modal
 * `.show()` instead of `showModal()`, so it stays in normal document flow —
 * `position: absolute` relative to its own positioned ancestor, genuinely
 * clipped by that ancestor's own `overflow: hidden`/`auto`, the same
 * motivation as Popover's own `PopoverCustom`).
 *
 * `.show()` gives up everything `showModal()` gets for free, which
 * `DialogCustom` has to reimplement itself: a focus trap (`trapFocusInside`,
 * unconditional — a dialog is always modal, unlike Popover's opt-in
 * `focusCapture`), `Escape`-to-close (a `keydown` shortcut, since `.show()`
 * dialogs don't fire "cancel" on Escape the way a modal one does), and a
 * real backdrop sibling element (since `.show()` dialogs don't get a
 * `::backdrop` either) — see `useDialogProps`'s own `isCustom` branches
 * below for each. **Deliberately NOT reimplemented: hardware/gesture
 * back-button dismissal** (e.g. Android's system back gesture closing the
 * top-most modal) — there is no public web API to hook into that gesture at
 * all outside of the browser's own native modal-dismissal stack, which only
 * a genuinely `showModal()`-shown, top-layer element participates in. A
 * `layer="local"` dialog trades that away in exchange for being confined to
 * a local container instead of the whole viewport — an accepted,
 * intentional limitation, not an oversight.
 *
 * `DialogCustom` wraps its own dialog element in a `.navi_dialog_clip_wrapper`
 * (mirroring Popover's `.navi_popover_clip_wrapper` — see popover.jsx's own
 * comment on it for the underlying browser quirk it works around), and
 * positions/centers/docks the dialog via plain flexbox on that wrapper
 * (`align-items`/`justify-content`, keyed off `data-position-area`) rather
 * than `pickPositionRelativeTo`-style measurement — a dialog's own
 * positioning is always flush-to-edge-or-centered, never partial/anchor-
 * relative, so plain CSS alignment covers 100% of the vocabulary above with
 * no JS math needed at all (unlike Popover, which genuinely needs
 * per-anchor measurement). Confined to its own local container instead of
 * the viewport, so the visual-viewport concept below doesn't apply to it at
 * all — a container resizing (for whatever reason) is handled for free by
 * the wrapper's own flexbox reflowing, no JS needed there either.
 *
 * `DialogViaAttribute`'s own positioning (any `positionArea`, including the
 * default "center") always uses `visual_viewport_insets.js`'s own 4 CSS
 * vars, unconditionally — not behind an opt-in prop the way an earlier
 * version of this file had (`centerInVisualViewport`). The insight: the
 * *need* (stay correctly positioned relative to what's actually visible,
 * not the layout viewport, which can differ once a mobile on-screen
 * keyboard is up) is never something a consumer would want to opt out of —
 * there's no reason `position: fixed; inset: 0` should ever mean "the
 * layout viewport's 0, even if that's now covered by a keyboard" instead of
 * "the actually-visible area's edge." Implemented as `inset: var(...)` (all
 * 4 sides, defaulting to `0px` when nothing shrinks the visual viewport)
 * instead of the old margin-only, top-only `--dialog-top-inset` hack —
 * `margin: auto` still centers *within* that (now correctly-sized) virtual
 * box for `positionArea="center"`; a docked value overrides one pair of
 * insets to `auto` (matching Popover's own docking asymmetry) while keeping
 * the other two generic-and-tracked, so a dock flush to the *bottom* still
 * correctly rises above an on-screen keyboard even though it's not
 * centered. Popover doesn't need any of this: its own `visibleRectEffect`
 * (`@jsenv/dom`) already listens to `window.visualViewport` unconditionally
 * as part of its general-purpose repositioning, no separate mechanism at
 * all — Dialog just didn't have an equivalent generic "reposition on
 * relevant resize" story of its own until now, since its own positioning
 * used to be pure CSS with no JS driving it whatsoever.
 */

import {
  createPubSub,
  getElementSignature,
  snapToPixel,
  trapFocusInside,
  trapScrollInside,
} from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

import { onNaviCommand } from "@jsenv/navi/src/control/commands.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { Box } from "../box/box.jsx";
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
  suppressPointerEventsDuringTransition,
} from "./popup_shared.js";
import { ensureVisualViewportInsetsTracked } from "./visual_viewport_insets.js";

const css = /* css */ `
  @layer navi {
    .navi_dialog {
      /* min gap between dialog edges and viewport */
      /* not named margin because it's not implemented with margins (which are needed for centering) */
      --dialog-viewport-spacing: 3dvw;

      --dialog-maxmax-width: calc(
        var(--navi-vvw) - 2 * var(--dialog-viewport-spacing)
      );
      --dialog-maxmax-height: calc(
        var(--navi-vvh) - 2 * var(--dialog-viewport-spacing)
      );

      --dialog-border-radius: var(--navi-popup-border-radius);
      --dialog-border-width: 0px; /* Dialog do not need border like popover (they stand out more) */
      --dialog-outline-width: var(--navi-focus-outline-width);
      --dialog-outline-offset: calc(-1 * var(--dialog-outline-width) / 2);
      --dialog-outline-color: var(--navi-focus-outline-color);
      --dialog-box-shadow: var(--navi-popup-box-shadow);
    }
  }

  .navi_dialog {
    /* position: fixed + inset here (not left to the native :modal UA
       stylesheet's own default) so the visual-viewport vars below apply
       uniformly to every positionArea value, this one (center, via margin:
       auto) included — see this file's top comment for why this is
       unconditional now, not behind a prop. Overridden back to a plain,
       in-flow position for the custom renderer below (.navi_dialog_clip_wrapper
       .navi_dialog), which needs to stay a real flex item for its own
       wrapper's alignment to have any effect. */
    position: fixed;
    inset: var(--navi-visual-viewport-inset-top, 0px)
      var(--navi-visual-viewport-inset-right, 0px)
      var(--navi-visual-viewport-inset-bottom, 0px)
      var(--navi-visual-viewport-inset-left, 0px);
    min-width: var(--anchor-width, 0px);
    max-width: min(
      var(--dialog-max-width, var(--dialog-maxmax-width)),
      var(--dialog-maxmax-width)
    );
    max-height: min(
      var(--dialog-max-height, var(--dialog-maxmax-height)),
      var(--dialog-maxmax-height)
    );
    margin: auto;
    flex-direction: column;
    border-width: var(--dialog-border-width);
    border-style: solid;
    border-color: var(--dialog-border-color);
    border-radius: var(--dialog-border-radius);
    outline-width: var(--dialog-outline-width);
    outline-color: var(--dialog-outline-color);
    outline-offset: 0;
    box-shadow: var(--dialog-box-shadow);
    transition: inset 0.1s ease-in-out;

    &::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }

    &[data-focus-visible] {
      outline-style: solid;
    }

    &[open] {
      display: flex;
    }

    /* positionArea docking, via-attribute renderer (see this file's top
       comment) — each rule only overrides the axis perpendicular to the
       dock direction to "auto" (so margin: auto's own centering there
       collapses to flush-against-the-tracked-edge instead); the docked
       pair itself stays the same tracked var as the base rule above, so a
       "below" dock still correctly rises above an on-screen keyboard, not
       just the "center" case. Setting both insets of the *other* axis
       (rather than a bare 0) is what stretches the box to fill it — no
       separate width/height: 100% needed. */
    &[data-position-area="on-the-right"] {
      inset: var(--navi-visual-viewport-inset-top, 0px)
        var(--navi-visual-viewport-inset-right, 0px)
        var(--navi-visual-viewport-inset-bottom, 0px) auto;
      margin: 0;
    }
    &[data-position-area="on-the-left"] {
      inset: var(--navi-visual-viewport-inset-top, 0px) auto
        var(--navi-visual-viewport-inset-bottom, 0px)
        var(--navi-visual-viewport-inset-left, 0px);
      margin: 0;
    }
    &[data-position-area="above"] {
      inset: var(--navi-visual-viewport-inset-top, 0px)
        var(--navi-visual-viewport-inset-right, 0px) auto
        var(--navi-visual-viewport-inset-left, 0px);
      margin: 0;
    }
    &[data-position-area="below"] {
      inset: auto var(--navi-visual-viewport-inset-right, 0px)
        var(--navi-visual-viewport-inset-bottom, 0px)
        var(--navi-visual-viewport-inset-left, 0px);
      margin: 0;
    }
  }

  /* Custom renderer only (see this file's top comment) — same purpose as
     Popover's own .navi_popover_clip_wrapper: a plain, borderless div sized
     to exactly match the dialog's own positioned ancestor, absorbing any
     scrollable-overflow growth a translate/scale entrance transition can
     cause in some browsers before it ever reaches the real container. Also
     doubles as the positioning mechanism itself — flexbox alignment,
     keyed off data-position-area, covers every value of positionArea's
     vocabulary (always flush-to-edge-or-centered, never partial) with no
     JS measurement needed. */
  .navi_dialog_clip_wrapper {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    overflow: hidden;

    .navi_dialog {
      /* Neutralized here — centering/docking is entirely the wrapper's own
         flexbox alignment above/below, not the base rule's own position:
         fixed + visual-viewport-tracked inset + margin: auto (all
         via-attribute/viewport concerns, irrelevant once confined to a
         local container instead). position back to a plain in-flow value
         so this stays a real flex item — align-items/justify-content have
         no effect on an absolutely/fixed-positioned child at all. */
      position: static;
      inset: unset;
      margin: 0;
      pointer-events: auto;
    }

    &[data-position-area="on-the-left"] {
      align-items: stretch;
      justify-content: flex-start;
    }
    &[data-position-area="on-the-right"] {
      align-items: stretch;
      justify-content: flex-end;
    }
    &[data-position-area="above"] {
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-start;
    }
    &[data-position-area="below"] {
      flex-direction: column;
      align-items: stretch;
      justify-content: flex-end;
    }
  }

  /* Custom renderer only — .show()'d dialogs get no ::backdrop, so this is
     a real sibling element instead, same idea/CSS shape as Popover's own
     .navi_popover_backdrop (see popover.jsx's top comment for the design
     this mirrors). Always rendered (never skipped like Popover's own
     "none" case): a dialog is always modal, so there's always at least a
     click-absorbing backdrop, matching what showModal() already gives the
     via-attribute renderer for free regardless of
     pointerInteractionOutsideEffect. */
  .navi_dialog_backdrop {
    position: absolute;
    inset: 0;
    margin: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.4);
    border: none;
    pointer-events: none;
    --popup-animation-duration: 0.18s;

    &[aria-expanded="true"] {
      pointer-events: auto;
    }

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
 * (UncontrolledDialog) and one owned by the caller (ControlledDialog, used
 * by picker_custom.jsx) so we don't instantiate a default controller when it
 * would just be thrown away.
 */
export const Dialog = (props) => {
  import.meta.css = css;

  if (props.openController) {
    return <ControlledDialog {...props} />;
  }
  return <UncontrolledDialog {...props} />;
};

// No openController passed: this Dialog is used declaratively (e.g. driven
// by --navi-toggle/--navi-open/--navi-close commands, the `open` prop, or
// `defaultOpen`) rather than owned by a parent component.
const UncontrolledDialog = (props) => {
  const openController = useOpenControllerByProps(props);

  return (
    <ControlledDialog
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

// Picks which rendering strategy actually mounts, from `layer` alone — see
// this file's top comment. Done after the controlled/uncontrolled split
// above, so an openController is always already resolved by the time
// DialogViaAttribute/DialogCustom (and the useDialogProps hook they share)
// ever run.
const ControlledDialog = (props) => {
  if (props.layer === "local") {
    return <DialogCustom {...props} />;
  }
  return <DialogViaAttribute {...props} />;
};

const DialogViaAttribute = (props) => {
  const [backdropProps, contentProps] = useDialogProps(props);

  return (
    <>
      {backdropProps && <Box {...backdropProps} />}
      <Box {...contentProps} />
    </>
  );
};

const DialogCustom = (props) => {
  const [backdropProps, contentProps, resolvedPositionArea] =
    useDialogProps(props);

  return (
    <>
      {backdropProps && <Box {...backdropProps} />}
      <div
        className="navi_dialog_clip_wrapper"
        data-position-area={
          resolvedPositionArea === "center" ? undefined : resolvedPositionArea
        }
      >
        <Box {...contentProps} />
      </div>
    </>
  );
};

/**
 * Everything both rendering strategies share once an `openController` is
 * already resolved: focus/debug/id plumbing, the open-commit sequence, the
 * close handler — inlined in `openEffect`, branching on `isCustom` at each
 * point the two renderers genuinely differ (same pattern as popover.jsx's
 * own usePopoverProps — see its top comment for why this stays inline
 * rather than split into two functions). Returns `[backdropProps,
 * contentProps, resolvedPositionArea]`.
 */
const useDialogProps = (props) => {
  const {
    openController,
    // Only ever affects --anchor-width/--anchor-height (see this file's top
    // comment) — Dialog's own positioning is never relative to it.
    anchor: anchorProp,
    // "top" (default) → real <dialog>, showModal(), the browser's own top
    // layer. "local" → also a real <dialog>, but shown via the non-modal
    // .show() instead, staying in normal document flow, position: absolute
    // relative to its own positioned ancestor. See this file's top comment.
    layer = "top",
    // See this file's top comment — a deliberately small subset of
    // Popover's own positionArea vocabulary.
    positionArea = "center",
    children,
    scrollCapture,
    // "close" (default) closes on an outside click. "capture"/"none" both
    // just absorb it without closing — for the via-attribute renderer,
    // showModal() already makes the rest of the page inert, so there's
    // nothing for a click to reach either way; for the custom renderer,
    // there's no native inert-ing, so the real backdrop below is what
    // actually makes "capture"/"none" behave the same way here too.
    pointerInteractionOutsideEffect = "close",
    animation,
    // Makes the dialog itself a valid focus target so autoFocus="fallback"
    // below has somewhere to land when it contains nothing focusable of its
    // own — -1 keeps it out of the normal Tab order (it's only ever reached
    // programmatically). <dialog> has no default tabindex of its own.
    tabIndex = -1,
    // See use_auto_focus.js's own docs for why this must never reach the DOM
    // as a plain `autofocus` attribute — useAutoFocus below takes over
    // instead, so it's read here rather than left in `rest`.
    autoFocus = "fallback",
    ...rest
  } = props;
  const isCustom = layer === "local";
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const backdropRef = useRef();
  // Disarms a still-pending backdrop hide from a previous close (see
  // armPointerDownOutsideClose below) — same pattern as popover.jsx's own.
  const disarmBackdropHideRef = useRef(null);
  const debugPopup = useDebugPopup();
  const debugFocus = useDebugFocus();
  const debugInteraction = useDebugInteraction();
  const autoFocusProps = useAutoFocus(ref, autoFocus);
  const isAutoAnimation = animation === true || animation === "auto";
  const resolvedAnimation = isAutoAnimation ? "scaling" : animation;
  let resolvedPositionArea = positionArea;
  if (!DIALOG_POSITION_AREA_VALUES.has(positionArea)) {
    console.warn(
      `Dialog: unknown positionArea="${positionArea}" (expected "center", "on-the-left", "on-the-right", "above", or "below")`,
    );
    resolvedPositionArea = "center";
  }

  // aria-expanded lives on the dialog element itself (not driven through
  // Preact's vdom — openEffect/its cleanup toggle it imperatively in sync
  // with showModal()/close() or .show()/close(), see below) so popup_css.js
  // can key its CSS off a single selector regardless of Popover vs Dialog.
  useLayoutEffect(() => {
    if (ref.current) {
      ref.current.setAttribute("aria-expanded", "false");
    }
    if (backdropRef.current) {
      backdropRef.current.setAttribute("aria-expanded", "false");
    }
  }, []);

  // Sync the DOM open and return how to sync it back closed, fresh on every
  // render so it closes over the latest props (scrollLock, etc.). The
  // controller (owned by the caller, or by UncontrolledDialog) decides
  // *when* this runs. openEffect runs outside of render (triggered by
  // openController.open()), so it cannot call hooks — cleanup is a plain
  // pub/sub.
  openController.openEffect = (e) => {
    const dialogEl = ref.current;
    const backdropEl = backdropRef.current;
    if (!dialogEl) {
      return undefined;
    }

    // Set by useOpenControllerByProps for the very first open triggered by
    // `open`/`defaultOpen` already being truthy at mount — see popover.jsx's
    // own openEffect for the full reasoning, mirrored here identically.
    const silent = Boolean(e.detail.silent);

    const [cleanup, addCleanup] = createPubSub(true);
    let anchor;
    if (typeof anchorProp === "string") {
      console.warn(
        `Dialog: anchor="${anchorProp}" is no longer supported — anchor only accepts a ref or a DOM element now (or omit it entirely).`,
      );
    } else if (anchorProp) {
      // anchor prop is a ref or a DOM element
      anchor = anchorProp.current ?? anchorProp;
    } else if (e.detail.anchor) {
      // e.g. the button that triggered a --navi-toggle/--navi-open command,
      // already resolved from detail.anchor/detail.source by the caller
      // (see UncontrolledDialog's onnavi_request_open).
      anchor = e.detail.anchor;
    }
    const effectiveAnchor = anchor || document.documentElement;
    debugPopup(`"${e.type}" on ${getElementSignature(e.target)} -> openDialog`);
    const { width, height } = effectiveAnchor.getBoundingClientRect();
    dialogEl.style.setProperty("--anchor-width", `${snapToPixel(width)}px`);
    dialogEl.style.setProperty("--anchor-height", `${snapToPixel(height)}px`);
    if (resolvedAnimation) {
      dialogEl.setAttribute("navi-animation", resolvedAnimation);
      backdropEl?.setAttribute("navi-animation", resolvedAnimation);
    } else {
      dialogEl.removeAttribute("navi-animation");
      backdropEl?.removeAttribute("navi-animation");
    }

    // Suppressed until committed below — same @starting-style-avoidance
    // reasoning as popover.jsx's own openEffect (see its top comment), even
    // though Dialog never needs to measure/flip anything: it still needs a
    // genuinely rendered "closed" frame to transition from, not a jump
    // straight from not-shown to aria-expanded="true".
    dialogEl.style.transitionProperty = "none";

    if (backdropEl) {
      disarmBackdropHideRef.current?.();
      disarmBackdropHideRef.current = null;
      backdropEl.style.transitionProperty = "none";
      backdropEl.style.display = "";
      backdropEl.getBoundingClientRect();
      // aria-expanded stays "false" here — flipped below, alongside
      // dialogEl's own flip, once transitions are back on (or, for
      // `silent`, deliberately not — see below). Setting it here (before
      // navi-animation is guaranteed to already apply) would risk the same
      // bug already fixed once for Popover's own backdrop.
    }

    if (isCustom) {
      dialogEl.show();
    } else {
      dialogEl.showModal();
    }

    if (isCustom) {
      addCleanup(trapFocusInside(dialogEl, { debug: debugFocus }));
    }
    if (scrollCapture) {
      addCleanup(trapScrollInside(dialogEl));
    }

    if (!isCustom) {
      // Idempotent — only ever registers the underlying visualViewport
      // listener once for the whole page, regardless of how many dialogs
      // call this. See this file's top comment for why this is
      // unconditional now, not behind a centerInVisualViewport prop.
      ensureVisualViewportInsetsTracked();
    }

    // Final commit — see popover.jsx's own openEffect for the full
    // reasoning behind the `silent` ordering swap (forced reflow between
    // the flip and re-enabling transitions is what actually matters, not
    // just the JS statement order).
    dialogEl.getBoundingClientRect();
    if (silent) {
      dialogEl.setAttribute("aria-expanded", "true");
      backdropEl?.setAttribute("aria-expanded", "true");
      dialogEl.getBoundingClientRect();
      dialogEl.style.transitionProperty = "";
      if (backdropEl) {
        backdropEl.style.transitionProperty = "";
      }
    } else {
      dialogEl.style.transitionProperty = "";
      dialogEl.setAttribute("aria-expanded", "true");
      backdropEl?.setAttribute("aria-expanded", "true");
      if (backdropEl) {
        backdropEl.style.transitionProperty = "";
      }
    }
    const hasCssTransitionAnimation = Boolean(resolvedAnimation);
    const cancelOpenInteractionSuppression =
      !silent && hasCssTransitionAnimation
        ? suppressPointerEventsDuringTransition(dialogEl)
        : null;
    const restoreFocus = openController.transferFocusOnOpen(dialogEl);

    return (closeEvent) => {
      debugPopup(
        `"${closeEvent.type}" on ${getElementSignature(closeEvent.target)} -> closeDialog`,
      );
      dialogEl.setAttribute("aria-expanded", "false");
      dialogEl.close();
      cancelOpenInteractionSuppression?.();
      if (hasCssTransitionAnimation) {
        suppressPointerEventsDuringTransition(dialogEl);
      }
      if (backdropEl) {
        backdropEl.setAttribute("aria-expanded", "false");
        disarmBackdropHideRef.current = armPointerDownOutsideClose(
          closeEvent,
          () => {
            backdropEl.style.display = "none";
          },
        );
      }
      restoreFocus(closeEvent);
      cleanup();
    };
  };

  const onKeyDownShortcuts = createOnKeyDownForShortcuts({
    escape: (e) => {
      // Only the custom renderer needs this — a modal <dialog> already
      // fires "cancel" (handled via onCancel below) on Escape natively; a
      // non-modal .show()'d one doesn't.
      if (!isCustom || !openController.opened) {
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

  const hasBackdrop = isCustom;
  const backdropProps = hasBackdrop
    ? {
        "ref": backdropRef,
        "baseClassName": "navi_dialog_backdrop",
        "aria-hidden": "true",
        "styleCSSVars": DIALOG_STYLE_CSS_VARS,
        "animationDuration": rest.animationDuration,
        "onMouseDown": (mouseDownEvent) => {
          if (mouseDownEvent.button !== 0) {
            return;
          }
          if (pointerInteractionOutsideEffect === "close") {
            openController.requestClose(mouseDownEvent, { isCancel: true });
          }
          // "capture"/"none" both just absorb the click without closing —
          // see this hook's own destructuring comment for why the two
          // collapse to the same behavior for Dialog.
        },
      }
    : null;

  const contentProps = {
    tabIndex,
    "navi-animation": isAutoAnimation ? undefined : animation,
    "styleCSSVars": DIALOG_STYLE_CSS_VARS,
    ...rest,
    ...autoFocusProps,
    "as": "dialog",
    ref,
    "baseClassName": "navi_dialog",
    "pseudoClasses": DIALOG_PSEUDO_CLASSES,
    "aria-modal": "true",
    "data-position-area": isCustom
      ? undefined
      : resolvedPositionArea === "center"
        ? undefined
        : resolvedPositionArea,
    "onnavi_command": (e) => {
      onNaviCommand(e);
    },
    "onnavi_request_interaction": (e) => {
      onRequestInteraction(e, { debugInteraction });
    },
    "onKeyDown": onKeyDownShortcuts,
    "onMouseDown": (e) => {
      rest.onMouseDown?.(e);
      if (isCustom) {
        // The custom renderer's own real backdrop (above) already handles
        // outside clicks — this element itself only ever receives clicks
        // that land inside it (the wrapper's flex layout means there's no
        // "padding area outside the box" the way the via-attribute
        // renderer's own full-viewport <dialog> has).
        return;
      }
      if (pointerInteractionOutsideEffect !== "close") {
        return;
      }
      if (e.button !== 0) {
        return;
      }
      // Detect backdrop click: the click must land outside the dialog's
      // bounding rect. Checking coordinates is necessary because clicking
      // on the dialog's own padding also sets e.target === ref.current.
      if (e.target !== ref.current) {
        return;
      }
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
    },
    "onCancel": (e) => {
      // Native "cancel" (Escape) only ever fires for a modal (showModal())
      // dialog — the custom renderer's own Escape handling lives in
      // onKeyDownShortcuts above instead.
      openController.requestClose(e, { isCancel: true });
    },
    children,
  };

  return [backdropProps, contentProps, resolvedPositionArea];
};

const DIALOG_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":focus-within",
];

// See this file's top comment for the positionArea docking subset.
const DIALOG_POSITION_AREA_VALUES = new Set([
  "center",
  "on-the-left",
  "on-the-right",
  "above",
  "below",
]);

// Lets consumers pass animationDuration="0.5s" as a regular prop; Box maps
// it to the CSS var for us (see box.jsx's styleCSSVars handling).
const DIALOG_STYLE_CSS_VARS = {
  animationDuration: "--popup-animation-duration",
  maxWidth: "--dialog-max-width",
  maxHeight: "--dialog-max-height",
};

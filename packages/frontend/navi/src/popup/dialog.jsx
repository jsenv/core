/**
 * A dialog is centered in the viewport by default, with no anchor to grow
 * out of or slide in from — `animation={true}`/`"auto"` resolves the same
 * way Popover's own auto-animation resolution does (see popover.jsx's own
 * top comment and popup_shared.js's `resolveAutoAnimationKind`/
 * `resolveDirectionValue`), just always through the "no real anchor" path:
 * a dead-center `positionArea` picks `"scaling"`, anything off-center picks
 * a `"slide-from-*"` direction matching that placement. Any other explicit
 * kind (`"fading"`, `"scaling"`, or a literal
 * `"slide-from-{top,bottom,left,right}"` + diagonals) is passed straight
 * through as-is.
 *
 * `positionArea` (default `"center"`) accepts the *same* grammar Popover
 * does — see popup_shared.js's own `parsePositionArea`/
 * `POSITION_AREA_X/Y_VALUES` doc for the full vocabulary (two
 * space-separated words, order-independent, "aligned-*" for edge-touching
 * vs. a bare word for flush-to-edge/no-overlap). Dialog is never really
 * anchored (see below), so several combinations produce the exact same
 * final position (e.g. `"above"` and `"above center"` land identically) —
 * they're kept distinct anyway because `positionArea` still selects which
 * animation direction plays, and being able to test that whole combination
 * space (see `dialog_demo.html`'s own Position section) is the entire
 * reason for sharing Popover's richer grammar instead of the old flat
 * 5-value one.
 *
 * `anchor` only ever affects the `--anchor-width`/`--anchor-height` CSS vars
 * (used to size the dialog relative to whatever opened it, e.g. `min-width:
 * var(--anchor-width, 0px)`) — Dialog's own positioning (`positionArea`
 * above) is never relative to it, unlike Popover: `pickPositionRelativeTo`
 * is always called in its own no-anchor/docked mode (see popover.jsx's own
 * top comment on that mode), docking against the viewport for `layer=
 * "top"` or the dialog's own positioned ancestor for `layer="local"`.
 *
 * Two rendering strategies, picked via `layer` (`"top"` default | `"local"`,
 * same prop/values as Popover): `DialogAsModal` (a real `<dialog>`,
 * `showModal()`/`close()`, promoted to the top layer — gets a native focus
 * trap, `Escape`-to-cancel via the browser's own "cancel" event, and (on
 * platforms that support it) hardware/gesture back-button dismissal, all for
 * free) and `DialogLocal` (`layer="local"` — also a real `<dialog>`, for
 * its free implicit ARIA `role="dialog"`, but shown via the non-modal
 * `.show()` instead of `showModal()`, so it stays in normal document flow —
 * `position: absolute` relative to its own positioned ancestor, genuinely
 * clipped by that ancestor's own `overflow: hidden`/`auto`, the same
 * motivation as Popover's own `PopoverCustom`).
 *
 * `.show()` gives up everything `showModal()` gets for free, which
 * `DialogLocal` has to reimplement itself: a focus trap (`trapFocusInside`,
 * unconditional — a dialog is always modal, unlike Popover's opt-in
 * `focusCapture` — and scoped to its own positioned ancestor via
 * `boundaryElement`, not `document`: a Tab press or click occurring
 * entirely outside that container never reaches this trap at all, only
 * interactions within the container get redirected back into the dialog)
 * and `Escape`-to-close (a `keydown` shortcut, since `.show()` dialogs don't
 * fire "cancel" on Escape the way a modal one does) — see `useDialogProps`'s
 * own `isModal` branches below for each. **Deliberately NOT reimplemented:
 * hardware/gesture back-button dismissal** (e.g. Android's system back
 * gesture closing the top-most modal) — there is no public web API to hook
 * into that gesture at all outside of the browser's own native
 * modal-dismissal stack, which only a genuinely `showModal()`-shown,
 * top-layer element participates in. A `layer="local"` dialog trades that
 * away in exchange for being confined to a local container instead of the
 * whole viewport — an accepted, intentional limitation, not an oversight.
 *
 * **Both renderers get a real `.navi_dialog_backdrop` element** (unlike an
 * earlier version of this file, where `DialogAsModal` relied on the native
 * `::backdrop` pseudo-element instead) — same shared class, same CSS, same
 * `backdropProps.onMouseDown` for outside-click handling either way, only
 * `popover="manual"` (promoting it to the top layer, `showPopover()`/
 * `hidePopover()`) differs, gated on `isModal` (mirrors Popover's own
 * `PopoverViaAttribute`/`PopoverCustom` backdrop split exactly). Shown
 * *before* `dialogEl.showModal()`/`.show()` on every open, so the top
 * layer's own "later insertion stacks above" rule puts the real dialog
 * above it. The native `::backdrop` a modal `<dialog>` still gets for free
 * either way is deliberately left `background: transparent; pointer-events:
 * none;` — inert and invisible, so every click (including ones that would
 * otherwise land on it) falls through to the real backdrop underneath
 * instead. This is what makes outside-click detection reliable *throughout*
 * the entire open lifetime, transition included: unlike the native
 * `::backdrop` (whose clicks are dispatched with `target === dialogEl`, so
 * `suppressPointerEventsDuringTransition`'s own `dialogEl.style.pointerEvents
 * = "none"` mid-transition made them briefly undetectable), the real
 * backdrop is a fully separate element `dialogEl`'s own pointer-events never
 * touches — no transition-specific workaround needed at all.
 *
 * `DialogLocal` wraps its own dialog element in a `.navi_dialog_clip_wrapper`
 * (mirroring Popover's `.navi_popover_clip_wrapper` — see popover.jsx's own
 * comment on it for the underlying browser quirk it works around) purely to
 * absorb overflow growth from a translate/scale entrance transition before
 * it ever reaches the real container — positioning itself is entirely
 * `pickPositionRelativeTo`-driven (JS-computed `top`/`left`), the exact same
 * no-anchor/docked mechanism Popover's own custom renderer uses, not
 * flexbox alignment.
 *
 * Both renderers reposition on the same triggers Popover's own
 * `visibleRectEffect` already reacts to generically (window resize/scroll,
 * visual-viewport changes for `layer="top"` — it listens to
 * `window.visualViewport` directly, no bespoke CSS-var/event mechanism
 * needed — or the positioned ancestor's own resize for `layer="local"`).
 */

import {
  createPubSub,
  dispatchCustomEvent,
  getElementSignature,
  getPositionedParent,
  pickPositionRelativeTo,
  snapToPixel,
  trapFocusInside,
  trapScrollInside,
  visibleRectEffect,
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
  parsePositionArea,
  resolveAutoAnimationKind,
  resolveDirectionValue,
  suppressPointerEventsDuringTransition,
} from "./popup_shared.js";

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
    /* Base default: also the custom renderer's own permanent value — its
       containing block is genuinely its nearest positioned ancestor,
       regardless of positionArea. See the [data-layer="top"] rule below for
       why the via-attribute renderer overrides this. Position is always
       JS-driven (pickPositionRelativeTo sets top/left directly, see
       useDialogProps below) — no CSS alignment/inset math here at all,
       unlike an earlier version of this file. */
    position: absolute;
    inset: unset;
    min-width: var(--anchor-width, 0px);
    max-width: min(
      var(--dialog-max-width, var(--dialog-maxmax-width)),
      var(--dialog-maxmax-width)
    );
    max-height: min(
      var(--dialog-max-height, var(--dialog-maxmax-height)),
      var(--dialog-maxmax-height)
    );
    margin: 0;
    flex-direction: column;
    border-width: var(--dialog-border-width);
    border-style: solid;
    border-color: var(--dialog-border-color);
    border-radius: var(--dialog-border-radius);
    outline-width: var(--dialog-outline-width);
    outline-color: var(--dialog-outline-color);
    outline-offset: 0;
    box-shadow: var(--dialog-box-shadow);

    /* The real .navi_dialog_backdrop below (always rendered now, for both
       renderers) is what actually provides the visual dimming/blur and
       outside-click detection — see this file's top comment for why. This
       native ::backdrop still exists (a modal <dialog> always gets one),
       but is deliberately inert: invisible, and pointer-events: none so
       every click on it falls through to the real backdrop underneath
       instead of being dispatched here with target === dialogEl. */
    &::backdrop {
      background: transparent;
    }

    &[data-focus-visible] {
      outline-style: solid;
    }

    &[open] {
      display: flex;
    }

    /* Via-attribute renderer only — promoted to the top layer, so its
       containing block is the viewport rather than any positioned
       ancestor. Not left to the native :modal UA stylesheet's own default
       (also position: fixed, but with its own margin/inset assumptions) so
       that JS-set top/left (see useDialogProps below) always wins
       cleanly. */
    &[data-layer="top"] {
      position: fixed;
    }
  }

  /* Real sibling element for both renderers now (see this file's top
     comment) — same idea/CSS shape as Popover's own .navi_popover_backdrop
     (see popover.jsx's top comment for the design this mirrors). Always
     rendered (never skipped like Popover's own "none" case): a dialog is
     always modal, so there's always at least a click-absorbing backdrop. */
  .navi_dialog_backdrop {
    --popup-animation-duration: 0.18s;

    /* layer="local": a plain sibling confined to the same positioned
       ancestor as its dialog (see this file's top comment) — inset: 0
       within that ancestor, not the viewport. */
    position: absolute;
    inset: 0;
    border: none;
    /* Always clickable while actually rendered (display: none/
       hidePopover() while genuinely closed already makes it non-interactive
       on its own) — an outside click should close the dialog even while
       it's still animating in, not just once the entrance transition
       settles. Only the content itself (.navi_dialog, via
       suppressPointerEventsDuringTransition in openEffect) gets
       pointer-events: none mid-transition — this backdrop is a fully
       separate element, never touched by that. */
    pointer-events: auto;

    /* isModal: a top-layer sibling, so it needs to cover the whole
       viewport itself (width/height: auto overrides the [popover] UA
       default sizing). */
    &[popover] {
      position: fixed;
      inset: 0;
      width: auto;
      height: auto;
    }

    /* Makes pointerInteractionOutsideEffect have a visible impact on backdrop */
    &[data-pointer-interaction-outside="close"] {
      background: var(--navi-backdrop-close-background);
    }
    &[data-pointer-interaction-outside="capture"] {
      background: var(--navi-backdrop-capture-background);
      backdrop-filter: var(--navi-backdrop-capture-backdrop-filter);
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

  /* Custom renderer only (see this file's top comment) — same purpose as
     Popover's own .navi_popover_clip_wrapper: a plain, borderless div sized
     to exactly match the dialog's own positioned ancestor, absorbing any
     scrollable-overflow growth a translate/scale entrance transition can
     cause in some browsers before it ever reaches the real container. */
  .navi_dialog_clip_wrapper {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;

    .navi_dialog {
      pointer-events: auto;
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
// DialogAsModal/DialogLocal (and the useDialogProps hook they share) ever
// run.
const ControlledDialog = (props) => {
  if (props.layer === "local") {
    return <DialogLocal {...props} />;
  }
  return <DialogAsModal {...props} />;
};

const DialogAsModal = (props) => {
  const [backdropProps, contentProps] = useDialogProps(props);
  return (
    <>
      {backdropProps && <Box {...backdropProps} />}
      <Box {...contentProps} />
    </>
  );
};

const DialogLocal = (props) => {
  const [backdropProps, contentProps] = useDialogProps(props);

  return (
    <>
      {backdropProps && <Box {...backdropProps} />}
      <div className="navi_dialog_clip_wrapper">
        <Box {...contentProps} />
      </div>
    </>
  );
};

/**
 * Everything both rendering strategies share once an `openController` is
 * already resolved: focus/debug/id plumbing, the open-commit sequence, the
 * close handler — inlined in `openEffect`, branching on `isModal` at each
 * point the two renderers genuinely differ (same pattern as popover.jsx's
 * own usePopoverProps — see its top comment for why this stays inline
 * rather than split into two functions). Returns `[backdropProps,
 * contentProps]` — both real, always (see this file's top comment for why
 * `backdropProps` is never `null` here, unlike Popover's own `"none"` case).
 */
const useDialogProps = (props) => {
  const backdropProps = {};
  const contentProps = {};
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
    // Same grammar as Popover's own positionArea — see this file's top
    // comment and popup_shared.js's parsePositionArea.
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
  const isModal = layer === "top";
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
  const positionAreaParseResult = parsePositionArea(positionArea);
  if (!positionAreaParseResult) {
    console.warn(`Dialog: invalid positionArea="${positionArea}"`);
  }
  const parsedPositionArea = positionAreaParseResult ?? {
    y: "center",
    x: "center",
  };
  const isAutoAnimation = animation === true || animation === "auto";
  // Dialog never has a real anchor (see this file's top comment), so this
  // is always the "no anchor" path — the same one Popover's own custom
  // renderer falls into when it has no real anchor either.
  const resolvedAnimationKind = isAutoAnimation
    ? resolveAutoAnimationKind(undefined, parsedPositionArea)
    : animation;
  // Not gated on isAutoAnimation — an explicit animation="sliding" needs a
  // concrete direction just as much as an auto-resolved one does (same as
  // Popover's own "sliding"/"expanding" resolution step in openEffect).
  let resolvedAnimation = resolvedAnimationKind;
  if (resolvedAnimationKind === "sliding") {
    resolvedAnimation =
      resolveDirectionValue(parsedPositionArea.y, parsedPositionArea.x, {
        prefix: "slide-from",
      }) ?? "slide-from-top";
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
      if (isModal) {
        // Native [popover] starts hidden automatically — nothing to do.
      } else {
        // No native show/hide mechanism to lean on (a plain div, unlike
        // dialogEl itself, which is a real <dialog> and so already starts
        // display: none natively until .show()/.showModal() adds [open]) —
        // needs the same starting-hidden treatment explicitly, or it covers
        // everything from the moment it mounts, well before the dialog is
        // ever opened.
        backdropRef.current.style.display = "none";
      }
    }
  }, [isModal]);

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

    const positionedAncestor = isModal
      ? null
      : getPositionedParent(
          dialogEl.parentElement /* dialogEl is inside the clip_wrapper */,
        );

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
      // Disarm a still-pending hide from a previous close: a click
      // arriving later must not hide the fresh instance this open is
      // about to show.
      disarmBackdropHideRef.current?.();
      disarmBackdropHideRef.current = null;
      // transitionProperty stays "none" here for both — reset later, in the
      // final commit step alongside dialogEl's own (not resumed early),
      // same reasoning as popover.jsx's own openEffect.
      backdropEl.style.transitionProperty = "none";
      if (isModal) {
        // Hidden first if a previous close's deferred hidePopover() (see
        // the close handler below) hasn't run yet — showPopover() throws
        // on an already-open element. Showing it fresh here (rather than
        // reusing an older still-open instance) resets its top-layer
        // position to right below whatever shows next, which matters when
        // other dialogs/popovers already opened in between.
        if (backdropEl.matches(":popover-open")) {
          backdropEl.hidePopover();
        }
        // Shown *before* dialogEl.showModal() below — the top layer
        // stacks later showPopover()/showModal() calls above earlier
        // ones, so the backdrop must go first for the real dialog to end
        // up on top.
        backdropEl.showPopover();
        backdropEl.getBoundingClientRect();
      } else {
        backdropEl.style.display = "";
        backdropEl.getBoundingClientRect();
      }
      // aria-expanded stays "false" here — flipped below, alongside
      // dialogEl's own flip, once transitions are back on (or, for
      // `silent`, deliberately not — see below). Setting it here (before
      // navi-animation is guaranteed to already apply) would risk the same
      // bug already fixed once for Popover's own backdrop.
    }

    if (isModal) {
      dialogEl.showModal();
    } else {
      dialogEl.show();
    }

    if (isModal) {
      // Native focus trap — the browser's own top-layer modal already
      // confines Tab/Shift+Tab, nothing to reimplement here.
    } else {
      addCleanup(
        trapFocusInside(dialogEl, {
          debug: debugFocus,
          boundaryElement: positionedAncestor,
          // A dialog is always modal (see this file's top comment) — a
          // mousedown on some other focusable element inside the same
          // container (but outside the dialog) must not steal focus away
          // from it either, not just a Tab press.
          pointerTrap: true,
        }),
      );
    }
    if (scrollCapture) {
      addCleanup(trapScrollInside(dialogEl));
    }

    // Positioning: dialogEl is already shown (display: flex, per this
    // file's own [open] CSS) by this point, so its own dimensions are real
    // — pickPositionRelativeTo's own no-anchor/docked mode (no `anchor`
    // argument at all) docks it against the viewport (layer="top"/isModal)
    // or its own positioned ancestor (layer="local", the same
    // positionedAncestor computed above), same mechanism as Popover's own
    // custom renderer. --space-available is deliberately left untouched
    // (cleared, not set) — a docked dialog always relies on the CSS's own
    // --dialog-maxmax-* ceiling instead, see popover.jsx's own comment on
    // this.
    const positionDialog = () => {
      dialogEl.style.removeProperty("--space-available");
      const { left, top } = pickPositionRelativeTo(dialogEl, null, {
        positionX: parsedPositionArea.x,
        positionY: parsedPositionArea.y,
        container: isModal ? undefined : positionedAncestor,
      });
      dialogEl.style.left = `${left}px`;
      dialogEl.style.top = `${top}px`;
      // Lets a descendant's own visibleRectEffect (visible_rect.js — e.g. a
      // Callout anchored to something inside this Dialog) know to recheck
      // its own position whenever this dialog itself moves — it already
      // walks up the ancestor chain and listens for this event on any
      // <dialog> ancestor specifically, no wiring needed on that side.
      dispatchCustomEvent(dialogEl, "navi_position_change");
    };
    positionDialog();

    // Reposition on the same triggers Popover's own visibleRectEffect
    // already reacts to generically — window resize/scroll/visual-viewport
    // changes for layer="top"/isModal (watching document.documentElement;
    // visibleRectEffect already debounces visualViewport resize by 100ms
    // to avoid the mobile tap-to-tap-input keyboard flicker, so no
    // separate mechanism is needed here for that), or the positioned
    // ancestor's own resize for layer="local" (watching positionedAncestor)
    // — see this file's top comment.
    const rectEffect = visibleRectEffect(
      isModal ? document.documentElement : positionedAncestor,
      () => {
        positionDialog();
      },
      { event: e, skipElementResize: true },
    );
    rectEffect.observeSize(dialogEl);
    addCleanup(() => {
      rectEffect.disconnect();
    });

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
          isModal
            ? () => backdropEl.hidePopover()
            : () => {
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
      if (isModal || !openController.opened) {
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

  // Built up as plain mutable objects rather than two conditional literals:
  // most fields are shared, "popover" (below) is the one genuine
  // per-renderer fork (see this file's top comment for why both renderers
  // now get a real backdrop either way).

  Object.assign(backdropProps, {
    "ref": backdropRef,
    "baseClassName": "navi_dialog_backdrop",
    "aria-hidden": "true",
    "styleCSSVars": DIALOG_STYLE_CSS_VARS,
    "animationDuration": rest.animationDuration,
    "data-pointer-interaction-outside": pointerInteractionOutsideEffect,
  });
  Object.assign(contentProps, {
    tabIndex,
    // Unlike Popover (which genuinely can't resolve "auto" until it
    // measures against a real anchor), resolvedAnimation is already fully
    // known synchronously here — a dialog never needs to flip anything
    // after measuring (see this file's top comment) — so there's no reason
    // to withhold the attribute for the auto case the way Popover has to.
    "navi-animation": resolvedAnimation,
    "styleCSSVars": DIALOG_STYLE_CSS_VARS,
    ...rest,
    ...autoFocusProps,
    "as": "dialog",
    ref,
    "baseClassName": "navi_dialog",
    "pseudoClasses": DIALOG_PSEUDO_CLASSES,
    // Distinguishes the two renderers for the CSS above (position: fixed
    // vs. absolute) — positioning itself is entirely JS-driven now (see
    // openEffect's own positionDialog above), no data-position-area
    // attribute needed at all.
    "data-layer": layer,
    "onnavi_command": (e) => {
      onNaviCommand(e);
    },
    "onnavi_request_interaction": (e) => {
      onRequestInteraction(e, { debugInteraction });
    },
    "onKeyDown": onKeyDownShortcuts,
    "onCancel": (e) => {
      // Native "cancel" (Escape) only ever fires for a modal (showModal())
      // dialog — the custom renderer's own Escape handling lives in
      // onKeyDownShortcuts above instead.
      openController.requestClose(e, { isCancel: true });
    },
    children,
  });

  // Outside-click handling: the real backdrop element (both renderers now
  // — see this file's top comment) receives it directly, identically
  // either way — no target/coordinate check needed against dialogEl at
  // all, since the backdrop is a fully separate element that only ever
  // receives a click when it genuinely lands outside the dialog's own box
  // (dialogEl, being visually on top, absorbs anything over its own area
  // first).
  if (isModal) {
    // isModal: promotes it to the top layer (showPopover()/hidePopover(),
    // see openEffect above) — same mechanism Popover's own via-attribute
    // backdrop uses. layer="local" stays a plain sibling div, no
    // attribute at all (native [popover] semantics don't apply to it).
    backdropProps.popover = "manual";
  }

  backdropProps.onMouseDown = (mouseDownEvent) => {
    if (mouseDownEvent.button !== 0) {
      return;
    }
    if (pointerInteractionOutsideEffect === "close") {
      openController.requestClose(mouseDownEvent, { isCancel: true });
    }
    // "capture"/"none" both just absorb the click without closing — see
    // this hook's own destructuring comment for why the two collapse to
    // the same behavior for Dialog.
  };

  return [backdropProps, contentProps];
};

const DIALOG_PSEUDO_CLASSES = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":focus-within",
];

// Lets consumers pass animationDuration="0.5s" as a regular prop; Box maps
// it to the CSS var for us (see box.jsx's styleCSSVars handling).
const DIALOG_STYLE_CSS_VARS = {
  animationDuration: "--popup-animation-duration",
  maxWidth: "--dialog-max-width",
  maxHeight: "--dialog-max-height",
};

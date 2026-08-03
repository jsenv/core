/**
 * A dialog is centered in the viewport by default, with no anchor to grow
 * out of or slide in from — `animation={true}`/`"auto"` resolves through
 * Popover's own no-real-anchor path (see popover.jsx's own top comment).
 * `positionArea` accepts the same grammar Popover does (see
 * popup_shared.js), even though several combinations land identically here
 * since Dialog is never really anchored — kept distinct anyway because
 * `positionArea` still picks which animation direction plays. `anchor` only
 * ever affects the `--anchor-width`/`--anchor-height` CSS vars (sizing the
 * dialog relative to whatever opened it) — Dialog's own positioning is never
 * relative to it, unlike Popover.
 *
 * Two rendering strategies, picked via `layer`: `DialogAsModal` (a real
 * `<dialog>`, `showModal()`, top layer — native focus trap,
 * `Escape`-to-cancel, hardware/gesture back-button dismissal, all for free)
 * and `DialogLocal` (also a real `<dialog>`, shown via the non-modal
 * `.show()` instead so it stays in normal document flow — `position:
 * absolute` relative to its own positioned ancestor, clipped by it, same
 * motivation as Popover's own `PopoverCustom`).
 *
 * `.show()` gives up everything `showModal()` gets for free, which
 * `DialogLocal` reimplements itself: a focus trap (scoped to its own
 * positioned ancestor, not `document`) and `Escape`-to-close (`.show()`
 * dialogs don't fire "cancel" on Escape the way a modal one does).
 * **Deliberately NOT reimplemented: hardware/gesture back-button
 * dismissal** — no public web API hooks into that outside the browser's own
 * native modal-dismissal stack, which only a genuine `showModal()` element
 * participates in. An accepted, intentional limitation of `layer="local"`,
 * not an oversight.
 *
 * `DialogAsModal`'s own backdrop is the native `::backdrop` pseudo-element,
 * not a real rendered element — simpler than the alternative turned out to
 * be: a `showModal()`-shown `<dialog>` makes the rest of the document
 * genuinely non-interactive while open, so a real backdrop `<div
 * popover="manual">` never actually received a `mousedown` at all (tried
 * and reverted). Outside-click detection is instead a plain
 * `document`-level `mousedown` listener, coordinate-based against
 * `dialogEl`'s own rect rather than target-based (a backdrop click doesn't
 * reliably fire `dialogEl`'s own `mousedown` either).
 *
 * `DialogLocal` wraps its dialog element in a `.navi_dialog_clip_wrapper`
 * (mirrors Popover's own `.navi_popover_clip_wrapper`) purely to absorb
 * overflow growth from a translate/scale entrance transition before it
 * reaches the real container.
 */

import {
  applyNewPosition,
  createPubSub,
  getElementSignature,
  getPositionedParent,
  parsePositionArea,
  pickPositionRelativeTo,
  snapToPixel,
  trapFocusInside,
  trapScrollInside,
  visibleRectEffect,
} from "@jsenv/dom";
import { useContext, useEffect, useRef } from "preact/hooks";

import {
  ControlgroupChildrenWrapper,
  useControlgroupProps,
} from "../control_hooks.jsx";
import { dispatchRequestAction } from "../rules/control_action.js";
import {
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "../ui_state_dom.js";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { Box } from "../../box/box.jsx";
import { resolveSpacingSize } from "../../box/box_style_util.js";
import { coarsePointerSignal } from "../../layout/responsive.js";
import { createOnKeyDownForShortcuts } from "../../keyboard/keyboard_shortcuts.js";
import { useDebugFocus, useDebugPopup } from "../../navi_debug.jsx";
import {
  useOpenController,
  useOpenPropsEffectOnOpenController,
} from "./open_controller.js";
import { popupCss } from "./popup_css.js";
import { SlideShowContext } from "./slideshow.jsx";
import {
  armPointerDownOutsideClose,
  resolveAutoAnimationKind,
  resolveDirectionValue,
  suppressPointerEventsDuringTransition,
} from "./popup_shared.js";

// Same need popover.jsx has for its own local renderer (see its
// openLocalPopoverCount): a layer="local" dialog is a plain positioned element
// in normal flow, so it gets none of the top layer's free "last shown wins" and
// would paint under anything declared after it. A live count, not an
// ever-growing counter, so the order stays small and resets once nothing is
// open.
let openLocalDialogCount = 0;

const css = /* css */ `
  @layer navi {
    .navi_dialog {
      /* Min gap between the dialog and the edges of its container. Written
         from the marginWithContainer prop (see below) — hence --x-, not a knob
         to set from CSS — so the size caps here and the placement can never
         disagree. The literal is only what a dialog painted before that ever
         runs falls back to. Not named "margin" because it isn't implemented
         with margins (those are needed for centering).

         Capping the *size* here rather than only offsetting the position is
         what makes a centered dialog follow the mobile virtual keyboard for
         free: --navi-vvw/--navi-vvh track the visual viewport, so the browser
         reflows the dialog itself as the keyboard opens. */
      --x-dialog-viewport-spacing: 3vvw;

      --dialog-maxmax-width: calc(
        var(--navi-vvw) - 2 * var(--x-dialog-viewport-spacing)
      );
      --dialog-maxmax-height: calc(
        var(--navi-vvh) - 2 * var(--x-dialog-viewport-spacing)
      );

      --dialog-border-radius: var(--navi-popup-border-radius);
      --dialog-border-width: 0px; /* Dialog do not need border like popover (they stand out more) */
      --dialog-outline-width: var(--navi-focus-outline-width);
      --dialog-outline-offset: calc(-1 * var(--dialog-outline-width) / 2);
      --dialog-outline-color: var(--navi-focus-outline-color);
      --dialog-box-shadow: var(--navi-popup-box-shadow);
      --dialog-background-color: var(--navi-popup-background-color);
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
    /* Otherwise-invisible itself, but sits between the dialog and its real
       positioned ancestor — a consumer styling border-radius: inherit on
       the dialog itself (e.g. side_panel.jsx) would otherwise inherit this
       wrapper's own (unset) radius instead of the real ancestor's. */
    border-radius: inherit;
    pointer-events: none;
    overflow: hidden;

    .navi_dialog {
      pointer-events: auto;
    }
  }

  .navi_dialog {
    /* Computed once, reused by both max-width itself and min-width's own
       clamp below (see its comment for why) — avoids repeating the same
       min(..., ...) expression twice. */
    --x-dialog-max-width: min(
      var(--dialog-max-width, var(--dialog-maxmax-width)),
      var(--container-position-remaining-width, var(--dialog-maxmax-width)),
      var(--dialog-maxmax-width)
    );
    --x-dialog-max-height: min(
      var(--dialog-max-height, var(--dialog-maxmax-height)),
      var(--container-position-remaining-height, var(--dialog-maxmax-height)),
      var(--dialog-maxmax-height)
    );

    /* Base default: also the custom renderer's own permanent value — its
       containing block is genuinely its nearest positioned ancestor,
       regardless of positionArea. See the [data-layer="top"] rule below for
       why the via-attribute renderer overrides this. Position is always
       JS-driven (pickPositionRelativeTo sets top/left directly, see
       useDialogProps below) — no CSS alignment/inset math here at all,
       unlike an earlier version of this file. */
    position: absolute;
    inset: unset;
    /* Custom renderer only — see openLocalDialogCount above */
    z-index: calc(var(--navi-popup-z-index) + var(--dialog-stack-order, 0));
    min-width: min(
      max(var(--anchor-width, 0px), var(--dialog-min-width, 0px)),
      var(--x-dialog-max-width)
    );
    max-width: var(--x-dialog-max-width);
    min-height: min(
      max(var(--anchor-height, 0px), var(--dialog-min-height, 0px)),
      var(--x-dialog-max-height)
    );
    max-height: var(--x-dialog-max-height);
    margin: 0;

    /* The UA gives <dialog> a padding of its own (1em in Chrome). A popup is a
       surface, not a box with an opinion about its content — Popover has none
       either, and what is inside declares its own spacing. */
    padding: 0;
    flex-direction: column;

    background-color: var(--dialog-background-color);
    border-width: var(--dialog-border-width);
    border-style: solid;
    border-color: var(--dialog-border-color);
    border-radius: var(--dialog-border-radius);
    outline-width: var(--dialog-outline-width);
    outline-color: var(--dialog-outline-color);
    outline-offset: 0;
    box-shadow: var(--dialog-box-shadow);
    /* Its place in the slideshow it takes part in (see slideshow.jsx): every
       member steps back by the same amount when a new one arrives, which is
       what keeps the gap between two of them from drifting. The transition is
       declared here rather than under an attribute, so a member that is not
       animated at all still travels. */
    /* Doubled attribute to outrank the member's own animation rules
       (popup_css.js), which also write translate: while it is in a slideshow,
       the slideshow says where it stands. Its animation keeps everything else —
       a "scaling" first page still scales, it just does not move itself. */
    &[data-slideshow][data-slideshow] {
      translate: 0 var(--slideshow-offset, 0px);
      /* display and overlay ride along (allow-discrete below): a slide leaving
         must stay on screen for the length of its travel, and hiding it the
         moment it is closed would cut the movement short. */
      /* Everything that has to move here, and why, in one list: the slide
         itself (translate), whatever animation the member plays on top of it
         (opacity/scale/box-shadow — a first page still fades or scales in),
         and display/overlay so a slide leaving stays on screen for the length
         of its travel. Replacing this list by translate alone is what stopped
         the open/close effect from playing at all. */
      transition-property:
        translate, opacity, scale, box-shadow, display, overlay;
      /* The slideshow's own duration, not the dialog's: what moves here is the
         slideshow, and one movement has one speed. */
      /* One duration per property, in the same order: the travel belongs to
         the slideshow, the rest to the member's own animation. */
      transition-duration:
        var(--slideshow-duration, var(--popup-animation-duration)),
        var(--popup-opacity-duration), var(--popup-scale-duration),
        var(--popup-animation-duration), var(--popup-animation-duration),
        var(--popup-animation-duration);
      transition-timing-function: ease;
      transition-behavior: allow-discrete;

      /* Placed, not moved — see slideshow.jsx's add(): a slide arriving is put
         one slot away before it is allowed to travel. */
      &[data-slideshow-instant] {
        transition-property: none;
      }

      /* Stepped back, or on its way out: it is no longer the page being
         answered, so it must not catch what is aimed at the one in front — nor
         make the user wait for the end of a travel to click. */
      &[data-slideshow-displaced] {
        pointer-events: none;
      }
    }

    /* The clamped max, not --dialog-maxmax-*: that one is the viewport minus
       the spacing, which is only the real ceiling for layer="top". A local
       dialog is confined to its positioned ancestor, whose size reaches here
       through --container-position-remaining-* (see applyNewPosition) — the
       min() in --x-dialog-max-* is what accounts for both. */
    &[data-expand-x] {
      width: var(--x-dialog-max-width);
    }
    &[data-expand-y] {
      height: var(--x-dialog-max-height);
    }

    /* Square off the corners that land on the container's own corners — see
       the flushEdges computation in useDialogProps for when that happens */
    &[data-flush-top][data-flush-left] {
      border-top-left-radius: 0;
    }
    &[data-flush-top][data-flush-right] {
      border-top-right-radius: 0;
    }
    &[data-flush-bottom][data-flush-right] {
      border-bottom-right-radius: 0;
    }
    &[data-flush-bottom][data-flush-left] {
      border-bottom-left-radius: 0;
    }
    /* left/top are NOT transitioned here — applyNewPosition (visible_rect.js)
       drives that itself via the Web Animations API instead of CSS, so it
       stays independent from navi-animation's own opacity/scale/display
       transition list below (no shared transition-property to clobber, no
       propertyName to filter). */

    &::backdrop {
      background: var(--navi-backdrop-close-background);
    }
    &[data-pointer-interaction-outside="capture"]::backdrop {
      background: var(--navi-backdrop-capture-background);
      backdrop-filter: var(--navi-backdrop-capture-backdrop-filter);
    }

    /* Nested under &[navi-animation] (not the other way around) so every
       attribute selector compiles *before* ::backdrop, not after — a
       pseudo-element can't be qualified by an attribute of its own
       (::backdrop[navi-animation] would never match anything), only by an
       attribute of the *originating* element it's generated for. */
    &[navi-animation] {
      &::backdrop {
        opacity: 1;
        transition-property: display, overlay, opacity;
        transition-duration: var(--popup-animation-duration, 0.18s);
        transition-timing-function: ease;
        transition-behavior: allow-discrete;

        @starting-style {
          opacity: 0;
        }
      }
      &[aria-expanded="false"]::backdrop {
        opacity: 0;
      }
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

    /* overflow is not declared here: the dialog carries [data-scrollable] (see
       box.jsx), which is what makes it scroll — and what a header/footer/body
       inside it then rearranges. A modal dialog would get overflow:auto from
       the UA stylesheet anyway; a local one is not modal and gets nothing, so
       without a scrolling rule its max-height would only decide how big the box
       looks while the content kept painting straight through it. */

    /* [open] above is already scoped (display only turns on while shown),
       but that alone isn't enough: a consumer whose own CSS also sets an
       *unconditional* display (e.g. Popup's own flex prop, needed so
       SidePanel + List can share a bounded height — see side_panel.jsx)
       still competes for the same property while dialogEl is closed, and
       CSS origin rules mean *any* author rule — including that unrelated
       one — beats the UA stylesheet's own dialog:not([open]) default
       regardless of specificity. [navi-hidden] (see useDialogProps'
       contentProps, toggled in openEffect/close below) is the real,
       load-bearing hide mechanism whenever that happens; harmless/
       redundant the rest of the time. */
    &[navi-hidden] {
      display: none !important;
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
    --popup-animation-duration: 0.18s;

    position: absolute;
    inset: 0;
    border: none;
    /* Always clickable while actually rendered (display: none while
       genuinely closed already makes it non-interactive on its own) — an
       outside click should close the dialog even while it's still
       animating in, not just once the entrance transition settles. Only
       the content itself (.navi_dialog, via suppressPointerEventsDuringTransition
       in openEffect) gets pointer-events: none mid-transition. */
    pointer-events: auto;

    /* A plain div, unlike dialogEl itself (a real <dialog>, natively hidden
       by default until .show()/.showModal() adds [open]) — needs its own
       starting-hidden mechanism. [navi-hidden] is set from useDialogProps'
       own backdropProps (recomputed from openController.opened on every
       render, present from the very first one), then toggled by plain
       removeAttribute/setAttribute in openEffect/close, never an explicit
       display override — removing the attribute just lets this rule stop
       matching, so whatever display the box would otherwise have applies
       on its own. */
    &[navi-hidden] {
      display: none;
    }

    /* Makes pointerInteractionOutsideEffect have a visible impact on backdrop */
    &[data-pointer-interaction-outside="close"],
    &[data-pointer-interaction-outside="cancel"] {
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

  ${popupCss}
`;

/**
 * A dialog box — modal by default (real `<dialog>` + `showModal()`, browser
 * top layer), or confined to a local container via `layer="local"`. See
 * this file's own top comment for the full architecture (positionArea
 * grammar, anchor's sizing-only role, backdrop mechanics).
 *
 * @param {object} props
 * @param {"top"|"local"} [props.layer="top"] - `"top"`: `showModal()`'d
 *   into the browser's own top layer (native focus trap, `Escape`-to-cancel,
 *   hardware back-button dismissal, rest-of-document made inert). `"local"`:
 *   shown via the non-modal `.show()` instead, staying in normal document
 *   flow inside its own positioned ancestor — confined to (and clipped by)
 *   that container instead of the whole viewport.
 * @param {boolean} [props.dockedOnTouch] - Turns the dialog into a bottom sheet
 *   (docked flush to the bottom edge, full width) when the pointer is coarse,
 *   and leaves it alone otherwise. For a dialog meant to be interacted with
 *   rather than merely read: under a finger the keyboard owns the bottom of
 *   the screen and a centered box ends up both cramped and out of thumb
 *   reach, while under a mouse the centered box is already the right shape —
 *   hence a prop that only ever does something on touch. It supplies defaults
 *   for `positionArea`, `marginWithContainer` and `expandX`, so any of the
 *   three can still be pinned explicitly. Keyed off `(pointer: coarse)` (the
 *   input device, not a width breakpoint — a narrow desktop window is still a
 *   mouse) via `coarsePointerSignal`, so it re-resolves live.
 * @param {string} [props.positionArea="center"] - Where to dock the dialog
 *   within its container (the viewport for `layer="top"`, the positioned
 *   ancestor for `layer="local"`) — Dialog is never anchored to a real
 *   element for positioning purposes. Same grammar as `Popover`'s own
 *   `positionArea` (see `popup_shared.js`'s `parsePositionArea`): a single
 *   compass token — `top`/`top-start`/`top-end`/`top-left`/`top-right`,
 *   `right`/`right-start`/`right-end`, `bottom`/`bottom-start`/
 *   `bottom-end`/`bottom-left`/`bottom-right`, `left`/`left-start`/
 *   `left-end`, or `center` — optionally wrapped in `inset(...)` (e.g.
 *   `inset(top)`) for the overlapping variant.
 * @param {boolean} [props.expand] - Shorthand for both `expandX` and `expandY`.
 * @param {boolean} [props.expandX] - Stretches the dialog to the full width its
 *   container allows (`--dialog-maxmax-width`). Set by `dockedOnTouch` on a
 *   touch device.
 * @param {boolean} [props.expandY] - Same, vertically
 *   (`--dialog-maxmax-height`).
 * @param {string|number} [props.marginWithContainer="3vvw"] - Minimum gap kept
 *   between the dialog and the edges of its container, whatever its
 *   `positionArea`: it both caps the dialog's own size (via
 *   `--x-dialog-viewport-spacing`, written from this prop) and offsets a docked
 *   one from the edge it docks to. Accepts a spacing token ("s", "m"…), a
 *   number of pixels, or a viewport length — "vvw"/"vvh" being the visual
 *   viewport, which shrinks when the mobile keyboard opens. Pass 0 for a dialog
 *   meant to sit flush (a side panel).
 * @param {"close"|"cancel"|"capture"|"none"} [props.pointerInteractionOutsideEffect="close"]
 *   - `"close"` closes the dialog on an outside click. `"capture"`/`"none"`
 *   both just absorb the click without closing (visually dimmed backdrop vs.
 *   not) — a dialog is always modal one way or another, so there's always
 *   at least a click-absorbing backdrop regardless of this prop.
 * @param {boolean} [props.scrollCapture] - Traps scroll gestures inside the
 *   dialog so the page/container behind it can't scroll while it's open.
 * @param {boolean|"auto"|"fading"|"scaling"|"sliding"|`slide-from-${string}`} [props.animation]
 *   - `true`/`"auto"` resolves to `"scaling"` for a centered `positionArea`,
 *   or a concrete `"slide-from-*"` direction otherwise. Any other explicit
 *   value is used as-is.
 * @param {string} [props.animationDuration] - Maps to
 *   `--popup-animation-duration`.
 * @param {Element|{current: Element}|string} [props.anchor] - Only ever sizes
 *   the dialog via the `--anchor-width`/`--anchor-height` CSS vars — never
 *   used for positioning (see this file's top comment). Defaults to whatever
 *   triggered the open (`e.detail.anchor`), if any. A string is resolved via
 *   `document.getElementById` when the dialog opens — see popover.jsx's own
 *   `anchor` doc for why (mainly `defaultOpen`).
 * @param {string} [props.minWidth] - Maps to `--dialog-min-width`; clamped
 *   so it can never push the dialog past `--dialog-maxmax-width` (the
 *   viewport/container-spacing ceiling) regardless of how large a value is
 *   passed.
 * @param {string} [props.maxWidth] - Maps to `--dialog-max-width`.
 * @param {string} [props.minHeight] - Maps to `--dialog-min-height`, same
 *   clamping as `minWidth`.
 * @param {string} [props.maxHeight] - Maps to `--dialog-max-height`.
 * @param {number} [props.tabIndex=-1] - Set on the dialog element itself so
 *   `autoFocus="fallback"` below has somewhere to land when the dialog has
 *   no other focusable descendant of its own.
 * @param {boolean|"fallback"|"restore"} [props.autoFocus="fallback"] - See
 *   `focus_transfer.js` — `"fallback"` focuses the dialog itself if it has
 *   no other focusable descendant, `"restore"` keeps it out of the opening
 *   focus chain unless it held focus when the dialog closed.
 * @param {boolean} [props.open] - Controlled open state.
 * @param {boolean} [props.defaultOpen] - Uncontrolled, mount-only initial
 *   open state — plays no entrance animation (nothing was ever shown as
 *   "closed" for the user to see it transition away from).
 * @param {(event: Event) => void} [props.onClose] - Called when the dialog
 *   actually closes — not preventable (see `open_controller.js`'s own
 *   `onRequestClose`/`onClose` distinction; `onRequestClose` is where you'd
 *   veto a close instead).
 * @param {object} [props.openController] - Advanced: an externally-owned
 *   open controller (see `open_controller.js`) for a caller that wants to
 *   drive open/close itself instead of `open`/`defaultOpen`/`onClose` (used
 *   by `picker_custom.jsx`).
 * @param {import("preact").ComponentChildren} props.children
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
  const debugPopup = useDebugPopup();
  // Resolved here rather than left to useDialogProps: the open handler below
  // needs the dialog element to read what it holds.
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  // Same shape as picker_custom's own controller, for the same reason: what the
  // dialog held when it opened is what a close is compared against, and what a
  // cancel puts back — so it lives in the closure of one opening.
  const openController = useOpenController((openEvent) => {
    const dialogEl = props.ref.current;
    const uiStateAtOpen = getUIStateFromElement(dialogEl);
    debugPopup(openEvent, `dialog opened, store value at open`, uiStateAtOpen);

    return {
      onRequestClose: (requestCloseEvent) => {
        if (requestCloseEvent.detail.isCancel) {
          // Giving up is always allowed — nothing to validate, nothing to
          // commit.
          return;
        }
        // Closing IS committing, so a close that cannot commit must not
        // happen: the failing constraint reports itself and the dialog stays
        // open, with the form still in front of the user.
        const unchanged = compareTwoJsValues(
          getUIStateFromElement(dialogEl),
          uiStateAtOpen,
        );
        dispatchRequestAction(dialogEl, {
          event: requestCloseEvent,
          name: "dialog request close",
          // action: null when nothing was touched — the constraints are still
          // checked (an empty required field must report even if the user
          // typed nothing at all), but there is no answer to commit.
          action: unchanged ? null : "auto",
          // Reported even when the dialog has no action of its own: what the
          // user needs to see is the constraint, not whether someone listens.
          reportOnInvalid: true,
          onInvalid: () => {
            requestCloseEvent.preventDefault();
          },
        });
      },
      onClose: (closeEvent) => {
        if (closeEvent.detail.isCancel) {
          // A cancelled dialog leaves no trace: what was typed goes back to
          // what it opened on.
          dispatchRequestSetUIState(dialogEl, uiStateAtOpen, {
            event: closeEvent,
          });
        }
        props.onClose?.(closeEvent);
      },
    };
  });
  useOpenPropsEffectOnOpenController(openController, props);

  return (
    <ControlledDialog
      {...props}
      open={undefined}
      defaultOpen={undefined}
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
 * contentProps]` — `backdropProps` is `null` for the via-attribute renderer
 * (its own backdrop is native, not a real element).
 */
// What a dialog turns into under a finger. "bottom" is not a taste: it puts
// the dialog in the zone a handheld device is actually operated from — where
// the thumbs rest and where the virtual keyboard comes up — instead of the
// middle of the screen, which is the farthest point from both.
// Only defaults: an explicitly passed prop still wins, so the docked shape can
// be adjusted one axis at a time instead of being all-or-nothing.
const DOCKED = {
  positionArea: "bottom",
  marginWithContainer: 0,
  expandX: true,
};

// Only the keys actually present, never the whole props object: everything a
// dialog takes that a control group knows nothing about (openController,
// positionArea, animation…) would otherwise come back out as the group's
// leftover props and land on the element as stray attributes. Copied key by key
// rather than spread with undefined defaults because the group reads presence,
// not value — an always-there `value: undefined` reads as "controlled with no
// handler" and makes the whole popup read-only.
const CONTROL_GROUP_PROP_NAMES = [
  "name",
  "action",
  "uiAction",
  "value",
  "defaultValue",
  "required",
  "readOnly",
  "disabled",
];
const pickControlGroupProps = (props) => {
  const controlGroupProps = { ref: props.ref, id: props.id };
  for (const name of CONTROL_GROUP_PROP_NAMES) {
    if (Object.hasOwn(props, name)) {
      controlGroupProps[name] = props[name];
    }
  }
  return controlGroupProps;
};

const useDialogProps = (props) => {
  const backdropProps = {};
  const contentProps = {};
  // Resolved before the group hook below rather than with the rest of the
  // props: the group needs the dialog's own element to hang its state and its
  // events on, and that is this ref.
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  // A dialog holds controls, so it IS one: it aggregates whatever named
  // controls it contains into a single object and owns their joint state,
  // exactly like a ControlGroup. That is also what makes it a form boundary —
  // ControlgroupChildrenWrapper below resets the field contexts, so what is
  // inside a dialog belongs to the dialog, not to the form around it.
  // A curated object, not `props`: everything a dialog takes that a control
  // group knows nothing about (openController, positionArea, animation…) would
  // otherwise come back out as the group's leftover props and land on the
  // element as stray attributes — which is exactly how navi-autofocus got
  // overwritten and `opencontroller="[object Object]"` appeared on it.
  const [groupRootProps, groupProps, groupChildrenProps] = useControlgroupProps(
    pickControlGroupProps(props),
    {
      controlType: "dialog",
      // "object" by default — a popup holds a form and hands back named values.
      // "single" for a popup that IS one value (a picker's list): see
      // GROUP_DEFAULTS in ui_state_controller.js.
      stateType: props.stateType || "object",
      allowCapture: true,
      wantRequesterButtonState: true,
      cascadeValidationToChildren: true,
    },
  );
  const {
    openController,
    // "top" (default) → real <dialog>, showModal(), the browser's own top
    // layer. "local" → also a real <dialog>, but shown via the non-modal
    // .show() instead, staying in normal document flow, position: absolute
    // relative to its own positioned ancestor. See this file's top comment.
    layer = "top",
    dockedOnTouch,

    // Same grammar as Popover's own positionArea — see this file's top
    // comment and popup_shared.js's parsePositionArea.
    positionArea: positionAreaProp,
    // A dialog docked against an edge must keep the same gap its own size cap
    // already guarantees a centered one — so this drives both (see
    // --x-dialog-viewport-spacing above). Pass 0 to sit flush (side_panel.jsx).
    marginWithContainer: marginWithContainerProp,
    expand,
    expandX: expandXProp,
    expandY: expandYProp,
    // "close" (default) closes on an outside click. "capture"/"none" both
    // just absorb it without closing — for the via-attribute renderer,
    // showModal() already makes the rest of the page inert, so there's
    // nothing for a click to reach either way; for the custom renderer,
    // there's no native inert-ing, so the real backdrop below is what
    // actually makes "capture"/"none" behave the same way here too.
    pointerInteractionOutsideEffect = "close",
    scrollCapture,
    animation,
    // Only ever affects --anchor-width/--anchor-height (see this file's top
    // comment) — Dialog's own positioning is never relative to it.
    anchor,
    // Makes the dialog itself a valid focus target so autoFocus="fallback"
    // below has somewhere to land when it contains nothing focusable of its
    // own — -1 keeps it out of the normal Tab order (it's only ever reached
    // programmatically). <dialog> has no default tabindex of its own.
    tabIndex = -1,
    // See use_auto_focus.js's own docs for why this must never reach the DOM
    // as a plain `autofocus` attribute — useAutoFocus below takes over
    // instead, so it's read here rather than left in `rest`.
    autoFocus = "fallback",
    onKeyDown,
    children,
    ...rest
  } = props;
  const isModal = layer === "top";
  // Taking part in a slideshow is declared by being inside one (see
  // slideshow.jsx): the dialogs of one slideshow move as one, each stepping
  // back a slot when the next arrives. They stay separate dialogs — each keeps
  // its own state, its own validation and its own way out; only the arithmetic
  // is shared, and none of them knows about the others.
  const slideshow = useContext(SlideShowContext);
  const ref = props.ref;
  // Only touch changes anything: with a mouse a dialog already wants to be the
  // centered box it is by default, so there is nothing to resolve there.
  const isDocked = dockedOnTouch && coarsePointerSignal.value;
  const positionArea =
    positionAreaProp ?? (isDocked ? DOCKED.positionArea : "center");
  const marginWithContainer =
    marginWithContainerProp ??
    (isDocked
      ? DOCKED.marginWithContainer
      : // A share of whatever holds the dialog: the viewport for a top-layer
        // one — where vvw is exactly "3% of the container", the container being
        // the viewport — and the positioned ancestor for a local one, where
        // reading 3% of the viewport gives an absurd gap inside a small box.
        isModal
        ? "3vvw"
        : "3cqw");
  // "expand || expandX", the shorthand semantics Popup used to apply before
  // handing them over — the docked default only applies when neither was said
  const expandXUnset = expand === undefined && expandXProp === undefined;
  const expandX = expandXUnset
    ? isDocked && DOCKED.expandX
    : Boolean(expand) || Boolean(expandXProp);
  const expandY = Boolean(expand) || Boolean(expandYProp);
  const backdropRef = useRef();
  // Disarms a still-pending backdrop hide from a previous close (see
  // armPointerDownOutsideClose below) — same pattern as popover.jsx's own.
  const disarmBackdropHideRef = useRef(null);
  const debugPopup = useDebugPopup();
  const debugFocus = useDebugFocus();
  const autoFocusProps = useAutoFocus(ref, autoFocus);
  // positionDialog lives in openEffect's closure — created once, when the
  // dialog opens. Reading the placement props through a ref instead of that
  // closure is what lets a change while open take effect on the spot (see the
  // reposition effect below) rather than only on the next opening.
  const positionPropsRef = useRef(null);
  positionPropsRef.current = { positionArea, marginWithContainer };
  const repositionRef = useRef(null);
  useEffect(() => {
    repositionRef.current?.(
      new CustomEvent("position_props_change", { detail: {} }),
    );
  }, [positionArea, marginWithContainer]);
  const positionAreaParseResult = parsePositionArea(positionArea);
  if (!positionAreaParseResult) {
    console.warn(`Dialog: invalid positionArea="${positionArea}"`);
  }
  const parsedPositionArea = positionAreaParseResult ?? {
    y: "center",
    x: "center",
  };
  // A corner sitting exactly on the container's own corner must not be
  // rounded: the gap a radius carves out would show the container through it,
  // reading as a rendering glitch rather than as a rounded box. A corner is on
  // the container's corner when both of its edges are — which only happens
  // with no margin, hence the gate.
  const flushEdges = { top: false, right: false, bottom: false, left: false };
  if (resolveSpacingSize(marginWithContainer) === 0) {
    const { y, x } = parsedPositionArea;
    flushEdges.top = expandY || y === "top" || y === "inset-top";
    flushEdges.bottom = expandY || y === "bottom" || y === "inset-bottom";
    flushEdges.left = expandX || x === "left" || x === "inset-left";
    flushEdges.right = expandX || x === "right" || x === "inset-right";
  }

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

  // Sync the DOM open and return how to sync it back closed, fresh on every
  // render so it closes over the latest props (scrollLock, etc.). The
  // controller (owned by the caller, or by UncontrolledDialog) decides
  // *when* this runs. openEffect runs outside of render (triggered by
  // openController.open()), so it cannot call hooks — cleanup is a plain
  // pub/sub.
  openController.openEffect = (e) => {
    const dialogEl = ref.current;
    const backdropEl = backdropRef.current;
    // What the dialog held when it opened: the answer to compare against when
    // it closes (nothing changed → nothing to commit) and the state to put
    // back when it is cancelled — a cancelled dialog must leave no trace, the
    // same way a cancelled picker restores the value it was opened on.
    if (!dialogEl) {
      return undefined;
    }

    // Set by useOpenControllerByProps for the very first open triggered by
    // `open`/`defaultOpen` already being truthy at mount — see popover.jsx's
    // own openEffect for the full reasoning, mirrored here identically.
    const silent = Boolean(e.detail.silent);

    // document.documentElement — the shared "no real container, use the
    // viewport" sentinel (see offset_parent.js) — not just
    // getPositionedParent(dialogEl) unconditionally: that walks starting
    // from dialogEl.parentElement, which for DialogLocal is the
    // .navi_dialog_clip_wrapper (itself position: absolute) rather than the
    // real, meaningful ancestor beyond it.
    const positionedAncestor = isModal
      ? document.documentElement
      : getPositionedParent(
          dialogEl.parentElement /* dialogEl is inside the clip_wrapper */,
        );

    const [cleanup, addCleanup] = createPubSub(true);
    let anchorElement;
    if (typeof anchor === "string") {
      // Resolved at open time (not render time) via getElementById — mainly
      // for defaultOpen, where there's no triggering event/ref yet to read a
      // real element from, only an id known up front. See popover.jsx's own
      // anchor handling for the full reasoning, mirrored here identically.
      anchorElement = document.getElementById(anchor);
      if (!anchorElement) {
        console.warn(`Dialog: anchor="${anchor}" did not match any element`);
      }
    } else if (anchor) {
      // anchor prop is a ref or a DOM element
      anchorElement = anchor.current ?? anchor;
    } else if (e.detail.anchor) {
      // e.g. the button that triggered a --navi-toggle/--navi-open command,
      // already resolved from detail.anchor/detail.source by the caller
      // (see UncontrolledDialog's onnavi_request_open).
      anchorElement = e.detail.anchor;
    }
    debugPopup(`"${e.type}" on ${getElementSignature(e.target)} -> openDialog`);
    if (!isModal) {
      // see openLocalDialogCount's own comment
      dialogEl.style.setProperty(
        "--dialog-stack-order",
        openLocalDialogCount++,
      );
    }
    if (anchorElement) {
      const { width, height } = anchorElement.getBoundingClientRect();
      dialogEl.style.setProperty("--anchor-width", `${snapToPixel(width)}px`);
      dialogEl.style.setProperty("--anchor-height", `${snapToPixel(height)}px`);
    } else {
      dialogEl.style.removeProperty("--anchor-width");
      dialogEl.style.removeProperty("--anchor-height");
    }
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
      backdropEl.removeAttribute("navi-hidden");
      backdropEl.getBoundingClientRect();
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
    // Regardless of isModal — see the backdrop's own [navi-hidden] CSS rule
    // and popover.jsx's identical reasoning: showModal()/show() alone only
    // wins over a stray, still-present [navi-hidden] { display: none }
    // default when nothing else authored also sets display on dialogEl —
    // a consumer combining layer="top" with another authored display
    // property (e.g. Popup's own flex prop) defeats the UA stylesheet's own
    // dialog:not([open]) default the same way it can for Popover.
    dialogEl.removeAttribute("navi-hidden");
    if (slideshow) {
      // Here, not at the top of this effect: the dialog is displayed only from
      // this line on, and a transition needs a start value the browser has
      // actually seen. Placed one slot away while it was display:none, it would
      // simply appear at its final place.
      // Its own gap with the container, given to the slideshow: two pages of
      // one movement keep the same distance from the edges as they keep from
      // each other, and nobody has to repeat the number.
      const travelled = slideshow.add(dialogEl, {
        gap:
          resolveContainerLength(marginWithContainer, positionedAncestor) ??
          resolveSpacingSize(marginWithContainer),
      });
      if (travelled) {
        // The slideshow moves it, so it must not also move itself: two rules
        // setting translate on the same element can only fight. A first page
        // does not travel and keeps its own animation.
        dialogEl.removeAttribute("navi-animation");
      }
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
    // custom renderer. applyNewPosition sets --container-position-remaining-height/-width
    // from the result, same as popover.jsx.
    const positionDialog = (triggerEvent) => {
      const { positionArea, marginWithContainer } = positionPropsRef.current;
      let marginWithContainerInPixels = resolveContainerLength(
        marginWithContainer,
        positionedAncestor,
      );
      if (marginWithContainerInPixels === null) {
        marginWithContainerInPixels = resolveSpacingSize(marginWithContainer);
      }
      if (typeof marginWithContainerInPixels !== "number") {
        // A value only CSS could evaluate (a spacing token resolving to a var(),
        // a percentage…) — the placement below needs a real number, and letting
        // it through would put the dialog at NaN.
        console.warn(
          `Dialog: marginWithContainer="${marginWithContainer}" cannot be resolved to pixels. Use a number, a viewport length ("3vvw", "2vvh") or a container length ("3cqw", "2cqh").`,
        );
        marginWithContainerInPixels = 0;
      }
      // The size caps read the same gap in CSS as the placement below applies
      // in pixels, so a docked dialog and a centered one keep the same
      // distance from the edges. Written resolved (not as the raw prop) so a
      // spacing token stays valid inside the caps' own calc().
      dialogEl.style.setProperty(
        "--x-dialog-viewport-spacing",
        `${marginWithContainerInPixels}px`,
      );
      const pickOptions = {
        positionArea,
        container: positionedAncestor,
        marginWithContainer: marginWithContainerInPixels,
        event: triggerEvent,
      };
      let position = pickPositionRelativeTo(dialogEl, null, pickOptions);
      applyNewPosition(dialogEl, position);
      // applyNewPosition above just set --container-position-remaining-
      // width/height to the real available space — narrower than whatever
      // dialogEl measured at just before (nothing, on a first open — see
      // popover.jsx's own identical comment on its own positionPopover for
      // the full reasoning, mirrored here). If that changes dialogEl's own
      // rendered box (its content rewraps once truly constrained), the
      // position picked above was computed against the wrong (wider,
      // shorter) box and needs a synchronous second pass, or it paints one
      // frame too high/low before the ResizeObserver watching this same
      // element (rectEffect.observeSize below) ever gets a chance to
      // correct it — that one only reacts on the *next* animation frame.
      if (
        dialogEl.offsetWidth !== position.width ||
        dialogEl.offsetHeight !== position.height
      ) {
        position = pickPositionRelativeTo(dialogEl, null, pickOptions);
        applyNewPosition(dialogEl, position);
      }
      // A descendant's own visibleRectEffect (visible_rect.js — e.g. a
      // Callout anchored to something inside this Dialog) knowing to
      // recheck its own position whenever this dialog itself moves is
      // handled generically by applyNewPosition itself (dispatches
      // navi_position_change on every call) — nothing to do here.
    };
    positionDialog();

    // Reposition on the same triggers Popover's own visibleRectEffect
    // already reacts to generically — window resize/scroll/visual-viewport
    // changes for layer="top"/isModal (positionedAncestor is already
    // document.documentElement there, see its own computation above;
    // visibleRectEffect already debounces visualViewport resize by 100ms
    // to avoid the mobile tap-to-tap-input keyboard flicker, so no
    // separate mechanism is needed here for that), or the positioned
    // ancestor's own resize for layer="local" — see this file's top
    // comment.
    const rectEffect = visibleRectEffect(
      positionedAncestor,
      (visibleRect, { event }) => {
        positionDialog(event);
      },
      { event: e, skipElementResize: true },
    );
    rectEffect.observeSize(dialogEl);
    // Exposed for the placement-props effect below, which needs to re-place an
    // already-open dialog.
    repositionRef.current = (repositionEvent) => {
      // data-position-*-current pins an open dialog to the side it first
      // resolved to, so a resize never makes it jump (pickPositionRelativeTo
      // reads it back and prefers it over the requested area). A new placement
      // request is precisely the case where that memory must not win.
      dialogEl.removeAttribute("data-position-x-current");
      dialogEl.removeAttribute("data-position-y-current");
      positionDialog(repositionEvent);
    };
    addCleanup(() => {
      repositionRef.current = null;
      rectEffect.disconnect();
    });
    // A descendant anchored to something inside this dialog (a Callout, a
    // nested Popover) needing to know about this dialog's own left/top
    // repositioning transition — not just that the target changed
    // (navi_position_change above), but that a real, currently-playing
    // transition is moving it right now — is handled generically by
    // applyNewPosition itself (see its own notifyPositionTransition), since
    // positionDialog already goes through it above; nothing to wire up
    // here.

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

    // isModal outside-click detection (see this file's top comment for why
    // this is a plain document-level listener rather than anything
    // dialogEl/its native ::backdrop dispatches on their own) — active for
    // the dialog's entire open lifetime, not just mid-transition.
    if (
      isModal &&
      (pointerInteractionOutsideEffect === "close" ||
        pointerInteractionOutsideEffect === "cancel")
    ) {
      const onDocumentMouseDown = (mouseDownEvent) => {
        if (mouseDownEvent.button !== 0) {
          return;
        }
        // The click landed inside another popup: that is a click on what is in
        // front of this dialog, not outside it. Asking the target where it
        // lives rather than asking this dialog whether it was pushed — a popup
        // in front does not have to be one this dialog knows about. Excludes a
        // popup nested inside this one, which the containment check below
        // handles as the inside click it is.
        const popupUnderPointer = mouseDownEvent.target.closest?.(
          `[navi-control="dialog"], [navi-control="popover"]`,
        );
        if (
          popupUnderPointer &&
          popupUnderPointer !== dialogEl &&
          !dialogEl.contains(popupUnderPointer)
        ) {
          return;
        }
        // Real DOM containment wins over the coordinate check below — an
        // element genuinely inside the dialog (e.g. one with `overflow:
        // visible`, a negative margin, or an absolutely-positioned child)
        // can be visually painted outside dialogEl's own bounding rect, and
        // a click there must not count as "outside" just because its
        // coordinates fall outside that rect. Excludes dialogEl itself
        // though (contains() is true for the element itself, not just real
        // descendants) — a genuine backdrop click reports target === dialogEl
        // (there's no real ::backdrop node to be the target), so treating
        // that case as "contained" would make the coordinate check below
        // (the actual backdrop-vs-dialog-padding distinction) never run.
        if (
          mouseDownEvent.target !== dialogEl &&
          dialogEl.contains(mouseDownEvent.target)
        ) {
          return;
        }
        const rect = dialogEl.getBoundingClientRect();
        const isOutside =
          mouseDownEvent.clientX < rect.left ||
          mouseDownEvent.clientX > rect.right ||
          mouseDownEvent.clientY < rect.top ||
          mouseDownEvent.clientY > rect.bottom;
        if (!isOutside) {
          return;
        }
        openController.requestClose(mouseDownEvent, {
          isCancel: pointerInteractionOutsideEffect === "cancel",
        });
      };
      document.addEventListener("mousedown", onDocumentMouseDown, {
        capture: true,
      });
      addCleanup(() => {
        document.removeEventListener("mousedown", onDocumentMouseDown, {
          capture: true,
        });
      });
    }

    return (closeEvent) => {
      debugPopup(
        `"${closeEvent.type}" on ${getElementSignature(closeEvent.target)} -> closeDialog`,
      );
      if (slideshow) {
        slideshow.remove(dialogEl);
      }
      dialogEl.setAttribute("aria-expanded", "false");
      if (!isModal) {
        openLocalDialogCount = Math.max(0, openLocalDialogCount - 1);
        dialogEl.style.removeProperty("--dialog-stack-order");
      }
      // See openEffect's own identical comment for why this is needed
      // regardless of isModal, not just when a stray authored display
      // property is actually present — harmless the rest of the time.
      dialogEl.setAttribute("navi-hidden", "");
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
            backdropEl.setAttribute("navi-hidden", "");
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
  // most fields are shared: renderer-specific bits (the outside-click
  // handler below, in particular) are just assigned onto whichever of the
  // two actually owns that concern for a given renderer, instead of one
  // object's own field branching internally on isModal. backdropProps only
  // gets returned (see the bottom of this function) when !isModal — the
  // via-attribute renderer's own backdrop is native (::backdrop), not a
  // real element we render ourselves.
  Object.assign(backdropProps, {
    "ref": backdropRef,
    "baseClassName": "navi_dialog_backdrop",
    "aria-hidden": "true",
    // Recomputed fresh on every render from openController.opened (not
    // driven through a mount-time layout effect, unlike this file's own
    // imperative open/close toggling below) — present in the DOM
    // synchronously from the very first commit, matching this file's own
    // CSS (&[aria-expanded="false"]) which is genuinely rendering-eligible,
    // and matching what a descendant relying on
    // use_displayed_layout_effect.js's own aria-expanded-presence check
    // needs — see popover.jsx's own identical prop for the full reasoning.
    "aria-expanded": openController.opened ? "true" : "false",
    // Present from this very first render (recomputed fresh on every one
    // from openController.opened, not a frozen mount-time constant) so
    // there's no gap for the browser to ever paint this plain-div backdrop
    // visible before anything has actually opened it — see popover.jsx's
    // own identical prop for the full reasoning, and this file's own CSS
    // for the rule it drives.
    "navi-hidden": openController.opened ? undefined : "",
    "styleCSSVars": DIALOG_STYLE_CSS_VARS,
    "animationDuration": rest.animationDuration,
    "data-pointer-interaction-outside": pointerInteractionOutsideEffect,
  });
  Object.assign(contentProps, {
    tabIndex,
    // See backdropProps' own identical prop above for the full reasoning
    // (kept once, not repeated here).
    "aria-expanded": openController.opened ? "true" : "false",
    // Present from the very first render (recomputed fresh from
    // openController.opened every time, not a frozen mount-time constant —
    // see popover.jsx's own identical prop for the full reasoning) so a
    // consumer whose own CSS also sets display (e.g. Popup's flex prop)
    // can't silently defeat showModal()/close()'s native open/close — see
    // this file's own CSS rule for dialogEl and the open/close steps below
    // for how it's toggled.
    "navi-hidden": openController.opened ? undefined : "",
    // Unlike Popover (which genuinely can't resolve "auto" until it
    // measures against a real anchor), resolvedAnimation is already fully
    // known synchronously here — a dialog never needs to flip anything
    // after measuring (see this file's top comment) — so there's no reason
    // to withhold the attribute for the auto case the way Popover has to.
    "navi-animation": resolvedAnimation,
    // Only meaningful for the via-attribute renderer's own native
    // ::backdrop (see this file's CSS for the "capture" glass effect) — a
    // pseudo-element can't carry its own attributes, so this has to live on
    // the originating .navi_dialog element instead, same reasoning as
    // navi-animation above. Harmless for the custom renderer too (its own
    // real backdrop element already gets the same attribute via
    // backdropProps above, which is what its own CSS actually keys off).
    "data-pointer-interaction-outside": pointerInteractionOutsideEffect,
    "styleCSSVars": DIALOG_STYLE_CSS_VARS,
    ...rest,
    // Right after ...rest, not last: what makes the dialog a control (its name,
    // its state, its action, and the onnavi_command/onnavi_request_interaction
    // pair this hook used to declare by hand) — but everything the dialog sets
    // for itself below still wins over it.
    ...groupRootProps,
    ...groupProps,
    // The control-group props are consumed by the hook above, never forwarded:
    // on a <dialog> element they would only render as stray attributes
    // (value="[object Object]" and friends).
    "value": undefined,
    "defaultValue": undefined,
    "stateType": undefined,
    "action": undefined,
    "uiAction": undefined,
    ...autoFocusProps,
    "as": "dialog",
    ref,
    "baseClassName": "navi_dialog",
    "pseudoClasses": DIALOG_PSEUDO_CLASSES,
    // Distinguishes the two renderers for the CSS above (position: fixed
    // vs. absolute) — positioning itself is entirely JS-driven now (see
    // openEffect's own positionDialog above), no data-position-area
    // attribute needed at all.
    // A popup scrolls, and asking Box for that overflow is also what lets what
    // it contains claim header/footer/body (see box.jsx) — a popup is always a
    // scrolling area, so it says so once, here.
    "overflow": "auto",
    "data-slideshow": slideshow ? "" : undefined,
    "data-layer": layer,
    "data-expand-x": expandX ? "" : undefined,
    "data-expand-y": expandY ? "" : undefined,
    "data-flush-top": flushEdges.top ? "" : undefined,
    "data-flush-right": flushEdges.right ? "" : undefined,
    "data-flush-bottom": flushEdges.bottom ? "" : undefined,
    "data-flush-left": flushEdges.left ? "" : undefined,
    "onKeyDown": (e) => {
      onKeyDown?.(e);
      onKeyDownShortcuts(e);
    },
    "onCancel": (e) => {
      // Native "cancel" (Escape) only ever fires for a modal (showModal())
      // dialog — the custom renderer's own Escape handling lives in
      // onKeyDownShortcuts above instead.
      openController.requestClose(e, { isCancel: true });
    },
    "children": (
      <ControlgroupChildrenWrapper {...groupChildrenProps} name={undefined}>
        {children}
      </ControlgroupChildrenWrapper>
    ),
  });

  // Outside-click handling for layer="local" only — the via-attribute
  // renderer's own is a plain document-level listener instead, set up in
  // openEffect above (see this file's top comment for why: neither a real
  // backdrop element nor dialogEl's own mousedown reliably fires for a
  // native ::backdrop click).
  if (!isModal) {
    backdropProps.onMouseDown = (mouseDownEvent) => {
      if (mouseDownEvent.button !== 0) {
        return;
      }
      // See the custom renderer's own onDocumentMouseDown: a click inside
      // another popup is a click on what is in front, not an outside click.
      const dialogEl = ref.current;
      const popupUnderPointer = mouseDownEvent.target.closest?.(
        `[navi-control="dialog"], [navi-control="popover"]`,
      );
      if (
        popupUnderPointer &&
        popupUnderPointer !== dialogEl &&
        !dialogEl?.contains(popupUnderPointer)
      ) {
        return;
      }
      if (
        pointerInteractionOutsideEffect === "close" ||
        pointerInteractionOutsideEffect === "cancel"
      ) {
        openController.requestClose(mouseDownEvent, {
          isCancel: pointerInteractionOutsideEffect === "cancel",
        });
      }
      // "capture"/"none" both just absorb the click without closing — see
      // this hook's own destructuring comment for why the two collapse to
      // the same behavior for Dialog.
    };
  }

  return [isModal ? null : backdropProps, contentProps];
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
// "3cqw"/"2cqh" — a share of the container the dialog is confined to, the way
// vvw/vvh are a share of the viewport. Written by hand rather than left to CSS
// because the placement below needs a number, and a container query unit means
// nothing to getComputedStyle here.
const CONTAINER_LENGTH_REGEX = /^(-?[0-9.]+)cq([wh])$/;
const resolveContainerLength = (value, container) => {
  if (typeof value !== "string") {
    return null;
  }
  const match = CONTAINER_LENGTH_REGEX.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, amount, axis] = match;
  const size = container
    ? axis === "w"
      ? container.clientWidth
      : container.clientHeight
    : axis === "w"
      ? window.innerWidth
      : window.innerHeight;
  return (parseFloat(amount) / 100) * size;
};

const DIALOG_STYLE_CSS_VARS = {
  animationDuration: "--popup-animation-duration",
  minWidth: "--dialog-min-width",
  maxWidth: "--dialog-max-width",
  minHeight: "--dialog-min-height",
  maxHeight: "--dialog-max-height",
};

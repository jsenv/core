/**
 * A dialog is a surface, not a control: it holds no value, has no action and
 * aggregates nothing. Fields and a submit go in a `<Form>` inside it, exactly
 * as they would in the document — the form owns the answer, and the dialog owns
 * where it is shown. What the two say to each other is small and goes one way:
 * the form says it is finished (`--navi-close`, see resolveAfterSend in
 * commands.js) and the dialog closes; the dialog, before letting a close
 * through, asks what it contains whether anything is mid-action and refuses if
 * so (see findBusyElementInside below).
 *
 * A dialog is centered in the viewport by default, with no anchor to grow
 * out of or slide in from — `animation={true}`/`"auto"` resolves through
 * Popover's own no-real-anchor path (see popover.jsx's own top comment).
 * `positionArea` accepts the same grammar Popover does (see
 * popup_shared.js), even though several combinations land identically here
 * since Dialog is never really anchored — kept distinct anyway because
 * `positionArea` still picks which animation direction plays. `anchor` is
 * inert here unless `sizeFromAnchor` asks for it: a dialog is a surface of
 * its own, sized by its content, not a panel grown out of the control that
 * opened it — that is Popover's job. With `sizeFromAnchor`, the anchor's box
 * reaches the `--anchor-width`/`--anchor-height` CSS vars and becomes a
 * min-width/min-height floor. Either way Dialog's own positioning is never
 * relative to the anchor, unlike Popover.
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
import { useEffect, useRef } from "preact/hooks";

import { onNaviCommand } from "../control/commands.js";
import { dispatchRequestInteraction } from "../control/rules/control_interaction.js";
import { BUSY_CONSTRAINT } from "../control/rules/interaction/busy_constraint.js";
import { useAutoFocus } from "@jsenv/navi/src/utils/focus/use_auto_focus.js";
import { Box } from "../box/box.jsx";
import { resolveSpacingSize } from "../box/box_style_util.js";
import { smallTouchScreenSignal } from "./responsive.js";
import { createOnKeyDownForShortcuts } from "../keyboard/keyboard_shortcuts.js";
import { useDebugFocus, useDebugPopup } from "../navi_debug.jsx";
import {
  useOpenController,
  useOpenPropsEffectOnOpenController,
} from "./open_controller.js";
import { usePopupContentMount } from "./popup_content_mount.js";
import { popupCss } from "./popup_css.js";
import { surfaceTextCss } from "./surface_text_css.js";
import { freezeSize, unfreezeSize } from "./freeze_size.js";
import { createSwipeToClose, SWIPE_AXIS_BY_SIDE } from "./swipe_to_close.js";
import {
  armPointerDownOutsideClose,
  keepFocusedElementVisible,
  mayHaveHiddenFocus,
  resolveAutoAnimationKind,
  resolveDirectionValue,
  suppressPointerEventsDuringTransition,
} from "./popup_shared.js";
import { PopupClose } from "./popup_close.jsx";

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
         with margins (those are needed for centering), and not "viewport"
         because the container is only the viewport for a top-layer dialog —
         a local one answers to the box it was declared in (see below).

         Capping the *size* here rather than only offsetting the position is
         what makes a centered dialog follow the mobile virtual keyboard for
         free: --navi-app-width/--navi-app-height track the visual viewport, so
         the browser reflows the dialog itself as the keyboard opens.

         A share of the app's own screen, not of the window (hence
         --navi-app-width rather than 3vvw): the gap must read as a small
         margin around the dialog, and 3% of a 1500px window is a 45px gap
         around a 600px app. Identical to 3vvw until the app declares
         --navi-app-max-width. */
      --x-dialog-container-spacing: calc(0.03 * var(--navi-app-width));

      /* --navi-app-width, not --navi-vvw: a top-layer dialog is calibrated on
         the app's own screen, which is the viewport unless the app declared a
         narrower one (see navi_css_vars.js). An app-width cap alone never
         costs the gap below — it is subtracted from whichever of the two ends
         up smaller. */
      --dialog-maxmax-width: calc(
        var(--navi-app-width) - 2 * var(--x-dialog-container-spacing)
      );
      --dialog-maxmax-height: calc(
        var(--navi-app-height) - 2 * var(--x-dialog-container-spacing)
      );

      --dialog-border-radius: var(--navi-popup-border-radius);
      --dialog-border-width: 0px; /* Dialog do not need border like popover (they stand out more) */
      --dialog-outline-width: var(--navi-focus-outline-width);
      --dialog-outline-offset: calc(-0.5 * var(--dialog-outline-width));
      --dialog-outline-color: var(--navi-focus-outline-color);
      --dialog-box-shadow: var(--navi-popup-box-shadow);
      --dialog-background-color: var(--navi-popup-background-color);

      /* A local dialog is not confined by the viewport but by the box it was
         declared in — its own containing block, since it is positioned inside
         it. So the ceiling is written in percentages of THAT box and the
         browser resolves it, rather than in viewport units that would mean
         something else entirely inside a small container. The gap follows the
         same reading: 3% of what holds it, not 3% of the screen.

         This is the pre-JS reading; the placement then writes the same gap
         back in pixels (see positionDialog), so the caps and the placement
         cannot say two different things. */
      &[data-layer="local"] {
        --x-dialog-container-spacing: 3%;

        --dialog-maxmax-width: calc(
          100% - 2 * var(--x-dialog-container-spacing)
        );
        --dialog-maxmax-height: calc(
          100% - 2 * var(--x-dialog-container-spacing)
        );
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
    /* A popup renders inside its opener's own subtree, so a corner claimed from
       the outside (see group.jsx) would otherwise reach the controls in here.
       It stops at the popup: what a popup holds is never at a seam of the group
       its opener belongs to. */
    --x-corner-top-left-radius: initial;
    --x-corner-top-right-radius: initial;
    --x-corner-bottom-right-radius: initial;
    --x-corner-bottom-left-radius: initial;

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
       JS-driven (pickPositionRelativeTo, see useDialogProps below) — no CSS
       alignment/inset math here at all. */
    position: absolute;
    /* Laid out at its containing block's own origin and moved from there by a
       translate (applyNewPosition), never by left/top: a shrink-to-fit box
       placed with left is only ever as wide as what is left of the container
       to its right, and that width is what decides where it gets placed — see
       applyNewPosition's own doc. right/bottom stay auto: an inset there would
       over-constrain the box against the UA's margin: auto and re-center
       it. */
    inset: 0 auto auto 0;
    /* Custom renderer only — see openLocalDialogCount above */
    z-index: calc(var(--navi-z-index-popup) + var(--dialog-stack-order, 0));
    min-width: min(
      max(var(--anchor-width, 0px), var(--dialog-min-width, 0px)),
      var(--x-dialog-max-width)
    );
    max-width: var(--x-dialog-max-width);
    /* The UA gives <dialog> height: fit-content. A percentage height inside
       it (Box's expandY fallback, height: 100%) is meant to read as auto
       against that indefinite size, and does — except in WebKit since
       iOS 26.5, which resolves it to 0 and then wraps the sheet around a 0px
       child: the dialog opens with no height at all. auto is the same size
       (min/max-height still bound it) minus the keyword iOS trips on. */
    height: auto;
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

    /* A new surface writes in its own ink, not in its container's — see
       --navi-popup-color. Declared here rather than left to the UA's own
       dialog { color: CanvasText } so the ink is themed along with the paper. */
    color: var(--navi-popup-color);
    background-color: var(--dialog-background-color);
    border-width: var(--dialog-border-width);
    border-style: solid;
    border-color: var(--dialog-border-color);
    border-radius: var(--dialog-border-radius);
    outline-width: var(--dialog-outline-width);
    outline-color: var(--dialog-outline-color);
    outline-offset: 0;
    box-shadow: var(--dialog-box-shadow);

    /* A gesture landing on the dialog belongs to the dialog: what it cannot
       scroll (a short body, an axis with nowhere to go) must not travel to
       whatever is behind. */
    overscroll-behavior: none;

    /* Docking answers a different question than --dialog-max-width: a sheet
       spans its container's full width, flush against the two side edges —
       that shape IS the mode — while the caller's ceiling was an answer about
       the *centered* box ("do not sprawl on a wide window"). Applying it here
       turns the sheet into a small floating box that no longer touches the
       edges it was docked to, so it is dropped out of the clamp entirely; the
       container ceiling still holds. --dialog-min-width needs no such rule:
       the floor is below the full width a docked dialog takes, so it stops
       mattering on its own. Height is untouched — a sheet is content-tall, not
       container-tall (expandY cancels docking outright), so --dialog-max-height
       still means what it meant. */
    &[data-docked] {
      --x-dialog-max-width: min(
        var(--container-position-remaining-width, var(--dialog-maxmax-width)),
        var(--dialog-maxmax-width)
      );
      /* The sheet rests on the screen's bottom edge, which on a phone is the
         home indicator and, since iOS 26, Safari's own floating bar — a band
         the browser does not paint fixed content into. The surface still
         reaches the edge (the sheet comes out from behind the bar); what it
         holds stops above it. */
      padding-bottom: env(safe-area-inset-bottom, 0px);
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
    /* The placement is a translate, so the translate property is spoken for
       here (see applyNewPosition in visible_rect.js, which owns it and animates
       it itself through the Web Animations API rather than through this file's
       transitions — no shared transition-property to clobber, no propertyName
       to filter). An entrance animation moves the dialog through scale and
       transform instead, which compose under it: see popup_css.js. */

    &::backdrop {
      background: var(--navi-backdrop-close-background);
    }
    &[data-pointer-interaction-outside="capture"]::backdrop {
      background: var(--navi-backdrop-capture-background);
      backdrop-filter: var(--navi-backdrop-capture-backdrop-filter);
    }

    /* backdropVariant, keyed off the originating element (a
       pseudo-element carries no attributes of its own — same reasoning as
       the capture rule just above). After the rules it overrides: same
       specificity, so order is what decides. showModal() still makes the
       page inert either way — only the paint goes away. */
    &[data-backdrop-variant="discrete"]::backdrop {
      background: var(--navi-backdrop-discrete-background);
      backdrop-filter: none;
    }
    &[data-backdrop-variant="invisible"]::backdrop {
      background: transparent;
      backdrop-filter: none;
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

    &[data-focus-visible],
    /* …or something filling it holds the keyboard and offers its ring to
       whoever holds it (data-focus-outline-delegate — a slide container says
       this, see slide_container.jsx). Its own ring would land on the very edge
       this dialog already outlines, one pixel in, so the dialog draws it
       instead. Direct children only: a delegate deeper in has its own box to
       ring, and this edge is not it. */
    &:has(> [data-focus-outline-delegate][data-focus-visible]) {
      outline-style: solid;
    }
    /* What a sheet that closes by being pushed back down is held by is a
       handle, not a piece of the scroll: a finger on it moves the sheet, and
       letting the browser scroll the sheet under the same gesture would show
       two movements answering one drag. The same parts swipe_to_close.js takes
       hold of, said again here because CSS is the only place it can be said
       before the finger lands. */
    &[data-swipe-to-close] [data-header],
    &[data-swipe-to-close] [data-swipe-grip] {
      touch-action: none;
    }

    /* …and the delegate stands down. */
    > [data-focus-outline-delegate] {
      --navi-focus-outline-style: none;
    }

    &[open] {
      display: flex;
    }

    /* Via-attribute renderer only — promoted to the top layer, so its
       containing block is the viewport rather than any positioned
       ancestor. Not left to the native :modal UA stylesheet's own default
       (also position: fixed, but with its own margin/inset assumptions) so
       that the JS-driven placement (see useDialogProps below) always wins
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

    /* Same override as the via-attribute renderer's own ::backdrop rules
       above, on the real element this renderer uses instead — see them for
       the specificity/ordering reasoning. */
    &[data-backdrop-variant="discrete"] {
      background: var(--navi-backdrop-discrete-background);
      backdrop-filter: none;
    }
    &[data-backdrop-variant="invisible"] {
      background: transparent;
      backdrop-filter: none;
    }

    /* overlay is a no-op here (this backdrop is a plain div, never a
       top-layer element) but stays in the list so all four transition lists in
       these files agree — display and overlay always travel together. */
    &[navi-animation] {
      opacity: 1;
      transition-property: display, overlay, opacity;
      transition-duration: var(--popup-animation-duration);
      transition-timing-function: ease;
      transition-behavior: allow-discrete;

      &[aria-expanded="false"] {
        opacity: 0;
      }
    }
  }

  ${surfaceTextCss}
  ${popupCss}
`;

/**
 * A dialog box — modal by default (real `<dialog>` + `showModal()`, browser
 * top layer), or confined to a local container via `layer="local"`. A surface
 * only: put a `<Form>` inside it for anything with fields and a submit. See
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
 * @param {boolean} [props.dockedOnSmallTouchScreen] - Turns the dialog into a
 *   bottom sheet (docked flush to the bottom edge, full width) on a small touch
 *   screen, and leaves it alone otherwise. For a dialog meant to be interacted
 *   with rather than merely read: on a phone the keyboard owns the bottom of
 *   the screen and a centered box ends up both cramped and out of thumb reach,
 *   while under a mouse the centered box is already the right shape. Both
 *   halves of the name matter (`smallTouchScreenSignal`): touch alone would
 *   dock a big touch screen — a tablet, a kiosk panel — a whole screen away
 *   from where the finger just tapped, and size alone would dock a narrow
 *   desktop window, which is still a mouse. It supplies defaults for
 *   `positionArea`, `marginWithContainer`, `expandX` and `scrollCapture`, so
 *   any of them can still be pinned explicitly — including `expandX={false}`,
 *   which opts the docked dialog out of the full-width stretch and leaves it a
 *   floating box at the bottom. It also withdraws `maxWidth` while docked: a
 *   sheet is container-wide by definition, and a `maxWidth` is an answer about
 *   the *centered* shape, so the two can be stated together (`maxWidth="16rem"
 *   dockedOnSmallTouchScreen`) and each applies where it means something.
 *   `minWidth` needs no such rule — its floor is below the full width — and
 *   `maxHeight`/`minHeight` keep applying, a sheet being content-tall.
 *   Ignored entirely when `expandY`
 *   (or `expand`) is set: a dialog already filling the height is on the bottom
 *   edge docking would bring it to, so docking could only take away the shape
 *   the caller asked for. Re-resolves live as the pointer
 *   type or the window size changes. A sheet resting on the bottom edge is also
 *   pushed back down to close it, held by its header (a `Box` with the `header`
 *   prop) and by anything else carrying `data-swipe-grip`. The rest of the sheet
 *   is left to what it holds, so a board something is dragged across keeps its
 *   own gestures. See `swipe_to_close.js`.
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
 *   container allows (`--dialog-maxmax-width`). Set by
 *   `dockedOnSmallTouchScreen` on a small touch screen — so passing `false`
 *   here also opts out of *that* stretch, leaving a docked dialog a floating
 *   box instead of a flush sheet. To keep the sheet flush and merely cap the
 *   centered shape, use `maxWidth`: docking withdraws it on its own.
 * @param {boolean} [props.expandY] - Same, vertically
 *   (`--dialog-maxmax-height`). Cancels `dockedOnSmallTouchScreen`.
 * @param {string|number} [props.marginWithContainer="3appw"] - Minimum gap kept
 *   between the dialog and the edges of its container, whatever its
 *   `positionArea`: it both caps the dialog's own size (via
 *   `--x-dialog-container-spacing`, written from this prop) and offsets a docked
 *   one from the edge it docks to. Accepts a spacing token ("s", "m"…), a
 *   number of pixels, or a viewport length — "appw"/"apph" being the app's own
 *   screen (the visual viewport, or the narrower one the app declared with
 *   --navi-app-max-width) and "vvw"/"vvh" the visual viewport itself, which
 *   shrinks when the mobile keyboard opens. Pass 0 for a dialog
 *   meant to sit flush (a side panel).
 * @param {"close"|"cancel"|"capture"|"none"} [props.pointerInteractionOutsideEffect="close"]
 *   - `"close"` closes the dialog on an outside click. `"capture"`/`"none"`
 *   both just absorb the click without closing (visually dimmed backdrop vs.
 *   not) — a dialog is always modal one way or another, so there's always
 *   at least a click-absorbing backdrop regardless of this prop.
 * @param {"auto"|"discrete"|"invisible"} [props.backdropVariant="auto"] - How
 *   visible the backdrop is, independently of what it does. `"auto"`: the
 *   paint `pointerInteractionOutsideEffect` implies (dimmed for
 *   `"close"`/`"cancel"`, blurred glass for `"capture"`). `"discrete"`: a
 *   barely-there dim. `"invisible"`: fully transparent. The dialog stays modal
 *   either way — this only changes how much it insists visually, never what
 *   an outside click does or whether the page behind stays reachable.
 * @param {boolean} [props.scrollCapture] - Traps scroll gestures inside the
 *   dialog so the page/container behind it can't scroll while it's open.
 *   A `layer="local"` dialog always locks its own positioned ancestor's
 *   scroll while open (its backdrop only covers the scrollport, so scrolling
 *   there would reveal uncovered content); this prop extends the lock to the
 *   whole page. Defaults to `true` for a dialog docked by `dockedOnSmallTouchScreen`.
 * @param {boolean|"auto"|"fading"|"scaling"|"sliding"|`slide-from-${string}`} [props.animation]
 *   - `true`/`"auto"` resolves to `"scaling"` for a centered `positionArea`,
 *   or a concrete `"slide-from-*"` direction otherwise. Any other explicit
 *   value is used as-is.
 * @param {string} [props.animationDuration] - Maps to
 *   `--popup-animation-duration`.
 * @param {Element|{current: Element}|string} [props.anchor] - Never used for
 *   positioning (see this file's top comment), and ignored entirely unless
 *   `sizeFromAnchor` is set — then it sizes the dialog via the
 *   `--anchor-width`/`--anchor-height` CSS vars. Defaults to whatever
 *   triggered the open (`e.detail.anchor`), if any. A string is resolved via
 *   `document.getElementById` when the dialog opens — see popover.jsx's own
 *   `anchor` doc for why (mainly `defaultOpen`).
 * @param {boolean} [props.sizeFromAnchor=false] - Whether the dialog takes the
 *   anchor's width/height as a min-width/min-height floor
 *   (`--anchor-width`/`--anchor-height`). Off by default: unlike a popover,
 *   a dialog is not attached to what opened it, so following that element's
 *   box is a deliberate choice (a picker-style surface meant to read as the
 *   trigger's own continuation), not the norm.
 * @param {"override"|"ignore"} [props.anchorCustomEventDetail="override"] -
 *   Whether an explicit `anchor` prop takes precedence over (`"override"`,
 *   default) or is ignored in favor of (`"ignore"`) whatever anchor the
 *   triggering event carried. Same prop as Popover's, applied to the only
 *   thing an anchor can do here: sizing, and only under `sizeFromAnchor`.
 * @param {string} [props.minWidth] - Maps to `--dialog-min-width`; clamped
 *   so it can never push the dialog past `--dialog-maxmax-width` (the
 *   viewport/container-spacing ceiling) regardless of how large a value is
 *   passed.
 * @param {string} [props.maxWidth] - Maps to `--dialog-max-width`. Describes
 *   the centered shape only: a dialog docked by `dockedOnSmallTouchScreen`
 *   ignores it and stays container-wide.
 * @param {string} [props.minHeight] - Maps to `--dialog-min-height`, same
 *   clamping as `minWidth`.
 * @param {string} [props.maxHeight] - Maps to `--dialog-max-height`.
 * @param {"auto"|"frozen"} [props.sizing="auto"] - `"auto"`: the dialog follows
 *   its content for as long as it stays open. `"frozen"`: it is measured once
 *   and held at that size until it closes — what no longer fits (or no longer
 *   fills it) is the scroll's business. For a surface acted upon while it is
 *   open: marking a notification as read, emptying a queue, swapping between
 *   two slides of different heights — the row being aimed at must not move
 *   under the finger. The measure is taken at the first render where this says
 *   `"frozen"`, so a dialog opening on skeletons can say
 *   `sizing={loading ? "auto" : "frozen"}` and be measured once the real
 *   content is there. The freeze writes a `height`/`width`, never a `min-*`:
 *   `maxHeight`/`maxWidth` and the container ceiling keep winning, so a frozen
 *   dialog still fits when the phone is turned. Closing releases it — the next
 *   opening measures again.
 * @param {number} [props.tabIndex=-1] - Set on the dialog element itself so
 *   `autoFocus="last-resort"` below has somewhere to land when the dialog has
 *   no other focusable descendant of its own.
 * @param {boolean|"last-resort"|"restore"} [props.autoFocus="last-resort"] -
 *   Where the keyboard goes when this dialog opens — one rung of the ladder in
 *   `docs/autofocus.md`, which is what to read for the whole of it.
 *   - `true` — the dialog element itself takes the keyboard, whatever it holds.
 *     For a dialog whose content is READ before it is filled: the focus starts
 *     at the top of the reading order and no virtual keyboard rises over it.
 *   - `"last-resort"` — the dialog takes the keyboard only if it holds nothing
 *     focusable of its own.
 *   - `"restore"` — the dialog stays out of the opening focus chain unless it
 *     held focus when it closed.
 *   Wherever the keyboard is a virtual one (a touch device), the surface is
 *   already what one arrives on: a popup is read before it is reached there, so
 *   the focus only leaves it for something that asked by name (`autoFocus` on
 *   that element, which outranks whatever the dialog says).
 * @param {boolean} [props.open] - Controlled open state.
 * @param {import("@preact/signals").Signal<boolean>} [props.signal] - The open
 *   state said the way every navi control says it: the dialog opens and closes
 *   to match the signal, and writes into it whenever it opens or closes on its
 *   own (Escape, backdrop, a --navi-close command) — one binding to both drive
 *   the dialog and know where it is, and the state stays where the app put it.
 *   Excludes `open`; `onOpen`/`onClose` still fire. A signal holding `true` at
 *   mount behaves like `defaultOpen`: the dialog was already open, no entrance
 *   plays.
 * @param {boolean|"interaction"} [props.defaultOpen] - Uncontrolled, mount-only
 *   initial open state. `true` plays no entrance animation: the dialog was
 *   already open when the page appeared, and nothing was ever shown as "closed"
 *   for the user to see it transition away from. `"interaction"` says the
 *   opposite — this dialog is mounted *because* the user just asked for it, so
 *   the mount is the opening and the entrance plays like any other.
 * @param {(openEvent: CustomEvent) => void} [props.onOpen] - Called when it
 *   opens, BEFORE its content is built, positioned or shown. What it opens ON
 *   is in `openEvent.detail.value` — the value of whatever asked
 *   (`<Button value={radar.id} command="--navi-open" commandfor="…">`), or the
 *   `value` given to `triggerNaviCommand`. That order is the point: a dialog that
 *   is "new" or "edit X" depending on the press must know which one it is
 *   before what it holds is rendered.
 * @param {(event: Event) => void} [props.onClose] - Called when the dialog
 *   actually closes — not preventable (see `open_controller.js`'s own
 *   `onRequestClose`/`onClose` distinction; `onRequestClose` is where you'd
 *   veto a close instead).
 * @param {boolean|string|{id?: string, type?: "push"|"replace"}} [props.navState] -
 *   Keeps the open state in the history entry, so a screen left and come back
 *   to finds this popup as it was — open, and without an entrance playing: it
 *   was already open when the page reappeared. `true` stores it under the
 *   popup's own `id`; a string names the key instead.
 *   `{ type: "push" }` also makes the opening a history entry of its own, so
 *   the back button closes the popup rather than leaving the screen — and a
 *   cancel (Escape) goes back, taking whatever was written to the url while it
 *   was open with it. The state belongs to the entry that wrote it: a
 *   navigation that stacks a new entry does not carry it along.
 * @param {object} [props.openController] - Advanced: an externally-owned
 *   open controller (see `open_controller.js`) for a caller that wants to
 *   drive open/close itself instead of `open`/`defaultOpen`/`onClose` (used
 *   by `picker_custom.jsx`).
 * @param {boolean} [props.mountWhenClosed] - Builds `children` right away
 *   instead of waiting for the first open (see popup_content_mount.js). For
 *   content something depends on while the popup is still closed: a value read
 *   off it, fields a surrounding form collects on submit, a size measured from
 *   outside.
 * @param {boolean} [props.unmountWhenClosed] - Throws `children` away once the
 *   popup has finished closing (see popup_content_mount.js). For content whose
 *   fresh state is its initial state: an uncontrolled field seeded from a
 *   `defaultValue` that changed while the popup was closed. Ignored when
 *   `mountWhenClosed` is set.
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
  // needs the dialog element to look at what it contains.
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const openController = useOpenController((openEvent) => {
    const dialogEl = props.ref.current;
    debugPopup(openEvent, `dialog opened`);

    return {
      onRequestClose: (requestCloseEvent) => {
        // Whatever is inside must not be interrupted mid-action: a form that is
        // sending holds an answer that is neither committed nor given up. The
        // dialog has no such state of its own to consult (it is layout — see
        // this file's top comment), so it asks what it contains, and lets that
        // control report why the way it would to anyone else.
        const busyElement = findBusyElementInside(dialogEl);
        if (busyElement) {
          dispatchRequestInteraction(busyElement, {
            event: requestCloseEvent,
            name: "dialog request close",
          });
          requestCloseEvent.preventDefault();
        }
      },
      onClose: (closeEvent) => {
        props.onClose?.(closeEvent);
      },
    };
  });
  useOpenPropsEffectOnOpenController(openController, props);

  return (
    <ControlledDialog
      {...props}
      open={undefined}
      signal={undefined}
      defaultOpen={undefined}
      navState={undefined}
      onClose={undefined}
      openController={openController}
      onnavi_request_open={(e) => {
        openController.open(e, {
          anchor: e.detail?.anchor ?? e.detail?.source,
          // What the command was about — a `<Button value={id}>` that opened
          // this popup ON that id. Handed to `onOpen` before anything is
          // built (see open_controller.js).
          value: e.detail?.value,
        });
      }}
      onnavi_request_close={(e) => {
        const closing = openController.requestClose(e, {
          isCancel: e.detail?.isCancel,
          requester: e.detail?.source,
        });
        if (!closing) {
          // Said back to whoever asked: --navi-close:all stops climbing here.
          e.preventDefault();
        }
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
      <div
        className="navi_dialog_clip_wrapper"
        // Out of flow like the dialog it holds — see the dialog's own
        // contentProps for what reads the marker.
        // eslint-disable-next-line react/no-unknown-property
        navi-out-of-flow=""
      >
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
// What a dialog turns into on a small touch screen. "bottom" is not a taste:
// it puts the dialog in the zone a phone is actually operated from — where the
// thumbs rest and where the virtual keyboard comes up — instead of the middle
// of the screen, which is the farthest point from both.
// Only defaults: an explicitly passed prop still wins, so the docked shape can
// be adjusted one axis at a time instead of being all-or-nothing.
const DOCKED = {
  positionArea: "bottom",
  marginWithContainer: 0,
  expandX: true,
  // A sheet resting on the bottom edge is dragged with a thumb, and a drag that
  // runs past its own edge must not land on the page behind it: the same
  // reasoning as "bottom" above, applied to the gesture instead of the shape.
  scrollCapture: true,
};

// Where a bottom sheet is held to push it back down: the strip a Box declares
// with `header`, plus anything the application marked as one more. Everything
// else in the sheet is content the finger came to operate — a board a piece is
// dragged across, a list, a map — and a press there belongs to it. A sheet with
// no header and nothing marked is not pushed down at all; it is closed by its
// own controls, by the backdrop and by Escape.
const DOCKED_SWIPE_GRIP = "[data-header],[data-swipe-grip]";

// The first control inside `dialogEl` that is mid-action, if any. Walks the
// controls rather than reading an attribute off the dialog: a dialog carries no
// state of its own (see this file's top comment), and `aria-busy` on the
// controls is a render snapshot — BUSY_CONSTRAINT reads the live answer.
const findBusyElementInside = (dialogEl) => {
  for (const element of dialogEl.querySelectorAll("[navi-control-host]")) {
    const controller = element.__uiStateController__;
    if (controller && BUSY_CONSTRAINT.check(controller)) {
      return element;
    }
  }
  return null;
};

const useDialogProps = (props) => {
  const backdropProps = {};
  const contentProps = {};
  const defaultRef = useRef();
  props.ref = props.ref || defaultRef;
  const {
    openController,
    // "top" (default) → real <dialog>, showModal(), the browser's own top
    // layer. "local" → also a real <dialog>, but shown via the non-modal
    // .show() instead, staying in normal document flow, position: absolute
    // relative to its own positioned ancestor. See this file's top comment.
    layer = "top",
    dockedOnSmallTouchScreen,

    // Same grammar as Popover's own positionArea — see this file's top
    // comment and popup_shared.js's parsePositionArea.
    positionArea: positionAreaProp,
    // A dialog docked against an edge must keep the same gap its own size cap
    // already guarantees a centered one — so this drives both (see
    // --x-dialog-container-spacing above). Pass 0 to sit flush (side_panel.jsx).
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
    // How loudly the backdrop says it is there — independent of what it
    // *does* (that's pointerInteractionOutsideEffect above). A dialog is
    // always modal, so "none" here never makes the page behind reachable:
    // it only stops the dim from being drawn.
    backdropVariant = "auto",
    scrollCapture: scrollCaptureProp,
    // "auto" (default) → the dialog follows its content. "frozen" → measured
    // once, held at that size while open. See this prop's own JSDoc above.
    sizing = "auto",
    animation,
    // Inert unless sizeFromAnchor below (see this file's top comment) —
    // Dialog's own positioning is never relative to it.
    anchor,
    // Opt-in: --anchor-width/--anchor-height are only set when this is true.
    // See this prop's own JSDoc above for why a dialog does not follow its
    // trigger's box by default.
    sizeFromAnchor = false,
    // Same meaning as Popover's own prop, applied to the only thing an anchor
    // can do here: sizing under sizeFromAnchor.
    anchorCustomEventDetail = "override",
    // Makes the dialog itself a valid focus target so
    // autoFocus="last-resort" below has somewhere to land when it contains
    // nothing focusable of its own — -1 keeps it out of the normal Tab order (it's only ever reached
    // programmatically). <dialog> has no default tabindex of its own.
    tabIndex = -1,
    // See use_auto_focus.js's own docs for why this must never reach the DOM
    // as a plain `autofocus` attribute — useAutoFocus below takes over
    // instead, so it's read here rather than left in `rest`.
    autoFocus = "last-resort",
    onKeyDown,
    // Read here (rather than left in `rest`) for two reasons: it must never
    // reach the DOM as an `onopen` attribute, and the controller — not this
    // render — is what calls it, at the one moment that makes it useful (see
    // openController.onOpen below).
    onOpen,
    children: childrenProp,
    mountWhenClosed,
    unmountWhenClosed,
    ...rest
  } = props;
  // Assigned on every render, like openEffect below, so it always closes over
  // the latest prop. Called by openController.open() before the content is
  // built: what this popup opens ON is known before anything reads it.
  openController.onOpen = onOpen || null;
  const children = usePopupContentMount(openController, props.ref, {
    children: childrenProp,
    mountWhenClosed,
    unmountWhenClosed,
  });
  const isModal = layer === "top";
  const ref = props.ref;
  const expandY = Boolean(expand) || Boolean(expandYProp);
  // Only a small touch screen changes anything: on a mouse — and on a touch
  // screen too big to reach the bottom edge of — a dialog already wants to be
  // the centered box it is by default, so there is nothing to resolve.
  // expandY cancels the docking outright: docking exists to bring the dialog
  // down to the edge the thumb is on, and a dialog already filling the height
  // is on that edge — all docking could still do is take away the shape the
  // caller asked for (and arm a swipe-down on something that never rose).
  const isDocked =
    dockedOnSmallTouchScreen && smallTouchScreenSignal.value && !expandY;
  const positionArea =
    positionAreaProp ?? (isDocked ? DOCKED.positionArea : "center");
  const marginWithContainer =
    marginWithContainerProp ??
    (isDocked
      ? DOCKED.marginWithContainer
      : // A share of whatever holds the dialog: the app's own screen for a
        // top-layer one — where appw is exactly "3% of the container", the
        // container being that screen (the viewport, unless the app declared a
        // narrower one) — and the positioned ancestor for a local one, where
        // reading 3% of the screen gives an absurd gap inside a small box.
        isModal
        ? "3appw"
        : "3cqw");
  // "expand || expandX", the shorthand semantics Popup used to apply before
  // handing them over — the docked default only applies when neither was said
  const expandXUnset = expand === undefined && expandXProp === undefined;
  const expandX = expandXUnset
    ? isDocked && DOCKED.expandX
    : Boolean(expand) || Boolean(expandXProp);
  const scrollCapture =
    scrollCaptureProp ?? (isDocked ? DOCKED.scrollCapture : false);
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
  // The freeze is taken where the value changes, not only at open time: a
  // dialog showing skeletons first says sizing="auto" until its content is
  // there, and would otherwise be held at the size of the waiting state.
  // Opening while already "frozen" is openEffect's own case.
  useEffect(() => {
    const dialogEl = ref.current;
    if (!dialogEl || !openController.opened) {
      return;
    }
    if (sizing === "frozen") {
      freezeSize(dialogEl);
    } else {
      unfreezeSize(dialogEl);
    }
  }, [sizing]);
  const positionAreaParseResult = parsePositionArea(positionArea);
  if (!positionAreaParseResult) {
    console.warn(`Dialog: invalid positionArea="${positionArea}"`);
  }
  const parsedPositionArea = positionAreaParseResult ?? {
    y: "center",
    x: "center",
  };
  // Pushing the sheet back down closes it — a bottom sheet is reached with a
  // thumb, and the thumb is already on the edge it would push. Only a sheet
  // actually resting on the bottom edge: anywhere else the gesture would send
  // the dialog somewhere it never came from.
  const swipeToCloseDown = isDocked && parsedPositionArea.y === "bottom";
  const onSwipePointerDown = swipeToCloseDown
    ? createSwipeToClose("bottom", { grip: DOCKED_SWIPE_GRIP })
    : null;
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
      // anchor prop is a ref or a DOM element — always a real anchor,
      // regardless of anchorCustomEventDetail.
      anchorElement = anchor.current ?? anchor;
    } else if (anchorCustomEventDetail === "override") {
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
    if (sizeFromAnchor && anchorElement) {
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
      // A modal dialog always has its own ::backdrop; the custom renderer has
      // the backdrop element when it renders one.
      addCleanup(
        trapScrollInside(dialogEl, {
          backdrop: isModal || backdropEl,
        }),
      );
    } else if (!isModal) {
      // A local dialog is confined to its positioned ancestor, and so is its
      // backdrop (inset: 0 covers the scrollport, not the scrolled content):
      // letting that ancestor scroll would slide the dialog away and reveal
      // content the backdrop does not cover. So its own container's scroll is
      // always locked — trapScrollInside also swaps the scrollbar for an
      // equivalent padding, so the width the dialog was sized against does not
      // change. The rest of the page keeps scrolling: only `scrollCapture`
      // (above) reaches that far.
      addCleanup(
        trapScrollInside(dialogEl, { boundaryElement: positionedAncestor }),
      );
    }

    // Positioning: dialogEl is already shown (display: flex, per this
    // file's own [open] CSS) by this point, so its own dimensions are real
    // — pickPositionRelativeTo's own no-anchor/docked mode (no `anchor`
    // argument at all) docks it against the viewport (layer="top"/isModal)
    // or its own positioned ancestor (layer="local", the same
    // positionedAncestor computed above), same mechanism as Popover's own
    // custom renderer. applyDialogPosition sets --container-position-remaining-height/-width
    // from the result, same as popover.jsx — except for layer="top", see its
    // own comment just above.
    // The placement is a snapshot taken on a debounce; the size caps must not
    // be one too. applyNewPosition writes --container-position-remaining-
    // height/width on every reposition, from what pickPositionRelativeTo
    // measured the container as at that instant. For layer="top" that value
    // says nothing --dialog-maxmax-height/width doesn't already say live: the
    // container IS the visual viewport and Dialog is never anchored, so the
    // "remaining" space is always the whole container net of its own margins
    // — the very definition of --dialog-maxmax-*, which tracks the visual
    // viewport through --navi-vvh/--navi-app-height without waiting for
    // anything. Identical values, one of them one debounce late.
    //
    // That lag stays invisible while the viewport SHRINKS — the two are
    // combined with min(), so the live var is the one that binds and the
    // dialog follows the mobile keyboard down, its top edge pinned. On the
    // way back up the stale pixel value is the smaller one, so it binds
    // instead and the dialog stays keyboard-sized until the debounced
    // reposition fires — which then places a still-shrunk box in a
    // full-height viewport (centered: visibly lower), grows it in the same
    // call, and has to slide it back up: the bounce. Dropping the property
    // for layer="top" leaves the live var alone in charge, so the height
    // comes back exactly the way it left, from the bottom edge.
    //
    // Kept for layer="local": there the container is a real element, its own
    // box is what the caps must read, and nothing in CSS tracks it.
    const applyDialogPosition = (position) => {
      applyNewPosition(dialogEl, position);
      if (isModal) {
        dialogEl.style.removeProperty("--container-position-remaining-height");
        dialogEl.style.removeProperty("--container-position-remaining-width");
      }
    };

    const positionDialog = (triggerEvent) => {
      const { positionArea, marginWithContainer } = positionPropsRef.current;
      // The dialog's PARENT, not the dialog: a modal one is promoted to the
      // top layer and would answer "the viewport" about itself, when what a
      // "3cqw" margin means here is a share of the box it was declared in.
      // resolveSpacingSize walks up from there to find that container.
      let marginWithContainerInPixels = resolveSpacingSize(
        marginWithContainer,
        dialogEl.parentElement,
      );
      if (typeof marginWithContainerInPixels !== "number") {
        // A value only CSS could evaluate (a spacing token resolving to a var(),
        // a percentage…) — the placement below needs a real number, and letting
        // it through would put the dialog at NaN.
        console.warn(
          `Dialog: marginWithContainer="${marginWithContainer}" cannot be resolved to pixels. Use a number, a viewport length ("3appw", "3vvw", "2vvh") or a container length ("3cqw", "2cqh").`,
        );
        marginWithContainerInPixels = 0;
      }
      // The size caps read the same gap in CSS as the placement below applies
      // in pixels, so a docked dialog and a centered one keep the same
      // distance from the edges. Written resolved (not as the raw prop) so a
      // spacing token stays valid inside the caps' own calc().
      dialogEl.style.setProperty(
        "--x-dialog-container-spacing",
        `${marginWithContainerInPixels}px`,
      );
      const pickOptions = {
        positionArea,
        container: positionedAncestor,
        marginWithContainer: marginWithContainerInPixels,
        event: triggerEvent,
      };
      let position = pickPositionRelativeTo(dialogEl, null, pickOptions);
      applyDialogPosition(position);
      // applyDialogPosition above just set --container-position-remaining-
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
        applyDialogPosition(position);
      }
      // A descendant's own visibleRectEffect (visible_rect.js — e.g. a
      // Callout anchored to something inside this Dialog) knowing to
      // recheck its own position whenever this dialog itself moves is
      // handled generically by applyNewPosition itself (dispatches
      // navi_position_change on every call) — nothing to do here.
    };
    // Cleared here rather than on close, where the box is deliberately left
    // frozen at the size it was closing at (see the closing function's own
    // comment): this opening has its own content to be measured against, and
    // measuring it inside last time's box would answer with last time's size.
    unfreezeSize(dialogEl);
    positionDialog();
    if (sizing === "frozen") {
      // After positionDialog: the caps it writes
      // (--container-position-remaining-*) are part of what decides the size
      // being taken, so measuring before it would freeze a box the dialog
      // never actually had.
      freezeSize(dialogEl);
    }

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
        // Only for what can have taken height away from the dialog — a
        // scroll never does, and re-scrolling on one would fight the finger
        // that caused it. See keepFocusedElementVisible's own doc.
        if (mayHaveHiddenFocus(event)) {
          keepFocusedElementVisible(dialogEl);
        }
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
    // nested Popover) needing to know about this dialog's own repositioning
    // transition — not just that the target changed
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
    // Handing the focus to a field is what raises the on-screen keyboard, and
    // the keyboard takes away the very room this dialog was just placed
    // against — so on a touch-driven opening the transfer waits for the
    // entrance to be over. Decided by transferFocusOnOpen, the only place that
    // knows WHICH element is about to be focused (open_controller.js and its
    // FOCUS_DELAY_ON_KEYBOARD_MS).
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
      // Held at the size it has right now, for the whole way out. cleanup()
      // below already stops the JS repositioning, but the size is CSS-driven
      // (--x-dialog-max-height, and `height` outright under expandY) and
      // keeps following the visual viewport on its own — so a dialog closed
      // while the keyboard is up grows back to fill the room the keyboard is
      // giving back, WHILE fading out. Coherent, and still wrong to watch: a
      // box being dismissed has nothing left to adapt to, and the growth
      // reads as something happening at the exact moment nothing should. The
      // next opening clears it (see openEffect's own unfreezeSize).
      freezeSize(dialogEl);
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
    // Out of flow like the popup it belongs to — see the content element's own
    // note for what the marker is read by.
    "navi-out-of-flow": "",
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
    "data-backdrop-variant": backdropVariant,
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
    // Only load-bearing for the via-attribute renderer's own native
    // ::backdrop, same "a pseudo-element can't carry attributes" reasoning
    // as the prop just above (and harmless for the custom renderer, whose
    // real backdrop element gets it via backdropProps).
    "data-backdrop-variant": backdropVariant,
    "styleCSSVars": DIALOG_STYLE_CSS_VARS,
    ...rest,
    ...autoFocusProps,
    "as": "dialog",
    ref,
    // Not a control, but still something the rest of navi has to be able to
    // recognise: outside-click detection asks what a click landed in
    // ("[navi-control='dialog'], [navi-control='popover']" — see openEffect
    // above), and --navi-open/--navi-close resolve their target this way.
    "navi-control": "dialog",
    // The protocol every command target answers. It came with the control
    // group before; a dialog is layout and still has to answer --navi-open,
    // --navi-close and --navi-toggle, which are dispatched here and do not
    // bubble.
    "onnavi_command": (e) => {
      onNaviCommand(e);
      rest.onnavi_command?.(e);
    },
    // Not a child on the line of whatever holds it: a popup renders inside its
    // opener's own subtree, so a Dialog written next to the control that opens it
    // is a child of that control's own parent. A Group frames the children on
    // its line and this is not one of them — it is in the top layer, or
    // absolutely placed by its own code — so it says so once, here (group.jsx
    // reads this attribute to tell a member from anything else on its line).
    "navi-out-of-flow": "",
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
    "data-layer": layer,
    // The sheet shape is live in CSS, not just a set of resolved defaults:
    // it is what withdraws the caller's --dialog-max-width (see the stylesheet
    // above), which is an answer about the centered box only.
    "data-docked": isDocked ? "" : undefined,
    "data-expand-x": expandX ? "" : undefined,
    "data-expand-y": expandY ? "" : undefined,
    "data-flush-top": flushEdges.top ? "" : undefined,
    "data-flush-right": flushEdges.right ? "" : undefined,
    "data-flush-bottom": flushEdges.bottom ? "" : undefined,
    "data-flush-left": flushEdges.left ? "" : undefined,
    "data-swipe-to-close": swipeToCloseDown ? "" : undefined,
    // The axis the sheet travels on when it is pushed back, said to the shared
    // gesture layer: it is what a box travelling inside the sheet reads to know
    // this axis is already walked (see @jsenv/dom's drag_to_travel).
    "data-drag-travel": swipeToCloseDown
      ? SWIPE_AXIS_BY_SIDE.bottom
      : undefined,
    "data-travel-by-drag": swipeToCloseDown
      ? SWIPE_AXIS_BY_SIDE.bottom
      : undefined,
    "onPointerDown": (e) => {
      rest.onPointerDown?.(e);
      onSwipePointerDown?.(e);
    },
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
    children,
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
// borderRadius goes through --dialog-border-radius rather than the
// border-radius property itself so the flush-corner rules above (a plain
// stylesheet) can still square the corners that land on the container's own —
// an inline border-radius would outrank them.
const DIALOG_STYLE_CSS_VARS = {
  animationDuration: "--popup-animation-duration",
  borderRadius: "--dialog-border-radius",
  minWidth: "--dialog-min-width",
  maxWidth: "--dialog-max-width",
  minHeight: "--dialog-min-height",
  maxHeight: "--dialog-max-height",
};

Dialog.Close = PopupClose;

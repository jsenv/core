/**
 * A lightweight version of picker_custom.jsx's own Popover/Dialog switch —
 * no picker concepts (value/action tracking, keyboard letter/arrow-to-open
 * shortcuts, history-driven expanded state):
 * just picks between rendering a Popover or a Dialog and applies the shared
 * "popup box" look (padding, background, border-radius, box-shadow) to
 * whichever one it renders.
 *
 * Mode resolution (`useResolvedPopupMode`, popup_mode.jsx) is shared with picker_custom.jsx,
 * not just mirrored — the picker needs the resolved mode itself (for its own
 * mode-dependent history/ARIA handling), not just to pick which of Popover/
 * Dialog to render, so it calls the same hook directly instead of
 * duplicating the heuristic. `Popup` itself never resets it (no
 * open/close notion of its own to hook a reset into); the picker does, via
 * the hook's own `resetMode` return value, from its own onClose.
 *
 * `layer` (shared by both — picks the top-layer vs. local-container rendering
 * strategy either way) and `anchorCustomEventDetail` (shared too: Popover
 * resolves an anchor to position against, Dialog only to size itself from,
 * and only under its own `sizeFromAnchor`) pass through untouched via
 * `...rest` to whichever of Popover/Dialog actually renders.
 */

import { withPropsClassName } from "../utils/with_props_class_name.js";
import { Dialog } from "./dialog.jsx";
import { Popover } from "./popover.jsx";
import { PopupModeContext, useResolvedPopupMode } from "./popup_mode.jsx";
import { PopupClose } from "./popup_close.jsx";

const css = /* css */ `
  @layer navi {
    .navi_popup {
      --popup-border-radius: var(--navi-popup-border-radius);
      --popup-border-width: 1px;
      --popup-border-color: var(--navi-popup-border-color);

      /* A popup is a page of its own, opened from a control: it is written on
         the page's line, as the number, so each text it holds keeps a line
         relative to its own size. Its element sits under the control that
         opens it (a Picker holds its popup children inside its root), and
         line-height inherits as computed: the control's line is a length
         (--navi-control-line-height), and inherited it would arrive as that
         control's pixels — a 12px caption on an 18px picker's 23px rows.
         Layered, like the dialog padding below: both are what navi puts there
         in the absence of anything else, and an app writing its own line or
         its own popup padding is meant to win. */
      line-height: var(--navi-line-height);

      &.navi_popover {
        --popover-border-radius: var(--popup-border-radius);
        --popover-border-width: var(--popup-border-width);
        --popover-border-color: var(--popup-border-color);
      }

      &.navi_dialog {
        --dialog-border-radius: var(--popup-border-radius);
        --dialog-border-color: var(--popup-border-color);

        padding: 0;
      }
    }
  }
`;

/**
 * Renders a `Dialog` or a `Popover` behind one shared API, switching
 * automatically based on screen size (small screen → dialog, otherwise →
 * popover) unless `mode` is set explicitly. See this file's own top
 * comment for the full mode-resolution/prop-forwarding rationale.
 *
 * @param {object} props
 * @param {"dialog"|"popover"} [props.mode] - Forces one mode instead of the
 *   automatic small-screen/large-screen resolution. Frozen for the
 *   component instance's lifetime either way (see this file's top comment).
 * @param {"top"|"local"} [props.layer] - Forwarded as-is to whichever of
 *   `Dialog`/`Popover` renders — see either component's own doc.
 * @param {Element|{current: Element}} [props.anchor] - Forwarded as-is —
 *   positioning for `Popover`, and for `Dialog` sizing only, and only when
 *   `sizeFromAnchor` is also passed (see each component's own doc).
 * @param {"override"|"ignore"} [props.anchorCustomEventDetail] - Forwarded
 *   as-is to both — what it governs differs (positioning for `Popover`,
 *   `sizeFromAnchor` sizing for `Dialog`), but "ignore whatever anchor the
 *   triggering event carried" has to mean the same thing in either mode.
 * @param {string} [props.marginWithAnchor] - **Popover-only**, destructured
 *   out so it can't leak onto the real `<dialog>` element as a stray DOM
 *   attribute when `mode="dialog"` is picked.
 * @param {boolean} [props.focusCapture] - **Popover-only**, same guard.
 * @param {string} [props.positionAreaFixed] - **Popover-only**, same guard.
 * @param {string} [props.positionAreaWhenAnchorIsInvalid] - **Popover-only**,
 *   same guard.
 * @param {boolean} [props.dockedOnSmallTouchScreen] - **Dialog-only** (a
 *   popover is never a bottom sheet), destructured out for the same reason
 *   turned around: it must not land on the popover element as a stray DOM
 *   attribute when the screen-size resolution picks `mode="popover"`. Where
 *   that resolution lands is what decides whether it applies at all, so a
 *   popup meant to dock on a phone must not declare itself compact — see
 *   `maxWidth` below.
 * @param {boolean} [props.sizeFromAnchor] - **Dialog-only**, same guard.
 * @param {string} [props.positionArea] - Forwarded as-is — `Dialog` and
 *   `Popover` have different own defaults (`"center"` vs. `"bottom"`),
 *   deliberately not homogenized here (each reads best for its own typical
 *   use case).
 * @param {"close"|"cancel"|"capture"|"none"} [props.pointerInteractionOutsideEffect="close"]
 *   - Forwarded to whichever component renders, defaulted here to `"close"`
 *   specifically to override `Popover`'s own different default (`"none"`)
 *   — without this, the exact same `<Popup>` usage would behave
 *   differently (close-on-outside-click or not) purely based on which mode
 *   the screen-size check happens to pick, which defeats the point of
 *   having one shared API in the first place. Note this can only ever go so
 *   far: in dialog mode, `"none"`/`"capture"` still absorb every outside
 *   click (no visual effect vs. dimmed) rather than truly letting it
 *   through, since a `<dialog>` is always modal one way or another (see
 *   `dialog.jsx`'s own doc) — a popover's fully passive, click-through
 *   backdrop has no dialog-mode equivalent. Whatever content `Popup` opens
 *   is unavoidably *more* intrusive once it switches to dialog mode than
 *   the exact same usage would be as a popover — worth keeping in mind for
 *   anything that relies on `Popup` and can end up on a small screen.
 * @param {"auto"|"discrete"|"invisible"} [props.backdropVariant] - Forwarded
 *   as-is to whichever component renders (both understand it identically):
 *   how visible the backdrop is, independently of what an outside click
 *   does. Unlike `pointerInteractionOutsideEffect` above, this one needs no
 *   default here — `"auto"` already means the same thing on both sides.
 * @param {string} [props.backdropColor] - Forwarded as-is (both understand it
 *   identically): the wash the backdrop paints over what is behind.
 * @param {string} [props.backdropFilter] - Forwarded as-is: what that wash
 *   does to the picture underneath, `"blur(4px)"` and the like.
 * @param {boolean|"auto"|"fading"|"scaling"|"sliding"|"expanding"|`slide-from-${string}`|`expand-${string}`} [props.animation]
 *   - Forwarded as-is.
 * @param {string} [props.animationDuration] - Forwarded as-is.
 * @param {string} [props.maxWidth] - Forwarded as-is to both; also read
 *   here directly to help decide the automatic `mode` (a fixed length under
 *   150px is treated as "compact", staying a popover even on a small screen —
 *   see `resolvePopupMode` for which lengths that reading accepts).
 * @param {string} [props.minWidth] - Forwarded as-is.
 * @param {string} [props.minHeight] - Forwarded as-is.
 * @param {string} [props.maxHeight] - Forwarded as-is.
 * @param {"auto"|"frozen"} [props.sizing] - Forwarded as-is to both, which
 *   understand it identically: `"frozen"` holds the surface at the size it was
 *   measured at while it stays open, so acting on what it contains moves the
 *   content and not the surface. See either component's own doc.
 * @param {boolean} [props.expand] - Shorthand for both `expandX`/`expandY`
 *   below.
 * @param {boolean} [props.expandX] - Stretches the popup to the full width
 *   its renderer allows (`data-expand-x`: `--x-dialog-max-width` /
 *   `--x-popover-max-width`) instead of its content width — same meaning
 *   whichever mode the screen-size resolution picks.
 * @param {boolean} [props.expandY] - Same, vertically (`data-expand-y`).
 * @param {boolean} [props.scrollCapture] - Forwarded as-is.
 * @param {boolean} [props.open] - Forwarded as-is (controlled).
 * @param {import("@preact/signals").Signal<boolean>} [props.signal] -
 *   Forwarded as-is: one binding to both drive the popup's open state and
 *   know where it is (see `Dialog`/`Popover`'s own `signal`).
 * @param {boolean} [props.defaultOpen] - Forwarded as-is (uncontrolled,
 *   mount-only).
 * @param {(event: Event) => void} [props.onClose] - Forwarded as-is.
 * @param {object} [props.openController] - Forwarded as-is (advanced —
 *   see `open_controller.js`).
 * @param {string} [props.className] - Merged with the shared
 *   `"navi_popup"` class (see this file's own CSS) rather than replacing
 *   it.
 * @param {"always"|"idle"|"from-first-open"|"while-opened"} [props.mount] - When
 *   `children` are built and thrown away (see popup_content_mount.js).
 *   `"from-first-open"` (the default) builds them on the first open and keeps
 *   them afterwards. `"always"` builds them right away, for content something
 *   depends on while the popup is still closed: a value read off it, fields a
 *   surrounding form collects on submit, a size measured from outside.
 *   `"while-opened"` throws them away once the popup has finished closing, for
 *   content whose fresh state is its initial state: an uncontrolled field
 *   seeded from a `defaultValue` that changed while the popup was closed.
 * @param {import("preact").ComponentChildren} props.children
 */
export const Popup = (props) => {
  import.meta.css = css;
  const {
    mode: modeProp,
    maxWidth,
    expand,
    expandX,
    expandY,
    className,
    children,
    // Both default here (not left to each component's own, *different*
    // default — Dialog's own is "close", Popover's own is "none") so the
    // exact same <Popup> usage behaves identically regardless of which
    // mode the automatic screen-size resolution happens to pick.
    pointerInteractionOutsideEffect = "close",
    // Popover-only (see this component's own doc) — destructured out so
    // they're never part of ...rest, and therefore never forwarded to
    // Dialog below, where they'd otherwise leak onto the real <dialog>
    // element as stray, unrecognized DOM attributes.
    marginWithAnchor,
    focusCapture,
    scrollCapture,
    positionAreaFixed,
    positionAreaWhenAnchorIsInvalid,
    // Dialog-only, destructured out for the same reason: forwarded below only
    // in the dialog branch, so they never reach the popover element.
    dockedOnSmallTouchScreen,
    sizeFromAnchor,
    ...rest
  } = props;

  const [mode] = useResolvedPopupMode(modeProp, maxWidth, {
    // layer stays in ...rest (forwarded as-is to Dialog/Popover); it is read
    // here too because a local popup measures its container, not the screen
    layer: rest.layer,
    elementRef: rest.ref,
  });
  // So the content can lay itself out per mode — see usePopupMode.
  const childrenWithMode = (
    <PopupModeContext.Provider value={mode}>
      {children}
    </PopupModeContext.Provider>
  );

  if (mode === "dialog") {
    return (
      <Dialog
        {...rest}
        dockedOnSmallTouchScreen={dockedOnSmallTouchScreen}
        sizeFromAnchor={sizeFromAnchor}
        maxWidth={maxWidth}
        pointerInteractionOutsideEffect={pointerInteractionOutsideEffect}
        className={withPropsClassName("navi_popup", className)}
        expand={expand}
        expandX={expandX}
        expandY={expandY}
        scrollCapture={scrollCapture === "dialog" || scrollCapture}
      >
        {childrenWithMode}
      </Dialog>
    );
  }
  return (
    <Popover
      {...rest}
      maxWidth={maxWidth}
      pointerInteractionOutsideEffect={pointerInteractionOutsideEffect}
      marginWithAnchor={marginWithAnchor}
      focusCapture={focusCapture}
      positionAreaWhenAnchorIsInvalid={positionAreaWhenAnchorIsInvalid}
      scrollCapture={scrollCapture === "popover" || scrollCapture}
      positionAreaFixed={positionAreaFixed}
      className={withPropsClassName("navi_popup", className)}
      expand={expand}
      expandX={expandX}
      expandY={expandY}
    >
      {childrenWithMode}
    </Popover>
  );
};

Popup.Close = PopupClose;

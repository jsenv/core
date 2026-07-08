/**
 * A lightweight version of picker_custom.jsx's own Popover/Dialog switch —
 * no picker concepts (value/action tracking, keyboard letter/arrow-to-open
 * shortcuts, history-driven expanded state, anchor-clone "attached" mode):
 * just picks between rendering a Popover or a Dialog and applies the shared
 * "popup box" look (padding, background, border-radius, box-shadow) to
 * whichever one it renders.
 *
 * Mode resolution mirrors picker_custom.jsx's own: frozen for the lifetime
 * of the component instance (a screen resize while already mounted doesn't
 * switch between Popover and Dialog mid-session) rather than per open/close
 * cycle — simpler, since this component doesn't own an openController the
 * way the picker does to hook a reset into its own onClose.
 *
 * `layer` (shared by both — picks the top-layer vs. local-container rendering
 * strategy either way) and `anchorCustomEventDetail` (Popover-only, Dialog
 * ignores it — Dialog never resolves an anchor for positioning purposes)
 * pass through untouched via `...rest` to whichever of Popover/Dialog
 * actually renders.
 */

import { useRef } from "preact/hooks";

import { windowWidthSignal } from "../layout/responsive.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { Dialog } from "./dialog.jsx";
import { Popover } from "./popover.jsx";

const css = /* css */ `
  @layer navi {
    .navi_popup {
      --popup-border-radius: var(--navi-popup-border-radius);
      --popup-border-width: 1px;
      --popup-border-color: var(--navi-popup-border-color);

      &.navi_popover {
        --popover-border-radius: var(--popup-border-radius);
        --popover-border-width: var(--popup-border-width);
        --popover-border-color: var(--popup-border-color);
      }

      &.navi_dialog {
        --dialog-border-radius: var(--popup-border-radius);
        --dialog-border-color: var(--popup-border-color);
      }
    }
  }

  .navi_popup {
    &.navi_dialog {
      &[data-expand-x] {
        width: var(--dialog-maxmax-width);
      }
      &[data-expand-y] {
        height: var(--dialog-maxmax-height);
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
 *   sizing-only for `Dialog`, positioning for `Popover` (see each
 *   component's own doc for what it actually does there).
 * @param {"override"|"ignore"} [props.anchorCustomEventDetail] -
 *   **Popover-only** (`Dialog` never resolves an anchor for positioning) —
 *   never forwarded to `Dialog`, so it can't leak onto the real `<dialog>`
 *   element as a stray DOM attribute when `mode="dialog"` is picked.
 * @param {string} [props.marginWithAnchor] - **Popover-only**, same
 *   Dialog-leak guard as `anchorCustomEventDetail` above.
 * @param {boolean} [props.focusCapture] - **Popover-only**, same guard.
 * @param {string} [props.positionAreaFixed] - **Popover-only**, same guard.
 * @param {string} [props.positionArea] - Forwarded as-is — `Dialog` and
 *   `Popover` have different own defaults (`"center"` vs. `"below"`),
 *   deliberately not homogenized here (each reads best for its own typical
 *   use case).
 * @param {"close"|"capture"|"none"} [props.pointerInteractionOutsideEffect="close"]
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
 * @param {boolean|"auto"|"fading"|"scaling"|"sliding"|"expanding"|`slide-from-${string}`|`expand-${string}`} [props.animation]
 *   - Forwarded as-is.
 * @param {string} [props.animationDuration] - Forwarded as-is.
 * @param {string} [props.maxWidth] - Forwarded as-is to both; also read
 *   here directly to help decide the automatic `mode` (a small enough
 *   `maxWidth` is treated as "compact", staying a popover even on a small
 *   screen).
 * @param {string} [props.minWidth] - Forwarded as-is.
 * @param {string} [props.minHeight] - Forwarded as-is.
 * @param {string} [props.maxHeight] - Forwarded as-is.
 * @param {boolean} [props.expand] - Dialog-mode only: shorthand for both
 *   `expandX`/`expandY` below. No effect in popover mode.
 * @param {boolean} [props.expandX] - Dialog-mode only: stretches the dialog
 *   to `--dialog-maxmax-width` (`data-expand-x`).
 * @param {boolean} [props.expandY] - Dialog-mode only: stretches the dialog
 *   to `--dialog-maxmax-height` (`data-expand-y`).
 * @param {boolean} [props.scrollCapture] - Forwarded as-is.
 * @param {boolean} [props.open] - Forwarded as-is (controlled).
 * @param {boolean} [props.defaultOpen] - Forwarded as-is (uncontrolled,
 *   mount-only).
 * @param {(event: Event) => void} [props.onClose] - Forwarded as-is.
 * @param {object} [props.openController] - Forwarded as-is (advanced —
 *   see `open_controller.js`).
 * @param {string} [props.className] - Merged with the shared
 *   `"navi_popup"` class (see this file's own CSS) rather than replacing
 *   it.
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
    anchorCustomEventDetail,
    marginWithAnchor,
    focusCapture,
    positionAreaFixed,
    ...rest
  } = props;

  const defaultModeRef = useRef(null);
  if (defaultModeRef.current === null) {
    const isSmallScreen = windowWidthSignal.peek() <= 600;
    const maxWidthPx = parseFloat(maxWidth);
    const isCompact = isFinite(maxWidthPx) && maxWidthPx < 150;
    defaultModeRef.current =
      modeProp ?? (isSmallScreen && !isCompact ? "dialog" : "popover");
  }
  const mode = defaultModeRef.current;

  if (mode === "dialog") {
    const expandXResolved = expand || expandX;
    const expandYResolved = expand || expandY;
    return (
      <Dialog
        {...rest}
        maxWidth={maxWidth}
        pointerInteractionOutsideEffect={pointerInteractionOutsideEffect}
        className={withPropsClassName("navi_popup", className)}
        data-expand-x={expandXResolved ? "" : undefined}
        data-expand-y={expandYResolved ? "" : undefined}
      >
        {children}
      </Dialog>
    );
  }
  return (
    <Popover
      {...rest}
      maxWidth={maxWidth}
      pointerInteractionOutsideEffect={pointerInteractionOutsideEffect}
      anchorCustomEventDetail={anchorCustomEventDetail}
      marginWithAnchor={marginWithAnchor}
      focusCapture={focusCapture}
      positionAreaFixed={positionAreaFixed}
      className={withPropsClassName("navi_popup", className)}
    >
      {children}
    </Popover>
  );
};

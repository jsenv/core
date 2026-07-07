import { useRef } from "preact/hooks";

import { windowWidthSignal } from "../layout/responsive.js";
import { withPropsClassName } from "../utils/with_props_class_name.js";
import { Dialog } from "./dialog.jsx";
import { Popover } from "./popover.jsx";

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
 */
const css = /* css */ `
  @layer navi {
    .navi_popup {
      --popup-border-radius: 8px;
      --popup-border-width: 1px;
      --popup-border-color: #d0d0d0;

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
        className={withPropsClassName("navi_popup", className)}
        centerInVisualViewport
        data-expand-x={expandXResolved ? "" : undefined}
        data-expand-y={expandYResolved ? "" : undefined}
      >
        {children}
      </Dialog>
    );
  }
  return (
    <Popover {...rest} className={withPropsClassName("navi_popup", className)}>
      {children}
    </Popover>
  );
};

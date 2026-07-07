import { useRef } from "preact/hooks";

import { windowWidthSignal } from "../layout/responsive.js";
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
  .navi_popup_popover,
  .navi_popup_dialog {
    padding: var(--popup-padding, 16px 20px);
    background: var(--popup-background-color, white);
    border-radius: var(--popup-border-radius, 10px);
    box-shadow: var(--popup-box-shadow, 0 12px 40px rgba(0, 0, 0, 0.22));
    cursor: default; /* reset pointer cursor within the popup */
  }

  .navi_popup_popover {
    min-width: var(--anchor-width, 0px);
    max-width: min(
      var(--popup-max-width, var(--popup-popover-maxmax-width)),
      var(--popup-popover-maxmax-width, calc(0.95 * var(--navi-vvw)))
    );
    /* max-height covers the whole popover; content scrolls internally */
    max-height: min(
      var(--popup-popover-max-height, 300px),
      var(
        --space-available,
        var(--popup-popover-maxmax-height, calc(0.95 * var(--navi-vvh)))
      ),
      var(--popup-popover-maxmax-height, calc(0.95 * var(--navi-vvh)))
    );
    margin: 0;
    border: var(--popup-border-width, 1px) solid
      var(--popup-border-color, #d0d0d0);
    overflow: auto;
    overscroll-behavior: none;

    &[aria-expanded="true"] {
      display: flex;
      flex-direction: column;
    }
  }

  .navi_popup_dialog {
    min-width: var(--anchor-width, 0px);
    max-width: min(
      var(--popup-max-width, var(--popup-dialog-maxmax-width)),
      var(
        --popup-dialog-maxmax-width,
        calc(var(--navi-vvw) - 2 * var(--popup-dialog-margin, 3dvw))
      )
    );
    max-height: min(
      var(--popup-max-height, var(--popup-dialog-maxmax-height)),
      var(
        --popup-dialog-maxmax-height,
        calc(var(--navi-vvh) - 2 * var(--popup-dialog-margin, 3dvw))
      )
    );
    border: none;

    &[data-expand-x] {
      width: var(
        --popup-dialog-maxmax-width,
        calc(var(--navi-vvw) - 2 * var(--popup-dialog-margin, 3dvw))
      );
    }
    &[data-expand-y] {
      height: var(
        --popup-dialog-maxmax-height,
        calc(var(--navi-vvh) - 2 * var(--popup-dialog-margin, 3dvw))
      );
    }

    &[open] {
      display: flex;
      flex-direction: column;
    }

    &::backdrop {
      background: rgba(0, 0, 0, 0.4);
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
    style,
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

  const mergedStyle =
    maxWidth === undefined
      ? style
      : {
          ...style,
          "--popup-max-width":
            typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
        };

  if (mode === "dialog") {
    const expandXResolved = expand || expandX;
    const expandYResolved = expand || expandY;
    return (
      <Dialog
        {...rest}
        className={
          className ? `navi_popup_dialog ${className}` : "navi_popup_dialog"
        }
        style={mergedStyle}
        centerInVisualViewport
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
      className={
        className ? `navi_popup_popover ${className}` : "navi_popup_popover"
      }
      style={mergedStyle}
    >
      {children}
    </Popover>
  );
};

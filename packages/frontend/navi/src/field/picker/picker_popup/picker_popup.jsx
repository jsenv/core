import { useContext } from "preact/hooks";

import { windowWidthSignal } from "@jsenv/navi/src/layout/responsive.js";
import { PickerDispatcherContext } from "../picker_context.jsx";

const css = /* css */ `
  .navi_picker {
    /* popover */
    &[aria-haspopup="listbox"] {
      .navi_list_container {
        width: 100%;
        /* Handled by the popover */
        border: none;
        border-radius: 0;
        outline: none;

        .navi_list {
          width: 100%;
        }
      }

      .navi_picker_popover {
        position: absolute;
        inset: unset;
        min-width: var(--anchor-width, 0px);
        max-width: 95vw;
        /* max-height covers the placeholder + list; the list scrolls internally */
        max-height: var(--space-available, 95dvh);
        margin: 0;
        padding: 0;
        background: var(--picker-background-color);
        border-width: var(--picker-border-width);
        border-style: solid;
        border-color: var(--x-picker-border-color);
        border-radius: var(--picker-border-radius);
        outline-width: var(--x-picker-outline-width);
        outline-color: var(--picker-outline-color);
        outline-offset: var(--x-picker-outline-offset);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
        cursor: default; /* Reset pointer cursor within the select */
        overflow: hidden;
        overscroll-behavior: none;

        /* The list scrolls inside the popover */
        .navi_list_container {
          overflow: auto;
          overscroll-behavior: none;
        }
      }

      &:has([data-hover]) {
        .navi_picker_popover {
          --x-picker-border-color: var(--picker-border-color-hover);
        }
      }
      &:has([data-focus-visible]) {
        .navi_picker_popover {
          outline-style: solid;
        }
      }

      &[aria-expanded="true"] {
        &[navi-popover-mode="overlay"],
        &[navi-popover-mode="attached"] {
          /* When sizes uses float AND the border uses border-radius it's possible it's possible to see some pixels
          of the underlying select borders. We hide them to ensure this cannot happen.  */
          border-color: transparent;
        }

        .navi_picker_popover {
          display: flex;
          flex-direction: column;
        }
      }
    }

    /* dialog */
    &[aria-haspopup="dialog"] {
      .navi_list_container {
        width: 100%;
        --list-max-height: none;
        /* Handled by the dialog */
        border: none;
        border-radius: 0;
        outline: none;

        .navi_list {
          width: 100%;
        }
      }

      .navi_picker_dialog {
        max-height: 95dvh;
        padding: 0;
        background: var(--picker-background-color);
        border: var(--picker-border-width) solid var(--x-picker-border-color);
        border-radius: var(--picker-border-radius);
        outline-width: var(--x-picker-outline-width);
        outline-color: var(--picker-outline-color);
        outline-offset: var(--x-picker-outline-offset);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
        cursor: default; /* Reset pointer cursor within the select */
        /* overscroll-behavior: contain; */

        &[open] {
          display: flex;
          flex-direction: column;
        }

        &::backdrop {
          background: rgba(0, 0, 0, 0.4);
        }
      }

      /* When the list inside the dialog has keyboard focus, show the focus ring
       on the dialog instead */
      &:has([data-focus-visible]) {
        .navi_select_dialog {
          outline-style: solid;
        }
      }
    }
  }
`;

export const PickerPopup = (props) => {
  const isSmallScreen = windowWidthSignal.value <= 600;
  const defaultMode = isSmallScreen ? "dialog" : "popover";
  const { mode = defaultMode } = props;
  if (mode === "popover") {
    return <PickerInsidePopover {...props} />;
  }
  if (mode === "dialog") {
    return <PickerInsideDialog {...props} />;
  }
  return null;
};

const PickerInsidePopover = () => {
  import.meta.css = css;
  const PickerDispatcher = useContext(PickerDispatcherContext);
  return <PickerDispatcher />;
};

const PickerInsideDialog = () => {
  import.meta.css = css;
  const PickerDispatcher = useContext(PickerDispatcherContext);
  return <PickerDispatcher />;
};

import { trapScrollInside } from "@jsenv/dom";
import { createContext } from "preact";
import { useContext, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { ChevronDownSvg } from "../../graphic/icons/chevron_updown_svg.jsx";
import { Icon } from "../../text/icon.jsx";

const css = /* css */ `
  @layer navi {
    .navi_dropdown_trigger {
      --border-radius: 2px;
      --border-width: 1px;
      --outline-width: 1px;
      --font-size: 14px;
      --padding: 5px 8px;
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --color: currentColor;
      --placeholder-color: color-mix(in srgb, currentColor 60%, transparent);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
    }
  }

  .navi_dropdown_trigger {
    display: inline-flex;
    box-sizing: border-box;
    padding: var(--padding);
    align-items: center;
    gap: 6px;
    color: var(--color);
    font-size: var(--font-size);
    text-align: left;
    background-color: var(--background-color);
    border: var(--border-width) solid transparent;
    border-radius: var(--border-radius);
    outline: var(--outline-width) solid var(--border-color);
    outline-offset: calc(-1 * var(--outline-width));
    cursor: pointer;
    user-select: none;

    &:hover {
      background-color: var(--background-color-hover);
      outline-color: var(--border-color-hover);
    }

    &:focus-visible {
      outline-width: calc(var(--border-width) + var(--outline-width));
      outline-color: var(--navi-focus-outline-color, #005fcc);
      outline-offset: calc(-1 * (var(--border-width) + var(--outline-width)));
    }
  }

  .navi_dropdown_trigger_label {
    min-width: 0;
    flex: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .navi_dropdown_trigger_label[data-placeholder] {
    color: var(--placeholder-color);
  }

  .navi_dropdown_trigger_icon {
    flex-shrink: 0;
    opacity: 0.6;
  }

  .navi_dropdown_dialog {
    max-height: 95dvh;
    margin: auto;
    padding: 0;
    background: white;
    border: none;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);

    &[open] {
      display: flex;
      flex-direction: column;
    }

    &::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }

    /* When the suggestion list inside the dialog has keyboard focus, show the
       focus ring on the dialog itself and suppress it on the list container. 
       It's visually better */
    &:has(.navi_list_container:focus-visible) {
      outline: 1px solid var(--navi-focus-outline-color, #005fcc);
      outline-offset: 1px;
    }
    & .navi_list_container:focus-visible {
      outline: none;
    }
  }
`;

const DropdownCloseContext = createContext(null);
export const useIsInsideDropdown = () => {
  return typeof useContext(DropdownCloseContext) === "function";
};

/**
 * Dropdown — a select-like trigger that opens a centered dialog.
 *
 * Props:
 *   value          — the currently selected value (displayed in the trigger)
 *   placeholder    — text shown when value is null/undefined/empty
 *   disabled       — disable the trigger
 *   capturePointer — when true, clicking the backdrop does NOT close the dialog
 *   onOpen         — called when the dialog opens
 *   onClose        — called when the dialog closes
 *   children       — content rendered inside the dialog
 *   ...rest        — forwarded to the trigger <button>
 */
export const Dropdown = ({
  value,
  placeholder = "Select…",
  disabled,
  capturePointer,
  captureScroll,
  onOpen,
  onClose,
  children,
  ...rest
}) => {
  import.meta.css = css;
  const dialogRef = useRef(null);
  const [open, setOpen] = useState(false);
  const scrollTrapCleanupRef = useRef(null);

  const openDialog = () => {
    if (disabled) {
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog || open) {
      return;
    }
    dialog.showModal();
    if (captureScroll) {
      scrollTrapCleanupRef.current = trapScrollInside(dialog);
    }
    setOpen(true);
    onOpen?.();
  };

  const closeDialog = () => {
    const dialog = dialogRef.current;
    if (!dialog || !open) {
      return;
    }
    dialog.close();
    setOpen(false);
    if (captureScroll && scrollTrapCleanupRef.current) {
      scrollTrapCleanupRef.current();
      scrollTrapCleanupRef.current = null;
    }
    onClose?.();
  };

  const onDialogClick = (e) => {
    // The <dialog> element itself is the backdrop area. Clicking directly on it
    // (not on its content child) closes the dialog — unless capturePointer is set.
    if (!capturePointer && e.target === dialogRef.current) {
      closeDialog();
    }
  };

  const hasValue = value !== null && value !== undefined && value !== "";

  return (
    <>
      <Box
        as="button"
        type="button"
        baseClassName="navi_dropdown_trigger"
        disabled={disabled}
        onClick={openDialog}
        {...rest}
      >
        <span
          className="navi_dropdown_trigger_label"
          data-placeholder={hasValue ? undefined : ""}
        >
          {hasValue ? String(value) : placeholder}
        </span>
        <span className="navi_dropdown_trigger_icon">
          <Icon>
            <ChevronDownSvg />
          </Icon>
        </span>
      </Box>

      <dialog
        ref={dialogRef}
        className="navi_dropdown_dialog"
        onClick={onDialogClick}
        onClose={closeDialog}
      >
        <DropdownCloseContext.Provider value={closeDialog}>
          {children}
        </DropdownCloseContext.Provider>
      </dialog>
    </>
  );
};

/**
 * Hook to close the enclosing Dropdown dialog from inside its content.
 */
export const useDropdownClose = () => {
  return useContext(DropdownCloseContext);
};

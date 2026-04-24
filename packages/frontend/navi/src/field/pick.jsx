import { useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { ChevronDownSvg } from "../graphic/icons/chevron_updown_svg.jsx";
import { Icon } from "../text/icon.jsx";

const css = /* css */ `
  @layer navi {
    .navi_pick_trigger {
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

  .navi_pick_trigger {
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

  .navi_pick_trigger_label {
    min-width: 0;
    flex: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .navi_pick_trigger_label[data-placeholder] {
    color: var(--placeholder-color);
  }

  .navi_pick_trigger_icon {
    flex-shrink: 0;
    opacity: 0.6;
  }

  .navi_pick_dialog {
    margin: auto;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 8px;
    overflow: visible;

    /* Center in viewport */
    &::backdrop {
      background: rgba(0, 0, 0, 0.4);
    }
  }

  .navi_pick_dialog_content {
    background: white;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    overflow: hidden;
  }
`;

/**
 * Pick — a select-like trigger that opens a centered dialog.
 *
 * Props:
 *   value       — the currently selected value (displayed in the trigger)
 *   placeholder — text shown when value is empty/null
 *   label       — custom render for the trigger label (overrides value/placeholder)
 *   disabled    — disable the trigger
 *   onOpen      — called when the dialog is opened
 *   onClose     — called when the dialog is closed
 *   children    — content rendered inside the dialog
 *   ...rest     — forwarded to the trigger <button> (e.g. style, class, expandX)
 */
export const Pick = ({
  value,
  placeholder = "Select…",
  label,
  disabled,
  onOpen,
  onClose,
  children,
  ...rest
}) => {
  import.meta.css = css;
  const dialogRef = useRef(null);
  const [open, setOpen] = useState(false);

  const openDialog = () => {
    if (disabled) {
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog || open) {
      return;
    }
    dialog.showModal();
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
    onClose?.();
  };

  const onDialogClick = (e) => {
    // The <dialog> element itself is the backdrop area. Clicking directly on it
    // (not on its content child) closes the dialog.
    if (e.target === dialogRef.current) {
      closeDialog();
    }
  };

  const hasValue = value !== null && value !== undefined && value !== "";
  const triggerLabel = label ?? (hasValue ? String(value) : null);

  return (
    <>
      <Box
        as="button"
        type="button"
        baseClassName="navi_pick_trigger"
        disabled={disabled}
        onClick={openDialog}
        {...rest}
      >
        <span
          className="navi_pick_trigger_label"
          data-placeholder={triggerLabel === null ? "" : undefined}
        >
          {triggerLabel ?? placeholder}
        </span>
        <span className="navi_pick_trigger_icon">
          <Icon>
            <ChevronDownSvg />
          </Icon>
        </span>
      </Box>

      <dialog
        ref={dialogRef}
        className="navi_pick_dialog"
        onClick={onDialogClick}
        onClose={closeDialog}
      >
        <div className="navi_pick_dialog_content">{children}</div>
      </dialog>
    </>
  );
};

/**
 * Hook to close the nearest Pick dialog from inside its content.
 * Returns a close() function.
 */
export const usePickClose = () => {
  return () => {
    // Walk up the DOM to find the dialog and close it.
    const el = document.activeElement;
    const dialog = el?.closest?.("dialog.navi_pick_dialog");
    if (dialog) {
      dialog.close();
    }
  };
};

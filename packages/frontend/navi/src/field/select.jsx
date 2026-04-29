import { pickPositionRelativeTo, visibleRectEffect } from "@jsenv/dom";
import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";

import { renderActionableComponent } from "../action/render_actionable_component.jsx";
import { Box } from "../box/box.jsx";
import { ChevronDownSvg } from "../graphic/icons/chevron_updown_svg.jsx";
import { Icon } from "../text/icon.jsx";
import { SelectUIActionContext } from "./select_context.js";

const css = /* css */ `
  @layer navi {
    .navi_select_trigger {
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

  .navi_select_trigger {
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

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }
  }

  .navi_select_trigger_label {
    min-width: 0;
    flex: 1;
    text-overflow: ellipsis;
    white-space: nowrap;
    overflow: hidden;
  }

  .navi_select_trigger_label[data-placeholder] {
    color: var(--placeholder-color);
  }

  .navi_select_trigger_icon {
    flex-shrink: 0;
    opacity: 0.6;
  }

  .navi_select_popover {
    position: absolute;
    inset: unset;
    min-width: var(--select-anchor-width, 0px);
    max-width: 95vw;
    max-height: 95dvh;
    margin: 0;
    padding: 0;
    background: white;
    border: none;
    border-radius: 8px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
    overflow: auto;

    &[data-anchor-hidden] {
      opacity: 0;
      pointer-events: none;
    }
  }
`;

/**
 * Select — a trigger button that opens a popover containing arbitrary children.
 *
 * Props:
 *   name        — form field name (renders a hidden input for form submission)
 *   value       — currently selected value (displayed in the trigger)
 *   placeholder — text shown when value is null/undefined/"" and label is not set
 *   label       — custom ReactNode for the trigger, bypasses value/placeholder display
 *   disabled    — disable the trigger
 *   uiAction    — called with the selected value when an item is confirmed
 *   action      — server action (switches to WithAction variant)
 *   children    — content rendered inside the popover (e.g. a <List>)
 *
 * The uiAction is also provided via SelectUIActionContext so that a <List>
 * placed inside Select automatically receives it without explicit prop passing.
 *
 * Note: the trigger is type="button" — pressing Enter opens/closes the popover
 * but does NOT submit a parent form. Use a submit button separately for that.
 *
 * mode="popover" (default) — content opens in a popover anchored below trigger.
 * mode="dialog" — reserved for future use.
 */
export const Select = (props) => {
  import.meta.css = css;
  return renderActionableComponent(props, {
    Basic: SelectBasic,
    WithAction: SelectWithAction,
  });
};

const openPopoverBelow = (anchor, popover, cleanupRef) => {
  popover.showPopover();
  const positionPopover = () => {
    const anchorRect = anchor.getBoundingClientRect();
    popover.style.setProperty("--select-anchor-width", `${anchorRect.width}px`);
    const minLeft = 1;
    const { left, top } = pickPositionRelativeTo(popover, anchor, {
      positionPreference: "below",
      minLeft,
    });
    popover.style.top = `${top}px`;
    const popoverRect = popover.getBoundingClientRect();
    const maxWidth = parseFloat(getComputedStyle(popover).maxWidth);
    if (!isNaN(maxWidth) && popoverRect.width >= maxWidth - 1) {
      const viewportWidth = document.documentElement.clientWidth;
      const centeredLeft = (viewportWidth - popoverRect.width) / 2;
      popover.style.left = `${Math.max(centeredLeft, minLeft)}px`;
    } else {
      popover.style.left = `${Math.max(left, minLeft)}px`;
    }
  };
  positionPopover();
  const cleanup = visibleRectEffect(anchor, ({ visibilityRatio }) => {
    if (visibilityRatio <= 0.2) {
      popover.setAttribute("data-anchor-hidden", "");
      return;
    }
    popover.removeAttribute("data-anchor-hidden");
    positionPopover();
  });
  cleanupRef.current = () => cleanup.disconnect();
};

// Hook that wires up close-on-outside-click, Escape to close, and
// focus-back-to-trigger when a list item is selected via mouse.
const useSelectBehavior = ({
  triggerRef,
  popoverRef,
  cleanupRef,
  closePopover,
}) => {
  const [open, setOpen] = useState(false);

  const openPopover = (disabled) => {
    if (disabled) {
      return;
    }
    if (open) {
      close();
      return;
    }
    const anchor = triggerRef.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) {
      return;
    }
    openPopoverBelow(anchor, popover, cleanupRef);
    setOpen(true);
  };

  const close = () => {
    closePopover();
    setOpen(false);
  };

  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (e) => {
      const trigger = triggerRef.current;
      const popover = popoverRef.current;
      if (!trigger || !popover) {
        return;
      }
      if (trigger.contains(e.target) || popover.contains(e.target)) {
        return;
      }
      close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    const popover = popoverRef.current;
    if (!popover) {
      return undefined;
    }
    // When a list item is confirmed via mousedown, the focus would naturally go
    // to the clicked element inside the popover. We intercept and return it to
    // the trigger button instead.
    const onListSelect = (e) => {
      const { event } = e.detail;
      if (event.type === "mousedown") {
        event.preventDefault();
        triggerRef.current?.focus({ preventScroll: true });
      }
    };
    popover.addEventListener("navi_list_select", onListSelect);
    return () => {
      popover.removeEventListener("navi_list_select", onListSelect);
    };
  }, []);

  const onToggle = (e) => {
    if (e.newState === "closed") {
      cleanupRef.current?.();
      cleanupRef.current = null;
      setOpen(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      close();
    }
  };

  return { open, openPopover, close, onToggle, onKeyDown };
};

const SelectBasic = (props) => {
  const {
    name,
    value: initialValue = null,
    placeholder = "Select…",
    label,
    disabled,
    uiAction: uiActionProp,
    children,
    ...rest
  } = props;

  const [value, setValue] = useState(initialValue);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const cleanupRef = useRef(null);
  const popoverId = useId();

  const closePopover = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    popoverRef.current?.hidePopover();
  };

  const { open, openPopover, onToggle, onKeyDown } = useSelectBehavior({
    triggerRef,
    popoverRef,
    cleanupRef,
    closePopover,
  });

  const compositeUIAction = (selectedValue) => {
    setValue(selectedValue);
    closePopover();
    uiActionProp?.(selectedValue);
  };

  useLayoutEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const hasValue = value !== null && value !== undefined && value !== "";
  const triggerContent =
    label !== undefined ? label : hasValue ? String(value) : null;
  const isPlaceholder = triggerContent === null;

  return (
    <SelectUIActionContext.Provider value={compositeUIAction}>
      <Box
        as="button"
        type="button"
        ref={triggerRef}
        baseClassName="navi_select_trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          openPopover(disabled);
        }}
        onKeyDown={onKeyDown}
        {...rest}
      >
        <span
          className="navi_select_trigger_label"
          data-placeholder={isPlaceholder ? "" : undefined}
        >
          {isPlaceholder ? placeholder : triggerContent}
        </span>
        <span className="navi_select_trigger_icon">
          <Icon>
            <ChevronDownSvg />
          </Icon>
        </span>
      </Box>
      {name && (
        <input
          type="hidden"
          name={name}
          value={hasValue ? String(value) : ""}
        />
      )}
      <div
        id={popoverId}
        ref={popoverRef}
        className="navi_select_popover"
        role="listbox"
        popover="manual"
        onToggle={onToggle}
      >
        {children}
      </div>
    </SelectUIActionContext.Provider>
  );
};

const SelectWithAction = (props) => {
  const {
    name,
    value: externalValue = null,
    placeholder = "Select…",
    label,
    disabled,
    action,
    uiAction: uiActionProp,
    children,
    ...rest
  } = props;

  const [value, setValue] = useState(externalValue);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const cleanupRef = useRef(null);
  const popoverId = useId();

  const closePopover = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    popoverRef.current?.hidePopover();
  };

  const { open, openPopover, onToggle, onKeyDown } = useSelectBehavior({
    triggerRef,
    popoverRef,
    cleanupRef,
    closePopover,
  });

  const compositeUIAction = (selectedValue) => {
    setValue(selectedValue);
    closePopover();
    uiActionProp?.(selectedValue);
    action?.(selectedValue);
  };

  useLayoutEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  const hasValue = value !== null && value !== undefined && value !== "";
  const triggerContent =
    label !== undefined ? label : hasValue ? String(value) : null;
  const isPlaceholder = triggerContent === null;

  return (
    <SelectUIActionContext.Provider value={compositeUIAction}>
      <Box
        as="button"
        type="button"
        ref={triggerRef}
        baseClassName="navi_select_trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => {
          openPopover(disabled);
        }}
        onKeyDown={onKeyDown}
        {...rest}
      >
        <span
          className="navi_select_trigger_label"
          data-placeholder={isPlaceholder ? "" : undefined}
        >
          {isPlaceholder ? placeholder : triggerContent}
        </span>
        <span className="navi_select_trigger_icon">
          <Icon>
            <ChevronDownSvg />
          </Icon>
        </span>
      </Box>
      {name && (
        <input
          type="hidden"
          name={name}
          value={hasValue ? String(value) : ""}
        />
      )}
      <div
        id={popoverId}
        ref={popoverRef}
        className="navi_select_popover"
        role="listbox"
        popover="manual"
        onToggle={onToggle}
      >
        {children}
      </div>
    </SelectUIActionContext.Provider>
  );
};

import { pickPositionRelativeTo, visibleRectEffect } from "@jsenv/dom";
import { createContext } from "preact";
import {
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { renderActionableComponent } from "../action/render_actionable_component.jsx";
import { useActionBoundToOneParam } from "../action/use_action.js";
import { useActionStatus } from "../action/use_action_status.js";
import { useExecuteAction } from "../action/use_execute_action.js";
import { Box } from "../box/box.jsx";
import { ChevronDownSvg } from "../graphic/icons/chevron_updown_svg.jsx";
import { LoaderBackground } from "../graphic/loader/loader_background.jsx";
import { shortcutsViaOnKeyDown } from "../keyboard/keyboard_shortcuts.js";
import { Icon } from "../text/icon.jsx";
import {
  reportDisabledToLabel,
  reportInteractiveToLabel,
  reportReadOnlyToLabel,
} from "./label.jsx";
import { SelectUIActionContext } from "./select_context.js";
import { useActionEvents } from "./use_action_events.js";
import {
  DisabledContext,
  LoadingContext,
  LoadingElementContext,
  ReadOnlyContext,
  UIStateContext,
  UIStateControllerContext,
  useUIState,
  useUIStateController,
} from "./use_ui_state_controller.js";
import { forwardActionRequested } from "./validation/custom_constraint_validation.js";

const css = /* css */ `
  @layer navi {
    .navi_select {
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

  .navi_select {
    position: relative;
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

    .navi_list_container {
      --list-border-radius: 0;
    }

    .navi_select_trigger_text {
      min-width: 0;
      flex: 1;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;

      &[data-placeholder] {
        color: var(--placeholder-color);
      }
    }
    .navi_select_trigger_icon {
      flex-shrink: 0;
      opacity: 0.6;
    }

    /* When the suggestion list inside the dialog has keyboard focus, show the
       focus ring on the dialog itself and suppress it on the list container. 
       It's visually better */
    &:has(.navi_list_container:focus-visible) {
      outline-width: calc(var(--border-width) + var(--outline-width));
      outline-color: var(--navi-focus-outline-color, #005fcc);
      outline-offset: calc(-1 * (var(--border-width) + var(--outline-width)));
    }
    .navi_list_container:focus-visible {
      outline: none;
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
      border-radius: 0;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
      overflow: auto;

      &[data-anchor-hidden] {
        opacity: 0;
        pointer-events: none;
      }
    }

    .navi_select_dialog {
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
    }
  }
`;

/**
 * Select — a trigger button that opens a popover or dialog containing children.
 *
 * Props:
 *   name        — form field name (hidden input for form submission)
 *   value       — currently selected value (displayed in the trigger)
 *   placeholder — text shown when value is null/undefined/"" and triggerContent is not set
 *   triggerContent — custom ReactNode for the trigger, bypasses value/placeholder display
 *   disabled    — disable the trigger
 *   uiAction    — called with the selected value when an item is confirmed
 *   action      — server action (switches to WithAction variant)
 *   mode        — "popover" (default, anchored below trigger) | "dialog" (centered modal)
 *   children    — content rendered inside the popover/dialog (e.g. a <List>)
 *
 * The uiAction is also provided via SelectUIActionContext so that a <List>
 * placed inside Select automatically receives it without explicit prop passing.
 *
 * Note: the trigger is type="button" — pressing Enter opens/closes the content
 * but does NOT submit a parent form. Use a separate submit button for that.
 */
export const Select = (props) => {
  const uiStateController = useUIStateController(props, "select");
  const uiState = useUIState(uiStateController);

  const select = renderActionableComponent(props, {
    Basic: SelectBasic,
    WithAction: SelectWithAction,
  });
  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        {select}
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};

const SelectValueContext = createContext(null);
const SelectPlaceholderContext = createContext("Select…");
const SelectUI = (props) => {
  let {
    placeholder = "Select…",
    trigger,
    name,
    value,
    readOnly,
    disabled,
    loading,
    children,
    autoFocus,
    ...rest
  } = props;

  import.meta.css = css;
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const uiStateController = useContext(UIStateControllerContext);
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;

  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;

  reportReadOnlyToLabel(innerReadOnly);
  reportDisabledToLabel(innerDisabled);
  reportInteractiveToLabel(true);

  const uiAction = useCallback((value, e) => {
    uiStateController.setUIState(value, e);
  }, []);

  if (trigger === undefined) {
    trigger = <SelectTrigger />;
  }
  return (
    <Box
      as="button"
      type="button"
      {...rest}
      baseClassName="navi_select"
      autoFocus={autoFocus ? "" : undefined}
      onresetuistate={(e) => {
        uiStateController.resetUIState(e);
      }}
      onsetuistate={(e) => {
        uiStateController.setUIState(e.detail.value, e);
      }}
      styleCSSVars={SelectStyleCSSVars}
      basePseudoState={{
        ...rest.basePseudoState,
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      pseudoClasses={SelectPseudoClasses}
      pseudoElements={SelectPseudoElements}
    >
      <LoaderBackground
        loading={innerLoading}
        color="var(--loader-color)"
        inset={-1}
      />
      <SelectPlaceholderContext.Provider value={placeholder}>
        <SelectValueContext.Provider value={value}>
          {trigger}
        </SelectValueContext.Provider>
      </SelectPlaceholderContext.Provider>
      <input type="hidden" name={name} value={value} />
      <SelectUIActionContext.Provider value={uiAction}>
        {children}
      </SelectUIActionContext.Provider>
    </Box>
  );
};
const SelectStyleCSSVars = {
  "borderWidth": "--border-width",
  "borderRadius": "--border-radius",
  "padding": "--padding",
  "paddingX": "--padding-x",
  "paddingY": "--padding-y",
  "paddingTop": "--padding-top",
  "paddingRight": "--padding-right",
  "paddingBottom": "--padding-bottom",
  "paddingLeft": "--padding-left",
  "background": "--background",
  "backgroundColor": "--background-color",
  "borderColor": "--border-color",
  "color": "--color",
  "fontSize": "--font-size",
  ":hover": {
    backgroundColor: "--background-color-hover",
    borderColor: "--border-color-hover",
    color: "--color-hover",
  },
  ":focus": {
    backgroundColor: "--background-color-focus",
    borderColor: "--border-color-focus",
  },
  ":active": {
    backgroundColor: "--background-color-active",
    borderColor: "--border-color-active",
  },
  ":read-only": {
    backgroundColor: "--background-color-readonly",
    borderColor: "--border-color-readonly",
    color: "--color-readonly",
  },
  ":disabled": {
    backgroundColor: "--background-color-disabled",
    borderColor: "--border-color-disabled",
    color: "--color-disabled",
  },
};
const SelectPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
  ":navi-expanded",
];
const SelectPseudoElements = ["::-navi-loader"];

const SelectTrigger = () => {
  const placeholder = useContext(SelectPlaceholderContext);
  const value = useContext(SelectValueContext);
  const hasValue = value !== null && value !== undefined && value !== "";
  const isPlaceholder = !hasValue;

  return (
    <>
      <span
        className="navi_select_trigger_text"
        data-placeholder={isPlaceholder ? "" : undefined}
      >
        {isPlaceholder ? placeholder : String(value)}
      </span>
      <span className="navi_select_trigger_icon">
        <Icon>
          <ChevronDownSvg />
        </Icon>
      </span>
    </>
  );
};

// SelectBasic manages uncontrolled value state and routes to the mode variant.
const SelectBasic = (props) => {
  const {
    mode = "popover",
    value: initialValue = null,
    uiAction: uiActionProp,
    ...rest
  } = props;
  const [value, setValue] = useState(initialValue);
  const compositeUIAction = (selectedValue) => {
    setValue(selectedValue);
    uiActionProp?.(selectedValue);
  };

  if (mode === "dialog") {
    return (
      <SelectBasicDialog value={value} uiAction={compositeUIAction} {...rest} />
    );
  }
  return (
    <SelectBasicPopover value={value} uiAction={compositeUIAction} {...rest} />
  );
};
// SelectBasicPopover — trigger + popover anchored below the trigger.
const SelectBasicPopover = (props) => {
  const { disabled, onKeyDown, children, ...rest } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const popoverRef = useRef(null);
  const cleanupRef = useRef(null);
  const popoverId = useId();
  const [open, setOpen] = useState(false);

  const openPopover = () => {
    if (disabled) {
      return;
    }
    if (open) {
      closePopover();
      return;
    }
    const anchor = ref.current;
    const popover = popoverRef.current;
    if (!anchor || !popover) {
      return;
    }
    popover.showPopover();
    const positionPopover = () => {
      const anchorRect = anchor.getBoundingClientRect();
      popover.style.setProperty(
        "--select-anchor-width",
        `${anchorRect.width}px`,
      );
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
    setOpen(true);
  };
  const closePopover = () => {
    cleanupRef.current?.();
    cleanupRef.current = null;
    popoverRef.current?.hidePopover();
    setOpen(false);
  };

  useLayoutEffect(() => {
    return () => {
      cleanupRef.current?.();
    };
  }, []);

  // Close on outside click while popover is open.
  useLayoutEffect(() => {
    if (!open) {
      return undefined;
    }
    const onPointerDown = (e) => {
      const select = ref.current;
      const popover = popoverRef.current;
      if (!select || !popover) {
        return;
      }
      if (select.contains(e.target) || popover.contains(e.target)) {
        return;
      }
      closePopover(e);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <SelectUI
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={popoverId}
      onClick={openPopover}
      // When a list item is interacted via mousedown, return focus to the select.
      onnavi_list_select={(e) => {
        const { event } = e.detail;
        if (event.type === "mousedown") {
          event.preventDefault();
          event.stopPropagation();
        }
        closePopover(e);
        ref.current?.focus({ preventScroll: true });
      }}
      onKeyDown={shortcutsViaOnKeyDown(
        {
          arrowdown: (e) => {
            e.preventDefault(); // prevent container scroll
            openPopover(e);
          },
          arrowup: (e) => {
            e.preventDefault(); // prevent container scroll
            openPopover(e);
          },
          escape: (e) => {
            if (open) {
              e.preventDefault();
              closePopover(e);
              ref.current.focus({ preventScroll: true });
            }
          },
        },
        onKeyDown,
      )}
      {...rest}
      ref={ref}
    >
      <div
        ref={popoverRef}
        id={popoverId}
        className="navi_select_popover"
        popover="manual"
        onToggle={(e) => {
          if (e.newState === "closed") {
            cleanupRef.current?.();
            cleanupRef.current = null;
            setOpen(false);
          }
        }}
      >
        {children}
      </div>
    </SelectUI>
  );
};
// SelectBasicDialog — trigger + centered modal dialog.
const SelectBasicDialog = (props) => {
  const { disabled, onClick, children, ...rest } = props;
  const dialogRef = useRef(null);
  const dialogId = useId();
  const [open, setOpen] = useState(false);

  const openDialog = () => {
    if (disabled) {
      return;
    }
    if (open) {
      closeDialog();
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    dialog.showModal();
    setOpen(true);
  };
  const closeDialog = () => {
    const dialog = dialogRef.current;
    if (!dialog || !open) {
      return;
    }
    dialog.close();
    setOpen(false);
  };

  return (
    <SelectUI
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={dialogId}
      {...rest}
      onClick={(e) => {
        openDialog(e);
        onClick?.();
      }}
    >
      <dialog
        ref={dialogRef}
        id={dialogId}
        className="navi_select_dialog"
        onClose={() => {
          setOpen(false);
        }}
      >
        {children}
      </dialog>
    </SelectUI>
  );
};

// SelectWithAction sets up action-aware state and delegates UI entirely to SelectBasic.
const SelectWithAction = (props) => {
  const {
    action,
    actionDebounce,
    actionAfterChange,
    loading,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    ...rest
  } = props;
  const uiState = useContext(UIStateContext);
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });
  useActionEvents(ref, {
    onCancel: (e, reason) => {
      onCancel?.(e, reason);
    },
    onRequested: (e) => {
      forwardActionRequested(e, boundAction);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd,
  });

  return (
    <SelectUI
      data-action={boundAction.name || "anonymous"}
      data-action-debounce={actionDebounce}
      data-action-after-change={actionAfterChange ? "" : undefined}
      {...rest}
      ref={ref}
      loading={loading || actionLoading}
    />
  );
};

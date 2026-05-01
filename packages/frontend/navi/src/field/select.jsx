import { createContext } from "preact";
import {
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";

import { Box } from "../box/box.jsx";
import { ChevronDownSvg } from "../graphic/icons/chevron_updown_svg.jsx";
import { LoaderBackground } from "../graphic/loader/loader_background.jsx";
import { shortcutsViaOnKeyDown } from "../keyboard/keyboard_shortcuts.js";
import { windowWidthSignal } from "../layout/responsive.js";
import { useDebugFocus } from "../navi_debug.jsx";
import {
  Dialog,
  requestDialogClose,
  requestDialogOpen,
} from "../popup/dialog.jsx";
import {
  Popover,
  requestPopoverClose,
  requestPopoverOpen,
} from "../popup/popover.jsx";
import { Icon } from "../text/icon.jsx";
import { useAutoFocus } from "../utils/focus/use_auto_focus.js";
import {
  reportDisabledToLabel,
  reportInteractiveToLabel,
  reportReadOnlyToLabel,
} from "./label.jsx";
import {
  DisabledContext,
  LoadingContext,
  LoadingElementContext,
  ParentUIStateControllerContext,
  ReadOnlyContext,
  useUIGroupStateController,
  useUIState,
} from "./use_ui_state_controller.js";
import { useConstraints } from "./validation/hooks/use_constraints.js";

const css = /* css */ `
  @layer navi {
    .navi_select {
      --select-border-radius: 2px;
      --select-border-width: 1px;
      --select-outline-width: 1px;
      --select-font-size: 14px;
      --select-padding-x-default: 8px;
      --select-padding-y-default: 5px;
      --select-border-color: light-dark(#767676, #8e8e93);
      --select-background-color: white;
      --select-color: currentColor;
      --select-placeholder-color: color-mix(
        in srgb,
        currentColor 60%,
        transparent
      );
      --select-border-color-hover: color-mix(
        in srgb,
        var(--select-border-color) 70%,
        black
      );
      --select-background-color-hover: color-mix(
        in srgb,
        var(--select-background-color) 95%,
        black
      );
    }
  }

  .navi_select {
    position: relative;
    box-sizing: border-box;
    padding-top: var(
      --select-padding-top,
      var(--select-padding-y, var(--select-padding-y-default))
    );
    padding-right: var(
      --select-padding-right,
      var(--select-padding-x, var(--select-padding-x-default))
    );
    padding-bottom: var(
      --select-padding-bottom,
      var(--select-padding-y, var(--select-padding-y-default))
    );
    padding-left: var(
      --select-padding-left,
      var(--select-padding-x, var(--select-padding-x-default))
    );
    color: var(--select-color);
    font-size: var(--select-font-size);
    text-align: inherit; /* override browser defaults on button which is center */
    white-space: nowrap; /* Prevent icon from going next line */
    background-color: var(--select-background-color);
    border: var(--select-border-width) solid transparent;
    border-radius: var(--select-border-radius);
    outline: var(--select-outline-width) solid var(--select-border-color);
    outline-offset: calc(-1 * var(--select-outline-width));
    cursor: pointer;
    user-select: none;

    &:hover {
      background-color: var(--select-background-color-hover);
      outline-color: var(--select-border-color-hover);
    }

    &:focus,
    &:focus-visible {
      outline-width: calc(
        var(--select-border-width) + var(--select-outline-width)
      );
      outline-color: var(--navi-focus-outline-color, #005fcc);
      outline-offset: calc(
        -1 * (var(--select-border-width) + var(--select-outline-width))
      );
    }

    &:disabled {
      opacity: 0.5;
      cursor: default;
    }

    .navi_list_container {
      --list-border-radius: 0;
    }

    .navi_select_trigger_text {
      display: inline-flex;
      min-width: 0;
      flex: 1;
      flex-direction: column;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
    }

    .navi_select_trigger_placeholder,
    .navi_select_trigger_value {
    }
    .navi_select_trigger_placeholder {
      color: var(--select-placeholder-color);

      &[hidden] {
        /* We keep placeholder in the dom in case it dictates the select width, this way select wont shrink once a value is selected */
        display: inline-block;
        height: 0;
        padding-block: 0;
        visibility: hidden;
      }
    }
    .navi_select_trigger_icon {
      margin-left: 6px;
      flex-shrink: 0;
      opacity: 0.6;
    }

    /* When the suggestion list inside the dialog has keyboard focus, show the
       focus ring on the dialog itself and suppress it on the list container. 
       It's visually better */
    &:has(.navi_list_container:focus) {
      outline-width: calc(
        var(--select-border-width) + var(--select-outline-width)
      );
      outline-color: var(--navi-focus-outline-color, #005fcc);
      outline-offset: calc(
        -1 * (var(--select-border-width) + var(--select-outline-width))
      );
    }
    .navi_list_container:focus {
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
      overscroll-behavior: none;
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
 *   uiAction    — called with the selected value when an item confirms a selection
 *   action      — server action (switches to WithAction variant)
 *   mode        — "popover" (default, anchored below trigger) | "dialog" (centered modal)
 *   children    — content rendered inside the popover/dialog (e.g. a <List>)
 *
 * Select exposes a ParentUIStateControllerContext so that a <List> placed inside
 * automatically reports its selected value to Select without explicit prop wiring.
 * Select in turn reports to a parent Form if one is present.
 *
 * Note: the trigger is type="button" — pressing Enter opens/closes the content
 * but does NOT submit a parent form. Use a separate submit button for that.
 */
export const Select = (props) => {
  const defaultRef = useRef(null);
  const ref = props.ref || defaultRef;
  const uiStateController = useUIGroupStateController(props, "select", {
    childComponentType: "list",
    aggregateChildStates: (childControllers) => {
      if (childControllers.length === 0) {
        return undefined;
      }
      return childControllers[0].uiState;
    },
    emptyState: undefined,
  });
  uiStateController.onUIStateChange = (value, e) => {
    uiStateController.uiAction?.(value, e);
  };
  const uiState = useUIState(uiStateController);
  const value = Object.hasOwn(props, "value") ? props.value : uiState;

  return (
    <ParentUIStateControllerContext.Provider value={uiStateController}>
      <SelectDispatcher {...props} ref={ref} value={value} />
    </ParentUIStateControllerContext.Provider>
  );
};

const SelectDispatcher = (props) => {
  const isSmallScreen = windowWidthSignal.value <= 600;
  const defaultMode = isSmallScreen ? "dialog" : "popover";
  const { mode = defaultMode } = props;
  if (mode === "dialog") {
    return <SelectWithDialog {...props} />;
  }
  if (mode === "popover") {
    return <SelectWithPopover {...props} />;
  }
  return <SelectUI {...props} />;
};

export const SelectPlaceholderContext = createContext();
const SelectValueContext = createContext(null);

const SelectUI = (props) => {
  import.meta.css = css;
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
    autoFocusPreventScroll,

    ...rest
  } = props;
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const hiddenInputId = useId();
  const remainingProps = useConstraints(ref, rest);

  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly = readOnly || contextReadOnly || innerLoading;
  const innerDisabled = disabled || contextDisabled;

  reportReadOnlyToLabel(innerReadOnly);
  reportDisabledToLabel(innerDisabled);
  reportInteractiveToLabel(true);
  useAutoFocus(ref, autoFocus, {
    preventScroll: autoFocusPreventScroll,
  });

  // Re-run constraint validation when value changes (e.g. required constraint reads data-navi-value)
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const validationInterface = el.__validationInterface__;
    if (!validationInterface) {
      return;
    }
    validationInterface.checkValidity();
  }, [value]);

  if (trigger === undefined) {
    trigger = <SelectTrigger />;
  }
  return (
    <Box
      as="button"
      type="button"
      {...remainingProps}
      baseClassName="navi_select"
      autoFocus={undefined} // See use_auto_focus.js
      data-navi-value={value || undefined}
      data-input-proxy={name ? `#${CSS.escape(hiddenInputId)}` : undefined}
      styleCSSVars={SelectStyleCSSVars}
      basePseudoState={{
        ...remainingProps.basePseudoState,
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
      <input
        id={hiddenInputId}
        type="hidden"
        name={name}
        value={value}
        required={rest.required}
      />
      <SelectPlaceholderContext.Provider value={placeholder}>
        <SelectValueContext.Provider value={value}>
          {trigger}
        </SelectValueContext.Provider>
        {children}
      </SelectPlaceholderContext.Provider>
    </Box>
  );
};
const SelectStyleCSSVars = {
  "borderWidth": "--select-border-width",
  "borderRadius": "--select-border-radius",
  "paddingX": "--select-padding-x",
  "paddingY": "--select-padding-y",
  "paddingTop": "--select-padding-top",
  "paddingRight": "--select-padding-right",
  "paddingBottom": "--select-padding-bottom",
  "paddingLeft": "--select-padding-left",
  "background": "--select-background",
  "backgroundColor": "--select-background-color",
  "borderColor": "--select-border-color",
  "color": "--select-color",
  "fontSize": "--select-font-size",
  ":hover": {
    backgroundColor: "--select-background-color-hover",
    borderColor: "--select-border-color-hover",
    color: "--select-color-hover",
  },
  ":focus": {
    backgroundColor: "--select-background-color-focus",
    borderColor: "--select-border-color-focus",
  },
  ":active": {
    backgroundColor: "--select-background-color-active",
    borderColor: "--select-border-color-active",
  },
  ":read-only": {
    backgroundColor: "--select-background-color-readonly",
    borderColor: "--select-border-color-readonly",
    color: "--select-color-readonly",
  },
  ":disabled": {
    backgroundColor: "--select-background-color-disabled",
    borderColor: "--select-border-color-disabled",
    color: "--select-color-disabled",
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
  ":-navi-expanded",
];
const SelectPseudoElements = ["::-navi-loader"];

const SelectTrigger = () => {
  const placeholder = useContext(SelectPlaceholderContext);
  const value = useContext(SelectValueContext);
  const hasValue = value !== null && value !== undefined && value !== "";
  const isPlaceholder = !hasValue;

  return (
    <>
      <span className="navi_select_trigger_text">
        <span className="navi_select_trigger_placeholder" hidden={hasValue}>
          {placeholder}
        </span>
        <span className="navi_select_trigger_value" hidden={isPlaceholder}>
          {value}
        </span>
      </span>
      <Icon className="navi_select_trigger_icon">
        <ChevronDownSvg />
      </Icon>
    </>
  );
};

// SelectWithPopover — trigger + popover anchored below the trigger.
const SelectWithPopover = (props) => {
  const {
    ref,
    disabled,
    onKeyDown,
    children,
    positionTry,
    pointerTrap,
    scrollTrap = true,
    focusTrap = true,
    ...rest
  } = props;
  const debugFocus = useDebugFocus();
  const popoverRef = useRef(null);
  const popoverId = useId();
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const onOpen = () => {
    expandedRef.current = true;
    setExpanded(true);
  };
  const onClose = () => {
    expandedRef.current = false;
    setExpanded(false);
  };
  const requestOpen = (e) => {
    return requestPopoverOpen(popoverRef.current, {
      event: e,
      anchor: ref.current,
    });
  };
  const requestClose = (e) => {
    return requestPopoverClose(popoverRef.current, { event: e });
  };
  const moveFocusToSelect = (e) => {
    const select = ref.current;
    debugFocus(`moveFocusToSelect("${e.type}")`);
    select.focus({ preventScroll: true, focusVisible: true });
  };

  return (
    <SelectDispatcher
      disabled={disabled}
      aria-haspopup="listbox"
      aria-expanded={expanded}
      aria-controls={popoverId}
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        if (disabled) {
          return;
        }
        if (expandedRef.current) {
          requestClose(e);
        } else {
          e.preventDefault(); // prevent browser trying to give focus to the select (popover will take focus)
          debugFocus(`select mousedown.preventDefault()`);
          requestOpen(e);
        }
      }}
      onClick={(e) => {
        if (e.detail === 0) {
          // click triggered by enter won't open the popover
          return;
        }
        // When a label is clicked it transfers focus to the select
        // in that case we want to open it (otherwise we have already opened on mousedown interaction)
        requestOpen(e);
      }}
      // When a list item is interacted via mousedown, return focus to the select.
      onnavi_list_select={(e) => {
        const { event } = e.detail;
        if (event.type === "mousedown") {
          event.preventDefault(); // prevent browser trying to give focus to the list item
          debugFocus(`listItem mousedown.preventDefault()`);
        }
        if (event.key === " ") {
          // space can open the popover we don't want space to propagate to the select otherwise it would open it back immediatly
          event.stopPropagation();
        }
        requestClose(e);
        moveFocusToSelect(e);
      }}
      onFocusOut={(e) => {
        if (import.meta.dev) {
          // during dev disable to allow inspecting the select (hot fix for now to ease life during dev)
          return;
        }
        // Close when focus leaves the select entirely (not just moving between internal elements).
        // relatedTarget is the element receiving focus; if it's inside the select or the popover, keep open.
        const relatedTarget = e.relatedTarget;
        const selectEl = ref.current;
        const popoverEl = popoverRef.current;
        const focusStaysInside =
          (selectEl && selectEl.contains(relatedTarget)) ||
          (popoverEl && popoverEl.contains(relatedTarget));
        if (!focusStaysInside) {
          requestClose(e);
        }
      }}
      {...rest}
      onKeyDown={shortcutsViaOnKeyDown(
        {
          arrowdown: (e) => {
            e.preventDefault(); // prevent container scroll
            requestOpen(e);
          },
          arrowup: (e) => {
            e.preventDefault(); // prevent container scroll
            requestOpen(e);
          },
          space: (e) => {
            e.preventDefault(); // prevent scroll
            requestOpen(e);
          },
          escape: (e) => {
            if (!expandedRef.current) {
              return;
            }
            e.preventDefault();
            requestClose(e);
            moveFocusToSelect(e);
          },
        },
        onKeyDown,
      )}
      ref={ref}
      mode="ui"
    >
      <Popover
        ref={popoverRef}
        className="navi_select_popover"
        onMouseDown={(e) => {
          if (e.button !== 0) {
            return;
          }
          // mousedown inside popover should not bubble to the select (would re-open it if that mousedown closes it)
          e.stopPropagation();
        }}
        onnavi_popover_open={(e) => {
          onOpen(e);
        }}
        onnavi_popover_close={(e) => {
          onClose(e);
          const { event = e } = e.detail;
          if (event.type === "focusout") {
            // If the popover closed because focus left the select (focusout),
            // don't steal focus back — let focus go where the user intended.
          } else {
            moveFocusToSelect(e);
          }
        }}
        positionTry={positionTry}
        scrollTrap={scrollTrap}
        pointerTrap={pointerTrap}
        focusTrap={focusTrap}
      >
        {children}
      </Popover>
    </SelectDispatcher>
  );
};
// SelectWithDialog — trigger + centered modal dialog.
const SelectWithDialog = (props) => {
  let { ref, disabled, onKeyDown, children, scrollTrap, pointerTrap, ...rest } =
    props;
  const debugFocus = useDebugFocus();
  const dialogRef = useRef(null);
  const dialogId = useId();
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const onOpen = () => {
    expandedRef.current = true;
    setExpanded(true);
  };
  const onClose = () => {
    expandedRef.current = false;
    setExpanded(false);
  };
  const requestOpen = (e) => {
    return requestDialogOpen(dialogRef.current, {
      event: e,
    });
  };
  const requestClose = (e) => {
    return requestDialogClose(dialogRef.current, {
      event: e,
    });
  };
  const moveFocusToSelect = (e) => {
    debugFocus(`moveFocusToSelect("${e.type}")`);
    ref.current.focus({ preventScroll: true, focusVisible: true });
  };

  return (
    <SelectDispatcher
      disabled={disabled}
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-controls={dialogId}
      onMouseDown={(e) => {
        if (e.button !== 0) {
          return;
        }
        if (disabled) {
          return;
        }
        if (expandedRef.current) {
          requestClose(e);
        } else {
          e.preventDefault(); // prevent browser trying to give focus to the select (dialog will take focus)
          debugFocus(`select mousedown.preventDefault()`);
          requestOpen(e);
        }
      }}
      onClick={(e) => {
        if (e.detail === 0) {
          // click triggered by enter won't open the dialog
          return;
        }
        // When a label is clicked it transfers focus to the select, in that case we want to open it
        requestOpen(e);
      }}
      onnavi_list_select={(e) => {
        const { event } = e.detail;
        if (event.key === " ") {
          // space can open the dialog, we don't want space to propagate to the select otherwise it would open it back immediately
          event.stopPropagation();
        }
        requestClose(e);
      }}
      {...rest}
      onKeyDown={shortcutsViaOnKeyDown(
        {
          arrowdown: (e) => {
            e.preventDefault();
            requestOpen(e);
          },
          arrowup: (e) => {
            e.preventDefault();
            requestOpen(e);
          },
          space: (e) => {
            e.preventDefault();
            if (!expandedRef.current) {
              requestOpen(e);
            }
          },
          escape: () => {
            if (!expandedRef.current) {
              return;
            }
            // native <dialog> handles closing on Escape; we just need focus back
            // (the onClose handler also calls moveFocusToSelect but escape fires before it)
          },
        },
        onKeyDown,
      )}
      ref={ref}
      mode="ui"
    >
      <Dialog
        ref={dialogRef}
        className="navi_select_dialog"
        onnavi_dialog_open={(e) => {
          onOpen(e);
        }}
        onnavi_dialog_close={(e) => {
          onClose(e);
          moveFocusToSelect(e);
        }}
        scrollTrap={scrollTrap}
        pointerTrap={pointerTrap}
      >
        {children}
      </Dialog>
    </SelectDispatcher>
  );
};

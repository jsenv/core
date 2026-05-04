import { createContext } from "preact";
import { useContext, useId, useRef, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";
import { ChevronDownSvg } from "../graphic/icons/chevron_updown_svg.jsx";
import { LoaderBackground } from "../graphic/loader/loader_background.jsx";
import { shortcutsViaOnKeyDown } from "../keyboard/keyboard_shortcuts.js";
import { windowWidthSignal } from "../layout/responsive.js";
import {
  formatEventSideEffect,
  useDebugFocus,
  useDebugPopup,
} from "../navi_debug.jsx";
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
      --select-outline-width: 1px;
      --select-border-width: 1px;
      --select-font-size: 14px;
      --select-padding-x-default: 8px;
      --select-padding-y-default: 5px;
      --select-outline-color: var(--navi-focus-outline-color);
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
    --x-select-background-color: var(--select-background-color);
    --x-select-border-color: var(--select-border-color);
    /* outline will draw the border when visible */
    --x-select-outline-width: calc(
      var(--select-outline-width) + var(--select-border-width)
    );
    --x-select-outline-offset: calc(-1 * var(--select-border-width));
    --x-select-padding-top: var(
      --select-padding-top,
      var(--select-padding-y, var(--select-padding-y-default))
    );
    --x-select-padding-right: var(
      --select-padding-right,
      var(--select-padding-x, var(--select-padding-x-default))
    );
    --x-select-padding-left: var(
      --select-padding-left,
      var(--select-padding-x, var(--select-padding-x-default))
    );
    --x-select-padding-bottom: var(
      --select-padding-bottom,
      var(--select-padding-y, var(--select-padding-y-default))
    );

    position: relative;
    box-sizing: border-box;
    padding-top: var(--x-select-padding-top);
    padding-right: var(--x-select-padding-right);
    padding-bottom: var(--x-select-padding-bottom);
    padding-left: var(--x-select-padding-left);
    color: var(--select-color);
    font-size: var(--select-font-size);
    text-align: inherit; /* override browser defaults on button which is center */
    white-space: nowrap; /* Prevent icon from going next line */
    background-color: var(--x-select-background-color);
    border-width: var(--select-border-width);
    border-style: solid;
    border-color: var(--x-select-border-color);
    border-radius: var(--select-border-radius);
    outline-width: var(--x-select-outline-width);
    outline-color: var(--select-outline-color);
    outline-offset: var(--x-select-outline-offset);
    user-select: none;

    &[data-hover] {
      --x-select-background-color: var(--select-background-color-hover);
      --x-select-border-color: var(--select-border-color-hover);
    }

    &[data-focus-visible] {
      --x-select-border-color: transparent;
      outline-style: solid;
    }

    &[data-disabled] {
      opacity: 0.5;
      cursor: default;
    }
    &[data-callout] {
      --x-select-border-color: var(--callout-color);
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
        display: inline-block !important;
        height: 0;
        padding-block: 0;
        visibility: hidden;
      }
    }
    .navi_select_trigger_icon {
      flex-shrink: 0;
      opacity: 0.6;
    }

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

      .navi_select_popover {
        position: absolute;
        inset: unset;
        min-width: var(--anchor-width, 0px);
        max-width: 95vw;
        /* max-height covers the placeholder + list; the list scrolls internally */
        max-height: 95dvh;
        margin: 0;
        padding: 0;
        background: var(--select-background-color);
        border-width: var(--select-border-width);
        border-style: solid;
        border-color: var(--x-select-border-color);
        border-radius: var(--select-border-radius);
        outline-width: var(--x-select-outline-width);
        outline-color: var(--select-outline-color);
        outline-offset: var(--x-select-outline-offset);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
        cursor: default; /* Reset pointer cursor within the select */
        overflow: hidden;
        overscroll-behavior: none;

        /* The anchor placeholder is a non-interactive visual clone of the
           trigger. It makes the popover wrap both the trigger area and the list
           under a single border/shadow. CSS order places it before the list
           when the popover is below the trigger, and after when above. */
        .navi_select_anchor_clone {
          /* Mirror the trigger's padding so the clone looks identical */
          padding-top: var(--x-select-padding-top);
          padding-right: var(--x-select-padding-right);
          padding-bottom: var(--x-select-padding-bottom);
          padding-left: var(--x-select-padding-left);
          flex-shrink: 0;
          order: -1; /* before the list — popover is below the trigger */
          background: var(--x-select-background-color);
          border-bottom: var(--select-border-width) solid
            var(--x-select-border-color);

          &:hover {
            --x-select-background-color: var(--select-background-color-hover);
            --x-select-border-color: var(--select-border-color-hover);
          }
        }

        &[data-position-y-current="above"],
        &[data-position-y-current="above-overlap"] {
          .navi_select_anchor_clone {
            order: 1; /* after the list — popover is above the trigger */
            border-top: var(--select-border-width) solid
              var(--x-select-border-color);
            border-bottom: none;
          }
        }

        /* The list scrolls inside the popover */
        .navi_list_container {
          overflow: auto;
          overscroll-behavior: none;
        }
      }

      &:has([data-hover]) {
        .navi_select_popover {
          --x-select-border-color: var(--select-border-color-hover);
        }
      }
      &:has([data-focus-visible]) {
        .navi_select_popover {
          outline-style: solid;
        }
      }

      &[aria-expanded="true"] {
        border-top-color: var(--select-border-color);
        border-top-left-radius: 0;
        border-top-right-radius: 0;

        .navi_select_popover {
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

      .navi_select_dialog {
        max-height: 95dvh;
        margin: auto;
        padding: 0;
        background: var(--select-background-color);
        border: var(--select-border-width) solid var(--x-select-border-color);
        border-radius: var(--select-border-radius);
        outline-width: var(--x-select-outline-width);
        outline-color: var(--select-outline-color);
        outline-offset: var(--x-select-outline-offset);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
        cursor: default; /* Reset pointer cursor within the select */

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
  const uiState = useUIState(uiStateController);
  const value = Object.hasOwn(props, "value") ? props.value : uiState;

  return (
    <ParentUIStateControllerContext.Provider value={uiStateController}>
      <SelectDispatcher
        trigger={<SelectTrigger />}
        {...props}
        ref={ref}
        value={value}
      />
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

const SelectUI = (props) => {
  import.meta.css = css;
  const {
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
  const hiddenInputRef = useRef(null);
  const remainingProps = useConstraints(hiddenInputRef, rest);

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

  return (
    <Box
      as="button"
      type="button"
      {...remainingProps}
      baseClassName="navi_select"
      autoFocus={undefined} // See use_auto_focus.js
      data-navi-value={value || undefined}
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
        ref={hiddenInputRef}
        id={hiddenInputId}
        type="hidden"
        name={name}
        value={value}
        required={rest.required}
        data-rendered-by=".navi_select"
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
export const SelectPlaceholderContext = createContext();
const SelectValueContext = createContext(null);
const SelectStyleCSSVars = {
  "outlineWidth": "--select-outline-width",
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
  ":focus-within",
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
    <Box flex spacing="s">
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
    </Box>
  );
};

// SelectWithPopover — trigger + popover anchored below the trigger.
const SelectWithPopover = (props) => {
  const {
    ref,
    disabled,
    onKeyDown,
    children,
    pointerTrap,
    scrollTrap = true,
    focusTrap = true,
    ...rest
  } = props;
  const debugFocus = useDebugFocus();
  const debugPopup = useDebugPopup();
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
    // scroll select into view when opening it
    ref.current.scrollIntoView({ block: "nearest" });

    return requestPopoverOpen(popoverRef.current, {
      event: e,
      anchor: ref.current,
    });
  };
  const [shouldIgnoreThatClick, disableClickFor] = useIgnoreClickForMousedown();
  const requestClose = (e = new CustomEvent("programmatic")) => {
    if (e.type === "mousedown") {
      debugPopup(formatEventSideEffect(e, `disable click`));
      disableClickFor(e);
    }
    return requestPopoverClose(popoverRef.current, { event: e });
  };
  const moveFocusToSelect = (e) => {
    const select = ref.current;
    debugFocus(`moveFocusToSelect("${e.type}")`);
    select.focus({ preventScroll: true });
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
        if (shouldIgnoreThatClick) {
          debugPopup(formatEventSideEffect(e, `ignore click`));
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
        requestClose(event);
        moveFocusToSelect(event);
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
            moveFocusToSelect(event);
          }
        }}
        positionX="left-aligned"
        positionY="below-overlap"
        scrollTrap={scrollTrap}
        pointerTrap={pointerTrap}
        focusTrap={focusTrap}
      >
        {/* Clone the trigger visually so the popover wraps both the trigger
            and the list with a unified border/shadow. The clone is not
            interactive — the real trigger behind it handles all events. */}
        <div
          className="navi_select_anchor_clone"
          onMouseDown={(e) => {
            if (e.button !== 0) {
              return;
            }
            requestClose(e);
          }}
        >
          {props.trigger}
        </div>
        <SelectRequestCloseContext.Provider value={requestClose}>
          {children}
        </SelectRequestCloseContext.Provider>
      </Popover>
    </SelectDispatcher>
  );
};
// SelectWithDialog — trigger + centered modal dialog.
const SelectWithDialog = (props) => {
  let { ref, disabled, onKeyDown, children, scrollTrap, pointerTrap, ...rest } =
    props;
  const debugFocus = useDebugFocus();
  const debugPopup = useDebugPopup();
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
  const [shouldIgnore, disableClickFor] = useIgnoreClickForMousedown();

  const requestClose = (e = new CustomEvent("programmatic")) => {
    if (e.type === "mousedown") {
      debugPopup(formatEventSideEffect(e, `disable click`));
      disableClickFor(e);
    }
    return requestDialogClose(dialogRef.current, {
      event: e,
    });
  };
  const moveFocusToSelect = (e) => {
    debugFocus(`moveFocusToSelect("${e.type}")`);
    ref.current.focus({ preventScroll: true });
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
        if (shouldIgnore) {
          debugPopup(formatEventSideEffect(e, `ignore click`));
          // mousedown on the select already handled open/close; ignore this click
          // to avoid toggling the dialog again on mouseup
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
        requestClose(event);
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
        onMouseDown={(e) => {
          if (e.button !== 0) {
            return;
          }
          // mousedown inside dialog should not bubble to the select (would re-open it if that mousedown closes it)
          e.stopPropagation();
        }}
        scrollTrap={scrollTrap}
        pointerTrap={pointerTrap}
      >
        <SelectRequestCloseContext.Provider value={requestClose}>
          {children}
        </SelectRequestCloseContext.Provider>
      </Dialog>
    </SelectDispatcher>
  );
};

const SelectRequestCloseContext = createContext();
export const useSelectRequestClose = () => {
  return useContext(SelectRequestCloseContext);
};

/**
 * Hook to prevent a `click` event from firing after a `mousedown` that already
 * handled an open/close action.
 *
 * Problem: when the user clicks a dialog's backdrop to close it, the browser
 * fires `mousedown` on the backdrop (which closes the dialog), then fires
 * `click` on whatever element is underneath once the dialog is gone. If that
 * element is the trigger button that originally opened the dialog, the `click`
 * would immediately re-open it.
 *
 * This problem only occurs when the dialog is closed on `mousedown`. If the
 * dialog were closed on `click` instead, the dialog would still be open when
 * the `click` fires on the backdrop, so the trigger button underneath would
 * never receive that `click`.
 *
 * Calling `stopPropagation()` or `preventDefault()` on the backdrop `mousedown`
 * does not help: the browser dispatches the subsequent `click` regardless,
 * targeting whichever element ends up under the pointer after the dialog closes.
 *
 * Usage:
 *   const [shouldIgnoreThatClick, disableClickFor] = useIgnoreClickForMousedown();
 *   // In onMouseDown (e.g. on the dialog backdrop): disableClickFor(e)
 *   // In onClick (on the trigger): if (shouldIgnoreThatClick) return;
 *
 * `disableClickFor` arms the guard until the next `mouseup` on the document
 * (with a 1 s safety-net fallback), using `requestAnimationFrame` so the
 * `click` event — which fires synchronously after `mouseup` — is still blocked.
 */
const useIgnoreClickForMousedown = () => {
  const pendingMousedownRef = useRef(false);

  const shouldIgnore = pendingMousedownRef.current;
  const disableClickFor = () => {
    pendingMousedownRef.current = true;

    const restoreClick = () => {
      clearTimeout(safetyTimeout);
      pendingMousedownRef.current = false;
    };
    const safetyTimeout = setTimeout(() => {
      pendingMousedownRef.current = false;
      restoreClick();
    }, 1000);
    document.addEventListener(
      "mouseup",
      () => {
        requestAnimationFrame(() => {
          restoreClick();
        });
      },
      { once: true, capture: true },
    );
  };
  return [shouldIgnore, disableClickFor];
};

/**
 * Input component for all textual input types.
 *
 * Supports:
 * - text (default)
 * - password
 * - hidden
 * - email
 * - url
 * - search
 * - tel
 * - etc.
 *
 * For non-textual inputs, specialized components will be used:
 * - <InputCheckbox /> for type="checkbox"
 * - <InputRadio /> for type="radio"
 */

import { createContext } from "preact";
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from "preact/hooks";

import { useActionBoundToOneParam } from "../action/use_action.js";
import { useActionStatus } from "../action/use_action_status.js";
import { useExecuteAction } from "../action/use_execute_action.js";
import { Box } from "../box/box.jsx";
import { ChevronDownSvg } from "../graphic/icons/chevron_updown_svg.jsx";
import { CloseSvg } from "../graphic/icons/close_svg.jsx";
import { EmailSvg } from "../graphic/icons/email_svg.jsx";
import { PhoneSvg } from "../graphic/icons/phone_svg.jsx";
import { SearchSvg } from "../graphic/icons/search_svg.jsx";
import { LoaderBackground } from "../graphic/loader/loader_background.jsx";
import { shortcutsViaOnKeyDown } from "../keyboard/keyboard_shortcuts.js";
import { Icon } from "../text/icon.jsx";
import { useAutoFocus } from "../utils/focus/use_auto_focus.js";
import { useStableCallback } from "../utils/use_stable_callback.js";
import { fieldPropSet } from "./field_prop_set.js";
import {
  Label,
  reportDisabledToLabel,
  reportInteractiveToLabel,
  reportReadOnlyToLabel,
} from "./label.jsx";
import {
  ListIdContext,
  requestListClose,
  requestListInteractionStateReset,
  requestListNavFromCurrent,
  requestListOpen,
  requestListSelectCurrent,
} from "./list/list.jsx";
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
import { useConstraints } from "./validation/hooks/use_constraints.js";

const css = /* css */ `
  @layer navi {
    .navi_input {
      --border-radius: 2px;
      --border-width: 1px;
      --outline-width: 1px;
      --font-size: 14px;

      /* Default */
      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --color: currentColor;
      --color-dimmed: color-mix(in srgb, currentColor 60%, transparent);
      --placeholder-color: var(--color-dimmed);
      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
      --color-hover: var(--color);
      /* Active */
      --border-color-active: color-mix(in srgb, var(--border-color) 90%, black);
      /* Focus */
      --border-color-focus: var(--border-color);
      --background-color-focus: var(--background-color);
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 45%,
        transparent
      );
      --background-color-readonly: var(--background-color);
      --color-readonly: var(--color-dimmed);
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: color-mix(
        in srgb,
        var(--background-color) 95%,
        grey
      );
      --color-disabled: color-mix(in srgb, var(--color) 95%, grey);
    }
  }

  .navi_input {
    /* outline will draw the border when visible */
    --x-outline-width: var(--outline-width) + var(--border-width);
    --x-outline-offset: calc(-1 * var(--border-width));
    --left-slot-size: 0px;
    --right-slot-size: 0px;
    --x-border-color: var(--border-color);
    --x-background-color: var(--background-color);
    --x-color: var(--color);
    --x-placeholder-color: var(--placeholder-color);

    position: relative;
    box-sizing: border-box;
    width: fit-content;
    height: fit-content;
    flex-direction: inherit;
    border-radius: inherit;
    cursor: inherit;

    --x-padding-top-base: var(
      --padding-top,
      var(--padding-y, var(--padding, 1px))
    );
    --x-padding-right-base: var(
      --padding-right,
      var(--padding-x, var(--padding, 2px))
    );
    --x-padding-bottom-base: var(
      --padding-bottom,
      var(--padding-y, var(--padding, 1px))
    );
    --x-padding-left-base: var(
      --padding-left,
      var(--padding-x, var(--padding, 2px))
    );

    .navi_native_input {
      box-sizing: border-box;
      min-width: 50px;
      padding-top: var(--x-padding-top-base);
      padding-right: calc(var(--x-padding-right-base) + var(--right-slot-size));
      padding-bottom: var(--x-padding-bottom-base);
      padding-left: calc(var(--x-padding-left-base) + var(--left-slot-size));
      color: var(--x-color);
      font-size: var(--font-size);
      background-color: var(--x-background-color);
      border-width: var(--border-width);
      border-style: solid;
      border-color: var(--x-border-color);
      border-radius: var(--border-radius);
      outline-width: var(--x-outline-width);
      outline-color: var(--outline-color);
      outline-offset: var(--x-outline-offset);

      &[type="search"] {
        -webkit-appearance: textfield;

        &::-webkit-search-cancel-button {
          display: none;
        }
      }
    }

    .navi_input_slot {
      position: absolute;
      top: 0;
      bottom: 0;
      display: inline-flex;
      margin: 0;
      padding: 0;
      align-items: center;
      justify-content: center;
      font-size: var(--font-size);
      background: none;
      border: none;

      &[data-left] {
        left: var(--x-padding-left-base);
        width: var(--left-slot-size);
      }
      &[data-right] {
        right: var(--x-padding-right-base);
        width: var(--right-slot-size);
      }
      &[data-hide-while-empty] {
        opacity: 0;
        pointer-events: none;
      }
    }
    &[data-has-value] {
      .navi_input_slot[data-hide-while-empty] {
        opacity: 1;
        cursor: pointer;
        pointer-events: auto;
      }

      &[data-readonly] {
        .navi_input_slot[data-hide-while-empty] {
          opacity: 0;
          pointer-events: none;
        }
      }
      &[data-disabled] {
        .navi_input_slot[data-hide-while-empty] {
          opacity: 0;
          pointer-events: none;
        }
      }
    }
    &:has(.navi_input_slot[data-left]) {
      --left-slot-size: 1em;
    }
    &:has(.navi_input_slot[data-right]) {
      --right-slot-size: 1em;
    }

    /* Hover */
    &[data-hover] {
      --x-background-color: var(--background-color-hover);
      --x-border-color: var(--border-color-hover);
      --x-color: var(--color-hover);
    }
    /* Readonly */
    &[data-readonly] {
      --x-border-color: var(--border-color-readonly);
      --x-background-color: var(--background-color-readonly);
      --x-color: var(--color-readonly);
    }
    /* Focus */
    &[data-focus],
    &[data-focus-visible] {
      --x-background-color: var(--background-color-focus);
      --x-border-color: transparent;

      .navi_native_input {
        outline-style: solid;
      }
    }
    /* Disabled */
    &[data-disabled] {
      --x-border-color: var(--border-color-disabled);
      --x-background-color: var(--background-color-disabled);
      --x-color: var(--color-disabled);
    }
    /* Callout (info, warning, error) */
    &[data-callout] {
      --x-border-color: var(--callout-color);
      --x-outline-color: var(--callout-color);
    }
  }

  .navi_input .navi_native_input::placeholder {
    color: var(--x-placeholder-color);
  }
  .navi_input .navi_native_input:-internal-autofill-selected {
    /* Webkit is putting some nasty styles after automplete that look as follow */
    /* input:-internal-autofill-selected { color: FieldText !important; } */
    /* Fortunately we can override it as follow */
    -webkit-text-fill-color: var(--x-color) !important;
  }
`;

export const InputTextual = (props) => {
  const defaultRef = useRef(null);
  const ref = props.ref || defaultRef;
  const uiStateController = useUIStateController(props, "input");
  const uiState = useUIState(uiStateController);

  return (
    <UIStateControllerContext.Provider value={uiStateController}>
      <UIStateContext.Provider value={uiState}>
        <InputTextualDispatcher {...props} ref={ref} />
      </UIStateContext.Provider>
    </UIStateControllerContext.Provider>
  );
};
const InputTextualDispatcher = (props) => {
  const listIdFromContext = useContext(ListIdContext);

  if (props.action) {
    return <InputTextualWithAction {...props} />;
  }
  if (listIdFromContext) {
    return <InputControllingList listId={listIdFromContext} {...props} />;
  }
  if (props.listId) {
    return <InputControllingList {...props} />;
  }
  if (props.suggestions) {
    return <InputTextualWithSuggestions {...props} />;
  }
  return <InputTextualUI {...props} />;
};

const InputNativeContext = createContext(null);
const InputTextualUI = (props) => {
  import.meta.css = css;
  const {
    ref,
    type,
    onInput,
    onKeyDown,

    readOnly,
    disabled,
    loading,

    autoFocus,
    autoFocusVisible,
    autoSelect,
    basePseudoState,
    children,

    ...rest
  } = props;
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);

  const innerValue =
    type === "datetime-local" ? convertToLocalTimezone(uiState) : uiState;
  const innerLoading =
    loading || (contextLoading && contextLoadingElement === ref.current);
  const innerReadOnly =
    readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <label> parent of our readOnly state + that we are interactive
  reportReadOnlyToLabel(innerReadOnly);
  reportDisabledToLabel(innerDisabled);
  reportInteractiveToLabel(true);
  useAutoFocus(ref, autoFocus, {
    focusVisible: autoFocusVisible,
    autoSelect,
  });
  const remainingProps = useConstraints(ref, rest);

  const onInputStable = useStableCallback(onInput);
  const onKeyDownStable = useStableCallback(onKeyDown);
  const autoId = useId();
  const innerId = rest.id || autoId;
  const renderInput = (inputProps) => {
    return (
      <Box
        {...inputProps}
        as="input"
        id={innerId}
        ref={ref}
        type={type}
        data-value={uiState}
        value={innerValue}
        onInput={(e) => {
          let inputValue;
          if (type === "number") {
            inputValue = e.target.valueAsNumber;
            if (isNaN(inputValue)) {
              inputValue = e.target.value;
            }
          } else if (type === "datetime-local") {
            inputValue = convertToUTCTimezone(e.target.value);
          } else {
            inputValue = e.target.value;
          }
          uiStateController.setUIState(inputValue, e);
          onInputStable?.(e);
        }}
        onKeyDown={(e) => {
          onKeyDownStable?.(e);
        }}
        onresetuistate={(e) => {
          uiStateController.resetUIState(e);
        }}
        onsetuistate={(e) => {
          uiStateController.setUIState(e.detail.value, e);
        }}
        // style management
        baseClassName="navi_native_input"
        data-rendered-by=".navi_input"
      />
    );
  };
  const renderInputMemoized = useCallback(renderInput, [
    type,
    uiState,
    innerValue,
    innerId,
    autoFocus,
  ]);

  let innerChildren;
  if (children) {
    innerChildren = children;
  } else if (type === "search") {
    innerChildren = (
      <>
        <InputLeftSlot>
          <Icon color="rgba(28, 43, 52, 0.5)">
            <SearchSvg />
          </Icon>
        </InputLeftSlot>
        <InputRightSlot
          hideWhileEmpty
          onClick={() => {
            uiStateController.setUIState("", { trigger: "cancel_button" });
            ref.current.value = "";
            ref.current.dispatchEvent(new Event("navi_delete_content"));
          }}
        >
          <Icon color="rgba(28, 43, 52, 0.5)">
            <CloseSvg />
          </Icon>
        </InputRightSlot>
      </>
    );
  } else if (type === "email") {
    innerChildren = (
      <InputLeftSlot>
        <Icon color="rgba(28, 43, 52, 0.5)">
          <EmailSvg />
        </Icon>
      </InputLeftSlot>
    );
  } else if (type === "tel") {
    innerChildren = (
      <InputLeftSlot>
        <Icon color="rgba(28, 43, 52, 0.5)">
          <PhoneSvg />
        </Icon>
      </InputLeftSlot>
    );
  }

  return (
    <Box
      as="span"
      flex
      baseClassName="navi_input"
      styleCSSVars={InputStyleCSSVars}
      pseudoStateSelector=".navi_native_input"
      visualSelector=".navi_native_input"
      basePseudoState={{
        ...basePseudoState,
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
        ":-navi-loading": innerLoading,
      }}
      pseudoClasses={InputPseudoClasses}
      pseudoElements={InputPseudoElements}
      hasChildFunction
      baseChildPropSet={InputChildPropSet}
      {...remainingProps}
      ref={undefined}
      autoFocus={undefined} // See use_auto_focus.js
    >
      <LoaderBackground
        loading={innerLoading}
        color="var(--loader-color)"
        inset={-1}
      />
      {renderInputMemoized}
      {innerChildren ? (
        <InputNativeContext.Provider
          value={{
            id: innerId,
            readOnly: innerReadOnly,
            disabled: innerDisabled,
          }}
        >
          {innerChildren}
        </InputNativeContext.Provider>
      ) : null}
    </Box>
  );
};
const InputStyleCSSVars = {
  "outlineWidth": "--outline-width",
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
const InputPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
  ":-navi-has-value",
  ":-navi-expanded",
];
const InputPseudoElements = ["::-navi-loader"];
const InputChildPropSet = new Set([...fieldPropSet]);
const InputSlot = ({ side, onClick, hideWhileEmpty, ...props }) => {
  const ctx = useContext(InputNativeContext);
  const { id, readOnly, disabled } = ctx;

  return (
    <Label
      htmlFor={id}
      className="navi_input_slot"
      disabled={disabled}
      readOnly={readOnly}
      data-readonly={readOnly}
      data-disabled={disabled}
      data-left={side === "left" ? "" : undefined}
      data-right={side === "right" ? "" : undefined}
      data-hide-while-empty={hideWhileEmpty ? "" : undefined}
      flex
      alignY="center"
      onMouseDown={(e) => {
        // Only prevent focus from leaving when the input already has focus.
        // If the input is not focused, let the mousedown proceed normally so
        // the slot element (e.g. a clear button) can receive focus itself.
        const inputEl = document.getElementById(id);
        if (inputEl && inputEl === document.activeElement) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        if (readOnly || disabled) {
          return;
        }
        onClick?.(e);
      }}
      {...props}
    />
  );
};
export const InputLeftSlot = (props) => {
  return <InputSlot {...props} side="left" />;
};
export const InputRightSlot = (props) => {
  return <InputSlot {...props} side="right" />;
};

const InputControllingList = (props) => {
  const { ref, listId, onKeyDown, ...rest } = props;

  const getListEl = () => {
    return document.getElementById(listId);
  };

  const onKeyDownWithShortcuts = shortcutsViaOnKeyDown(
    {
      arrowdown: (e) => {
        const listEl = getListEl();
        e.stopPropagation(); // when within a list, prevent list from handling it twice
        return requestListNavFromCurrent(listEl, {
          event: e,
          goal: "down",
        });
      },
      arrowup: (e) => {
        const listEl = getListEl();
        e.stopPropagation(); // when within a list, prevent list from handling it twice
        return requestListNavFromCurrent(listEl, {
          event: e,
          goal: "up",
        });
      },
      home: (e) => {
        const listEl = getListEl();
        e.stopPropagation(); // when within a list, prevent list from handling it twice
        return requestListNavFromCurrent(listEl, {
          event: e,
          goal: "first",
        });
      },
      end: (e) => {
        const listEl = getListEl();
        e.stopPropagation(); // when within a list, prevent list from handling it twice
        return requestListNavFromCurrent(listEl, {
          event: e,
          goal: "last",
        });
      },
      enter: (e) => {
        const listEl = getListEl();
        e.stopPropagation(); // when within a list, prevent list from handling it twice
        return requestListSelectCurrent(listEl, { event: e });
      },
      escape: (e) => {
        // prevent escape from reaching eventual <select> ancestor
        // when the escape is meant to clear the search input (otherwise it would close the select too)
        if (e.currentTarget.type === "search" && e.currentTarget.value !== "") {
          e.stopPropagation();
          return true;
        }
        const listEl = getListEl();
        // here we allow propagation of escape up to the <select> to allow closing if within a select
        // it also means list might catch escape and reset again but it's ok to reset twice here as it won't cause side effects
        // (if we need the same pattern for other events where it could be problematic we would have to mark
        // event as handled somehow to prevent list containing input to react to it)
        return requestListInteractionStateReset(listEl, { event: e });
      },
    },
    onKeyDown,
  );
  return (
    <ListIdContext.Provider value={null}>
      <InputTextualDispatcher
        aria-controls={listId}
        aria-autocomplete="list"
        aria-has-popup="listbox"
        type="search"
        autoComplete="off"
        {...rest}
        ref={ref}
        listId={undefined}
        onKeyDown={onKeyDownWithShortcuts}
      />
    </ListIdContext.Provider>
  );
};
const InputTextualWithSuggestions = (props) => {
  const {
    ref,
    suggestions,
    onInput,
    onFocus,
    onBlur,
    onKeyDown,
    children,
    ...rest
  } = props;
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const expand = () => {
    expandedRef.current = true;
    setExpanded(true);
  };
  const collapse = () => {
    expandedRef.current = false;
    setExpanded(false);
  };
  const getListEl = () => {
    return document.getElementById(suggestions);
  };
  const showSuggestions = (e) => {
    if (expandedRef.current) {
      return;
    }
    const listEl = getListEl();
    if (listEl) {
      requestListOpen(listEl, { event: e, anchor: ref.current });
      expand();
    }
  };
  const hideSuggestions = (e) => {
    if (!expandedRef.current) {
      return;
    }
    const listEl = getListEl();
    if (listEl) {
      requestListClose(listEl, { event: e });
      collapse();
    }
  };

  useEffect(() => {
    const inputEl = ref.current;
    const listEl = getListEl();
    if (!listEl) {
      return undefined;
    }
    const onSelect = (e) => {
      const { item } = e.detail;
      const { value } = item;
      inputEl.value = value;
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      hideSuggestions(e);
    };
    listEl.addEventListener("navi_list_select", onSelect);
    return () => {
      listEl.removeEventListener("navi_list_select", onSelect);
    };
  }, [suggestions]);

  return (
    <ListIdContext.Provider value={suggestions}>
      <InputTextualDispatcher
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-autocomplete="list"
        basePseudoState={{
          ":-navi-expanded": expanded,
        }}
        onnavi_callout_open={(e) => {
          hideSuggestions(e);
        }}
        {...rest}
        ref={ref}
        suggestions={undefined}
        onFocus={(e) => {
          onFocus?.(e);
          showSuggestions(e);
        }}
        onBlur={(e) => {
          onBlur?.(e);
          hideSuggestions(e);
        }}
        onInput={(e) => {
          onInput?.(e);
          showSuggestions(e);
        }}
        onKeyDown={shortcutsViaOnKeyDown(
          {
            arrowdown: (e) => {
              showSuggestions(e);
            },
            arrowup: (e) => {
              showSuggestions(e);
            },
            escape: (e) => {
              if (!expandedRef.current) {
                return false;
              }
              hideSuggestions(e);
              return true;
            },
          },
          onKeyDown,
        )}
      >
        {children || (
          <InputRightSlot
            onClick={(e) => {
              if (expanded) {
                hideSuggestions(e);
              } else {
                showSuggestions(e);
              }
            }}
          >
            <Icon color="rgba(28, 43, 52, 0.5)">
              <ChevronDownSvg />
            </Icon>
          </InputRightSlot>
        )}
      </InputTextualDispatcher>
    </ListIdContext.Provider>
  );
};
const InputTextualWithAction = (props) => {
  const {
    ref,
    action,
    actionDebounce,
    actionAfterChange,
    loading,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    cancelOnBlurInvalid,
    cancelOnEscape,
    actionErrorEffect,
    ...rest
  } = props;
  const uiState = useContext(UIStateContext);
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const { loading: actionLoading } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
  });
  // here updating the input won't call the associated action
  // (user have to blur or press enter for this to happen)
  // so we can keep the ui state on cancel/abort/error and let user decide
  // to update ui state or retry via blur/enter as is
  useActionEvents(ref, {
    onCancel: (e, reason) => {
      if (reason.startsWith("blur_invalid")) {
        if (!cancelOnBlurInvalid) {
          return;
        }
        if (
          // error prevent cancellation until the user closes it (or something closes it)
          e.detail.failedConstraintInfo.level === "error" &&
          e.detail.failedConstraintInfo.reportStatus !== "closed"
        ) {
          return;
        }
      }
      if (reason === "escape_key") {
        if (!cancelOnEscape) {
          return;
        }
      }
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
    <InputTextualDispatcher
      data-action={boundAction.name || "anonymous"}
      data-action-debounce={actionDebounce}
      data-action-after-change={actionAfterChange ? "" : undefined}
      {...rest}
      ref={ref}
      action={undefined}
      loading={loading || actionLoading}
    />
  );
};

// As explained in https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local#setting_timezones
// datetime-local does not support timezones
const convertToLocalTimezone = (dateTimeString) => {
  const date = new Date(dateTimeString);
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return dateTimeString;
  }

  // Format to YYYY-MM-DDThh:mm:ss
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};
/**
 * Converts a datetime string without timezone (local time) to UTC format with 'Z' notation
 *
 * @param {string} localDateTimeString - Local datetime string without timezone (e.g., "2023-07-15T14:30:00")
 * @returns {string} Datetime string in UTC with 'Z' notation (e.g., "2023-07-15T12:30:00Z")
 */
const convertToUTCTimezone = (localDateTimeString) => {
  if (!localDateTimeString) {
    return localDateTimeString;
  }

  try {
    // Create a Date object using the local time string
    // The browser will interpret this as local timezone
    const localDate = new Date(localDateTimeString);

    // Check if the date is valid
    if (isNaN(localDate.getTime())) {
      return localDateTimeString;
    }

    // Convert to UTC ISO string
    const utcString = localDate.toISOString();

    // Return the UTC string (which includes the 'Z' notation)
    return utcString;
  } catch (error) {
    console.error("Error converting local datetime to UTC:", error);
    return localDateTimeString;
  }
};

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
import { useContext, useEffect, useId, useRef, useState } from "preact/hooks";

import { Box, BoxForwardedPropsContext } from "@jsenv/navi/src/box/box.jsx";
import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { CloseSvg } from "@jsenv/navi/src/graphic/icons/close_svg.jsx";
import { EmailSvg } from "@jsenv/navi/src/graphic/icons/email_svg.jsx";
import { PhoneSvg } from "@jsenv/navi/src/graphic/icons/phone_svg.jsx";
import { SearchSvg } from "@jsenv/navi/src/graphic/icons/search_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { shortcutsViaOnKeyDown } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "../../resolver/resolver.jsx";
import { Label } from "../field.jsx";
import { FIELD_PROP_SET } from "../field_context.js";
import { useFieldInterfaceProps } from "../field_hooks.jsx";
import {
  InsideRealListItemContext,
  ListIdContext,
  requestListClose,
  requestListInteractionStateReset,
  requestListNavFromCurrent,
  requestListOpen,
  requestListSelectCurrent,
} from "../list/list.jsx";
import { requestClosestAction } from "../string_actions.js";
import {
  dispatchRequestAction,
  dispatchRequestInteraction,
} from "../validation/custom_constraint_validation.js";
import { useOnInputValueChange } from "./input_value_listener.js";

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
    --x-outline-width: calc(var(--outline-width) + var(--border-width));
    --x-outline-offset: calc(-1 * var(--border-width));
    --left-slot-size: 0px;
    --right-slot-size: 0px;
    --x-border-color: var(--border-color);
    --x-background-color: var(--background-color);
    --x-color: var(--color);
    --x-placeholder-color: var(--placeholder-color);
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

    position: relative;
    box-sizing: border-box;
    width: fit-content;
    height: fit-content;
    flex-direction: inherit;
    border-radius: inherit;
    cursor: inherit;

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
      margin: 0;
      padding: 0;
      font-size: var(--font-size);
      background: none;
      border: none;

      &[data-left] {
        left: 0;
        width: var(--left-slot-size);
      }
      &[data-right] {
        right: 0;
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
      --left-slot-size: 1.5em;
    }
    &:has(.navi_input_slot[data-right]) {
      --right-slot-size: 1.5em;
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
  props.ref = props.ref || defaultRef;
  const input = renderInput(InputTextualFieldInterface, props);

  return input;
};

const InputTextualWithListResolver = (props) => {
  const Next = useNextResolver();
  const listIdFromContext = useContext(ListIdContext);
  const isInsideRealListItem = useContext(InsideRealListItemContext);

  if (
    listIdFromContext &&
    // When inside a ListItem the input is not considered as controlling the list
    // (A list item may contain an input)
    // Note that you can still have an input controlling list in a ListItemHeader or Footer
    !isInsideRealListItem
  ) {
    return <InputControllingList listId={listIdFromContext} {...props} />;
  }
  if (props.listId) {
    return <InputControllingList {...props} />;
  }
  if (props.suggestions) {
    return <InputTextualWithSuggestions {...props} />;
  }
  return <Next {...props} />;
};

const renderInput = createComponentResolver([InputTextualWithListResolver]);

const InputNativeContext = createContext(null);
const InputTextualFieldInterface = (props) => {
  import.meta.css = css;
  const { ref, type, icon, children, onKeyDown, onPaste } = props;
  const fieldInterfaceProps = useFieldInterfaceProps(props, {
    fieldType: "input",
    readUIState: () => {
      const input = ref.current;
      return input.value;
    },
    getDisplayValue: getDisplayValueForType(type),
    normalizeUIState: getNormalizeUIStateForType(type),
  });
  const idDefault = useId();
  fieldInterfaceProps.id = fieldInterfaceProps.id || `input_${idDefault}`;
  const { id, basePseudoState } = fieldInterfaceProps;
  const disabled = basePseudoState[":disabled"];
  const readOnly = basePseudoState[":read-only"];
  const loading = basePseudoState[":-navi-loading"];
  const { actionDebounce, actionAfterChange } = props;
  useOnInputValueChange(
    ref,
    (e) => {
      const input = ref.current;
      dispatchRequestAction(input, { event: e });
    },
    {
      waitForChange: actionAfterChange,
      debounce: actionDebounce,
    },
  );

  let innerChildren;
  if (children === undefined) {
    if (type === "search") {
      innerChildren = (
        <>
          {icon === undefined && (
            <InputLeftSlot>
              <Icon color="rgba(28, 43, 52, 0.5)">
                <SearchSvg />
              </Icon>
            </InputLeftSlot>
          )}
          <InputRightSlot
            hideWhileEmpty
            onClick={() => {
              // TODO: find how to do this with new field approach
              // const input = ref.current;
              // dispatchRequestAction(input, {
              //   event: e,
              //   value: "",
              //   uiAction: () => {
              //     input.value = "";
              //     input.dispatchEvent(new CustomEvent("navi_delete_content"));
              //   },
              // });
            }}
          >
            <Icon color="rgba(28, 43, 52, 0.5)">
              <CloseSvg />
            </Icon>
          </InputRightSlot>
        </>
      );
    } else if (type === "email") {
      innerChildren = icon === undefined && (
        <InputLeftSlot>
          <Icon color="rgba(28, 43, 52, 0.5)">
            <EmailSvg />
          </Icon>
        </InputLeftSlot>
      );
    } else if (type === "tel") {
      innerChildren = icon === undefined && (
        <InputLeftSlot>
          <Icon color="rgba(28, 43, 52, 0.5)">
            <PhoneSvg />
          </Icon>
        </InputLeftSlot>
      );
    }
  } else {
    innerChildren = children;
  }

  return (
    <Box
      as="span"
      flex
      baseClassName="navi_input"
      styleCSSVars={InputStyleCSSVars}
      pseudoStateSelector=".navi_native_input"
      visualSelector=".navi_native_input"
      pseudoClasses={InputPseudoClasses}
      pseudoElements={InputPseudoElements}
      hasChildUsingForwardedProps
      baseChildPropSet={InputChildPropSet}
      {...fieldInterfaceProps}
      ref={undefined} // input takes the ref
      onKeyDown={(e) => {
        onKeyDown?.(e);
        if (e.defaultPrevented) {
          return;
        }
        const input = ref.current;
        if (readOnly && isTypingIntent(e)) {
          e.preventDefault(); // prevent space from scrolling the page, etc.
          dispatchRequestInteraction(input, e);
          return;
        }
        if (e.key === "Enter") {
          requestClosestAction(e);
        }

        return;
      }}
      onPaste={(e) => {
        onPaste?.(e);
        if (readOnly) {
          dispatchRequestInteraction(ref.current, e);
        }
      }}
    >
      <LoadingOutline
        loading={loading}
        color="var(--loader-color)"
        inset={-1}
      />
      <NativeInputBox ref={ref} type={type} />
      {innerChildren ? (
        <InputNativeContext.Provider
          value={{
            id,
            readOnly,
            disabled,
          }}
        >
          {innerChildren}
        </InputNativeContext.Provider>
      ) : null}
    </Box>
  );
};
const NativeInputBox = (props) => {
  const inputProps = useContext(BoxForwardedPropsContext);
  return (
    <Box
      {...inputProps}
      {...props}
      as="input"
      baseClassName="navi_native_input"
      data-rendered-by=".navi_input"
    />
  );
};

// Returns true when the key combination looks like the user is trying to type
// into the input (as opposed to a keyboard shortcut, navigation key, etc.).
// Used to trigger the readonly callout when relevant.
const isTypingIntent = (e) => {
  // Modifier keys used for shortcuts: skip
  if (e.metaKey || e.ctrlKey) {
    return false;
  }
  // Shift alone (or Shift+arrow for selection): skip
  // Characters produced with Shift (e.g. uppercase, symbols) are caught below
  // via key.length === 1, so we only need to filter out non-printable Shift combos.
  const { key } = e;
  // Single printable character — the user is typing
  if (key.length === 1) {
    return true;
  }
  // Editing keys that would modify the text
  if (key === "Backspace" || key === "Delete" || key === "Enter") {
    return true;
  }
  return false;
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
const InputChildPropSet = new Set([...FIELD_PROP_SET]);
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
      inline
      flex
      align="center"
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

const getDisplayValueForType = (type) => {
  if (type === "datetime-local") {
    return convertToLocalTimezone;
  }
  if (type === "color") {
    return (uiState) => uiState || "#000000";
  }
  return undefined;
};

const getNormalizeUIStateForType = (type) => {
  if (type === "number") {
    return (uiStateRaw) => {
      const inputValueAsNumber = Number(uiStateRaw);
      if (isNaN(inputValueAsNumber)) {
        return uiStateRaw;
      }
      return inputValueAsNumber;
    };
  }
  if (type === "datetime-local") {
    return convertToUTCTimezone;
  }
  return undefined;
};

// As explained in https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local#setting_timezones
// datetime-local does not support timezones
const convertToLocalTimezone = (dateTimeString) => {
  const date = new Date(dateTimeString);
  if (isNaN(date.getTime())) {
    return dateTimeString;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

const convertToUTCTimezone = (localDateTimeString) => {
  if (!localDateTimeString) {
    return localDateTimeString;
  }
  const localDate = new Date(localDateTimeString);
  if (isNaN(localDate.getTime())) {
    return localDateTimeString;
  }
  return localDate.toISOString();
};

const InputControllingList = (props) => {
  const Next = useNextResolver();
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
      <Next
        aria-controls={listId}
        aria-autocomplete="list"
        aria-has-popup="listbox"
        type="search"
        autoComplete="off"
        {...rest}
        ref={ref}
        onKeyDown={onKeyDownWithShortcuts}
      />
    </ListIdContext.Provider>
  );
};
const InputTextualWithSuggestions = (props) => {
  const Next = useNextResolver();
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
      <Next
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
      </Next>
    </ListIdContext.Provider>
  );
};

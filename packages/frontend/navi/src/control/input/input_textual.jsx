/**
 * Input component for all textual input types.
 *
 * Note pour plus tard: un jour on voudra un cas field-sizing: content;
 *
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

import { useId, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { ControlChildrenWrapper, useControlProps } from "../control_hooks.jsx";
import { getUIStateControllerById } from "../ui_state_controller.js";
import { InputNaviHourResolver } from "./input_navi_hour.jsx";
import { InputNaviMinuteResolver } from "./input_navi_minute.jsx";
import { InputModeResolver } from "./input_resolver_mode.jsx";
import { InputTypeResolver } from "./input_resolver_type.jsx";
import { InputTextualContext } from "./input_textual_context.js";
import { InputWithListResolver } from "./input_with_list.jsx";
import { InputWithSuggestionsResolver } from "./input_with_suggestions.jsx";
import { resolveInputProps } from "./resolve_input_props.js";

const css = /* css */ `
  @layer navi {
    .navi_input {
      --border-radius: var(--navi-control-border-radius);
      --border-width: var(--navi-control-border-width);
      /* Focus outline */
      --outline-width: var(--navi-focus-outline-width);
      --outline-offset: calc(var(--outline-width) / 2 * -1);
      --outline-color: var(--navi-focus-outline-color);
      /* Focus outline end */
      --font-size: var(--navi-control-font-size);
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
      --color-readonly: color-mix(
        in srgb,
        var(--picker-border-color) 45%,
        transparent
      );
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: color-mix(
        in srgb,
        var(--background-color) 95%,
        grey
      );
      --color-disabled: var(--color-dimmed);
    }
  }

  .navi_input {
    --x-border-color: var(--border-color);
    --x-background-color: var(--background-color);
    --x-color: var(--color);
    --x-placeholder-color: var(--placeholder-color);
    --x-padding-top: var(
      --padding-top,
      var(--padding-y, var(--padding, var(--navi-control-padding-y-default)))
    );
    --x-padding-right: var(
      --padding-right,
      var(--padding-x, var(--padding, var(--navi-control-padding-x-default)))
    );
    --x-padding-bottom: var(
      --padding-bottom,
      var(--padding-y, var(--padding, var(--navi-control-padding-y-default)))
    );
    --x-padding-left: var(
      --padding-left,
      var(--padding-x, var(--padding, var(--navi-control-padding-x-default)))
    );

    position: relative;
    display: inline-flex;
    box-sizing: border-box;
    width: fit-content;
    height: fit-content;
    padding-top: var(--x-padding-top);
    padding-right: var(--x-padding-right);
    padding-bottom: var(--x-padding-bottom);
    padding-left: var(--x-padding-left);
    flex-direction: row;
    color: var(--x-color);
    font-size: var(--font-size);
    background-color: var(--x-background-color);
    border-width: var(--border-width);
    border-style: solid;
    border-color: var(--x-border-color);
    border-radius: var(--border-radius);
    outline-width: var(--outline-width);
    outline-color: var(--outline-color);
    outline-offset: var(--outline-offset);
    cursor: inherit;
    pointer-events: auto;

    .navi_control_input {
      box-sizing: content-box;
      min-width: 1ch;
      margin-top: calc(-1 * var(--x-padding-top));
      margin-right: calc(-1 * var(--x-padding-right));
      margin-bottom: calc(-1 * var(--x-padding-bottom));
      margin-left: calc(-1 * var(--x-padding-left));
      padding-top: var(--x-padding-top);
      padding-right: var(--x-padding-right);
      padding-bottom: var(--x-padding-bottom);
      padding-left: var(--x-padding-left);
      flex-grow: 1;
      color: inherit;
      font-size: inherit;
      background: none;
      border: none;
      border-radius: inherit;
      outline: none;

      &[type="search"] {
        -webkit-appearance: textfield;

        &::-webkit-search-cancel-button {
          display: none;
        }
      }
    }

    .navi_input_slot {
      color: #5e4e4e;

      &[data-left] {
        margin-right: var(--x-padding-left);
        order: -1;
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
    &[data-focus-visible] {
      --x-background-color: var(--background-color-focus);
      --x-border-color: transparent;
      outline-style: solid;
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

    &[data-discrete] {
      --x-background-color: transparent;

      &[data-hover] {
        --x-background-color: white;
      }
      &[data-focus] {
        --x-background-color: white;
      }
      &[data-readonly] {
        --x-background-color: transparent;
      }
      &[data-disabled] {
        --x-background-color: transparent;
      }
    }
  }

  .navi_input .navi_control_input::placeholder {
    color: var(--x-placeholder-color);
  }
  .navi_input .navi_control_input:-internal-autofill-selected {
    /* Webkit is putting some nasty styles after automplete that look as follow */
    /* input:-internal-autofill-selected { color: FieldText !important; } */
    /* Fortunately we can override it as follow */
    -webkit-text-fill-color: var(--x-color) !important;
  }
`;

const InputHeadlessResolver = (props) => {
  const Next = useNextResolver();

  if (props.headless) {
    return <InputTextualHeadless {...props} />;
  }
  return <Next {...props} />;
};
const InputTextualHeadless = (props) => {
  const [inputProps, remainingProps] = useInputTextualProps(props);

  return <RealInput {...inputProps} {...remainingProps} />;
};
const useInputTextualProps = (props) => {
  return useControlProps(props, {
    controlType: "input",
    statePropName: "value",
    defaultStatePropName: "defaultValue",
    readOnlySupported: true,
  });
};
const InputTextualUI = (props) => {
  import.meta.css = css;
  const { ui, discrete, width = "maxLength" } = props;
  const [inputProps, remainingProps] = useInputTextualProps(props);
  const { id, basePseudoState, children } = inputProps;
  const uiStateController = getUIStateControllerById(id);
  const value = uiStateController.uiState;
  const disabled = basePseudoState[":disabled"];
  const readOnly = basePseudoState[":read-only"];
  const loading = basePseudoState[":-navi-loading"];
  const childrenWithContext = (
    <ControlChildrenWrapper>
      <InputTextualContext.Provider value={{ id, readOnly, disabled, value }}>
        {children || ui}
      </InputTextualContext.Provider>
    </ControlChildrenWrapper>
  );

  // meant to end on input
  // we have to use delete otherwise it could override width: undefined
  // when remainingProps contains expandX which would try to set width to 100%
  delete remainingProps.width;
  if (width === "maxLength") {
    const { maxLength } = inputProps;
    if (maxLength !== undefined) {
      const isNumeric = props.inputMode === "numeric";
      inputProps.width = isNumeric
        ? `${maxLength}ch`
        : `calc(${maxLength} * 1.5ch)`;
    }
  } else if (width === "content") {
    inputProps.fieldSizing = "content";
  } else {
    inputProps.width = width;
  }

  return (
    <Box
      as="span"
      flex
      baseClassName="navi_input"
      {...remainingProps}
      basePseudoState={basePseudoState}
      ui={undefined}
      data-discrete={discrete ? "" : undefined}
      discrete={undefined} // handled via data attribute
      styleCSSVars={InputStyleCSSVars}
      pseudoStateSelector=".navi_control_input"
      pseudoClasses={InputPseudoClasses}
      pseudoElements={InputPseudoElements}
    >
      <LoadingOutline
        loading={loading}
        color="var(--loader-color)"
        inset={-1}
      />
      <RealInput {...inputProps} />
      {childrenWithContext}
    </Box>
  );
};
const InputTextualFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  const idDefault = useId(); // needed by ui state controller and slot labels
  props.id = props.id || idDefault;
  resolveInputProps(props);

  return <Next {...props} />;
};
export const InputTextual = createComponentResolver([
  InputTextualFirstResolver,
  InputWithListResolver,
  InputWithSuggestionsResolver,
  InputNaviHourResolver,
  InputNaviMinuteResolver,
  InputTypeResolver,
  InputModeResolver,
  InputHeadlessResolver,
  InputTextualUI,
]);

const RealInput = (props) => {
  return <Box {...props} as="input" baseClassName="navi_control_input" />;
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
];
const InputPseudoElements = ["::-navi-loader"];

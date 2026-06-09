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

import { useContext, useId, useRef } from "preact/hooks";

import { Box, BoxForwardedPropsContext } from "@jsenv/navi/src/box/box.jsx";
import { CloseSvg } from "@jsenv/navi/src/graphic/icons/close_svg.jsx";
import { EmailSvg } from "@jsenv/navi/src/graphic/icons/email_svg.jsx";
import { PhoneSvg } from "@jsenv/navi/src/graphic/icons/phone_svg.jsx";
import { SearchSvg } from "@jsenv/navi/src/graphic/icons/search_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "../../resolver/resolver.jsx";
import { useControlProps } from "../control_hooks.jsx";
import { asControlHostValue } from "../control_value.js";
import { triggerStringAction } from "../string_actions.js";
import { dispatchRequestInteraction } from "../validation/custom_constraint_validation.js";
import { InputNaviHourResolver } from "./input_navi_hour.jsx";
import { InputTextualContext } from "./input_textual_context.js";
import { InputLeftSlot, InputRightSlot } from "./input_ui_components.jsx";
import { InputWithListResolver } from "./input_with_list.jsx";
import { InputWithSuggestionsResolver } from "./input_with_suggestions.jsx";
import { resolveInputProps } from "./resolve_input_props.js";

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

      --left-slot-size: 1.2em;
      --right-slot-size: 1.2em;
    }
  }

  .navi_input {
    /* outline will draw the border when visible */
    --x-outline-width: calc(var(--outline-width) + var(--border-width));
    --x-outline-offset: calc(-1 * var(--border-width));
    --x-left-slot-size: 0px;
    --x-right-slot-size: 0xp;
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
    --x-padding-top: var(--x-padding-top-base);
    --x-padding-right: var(--x-padding-right-base);
    --x-padding-bottom: var(--x-padding-bottom-base);
    --x-padding-left: var(--x-padding-left-base);

    position: relative;
    display: inline-flex;
    box-sizing: content-box;
    width: fit-content;
    min-width: 50px;
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
    outline-width: var(--x-outline-width);
    outline-color: var(--outline-color);
    outline-offset: var(--x-outline-offset);
    cursor: inherit;
    pointer-events: auto;

    &[navi-input-type="number"] {
      min-width: 1ch;
    }

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
      &[data-left] {
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

const InputTypeResolver = (props) => {
  const Next = useNextResolver();
  if (props.type === "search") {
    return <InputSearch {...props} />;
  }
  if (props.type === "email") {
    return <InputEmail {...props} />;
  }
  if (props.type === "tel") {
    return <InputTel {...props} />;
  }
  if (props.type === "number") {
    return <InputNumber {...props} />;
  }
  if (props.type === "color") {
    return <InputColor {...props} />;
  }
  if (props.type === "datetime-local") {
    return <InputDatetimeLocal {...props} />;
  }
  return <Next {...props} />;
};
const InputHeadlessResolver = (props) => {
  const Next = useNextResolver();
  if (props.headless) {
    return <InputTextualHeadless {...props} />;
  }
  return <Next {...props} />;
};
const InputTextualHeadless = (props) => {
  const [inputProps, remainingProps] = useInputTextualProps(props);
  return (
    <BoxForwardedPropsContext.Provider value={undefined}>
      <RealInput {...inputProps} {...remainingProps} />
    </BoxForwardedPropsContext.Provider>
  );
};
const useInputTextualProps = (props) => {
  const [controlProps, remainingProps, ControlChildrenWrapper] =
    useControlProps(props, {
      controlType: "input",
      statePropName: "value",
      defaultStatePropName: "defaultValue",
      readOnlySupported: true,
    });
  controlProps.value = asControlHostValue(controlProps.value, {
    controlType: "input",
    type: props.type,
  });
  return [controlProps, remainingProps, ControlChildrenWrapper];
};
const InputTextualUI = (props) => {
  import.meta.css = css;
  const { ui, discrete } = props;
  const [inputProps, remainingProps, ControlChildrenWrapper] =
    useInputTextualProps(props);
  const idDefault = useId();
  inputProps.id = inputProps.id || `input_${idDefault}`;
  const { id, basePseudoState, children } = inputProps;
  const disabled = basePseudoState[":disabled"];
  const readOnly = basePseudoState[":read-only"];
  const loading = basePseudoState[":-navi-loading"];
  const childrenWithContext = (
    <ControlChildrenWrapper>
      <InputTextualContext.Provider value={{ id, readOnly, disabled }}>
        {children || ui}
      </InputTextualContext.Provider>
    </ControlChildrenWrapper>
  );

  return (
    <Box
      as="span"
      flex
      baseClassName="navi_input"
      {...remainingProps}
      basePseudoState={basePseudoState}
      ui={undefined}
      data-discrete={discrete ? "" : undefined}
      navi-input-type={inputProps.type}
      discrete={undefined} // handled via data attribute
      styleCSSVars={InputStyleCSSVars}
      pseudoStateSelector=".navi_control_input"
      pseudoClasses={InputPseudoClasses}
      pseudoElements={InputPseudoElements}
      hasChildUsingForwardedProps
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
  resolveInputProps(props);

  return <Next {...props} />;
};
export const InputTextual = createComponentResolver([
  InputTextualFirstResolver,
  InputWithListResolver,
  InputWithSuggestionsResolver,
  InputNaviHourResolver,
  InputTypeResolver,
  InputHeadlessResolver,
  InputTextualUI,
]);

const RealInput = (props) => {
  const inputProps = useContext(BoxForwardedPropsContext);
  return (
    <Box
      {...inputProps}
      {...props}
      as="input"
      baseClassName="navi_control_input"
    />
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

const InputSearch = (props) => {
  const Next = useNextResolver();

  return <Next ui={<InputSearchUI icon={props.icon} />} {...props} />;
};
const InputSearchUI = ({ icon }) => {
  const ctx = useContext(InputTextualContext);
  const { id } = ctx;

  return (
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
        action-target={id}
        onClick={(e) => {
          const input = e.currentTarget;
          const allowed = dispatchRequestInteraction(input, e);
          if (allowed) {
            triggerStringAction("clear", e, { skipClose: true });
          }
        }}
      >
        <Icon color="rgba(28, 43, 52, 0.5)">
          <CloseSvg />
        </Icon>
      </InputRightSlot>
    </>
  );
};
const InputEmail = (props) => {
  const Next = useNextResolver();

  return <Next ui={<InputEmailUI />} {...props} />;
};
const InputEmailUI = ({ icon }) => {
  if (icon !== undefined) {
    return null;
  }
  return (
    <InputLeftSlot>
      <Icon color="rgba(28, 43, 52, 0.5)">
        <EmailSvg />
      </Icon>
    </InputLeftSlot>
  );
};
const InputTel = (props) => {
  const Next = useNextResolver();
  return <Next ui={<InputTelUI icon={props.icon} />} {...props} />;
};
const InputTelUI = ({ icon }) => {
  if (icon !== undefined) {
    return null;
  }
  return (
    <InputLeftSlot>
      <Icon color="rgba(28, 43, 52, 0.5)">
        <PhoneSvg />
      </Icon>
    </InputLeftSlot>
  );
};
const InputNumber = (props) => {
  const Next = useNextResolver();

  return <Next {...props} />;
};
const InputColor = (props) => {
  const Next = useNextResolver();

  return <Next {...props} />;
};
const InputDatetimeLocal = (props) => {
  const Next = useNextResolver();

  return <Next {...props} />;
};

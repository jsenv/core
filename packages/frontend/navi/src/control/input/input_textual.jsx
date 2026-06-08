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
import { Label } from "../field.jsx";
import { triggerStringAction } from "../string_actions.js";
import { dispatchRequestInteraction } from "../validation/custom_constraint_validation.js";
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

    position: relative;
    box-sizing: border-box;
    width: fit-content;
    height: fit-content;
    flex-direction: inherit;
    border-radius: inherit;
    cursor: inherit;

    .navi_control_input {
      box-sizing: border-box;
      min-width: 50px;
      padding-top: var(--x-padding-top-base);
      padding-right: var(--x-padding-right-base);
      padding-bottom: var(--x-padding-bottom-base);
      padding-left: var(--x-padding-left-base);
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

    &:has(.navi_input_slot[data-left]) {
      --x-left-slot-size: calc(
        var(--left-slot-size) + var(--x-padding-left-base) / 2
      );

      .navi_control_input {
        padding-left: var(--x-left-slot-size);
      }
    }
    &:has(.navi_input_slot[data-right]) {
      --x-right-slot-size: calc(
        var(--right-slot-size) + var(--x-padding-right-base) / 2
      );

      .navi_control_input {
        padding-right: var(--x-right-slot-size);
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
        width: var(--x-left-slot-size);
      }
      &[data-right] {
        right: 0;
        width: var(--x-right-slot-size);
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

      .navi_control_input {
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
  resolveInputProps(props);
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

const InputNativeContext = createContext(null);
const InputTextualControlInterface = (props) => {
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
      <InputNativeContext.Provider value={{ id, readOnly, disabled }}>
        {children || ui}
      </InputNativeContext.Provider>
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
      discrete={undefined} // handled via data attribute
      styleCSSVars={InputStyleCSSVars}
      pseudoStateSelector=".navi_control_input"
      visualSelector=".navi_control_input"
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

  return <Next {...props} />;
};
export const InputTextual = createComponentResolver([
  InputTextualFirstResolver,
  InputWithListResolver,
  InputWithSuggestionsResolver,
  InputTypeResolver,
  InputHeadlessResolver,
  InputTextualControlInterface,
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
        onClick?.(e);
        const input = document.getElementById(id);
        const allowed = dispatchRequestInteraction(input, e);
        if (!allowed) {
          e.preventDefault();
        }
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

const InputSearch = (props) => {
  const Next = useNextResolver();
  return <Next ui={<InputSearchUI icon={props.icon} />} {...props} />;
};
const InputSearchUI = ({ icon }) => {
  const ctx = useContext(InputNativeContext);
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

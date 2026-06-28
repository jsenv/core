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
 *
 * Guard props (immediate feedback instead of wait-for-submit):
 *
 * - charGuard — restricts which characters can be typed, pasted, or set externally.
 *   Accepts a preset name or a raw regex character class:
 *   "numeric"      → digits only, sets inputMode="numeric" + pattern auto
 *   "alpha"        → letters only
 *   "alphanumeric" → letters and digits
 *   "uppercase"    → uppercase letters only
 *   "tel"          → phone chars (digits, +, -, parens, space), sets inputMode="tel"
 *   "card"         → credit card (digits and spaces), sets inputMode="numeric"
 *   "hex"          → hexadecimal digits
 *   "pin"          → numeric PIN, sets inputMode="numeric"
 *   "postal"       → postal code (digits, letters, space, hyphen)
 *   "iban"         → IBAN (uppercase and digits)
 *   "slug"         → URL slug (lowercase, digits, hyphens)
 *   "[A-Z0-9]"     → any custom regex character class
 *   inputMode and pattern are auto-derived from the preset when not explicitly set.
 *
 * - maxLengthGuard — combines maxLength + overflow guard in one prop.
 *   Blocks keydown when the limit is reached; truncates on paste/set with an info callout.
 *   The maxLength constraint remains active for form validation at submit.
 *   Use plain maxLength (without maxLengthGuard) for submit-only validation.
 */

import { useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import {
  resolveCharClass,
  resolveInputModeFromAllowedChars,
} from "../char_guard_presets.js";
import { ControlChildrenWrapper, useControlProps } from "../control_hooks.jsx";
import { InputModeResolver } from "./input_resolver_mode.jsx";
import { InputTypeResolver } from "./input_resolver_type.jsx";
import { InputTextualContext } from "./input_textual_context.js";
import { InputWithListResolver } from "./input_with_list.jsx";
import { InputWithSuggestionsResolver } from "./input_with_suggestions.jsx";
import { resolveInputProps } from "./resolve_input_props.js";
import { useAutoSelectReadOnly } from "./use_autoselect_read_only.js";

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
      --font-family: var(--navi-control-font-family);
      --loader-color: var(--navi-loader-color);
      --border-color: var(--navi-control-border-color);
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
      --background-color-readonly: var(--background-color-hover);
      --color-readonly: color-mix(in srgb, var(--color) 65%, transparent);
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
    padding-bottom: var(--x-padding-bottom);
    flex-direction: row;
    color: var(--x-color);
    font-size: var(--font-size);
    font-family: var(--font-family);
    text-align: initial;
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
      margin-bottom: calc(-1 * var(--x-padding-bottom));
      padding-top: var(--x-padding-top);
      padding-right: var(--x-padding-right);
      padding-bottom: var(--x-padding-bottom);
      padding-left: var(--x-padding-left);
      flex-grow: 1;
      color: inherit;
      font-size: inherit;
      text-align: inherit;
      background: none;
      border: none;
      border-radius: inherit;
      outline: none;
      -webkit-tap-highlight-color: var(--navi-control-tap-highlight-color);

      &[type="search"] {
        -webkit-appearance: textfield;

        &::-webkit-search-cancel-button {
          display: none;
        }
      }
    }

    .navi_input_slot {
      --slot-spacing: calc(2px + 0.1em);

      margin-right: var(--slot-spacing);
      margin-left: var(--slot-spacing);
      color: #5e4e4e;

      &[data-left] {
        order: -1;
      }
      &[data-right] {
      }

      .navi_button {
        font-size: inherit;
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

    &[data-variant="underline"] {
      border: none;
      border-radius: 0;
      --x-background-color: transparent;
      padding-right: 0;
      padding-left: 0;

      .navi_input_real_input_wrapper {
        position: relative;
        display: inline-flex;
        flex-grow: 1;
      }

      .navi_input_underline {
        position: absolute;
        top: calc(100% - 1px);
        right: var(--x-padding-right);
        left: var(--x-padding-left);
        height: 1px;
        background-color: var(--x-border-color);
        pointer-events: none;
      }

      &[data-hover] {
        --x-background-color: transparent;
      }
      &[data-focus-visible] {
        --x-background-color: transparent;
        outline-style: none;

        .navi_input_underline {
          height: 2px;
          background-color: var(--outline-color);
        }
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
  if (props.type === "hidden") {
    return <InputHidden {...props} />;
  }
  return <Next {...props} />;
};
const InputHidden = (props) => {
  const [inputRootProps, inputHostProps] = useInputTextualProps(props);

  return <RealInput {...inputRootProps} {...inputHostProps} />;
};
const InputTextualHeadless = (props) => {
  const [inputRootProps, inputHostProps] = useInputTextualProps(props);

  return (
    <RealInput
      navi-visually-hidden=""
      navi-focus-delegate=""
      aria-hidden="true"
      {...inputRootProps}
      {...inputHostProps}
    />
  );
};
const useInputTextualProps = (props) => {
  return useControlProps(props, {
    controlType: "input",
  });
};
const InputTextualUI = (props) => {
  import.meta.css = css;
  const { ui, discrete, variant, width = "maxLength" } = props;
  const [
    inputControlRootProps,
    inputControlHostProps,
    controlChildrenWrapperProps,
  ] = useInputTextualProps(props);
  const { id, basePseudoState, children } = inputControlHostProps;
  const { uiStateController } = controlChildrenWrapperProps;
  const value = uiStateController.uiState;
  const disabled = basePseudoState[":disabled"];
  const readOnly = basePseudoState[":read-only"];
  const loading = basePseudoState[":-navi-loading"];
  const childrenWithContext = (
    <ControlChildrenWrapper {...controlChildrenWrapperProps}>
      <InputTextualContext.Provider value={{ id, readOnly, disabled, value }}>
        {children || ui}
      </InputTextualContext.Provider>
    </ControlChildrenWrapper>
  );

  // meant to end on input
  // we have to use delete otherwise it could override width: undefined
  // when remainingProps contains expandX which would try to set width to 100%
  delete inputControlRootProps.width;
  if (width === "maxLength") {
    const { maxLength } = inputControlHostProps;
    if (maxLength !== undefined) {
      const isNumeric = props.inputMode === "numeric";
      inputControlHostProps.width = isNumeric
        ? `${maxLength}ch`
        : `calc(${maxLength} * 1.5ch)`;
    }
  } else if (width === "content") {
    inputControlHostProps.fieldSizing = "content";
  } else {
    inputControlHostProps.width = width;
  }

  return (
    <Box
      as="span"
      inline
      flex
      baseClassName="navi_input"
      {...inputControlRootProps}
      basePseudoState={basePseudoState}
      ui={undefined}
      data-discrete={discrete ? "" : undefined}
      discrete={undefined} // handled via data attribute
      data-variant={variant || undefined}
      styleCSSVars={InputStyleCSSVars}
      pseudoStateSelector=".navi_control_input"
      pseudoClasses={InputPseudoClasses}
      pseudoElements={InputPseudoElements}
      // input may have left/right icons and we want the anchor to target the input element
      // which is where the interaction can happen
      data-callout-anchor=".navi_control_input"
    >
      <LoadingOutline
        loading={loading}
        color="var(--loader-color)"
        inset={-1}
      />
      {variant === "underline" ? (
        <span className="navi_input_real_input_wrapper">
          <RealInput {...inputControlHostProps} />
          <span className="navi_input_underline" />
        </span>
      ) : (
        <RealInput {...inputControlHostProps} />
      )}
      {childrenWithContext}
    </Box>
  );
};
const InputTextualFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  resolveInputProps(props);

  // charGuard → auto inputMode + auto pattern for mobile keyboard hints
  if (props.charGuard) {
    if (props.inputMode === undefined) {
      const autoMode = resolveInputModeFromAllowedChars(props.charGuard);
      if (autoMode) props.inputMode = autoMode;
    }
    if (props.pattern === undefined) {
      const charClass = resolveCharClass(props.charGuard);
      props.pattern = `${charClass}*`;
    }
  }
  return <Next {...props} />;
};
export const InputTextual = createComponentResolver([
  InputTextualFirstResolver,
  InputWithListResolver,
  InputWithSuggestionsResolver,
  InputTypeResolver,
  InputModeResolver,
  InputHeadlessResolver,
  InputTextualUI,
]);

const RealInput = (props) => {
  const autoSelectReadOnlyProps = useAutoSelectReadOnly(props);

  return (
    <Box
      {...props}
      as="input"
      baseClassName="navi_control_input"
      {...autoSelectReadOnlyProps}
      // Never set native maxLength — our guard handles it. maxLength stays in
      // inputControlHostProps so form validation constraints still read it.
      maxLength={undefined}
      // But do expose it (needed by navi_input_full event)
      navi-max-length={props.maxLength}
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
];
const InputPseudoElements = ["::-navi-loader"];

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
 *   "noEmoji"      → anything but an emoji
 *   "[A-Z0-9]"     → any custom regex character class, compiled with the `u`
 *                    flag: `\p{...}` is available, and an emoji counts as one
 *                    character rather than two halves.
 *   inputMode and pattern are auto-derived from the preset when not explicitly set.
 *   The presets come from @jsenv/validity, so the same name names the class a
 *   server checks the value against (see docs/field_validation.md).
 *
 * - maxLengthGuard — combines maxLength + overflow guard in one prop.
 *   Blocks keydown when the limit is reached; truncates on paste/set with an info callout.
 *   The maxLength constraint remains active for form validation at submit.
 *   Use plain maxLength (without maxLengthGuard) for submit-only validation.
 *
 * Background color:
 * - backgroundColor="transparent" applies at rest and hover; a focused field
 *   turns solid (--navi-surface-color) so text is not typed over what sits behind.
 * - variant="discrete" drops background and border at rest; focus brings back
 *   a solid surface. variant="discrete-border" does the same but keeps the border.
 * - variant="discrete" + backgroundColor: the color applies at rest and hover,
 *   and the field goes transparent while focused.
 *
 * variant="text" is the odd one: it renders no <input> at all, just the value
 * as text — see InputTextualAsText below for what it is for and what it drops.
 */

import { useContext, useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { ControlIdContext } from "../control_context.js";
import { ControlChildrenWrapper, useControlProps } from "../control_hooks.jsx";
import { installInputCss } from "./input_css.js";
import { InputModeResolver } from "./input_resolver_mode.jsx";
import { InputTypeResolver } from "./input_resolver_type.jsx";
import { InputTextualContext } from "./input_textual_context.js";
import { InputWithListResolver } from "./input_with_list.jsx";
import { InputWithSuggestionsResolver } from "./input_with_suggestions.jsx";
import { useAutoSelectReadOnly } from "./use_autoselect_read_only.js";

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
  installInputCss();
  const { ui, variant, backgroundColor, width = "maxLength" } = props;
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
    const widthFromMaxLength = resolveWidthFromMaxLength(
      inputControlHostProps.maxLength,
      props.inputMode,
    );
    if (widthFromMaxLength !== undefined) {
      inputControlHostProps.width = widthFromMaxLength;
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
      data-variant={variant || undefined}
      data-background={
        backgroundColor !== undefined && backgroundColor !== "transparent"
          ? ""
          : undefined
      }
      data-background-transparent={
        backgroundColor === "transparent" ? "" : undefined
      }
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
// How wide a field is when its width is left to what it accepts: a value that
// cannot exceed maxLength characters needs no more room than that. Shared with
// the text variant, which must land on the same number or the two would not be
// the same box.
const resolveWidthFromMaxLength = (maxLength, inputMode) => {
  if (maxLength === undefined) {
    return undefined;
  }
  if (inputMode === "numeric") {
    return `${maxLength}ch`;
  }
  return `calc(${maxLength} * 1.5ch)`;
};

/**
 * variant="text" — the value, written where the field would be and taking
 * exactly its room: same paddings, same font, same line, and the border kept
 * but made invisible, so a value one only reads and the same value being
 * edited are one box. What it is for: an information that is sometimes known
 * (a name already on the profile) and sometimes asked for. Swapping the field
 * for its text must move nothing under it.
 *
 * It is text, and nothing else: no <input>, so nothing to focus, nothing in
 * the tab order, and nothing sent when the form is submitted — a value the
 * form must carry goes in an <Input type="hidden"> beside this one. Not a
 * disabled control either: `disabled`/`aria-disabled` would announce a field
 * one cannot use, where there is no field at all.
 *
 * The field's own props are dropped rather than half-honoured (placeholder,
 * the guards, the slots): they all describe an edition that does not happen
 * here. What is kept is what decides the box.
 */
// Everything a field takes that a text does not: what the value is said with,
// what the box is measured from (read below, then dropped too), and all the
// rest — the guards, the slots, the constraints — which describe an edition
// that does not happen here. What survives is what a Box understands: width,
// spacing, colors, className, style.
const INPUT_ONLY_PROPS = [
  "value",
  "defaultValue",
  "signal",
  "id",
  "maxLength",
  "inputMode",
  "width",
  "variant",
  "type",
  "name",
  "placeholder",
  "required",
  "readOnly",
  "disabled",
  "loading",
  "error",
  "min",
  "max",
  "step",
  "pattern",
  "autoComplete",
  "autoCorrect",
  "spellcheck",
  "charGuard",
  "maxLengthGuard",
  "list",
  "suggestions",
  "headless",
  "fieldSizing",
  "action",
  "uiAction",
  "ui",
  "children",
];

const InputTextualAsText = (props) => {
  installInputCss();
  // The id a Field handed down, which is what its Label points at.
  const controlId = useContext(ControlIdContext);
  const {
    value,
    defaultValue,
    signal,
    id,
    maxLength,
    inputMode,
    width = "maxLength",
  } = props;
  const valueShown = signal ? signal.value : (value ?? defaultValue);
  const textWidth =
    width === "maxLength"
      ? resolveWidthFromMaxLength(maxLength, inputMode)
      : width === "content"
        ? undefined
        : width;
  const boxProps = { ...props };
  for (const inputOnlyProp of INPUT_ONLY_PROPS) {
    delete boxProps[inputOnlyProp];
  }

  return (
    <Box
      as="span"
      inline
      flex
      baseClassName="navi_input"
      data-variant="text"
      styleCSSVars={InputStyleCSSVars}
      {...boxProps}
    >
      <Box
        as="span"
        baseClassName="navi_input_text"
        id={id || controlId}
        width={textWidth}
      >
        <span className="navi_input_text_value">{valueShown}</span>
      </Box>
    </Box>
  );
};
const InputTextualAsTextResolver = (props) => {
  const Next = useNextResolver();

  if (props.variant === "text") {
    return <InputTextualAsText {...props} />;
  }
  return <Next {...props} />;
};
const InputTextualFirstResolver = (props) => {
  const Next = useNextResolver();
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;

  return <Next {...props} />;
};
export const InputTextual = createComponentResolver([
  InputTextualAsTextResolver,
  InputTextualFirstResolver,
  InputWithListResolver,
  InputWithSuggestionsResolver,
  InputTypeResolver,
  InputModeResolver,
  InputHeadlessResolver,
  InputTextualUI,
]);

const RealInput = ({ maxLength, ...domProps }) => {
  const autoSelectReadOnlyProps = useAutoSelectReadOnly(domProps);

  return (
    <Box
      {...domProps}
      as="input"
      baseClassName="navi_control_input"
      {...autoSelectReadOnlyProps}
      // Never set native maxLength — our guard handles it. Omitting it entirely
      // avoids a Preact quirk: setting maxLength={undefined} on a fresh DOM element
      // (e.g. after a Suspense remount) causes Preact to run `el.maxLength = ""`
      // which coerces to 0 (Number("") = 0), capping the input at 0 characters.
      // see https://github.com/preactjs/preact/issues/2677
      // The JS value stays accessible via the navi-max-length attribute and via
      // inputControlHostProps (which the validation system reads directly).
      navi-max-length={maxLength}
    />
  );
};

// Shared with textarea.jsx: a textarea is styled as a .navi_input box, so the
// two read the same style props and pseudo states.
export const InputStyleCSSVars = {
  "slotSpacing": ["--slot-spacing", "margin"],
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
export const InputPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
  ":-navi-has-value",
];
export const InputPseudoElements = ["::-navi-loader"];

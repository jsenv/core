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
import { resolveSpacingSize } from "@jsenv/navi/src/box/box_style_util.js";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import {
  createComponentResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { ControlIdContext } from "../control_context.js";
import { ControlChildrenWrapper, useControlProps } from "../control_hooks.jsx";
import { InputModeResolver } from "./input_resolver_mode.jsx";
import { InputTypeResolver } from "./input_resolver_type.jsx";
import { InputTextualContext } from "./input_textual_context.js";
import { InputWithListResolver } from "./input_with_list.jsx";
import { InputWithSuggestionsResolver } from "./input_with_suggestions.jsx";
import { useAutoSelectReadOnly } from "./use_autoselect_read_only.js";

// Exported for textarea.jsx: a textarea is styled as a .navi_input box, and
// registers this sheet itself — a page may render a Textarea without any
// Input, so it cannot rely on InputTextualUI having run.
export const inputCss = /* css */ `
  @layer navi {
    .navi_input {
      --border-radius: var(--navi-control-border-radius);
      --border-width: var(--navi-control-border-width);
      /* Focus outline */
      --outline-width: var(--navi-focus-outline-width);
      --outline-offset: calc(-0.5 * var(--outline-width));
      --outline-color: var(--navi-focus-outline-color);
      /* Focus outline end */
      --font-size: var(--navi-control-font-size);
      --font-family: var(--navi-control-font-family);
      --loader-color: var(--navi-loader-color);
      --border-color: var(--navi-control-border-color);
      --background-color: var(--navi-surface-color);
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
    /* Squared from the outside, corner by corner: an input is not always the
       member a Group joins — it can arrive wrapped (in a Box carrying a state,
       in a tooltip) — so the ask travels down as inherited custom properties
       rather than as a radius landing on this element. Each corner falls back
       to the input's own radius when nothing asks for anything. */
    border-top-left-radius: var(
      --x-corner-top-left-radius,
      var(--border-radius)
    );
    border-top-right-radius: var(
      --x-corner-top-right-radius,
      var(--border-radius)
    );
    border-bottom-right-radius: var(
      --x-corner-bottom-right-radius,
      var(--border-radius)
    );
    border-bottom-left-radius: var(
      --x-corner-bottom-left-radius,
      var(--border-radius)
    );
    outline-width: var(--outline-width);
    outline-color: var(--outline-color);
    outline-offset: var(--outline-offset);
    cursor: inherit;
    pointer-events: auto;

    /* The text of variant="text" is measured with the real thing rather than
       beside it: same padding, same margins, same room — so the two are the
       same box and a field's style can move without one of them staying
       behind. */
    .navi_control_input,
    .navi_input_text {
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
      /* A form control does not inherit the font on its own — the browser has
         one of its own for it, monospace for a <textarea> — so the box's font
         (--navi-control-font-family) is handed down by hand. */
      font-family: inherit;
      text-align: inherit;
      background: none;
      border: none;
      border-radius: inherit;
      outline: none;
      -webkit-tap-highlight-color: var(--navi-control-tap-highlight-color);

      &::placeholder {
        color: var(--x-placeholder-color);
      }
      /* Webkit is putting a slight blue bckground on autofilled input */
      /* For now we override with out custom background color */
      /* Ideally we'll later provide a custom data attribute with ability to see styles when autofilled */
      &:-webkit-autofill {
        -webkit-box-shadow: 0 0 0 1000px var(--x-background-color) inset;
      }
      /* Webkit is putting some nasty styles after automplete that look as follow */
      /* input:-internal-autofill-selected { color: FieldText !important; } */
      /* Fortunately we can override it as follow */
      &:-internal-autofill-selected {
        -webkit-text-fill-color: var(--x-color) !important;
      }

      &[type="search"] {
        -webkit-appearance: textfield;

        &::-webkit-search-cancel-button {
          display: none;
        }
      }
    }

    .navi_input_text {
      /* Nothing to read yet is still a line: the box may not collapse just
         because the value is empty. */
      min-height: 1lh;
      /* A form control keeps a line of its own whatever line-height the page
         is written in; the text that stands in for one has to say the same
         number, or the box it is meant to match changes height. */
      line-height: normal;
    }
    /* The value is cut by a box of its own, and that is the whole reason it
       exists: a field ends its text at the content edge, while an overflow set
       on the padded box would let it run through the padding — the same value
       would then lose a character on one side and not on the other. This box
       IS the content edge, so both stop on the same letter.
       Cut rather than wrapped (a second line would be taller than the field),
       and cut rather than ellipsed (an ellipsis costs a character the field
       does not lose). */
    .navi_input_text_value {
      display: block;
      /* The whole content box, short value or not: a field's text is laid out
         in the full width whatever it holds, so text-align lands in the same
         place on both. */
      width: 100%;
      text-overflow: clip;
      white-space: nowrap;
      overflow: hidden;
    }

    .navi_input_slot {
      /* A corner claimed from the outside (see group.jsx) is the frame's, and
         what lives in here is not the frame — a button in a slot, the content
         of a popup — so the ask stops at this boundary. */
      --x-corner-top-left-radius: initial;
      --x-corner-top-right-radius: initial;
      --x-corner-bottom-right-radius: initial;
      --x-corner-bottom-left-radius: initial;

      margin-right: var(--slot-spacing, calc(2px + 0.1em));
      margin-left: var(--slot-spacing, calc(2px + 0.1em));
      color: #5e4e4e;

      &[data-left] {
        order: -1;
      }
      &[data-right] {
      }

      .navi_button {
        font-size: inherit;
        /* A <button> does not inherit the font on its own — same as the
           <input> above — and what stands in a slot is measured on the line
           box (Icon fillLine is 1lh): left on the browser's own font, the
           clear cross would resolve 1lh against a font the field is not
           written in, and the field would change height the moment the icon
           is replaced by the button. */
        font-family: inherit;

        /* A button in a slot (e.g. the clear cross) is drawn small but must
           not be small to hit: the spacing around it — the slot margins on the
           sides, the input padding above and below — belongs to its clickable
           zone. The visual stays untouched; only the hit area grows. */
        &::before {
          position: absolute;
          top: calc(-1 * var(--x-padding-top));
          right: calc(-1 * var(--slot-spacing, calc(2px + 0.1em)));
          bottom: calc(-1 * var(--x-padding-bottom));
          left: calc(-1 * var(--slot-spacing, calc(2px + 0.1em)));
          content: "";
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

    /* A transparent background is a resting look, not an editing one: while
       the field has focus it turns solid so text is not typed over whatever
       sits behind it. */
    &[data-background-transparent] {
      --background-color-hover: var(--background-color);
      --background-color-focus: var(--navi-surface-color);

      &[data-focus] {
        --x-background-color: var(--background-color-focus);
      }
    }

    &[data-variant="discrete"],
    &[data-variant="discrete-border"] {
      /* An inline backgroundColor prop overrides this default */
      --background-color: transparent;
      --background-color-hover: var(--background-color);
      --background-color-focus: var(--navi-surface-color);

      &[data-focus] {
        --x-background-color: var(--background-color-focus);
      }
      &[data-readonly] {
        --x-background-color: var(--background-color);
      }
      &[data-disabled] {
        --x-background-color: var(--background-color);
      }
      /* With an explicit background color the movement flips: colored at
         rest and on hover, back to transparent while being edited. */
      &[data-background] {
        --background-color-focus: transparent;
      }
    }
    /* The border is part of what makes a field look like a field, so a
       discrete one does without it until it is interacted with — same idea
       as the background above, and the two come back together.
       discrete-border keeps the border: only the background recedes. */
    &[data-variant="discrete"] {
      --border-color: transparent;

      &[data-focus] {
        --x-border-color: color-mix(
          in srgb,
          var(--border-color) 55%,
          transparent
        );
      }
    }

    /* The box of a field, without a field in it: the border is kept and made
       invisible rather than dropped, and the background goes with it, so what
       is left is text sitting exactly where the value would be — swap one for
       the other and nothing on the page moves. */
    &[data-variant="text"] {
      --x-background-color: transparent;
      --x-border-color: transparent;
      cursor: inherit;
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
  import.meta.css = inputCss;
  // Spacing props travel to CSS as a raw custom property value, so the size
  // keywords have to become lengths here — "s" reaching CSS untouched makes the
  // declaration invalid, silently, and the gap just goes away.
  props.slotSpacing = resolveSpacingSize(props.slotSpacing);
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
  import.meta.css = inputCss;
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
  "slotSpacing": "--slot-spacing",
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

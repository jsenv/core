/**
 * A native `<select>` that is a navi control: its value enters the state of the
 * `<Form>` around it, and it takes `signal`, `uiAction`, `action`, `command`,
 * `value`/`defaultValue`, `readOnly`, `disabled`, `required` like every other
 * control.
 *
 * Native on purpose, and not a Picker: on a phone a `<select>` opens the
 * system's own full-screen list — the thing the thumb handles best and the user
 * already knows — with no popup, no positioning and no focus trap to get wrong.
 * That is the right control for a short closed list (a gender, an age bracket,
 * "who sees this"). A long, searchable list with rich content in its options is
 * Picker's problem, not this one.
 *
 * The options are the children, written as HTML: an `<optgroup>`, a `disabled`
 * option, an `<hr>` between two groups need no support from this component.
 *
 * Two things the component absorbs, both traps met before:
 * - a native `<select>` ignores `defaultValue` and reads `selected` off its
 *   options instead; here `value`/`defaultValue` mean what they mean everywhere
 *   else in navi, and the element is told what to show.
 * - a native `<select>` has no `readonly`; `readOnly` here refuses the
 *   interaction (the list does not open, a change from the keyboard is put
 *   back) and says so with `aria-readonly`.
 *
 * Styled as a `.navi_input` box so a select and an input sitting next to each
 * other are the same box. `appearance: none` only changes how the closed
 * control is drawn — the list it opens stays the platform's own, which is the
 * whole point of using a select.
 */

import { useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { Icon } from "@jsenv/navi/src/text/text.jsx";
import { useControlProps } from "../control_hooks.jsx";
import {
  inputCss,
  InputPseudoClasses,
  InputPseudoElements,
  InputStyleCSSVars,
} from "./input_textual.jsx";
import { seedDefaultValueFromSignal } from "./resolve_input_props.js";

const css = /* css */ `
  .navi_input.navi_select {
    .navi_control_input {
      /* Room for the chevron, which sits over the padding rather than beside
         the control — anything beside it would be a click that misses. */
      padding-right: calc(var(--x-padding-right) + 1em);
      /* Same line as every other field (see --navi-line-height): a select and
         an input side by side must be the same height, and lh units elsewhere
         in the box need a real number to resolve against. */
      line-height: var(--navi-line-height);
      /* The closed control is drawn by us so it matches the other fields; the
         list it opens is untouched and stays the system's. */
      appearance: none;
      cursor: pointer;
    }
    &[data-readonly] .navi_control_input,
    &[data-disabled] .navi_control_input {
      cursor: inherit;
    }

    .navi_select_arrow {
      position: absolute;
      top: 50%;
      right: var(--x-padding-right);
      display: flex;
      color: var(--color-dimmed);
      translate: 0 -50%;
      /* The arrow is drawn on top of the control it belongs to: a click on it
         must reach the select and open the list. */
      pointer-events: none;
    }
  }
`;

/**
 * @type {import("preact").FunctionComponent<{
 *   value?: string,
 *   defaultValue?: string,
 *   signal?: import("@preact/signals").Signal<string>,
 *   name?: string,
 *   width?: string,
 *   [key: string]: any,
 * }>}
 * @param {string} [value] The choice the control is GIVEN — what is already
 *   saved. A form holding it considers that field as already sent.
 * @param {string} [defaultValue] The choice the control PROPOSES, and what a
 *   reset goes back to. Sending it back is an answer, so a form counts it as
 *   something to send.
 * @param {string} [width] The control's width. Left out, the box takes the
 *   width of its widest option.
 */
export const Select = ({ width, multiple, ...props }) => {
  import.meta.css = inputCss + css;
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  seedDefaultValueFromSignal(props);

  if (import.meta.dev && multiple) {
    console.warn(
      `[navi] <Select> does not support "multiple": its state is one value, ` +
        `so only the last selected option would reach the form. ` +
        `Use CheckboxGroup for a multi-choice field.`,
    );
  }

  const [rootProps, hostProps] = useControlProps(props, {
    controlType: "select",
  });
  const { basePseudoState } = hostProps;
  // `type` on a <select> is the browser's own read-only "select-one".
  delete hostProps.type;
  const loading = basePseudoState[":-navi-loading"];

  if (width !== undefined) {
    // On the select, not on the box around it: the box is fit-content and the
    // control is what has a width to give.
    hostProps.width = width;
  }

  return (
    <Box
      as="span"
      inline
      flex
      baseClassName="navi_input"
      className="navi_select"
      {...rootProps}
      basePseudoState={basePseudoState}
      styleCSSVars={InputStyleCSSVars}
      pseudoStateSelector=".navi_control_input"
      pseudoClasses={InputPseudoClasses}
      pseudoElements={InputPseudoElements}
      data-callout-anchor=".navi_control_input"
    >
      <LoadingOutline
        loading={loading}
        color="var(--loader-color)"
        inset={-1}
      />
      <Box {...hostProps} as="select" baseClassName="navi_control_input" />
      <span className="navi_select_arrow">
        <Icon lineOverflow="allow">
          <ChevronDownSvg />
        </Icon>
      </span>
    </Box>
  );
};

/**
 * Multiline text control that grows with what is typed.
 *
 * Autosize is native: `field-sizing: content` lets the browser size the
 * textarea from its value — no hidden mirror textarea to measure against (the
 * technique libraries used before the property existed). `minRows`/`maxRows`
 * become min/max heights in `lh` units on top of it; past `maxRows` the
 * content scrolls.
 *
 * TextareaCharCount is the counter that goes with it, and the caller places
 * it: under the box, in a form footer, next to a label — fed with the same
 * value/signal as the textarea. The textarea draws no counter of its own.
 *
 * Styled as a `.navi_input` box (border, background, focus ring, readonly and
 * disabled fades, variants): one look for everything one types into. The
 * shared sheet is registered here too — a page may render a Textarea without
 * any Input.
 */

import { useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { ControlChildrenWrapper, useControlProps } from "../control_hooks.jsx";
import {
  inputCss,
  InputPseudoClasses,
  InputPseudoElements,
  InputStyleCSSVars,
} from "./input_textual.jsx";
import { useAutoSelectReadOnly } from "./use_autoselect_read_only.js";

const css = /* css */ `
  .navi_input.navi_textarea {
    .navi_control_input {
      min-height: calc(var(--textarea-min-rows, 1.5) * 1lh);
      /* Above maxRows the box stops growing and the content scrolls. The
         99999 fallback means "no cap" without needing a conditional rule. */
      max-height: calc(var(--textarea-max-rows, 99999) * 1lh);
      field-sizing: content;
      /* Explicit, never normal: minRows/maxRows are lengths in lh, and with
         line-height normal the lh unit resolves to a theoretical value that
         does not match the real rendered line — the box then jumps by a few
         pixels the moment the first character replaces the theory with a real
         line. One number for both keeps every row count exact. */
      line-height: 1.5;
      /* The control grows itself; resizable below hands the handle back. */
      resize: none;
      overflow: auto;
    }
    &[data-resizable] .navi_control_input {
      height: calc(var(--textarea-min-rows, 1.5) * 1lh);
      /* The two are exclusive: with field-sizing content the browser removes
         the resize handle (the size follows the content, there is nothing to
         drag). resizable means the hand takes over — fixed sizing, starting
         at minRows, and the drag writes its own inline height from there. */
      field-sizing: fixed;
      resize: vertical;
    }
  }
  .navi_textarea_char_count {
    color: color-mix(in srgb, currentColor 60%, transparent);
    font-size: 0.75em;
    user-select: none;
  }
`;

/**
 * @type {import("preact").FunctionComponent<{
 *   value?: string,
 *   defaultValue?: string,
 *   signal?: import("@preact/signals").Signal<string>,
 *   name?: string,
 *   minRows?: number,
 *   maxRows?: number,
 *   resizable?: boolean,
 *   maxLength?: number,
 *   width?: string,
 *   [key: string]: any,
 * }>}
 * @param {number} [minRows=1.5] Height the empty control starts at, in lines.
 *   The default shows half of a second line: enough to read "multiline" at a
 *   glance without the height of a full extra row.
 * @param {number} [maxRows] Lines after which the control stops growing and
 *   scrolls instead. Without it the control grows with its content.
 * @param {boolean} [resizable] Give the browser's vertical resize handle back.
 *   A manual resize takes over from the automatic growth.
 * @param {number} [maxLength] The character limit, validated at submit. Pair
 *   with `maxLengthGuard` to block typing past it, and render a
 *   TextareaCharCount to show it.
 * @param {string} [width="35ch"] The control's width. Fixed on purpose: with
 *   field-sizing the width would otherwise follow the longest line, and a box
 *   that widens while one types is a box one chases.
 */
export const Textarea = ({
  // Destructured, never deleted off the props object: Preact reuses the same
  // props object when an internal state update re-renders the component, so a
  // delete would make these props vanish from the second render on (the box
  // then jumps back to the default minRows at the first keystroke).
  minRows = 1.5,
  maxRows,
  resizable,
  width = "35ch",
  ...props
}) => {
  import.meta.css = inputCss + css;
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;

  const [rootProps, hostProps, childrenWrapperProps] = useControlProps(props, {
    controlType: "input",
  });
  const { basePseudoState, children } = hostProps;
  // Children go through ControlChildrenWrapper below; inside the <textarea>
  // element they would become its text content.
  delete hostProps.children;
  const loading = basePseudoState[":-navi-loading"];

  delete rootProps.width;
  hostProps.width = width;

  return (
    <Box
      as="span"
      inline
      flex
      baseClassName="navi_input"
      className="navi_textarea"
      {...rootProps}
      basePseudoState={basePseudoState}
      data-resizable={resizable ? "" : undefined}
      styleCSSVars={InputStyleCSSVars}
      pseudoStateSelector=".navi_control_input"
      pseudoClasses={InputPseudoClasses}
      pseudoElements={InputPseudoElements}
      data-callout-anchor=".navi_control_input"
      style={{
        "--textarea-min-rows": minRows,
        "--textarea-max-rows": maxRows,
        ...rootProps.style,
      }}
    >
      <LoadingOutline
        loading={loading}
        color="var(--loader-color)"
        inset={-1}
      />
      <RealTextarea {...hostProps} />
      <ControlChildrenWrapper {...childrenWrapperProps}>
        {children}
      </ControlChildrenWrapper>
    </Box>
  );
};

/**
 * The counter that goes with a Textarea: how many characters remain before
 * `maxLength` — or how many are typed when there is no `maxLength`. Where it
 * goes is the caller's call, which is why it is a separate component rather
 * than something the textarea draws: put it under the box, in a form footer,
 * next to a label, and feed it the same value or signal as the textarea.
 *
 * @type {import("preact").FunctionComponent<{
 *   value?: string,
 *   signal?: import("@preact/signals").Signal<string>,
 *   maxLength?: number,
 *   [key: string]: any,
 * }>}
 * @param {string} [value] The text being counted. Say `signal` instead for a
 *   two-way bound textarea: reading it here subscribes the count to it.
 * @param {number} [maxLength] The limit to count down from. Without it the
 *   count simply shows how many characters are typed.
 */
export const TextareaCharCount = ({ value, signal, maxLength, ...rest }) => {
  import.meta.css = css;
  const resolvedValue = signal ? signal.value : value;
  const length = typeof resolvedValue === "string" ? resolvedValue.length : 0;

  return (
    <Box as="span" baseClassName="navi_textarea_char_count" {...rest}>
      {maxLength === undefined ? length : maxLength - length}
    </Box>
  );
};

const RealTextarea = ({ maxLength, ...domProps }) => {
  const autoSelectReadOnlyProps = useAutoSelectReadOnly(domProps);

  return (
    <Box
      {...domProps}
      as="textarea"
      baseClassName="navi_control_input"
      {...autoSelectReadOnlyProps}
      // Native maxLength stays off, like RealInput in input_textual.jsx: the
      // maxLengthGuard handles live blocking, the constraint validates at
      // submit, and navi-max-length keeps the value readable from the DOM.
      navi-max-length={maxLength}
    />
  );
};

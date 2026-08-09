/**
 * Multiline text control that grows with what is typed.
 *
 * Autosize is native: `field-sizing: content` lets the browser size the
 * textarea from its value — no hidden mirror textarea to measure against (the
 * technique libraries used before the property existed). `minRows`/`maxRows`
 * become min/max heights in `lh` units on top of it; past `maxRows` the
 * content scrolls.
 *
 * `charCount` reserves a strip at the bottom right of the box and writes the
 * remaining characters there (value length when there is no `maxLength`).
 * The count reads the UI state, so it follows external value changes too.
 *
 * Styled as a `.navi_input` box (border, background, focus ring, readonly and
 * disabled fades, variants): one look for everything one types into.
 */

import { useRef } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { LoadingOutline } from "@jsenv/navi/src/graphic/loading/loading_outline.jsx";
import { ControlChildrenWrapper, useControlProps } from "../control_hooks.jsx";
import {
  InputPseudoClasses,
  InputPseudoElements,
  InputStyleCSSVars,
} from "./input_textual.jsx";
import { useAutoSelectReadOnly } from "./use_autoselect_read_only.js";

const css = /* css */ `
  .navi_input.navi_textarea {
    .navi_control_input {
      min-height: calc(var(--textarea-min-rows, 2) * 1lh);
      /* Above maxRows the box stops growing and the content scrolls. The
         99999 fallback means "no cap" without needing a conditional rule. */
      max-height: calc(var(--textarea-max-rows, 99999) * 1lh);
      field-sizing: content;
      /* The control grows itself; a manual resize handle would fight it. */
      resize: none;
      overflow: auto;
    }

    .navi_textarea_char_count {
      position: absolute;
      right: var(--x-padding-right);
      bottom: var(--x-padding-bottom);
      color: var(--x-placeholder-color);
      font-size: 0.75em;
      pointer-events: none;
      user-select: none;
    }
    /* The strip the count sits in belongs to the box, not to the text: the
       last line stops above it instead of running underneath. */
    &[data-char-count] .navi_control_input {
      padding-bottom: calc(var(--x-padding-bottom) + 1.2em);
    }
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
 *   charCount?: boolean,
 *   maxLength?: number,
 *   width?: string,
 *   [key: string]: any,
 * }>}
 * @param {number} [minRows=2] Height the empty control starts at, in lines.
 * @param {number} [maxRows] Lines after which the control stops growing and
 *   scrolls instead. Without it the control grows with its content.
 * @param {boolean} [charCount] Show, bottom right, how many characters remain
 *   before `maxLength` — or how many are typed when there is no `maxLength`.
 * @param {number} [maxLength] The character limit `charCount` counts down
 *   from, validated at submit. Pair with `maxLengthGuard` to block typing past
 *   it.
 * @param {string} [width="35ch"] The control's width. Fixed on purpose: with
 *   field-sizing the width would otherwise follow the longest line, and a box
 *   that widens while one types is a box one chases.
 */
export const Textarea = (props) => {
  import.meta.css = css;
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  const { minRows = 2, maxRows, charCount, width = "35ch" } = props;
  delete props.minRows;
  delete props.maxRows;
  delete props.charCount;
  delete props.width;

  const [rootProps, hostProps, childrenWrapperProps] = useControlProps(props, {
    controlType: "input",
  });
  const { basePseudoState, children } = hostProps;
  // Children go through ControlChildrenWrapper below; inside the <textarea>
  // element they would become its text content.
  delete hostProps.children;
  const { uiStateController } = childrenWrapperProps;
  const value = uiStateController.uiState;
  const loading = basePseudoState[":-navi-loading"];
  // The limit the count runs down from: maxLength when there is one, else the
  // guard's own limit — with only maxLengthGuard set the ceiling is just as
  // real.
  const maxLength = hostProps.maxLength ?? hostProps.maxLengthGuard;
  const valueLength = typeof value === "string" ? value.length : 0;
  const charCountText =
    maxLength === undefined ? valueLength : maxLength - valueLength;

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
      data-char-count={charCount ? "" : undefined}
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
      {charCount && (
        <span className="navi_textarea_char_count">{charCountText}</span>
      )}
      <ControlChildrenWrapper {...childrenWrapperProps}>
        {children}
      </ControlChildrenWrapper>
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

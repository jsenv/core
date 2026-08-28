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

import { useLayoutEffect, useRef } from "preact/hooks";

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
  .navi_textarea {
    textarea {
      min-height: calc(var(--textarea-min-rows, 1.5) * 1lh);
      /* Above maxRows the box stops growing and the content scrolls. The
         99999 fallback means "no cap" without needing a conditional rule. */
      max-height: calc(var(--textarea-max-rows, 99999) * 1lh);
      field-sizing: content;
      /* Explicit, never normal, for two independent reasons.
         minRows/maxRows are lengths in lh, and with line-height normal the lh
         unit resolves to a theoretical value that does not match the real
         rendered line — the box then jumps by a few pixels the moment the first
         character replaces the theory with a real line.
         And a line box under "normal" takes the height of the tallest font it
         holds, so the one line carrying an emoji stands taller than the ones
         around it — and a tighter line would cut the top off the glyph.
         The number is the page's own (--navi-line-height, 1.25), snapped to
         the pixel like every control's: a message typed here and the same
         message displayed afterwards sit on the same line, emoji included.
         Bound to the token rather than inherited so it can never come back as
         "normal" from a container that sets one. See docs/typography.md. */
      line-height: var(--navi-control-line-height);
      /* The control grows itself; resizable below hands the handle back. */
      resize: none;
      overflow: auto;
      /* A placeholder must be readable in full before anything is typed: a
         field that opens already scrolled reads as a field that already has
         text in it. The lines it wraps to are counted (see
         usePlaceholderHeight) because they only exist once laid out, and they
         only raise the floor while the placeholder is what is being shown —
         what is typed sizes the box on its own. A count of lines rather than
         a height, so the floor is on the same grid as minRows. */
      &:placeholder-shown {
        min-height: max(
          calc(var(--textarea-min-rows, 1.5) * 1lh),
          calc(var(--x-textarea-placeholder-rows, 0) * 1lh)
        );
      }
    }
    &[data-resizable] {
      .navi_control_input {
        height: calc(var(--textarea-min-rows, 1.5) * 1lh);
        /* The two are exclusive: with field-sizing content the browser removes
         the resize handle (the size follows the content, there is nothing to
         drag). resizable means the hand takes over — fixed sizing, starting
         at minRows, and the drag writes its own inline height from there. */
        field-sizing: fixed;
        resize: vertical;
      }
    }
  }
  .navi_textarea_char_count {
    color: color-mix(in srgb, currentColor 60%, transparent);
    font-size: 0.75em;
    user-select: none;
  }
`;

// minRows/maxRows are read by the CSS above, so they travel the way every
// other style of this box travels: a prop mapped to the custom property it
// stands for, written by Box itself (see its styleCSSVars).
const TextareaStyleCSSVars = {
  ...InputStyleCSSVars,
  minRows: "--textarea-min-rows",
  maxRows: "--textarea-max-rows",
};

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
 *   An exchange, not an addition: the hand takes over from the automatic
 *   growth, so the control stops following what is typed and stays at the
 *   height it was last dragged to (starting at `minRows`).
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
  // then jumps back to its default size at the first keystroke).
  resizable,
  width = "35ch",
  ...props
}) => {
  import.meta.css = inputCss + css;
  const defaultRef = useRef(null);
  props.ref = props.ref || defaultRef;
  usePlaceholderHeight(props.ref, props.placeholder);

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
      baseClassName="navi_input navi_textarea"
      {...rootProps}
      basePseudoState={basePseudoState}
      data-resizable={resizable ? "" : undefined}
      styleCSSVars={TextareaStyleCSSVars}
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
      <RealTextarea {...hostProps} />
      <ControlChildrenWrapper {...childrenWrapperProps}>
        {children}
      </ControlChildrenWrapper>
    </Box>
  );
};

/**
 * The counter that goes with a Textarea: "50/200" — how many characters are
 * typed over how many the limit allows, the way Material writes it (just the
 * count when there is no `maxLength`). Where it goes is the caller's call,
 * which is why it is a separate component rather than something the textarea
 * draws: put it under the box, in a form footer, next to a label, and feed it
 * the same value or signal as the textarea.
 *
 * @type {import("preact").FunctionComponent<{
 *   value?: string,
 *   signal?: import("@preact/signals").Signal<string>,
 *   maxLength?: number,
 *   [key: string]: any,
 * }>}
 * @param {string} [value] The text being counted. Say `signal` instead for a
 *   two-way bound textarea: reading it here subscribes the count to it.
 * @param {number} [maxLength] The limit, shown after the count ("50/200").
 *   Without it the count stands alone.
 */
export const TextareaCharCount = ({ value, signal, maxLength, ...rest }) => {
  import.meta.css = css;
  const resolvedValue = signal ? signal.value : value;
  const length = typeof resolvedValue === "string" ? resolvedValue.length : 0;

  return (
    <Box as="span" baseClassName="navi_textarea_char_count" {...rest}>
      {maxLength === undefined ? length : `${length}/${maxLength}`}
    </Box>
  );
};

// `field-sizing: content` sizes the box from the value, and an empty field has
// none — the placeholder is text the browser refuses to make room for. So the
// lines it wraps to are counted and published as --x-textarea-placeholder-rows
// for the CSS above to use as a floor.
const usePlaceholderHeight = (ref, placeholder) => {
  useLayoutEffect(() => {
    const textareaEl = ref.current;
    if (!placeholder) {
      textareaEl.style.removeProperty("--x-textarea-placeholder-rows");
      return null;
    }
    let widthMeasured;
    const measure = () => {
      // What is typed sizes the box itself; the placeholder is not displayed
      // then, and scrollHeight would report the value's height instead.
      if (textareaEl.value !== "") {
        return;
      }
      const { paddingTop, paddingBottom, lineHeight } =
        getComputedStyle(textareaEl);
      // Read with no floor under the box: scrollHeight can never report less
      // than the height the element already has, so a min-height still in
      // place — minRows, or the previous measure — would be read back as
      // lines of placeholder (a one-line placeholder over a 1.5-row floor
      // would count as two), and the box could only ever grow, never shrink
      // back on a wider viewport.
      textareaEl.style.setProperty("min-height", "0px");
      const contentHeight =
        textareaEl.scrollHeight -
        parseFloat(paddingTop) -
        parseFloat(paddingBottom);
      textareaEl.style.removeProperty("min-height");
      // scrollHeight is a whole number of pixels where a line need not be: a
      // height handed back as is would put the floor a fraction above the
      // line grid, and the empty box and the one showing its placeholder
      // would not be the same height. A count of lines has no fraction.
      const rows = Math.round(contentHeight / parseFloat(lineHeight));
      widthMeasured = textareaEl.clientWidth;
      textareaEl.style.setProperty(
        "--x-textarea-placeholder-rows",
        String(rows),
      );
    };
    measure();
    // Measuring writes the variable that sets this element's own height, and
    // mutating layout from inside a resize callback is what makes the browser
    // report "ResizeObserver loop completed with undelivered notifications".
    // So the write waits for the frame that resize produced.
    let measureFrame = null;
    const requestMeasure = () => {
      if (measureFrame !== null) {
        return;
      }
      measureFrame = requestAnimationFrame(() => {
        measureFrame = null;
        measure();
      });
    };
    // The placeholder wraps against the available width, so a new width is a
    // new number of lines. Height changes are ignored: this measure is what
    // causes them, and reacting to them would be reacting to ourselves.
    const resizeObserver = new ResizeObserver(() => {
      if (textareaEl.clientWidth !== widthMeasured) {
        requestMeasure();
      }
    });
    resizeObserver.observe(textareaEl);
    // The width may have changed while the field held a value, when measuring
    // was impossible — emptying it is when the placeholder comes back.
    const onInput = () => {
      if (textareaEl.value === "") {
        measure();
      }
    };
    textareaEl.addEventListener("input", onInput);
    return () => {
      if (measureFrame !== null) {
        cancelAnimationFrame(measureFrame);
      }
      resizeObserver.disconnect();
      textareaEl.removeEventListener("input", onInput);
    };
  }, [placeholder]);
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

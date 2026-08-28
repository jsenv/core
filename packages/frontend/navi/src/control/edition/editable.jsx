/**
 * - We must keep the edited element in the DOM so that
 * the layout remains the same (especially important for table cells)
 * And the editable part is in absolute so that it takes the original content dimensions
 * AND for table cells it can actually take the table cell dimensions
 *
 * This means an editable thing MUST have a parent with position relative that wraps the content and the eventual editable input
 *
 * `multiline` swaps the Input for a Textarea — the same edition in place, for a
 * value that is written on several lines (a message, a description). Enter then
 * makes a line instead of validating: what is typed is committed when the field
 * is left, and Escape gives up on it.
 */

import { getBorderSizes } from "@jsenv/dom";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { Input } from "../input/input.jsx";
import { Textarea } from "../input/textarea.jsx";

const css = /* css */ `
  .navi_editable_wrapper {
    --inset-top: 0px;
    --inset-right: 0px;
    --inset-bottom: 0px;
    --inset-left: 0px;

    position: absolute;
    top: var(--inset-top);
    right: var(--inset-right);
    bottom: var(--inset-bottom);
    left: var(--inset-left);
    opacity: 0;
    pointer-events: none;

    /* The field takes the place of the text, so the text is what decides how
       it is drawn — a control's own font (its size and family come from
       --navi-control-*) would make the value change size the moment one edits
       it. Unlayered, so it wins over the control's own sheet. */
    .navi_input {
      font-size: inherit;
      font-family: inherit;
    }
    input,
    textarea {
      font-weight: inherit;
      font-size: inherit;
      font-family: inherit;
      text-align: inherit;
      line-height: inherit;
    }

    &[data-editing] {
      opacity: 1;
      pointer-events: auto;
    }
  }
`;

export const useEditionController = () => {
  const [editing, editingSetter] = useState(null);
  const startEditing = useCallback((event) => {
    editingSetter((current) => {
      return current || { event };
    });
  }, []);
  const stopEditing = useCallback(() => {
    editingSetter(null);
  }, []);

  const prevEditingRef = useRef(editing);
  const editionJustEnded = prevEditingRef.current && !editing;
  prevEditingRef.current = editing;

  return { editing, startEditing, stopEditing, editionJustEnded };
};

export const Editable = (props) => {
  import.meta.css = css;
  let {
    children,
    action,
    editing,
    name,
    value,
    valueSignal,
    onEditEnd,
    constraints,
    type,
    multiline,
    minRows,
    maxRows,
    required,
    readOnly,
    min,
    max,
    step,
    minLength,
    maxLength,
    pattern,
    wrapperProps,
    autoFocusSelect = true,
    width,
    height,
    ...rest
  } = props;
  if (import.meta.dev && !action) {
    console.warn(`Editable requires an action prop`);
  }
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

  if (valueSignal) {
    value = valueSignal.value;
  }

  const editingPreviousRef = useRef(editing);
  const valueWhenEditStartRef = useRef(editing ? value : undefined);
  if (editingPreviousRef.current !== editing) {
    if (editing) {
      valueWhenEditStartRef.current = value; // Always store the external value
    }
    editingPreviousRef.current = editing;
  }

  // Simulate typing the initial value when editing starts with a custom value
  useLayoutEffect(() => {
    if (!editing) {
      return;
    }
    const editingEvent = editing.event;
    if (editingEvent) {
      const editingEventInitialValue = editingEvent.detail?.initialValue;
      if (editingEventInitialValue !== undefined) {
        const input = ref.current;
        input.value = editingEventInitialValue;
        input.dispatchEvent(
          new CustomEvent("input", {
            bubbles: false,
          }),
        );
      }
    }
  }, [editing]);

  const controlProps = {
    ref,
    ...rest,
    name,
    value,
    valueSignal,
    autoFocus: editing,
    autoFocusVisible: true,
    autoFocusSelect,
    cancelOnEscape: true,
    cancelOnBlurInvalid: true,
    constraints,
    required,
    readOnly,
    minLength,
    maxLength,
    width,
    height,
    onCancel: (e) => {
      if (valueSignal) {
        valueSignal.value = valueWhenEditStartRef.current;
      }
      onEditEnd({
        cancelled: true,
        event: e,
      });
    },
    onBlur: (e) => {
      let inputValue;
      const valueWhenEditStart = valueWhenEditStartRef.current;
      let inputValueWhenEditStart;
      if (type === "number") {
        inputValue = e.target.valueAsNumber;
        inputValueWhenEditStart = valueWhenEditStart;
      } else {
        inputValue = e.target.value;
        inputValueWhenEditStart = Number.isNaN(valueWhenEditStart)
          ? valueWhenEditStart
          : String(valueWhenEditStart);
      }
      if (inputValue === inputValueWhenEditStart) {
        onEditEnd({
          cancelled: true,
          event: e,
        });
        return;
      }
    },
    action: action || (() => {}),
    actionAfterChange: true,
    onActionEnd: (e) => {
      onEditEnd({
        success: true,
        event: e,
      });
    },
  };
  // What is typed on several lines goes into a textarea; the props that only
  // mean something to an <input> (its type and the bounds that come with it)
  // stay on that side.
  const control = multiline ? (
    <Textarea {...controlProps} minRows={minRows} maxRows={maxRows} />
  ) : (
    <Input
      {...controlProps}
      type={type}
      min={min}
      max={max}
      step={step}
      pattern={pattern}
    />
  );

  const wrapperRef = useRef();
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) {
      return;
    }
    const parent = wrapper.parentElement;
    const borderSizes = getBorderSizes(parent);

    wrapper.style.setProperty("--inset-left", `-${borderSizes.left}px`);
    wrapper.style.setProperty("--inset-top", `-${borderSizes.top}px`);
    wrapper.style.setProperty("--inset-right", `-${borderSizes.right}px`);
    wrapper.style.setProperty("--inset-bottom", `-${borderSizes.bottom}px`);
  });

  return (
    <>
      {children || <span>{value}</span>}
      <Box
        className="navi_editable_wrapper"
        ref={wrapperRef}
        {...wrapperProps}
        // inert ensure input while not editing that:
        // - input not focusable (via keyboard or anything)
        // - cannot be interacted with pointer (click, hover, etc)
        // - is ignored by screen readers
        inert={editing ? undefined : ""}
        data-editing={editing ? "" : undefined}
      >
        {control}
      </Box>
    </>
  );
};

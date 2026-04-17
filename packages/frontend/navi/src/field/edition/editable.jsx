/**
 * - We must keep the edited element in the DOM so that
 * the layout remains the same (especially important for table cells)
 * And the editable part is in absolute so that it takes the original content dimensions
 * AND for table cells it can actually take the table cell dimensions
 *
 * This means an editable thing MUST have a parent with position relative that wraps the content and the eventual editable input
 *
 */

import { getBorderSizes } from "@jsenv/dom";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";

import { Box } from "../../box/box.jsx";
import { Input } from "../input.jsx";

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

    input {
      font-weight: inherit;
      text-align: inherit;
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
    required,
    readOnly,
    min,
    max,
    step,
    minLength,
    maxLength,
    pattern,
    wrapperProps,
    autoSelect = true,
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

  const input = (
    <Input
      ref={ref}
      {...rest}
      type={type}
      name={name}
      value={value}
      valueSignal={valueSignal}
      autoFocus={editing}
      autoFocusVisible
      autoSelect={autoSelect}
      cancelOnEscape
      cancelOnBlurInvalid
      constraints={constraints}
      required={required}
      readOnly={readOnly}
      min={min}
      max={max}
      step={step}
      minLength={minLength}
      maxLength={maxLength}
      pattern={pattern}
      width={width}
      height={height}
      onCancel={(e) => {
        if (valueSignal) {
          valueSignal.value = valueWhenEditStartRef.current;
        }
        onEditEnd({
          cancelled: true,
          event: e,
        });
      }}
      onBlur={(e) => {
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
      }}
      action={action || (() => {})}
      actionAfterChange
      onActionEnd={(e) => {
        onEditEnd({
          success: true,
          event: e,
        });
      }}
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
        {input}
      </Box>
    </>
  );
};

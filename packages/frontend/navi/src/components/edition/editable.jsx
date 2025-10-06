/**
 * - We must keep the edited element in the DOM so that
 * the layout remains the same (especially important for table cells)
 * And the editable part is in absolute so that it takes the original content dimensions
 * AND for table cells it can actually take the table cell dimensions
 *
 * This means an editable thing MUST have a parent with position relative that wraps the content and the eventual editable input
 *
 */

import { forwardRef } from "preact/compat";
import {
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "preact/hooks";
import { Input } from "../input/input.jsx";

import.meta.css = /* css */ `
  .navi_editable_wrapper {
    position: absolute;
    inset: 0;
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

export const Editable = forwardRef((props, ref) => {
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
    height,
    ...rest
  } = props;
  if (import.meta.dev && !action) {
    console.warn(`Editable requires an action prop`);
  }

  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

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
    if (!editingEvent) {
      return;
    }
    const editingEventInitialValue = editingEvent.detail?.initialValue;
    if (editingEventInitialValue === undefined) {
      return;
    }
    const input = innerRef.current;
    input.value = editingEventInitialValue;
    input.dispatchEvent(
      new CustomEvent("input", {
        bubbles: false,
      }),
    );
  }, [editing]);

  const input = (
    <Input
      ref={innerRef}
      {...rest}
      type={type}
      name={name}
      value={value}
      valueSignal={valueSignal}
      autoFocus
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
        const value =
          type === "number" ? e.target.valueAsNumber : e.target.value;
        const valueWhenEditStart = valueWhenEditStartRef.current;
        if (value === valueWhenEditStart) {
          onEditEnd({
            cancelled: true,
            event: e,
          });
          return;
        }
      }}
      action={action || (() => {})}
      onActionEnd={(e) => {
        onEditEnd({
          success: true,
          event: e,
        });
      }}
    />
  );

  return (
    <>
      {children || <span>{value}</span>}
      {editing && (
        <div
          {...wrapperProps}
          className={[
            "navi_editable_wrapper",
            ...(wrapperProps?.className || "").split(" "),
          ].join(" ")}
        >
          {input}
        </div>
      )}
    </>
  );
});

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

export const useEditableController = () => {
  const [editable, editableSetter] = useState(null);
  const startEditing = useCallback(({ focusVisible } = {}) => {
    editableSetter({
      focusVisible,
    });
  }, []);
  const stopEditing = useCallback(() => {
    editableSetter(null);
  }, []);

  const prevEditableRef = useRef(editable);
  const editableJustEnded = prevEditableRef.current && !editable;
  prevEditableRef.current = editable;

  return { editable, startEditing, stopEditing, editableJustEnded };
};

export const Editable = forwardRef((props, ref) => {
  let {
    children,
    action,
    editable,
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

  const editablePreviousRef = useRef(editable);
  const valueWhenEditStartRef = useRef(editable ? value : undefined);
  if (editablePreviousRef.current !== editable) {
    if (editable) {
      valueWhenEditStartRef.current = value;
    }
    editablePreviousRef.current = editable;
  }

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
        }
      }}
      action={action}
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
      {editable && (
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

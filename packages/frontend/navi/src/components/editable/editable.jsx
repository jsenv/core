import { forwardRef } from "preact/compat";
import {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";
import { Input } from "../input/input.jsx";

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
    renderEditable,
    autoSelect = true,
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

  if (!editable) {
    return children || <span>{value}</span>;
  }

  const input = (
    <Input
      ref={innerRef}
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

  if (!renderEditable) {
    return input;
  }
  return renderEditable(input);
});

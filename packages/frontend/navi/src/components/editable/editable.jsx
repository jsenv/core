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
  } = props;
  if (import.meta.DEV && !action) {
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

  return (
    <>
      <div style={{ display: editable ? "none" : "inline-flex", flexGrow: 1 }}>
        {children || <span>{value}</span>}
      </div>
      {editable && (
        <Input
          ref={innerRef}
          name={name}
          value={value}
          valueSignal={valueSignal}
          autoFocus
          autoFocusVisible
          autoSelect
          required
          cancelOnEscape
          cancelOnBlurInvalid
          constraints={constraints}
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
            if (e.target.value === valueWhenEditStartRef.current) {
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
      )}
    </>
  );
});

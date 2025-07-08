import { forwardRef } from "preact/compat";
import {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";
import { Input } from "../input/input.jsx";

export const useEditableController = () => {
  const [editable, editableSetter] = useState(false);
  const startEditing = useCallback(() => {
    editableSetter(true);
  }, []);
  const stopEditing = useCallback(() => {
    editableSetter(false);
  }, []);

  const prevEditableRef = useRef(editable);
  const editableJustEnded = prevEditableRef.current && !editable;
  prevEditableRef.current = editable;

  return { editable, startEditing, stopEditing, editableJustEnded };
};

export const EditableText = forwardRef(
  ({ children, action, editable, value, onEditEnd, ...rest }, ref) => {
    if (import.meta.DEV && !action) {
      console.warn(`EditableText requires an action prop`);
    }

    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    return (
      <>
        <div
          style={{ display: editable ? "none" : "inline-flex", flexGrow: 1 }}
        >
          {children || <span>{value}</span>}
        </div>
        {editable && (
          <Input
            {...rest}
            onCancel={() => {
              onEditEnd();
            }}
            onBlur={(e) => {
              if (e.target.value === value) {
                onEditEnd();
              }
            }}
            action={action}
            onActionEnd={() => {
              onEditEnd();
            }}
            ref={innerRef}
            value={value}
            autoFocus
            autoSelect
            required
            cancelOnEscape
            cancelOnBlurInvalid
          />
        )}
      </>
    );
  },
);

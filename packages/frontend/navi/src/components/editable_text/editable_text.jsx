import { forwardRef } from "preact/compat";
import {
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from "preact/hooks";
import { Form } from "../form/form.jsx";
import { InputText } from "../input/input_text.jsx";

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
  ({ action, children, editable, value, onEditEnd, ...rest }, ref) => {
    const innerRef = useRef();
    useImperativeHandle(ref, () => innerRef.current);

    return (
      <>
        <div style={{ display: editable ? "none" : "inline-flex" }}>
          {children || <span>{value}</span>}
        </div>
        {editable && (
          <Form
            action={action}
            onActionEnd={() => {
              onEditEnd();
            }}
          >
            <InputText
              {...rest}
              ref={innerRef}
              value={value}
              autoFocus
              autoSelect
              required
              requestExecuteOnChange
              cancelOnEscape
              cancelOnBlurInvalid
              onCancel={() => {
                onEditEnd();
              }}
              onBlur={(e) => {
                if (e.target.value === value) {
                  onEditEnd();
                }
              }}
            />
          </Form>
        )}
      </>
    );
  },
);

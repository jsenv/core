import { forwardRef } from "preact/compat";
import { useContext, useImperativeHandle, useRef } from "preact/hooks";
import { SPAFormContext } from "./use_spa_form_status.js";

export const SPAButton = forwardRef(
  ({ formAction, children, disabled, ...props }, ref) => {
    const innerRef = useRef();
    const [formStatus, formActionRef] = useContext(SPAFormContext);
    useImperativeHandle(ref, () => innerRef.current);

    return (
      <button
        ref={innerRef}
        {...props}
        onClick={(clickEvent) => {
          formActionRef.current = formAction;
          if (props.onClick) {
            props.onClick(clickEvent);
          }
        }}
        disabled={formStatus.pending || disabled}
      >
        {children}
      </button>
    );
  },
);

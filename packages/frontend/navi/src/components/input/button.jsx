import { forwardRef } from "preact/compat";
import { useContext, useImperativeHandle, useRef } from "preact/hooks";
import { SPAFormContext } from "../form/use_spa_form_status.js";

export const Button = forwardRef(
  ({ action, children, disabled, onClick, ...rest }, ref) => {
    const innerRef = useRef();
    const SPAFormContextValue = useContext(SPAFormContext);
    const formStatus = SPAFormContextValue
      ? SPAFormContextValue[0]
      : { pending: false };
    if (SPAFormContextValue) {
    }
    useImperativeHandle(ref, () => innerRef.current);

    return (
      <button
        ref={innerRef}
        {...rest}
        onClick={(clickEvent) => {
          if (SPAFormContextValue) {
            SPAFormContextValue[1].current = action;
          }
          if (onClick) {
            onClick(clickEvent);
          }
        }}
        disabled={formStatus.pending || disabled}
      >
        {children}
      </button>
    );
  },
);

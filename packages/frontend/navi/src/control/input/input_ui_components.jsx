import { useContext } from "preact/hooks";

import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { Label } from "../field.jsx";
import { dispatchRequestInteraction } from "../validation/custom_constraint_validation.js";
import { InputTextualContext } from "./input_textual_context.js";

export const InputLeftSlot = (props) => {
  return <InputSlot {...props} side="left" />;
};
export const InputRightSlot = (props) => {
  return <InputSlot {...props} side="right" />;
};
export const InputIconSlot = ({ children, side = "right", ...props }) => {
  return (
    <InputSlot side={side}>
      <Icon {...props}>{children}</Icon>
    </InputSlot>
  );
};
export const InputUnitSlot = ({ children, side = "right", ...props }) => {
  return (
    <InputSlot side={side} marginLeft="xxs" {...props}>
      {children}
    </InputSlot>
  );
};

const InputSlot = ({ side, onClick, hideWhileEmpty, ...props }) => {
  const ctx = useContext(InputTextualContext);
  const { id, readOnly, disabled } = ctx;

  return (
    <Label
      htmlFor={id}
      className="navi_input_slot"
      disabled={disabled}
      readOnly={readOnly}
      data-readonly={readOnly}
      data-disabled={disabled}
      data-left={side === "left" ? "" : undefined}
      data-right={side === "right" ? "" : undefined}
      data-hide-while-empty={hideWhileEmpty ? "" : undefined}
      inline
      flex
      align="center"
      onMouseDown={(e) => {
        // Only prevent focus from leaving when the input already has focus.
        // If the input is not focused, let the mousedown proceed normally so
        // the slot element (e.g. a clear button) can receive focus itself.
        const inputEl = document.getElementById(id);
        if (inputEl && inputEl === document.activeElement) {
          e.preventDefault();
        }
      }}
      onClick={(e) => {
        onClick?.(e);
        const input = document.getElementById(id);
        const allowed = dispatchRequestInteraction(input, e);
        if (!allowed) {
          e.preventDefault();
        }
      }}
      {...props}
    />
  );
};

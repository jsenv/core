import { useContext } from "preact/hooks";

import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { Label } from "../field.jsx";
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
    <InputSlot side={side} marginLeft="xxs" noWrap {...props}>
      {children}
    </InputSlot>
  );
};

const InputSlot = ({ side, ...props }) => {
  const ctx = useContext(InputTextualContext);
  const { id, readOnly, disabled } = ctx || {};

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
      {...props}
    />
  );
};

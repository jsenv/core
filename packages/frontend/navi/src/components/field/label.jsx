import { createContext } from "preact";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";

import.meta.css = /* css */ `
  @layer navi {
    label {
      cursor: pointer;
    }

    label[data-readonly],
    label[data-disabled] {
      color: rgba(0, 0, 0, 0.5);
      cursor: default;
    }
  }
`;

export const ReportReadOnlyOnLabelContext = createContext();
export const ReportDisabledOnLabelContext = createContext();

export const Label = forwardRef((props, ref) => {
  const { readOnly, disabled, children, ...rest } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [inputReadOnly, setInputReadOnly] = useState(false);
  const innerReadOnly = readOnly || inputReadOnly;
  const [inputDisabled, setInputDisabled] = useState(false);
  const innerDisabled = disabled || inputDisabled;

  return (
    <label
      ref={innerRef}
      data-readonly={innerReadOnly ? "" : undefined}
      data-disabled={innerDisabled ? "" : undefined}
      {...rest}
    >
      <ReportReadOnlyOnLabelContext.Provider value={setInputReadOnly}>
        <ReportDisabledOnLabelContext.Provider value={setInputDisabled}>
          {children}
        </ReportDisabledOnLabelContext.Provider>
      </ReportReadOnlyOnLabelContext.Provider>
    </label>
  );
});

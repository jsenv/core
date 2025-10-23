import { createContext } from "preact";
import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";

import.meta.css = /* css */ `
  label[data-readonly] {
    color: rgba(0, 0, 0, 0.5);
  }
`;

export const ReportReadOnlyOnLabelContext = createContext();

export const Label = forwardRef((props, ref) => {
  const { readOnly, children, ...rest } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  const [inputReadOnly, setInputReadOnly] = useState(false);
  const innerReadOnly = readOnly || inputReadOnly;

  return (
    <label
      ref={innerRef}
      data-readonly={innerReadOnly ? "" : undefined}
      {...rest}
    >
      <ReportReadOnlyOnLabelContext.Provider value={setInputReadOnly}>
        {children}
      </ReportReadOnlyOnLabelContext.Provider>
    </label>
  );
});

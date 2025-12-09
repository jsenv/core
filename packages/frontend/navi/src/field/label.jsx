import { createContext } from "preact";
import { useState } from "preact/hooks";

import { Box } from "../box/box.jsx";

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

const LabelPseudoClasses = [
  ":hover",
  ":active",
  ":focus",
  ":focus-visible",
  ":read-only",
  ":disabled",
  ":-navi-loading",
];
export const Label = (props) => {
  const { readOnly, disabled, children, ...rest } = props;

  const [inputReadOnly, setInputReadOnly] = useState(false);
  const innerReadOnly = readOnly || inputReadOnly;
  const [inputDisabled, setInputDisabled] = useState(false);
  const innerDisabled = disabled || inputDisabled;

  return (
    <Box
      {...rest}
      as="label"
      pseudoClasses={LabelPseudoClasses}
      basePseudoState={{
        ":read-only": innerReadOnly,
        ":disabled": innerDisabled,
      }}
    >
      <ReportReadOnlyOnLabelContext.Provider value={setInputReadOnly}>
        <ReportDisabledOnLabelContext.Provider value={setInputDisabled}>
          {children}
        </ReportDisabledOnLabelContext.Provider>
      </ReportReadOnlyOnLabelContext.Provider>
    </Box>
  );
};

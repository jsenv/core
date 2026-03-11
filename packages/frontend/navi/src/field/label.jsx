import { createContext } from "preact";
import { useContext, useState } from "preact/hooks";

import { Box } from "../box/box.jsx";

import.meta.css = /* css */ `
  @layer navi {
    label {
      &[data-interactive] {
        cursor: pointer;
      }

      &[data-read-only],
      &[data-disabled] {
        color: rgba(0, 0, 0, 0.5);
        cursor: default;
      }
    }
  }
`;

const ReportReadOnlyOnLabelContext = createContext();
const ReportDisabledOnLabelContext = createContext();
const ReportInteractiveOnLabelContext = createContext();

export const reportReadOnlyToLabel = (value) => {
  const reportReadOnly = useContext(ReportReadOnlyOnLabelContext);
  reportReadOnly?.(value);
};
export const reportInteractiveToLabel = (value) => {
  const reportInteractive = useContext(ReportInteractiveOnLabelContext);
  reportInteractive?.(value);
};
export const reportDisabledToLabel = (value) => {
  const reportDisabled = useContext(ReportDisabledOnLabelContext);
  reportDisabled?.(value);
};

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

  const [interactive, setInteractive] = useState(false);
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
      data-interactive={interactive ? "" : undefined}
    >
      <ReportInteractiveOnLabelContext.Provider value={setInteractive}>
        <ReportReadOnlyOnLabelContext.Provider value={setInputReadOnly}>
          <ReportDisabledOnLabelContext.Provider value={setInputDisabled}>
            {children}
          </ReportDisabledOnLabelContext.Provider>
        </ReportReadOnlyOnLabelContext.Provider>
      </ReportInteractiveOnLabelContext.Provider>
    </Box>
  );
};

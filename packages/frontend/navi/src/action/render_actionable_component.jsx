import { useContext } from "preact/hooks";

import { FormContext } from "../field/form_context.js";

export const renderActionableComponent = (
  props,
  { Basic, WithAction, WithActionInsideForm, WithConnectedAction },
) => {
  const { action, connectedAction, shortcuts } = props;
  const formContext = useContext(FormContext);
  const hasActionProps = Boolean(action || (shortcuts && shortcuts.length > 0));
  const considerInsideForm = Boolean(formContext);

  if (hasActionProps && WithAction) {
    if (considerInsideForm && WithActionInsideForm) {
      return <WithActionInsideForm {...props} />;
    }
    return <WithAction {...props} />;
  }
  if (WithConnectedAction && connectedAction) {
    return <WithConnectedAction {...props} />;
  }

  return <Basic {...props} />;
};

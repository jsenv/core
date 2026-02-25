import { useContext } from "preact/hooks";

import { FormContext } from "../field/form_context.js";

export const renderActionableComponent = (
  props,
  { Basic, WithAction, WithActionInsideForm },
) => {
  const { action, liveAction, shortcuts } = props;
  const formContext = useContext(FormContext);
  const hasActionProps = Boolean(
    action || liveAction || (shortcuts && shortcuts.length > 0),
  );
  const considerInsideForm = Boolean(formContext);

  if (hasActionProps && WithAction) {
    if (considerInsideForm && WithActionInsideForm) {
      return <WithActionInsideForm {...props} />;
    }
    return <WithAction {...props} />;
  }

  return <Basic {...props} />;
};

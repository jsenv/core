import { useContext } from "preact/hooks";

import { FormContext } from "../field/form_context.js";

export const renderActionableComponent = (
  props,
  { Basic, WithAction, InsideForm, WithActionInsideForm },
) => {
  const { action, shortcuts } = props;
  const formContext = useContext(FormContext);
  const hasActionProps = Boolean(action || (shortcuts && shortcuts.length > 0));
  const considerInsideForm = Boolean(formContext);

  if (hasActionProps && WithAction) {
    if (considerInsideForm && WithActionInsideForm) {
      return <WithActionInsideForm formContext={formContext} {...props} />;
    }
    return <WithAction {...props} />;
  }

  if (considerInsideForm && InsideForm) {
    return <InsideForm formContext={formContext} {...props} />;
  }

  return <Basic {...props} />;
};

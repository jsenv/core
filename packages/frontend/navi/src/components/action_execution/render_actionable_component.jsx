import { useContext } from "preact/hooks";

import { FormContext } from "./form_context.js";

export const renderActionableComponent = (
  props,
  ref,
  { Basic, WithAction, InsideForm, WithActionInsideForm },
) => {
  const { action, shortcuts } = props;
  const formContext = useContext(FormContext);
  const hasActionProps = Boolean(action || (shortcuts && shortcuts.length > 0));
  const considerInsideForm = Boolean(formContext);

  if (hasActionProps && WithAction) {
    if (considerInsideForm && WithActionInsideForm) {
      return (
        <WithActionInsideForm formContext={formContext} ref={ref} {...props} />
      );
    }
    return <WithAction ref={ref} {...props} />;
  }

  if (considerInsideForm && InsideForm) {
    return <InsideForm formContext={formContext} ref={ref} {...props} />;
  }

  return <Basic ref={ref} {...props} />;
};

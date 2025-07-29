import { useFormContext } from "./form_context.js";

export const renderActionableComponent = (
  props,
  ref,
  { Basic, WithAction, InsideForm, WithActionInsideForm },
) => {
  const { action, shortcuts, ignoreForm } = props;
  const formContext = useFormContext();
  const hasActionProps = Boolean(action || (shortcuts && shortcuts.length > 0));
  const considerInsideForm = ignoreForm ? false : Boolean(formContext);

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

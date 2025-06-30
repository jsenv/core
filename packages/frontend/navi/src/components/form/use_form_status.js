import { createContext } from "preact";
import { useContext } from "preact/hooks";

const FORM_STATUS_WHEN_OUTSIDE_FORM = {
  pending: false,
  aborted: false,
  error: null,
  action: null,
};

export const FormContext = createContext();
export const useFormStatus = () => {
  const value = useContext(FormContext);
  if (!value) {
    return FORM_STATUS_WHEN_OUTSIDE_FORM;
  }
  const [formStatus] = value;
  return formStatus;
};

const ACTION_REF_WHEN_OUTSIDE_FORM = { current: null };
export const useFormActionRef = () => {
  const value = useContext(FormContext);
  if (!value) {
    return ACTION_REF_WHEN_OUTSIDE_FORM;
  }
  const [, formActionRef] = value;
  return formActionRef;
};

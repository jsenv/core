import { createContext } from "preact";
import { useContext } from "preact/hooks";

export const FormContext = createContext();
export const useFormStatus = () => {
  const value = useContext(FormContext);
  if (!value) {
    return {
      pending: false,
      aborted: false,
      error: null,
      action: null,
    };
  }
  const [formStatus] = value;
  return formStatus;
};

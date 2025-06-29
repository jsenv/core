import { createContext } from "preact";
import { useContext } from "preact/hooks";

export const SPAFormContext = createContext();
export const useSPAFormStatus = () => {
  const value = useContext(SPAFormContext);
  if (!value) {
    return { pending: false, aborted: false, error: null, action: null };
  }
  const [formStatus] = value;
  return formStatus;
};

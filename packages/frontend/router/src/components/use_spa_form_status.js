import { createContext } from "preact";
import { useContext } from "preact/hooks";

export const FormContext = createContext();
export const useSPAFormStatus = () => {
  const [formStatus] = useContext(FormContext);
  return formStatus;
};

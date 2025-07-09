import { createContext } from "preact";
import { useContext } from "preact/hooks";

export const FormContext = createContext();

export const useFormContext = () => {
  return useContext(FormContext);
};

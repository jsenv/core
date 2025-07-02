import { createContext } from "preact";
import { useContext } from "preact/hooks";

export const useHasParentAction = () => {
  const value = useContext(ActionContext);
  return Boolean(value);
};

export const ActionContext = createContext();
export const useParentAction = () => {
  const value = useContext(ActionContext);
  if (!value) {
    return null;
  }
  const parentAction = value;
  return parentAction;
};

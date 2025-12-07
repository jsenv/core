import { createContext } from "preact";
import { useContext } from "preact/hooks";

export const CalloutCloseContext = createContext();
export const prepareCalloutJsx = (children, { close }) => {
  return (
    <CalloutCloseContext.Provider value={close}>
      {children}
    </CalloutCloseContext.Provider>
  );
};

export const useCalloutClose = () => {
  return useContext(CalloutCloseContext);
};

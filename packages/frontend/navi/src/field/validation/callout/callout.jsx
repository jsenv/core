import { createContext, render } from "preact";
import { useContext } from "preact/hooks";

export const CalloutCloseContext = createContext();
export const useCalloutClose = () => {
  return useContext(CalloutCloseContext);
};
export const renderIntoCallout = (jsx, calloutMessageElement, { close }) => {
  const calloutJsx = (
    <CalloutCloseContext.Provider value={close}>
      {jsx}
    </CalloutCloseContext.Provider>
  );

  render(calloutJsx, calloutMessageElement);
};

import { createContext, render } from "preact";
import { useContext } from "preact/hooks";

export const CalloutRequestCloseContext = createContext();
export const useCalloutRequestClose = () => {
  return useContext(CalloutRequestCloseContext);
};
export const renderIntoCallout = (
  jsx,
  calloutMessageElement,
  { requestClose },
) => {
  const calloutJsx = (
    <CalloutRequestCloseContext.Provider value={requestClose}>
      {jsx}
    </CalloutRequestCloseContext.Provider>
  );

  render(calloutJsx, calloutMessageElement);
};

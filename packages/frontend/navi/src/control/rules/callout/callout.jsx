import { createContext, h, render } from "preact";
import { useContext } from "preact/hooks";

// The callout sits under Box in the import graph (Box → interactions →
// control_callout → callout), so it cannot import Text or Icon: the text
// module hands over its emoji renderer when it loads (see text.jsx).
let renderMessageText = (text) => text;
export const setCalloutMessageTextRenderer = (renderer) => {
  renderMessageText = renderer;
};

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

// An HTML message is rendered through preact rather than innerHTML so that its
// text can go through renderMessageText: an emoji in a validation message must
// not make the first line taller than the icon and close button beside it.
export const renderHtmlIntoCallout = (
  html,
  calloutMessageElement,
  { requestClose },
) => {
  const template = document.createElement("template");
  template.innerHTML = html;
  renderIntoCallout(domToVNodes(template.content), calloutMessageElement, {
    requestClose,
  });
};

// Unmounts whatever preact rendered before the element is filled by hand
// (a DOM node, an iframe); innerHTML alone would leave preact believing its
// tree is still there.
export const clearCalloutMessage = (calloutMessageElement) => {
  render(null, calloutMessageElement);
  calloutMessageElement.innerHTML = "";
};

const domToVNodes = (node) => {
  const vnodes = [];
  for (const child of node.childNodes) {
    if (child.nodeType === Node.TEXT_NODE) {
      vnodes.push(renderMessageText(child.data));
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) {
      continue;
    }
    const props = {};
    for (const { name, value } of child.attributes) {
      props[name] = value;
    }
    vnodes.push(h(child.localName, props, ...domToVNodes(child)));
  }
  return vnodes;
};

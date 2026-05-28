export const getControlProxyTarget = (el) => {
  const proxyFor = el.getAttribute("navi-control-proxy-for");
  if (!proxyFor) {
    return null;
  }
  const realControl = document.getElementById(proxyFor);
  return realControl;
};

export const findControlElement = (el) => {
  const naviControlInputAttribute = el.getAttribute("navi-control-input");
  if (!naviControlInputAttribute) {
    return null;
  }
  const fieldEl = el.querySelector(naviControlInputAttribute);
  return fieldEl;
};

export const findAncestorControlElement = (el) => {
  let ancestor;
  const renderedBy = el.getAttribute("navi-control-owner");
  if (renderedBy) {
    // event usually occur on inputs that are sometimes wrapped by a custom ui element
    // these custom ui element have a [navi-control-input] attribute on them
    // we want to look for their ancestor otherwise input would consider their wrapper as a field instead of finding a parent field
    ancestor = el.closest(renderedBy).parentNode;
  } else {
    ancestor = el.parentNode;
  }
  const closestField = ancestor.closest("[navi-control-input]");
  return closestField;
};

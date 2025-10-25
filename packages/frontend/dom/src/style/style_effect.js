import StyleObserver from "style-observer";

import { normalizeStyle } from "./style_parsing.js";

export const styleEffect = (element, callback, properties = []) => {
  const check = () => {
    const values = {};
    const computedStyle = getComputedStyle(element);
    for (const property of properties) {
      values[property] = normalizeStyle(
        element,
        property,
        computedStyle.getPropertyValue(property),
      );
    }
    callback(values);
  };

  check();
  const observer = new StyleObserver(() => {
    check();
  });
  observer.observe(element, properties);

  return () => {
    observer.unobserve();
  };
};

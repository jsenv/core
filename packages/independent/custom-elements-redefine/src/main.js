/*
 * https://github.com/lit/lit/issues/1844
 * https://github.com/vegarringdal/custom-elements-hmr-polyfill/tree/master
 */

import { customElementClassMap } from "./internal/custom_element_class_map.js";
import { createCustomElementFacade } from "./internal/custom_element_facade.js";

let rerenderOnUpdate = false;
export const enableRerenderOnCustomElementUpdate = () => {
  rerenderOnUpdate = true;
};

const defineOriginal = customElements.define;
customElements.define = (customElementName, customElementClass, options) => {
  const registeredCustomElement = customElements.get(customElementName);
  customElementClassMap.set(customElementName, customElementClass);
  if (registeredCustomElement) {
    onCustomElementChange(customElementName, customElementClass, options);
    return;
  }
  const CustomElementFacade = createCustomElementFacade(
    customElementName,
    customElementClass,
  );
  defineOriginal.call(
    customElements,
    customElementName,
    CustomElementFacade,
    options,
  );
};

const elementsChanged = [];
let timeoutId;
const onCustomElementChange = (
  customElementName,
  // customElementClass,
  // options,
) => {
  if (!rerenderOnUpdate) {
    return;
  }
  elementsChanged.push(customElementName);
  clearTimeout(timeoutId);
  timeoutId = setTimeout(() => {
    if (document.body) {
      requestAnimationFrame(() => {
        // re-render the whole DOM
        // this will make less calls to connectedCallback/disconnectedCallback on replaced child node when created.
        const oldBodyHtml = document.body.innerHTML;
        document.body.innerHTML = "";
        document.body.innerHTML = oldBodyHtml;
      });
    }
    elementsChanged.length = 0;
  }, 250);
};

/*
 * https://github.com/lit/lit/issues/1844
 * https://github.com/vegarringdal/custom-elements-hmr-polyfill/tree/master
 */

import { customElementClassMap } from "./internal/custom_element_class_map.js";
import { createCustomElementFacade } from "./internal/custom_element_facade.js";

const defineOriginal = customElements.define;
customElements.define = (customElementName, customElementClass, options) => {
  const registeredCustomElement = customElements.get(customElementName);
  customElementClassMap.set(customElementName, customElementClass);
  if (registeredCustomElement) {
    // const onCustomElementChange = globalThis.hmrCache.onCustomElementChange;
    // if (onCustomElementChange && typeof onCustomElementChange === "function") {
    //   onCustomElementChange(customElementName, customElementClass, options);
    // }
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

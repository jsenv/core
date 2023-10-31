import { patchObject } from "./patch_object.js";
import { customElementClassMap } from "./custom_element_class_map.js";
import { observedAttributesArraySymbol } from "./symbols.js";

export const observerSymbol = Symbol.for("observedAttributesObserver");

export const createCustomElementFacade = (
  customElementName,
  customElementFirstClass,
) => {
  class CustomElementFacade extends customElementFirstClass {
    static get observedAttributes() {
      return [];
    }

    connectedCallback(...args) {
      const CustomElementClass = customElementClassMap.get(customElementName);
      const CustomElementPrototype = CustomElementClass.prototype;
      const attributes = CustomElementClass[observedAttributesArraySymbol];

      // call initial callback when class is created
      if (attributes) {
        if (Array.isArray(attributes)) {
          attributes.forEach((attributeName) => {
            const haveAtt = this.getAttributeNode(attributeName);
            if (haveAtt) {
              CustomElementPrototype.attributeChangedCallback.call(
                this,
                attributeName,
                null,
                this.getAttribute(attributeName),
                null,
              );
            }
          });
        } else {
          console.warn(
            `observedAttributes in ${customElementName} is not array, please fix`,
          );
        }
      }
      const mutationObserver = new MutationObserver((mutationList) => {
        mutationList.forEach((mutation) => {
          if (
            CustomElementPrototype.attributeChangedCallback &&
            attributes &&
            attributes.indexOf(mutation.attributeName) !== -1
          ) {
            CustomElementPrototype.attributeChangedCallback.call(
              this,
              mutation.attributeName,
              mutation.oldValue,
              this.getAttribute(mutation.attributeName),
              null,
            );
          }
        });
      });
      this[observerSymbol] = mutationObserver;
      mutationObserver.observe(this, {
        childList: false,
        attributes: true,
        attributeOldValue: true,
        subtree: false,
      });

      if (CustomElementPrototype.connectedCallback) {
        CustomElementPrototype.connectedCallback.call(this, ...args);
      }
    }

    disconnectedCallback(...args) {
      this[observerSymbol].disconnect();
      this[observerSymbol] = null;

      const CustomElementClass = customElementClassMap.get(customElementName);
      const CustomElementPrototype = CustomElementClass.prototype;
      if (CustomElementPrototype.disconnectedCallback) {
        CustomElementPrototype.disconnectedCallback.call(this, ...args);
      }
    }

    adoptedCallback(...args) {
      const CustomElementClass = customElementClassMap.get(customElementName);
      const CustomElementPrototype = CustomElementClass.prototype;
      if (CustomElementPrototype.adoptedCallback) {
        CustomElementPrototype.adoptedCallback.call(this, ...args);
      }
    }
  }

  return new Proxy(CustomElementFacade, {
    construct: (element, args, newTarget) => {
      const CustomElementClass = customElementClassMap.get(customElementName);
      const CustomElementPrototype = CustomElementClass.prototype;

      if (customElementFirstClass !== CustomElementClass) {
        update_prototype_chain: {
          let proto = CustomElementPrototype;
          let base = null;
          while (proto) {
            if (proto instanceof Element) {
              // if parent is instance of Element then we want it...
              base = proto;
            }
            if (base) {
              break;
            }
            proto = Object.getPrototypeOf(proto);
          }
          patchObject(base.prototype, newTarget.prototype);
        }
        update_prototype: {
          patchObject(CustomElementPrototype, newTarget.prototype);
        }
      }

      const customElementInstance = Reflect.construct(
        CustomElementClass,
        args,
        newTarget,
      );
      // eslint-disable-next-line no-constructor-return
      return customElementInstance;
    },
  });
};

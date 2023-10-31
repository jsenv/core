import { customElementClassMap } from "./custom_element_class_map.js";

const observerSymbol = Symbol.for("observedAttributesObserver");

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
      const observedAttributes = CustomElementClass.observedAttributes;

      // call initial callback when class is created
      if (observedAttributes) {
        if (Array.isArray(observedAttributes)) {
          observedAttributes.forEach((observedAttributeName) => {
            const haveAtt = this.getAttributeNode(observedAttributeName);
            if (haveAtt) {
              CustomElementPrototype.attributeChangedCallback.call(
                this,
                observedAttributeName,
                null,
                this.getAttribute(observedAttributeName),
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
            observedAttributes &&
            observedAttributes.includes(mutation.attributeName)
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

      if (CustomElementClass !== customElementFirstClass) {
        update_prototype_chain: {
          let baseCandidate = Object.getPrototypeOf(CustomElementClass);
          while (baseCandidate) {
            const name = baseCandidate.name;
            if (name) {
              const proto = window[name].prototype;
              if (proto instanceof Element) {
                patchProperties(newTarget.prototype, baseCandidate.prototype);
                break;
              }
            }
            baseCandidate = Object.getPrototypeOf(baseCandidate);
          }
        }
        update_prototype: {
          const CustomElementPrototype = CustomElementClass.prototype;
          patchProperties(newTarget.prototype, CustomElementPrototype);
        }
      }

      // console.log(
      //   newTarget.prototype === CustomElementFacade.prototype,
      //   newTarget === CustomElementFacade,
      //   newTarget === CustomElementClass,
      //   newTarget instanceof CustomElementFacade,
      //   newTarget instanceof CustomElementClass,
      // );
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

const patchProperties = (into, from) => {
  const ownPropertyNames = Object.getOwnPropertyNames(from);
  ownPropertyNames.forEach((ownPropertyName) => {
    if (PROPERTY_NAMES_TO_SKIP.includes(ownPropertyName)) {
      return;
    }
    const propertyDescriptor = Object.getOwnPropertyDescriptor(
      from,
      ownPropertyName,
    );
    if (!propertyDescriptor) {
      return;
    }
    if (!propertyDescriptor.configurable) {
      console.warn(
        "[custom-elements-redefined]",
        `${ownPropertyName} is not configurable, skipping`,
      );
      return;
    }
    Object.defineProperty(into, ownPropertyName, propertyDescriptor);
  });
};
const PROPERTY_NAMES_TO_SKIP = ["name", "prototype", "length"];

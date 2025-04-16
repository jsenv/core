/*
 * https://github.com/lit/lit/issues/1844
 * https://github.com/vegarringdal/custom-elements-hmr-polyfill/tree/master
 */

export const allowCustomElementsRedefine = ({
  updateWholeDOMOnRedefine = false,
} = {}) => {
  const elementsChanged = [];
  let timeoutId;
  const onCustomElementChange = (
    customElementName,
    // customElementClass,
    // options,
  ) => {
    if (!updateWholeDOMOnRedefine) {
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

  const customElementClassMap = new Map();
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

  const observerSymbol = Symbol.for("observedAttributesObserver");
  const createCustomElementFacade = (
    customElementName,
    customElementFirstClass,
  ) => {
    class CustomElementFacade extends customElementFirstClass {
      static get observedAttributes() {
        return [];
      }

      constructor(...args) {
        const CustomElementClass = customElementClassMap.get(customElementName);

        if (CustomElementClass !== customElementFirstClass) {
          update_prototype_chain: {
            let ClassCandidate = CustomElementClass;
            while (ClassCandidate) {
              const nextClassCandidate = Object.getPrototypeOf(ClassCandidate);
              if (!nextClassCandidate) {
                break;
              }
              const name = nextClassCandidate.name;
              if (name) {
                const constructor = window[name];
                if (constructor && constructor.prototype instanceof Element) {
                  patchProperties(
                    CustomElementFacade.prototype,
                    ClassCandidate.prototype,
                  );
                  break;
                }
              }
              ClassCandidate = nextClassCandidate;
            }
          }
          update_prototype: {
            const CustomElementPrototype = CustomElementClass.prototype;
            patchProperties(
              CustomElementFacade.prototype,
              CustomElementPrototype,
            );
          }
        }
        const customElementInstance = Reflect.construct(
          CustomElementClass,
          args,
          CustomElementFacade,
        );
        // eslint-disable-next-line no-constructor-return
        return customElementInstance;
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
    return CustomElementFacade;
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
};

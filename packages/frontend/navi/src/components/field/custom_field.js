import {
  createPubSub,
  createStyleController,
  getDefaultStyles,
  getStyle,
  styleEffect,
} from "@jsenv/dom";

export const initCustomField = (customField, field) => {
  const [teardown, addTeardown] = createPubSub();

  const styleForwarder = createStyleForwarder(field, customField);

  pseudo_classes: {
    const addEventListener = (element, eventType, listener) => {
      element.addEventListener(eventType, listener);
      return addTeardown(() => {
        element.removeEventListener(eventType, listener);
      });
    };
    const updateBooleanAttribute = (attributeName, isPresent) => {
      if (isPresent) {
        customField.setAttribute(attributeName, "");
      } else {
        customField.removeAttribute(attributeName);
      }
    };
    const checkPseudoClasses = () => {
      const hover = field.matches(":hover");
      const active = field.matches(":active");
      const checked = field.matches(":checked");
      const focus = field.matches(":focus");
      const focusVisible = field.matches(":focus-visible");
      updateBooleanAttribute(`data-hover`, hover);
      updateBooleanAttribute(`data-active`, active);
      updateBooleanAttribute(`data-checked`, checked);
      updateBooleanAttribute(`data-focus`, focus);
      updateBooleanAttribute(`data-focus-visible`, focusVisible);

      styleForwarder.update();
    };

    // :hover
    addEventListener(field, "mouseenter", checkPseudoClasses);
    addEventListener(field, "mouseleave", checkPseudoClasses);
    // :active
    addEventListener(field, "mousedown", checkPseudoClasses);
    addEventListener(document, "mouseup", checkPseudoClasses);
    // :focus
    addEventListener(field, "focusin", checkPseudoClasses);
    addEventListener(field, "focusout", checkPseudoClasses);
    // :focus-visible
    addEventListener(document, "keydown", checkPseudoClasses);
    addEventListener(document, "keyup", checkPseudoClasses);
    // :checked
    if (field.type === "checkbox") {
      // Listen to user interactions
      addEventListener(field, "input", checkPseudoClasses);

      // Intercept programmatic changes to .checked property
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "checked",
      );
      Object.defineProperty(field, "checked", {
        get: originalDescriptor.get,
        set(value) {
          originalDescriptor.set.call(this, value);
          checkPseudoClasses();
        },
        configurable: true,
      });
      addTeardown(() => {
        // Restore original property descriptor
        Object.defineProperty(field, "checked", originalDescriptor);
      });
    }
    if (field.type === "radio") {
      // Listen to changes on the radio group
      const radioSet =
        field.closest("[data-radio-list], fieldset, form") || document;
      addEventListener(radioSet, "input", checkPseudoClasses);

      // Intercept programmatic changes to .checked property
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "checked",
      );
      Object.defineProperty(field, "checked", {
        get: originalDescriptor.get,
        set(value) {
          originalDescriptor.set.call(this, value);
          checkPseudoClasses();
        },
        configurable: true,
      });
      addTeardown(() => {
        // Restore original property descriptor
        Object.defineProperty(field, "checked", originalDescriptor);
      });
    }

    // just in case + catch use forcing them in chrome devtools
    const interval = setInterval(() => {
      checkPseudoClasses();
    }, 150);
    addTeardown(() => {
      clearInterval(interval);
    });
  }

  styleForwarder.update();
  addTeardown(() => {
    styleForwarder.disconnect();
  });

  return teardown;
};

const customFieldSync = createStyleController("custom_field_sync");
const syncUsingCssVar = (cssVar) => {
  return {
    set: (el, value) => {
      customFieldSync.set(el, {
        [cssVar]: value,
      });
    },
    remove: (el) => {
      customFieldSync.delete(el, cssVar);
    },
  };
};
const syncUsingStyle = (styleName) => {
  return {
    set: (el, value) => {
      customFieldSync.set(el, {
        [styleName]: value,
      });
    },
    remove: (el) => {
      customFieldSync.delete(el, styleName);
    },
  };
};
const toSync = {
  "margin-left": syncUsingStyle("margin-left"),
  "margin-right": syncUsingStyle("margin-right"),
  "margin-top": syncUsingStyle("margin-top"),
  "margin-bottom": syncUsingStyle("margin-bottom"),

  "outline-width": syncUsingCssVar("--navi-outline-width"),
  "border-width": syncUsingCssVar("--navi-border-width"),
  "border-radius": syncUsingCssVar("--navi-border-radius"),
  "width": syncUsingCssVar("--navi-width"),
  "height": syncUsingCssVar("--navi-height"),

  "outline-color": syncUsingCssVar("--navi-outline-color"),
  "border-color": syncUsingCssVar("--navi-border-color"),
  "background-color": syncUsingCssVar("--navi-background-color"),
  "accent-color": syncUsingCssVar("--navi-accent-color"),
  "color": syncUsingCssVar("--navi-color"),
};
const createStyleForwarder = (sourceElement, targetElement) => {
  const defaultStyles = getDefaultStyles(sourceElement, "css");

  const syncOneStyle = (styleName, howToSync) => {
    const currentValue = getStyle(sourceElement, styleName);
    const defaultValue = defaultStyles[styleName];
    if (currentValue === defaultValue) {
      howToSync.remove(targetElement);
    } else {
      howToSync.set(targetElement, currentValue);
    }
  };

  const update = () => {
    for (const key of Object.keys(toSync)) {
      syncOneStyle(key, toSync[key]);
    }
  };
  update();
  const cleanupStyleEffect = styleEffect(
    sourceElement,
    () => {
      update();
    },
    Object.keys(toSync),
  );

  return {
    update,
    disconnect: () => {
      cleanupStyleEffect();
    },
  };
};

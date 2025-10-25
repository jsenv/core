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
  const addEventListener = (eventType, listener) => {
    field.addEventListener(eventType, listener);
    return addTeardown(() => {
      field.removeEventListener(eventType, listener);
    });
  };
  const updateBooleanAttribute = (attributeName, isPresent) => {
    if (isPresent) {
      customField.setAttribute(attributeName, "");
    } else {
      customField.removeAttribute(attributeName);
    }
  };
  const updateState = (values) => {
    for (const stateName of Object.keys(values)) {
      const value = values[stateName];
      updateBooleanAttribute(`data-${stateName}`, value);
    }
    styleForwarder.update();
  };

  data_hover: {
    addEventListener("mouseenter", () => {
      updateState({ hover: true });
    });
    addEventListener("mouseleave", () => {
      updateState({ hover: false });
    });
  }
  data_focus_and_focus_visible: {
    const updateFocus = () => {
      if (
        document.activeElement === field ||
        field.contains(document.activeElement)
      ) {
        updateState({
          "focus": true,
          "focus-visible": field.matches(":focus-visible"),
        });
      } else {
        updateState({
          "focus": false,
          "focus-visible": false,
        });
      }
    };
    updateFocus();
    addEventListener("focusin", updateFocus);
    addEventListener("focusout", updateFocus);

    // Listen to document key events to update :focus-visible state
    document.addEventListener("keydown", updateFocus);
    document.addEventListener("keyup", updateFocus);
    addTeardown(() => {
      document.removeEventListener("keydown", updateFocus);
      document.removeEventListener("keyup", updateFocus);
    });
  }
  data_active: {
    let onmouseup;
    addEventListener("mousedown", () => {
      updateState({
        active: true,
      });

      onmouseup = () => {
        document.removeEventListener("mouseup", onmouseup);
        updateState({
          active: false,
        });
      };
      document.addEventListener("mouseup", onmouseup);
    });

    addTeardown(() => {
      document.removeEventListener("mouseup", onmouseup);
    });
  }
  data_checked: {
    if (field.type === "checkbox") {
      const updateChecked = () => {
        updateState({
          checked: field.checked,
        });
      };

      // Initial state
      updateChecked();

      // Listen to user interactions
      addEventListener("input", updateChecked);

      // Intercept programmatic changes to .checked property
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "checked",
      );
      Object.defineProperty(field, "checked", {
        get: originalDescriptor.get,
        set(value) {
          originalDescriptor.set.call(this, value);
          updateChecked();
        },
        configurable: true,
      });

      addTeardown(() => {
        // Restore original property descriptor
        Object.defineProperty(field, "checked", originalDescriptor);
      });
    }
    if (field.type === "radio") {
      const updateChecked = () => {
        updateState({
          checked: field.checked,
        });
      };

      // Initial state
      updateChecked();

      // Listen to changes on the radio group
      const radioSet =
        field.closest("[data-radio-list], fieldset, form") || document;
      radioSet.addEventListener("input", updateChecked);

      // Intercept programmatic changes to .checked property
      const originalDescriptor = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "checked",
      );
      Object.defineProperty(field, "checked", {
        get: originalDescriptor.get,
        set(value) {
          originalDescriptor.set.call(this, value);
          updateChecked();
        },
        configurable: true,
      });

      addTeardown(() => {
        radioSet.removeEventListener("input", updateChecked);
        // Restore original property descriptor
        Object.defineProperty(field, "checked", originalDescriptor);
      });
    }
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
const toSync = {
  "border-width": syncUsingCssVar("--navi-border-width"),

  "outline-color": syncUsingCssVar("--navi-outline-color"),
  "border-color": syncUsingCssVar("--navi-border-color"),
  "background-color": syncUsingCssVar("--navi-background-color"),
  "accent-color": syncUsingCssVar("--navi-accent-color"),
  "color": syncUsingCssVar("--navi-color"),
};
const createStyleForwarder = (sourceElement, targetElement) => {
  const defaultStyles = getDefaultStyles(sourceElement);

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

import { createPubSub, getDefaultStyles, styleEffect } from "@jsenv/dom";

const checkboxDefaultStyles = getDefaultStyles(`input[type="checkbox"]`);

export const initCustomField = (customField, field) => {
  const [teardown, addTeardown] = createPubSub();

  const addEventListener = (eventType, listener) => {
    field.addEventListener(eventType, listener);
    return addTeardown(() => {
      field.removeEventListener(eventType, listener);
    });
  };
  const updateBooleanAttribute = (attributeName, isPresent) => {
    const attributeToSet = `data-${attributeName}`;

    if (isPresent) {
      customField.setAttribute(attributeToSet, "");
    } else {
      customField.removeAttribute(attributeToSet);
    }
  };

  data_hover: {
    addEventListener("mouseenter", () => {
      updateBooleanAttribute("hover", true);
    });
    addEventListener("mouseleave", () => {
      updateBooleanAttribute("hover", false);
    });
  }
  data_focus_and_focus_visible: {
    const updateFocus = () => {
      if (
        document.activeElement === field ||
        field.contains(document.activeElement)
      ) {
        updateBooleanAttribute("focus", true);
        if (field.matches(":focus-visible")) {
          updateBooleanAttribute("focus-visible", true);
        }
      } else {
        updateBooleanAttribute("focus", false);
        updateBooleanAttribute("focus-visible", false);
      }
    };
    updateFocus();
    addEventListener("focusin", updateFocus);
    addEventListener("focusout", updateFocus);
  }
  data_active: {
    let onmouseup;
    addEventListener("mousedown", () => {
      updateBooleanAttribute("active", true);
      onmouseup = () => {
        document.removeEventListener("mouseup", onmouseup);
        updateBooleanAttribute("active", false);
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
        updateBooleanAttribute("checked", field.checked);
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
        updateBooleanAttribute("checked", field.checked);
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

  const cleanupStyleEffect = styleEffect(
    field,
    (data) => {
      const currentAccentColor = data["accent-color"];
      const defaultAccentColor = checkboxDefaultStyles["accent-color"];

      console.log({ currentAccentColor, defaultAccentColor });
    },
    ["accent-color"],
  );
  addTeardown(() => {
    cleanupStyleEffect();
  });

  return teardown;
};

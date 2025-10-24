import { createPubSub } from "@jsenv/dom";

export const forwardFieldPseudoSelectors = (
  field,
  nodeReceivingAttributes = field,
) => {
  const [teardown, addTeardown] = createPubSub();

  const addEventListener = (eventType, listener) => {
    field.addEventListener(eventType, listener);
    return addTeardown(() => {
      field.removeEventListener(eventType, listener);
    });
  };
  const updateBooleanAttribute = (attributeName, isPresent) => {
    if (isPresent) {
      nodeReceivingAttributes.setAttribute(attributeName, "");
    } else {
      nodeReceivingAttributes.removeAttribute(attributeName);
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
    addEventListener("focusin", () => {
      updateBooleanAttribute("focus", true);
      if (field.matches(":focus-visible")) {
        updateBooleanAttribute("focus-visible", true);
      }
    });
    addEventListener("focusout", () => {
      updateBooleanAttribute("focus", false);
      updateBooleanAttribute("focus-visible", false);
    });
  }
  data_active: {
    addEventListener("mousedown", () => {
      updateBooleanAttribute("active", true);
      const remove = addEventListener(document, "mouseup", () => {
        remove();
        updateBooleanAttribute("active", false);
      });
    });
  }
  data_checked: {
    if (field.type === "checkbox") {
      addEventListener("input", () => {
        if (field.checked) {
          updateBooleanAttribute("checked", true);
        } else {
          updateBooleanAttribute("checked", false);
        }
      });
    }
    if (field.type === "radio") {
      const thisRadio = field;
      const radioSet = thisRadio.closest("[data-radio-list], fieldset, form");
      radioSet.addEventListener("input", () => {
        if (field.checked) {
          updateBooleanAttribute("checked", true);
        } else {
          updateBooleanAttribute("checked", false);
        }
      });
    }
  }

  return teardown;
};

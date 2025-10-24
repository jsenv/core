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
    const attributeToSet = `data-${attributeName}`;

    if (isPresent) {
      nodeReceivingAttributes.setAttribute(attributeToSet, "");
    } else {
      nodeReceivingAttributes.removeAttribute(attributeToSet);
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
        if (field.checked) {
          updateBooleanAttribute("checked", true);
        } else {
          updateBooleanAttribute("checked", false);
        }
      };
      updateChecked();
      addEventListener("input", updateChecked);
      const mutationObserver = new MutationObserver(() => {
        updateChecked();
      });
      mutationObserver.observe(field, {
        attributes: true,
        attributeFilter: ["checked"],
      });
      addTeardown(() => {
        mutationObserver.disconnect();
      });
    }
    if (field.type === "radio") {
      const updateChecked = () => {
        if (field.checked) {
          updateBooleanAttribute("checked", true);
        } else {
          updateBooleanAttribute("checked", false);
        }
      };
      updateChecked();
      const thisRadio = field;
      const radioSet = thisRadio.closest("[data-radio-list], fieldset, form");
      radioSet.addEventListener("input", updateChecked);
      addTeardown(() => {
        radioSet.removeEventListener("input", updateChecked);
      });
      const mutationObserver = new MutationObserver(() => {
        updateChecked();
      });
      mutationObserver.observe(field, {
        attributes: true,
        attributeFilter: ["checked"],
      });
    }
  }

  return teardown;
};

/**
 * Custom form validation implementation
 *
 * This implementation addresses several limitations of the browser's native validation API:
 *
 * Limitations of native validation:
 * - Cannot programmatically detect if validation message is currently displayed
 * - No ability to dismiss messages with keyboard (e.g., Escape key)
 * - Requires complex event handling to manage validation message display
 * - Limited support for storing/managing multiple validation messages
 * - No customization of validation message appearance
 *
 * Design approach:
 * - Works alongside native validation (which acts as a fallback)
 * - Proactively detects validation issues before native validation triggers
 * - Provides complete control over validation message UX
 * - Supports keyboard navigation and dismissal
 * - Allows custom styling and positioning of validation messages
 *
 * Features:
 * - Constraint-based validation system with built-in and custom constraints
 * - Custom validation messages with different severity levels
 * - Form submission prevention on validation failure
 * - Validation on Enter key in forms or standalone inputs
 * - Escape key to dismiss validation messages
 * - Support for standard HTML validation attributes (required, pattern, type="email")
 * - Validation messages that follow the input element and adapt to viewport
 */

import {
  PATTERN_CONSTRAINT,
  REQUIRED_CONSTRAINT,
  TYPE_EMAIL_CONSTRAINT,
} from "./constraints/native_constraints.js";
import { openValidationMessage } from "./validation_message.js";

export const installCustomConstraintValidation = (element) => {
  const validationInterface = {
    uninstall: undefined,
    registerConstraint: undefined,
    addCustomMessage: undefined,
    removeCustomMessage: undefined,
  };

  const cleanupCallbackSet = new Set();
  cleanup: {
    const uninstall = () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
    validationInterface.uninstall = uninstall;
  }

  expose_as_node_property: {
    element.__validationInterface__ = validationInterface;
    cleanupCallbackSet.add(() => {
      delete element.__validationInterface__;
    });
  }

  const dispatchCancelCustomEvent = (reason) => {
    const cancelEvent = new CustomEvent("cancel", { detail: reason });
    element.dispatchEvent(cancelEvent);
  };

  const handleRequestExecute = (e, { target, requester }) => {
    for (const [key, customMessage] of customMessageMap) {
      if (customMessage.removeOnRequestExecute) {
        customMessageMap.delete(key);
      }
    }
    if (!checkValidity()) {
      e.preventDefault();
      reportValidity();
      return;
    }
    // once we have validated the action can occur
    // we are dispatching a custom event that can be used
    // to actually perform the action or to set form action before the submit event occurs
    const executeCustomEvent = new CustomEvent("execute", {
      detail: {
        reasonEvent: e,
        requester,
      },
    });
    target.dispatchEvent(executeCustomEvent);
  };
  const handleRequestSubmit = (e, { submitter }) => {
    e.preventDefault(); // prevent "submit" event
    handleRequestExecute(e, {
      target: element.form,
      requester: submitter,
    });
  };

  let validationMessage;
  const openElementValidationMessage = () => {
    element.focus();
    const closeOnCleanup = () => {
      validationMessage.close("cleanup");
    };
    let message;
    let level;
    if (typeof lastFailedValidityInfo === "string") {
      message = lastFailedValidityInfo;
    } else {
      message = lastFailedValidityInfo.message;
      level = lastFailedValidityInfo.level;
    }
    validationMessage = openValidationMessage(element, message, {
      level,
      onClose: () => {
        cleanupCallbackSet.delete(closeOnCleanup);
        validationMessage = null;
      },
    });
    cleanupCallbackSet.add(closeOnCleanup);
  };

  const constraintSet = new Set();
  constraintSet.add(REQUIRED_CONSTRAINT);
  constraintSet.add(PATTERN_CONSTRAINT);
  constraintSet.add(TYPE_EMAIL_CONSTRAINT);
  register_constraint: {
    validationInterface.registerConstraint = (constraint) => {
      if (typeof constraint === "function") {
        constraint = {
          name: constraint.name || "custom_function",
          check: constraint,
        };
      }
      constraintSet.add(constraint);
      return () => {
        constraintSet.delete(constraint);
      };
    };
  }

  let lastFailedValidityInfo = null;
  const validityInfoMap = new Map();
  const checkValidity = () => {
    validityInfoMap.clear();
    lastFailedValidityInfo = null;
    for (const constraint of constraintSet) {
      const constraintValidityInfo = constraint.check(element);
      if (constraintValidityInfo) {
        validityInfoMap.set(constraint, constraintValidityInfo);
        lastFailedValidityInfo = constraintValidityInfo;
      }
    }
    return !lastFailedValidityInfo;
  };
  const reportValidity = () => {
    if (!lastFailedValidityInfo) {
      if (validationMessage) {
        validationMessage.close("becomes_valid");
      }
      return;
    }
    if (validationMessage) {
      if (typeof lastFailedValidityInfo === "string") {
        validationMessage.update(lastFailedValidityInfo);
      } else {
        const { message, level } = lastFailedValidityInfo;
        validationMessage.update(message, { level });
      }
      return;
    }
    openElementValidationMessage();
    return;
  };

  const customMessageMap = new Map();
  custom_message: {
    constraintSet.add({
      name: "custom_message",
      check: () => {
        for (const [, { message, level }] of customMessageMap) {
          return { message, level };
        }
        return null;
      },
    });
    const addCustomMessage = (
      key,
      message,
      { level = "error", removeOnRequestExecute = false } = {},
    ) => {
      customMessageMap.set(key, { message, level, removeOnRequestExecute });
      checkValidity();
      reportValidity();
      return () => {
        removeCustomMessage(key);
      };
    };
    const removeCustomMessage = (key) => {
      if (customMessageMap.has(key)) {
        customMessageMap.delete(key);
        checkValidity();
        reportValidity();
      }
    };
    cleanupCallbackSet.add(() => {
      customMessageMap.clear();
    });
    Object.assign(validationInterface, {
      addCustomMessage,
      removeCustomMessage,
    });
  }

  close_and_check_on_input: {
    const oninput = () => {
      customMessageMap.clear();
      if (validationMessage) {
        validationMessage.close("input_event");
      }
      checkValidity();
    };
    element.addEventListener("input", oninput);
    cleanupCallbackSet.add(() => {
      element.removeEventListener("input", oninput);
    });
  }

  report_on_report_validity_call: {
    const nativeReportValidity = element.reportValidity;
    element.reportValidity = () => {
      reportValidity();
    };
    cleanupCallbackSet.add(() => {
      element.reportValidity = nativeReportValidity;
    });
  }

  request_by_form_request_submit_call: {
    const onRequestSubmit = (form, e) => {
      if (form !== element.form) {
        return;
      }
      handleRequestSubmit(e, { submitter: null });
    };
    requestSubmitCallbackSet.add(onRequestSubmit);
    cleanupCallbackSet.add(() => {
      requestSubmitCallbackSet.delete(onRequestSubmit);
    });
  }

  request_by_click_or_enter: {
    const clickHasAnEffect = (element) => {
      return (
        // Input buttons
        (element.tagName === "INPUT" &&
          (element.type === "submit" ||
            element.type === "image" ||
            element.type === "reset" ||
            element.type === "button")) ||
        // Button elements
        element.tagName === "BUTTON" ||
        // Links with href
        (element.tagName === "A" && element.href) ||
        // ARIA buttons
        element.role === "button"
      );
    };

    const willSubmitFormOnClick = (element) => {
      return (
        element.type === "submit" ||
        element.type === "image" ||
        element.type === "reset" ||
        element.type === "button"
      );
    };

    by_click: {
      const onClick = (e) => {
        const target = e.target;
        const form = target.form;
        if (!form) {
          // happens outside a <form>
          if (element === target || element.contains(target)) {
            if (!clickHasAnEffect(target)) {
              return;
            }
            handleRequestExecute(e, {
              target: element,
              requester: target,
            });
          }
          return;
        }
        if (element.form !== form) {
          // happens in an other <form>, or the input has no <form>
          return;
        }
        if (!willSubmitFormOnClick(target)) {
          // click won't request submit
          return;
        }
        handleRequestSubmit(e, {
          submitter: target,
        });
      };
      window.addEventListener("click", onClick, { capture: true });
      cleanupCallbackSet.add(() => {
        window.removeEventListener("click", onClick, { capture: true });
      });
    }

    by_enter: {
      const onKeydown = (e) => {
        if (e.key !== "Enter") {
          return;
        }
        const target = e.target;
        const form = target.form;
        if (!form) {
          // happens outside a <form>
          if (clickHasAnEffect(target)) {
            return;
          }
          if (element === target || element.contains(target)) {
            handleRequestExecute(e, {
              target: element,
              requester: target,
            });
          }
          return;
        }
        if (element.form !== form) {
          // happens in an other <form>, or the element has no <form>
          return;
        }
        if (willSubmitFormOnClick(target)) {
          // we'll catch it in the click handler
          return;
        }
        handleRequestSubmit(e, {
          submitter: target,
        });
      };
      window.addEventListener("keydown", onKeydown, { capture: true });
      cleanupCallbackSet.add(() => {
        window.removeEventListener("keydown", onKeydown, { capture: true });
      });
    }
  }

  request_on_change: {
    const onchange = (changeEvent) => {
      if (!element.hasAttribute("data-request-execute-on-change")) {
        return;
      }
      if (element.validity?.valueMissing) {
        return;
      }
      handleRequestExecute(changeEvent, {
        target: element,
        requester: element,
      });
    };
    element.addEventListener("change", onchange);
    cleanupCallbackSet.add(() => {
      element.removeEventListener("change", onchange);
    });
  }

  close_on_escape: {
    const onkeydown = (e) => {
      if (e.key === "Escape") {
        if (validationMessage) {
          validationMessage.close("escape_key");
        } else {
          dispatchCancelCustomEvent("escape_key");
        }
      }
    };
    element.addEventListener("keydown", onkeydown);
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", onkeydown);
    });
  }

  cancel_on_blur: {
    const onblur = () => {
      if (element.value === "") {
        dispatchCancelCustomEvent("blur_empty");
        return;
      }
      // if we have error, we cancel too
      if (lastFailedValidityInfo) {
        dispatchCancelCustomEvent("blur_invalid");
        return;
      }
    };
    element.addEventListener("blur", onblur);
    cleanupCallbackSet.add(() => {
      element.removeEventListener("blur", onblur);
    });
  }

  return validationInterface;
};

// https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation

const requestSubmitCallbackSet = new Set();
const requestSubmit = HTMLFormElement.prototype.requestSubmit;
HTMLFormElement.prototype.requestSubmit = function (submitter) {
  let prevented = false;
  const preventDefault = () => {
    prevented = true;
  };
  for (const requestSubmitCallback of requestSubmitCallbackSet) {
    requestSubmitCallback(this, { submitter, preventDefault });
  }
  if (prevented) {
    return;
  }
  requestSubmit.call(this, submitter);
};

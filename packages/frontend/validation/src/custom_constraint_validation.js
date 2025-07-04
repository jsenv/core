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
  MAX_CONSTRAINT,
  MAX_LENGTH_CONSTRAINT,
  MIN_CONSTRAINT,
  MIN_LENGTH_CONSTRAINT,
  PATTERN_CONSTRAINT,
  REQUIRED_CONSTRAINT,
  TYPE_EMAIL_CONSTRAINT,
  TYPE_NUMBER_CONSTRAINT,
} from "./constraints/native_constraints.js";
import { openValidationMessage } from "./validation_message.js";

let debug = true;

const validationInProgressWeakSet = new WeakSet();

export const dispatchRequestAction = (
  element,
  event,
  { requester, action } = {},
) => {
  let validationInterface = element.__validationInterface__;
  if (!validationInterface) {
    validationInterface = installCustomConstraintValidation(element);
  }

  return validationInterface.requestAction(
    event || new CustomEvent("requestaction", { cancelable: true }),
    {
      target: element,
      requester: requester || event ? event.target : element,
      action,
    },
  );
};

export const installCustomConstraintValidation = (element) => {
  const validationInterface = {
    uninstall: undefined,
    registerConstraint: undefined,
    addCustomMessage: undefined,
    removeCustomMessage: undefined,
    checkValidity: undefined,
    reportValidity: undefined,
    requestAction: undefined,
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

  const requestAction = (e, { target, requester = target, action }) => {
    if (debug) {
      console.debug(`action requested by`, requester, `(event: "${e.type}")`);
    }

    const isForm = target.tagName === "FORM";
    const isFieldset = target.tagName === "FIELDSET";

    if (isForm || isFieldset) {
      if (validationInProgressWeakSet.has(target)) {
        if (debug) {
          console.debug(`validation already in progress for`, target);
        }
        return;
      }
      validationInProgressWeakSet.add(target);
      setTimeout(() => {
        validationInProgressWeakSet.delete(target);
      });

      const formElements = isForm
        ? // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements
          target.elements
        : target.querySelectorAll(
            "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[name]:not([disabled])",
          );

      for (const formElement of formElements) {
        const validationInterface = formElement.__validationInterface__;
        if (!validationInterface) {
          continue;
        }
        const isValid = validationInterface.checkValidity({
          fromRequestAction: true,
        });
        if (isValid) {
          continue;
        }
        validationInterface.reportValidity();
        const actionPreventedCustomEvent = new CustomEvent("actionprevented", {
          detail: { reasonEvent: e, requester },
        });
        target.dispatchEvent(actionPreventedCustomEvent);
        return;
      }

      const actionCustomEvent = new CustomEvent("action", {
        detail: { cause: e, requester },
      });
      if (debug) {
        console.debug(`element is valid -> dispatch "action" on`, target);
      }
      target.dispatchEvent(actionCustomEvent);
      return;
    }

    let elementReceivingEvents;
    if (target.form) {
      elementReceivingEvents = target.form;
    } else {
      const fieldset = target.closest("fieldset");
      if (fieldset) {
        elementReceivingEvents = fieldset;
      } else {
        elementReceivingEvents = target;
      }
    }
    if (!checkValidity({ fromRequestAction: true })) {
      e.preventDefault();
      reportValidity();
      const actionPreventedCustomEvent = new CustomEvent("actionprevented", {
        detail: { cause: e, requester, lastFailedValidityInfo, action },
      });
      elementReceivingEvents.dispatchEvent(actionPreventedCustomEvent);
      return;
    }
    // once we have validated the action can occur
    // we are dispatching a custom event that can be used
    // to actually perform the action or to set form action
    const actionCustomEvent = new CustomEvent("action", {
      detail: { cause: e, requester, action },
    });
    if (debug) {
      console.debug(`"action" dispatched on`, elementReceivingEvents);
    }
    elementReceivingEvents.dispatchEvent(actionCustomEvent);
  };
  validationInterface.requestAction = requestAction;

  let validationMessage;
  const openElementValidationMessage = ({ skipFocus } = {}) => {
    if (!skipFocus) {
      element.focus();
    }
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
  constraintSet.add(TYPE_NUMBER_CONSTRAINT);
  constraintSet.add(MIN_LENGTH_CONSTRAINT);
  constraintSet.add(MAX_LENGTH_CONSTRAINT);
  constraintSet.add(MIN_CONSTRAINT);
  constraintSet.add(MAX_CONSTRAINT);
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
  const checkValidity = ({ fromRequestAction } = {}) => {
    if (fromRequestAction && lastFailedValidityInfo) {
      for (const [key, customMessage] of customMessageMap) {
        if (customMessage.removeOnRequestAction) {
          customMessageMap.delete(key);
        }
      }
    }

    validityInfoMap.clear();
    lastFailedValidityInfo = null;
    for (const constraint of constraintSet) {
      const constraintValidityInfo = constraint.check(element);
      if (constraintValidityInfo) {
        validityInfoMap.set(constraint, constraintValidityInfo);
        lastFailedValidityInfo = constraintValidityInfo;
      }
    }

    if (!lastFailedValidityInfo && validationMessage) {
      if (validationMessage) {
        validationMessage.close("becomes_valid");
      }
    }

    return !lastFailedValidityInfo;
  };
  const reportValidity = ({ skipFocus } = {}) => {
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
    openElementValidationMessage({ skipFocus });
    return;
  };
  validationInterface.checkValidity = checkValidity;
  validationInterface.reportValidity = reportValidity;

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
      { level = "error", removeOnRequestAction = false } = {},
    ) => {
      customMessageMap.set(key, { message, level, removeOnRequestAction });
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

  dispatch_request_submit_call_on_form: {
    const onRequestSubmit = (form, e) => {
      if (form !== element.form && form !== element) {
        return;
      }

      const requestSubmitCustomEvent = new CustomEvent("requestsubmit", {
        cancelable: true,
        detail: { cause: e },
      });
      form.dispatchEvent(requestSubmitCustomEvent);
      if (requestSubmitCustomEvent.defaultPrevented) {
        e.preventDefault();
      }
    };
    requestSubmitCallbackSet.add(onRequestSubmit);
    cleanupCallbackSet.add(() => {
      requestSubmitCallbackSet.delete(onRequestSubmit);
    });
  }

  execute_on_form_submit: {
    const form = element.form || element.tagName === "FORM" ? element : null;
    if (!form) {
      break execute_on_form_submit;
    }
    const removeListener = addEventListener(form, "submit", (e) => {
      e.preventDefault();
      const actionCustomEvent = new CustomEvent("action", {
        detail: { cause: e, requester: form },
      });
      if (debug) {
        console.debug(`"submit" called -> dispatch "action" on`, form);
      }
      form.dispatchEvent(actionCustomEvent);
    });
    cleanupCallbackSet.add(() => {
      removeListener();
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

// const submit = HTMLFormElement.prototype.submit;
// HTMLFormElement.prototype.submit = function (...args) {
//   const form = this;
//   if (form.hasAttribute("data-method")) {
//     console.warn("You must use form.requestSubmit() instead of form.submit()");
//     return form.requestSubmit();
//   }
//   return submit.apply(this, args);
// };

const addEventListener = (element, event, callback) => {
  element.addEventListener(event, callback);
  return () => {
    element.removeEventListener(event, callback);
  };
};

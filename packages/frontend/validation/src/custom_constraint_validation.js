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
  DISABLED_CONSTRAINT,
  MAX_CONSTRAINT,
  MAX_LENGTH_CONSTRAINT,
  MIN_CONSTRAINT,
  MIN_LENGTH_CONSTRAINT,
  PATTERN_CONSTRAINT,
  REQUIRED_CONSTRAINT,
  TYPE_EMAIL_CONSTRAINT,
  TYPE_NUMBER_CONSTRAINT,
} from "./constraints/native_constraints.js";
import { READONLY_CONSTRAINT } from "./constraints/readonly_constraint.js";
import { openValidationMessage } from "./validation_message.js";

let debug = false;

const validationInProgressWeakSet = new WeakSet();

export const requestAction = (
  action,
  {
    event,
    target = event.target,
    requester = target,
    method = "reload",
    meta = {},
  } = {},
) => {
  let validationInterface = target.__validationInterface__;
  if (!validationInterface) {
    validationInterface = installCustomConstraintValidation(target);
  }

  const customEventDetail = {
    action,
    method,
    event,
    requester,
    meta,
  };

  if (debug) {
    console.debug(
      `action requested by`,
      requester,
      `(event: "${event?.type}")`,
    );
  }

  const isForm = target.tagName === "FORM";
  const formToValidate = isForm ? target : target.form;

  if (formToValidate) {
    if (validationInProgressWeakSet.has(formToValidate)) {
      if (debug) {
        console.debug(`validation already in progress for`, formToValidate);
      }
      return;
    }
    validationInProgressWeakSet.add(formToValidate);
    setTimeout(() => {
      validationInProgressWeakSet.delete(formToValidate);
    });

    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements
    const formElements = formToValidate.elements;
    for (const formElement of formElements) {
      const validationInterface = formElement.__validationInterface__;
      if (!validationInterface) {
        continue;
      }

      const isValid = validationInterface.checkValidity({
        fromRequestAction: true,
        skipReadonly:
          formElement.tagName === "BUTTON" && formElement !== requester,
      });
      if (isValid) {
        continue;
      }
      validationInterface.reportValidity();
      const actionPreventedCustomEvent = new CustomEvent("actionprevented", {
        detail: customEventDetail,
      });
      target.dispatchEvent(actionPreventedCustomEvent);
      return;
    }

    const actionCustomEvent = new CustomEvent("action", {
      detail: customEventDetail,
    });
    if (debug) {
      console.debug(`element is valid -> dispatch "action" on`, target);
    }
    target.dispatchEvent(actionCustomEvent);
    return;
  }

  const elementReceivingEvents = target;
  if (!validationInterface.checkValidity({ fromRequestAction: true })) {
    if (event) {
      event.preventDefault();
    }
    validationInterface.reportValidity();
    const actionPreventedCustomEvent = new CustomEvent("actionprevented", {
      detail: customEventDetail,
    });
    elementReceivingEvents.dispatchEvent(actionPreventedCustomEvent);
    return;
  }
  // once we have validated the action can occur
  // we are dispatching a custom event that can be used
  // to actually perform the action or to set form action
  const actionCustomEvent = new CustomEvent("action", {
    detail: customEventDetail,
  });
  if (debug) {
    console.debug(`"action" dispatched on`, elementReceivingEvents);
  }
  elementReceivingEvents.dispatchEvent(actionCustomEvent);
};

export const closeValidationMessage = (element, reason) => {
  const validationInterface = element.__validationInterface__;
  if (!validationInterface) {
    return false;
  }
  const { validationMessage } = validationInterface;
  if (!validationMessage) {
    return false;
  }
  return validationMessage.close(reason);
};

export const checkValidity = (element) => {
  const validationInterface = element.__validationInterface__;
  if (!validationInterface) {
    return false;
  }
  return validationInterface.checkValidity();
};

export const installCustomConstraintValidation = (
  element,
  elementReceivingValidationMessage = element,
) => {
  if (element.tagName === "INPUT" && element.type === "hidden") {
    elementReceivingValidationMessage = element.form || document.body;
  }

  const validationInterface = {
    uninstall: undefined,
    registerConstraint: undefined,
    addCustomMessage: undefined,
    removeCustomMessage: undefined,
    checkValidity: undefined,
    reportValidity: undefined,
    validationMessage: null,
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

  const dispatchCancelCustomEvent = (options) => {
    const cancelEvent = new CustomEvent("cancel", options);
    element.dispatchEvent(cancelEvent);
  };

  const openElementValidationMessage = ({ skipFocus } = {}) => {
    if (!skipFocus) {
      element.focus();
    }
    const closeOnCleanup = () => {
      closeElementValidationMessage("cleanup");
    };
    validationInterface.validationMessage = openValidationMessage(
      elementReceivingValidationMessage,
      lastFailedConstraintInfo.message,
      {
        level: lastFailedConstraintInfo.level,
        closeOnClickOutside: lastFailedConstraintInfo.closeOnClickOutside,
        onClose: () => {
          cleanupCallbackSet.delete(closeOnCleanup);
          validationInterface.validationMessage = null;
          if (lastFailedConstraintInfo) {
            lastFailedConstraintInfo.reportStatus = "closed";
          }
          if (!skipFocus) {
            element.focus();
          }
        },
      },
    );
    lastFailedConstraintInfo.reportStatus = "reported";
    cleanupCallbackSet.add(closeOnCleanup);
  };

  const closeElementValidationMessage = (reason) => {
    if (validationInterface.validationMessage) {
      validationInterface.validationMessage.close(reason);
      return true;
    }
    return false;
  };

  const constraintSet = new Set();
  constraintSet.add(DISABLED_CONSTRAINT);
  constraintSet.add(REQUIRED_CONSTRAINT);
  constraintSet.add(PATTERN_CONSTRAINT);
  constraintSet.add(TYPE_EMAIL_CONSTRAINT);
  constraintSet.add(TYPE_NUMBER_CONSTRAINT);
  constraintSet.add(MIN_LENGTH_CONSTRAINT);
  constraintSet.add(MAX_LENGTH_CONSTRAINT);
  constraintSet.add(MIN_CONSTRAINT);
  constraintSet.add(MAX_CONSTRAINT);
  constraintSet.add(READONLY_CONSTRAINT);
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

  let lastFailedConstraintInfo = null;
  const validityInfoMap = new Map();
  const checkValidity = (params = {}) => {
    const { fromRequestAction } = params;
    if (fromRequestAction && lastFailedConstraintInfo) {
      for (const [key, customMessage] of customMessageMap) {
        if (customMessage.removeOnRequestAction) {
          customMessageMap.delete(key);
        }
      }
    }

    validityInfoMap.clear();
    lastFailedConstraintInfo = null;
    for (const constraint of constraintSet) {
      const constraintValidityInfo = constraint.check(element, params);
      if (constraintValidityInfo) {
        const failedValidityInfo = {
          name: constraint.name,
          constraint,
          ...(typeof constraintValidityInfo === "string"
            ? { message: constraintValidityInfo }
            : constraintValidityInfo),
          reportStatus: "not_reported",
        };
        validityInfoMap.set(constraint, failedValidityInfo);
        lastFailedConstraintInfo = failedValidityInfo;
      }
    }

    if (!lastFailedConstraintInfo) {
      closeElementValidationMessage("becomes_valid");
    }

    return !lastFailedConstraintInfo;
  };
  const reportValidity = ({ skipFocus } = {}) => {
    if (!lastFailedConstraintInfo) {
      closeElementValidationMessage("becomes_valid");
      return;
    }
    if (validationInterface.validationMessage) {
      const { message, level, closeOnClickOutside } = lastFailedConstraintInfo;
      validationInterface.validationMessage.update(message, {
        level,
        closeOnClickOutside,
      });
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
      closeElementValidationMessage("input_event");
      checkValidity();
    };
    element.addEventListener("input", oninput);
    cleanupCallbackSet.add(() => {
      element.removeEventListener("input", oninput);
    });
  }

  check_on_actionend: {
    // this ensure we re-check validity (and remove message no longer relevant)
    // once the action ends (used to remove the NOT_BUSY_CONSTRAINT message)
    const onactionend = () => {
      checkValidity();
    };
    element.addEventListener("actionend", onactionend);
    if (element.form) {
      element.form.addEventListener("actionend", onactionend);
      cleanupCallbackSet.add(() => {
        element.form.removeEventListener("actionend", onactionend);
      });
    }
    cleanupCallbackSet.add(() => {
      element.removeEventListener("actionend", onactionend);
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
        if (!closeElementValidationMessage("escape_key")) {
          dispatchCancelCustomEvent({ detail: { reason: "escape_key" } });
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
        dispatchCancelCustomEvent({ detail: { reason: "blur_empty" } });
        return;
      }
      // if we have failed constraint, we cancel too
      if (lastFailedConstraintInfo) {
        dispatchCancelCustomEvent({
          detail: {
            reason: "blur_invalid",
            failedConstraintInfo: lastFailedConstraintInfo,
          },
        });
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

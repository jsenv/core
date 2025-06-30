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

let debug = true;

const formValidationInProgressWeakSet = new WeakSet();

export const installCustomConstraintValidation = (element) => {
  const validationInterface = {
    uninstall: undefined,
    registerConstraint: undefined,
    addCustomMessage: undefined,
    removeCustomMessage: undefined,
    checkValidity: undefined,
    reportValidity: undefined,
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

  const handleRequestExecute = (e, { target, requester = target }) => {
    if (debug) {
      console.debug(`execute requested after "${e.type}" on`, requester);
    }

    const elementReceivingEvents = target.form ? target.form : target;
    if (!checkValidity({ isExecuteRequest: true })) {
      e.preventDefault();
      reportValidity();
      const executePreventedCustomEvent = new CustomEvent("executeprevented", {
        detail: { reasonEvent: e, requester, lastFailedValidityInfo },
      });
      elementReceivingEvents.dispatchEvent(executePreventedCustomEvent);
      return;
    }
    // once we have validated the action can occur
    // we are dispatching a custom event that can be used
    // to actually perform the action or to set form action
    const executeCustomEvent = new CustomEvent("execute", {
      detail: { reasonEvent: e, requester },
    });
    if (debug) {
      console.debug(`execute dispatched after on`, elementReceivingEvents);
    }
    elementReceivingEvents.dispatchEvent(executeCustomEvent);
  };

  const handleRequestSubmit = (e, { submitter } = {}) => {
    const form = element.form;
    if (formValidationInProgressWeakSet.has(form)) {
      if (debug) {
        console.debug(`form validation already in progress for`, form);
      }
      return;
    }
    formValidationInProgressWeakSet.add(form);
    setTimeout(() => {
      formValidationInProgressWeakSet.delete(form);
    });

    if (debug) {
      console.debug(`form validation requested by`, submitter);
    }
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements
    for (const formElement of form.elements) {
      const validationInterface = formElement.__validationInterface__;
      if (!validationInterface) {
        continue;
      }
      const isValid = validationInterface.checkValidity({
        isExecuteRequest: true,
      });
      if (isValid) {
        continue;
      }
      validationInterface.reportValidity();
      const executePreventedCustomEvent = new CustomEvent("executeprevented", {
        detail: {
          reasonEvent: e,
          submitter,
        },
      });
      form.dispatchEvent(executePreventedCustomEvent);
      return;
    }

    const executeCustomEvent = new CustomEvent("execute", {
      detail: { reasonEvent: e, submitter },
    });
    if (debug) {
      console.debug(`execute dispatched on form after validation success`);
    }
    form.dispatchEvent(executeCustomEvent);
  };

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
  const checkValidity = ({ isExecuteRequest } = {}) => {
    if (isExecuteRequest && lastFailedValidityInfo) {
      for (const [key, customMessage] of customMessageMap) {
        if (customMessage.removeOnRequestExecute) {
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

      // prevent "submit" event that would be dispatched by the browser after form.requestSubmit()
      // (not super important because our <form> listen the "execute" and do does preventDefault on "submit")
      e.preventDefault();

      handleRequestSubmit(e);
    };
    requestSubmitCallbackSet.add(onRequestSubmit);
    cleanupCallbackSet.add(() => {
      requestSubmitCallbackSet.delete(onRequestSubmit);
    });
  }

  request_by_click_or_enter: {
    const findEventTargetOrAncestor = (event, predicate, rootElement) => {
      const target = event.target;
      const result = predicate(target);
      if (result) {
        return result;
      }
      let parentElement = target.parentElement;
      while (parentElement && parentElement !== rootElement) {
        const parentResult = predicate(parentElement);
        if (parentResult) {
          return parentResult;
        }
        parentElement = parentElement.parentElement;
      }
      return null;
    };
    const formHasSubmitButton = (form) => {
      return form.querySelector(
        "button[type='submit'], input[type='submit'], input[type='image']",
      );
    };
    const getElementEffect = (element) => {
      const isButton =
        element.tagName === "BUTTON" || element.role === "button";
      if (element.tagName === "INPUT" || isButton) {
        if (element.type === "submit" || element.type === "image") {
          return "submit";
        }
        if (element.type === "reset") {
          return "reset";
        }
        if (isButton || element.type === "button") {
          const form = element.form;
          if (!form) {
            return "activate";
          }
          if (formHasSubmitButton(form)) {
            return "activate";
          }
          return "submit";
        }
      }
      return null;
    };

    by_click: {
      const onClick = (e) => {
        const target = e.target;
        const form = target.form;
        if (!form) {
          // happens outside a <form>
          if (target !== element && !element.contains(target)) {
            // happens outside this element
            return;
          }
          const effect = findEventTargetOrAncestor(
            e,
            getElementEffect,
            element,
          );
          if (effect === "activate") {
            handleRequestExecute(e, {
              target: element,
              requester: target,
            });
          }
          // "reset", null
          return;
        }
        if (element.form !== form) {
          // happens in an other <form>, or the input has no <form>
          return;
        }
        const effect = findEventTargetOrAncestor(e, getElementEffect, form);
        if (effect === "submit") {
          // prevent "submit" event that would be dispatched by the browser after "click"
          // (not super important because our <form> listen the "execute" and do does preventDefault on "submit")
          e.preventDefault();

          handleRequestSubmit(e, {
            submitter: target,
          });
        }
        // "activate", "reset", null
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
          if (target !== element && !element.contains(target)) {
            // happens outside this element
            return;
          }
          const effect = findEventTargetOrAncestor(e, getElementEffect, form);
          if (effect === "activate") {
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
        const effect = findEventTargetOrAncestor(e, getElementEffect, form);
        if (effect === "activate") {
          handleRequestExecute(e, {
            target: element,
            submitter: target,
          });
          return;
        }
        // "submit", "reset", null
      };
      window.addEventListener("keydown", onKeydown, { capture: true });
      cleanupCallbackSet.add(() => {
        window.removeEventListener("keydown", onKeydown, { capture: true });
      });
    }
  }

  request_on_change_according_to_data_attribute: {
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
    const removeChange = addEventListener(element, "change", onchange);
    cleanupCallbackSet.add(() => {
      removeChange();
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

const addEventListener = (element, event, callback) => {
  element.addEventListener(event, callback);
  return () => {
    element.removeEventListener(event, callback);
  };
};

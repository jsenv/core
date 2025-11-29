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

/**
 * To enable this API one have to call installCustomConstraintValidation(element)
 * on the <form> and every element within the <form> (<input>, <button>, etc.)
 * (In practice this is done automatically by jsx components in navi package)
 *
 * Once installed code must now listen to specific action events on the <form>
 * (not "submit" but "actionrequested" most notably)
 *
 * There is one way to fully bypass validation which is to call form.submit()
 * just like you could do with the native validation API to bypass validation.
 * We keep this behavior on purpose but in practice you always want to go through the form validation process
 */

import { createPubSub } from "@jsenv/dom";
import { openCallout } from "../components/callout/callout.js";
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
import { SAME_AS_CONSTRAINT } from "./constraints/same_as_constraint.js";
import { listenInputChange } from "./input_change_effect.js";

let debug = false;

const validationInProgressWeakSet = new WeakSet();

export const requestAction = (
  target,
  action,
  {
    actionOrigin,
    event,
    requester = target,
    method = "rerun",
    meta = {},
    confirmMessage,
  } = {},
) => {
  if (!actionOrigin) {
    console.warn("requestAction: actionOrigin is required");
  }
  let elementToValidate = requester;

  let validationInterface = elementToValidate.__validationInterface__;
  if (!validationInterface) {
    validationInterface = installCustomConstraintValidation(elementToValidate);
  }

  const customEventDetail = {
    action,
    actionOrigin,
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

  // Determine what needs to be validated and how to handle the result
  const isForm = elementToValidate.tagName === "FORM";
  const formToValidate = isForm ? elementToValidate : elementToValidate.form;

  let isValid = false;
  let elementForConfirmation = elementToValidate;
  let elementForDispatch = elementToValidate;

  if (formToValidate) {
    // Form validation case
    if (validationInProgressWeakSet.has(formToValidate)) {
      if (debug) {
        console.debug(`validation already in progress for`, formToValidate);
      }
      return false;
    }
    validationInProgressWeakSet.add(formToValidate);
    setTimeout(() => {
      validationInProgressWeakSet.delete(formToValidate);
    });

    // Validate all form elements
    const formElements = formToValidate.elements;
    isValid = true; // Assume valid until proven otherwise
    for (const formElement of formElements) {
      const elementValidationInterface = formElement.__validationInterface__;
      if (!elementValidationInterface) {
        continue;
      }

      const elementIsValid = elementValidationInterface.checkValidity({
        fromRequestAction: true,
        skipReadonly:
          formElement.tagName === "BUTTON" && formElement !== requester,
      });
      if (!elementIsValid) {
        elementValidationInterface.reportValidity();
        isValid = false;
        break;
      }
    }

    elementForConfirmation = formToValidate;
    elementForDispatch = target;
  } else {
    // Single element validation case
    isValid = validationInterface.checkValidity({ fromRequestAction: true });
    if (!isValid) {
      validationInterface.reportValidity();
    }
    elementForConfirmation = target;
    elementForDispatch = target;
  }

  // If validation failed, dispatch actionprevented and return
  if (!isValid) {
    const actionPreventedCustomEvent = new CustomEvent("actionprevented", {
      detail: customEventDetail,
    });
    elementForDispatch.dispatchEvent(actionPreventedCustomEvent);
    return false;
  }

  // Validation passed, check for confirmation
  confirmMessage =
    confirmMessage ||
    elementForConfirmation.getAttribute("data-confirm-message");
  if (confirmMessage) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(confirmMessage)) {
      const actionPreventedCustomEvent = new CustomEvent("actionprevented", {
        detail: customEventDetail,
      });
      elementForDispatch.dispatchEvent(actionPreventedCustomEvent);
      return false;
    }
  }

  // All good, dispatch the action
  const actionCustomEvent = new CustomEvent("action", {
    detail: customEventDetail,
  });
  if (debug) {
    console.debug(
      `element is valid -> dispatch "action" on`,
      elementForDispatch,
    );
  }
  elementForDispatch.dispatchEvent(actionCustomEvent);
  return true;
};

export const forwardActionRequested = (e, action, target = e.target) => {
  requestAction(target, action, {
    actionOrigin: e.detail?.actionOrigin,
    event: e.detail?.event || e,
    requester: e.detail?.requester,
    meta: e.detail?.meta,
  });
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

const formInstrumentedWeakSet = new WeakSet();
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

  const [teardown, addTeardown] = createPubSub();
  cleanup: {
    const uninstall = () => {
      teardown();
    };
    validationInterface.uninstall = uninstall;
  }

  const isForm = element.tagName === "FORM";
  if (isForm) {
    formInstrumentedWeakSet.add(element);
    addTeardown(() => {
      formInstrumentedWeakSet.delete(element);
    });
  }

  expose_as_node_property: {
    element.__validationInterface__ = validationInterface;
    addTeardown(() => {
      delete element.__validationInterface__;
    });
  }

  const dispatchCancelCustomEvent = (options) => {
    const cancelEvent = new CustomEvent("cancel", options);
    element.dispatchEvent(cancelEvent);
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
  constraintSet.add(SAME_AS_CONSTRAINT);
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

  let failedConstraintInfo = null;
  const validityInfoMap = new Map();

  const hasTitleAttribute = element.hasAttribute("title");

  const resetValidity = ({ fromRequestAction } = {}) => {
    if (fromRequestAction && failedConstraintInfo) {
      for (const [key, customMessage] of customMessageMap) {
        if (customMessage.removeOnRequestAction) {
          customMessageMap.delete(key);
        }
      }
    }

    for (const [, validityInfo] of validityInfoMap) {
      if (validityInfo.cleanup) {
        validityInfo.cleanup();
      }
    }
    validityInfoMap.clear();
    failedConstraintInfo = null;
  };
  addTeardown(resetValidity);

  const checkValidity = ({ fromRequestAction, skipReadonly } = {}) => {
    resetValidity({ fromRequestAction });
    for (const constraint of constraintSet) {
      const constraintCleanupSet = new Set();
      const registerChange = (register) => {
        const registerResult = register(() => {
          checkValidity();
        });
        if (typeof registerResult === "function") {
          constraintCleanupSet.add(registerResult);
        }
      };
      const cleanup = () => {
        for (const cleanupCallback of constraintCleanupSet) {
          cleanupCallback();
        }
        constraintCleanupSet.clear();
      };

      const checkResult = constraint.check(element, {
        fromRequestAction,
        skipReadonly,
        registerChange,
      });
      if (!checkResult) {
        cleanup();
        continue;
      }
      const constraintValidityInfo =
        typeof checkResult === "string"
          ? { message: checkResult }
          : checkResult;

      failedConstraintInfo = {
        name: constraint.name,
        constraint,
        ...constraintValidityInfo,
        cleanup,
        reportStatus: "not_reported",
      };
      validityInfoMap.set(constraint, failedConstraintInfo);
    }

    if (failedConstraintInfo) {
      if (!hasTitleAttribute) {
        // when a constraint is failing browser displays that constraint message if the element has no title attribute.
        // We want to do the same with our message (overriding the browser in the process to get better messages)
        element.setAttribute("title", failedConstraintInfo.message);
      }
    } else {
      if (!hasTitleAttribute) {
        element.removeAttribute("title");
      }
      closeElementValidationMessage("becomes_valid");
    }

    return !failedConstraintInfo;
  };
  const reportValidity = ({ skipFocus } = {}) => {
    if (!failedConstraintInfo) {
      closeElementValidationMessage("becomes_valid");
      return;
    }
    if (failedConstraintInfo.silent) {
      closeElementValidationMessage("invalid_silent");
      return;
    }
    if (validationInterface.validationMessage) {
      const { message, level, closeOnClickOutside } = failedConstraintInfo;
      validationInterface.validationMessage.update(message, {
        level,
        closeOnClickOutside,
      });
      return;
    }
    if (!skipFocus) {
      element.focus();
    }
    const removeCloseOnCleanup = addTeardown(() => {
      closeElementValidationMessage("cleanup");
    });

    const anchorElement =
      failedConstraintInfo.target || elementReceivingValidationMessage;
    validationInterface.validationMessage = openCallout(
      failedConstraintInfo.message,
      {
        anchorElement,
        level: failedConstraintInfo.level,
        closeOnClickOutside: failedConstraintInfo.closeOnClickOutside,
        onClose: () => {
          removeCloseOnCleanup();
          validationInterface.validationMessage = null;
          if (failedConstraintInfo) {
            failedConstraintInfo.reportStatus = "closed";
          }
          if (!skipFocus) {
            element.focus();
          }
        },
      },
    );
    failedConstraintInfo.reportStatus = "reported";
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
    addTeardown(() => {
      customMessageMap.clear();
    });
    Object.assign(validationInterface, {
      addCustomMessage,
      removeCustomMessage,
    });
  }

  checkValidity();
  close_and_check_on_input: {
    const oninput = () => {
      customMessageMap.clear();
      closeElementValidationMessage("input_event");
      checkValidity();
    };
    element.addEventListener("input", oninput);
    addTeardown(() => {
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
    addTeardown(() => {
      element.removeEventListener("actionend", onactionend);
    });
  }

  report_on_report_validity_call: {
    const nativeReportValidity = element.reportValidity;
    element.reportValidity = () => {
      reportValidity();
    };
    addTeardown(() => {
      element.reportValidity = nativeReportValidity;
    });
  }

  request_on_enter: {
    if (element.tagName !== "INPUT") {
      // maybe we want it too for checkboxes etc, we'll see
      break request_on_enter;
    }
    const onkeydown = (keydownEvent) => {
      if (keydownEvent.defaultPrevented) {
        return;
      }
      if (keydownEvent.key !== "Enter") {
        return;
      }
      if (element.hasAttribute("data-action")) {
        if (wouldKeydownSubmitForm(keydownEvent)) {
          keydownEvent.preventDefault();
        }
        dispatchActionRequestedCustomEvent(element, {
          event: keydownEvent,
          requester: element,
        });
        return;
      }
      const { form } = element;
      if (!form) {
        return;
      }
      keydownEvent.preventDefault();
      dispatchActionRequestedCustomEvent(form, {
        event: keydownEvent,
        requester: getFirstButtonSubmittingForm(form) || element,
      });
    };
    element.addEventListener("keydown", onkeydown);
    addTeardown(() => {
      element.removeEventListener("keydown", onkeydown);
    });
  }

  request_on_button_click: {
    const onclick = (clickEvent) => {
      if (clickEvent.defaultPrevented) {
        return;
      }
      if (element.tagName !== "BUTTON") {
        return;
      }
      if (element.hasAttribute("data-action")) {
        if (wouldButtonClickSubmitForm(element, clickEvent)) {
          clickEvent.preventDefault();
        }
        dispatchActionRequestedCustomEvent(element, {
          event: clickEvent,
          requester: element,
        });
        return;
      }
      const { form } = element;
      if (!form) {
        return;
      }
      if (element.type === "reset") {
        return;
      }
      if (wouldButtonClickSubmitForm(element, clickEvent)) {
        clickEvent.preventDefault();
      }
      dispatchActionRequestedCustomEvent(form, {
        event: clickEvent,
        requester: element,
      });
    };
    element.addEventListener("click", onclick);
    addTeardown(() => {
      element.removeEventListener("click", onclick);
    });
  }

  request_on_input_change: {
    const isInput =
      element.tagName === "INPUT" || element.tagName === "TEXTAREA";
    if (!isInput) {
      break request_on_input_change;
    }
    const stop = listenInputChange(element, (e) => {
      if (element.hasAttribute("data-action")) {
        dispatchActionRequestedCustomEvent(element, {
          event: e,
          requester: element,
        });
        return;
      }
    });
    addTeardown(() => {
      stop();
    });
  }

  execute_on_form_submit: {
    if (!isForm) {
      break execute_on_form_submit;
    }
    // We will dispatch "action" when "submit" occurs (code called from.submit() to bypass validation)
    const form = element;
    const removeListener = addEventListener(form, "submit", (e) => {
      e.preventDefault();
      if (debug) {
        console.debug(`"submit" called -> dispatch "action" on`, form);
      }
      const actionCustomEvent = new CustomEvent("action", {
        detail: {
          action: null,
          event: e,
          method: "rerun",
          requester: form,
          meta: {
            isSubmit: true,
          },
        },
      });
      form.dispatchEvent(actionCustomEvent);
    });
    addTeardown(() => {
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
    addTeardown(() => {
      element.removeEventListener("keydown", onkeydown);
    });
  }

  cancel_on_blur: {
    const onblur = () => {
      if (element.value === "") {
        dispatchCancelCustomEvent({
          detail: {
            reason: "blur_empty",
          },
        });
        return;
      }
      // if we have failed constraint, we cancel too
      if (failedConstraintInfo) {
        dispatchCancelCustomEvent({
          detail: {
            reason: "blur_invalid",
            failedConstraintInfo,
          },
        });
        return;
      }
    };
    element.addEventListener("blur", onblur);
    addTeardown(() => {
      element.removeEventListener("blur", onblur);
    });
  }

  return validationInterface;
};

const wouldButtonClickSubmitForm = (button, clickEvent) => {
  if (clickEvent.defaultPrevented) {
    return false;
  }
  const { form } = button;
  if (!form) {
    return false;
  }
  if (!button) {
    return false;
  }
  const wouldSubmitFormByType =
    button.type === "submit" || button.type === "image";
  if (wouldSubmitFormByType) {
    return true;
  }
  if (button.type) {
    return false;
  }
  if (getFirstButtonSubmittingForm(form)) {
    // an other button is explicitly submitting the form, this one would not submit it
    return false;
  }
  // this is the only button inside the form without type attribute, so it defaults to type="submit"
  return true;
};
const getFirstButtonSubmittingForm = (form) => {
  return form.querySelector(
    `button[type="submit"], input[type="submit"], input[type="image"]`,
  );
};

const wouldKeydownSubmitForm = (keydownEvent) => {
  if (keydownEvent.defaultPrevented) {
    return false;
  }
  const keydownTarget = keydownEvent.target;
  const { form } = keydownTarget;
  if (!form) {
    return false;
  }
  if (keydownEvent.key !== "Enter") {
    return false;
  }
  const isTextInput =
    keydownTarget.tagName === "INPUT" || keydownTarget.tagName === "TEXTAREA";
  if (!isTextInput) {
    return false;
  }
  return true;
};

const dispatchActionRequestedCustomEvent = (
  fieldOrForm,
  { actionOrigin = "action_prop", event, requester },
) => {
  const actionRequestedCustomEvent = new CustomEvent("actionrequested", {
    cancelable: true,
    detail: {
      actionOrigin,
      event,
      requester,
    },
  });
  fieldOrForm.dispatchEvent(actionRequestedCustomEvent);
};
// https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
const requestSubmit = HTMLFormElement.prototype.requestSubmit;
HTMLFormElement.prototype.requestSubmit = function (submitter) {
  const form = this;
  const isInstrumented = formInstrumentedWeakSet.has(form);
  if (!isInstrumented) {
    requestSubmit.call(form, submitter);
    return;
  }
  const programmaticEvent = new CustomEvent("programmatic_requestsubmit", {
    cancelable: true,
    detail: {
      submitter,
    },
  });
  dispatchActionRequestedCustomEvent(form, {
    event: programmaticEvent,
    requester: submitter,
  });

  // When all fields are valid calling the native requestSubmit would let browser go through the
  // standard form validation steps leading to form submission.
  // We don't want that because we have our own action system to handle forms
  // If we did that the form submission would happen in parallel of our action system
  // and because we listen to "submit" event to dispatch "action" event
  // we would end up with two actions being executed.
  //
  // In case we have discrepencies in our implementation compared to the browser standard
  // this also prevent the native validation message to show up.

  // requestSubmit.call(this, submitter);
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

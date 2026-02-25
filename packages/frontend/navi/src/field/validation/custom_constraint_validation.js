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
 *
 * Constraint evaluation behavior:
 * This implementation differs from browser native validation in how it handles empty values.
 * Native validation typically ignores constraints (like minLength) when the input is empty,
 * only validating them once the user starts typing. This prevents developers from knowing
 * the validation state until user interaction begins.
 *
 * Our approach:
 * - When 'required' attribute is not set: behaves like native validation (ignores constraints on empty values)
 * - When 'required' attribute is set: evaluates all constraints even on empty values
 *
 * This allows for complete constraint state visibility when fields are required, enabling
 * better UX patterns like showing all validation requirements upfront.
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

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { openCallout } from "./callout/callout.js";
import { getMessageFromAttribute } from "./constraint_message_attribute.js";
import {
  MIN_DIGIT_CONSTRAINT,
  MIN_LOWER_LETTER_CONSTRAINT,
  MIN_SPECIAL_CHAR_CONSTRAINT,
  MIN_UPPER_LETTER_CONSTRAINT,
} from "./constraints/min_char_constraint.js";
import { READONLY_CONSTRAINT } from "./constraints/readonly_constraint.js";
import { SAME_AS_CONSTRAINT } from "./constraints/same_as_constraint.js";
import { SINGLE_SPACE_CONSTRAINT } from "./constraints/single_space_constraint.js";
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
} from "./constraints/standard_constraints.js";
import { listenInputValue } from "./input_value_listener.js";

let debug = false;
export const NAVI_VALIDITY_CHANGE_CUSTOM_EVENT = "navi_validity_change";

const STANDARD_CONSTRAINT_SET = new Set([
  DISABLED_CONSTRAINT,
  REQUIRED_CONSTRAINT,
  PATTERN_CONSTRAINT,
  TYPE_EMAIL_CONSTRAINT,
  TYPE_NUMBER_CONSTRAINT,
  MIN_LENGTH_CONSTRAINT,
  MAX_LENGTH_CONSTRAINT,
  MIN_CONSTRAINT,
  MAX_CONSTRAINT,
]);
const NAVI_CONSTRAINT_SET = new Set([
  // the order matters here, the last constraint is picked first when multiple constraints fail
  // so it's better to keep the most complex constraints at the beginning of the list
  // so the more basic ones shows up first
  MIN_SPECIAL_CHAR_CONSTRAINT,
  SINGLE_SPACE_CONSTRAINT,
  MIN_DIGIT_CONSTRAINT,
  MIN_UPPER_LETTER_CONSTRAINT,
  MIN_LOWER_LETTER_CONSTRAINT,
  SAME_AS_CONSTRAINT,
  READONLY_CONSTRAINT,
]);
const DEFAULT_CONSTRAINT_SET = new Set([
  ...STANDARD_CONSTRAINT_SET,
  ...NAVI_CONSTRAINT_SET,
]);

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
  if (debug) {
    console.debug(`installCustomConstraintValidation on`, element);
  }
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

  const constraintSet = new Set(DEFAULT_CONSTRAINT_SET);

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

  let constraintValidityState = { valid: true };
  const getConstraintValidityState = () => constraintValidityState;
  validationInterface.getConstraintValidityState = getConstraintValidityState;

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
    let newConstraintValidityState = { valid: true };

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
        newConstraintValidityState[constraint.name] = null;
        continue;
      }
      const constraintValidityInfo =
        typeof checkResult === "string"
          ? { message: checkResult }
          : checkResult;
      constraintValidityInfo.messageString = constraintValidityInfo.message;

      if (constraint.messageAttribute) {
        const messageFromAttribute = getMessageFromAttribute(
          element,
          constraint.messageAttribute,
          constraintValidityInfo.message,
        );
        if (messageFromAttribute !== constraintValidityInfo.message) {
          constraintValidityInfo.message = messageFromAttribute;
          if (typeof messageFromAttribute === "string") {
            constraintValidityInfo.messageString = messageFromAttribute;
          }
        }
      }
      const thisConstraintFailureInfo = {
        name: constraint.name,
        constraint,
        status: "warning",
        ...constraintValidityInfo,
        cleanup,
        reportStatus: "not_reported",
      };
      validityInfoMap.set(constraint, thisConstraintFailureInfo);
      newConstraintValidityState.valid = false;
      newConstraintValidityState[constraint.name] = thisConstraintFailureInfo;

      // Constraint evaluation: evaluate all constraints when required is set,
      // otherwise follow native behavior (skip constraints on empty values)
      if (failedConstraintInfo) {
        // there is already a failing constraint, which one to we pick?
        const constraintPicked = pickConstraint(
          failedConstraintInfo.constraint,
          constraint,
        );
        if (constraintPicked === constraint) {
          failedConstraintInfo = thisConstraintFailureInfo;
        } else {
          // keep the current failedConstraintInfo, this one fails but it's considered secondary
        }
      } else {
        // first failing constraint
        failedConstraintInfo = thisConstraintFailureInfo;
      }
    }

    if (failedConstraintInfo && !failedConstraintInfo.silent) {
      if (!hasTitleAttribute) {
        // when a constraint is failing browser displays that constraint message if the element has no title attribute.
        // We want to do the same with our message (overriding the browser in the process to get better messages)
        element.setAttribute("title", failedConstraintInfo.messageString);
      }
    } else {
      if (!hasTitleAttribute) {
        element.removeAttribute("title");
      }
      closeElementValidationMessage("becomes_valid");
    }

    if (
      !compareTwoJsValues(constraintValidityState, newConstraintValidityState)
    ) {
      constraintValidityState = newConstraintValidityState;
      element.dispatchEvent(new CustomEvent(NAVI_VALIDITY_CHANGE_CUSTOM_EVENT));
    }
    return newConstraintValidityState.valid;
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
      const { message, status, closeOnClickOutside } = failedConstraintInfo;
      validationInterface.validationMessage.update(message, {
        status,
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
        status: failedConstraintInfo.status,
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
        for (const [, { message, status }] of customMessageMap) {
          return { message, status };
        }
        return null;
      },
    });
    const addCustomMessage = (
      key,
      message,
      { status = "info", removeOnRequestAction = false } = {},
    ) => {
      customMessageMap.set(key, { message, status, removeOnRequestAction });
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
      const elementWithAction = closestElementWithAction(element);
      if (!elementWithAction) {
        return;
      }

      const determineClosestFormSubmitTargetForEnterKeyEvent = () => {
        if (keydownEvent.defaultPrevented) {
          return null;
        }
        const keydownTarget = keydownEvent.target;
        const { form } = keydownTarget;
        if (!form) {
          return null;
        }
        if (keydownTarget.tagName === "BUTTON") {
          if (
            keydownTarget.type !== "submit" &&
            keydownTarget.type !== "image"
          ) {
            return null;
          }
          return keydownTarget;
        }
        if (keydownTarget.tagName === "INPUT") {
          if (
            ![
              "text",
              "email",
              "password",
              "search",
              "number",
              "url",
              "tel",
            ].includes(keydownTarget.type)
          ) {
            return null;
          }
          // when present, we use first button submitting the form as the requester
          // not the input, it aligns with browser behavior where
          // hitting Enter in a text input triggers the first submit button of the form, not the input itself
          return getFirstButtonSubmittingForm(keydownTarget) || keydownTarget;
        }
        return null;
      };
      const formSubmitTarget =
        determineClosestFormSubmitTargetForEnterKeyEvent();
      if (formSubmitTarget) {
        keydownEvent.preventDefault();
      }
      dispatchActionRequestedCustomEvent(elementWithAction, {
        event: keydownEvent,
        requester: formSubmitTarget || element,
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
      const button = element;
      const elementWithAction = closestElementWithAction(button);
      if (!elementWithAction) {
        return;
      }
      const determineClosestFormSubmitTargetForClickEvent = () => {
        if (clickEvent.defaultPrevented) {
          return null;
        }
        const clickTarget = clickEvent.target;
        const { form } = clickTarget;
        if (!form) {
          return null;
        }
        const wouldSubmitFormByType =
          button.type === "submit" || button.type === "image";
        if (wouldSubmitFormByType) {
          return button;
        }
        if (button.type) {
          // "reset", "button" or any other non submit type, it won't submit the form
          return null;
        }
        const firstButtonSubmittingForm = getFirstButtonSubmittingForm(form);
        if (button !== firstButtonSubmittingForm) {
          // an other button is explicitly submitting the form, this one would not submit it
          return null;
        }
        // this is the only button inside the form without type attribute, so it defaults to type="submit"
        return button;
      };
      const formSubmitTarget = determineClosestFormSubmitTargetForClickEvent();
      if (formSubmitTarget) {
        clickEvent.preventDefault();
      }
      dispatchActionRequestedCustomEvent(elementWithAction, {
        event: clickEvent,
        requester: formSubmitTarget || button,
      });
    };
    element.addEventListener("click", onclick);
    addTeardown(() => {
      element.removeEventListener("click", onclick);
    });
  }

  request_on_input_value_change: {
    const isInput =
      element.tagName === "INPUT" || element.tagName === "TEXTAREA";
    if (!isInput) {
      break request_on_input_value_change;
    }
    const stop = listenInputValue(
      element,
      (e) => {
        const elementWithAction = closestElementWithAction(element);
        if (!elementWithAction) {
          return;
        }
        dispatchActionRequestedCustomEvent(elementWithAction, {
          event: e,
          requester: element,
        });
      },
      {
        waitForChange: !element.hasAttribute("data-live-action"),
      },
    );
    addTeardown(() => {
      stop();
    });
  }

  request_on_checkbox_change: {
    const isCheckbox =
      element.tagName === "INPUT" && element.type === "checkbox";
    if (!isCheckbox) {
      break request_on_checkbox_change;
    }
    const onchange = (e) => {
      if (element.parentNode.hasAttribute("data-action")) {
        dispatchActionRequestedCustomEvent(element, {
          event: e,
          requester: element,
        });
        return;
      }
    };
    element.addEventListener("change", onchange);
    addTeardown(() => {
      element.removeEventListener("change", onchange);
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

// When interacting with an element we want to find the closest element
// eventually handling the action
// 1. <button> itself has an action
// 2. <button> is inside a <form> with an action
// 3. <button> is inside a wrapper <div> with an action (data-action is not necessarly on the interactive element itself, it can be on a wrapper, we want to support that)
// 4. <button> is inside a <fieldset> or any element that catches the action like a <form> would
// In examples above <button> can also be <input> etc..
const closestElementWithAction = (el) => {
  if (el.hasAttribute("data-action")) {
    return el;
  }
  const closestDataActionElement = el.closest("[data-action]");
  if (!closestDataActionElement) {
    return null;
  }
  const visualSelector = closestDataActionElement.getAttribute(
    "data-visual-selector",
  );
  if (!visualSelector) {
    return closestDataActionElement;
  }
  const visualElement = closestDataActionElement.querySelector(visualSelector);
  return visualElement;
};

const pickConstraint = (a, b) => {
  const aPrio = getConstraintPriority(a);
  const bPrio = getConstraintPriority(b);
  if (aPrio > bPrio) {
    return a;
  }
  return b;
};
const getConstraintPriority = (constraint) => {
  if (constraint.name === "required") {
    return 100;
  }
  if (STANDARD_CONSTRAINT_SET.has(constraint)) {
    return 10;
  }
  return 1;
};

const getFirstButtonSubmittingForm = (form) => {
  return form.querySelector(
    `button[type="submit"], input[type="submit"], input[type="image"]`,
  );
};

const dispatchActionRequestedCustomEvent = (
  elementWithAction,
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
  elementWithAction.dispatchEvent(actionRequestedCustomEvent);
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

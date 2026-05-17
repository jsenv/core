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

import {
  createPubSub,
  dispatchInternalCustomEvent,
  dispatchPublicCustomEvent,
  getElementSignature,
} from "@jsenv/dom";

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { openCallout } from "./callout/callout.js";
import { getConstraintMessage } from "./constraint_message.js";
import {
  MIN_DIGIT_CONSTRAINT,
  MIN_LOWER_LETTER_CONSTRAINT,
  MIN_SPECIAL_CHAR_CONSTRAINT,
  MIN_UPPER_LETTER_CONSTRAINT,
} from "./constraints/min_char_constraint.js";
import { ONE_OF_CONSTRAINT } from "./constraints/one_of_constraint.js";
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

export const NAVI_VALIDITY_CHANGE_CUSTOM_EVENT = "navi_validity_change";

export const dispatchRequestInteraction = (element, event) => {
  const allowed = dispatchInternalCustomEvent(
    element,
    "navi_request_interaction",
    {
      event,
    },
  );
  return allowed;
};
export const onRequestInteraction = (
  requestInteractionCustomEvent,
  { debugInteraction },
) => {
  const requestStatus = { canProceed: true, preventReason: undefined };

  const { event } = requestInteractionCustomEvent.detail;
  if (requestStatus.canProceed) {
    checkEvent(requestStatus, event);
  }
  if (requestStatus.canProceed) {
    checkAndReportConstraints(requestStatus, INTERACTION_CONSTRAINTS, {
      event: requestInteractionCustomEvent,
      requester: event.currentTarget,
      debug: debugInteraction,
    });
  }
  if (!requestStatus.canProceed) {
    requestInteractionCustomEvent.preventDefault();
  }
};

export const dispatchRequestAction = (
  elementWithAction,
  {
    event,
    requester = elementWithAction,
    // for keyboard shortcuts
    // (ideally a some point we'll just make them use a different event/code path)
    actionOrigin = "action_prop",
    action,
    confirmMessage,
    meta,
  },
) => {
  const allowed = dispatchInternalCustomEvent(
    elementWithAction,
    "navi_request_action",
    {
      event,
      requester,
      actionOrigin,
      action,
      confirmMessage,
      meta,
    },
  );
  return allowed;
};
export const onRequestAction = (
  requestActionCustomEvent,
  {
    method = "rerun", // not used for now
    debugAction = () => {},
  } = {},
) => {
  const {
    event,
    actionOrigin,
    action,
    requester = event.target,
    uiState,
    meta = {},
    confirmMessage,
  } = requestActionCustomEvent.detail;

  if (!action || !action.isAction) {
    throw new TypeError("First argument of onRequestAction must be an action");
  }
  if (!actionOrigin) {
    console.warn("requestAction: actionOrigin is required");
  }
  const elementHandlingAction = requestActionCustomEvent.currentTarget;
  if (requester === elementHandlingAction) {
    debugAction(
      requestActionCustomEvent,
      `${getElementSignature(elementHandlingAction)} action requested`,
    );
  } else {
    debugAction(
      requestActionCustomEvent,
      `${getElementSignature(elementHandlingAction)} action requested by ${getElementSignature(requester)}`,
    );
  }

  const requestStatus = { canProceed: true, preventReason: undefined };
  if (requestStatus.canProceed) {
    checkEvent(requestStatus, event);
  }
  if (requestStatus.canProceed) {
    checkAndReportConstraints(requestStatus, DEFAULT_CONSTRAINT_SET, {
      event: requestActionCustomEvent,
      requester,
      debug: debugAction,
      fromRequestAction: true,
    });
  }
  if (requestStatus.canProceed) {
    // NOTE for future: confirmation must move to to action execution (be part of it when set)
    // because it's actually once everything is valid that we perform this so it's conceptually part of the action execution
    // also because in order to allow people to put their own ui it will becomes async
    // so must be inside action execution code path
    const effectiveConfirmMessage =
      confirmMessage ||
      elementHandlingAction.getAttribute("data-confirm-message");
    if (effectiveConfirmMessage) {
      // eslint-disable-next-line no-alert
      if (!window.confirm(effectiveConfirmMessage)) {
        Object.assign(requestStatus, {
          canProceed: false,
          preventReason: "user cancelled on confirm message",
        });
      }
    }
  }

  const customEventDetail = {
    event,
    requester,
    uiState,
    actionOrigin,
    action,
    method,
    meta,
  };
  if (!requestStatus.canProceed) {
    requestActionCustomEvent.preventDefault();
    debugAction(
      requestActionCustomEvent,
      `action prevented due ${requestStatus.preventReason} -> dispatch navi_action_prevented`,
    );
    dispatchInternalCustomEvent(
      elementHandlingAction,
      "navi_action_prevented",
      customEventDetail,
    );
    return false;
  }
  debugAction(
    requestActionCustomEvent,
    `${DEFAULT_CONSTRAINT_SET.size} constraints verified -> ${getElementSignature(elementHandlingAction)}.dispatchEvent("navi_action_ready")`,
  );
  dispatchInternalCustomEvent(
    elementHandlingAction,
    "navi_action_ready",
    customEventDetail,
  );
  return true;
};

const checkEvent = (requestStatus, event) => {
  if (event.defaultPrevented) {
    Object.assign(requestStatus, {
      canProceed: false,
      preventReason: "event.defaultPrevented is true",
    });
    return;
  }
  if (pointerEventTypeSet.has(event) && event.button !== 0) {
    Object.assign(requestStatus, {
      canProceed: false,
      preventReason: `non-primary pointer button (button ${event.button})`,
    });
    return;
  }
};
const checkAndReportConstraints = (
  requestStatus,
  constraints,
  { event, requester, debug, fromRequestAction } = {},
) => {
  const onInvalid = (failedValidationInterface) => {
    Object.assign(requestStatus, {
      canProceed: false,
      preventReason: `failing constraint "${failedValidationInterface.failedConstraintInfo.name}"`,
    });
    failedValidationInterface.reportValidity({
      event,
      requester,
      debug,
    });
  };

  let elementToValidate = event.currentTarget;
  if (!elementToValidate.__validationInterface__) {
    const fieldElement = findFieldElement(requester);
    if (fieldElement) {
      elementToValidate = fieldElement;
    }
  }
  const managedFields = getManagedFields(elementToValidate);
  for (const managedField of managedFields) {
    const elementValidationInterface = managedField.__validationInterface__;
    if (!elementValidationInterface) {
      continue;
    }
    const elementIsValid = elementValidationInterface.checkValidity({
      event,
      debug,
      fromRequestAction,
      skipReadonly:
        managedField.tagName === "BUTTON" && managedField !== requester,
    });
    if (!elementIsValid) {
      onInvalid(elementValidationInterface);
      return;
    }
  }

  // all manageds fields (if any) are good ->  check ourselves
  let validationInterface = elementToValidate.__validationInterface__;
  if (!validationInterface) {
    validationInterface = installCustomConstraintValidation(elementToValidate);
  }
  const isValid = validationInterface.checkValidity({
    event,
    constraints,
    fromRequestAction,
  });
  if (!isValid) {
    onInvalid(validationInterface);
    return;
  }
};

const INTERACTION_CONSTRAINTS = [DISABLED_CONSTRAINT, READONLY_CONSTRAINT];
const pointerEventTypeSet = new Set(["pointerdown", "mousedown", "click"]);

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
  ONE_OF_CONSTRAINT,
  READONLY_CONSTRAINT,
]);
const DEFAULT_CONSTRAINT_SET = new Set([
  ...STANDARD_CONSTRAINT_SET,
  ...NAVI_CONSTRAINT_SET,
]);

const getManagedFields = (element) => {
  let managedFields;
  dispatchInternalCustomEvent(element, "navi_get_managed_fields", {
    respondWith: (fieldOrFields) => {
      if (Array.isArray(fieldOrFields)) {
        managedFields = fieldOrFields;
      } else if (fieldOrFields) {
        managedFields = [fieldOrFields];
      }
    },
  });
  return managedFields || [];
};

export const closeValidationMessage = (
  element,
  event = new CustomEvent("programmatic_call"),
  reason,
) => {
  const validationInterface = element.__validationInterface__;
  if (!validationInterface) {
    return false;
  }
  const { validationMessage } = validationInterface;
  if (!validationMessage) {
    return false;
  }
  return validationMessage.requestClose(event, reason);
};

export const checkValidity = (element, options) => {
  const validationInterface = element.__validationInterface__;
  if (!validationInterface) {
    return false;
  }
  return validationInterface.checkValidity(options);
};

const formInstrumentedWeakSet = new WeakSet();
export const installCustomConstraintValidation = (
  element,
  elementReceivingValidationMessage = element,
) => {
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

  const dispatchCancelCustomEvent = (detail) => {
    return dispatchInternalCustomEvent(element, "navi_cancel", detail);
  };
  const closeElementValidationMessage = (event, reason) => {
    if (validationInterface.validationMessage) {
      validationInterface.validationMessage.requestClose(event, reason);
      return true;
    }
    return false;
  };

  const dynamicConstraintSet = new Set();

  register_constraint: {
    validationInterface.registerConstraint = (constraint) => {
      if (typeof constraint === "function") {
        constraint = {
          name: constraint.name || "custom_function",
          check: constraint,
        };
      }
      dynamicConstraintSet.add(constraint);
      return () => {
        dynamicConstraintSet.delete(constraint);
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
    if (fromRequestAction) {
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

  const checkValidity = ({
    constraints,
    event,
    fromRequestAction,
    skipReadonly,
  } = {}) => {
    let newConstraintValidityState = { valid: true };
    // When constraints are explicitly provided (e.g. pointer interaction), use only those.
    // Otherwise use default set merged with dynamic constraints.
    const effectiveConstraints = constraints
      ? constraints
      : new Set([...DEFAULT_CONSTRAINT_SET, ...dynamicConstraintSet]);
    resetValidity({ fromRequestAction });
    for (const constraint of effectiveConstraints) {
      const fieldForConstraint = element;
      const constraintCleanupSet = new Set();
      const registerChange = (register) => {
        const registerResult = register((options) => {
          checkValidity(options);
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

      const checkResult = constraint.check(fieldForConstraint, {
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
      closeElementValidationMessage(
        event || new CustomEvent("checkValidity called with no event"),
        "becomes_valid",
      );
    }

    if (
      !compareTwoJsValues(constraintValidityState, newConstraintValidityState)
    ) {
      constraintValidityState = newConstraintValidityState;
      dispatchPublicCustomEvent(element, NAVI_VALIDITY_CHANGE_CUSTOM_EVENT);
    }
    return newConstraintValidityState.valid;
  };

  const [notifyCalloutOpen, onCalloutOpen] = createPubSub();
  const reportValidity = ({ event, requester, debug, skipFocus } = {}) => {
    if (!failedConstraintInfo) {
      closeElementValidationMessage(event, "becomes_valid");
      return;
    }
    if (failedConstraintInfo.silent) {
      closeElementValidationMessage(event, "invalid_silent");
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
      closeElementValidationMessage(new CustomEvent("cleanup"), "cleanup");
    });

    const anchorElement = (() => {
      const base =
        failedConstraintInfo.target || elementReceivingValidationMessage;
      const renderedBy = base.getAttribute("data-rendered-by");
      if (renderedBy) {
        const renderedByElement = base.closest(renderedBy);
        if (renderedByElement) {
          return renderedByElement;
        }
      }
      if (base.tagName === "INPUT" && base.type === "hidden") {
        return base.form || document.body;
      }
      return base;
    })();

    let messageOrCustomMessage;
    if (failedConstraintInfo.constraint.messageAttribute) {
      const { message, origin } = getConstraintMessage(
        element,
        failedConstraintInfo.constraint,
        failedConstraintInfo.message,
        { requester },
      );
      if (debug) {
        debug(
          event,
          `constraint message for "${failedConstraintInfo.constraint.name}": ${origin}`,
        );
      }
      messageOrCustomMessage = message;
    } else {
      messageOrCustomMessage = failedConstraintInfo.message;
    }
    validationInterface.validationMessage = openCallout(
      messageOrCustomMessage,
      {
        anchorElement,
        status: failedConstraintInfo.status,
        closeOnClickOutside: failedConstraintInfo.closeOnClickOutside,
        openingEvent: event,
        debug,
        onClose: () => {
          removeCloseOnCleanup();
          for (const result of results) {
            if (typeof result === "function") {
              result();
            }
          }
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
    const results = notifyCalloutOpen(event);
    failedConstraintInfo.reportStatus = "reported";
  };
  validationInterface.checkValidity = checkValidity;
  validationInterface.reportValidity = reportValidity;
  Object.defineProperty(validationInterface, "failedConstraintInfo", {
    get: () => failedConstraintInfo,
  });

  const customMessageMap = new Map();
  custom_message: {
    dynamicConstraintSet.add({
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

  const resetOnInteraction = (e) => {
    customMessageMap.clear();
    closeElementValidationMessage(e, e.type);
    checkValidity({ event: e });
  };

  close_and_check_on_input: {
    const oninput = (e) => {
      resetOnInteraction(e);
    };
    element.addEventListener("input", oninput);
    addTeardown(() => {
      element.removeEventListener("input", oninput);
    });
  }

  close_callout_on_mousedown: {
    // When the user clicks the field (or the interactive element rendered in place of it,
    // e.g. the .navi_select button for a hidden input), treat it as intent to fix the issue
    // and dismiss the callout — unless the status is "error", which requires explicit action.
    // The listener is registered when the callout opens and removed when it closes,
    // so it can never accidentally close the next callout.
    const interactionTarget = (() => {
      const renderedBy = element.getAttribute("data-rendered-by");
      if (renderedBy) {
        return element.closest(renderedBy) || element;
      }
      return element;
    })();
    onCalloutOpen((openingEvent) => {
      const onmousedown = (e) => {
        if (e.button !== 0) {
          return;
        }
        if (e === openingEvent) {
          // The callout was opened during this same mousedown — don't close it immediately.
          return;
        }
        if (failedConstraintInfo && failedConstraintInfo.status === "error") {
          return;
        }
        resetOnInteraction(e);
      };

      const id = element.id;
      let removeLabelListener;
      if (id) {
        const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
        if (label) {
          label.addEventListener("mousedown", onmousedown);
          removeLabelListener = () => {
            label.removeEventListener("mousedown", onmousedown);
          };
        }
      }

      interactionTarget.addEventListener("mousedown", onmousedown);
      return () => {
        interactionTarget.removeEventListener("mousedown", onmousedown);
        removeLabelListener?.();
      };
    });
  }

  check_on_navi_action_end: {
    // this ensure we re-check validity (and remove message no longer relevant)
    // once the action ends (used to remove the NOT_BUSY_CONSTRAINT message)
    const onNaviActionEnd = (e) => {
      checkValidity({ event: e });
    };
    element.addEventListener("navi_action_end", onNaviActionEnd);
    addTeardown(() => {
      element.removeEventListener("navi_action_end", onNaviActionEnd);
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

  close_on_escape: {
    const onkeydown = (e) => {
      if (e.key === "Escape") {
        if (closeElementValidationMessage(e, "escape_key")) {
          // closing the callout should prevent anything else from hapenning
          e.stopPropagation();
          e.preventDefault();
        } else {
          dispatchCancelCustomEvent({
            reason: "escape_key",
          });
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
          reason: "blur_empty",
        });
        return;
      }
      // if we have failed constraint, we cancel too
      if (failedConstraintInfo) {
        dispatchCancelCustomEvent({
          reason: "blur_invalid",
          failedConstraintInfo,
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
  dispatchRequestAction(form, {
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

// When the requester is not a validated element itself (e.g. a <li> inside a
// list container), look for a field element declared via data-field on the
// closest [data-action] ancestor.
const findFieldElement = (element) => {
  const elementWithAction = element.closest("[data-action]");
  if (!elementWithAction) {
    return null;
  }
  const fieldSelector = elementWithAction.getAttribute("data-field");
  if (!fieldSelector) {
    return null;
  }
  return (
    elementWithAction.querySelector(fieldSelector) ||
    document.querySelector(fieldSelector)
  );
};

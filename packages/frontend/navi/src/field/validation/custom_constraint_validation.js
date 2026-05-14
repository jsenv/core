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
  dispatchCustomEvent,
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
import { listenInputValue } from "./input_value_listener.js";

export const NAVI_VALIDITY_CHANGE_CUSTOM_EVENT = "navi_validity_change";
const POINTER_INTERACTION_CONSTRAINTS = [
  DISABLED_CONSTRAINT,
  READONLY_CONSTRAINT,
];

export const onRequestPointerInteraction = (pointerEvent) => {
  if (pointerEvent.button !== 0) {
    return false;
  }
  if (pointerEvent.defaultPrevented) {
    return false;
  }
  const requester = pointerEvent.currentTarget || pointerEvent.target;
  const isValid = checkConstraintsAndReport(POINTER_INTERACTION_CONSTRAINTS, {
    event: pointerEvent,
    requester,
  });
  if (!isValid) {
    dispatchCustomEvent(requester, "navi_pointer_interaction_prevented", {
      event: pointerEvent,
      requester,
    });
    return false;
  }
  return true;
};

export const onRequestAction = (
  action,
  event,
  {
    target = event.currentTarget,
    requester = event.detail
      ? event.detail.requester || event.target
      : event.target,
    actionOrigin = event.detail?.actionOrigin,
    method = "rerun",
    meta = event.detail?.meta || {},
    confirmMessage,
    debugAction = () => {},
  } = {},
) => {
  if (!action || !action.isAction) {
    throw new TypeError("First argument of onRequestAction must be an action");
  }
  if (!event || !(event instanceof Event)) {
    throw new TypeError("Second argument of onRequestAction must be an Event");
  }
  if (!actionOrigin) {
    console.warn("requestAction: actionOrigin is required");
  }
  const customEventDetail = {
    action,
    actionOrigin,
    method,
    event,
    requester,
    meta,
  };
  const initiatorTarget = event.detail?.event?.target;
  const requesterInfo =
    requester && requester !== initiatorTarget
      ? ` requester=${getElementSignature(requester)}`
      : "";
  debugAction(
    event,
    `action requested by ${requesterInfo} (event: "${event?.type}")`,
  );
  const isValid = checkConstraintsAndReport(DEFAULT_CONSTRAINT_SET, {
    requester,
    event,
    debugAction,
  });
  if (!isValid) {
    dispatchCustomEvent(target, "navi_action_prevented", customEventDetail);
    return false;
  }
  const elementForConfirmation = requester.form || target;
  confirmMessage =
    confirmMessage ||
    elementForConfirmation.getAttribute("data-confirm-message");
  if (confirmMessage) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(confirmMessage)) {
      debugAction(
        event,
        `action cancelled by user -> dispatch navi_action_prevented`,
      );
      dispatchCustomEvent(target, "navi_action_prevented", customEventDetail);
      return false;
    }
  }
  debugAction(event, `element is valid -> dispatch navi_action_ready`);
  dispatchCustomEvent(target, "navi_action_ready", customEventDetail);
  return true;
};
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

const validationInProgressWeakSet = new WeakSet();
const checkConstraintsAndReport = (
  constraints,
  { event, requester, debugAction = () => {} } = {},
) => {
  let elementToValidate = requester;
  if (!elementToValidate.__validationInterface__) {
    const fieldElement = findFieldElement(requester);
    if (fieldElement) {
      elementToValidate = fieldElement;
    }
  }
  let validationInterface = elementToValidate.__validationInterface__;
  if (!validationInterface) {
    validationInterface = installCustomConstraintValidation(elementToValidate);
  }

  // Full validation
  const isForm = elementToValidate.tagName === "FORM";
  const formToValidate = isForm ? elementToValidate : elementToValidate.form;
  let isValid = true;
  let failedValidationInterface;

  if (formToValidate) {
    if (validationInProgressWeakSet.has(formToValidate)) {
      debugAction(
        event,
        `validation already in progress for ${formToValidate?.id || formToValidate?.tagName}`,
      );
      return false;
    }
    validationInProgressWeakSet.add(formToValidate);
    setTimeout(() => {
      validationInProgressWeakSet.delete(formToValidate);
    });
    for (const formElement of formToValidate.elements) {
      const elementValidationInterface = formElement.__validationInterface__;
      if (!elementValidationInterface) {
        continue;
      }
      const elementIsValid = elementValidationInterface.checkValidity({
        constraints,
        event,
        fromRequestAction: true,
        skipReadonly:
          formElement.tagName === "BUTTON" && formElement !== requester,
        debugAction,
      });
      if (!elementIsValid) {
        failedValidationInterface = elementValidationInterface;
        isValid = false;
        break;
      }
    }
  } else {
    isValid = validationInterface.checkValidity({
      constraints,
      event,
      fromRequestAction: true,
      debugAction,
    });
    if (!isValid) {
      failedValidationInterface = validationInterface;
    }
  }

  if (!isValid) {
    debugAction(
      event,
      `validation failed for "${getFailedConstraintName(failedValidationInterface)}"`,
    );
    failedValidationInterface.reportValidity({ event, debugAction, requester });
    return false;
  }
  return true;
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
  const isInput = element.tagName === "INPUT" || element.tagName === "TEXTAREA";
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
    return dispatchCustomEvent(element, "navi_cancel", detail);
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

  const checkValidity = ({
    constraints,
    event,
    fromRequestAction,
    skipReadonly,
  } = {}) => {
    let newConstraintValidityState = { valid: true };
    if (fromRequestAction) {
      constraints = new Set([...constraints, ...dynamicConstraintSet]);
    }
    resetValidity({ fromRequestAction });
    for (const constraint of constraints) {
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

  const [notifyCalloutOpen, onCalloutOpen] = createPubSub(true);
  const reportValidity = ({
    skipFocus,
    event,
    debugAction,
    requester,
  } = {}) => {
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
      if (debugAction) {
        debugAction(
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
        debug: debugAction,
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
      interactionTarget.addEventListener("mousedown", onmousedown);
      return () => {
        interactionTarget.removeEventListener("mousedown", onmousedown);
      };
    });
  }

  check_on_hidden_input_value: {
    // Hidden inputs (used by Select, List) don't fire "input" or "change" events
    // when their value is set programmatically. We intercept the value setter to
    // detect those changes and re-run validation.
    if (element.type !== "hidden") {
      break check_on_hidden_input_value;
    }
    const nativeDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    Object.defineProperty(element, "value", {
      get() {
        return nativeDescriptor.get.call(this);
      },
      set(newValue) {
        nativeDescriptor.set.call(this, newValue);
        resetOnInteraction(new CustomEvent("programmatic_value_change"));
      },
      configurable: true,
    });
    addTeardown(() => {
      delete element.value;
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

  request_on_enter: {
    const isNaviSelect =
      element.tagName === "BUTTON" && element.classList.contains("navi_select");
    if (element.tagName !== "INPUT" && !isNaviSelect) {
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
            // navi_select acts like a native <select>: Enter on the closed select
            // triggers form submission rather than toggling the popover.
            if (isNaviSelect) {
              return getFirstButtonSubmittingForm(form) || keydownTarget;
            }
            return null;
          }
          return keydownTarget;
        }
        if (keydownTarget.tagName === "INPUT") {
          const keyboardInteractiveInputTypeSet = new Set([
            "text",
            "email",
            "password",
            "search",
            "number",
            "url",
            "tel",
            // maybe date too (we can type a date inside a input date right?)
          ]);
          if (keyboardInteractiveInputTypeSet.has(keydownTarget.type)) {
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
        // preventDefault on keydown prevents the browser from firing a synthetic
        // click on the button, so request_on_button_click won't double-fire.
        keydownEvent.preventDefault();
      }
      dispatchRequestAction(elementWithAction, {
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
        const { form } = element;
        if (!form) {
          // reset button are not associated to the from
          // so they early return here
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
      if (!formSubmitTarget && elementWithAction !== button) {
        // button has no form submit effect and no own action
        return;
      }
      if (button.type === "reset") {
        // reset button got their own behavior (I suppose this is now catched by previous if)
        return;
      }
      if (formSubmitTarget) {
        // prevent from submission
        clickEvent.preventDefault();
      }

      // dispatch only if the button
      dispatchRequestAction(elementWithAction, {
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
    if (!isInput) {
      break request_on_input_value_change;
    }
    const elementWithAction = closestElementWithAction(element);
    if (!elementWithAction) {
      break request_on_input_value_change;
    }
    const closestElementWithActionAttr = element.closest("[data-action]");
    if (closestElementWithActionAttr.tagName === "FORM") {
      break request_on_input_value_change;
    }
    const stop = listenInputValue(
      element,
      (e) => {
        dispatchRequestAction(elementWithAction, {
          event: e,
          requester: element,
        });
      },
      {
        waitForChange: closestElementWithActionAttr.hasAttribute(
          "data-action-after-change",
        ),
        debounce: closestElementWithActionAttr.hasAttribute(
          "data-action-debounce",
        )
          ? parseFloat(
              closestElementWithActionAttr.getAttribute("data-action-debounce"),
            )
          : undefined,
      },
    );
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
    if (!form.hasAttribute("data-action")) {
      form.setAttribute("data-action", "toto");
    }
    form.setAttribute("novalidate", ""); // make sure browser don't prevent "submit" when invalid, nor display messages
    const removeListener = addEventListener(form, "submit", (e) => {
      e.preventDefault();
      dispatchCustomEvent(form, "navi_action", {
        action: null,
        event: e,
        method: "rerun",
        requester: form,
        meta: {
          isSubmit: true,
        },
      });
    });
    addTeardown(() => {
      removeListener();
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

export const dispatchRequestAction = (
  elementWithAction,
  { actionOrigin = "action_prop", event, requester },
) => {
  return dispatchCustomEvent(elementWithAction, "navi_request_action", {
    actionOrigin,
    event,
    requester,
  });
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

const addEventListener = (element, event, callback) => {
  element.addEventListener(event, callback);
  return () => {
    element.removeEventListener(event, callback);
  };
};

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

const getFailedConstraintName = (validationInterface) => {
  const state = validationInterface.getConstraintValidityState?.();
  if (!state) {
    return "unknown";
  }
  for (const key of Object.keys(state)) {
    if (key !== "valid" && state[key]) {
      return key;
    }
  }
  return "unknown";
};

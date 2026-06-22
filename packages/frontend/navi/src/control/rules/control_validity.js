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
 * To enable this API one have to call createControlValidity(controller)
 * on the <form> and every element within the <form> (<input>, <button>, etc.)
 * (In practice this is done automatically by jsx components in navi package)
 *
 * Once installed, interactions dispatch a "navi_request_interaction" event which
 * runs all constraints before deciding whether to allow or prevent the action.
 *
 * There is one way to fully bypass validation which is to call form.submit()
 * just like you could do with the native validation API to bypass validation.
 * We keep this behavior on purpose but in practice you always want to go through the form validation process
 */

import {
  createPubSub,
  dispatchPublicCustomEvent,
  findFocusDelegateTarget,
  getElementSignature,
} from "@jsenv/dom";

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { findControlHost } from "../control_dom.js";
import { findControlProxyTargetController } from "../controller_registry.js";
import { openCallout } from "./callout/callout.js";
import { getConstraintMessage } from "./constraint_message.js";
import { BUSY_CONSTRAINT } from "./interaction/busy_constraint.js";
import { DISABLED_CONSTRAINT } from "./interaction/disabled_constraint.js";
import { READONLY_CONSTRAINT } from "./interaction/readonly_constraint.js";
import {
  MIN_DIGIT_CONSTRAINT,
  MIN_LOWER_LETTER_CONSTRAINT,
  MIN_SPECIAL_CHAR_CONSTRAINT,
  MIN_UPPER_LETTER_CONSTRAINT,
} from "./validation/min_char_constraint.js";
import { ONE_OF_CONSTRAINT } from "./validation/one_of_constraint.js";
import { SAME_AS_CONSTRAINT } from "./validation/same_as_constraint.js";
import { SINGLE_SPACE_CONSTRAINT } from "./validation/single_space_constraint.js";
import {
  MAX_CONSTRAINT,
  MAX_LENGTH_CONSTRAINT,
  MIN_CONSTRAINT,
  MIN_LENGTH_CONSTRAINT,
  PATTERN_CONSTRAINT,
  REQUIRED_CONSTRAINT,
  STEP_CONSTRAINT,
  TYPE_EMAIL_CONSTRAINT,
  TYPE_NUMBER_CONSTRAINT,
} from "./validation/standard_constraints.js";

export const NAVI_VALIDITY_CHANGE_CUSTOM_EVENT = "navi_validity_change";

export const getControlValidityFromElement = (element) => {
  const controlHost = findControlHost(element);
  const elementToCheck = controlHost || element;
  return elementToCheck.__uiStateController__?.controlValidity;
};

const INTERACTION_CONSTRAINT_SET = new Set([
  DISABLED_CONSTRAINT,
  BUSY_CONSTRAINT,
  READONLY_CONSTRAINT,
]);

const STANDARD_CONSTRAINT_SET = new Set([
  REQUIRED_CONSTRAINT,
  PATTERN_CONSTRAINT,
  TYPE_EMAIL_CONSTRAINT,
  TYPE_NUMBER_CONSTRAINT,
  MIN_LENGTH_CONSTRAINT,
  MAX_LENGTH_CONSTRAINT,
  MIN_CONSTRAINT,
  MAX_CONSTRAINT,
  STEP_CONSTRAINT,
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
]);
const DEFAULT_CONSTRAINT_SET = new Set([
  ...STANDARD_CONSTRAINT_SET,
  ...NAVI_CONSTRAINT_SET,
]);
export const registerGlobalConstraint = (customConstraint) => {
  NAVI_CONSTRAINT_SET.add(customConstraint);
  DEFAULT_CONSTRAINT_SET.add(customConstraint);
};

export const createControlValidity = (
  controller,
  { debugUIState, debugFocus },
) => {
  const controlValidity = {
    uninstall: undefined,
    registerConstraint: undefined,
    checkValidity: undefined,
    reportValidity: undefined,
    callout: null,
  };

  const [teardown, addTeardown] = createPubSub();
  cleanup: {
    const uninstall = () => {
      teardown();
    };
    controlValidity.uninstall = uninstall;
  }

  const innerRequestCloseCallout = (event, reason) => {
    const { callout } = controlValidity;
    if (!callout) {
      return false;
    }
    return callout.requestClose(event, reason);
  };

  const dynamicConstraintSet = new Set();
  register_constraint: {
    controlValidity.registerConstraint = (constraint) => {
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
  let interactionFailedConstraintInfo = null;
  let failingManagedControlValidity = null;
  const validityInfoMap = new Map();
  let constraintValidityState = { valid: true };
  const getConstraintValidityState = () => constraintValidityState;
  controlValidity.getConstraintValidityState = getConstraintValidityState;

  const checkValidity = ({
    event,
    requester = controller.elementRef.current,
    fromRequestAction,
  } = {}) => {
    if (fromRequestAction) {
      for (const [, validityInfo] of validityInfoMap) {
        if (validityInfo.constraint.autoResetOnAction) {
          validityInfo.constraint.onAutoResetOnAction(controller);
        }
      }
    }

    // Never validate a proxy — always delegate to the underlying element
    const proxyTargetController = findControlProxyTargetController(controller);
    if (proxyTargetController) {
      return proxyTargetController.controlValidity.checkValidity({
        event,
        fromRequestAction,
        requester,
      });
    }

    // Always check managed fields first. If any fails, stop immediately and
    // expose the failing controlValidity so the caller can reportValidity on the right element.
    failingManagedControlValidity = null;
    const managedControllers = controller.getManagedControls();
    for (const managedController of managedControllers) {
      const managedCV = managedController.controlValidity;
      const managedIsValid = managedCV.checkValidity({
        event,
        requester,
        fromRequestAction,
      });
      if (!managedIsValid) {
        failingManagedControlValidity = managedCV;
        return false;
      }
    }

    let newConstraintValidityState = { valid: true };
    const constraintSet = new Set([
      ...DEFAULT_CONSTRAINT_SET,
      ...dynamicConstraintSet,
    ]);
    const elementSig = getElementSignature(controller.elementRef.current);
    debugUIState(
      event,
      `check ${elementSig}: ${constraintSet.size} constraints`,
    );
    validityInfoMap.clear();
    failedConstraintInfo = null;
    failingManagedControlValidity = null;
    for (const constraint of constraintSet) {
      const fieldForConstraint = controller;

      const checkResult = constraint.check(fieldForConstraint, {
        fromRequestAction,
      });
      if (!checkResult) {
        newConstraintValidityState[constraint.name] = null;
        continue;
      }
      const constraintValidityInfo =
        typeof checkResult === "string"
          ? { message: checkResult }
          : checkResult;
      constraintValidityInfo.messageString = constraintValidityInfo.message;
      debugUIState(
        `${elementSig} constraint "${constraint.name}" failed -> ${constraintValidityInfo.message}`,
      );
      const thisConstraintFailureInfo = {
        name: constraint.name,
        constraint,
        status: "warning",
        ...constraintValidityInfo,
        reportStatus: "not_reported",
      };
      validityInfoMap.set(constraint, thisConstraintFailureInfo);
      newConstraintValidityState.valid = false;
      newConstraintValidityState[constraint.name] = thisConstraintFailureInfo;
      if (failedConstraintInfo) {
        // there is already a failing value constraint, which one do we pick?
        const constraintPicked = pickConstraintFailureInfo(
          failedConstraintInfo,
          thisConstraintFailureInfo,
        );
        if (constraintPicked === thisConstraintFailureInfo) {
          failedConstraintInfo = thisConstraintFailureInfo;
        } else {
          // keep the current failedConstraintInfo, this one fails but it's considered secondary
        }
      } else {
        // first failing value constraint
        failedConstraintInfo = thisConstraintFailureInfo;
      }
    }

    const activeFailedConstraintInfo = failedConstraintInfo;
    if (activeFailedConstraintInfo) {
      const titleLess = controller.controlHostProps.title === undefined;
      if (titleLess) {
        const element = controller.elementRef.current;
        if (element) {
          element.setAttribute(
            "title",
            activeFailedConstraintInfo.messageString,
          );
        }
      }
    } else {
      const titleLess = controller.controlHostProps.title === undefined;
      if (titleLess) {
        const element = controller.elementRef.current;
        if (element) {
          element.removeAttribute("title");
        }
      }
      const checkValidityCallEvent =
        event || new CustomEvent("checkValidity called with no event");
      innerRequestCloseCallout(
        checkValidityCallEvent,
        `now_valid (after ${checkValidityCallEvent.type})`,
      );
    }

    if (
      !compareTwoJsValues(constraintValidityState, newConstraintValidityState)
    ) {
      constraintValidityState = newConstraintValidityState;
      const element = controller.elementRef.current;
      if (element) {
        debugUIState(
          event,
          `${elementSig} constraint validity changed -> dispatch ${NAVI_VALIDITY_CHANGE_CUSTOM_EVENT}`,
        );
        dispatchPublicCustomEvent(element, NAVI_VALIDITY_CHANGE_CUSTOM_EVENT);
      }
    }
    return newConstraintValidityState.valid;
  };

  const [notifyCalloutOpen, onCalloutOpen] = createPubSub();
  // Shared callout-opening logic used by both reportValidity and reportInteractivity.
  const openConstraintCallout = (
    constraintInfo,
    { event, requester, skipFocus } = {},
  ) => {
    if (!constraintInfo) {
      innerRequestCloseCallout(event, "is_valid");
      return;
    }
    const { message } = getConstraintMessage(
      controller,
      constraintInfo.constraint,
      constraintInfo.message,
      { requester },
    );
    if (controlValidity.callout) {
      controlValidity.callout.update(message, {
        status: constraintInfo.status,
      });
      return;
    }
    const anchorElement =
      constraintInfo.target || controller.elementRef.current;
    if (!skipFocus && !anchorElement.closest('[aria-hidden="true"]')) {
      const focusTarget =
        findFocusDelegateTarget(anchorElement) || anchorElement;
      debugFocus(
        event,
        `opening callout, give focus to anchor -> ${getElementSignature(focusTarget)}.focus()`,
      );
      focusTarget.focus();
    }
    const removeCloseOnCleanup = addTeardown(() => {
      innerRequestCloseCallout(new CustomEvent("cleanup"), "cleanup");
    });
    controlValidity.callout = openCallout(message, {
      anchorElement,
      status: constraintInfo.status,
      openingEvent: event,
      debug: debugUIState,
      onClose: ({ event, focusWithinCallout }) => {
        removeCloseOnCleanup();
        for (const result of results) {
          if (typeof result === "function") {
            result();
          }
        }
        controlValidity.callout = null;
        if (constraintInfo) {
          constraintInfo.reportStatus = "closed";
        }
        const element = controller.elementRef.current;
        if (
          !skipFocus &&
          focusWithinCallout &&
          element &&
          !element.closest('[aria-hidden="true"]')
        ) {
          const focusTarget =
            findFocusDelegateTarget(anchorElement) || anchorElement;
          debugFocus(
            event,
            `callout is closing with focus, give focus back to the control ${getElementSignature(focusTarget)}.focus()`,
          );
          focusTarget.focus();
        }
      },
    });
    const results = notifyCalloutOpen(event);
    constraintInfo.reportStatus = "reported";
  };

  const checkInteractivity = (event) => {
    interactionFailedConstraintInfo = null;
    failingManagedControlValidity = null;
    for (const constraint of INTERACTION_CONSTRAINT_SET) {
      const checkResult = constraint.check(controller);
      if (!checkResult) {
        continue;
      }
      const constraintInfo =
        typeof checkResult === "string"
          ? { message: checkResult }
          : checkResult;
      constraintInfo.messageString = constraintInfo.message;
      interactionFailedConstraintInfo = {
        name: constraint.name,
        constraint,
        status: "info",
        ...constraintInfo,
        reportStatus: "not_reported",
      };
      break;
    }
    // Also check managed controls for blocking interaction constraints (e.g. busy).
    if (!interactionFailedConstraintInfo) {
      const managedControllers = controller.getManagedControls();
      for (const managedController of managedControllers) {
        const managedCV = managedController.controlValidity;
        const managedCanInteract = managedCV.checkInteractivity(event);
        if (!managedCanInteract) {
          const managedFailed = managedCV.interactionFailedConstraintInfo;
          if (managedFailed && !managedFailed.ignoredByParents) {
            failingManagedControlValidity = managedCV;
            break;
          }
        }
      }
    }
    // Manage title attribute based on interaction state.
    const titleLess = controller.controlHostProps.title === undefined;
    if (titleLess) {
      const element = controller.elementRef.current;
      if (element) {
        if (interactionFailedConstraintInfo) {
          element.setAttribute(
            "title",
            interactionFailedConstraintInfo.messageString,
          );
        } else if (!failedConstraintInfo) {
          // Only remove if value validity also has no failure — checkValidity manages its own title.
          element.removeAttribute("title");
        }
      }
    }
    return !interactionFailedConstraintInfo && !failingManagedControlValidity;
  };
  controlValidity.checkInteractivity = checkInteractivity;

  const reportInteractivity = ({ event, requester, skipFocus } = {}) => {
    if (failingManagedControlValidity) {
      // Delegate to the leaf CV so the callout appears on the failing element, not the form/group.
      let leafCV = failingManagedControlValidity;
      while (leafCV.failingManagedControlValidity) {
        leafCV = leafCV.failingManagedControlValidity;
      }
      leafCV.reportInteractivity({ event, requester, skipFocus });
      return;
    }
    openConstraintCallout(interactionFailedConstraintInfo, {
      event,
      requester,
      skipFocus,
    });
  };
  controlValidity.reportInteractivity = reportInteractivity;

  const reportValidity = ({ event, requester, skipFocus } = {}) => {
    openConstraintCallout(failedConstraintInfo, {
      event,
      requester,
      skipFocus,
    });
  };
  controlValidity.checkValidity = checkValidity;
  controlValidity.reportValidity = reportValidity;
  Object.defineProperty(controlValidity, "failedConstraintInfo", {
    get: () => failedConstraintInfo,
  });
  Object.defineProperty(controlValidity, "interactionFailedConstraintInfo", {
    get: () => interactionFailedConstraintInfo,
  });
  Object.defineProperty(controlValidity, "failingManagedControlValidity", {
    get: () => failingManagedControlValidity,
  });
  controlValidity.onCalloutOpen = onCalloutOpen;
  controlValidity.closeCallout = (event, reason) => {
    innerRequestCloseCallout(event, reason);
  };

  // Centralized validity sync: decides what to show/close based on the event type
  // and the current constraint state.
  //
  // - Interaction constraints (readonly/disabled/busy) violated → always report them.
  // - Value-modifying event (input, keydown...) + own action + value invalid → report.
  // - Pure interaction event (mousedown on editable field) → close the callout:
  //   user intends to edit, we clear the message so it doesn't block them.
  const syncValidity = (event, { fromRequestAction = false } = {}) => {
    const elementSig = getElementSignature(controller.elementRef.current);
    const isValid = checkValidity({ event, fromRequestAction });
    if (failingManagedControlValidity) {
      // Group/form case: find the actual failing leaf and report on it.
      // The leaf's callout is sufficient — no need to report at the group level.
      let leafCV = failingManagedControlValidity;
      while (
        leafCV.failingManagedControlValidity &&
        !leafCV.failedConstraintInfo
      ) {
        leafCV = leafCV.failingManagedControlValidity;
      }
      leafCV.reportValidity({ event });
      return isValid;
    }
    if (failedConstraintInfo) {
      const hasActionProp = Boolean(controller.props.action);
      if (hasActionProp) {
        debugUIState(
          event,
          `syncValidity ${elementSig}: has failing constraint and action context -> reportValidity`,
        );
        reportValidity({ event });
      } else {
        debugUIState(
          event,
          `syncValidity ${elementSig}: has failing constraint but no own action -> close callout if any`,
        );
        innerRequestCloseCallout(event, event?.type);
      }
    } else {
      debugUIState(
        event,
        `syncValidity ${elementSig}: no failing constraint -> close callout if any`,
      );
      innerRequestCloseCallout(event, event?.type);
    }
    // Propagate a silent validity update up the controller chain.
    // Parent controllers (group, facade) don't report — the leaf's callout is enough.
    // They just need their validity state kept current so _attemptCommit can read it.
    let parentController = controller.parentUIStateController;
    while (parentController) {
      parentController.controlValidity.checkValidity({ event });
      parentController = parentController.parentUIStateController;
    }
    return isValid;
  };
  controlValidity.syncValidity = syncValidity;

  return controlValidity;
};

export const requestCloseValidityCallout = (
  element,
  event = new CustomEvent("programmatic_call"),
  reason,
) => {
  const controller = element.__uiStateController__;
  if (!controller) {
    return false;
  }
  const controlValidity = controller.controlValidity;
  const { callout } = controlValidity;
  if (!callout) {
    return false;
  }
  return callout.requestClose(event, reason);
};

const pickConstraintFailureInfo = (a, b) => {
  const aPrio = getConstraintFailureInfoPriority(a);
  const bPrio = getConstraintFailureInfoPriority(b);
  if (aPrio > bPrio) {
    return a;
  }
  return b;
};
const getConstraintFailureInfoPriority = (failureInfo) => {
  if (failureInfo.status === "error") {
    return 1000;
  }
  const { constraint } = failureInfo;
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
  const controller = form.__uiStateController__;
  if (!controller) {
    requestSubmit.call(form, submitter);
    return;
  }
  const programmaticEvent = new CustomEvent("programmatic_request_submit", {
    cancelable: true,
    detail: {
      submitter,
    },
  });
  dispatchRequestInteraction(form, {
    event: programmaticEvent,
    requester: submitter,
    wantAction: true,
    name: "requestSubmit",
    category: "interaction",
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

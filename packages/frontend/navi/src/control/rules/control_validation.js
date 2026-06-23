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
 * To enable this API one have to call createControlValidation(controller)
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

import { dispatchPublicCustomEvent, getElementSignature } from "@jsenv/dom";

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { findControlProxyTargetController } from "../controller_registry.js";
import { getConstraintMessage } from "./constraint_message.js";
import { createOpenToken } from "./control_callout.js";
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

const VALIDATION_TOKEN = createOpenToken();

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

export const createControlValidation = (
  controller,
  { callout, debugUIState },
) => {
  const controlValidity = {
    registerConstraint: undefined,
    checkValidity: undefined,
    reportValidity: undefined,
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
      return proxyTargetController.rules.validation.checkValidity({
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
      const managedCV = managedController.rules.validation;
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
      callout.removeOpenToken(VALIDATION_TOKEN, checkValidityCallEvent);
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

  const reportValidity = ({ event, requester, skipFocus } = {}) => {
    const { message } = getConstraintMessage(
      controller,
      failedConstraintInfo.constraint,
      failedConstraintInfo.message,
      { requester },
    );
    callout.addOpenToken(VALIDATION_TOKEN, {
      message,
      status: failedConstraintInfo.status,
      anchorElement: failedConstraintInfo.target,
      event,
      skipFocus,
      onClose: () => {
        failedConstraintInfo.reportStatus = "closed";
      },
    });
    failedConstraintInfo.reportStatus = "reported";
  };
  controlValidity.checkValidity = checkValidity;
  controlValidity.reportValidity = reportValidity;
  Object.defineProperty(controlValidity, "failedConstraintInfo", {
    get: () => failedConstraintInfo,
  });
  Object.defineProperty(controlValidity, "failingManagedControlValidity", {
    get: () => failingManagedControlValidity,
  });
  // Centralized validity sync: decides what to show/close based on the event type
  // and the current constraint state.
  //
  // - Interaction constraints (readonly/disabled/busy) violated → always report them.
  // - Value-modifying event (input, keydown...) + own action + value invalid → report.
  // - Pure interaction event (mousedown on editable field) → close the callout:
  //   user intends to edit, we clear the message so it doesn't block them.
  const syncValidity = (
    event,
    { report = false, fromRequestAction = false } = {},
  ) => {
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
      // Forward the report decision to the leaf — the parent already decided.
      if (report) {
        leafCV.reportValidity({ event });
      }
      return isValid;
    }
    if (failedConstraintInfo) {
      if (report) {
        debugUIState(
          event,
          `syncValidity ${elementSig}: has failing constraint and report=true -> reportValidity`,
        );
        reportValidity({ event });
      } else if (failedConstraintInfo.status === "error") {
        // Error callouts persist until the user explicitly dismisses them (close button, Escape).
        // Unlike warning callouts — which can be cleared just by interacting with the control —
        // errors require an intentional acknowledgement. The callout is removed automatically
        // on the next action attempt via autoResetOnAction.
        debugUIState(
          event,
          `syncValidity ${elementSig}: has error constraint and report=false -> keep callout open`,
        );
      } else {
        debugUIState(
          event,
          `syncValidity ${elementSig}: has failing constraint but report=false -> close callout if any`,
        );
        callout.removeOpenToken(VALIDATION_TOKEN, event);
      }
    } else {
      // Sync interaction state — if the control is now interactable the interaction
      // callout token is removed, allowing the callout to close.
      const ci = controller.rules.interaction;
      if (ci) {
        ci.checkInteractivity({ event });
      }
      debugUIState(
        event,
        `syncValidity ${elementSig}: no failing constraint -> close callout if any`,
      );
      callout.removeOpenToken(VALIDATION_TOKEN, event);
    }
    // Propagate a silent validity update up the controller chain.
    // Parent controllers (group, facade) don't report — the leaf's callout is enough.
    // They just need their validity state kept current so _attemptCommit can read it.
    let parentController = controller.parentUIStateController;
    while (parentController) {
      parentController.rules.validation.checkValidity({ event });
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
  const rulesCallout = controller.rules.callout;
  if (!rulesCallout) {
    return false;
  }
  return rulesCallout.requestCloseCallout(event, reason);
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

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

import { openValidationMessage } from "./validation_message.js";

export const installInputCustomValidation = (input) => {
  const validationInterface = {
    uninstall: undefined,
    registerCancelCallback: undefined,
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

  set_property_on_input: {
    input.validationInterface = validationInterface;
    cleanupCallbackSet.add(() => {
      delete input.validationInterface;
    });
  }

  let triggerOnCancel;
  register_cancel_callback: {
    const cancelCallbackSet = new Set();
    triggerOnCancel = (reason) => {
      const cancelEvent = new CustomEvent("cancel", { detail: reason });
      input.dispatchEvent(cancelEvent);
      for (const cancelCallback of cancelCallbackSet) {
        cancelCallback(reason);
      }
    };
    validationInterface.registerCancelCallback = (callback) => {
      cancelCallbackSet.add(callback);
      return () => {
        cancelCallbackSet.delete(callback);
      };
    };
  }

  let validationMessage;
  const openInputValidationMessage = () => {
    input.focus();
    const closeOnCleanup = () => {
      validationMessage.close();
    };
    let message;
    let level;
    if (typeof lastFailedValidityInfo === "string") {
      message = lastFailedValidityInfo;
    } else {
      message = lastFailedValidityInfo.message;
      level = lastFailedValidityInfo.level;
    }
    validationMessage = openValidationMessage(input, message, {
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
      const constraintValidityInfo = constraint.check(input);
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
        validationMessage.close();
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
    openInputValidationMessage();
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
    const addCustomMessage = (key, message, { level = "error" } = {}) => {
      customMessageMap.set(key, { message, level });
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

  update_on_input: {
    const oninput = () => {
      customMessageMap.clear();
      if (validationMessage) {
        validationMessage.close();
      }
      checkValidity();
    };
    input.addEventListener("input", oninput);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("input", oninput);
    });
  }

  report_on_enter_without_form: {
    const onkeydown = (e) => {
      if (!input.form && e.key === "Enter" && !checkValidity()) {
        reportValidity();
        // no need to prevent anything here, Enter on input without form does nothing
      }
    };
    input.addEventListener("keydown", onkeydown);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("keydown", onkeydown);
    });
  }

  report_on_input_report_validity_call: {
    const nativeReportValidity = input.reportValidity;
    input.reportValidity = () => {
      reportValidity();
    };
    cleanupCallbackSet.add(() => {
      input.reportValidity = nativeReportValidity;
    });
  }

  report_on_form_request_submit_call: {
    const onRequestSubmit = (form, { prevent }) => {
      if (form === input.form && lastFailedValidityInfo && !checkValidity()) {
        reportValidity();
        prevent();
      }
    };
    requestSubmitCallbackSet.add(onRequestSubmit);
    cleanupCallbackSet.add(() => {
      requestSubmitCallbackSet.delete(onRequestSubmit);
    });
  }

  report_on_form_request_submit_by_click: {
    const willSubmitFormOnClick = (element) => {
      return element.type === "submit" || element.type === "image";
    };

    const onClick = (e) => {
      const target = e.target;
      const form = target.form;
      if (!form) {
        // happens outside a form
        return;
      }
      if (input.form !== form) {
        // happens in an other form, or the input has no form
        return;
      }
      if (
        willSubmitFormOnClick(target) &&
        lastFailedValidityInfo &&
        !checkValidity()
      ) {
        reportValidity();
        e.preventDefault();
      }
    };
    window.addEventListener("click", onClick, { capture: true });
    cleanupCallbackSet.add(() => {
      window.removeEventListener("click", onClick, { capture: true });
    });

    const onKeydown = (e) => {
      if (e.key !== "Enter") {
        return;
      }
      const target = e.target;
      const form = target.form;
      if (!form) {
        // happens outside a form
        return;
      }
      if (input.form !== form) {
        // happens in an other form, or the input has no form
        return;
      }
      if (willSubmitFormOnClick(target)) {
        // we'll catch it in the click handler
        return;
      }
      if (!checkValidity()) {
        reportValidity();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeydown, { capture: true });
    cleanupCallbackSet.add(() => {
      window.removeEventListener("keydown", onClick, { capture: true });
    });
  }

  close_on_escape: {
    const onkeydown = (e) => {
      if (e.key === "Escape") {
        if (validationMessage) {
          validationMessage.close();
        } else {
          triggerOnCancel("escape_key");
        }
      }
    };
    input.addEventListener("keydown", onkeydown);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("keydown", onkeydown);
    });
  }

  cancel_on_blur_empty: {
    const onblur = () => {
      if (input.value === "") {
        triggerOnCancel("blur_empty");
      }
    };
    input.addEventListener("blur", onblur);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("blur", onblur);
    });
  }

  cancel_on_blur_without_change: {
    let gotChange;
    const onchange = () => {
      gotChange = true;
    };
    const onblur = () => {
      if (gotChange) {
        gotChange = false;
      } else {
        triggerOnCancel("blur_without_change");
      }
    };
    input.addEventListener("change", onchange);
    input.addEventListener("blur", onblur);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("change", onchange);
      input.removeEventListener("blur", onblur);
    });
  }

  return validationInterface;
};

// https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation

const REQUIRED_CONSTRAINT = {
  name: "required",
  check: (input) => {
    if (input.required && !input.value) {
      return `Veuillez remplir ce champ.`;
    }
    return null;
  },
};
const PATTERN_CONSTRAINT = {
  name: "pattern",
  check: (input) => {
    const pattern = input.pattern;
    if (!pattern) {
      return null;
    }
    const regex = new RegExp(pattern);

    const value = input.value;
    if (!regex.test(value)) {
      const title = input.title;
      let message = `Veuillez respecter le format requis.`;
      if (title) {
        message += `<br />${title}`;
      }
      return message;
    }
    return null;
  },
};
// https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/email#validation
const emailregex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const TYPE_EMAIL_CONSTRAINT = {
  name: "type_email",
  check: (input) => {
    if (input.type === "email") {
      const value = input.value;
      if (!value.includes("@")) {
        return `Veuillez inclure "@" dans l'adresse e-mail. Il manque un symbole "@" dans ${value}.`;
      }
      if (!emailregex.test(input.value)) {
        return `Veuillez saisir une adresse e-mail valide.`;
      }
    }
    return null;
  },
};

const requestSubmitCallbackSet = new Set();
const requestSubmit = HTMLFormElement.prototype.requestSubmit;
HTMLFormElement.prototype.requestSubmit = function (submitter) {
  let prevented = false;
  const prevent = () => {
    prevented = true;
  };
  for (const requestSubmitCallback of requestSubmitCallbackSet) {
    requestSubmitCallback(this, { submitter, prevent });
  }
  if (prevented) {
    return;
  }
  requestSubmit.call(this, submitter);
};

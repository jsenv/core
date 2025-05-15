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
 */

import { openValidationMessage } from "./validation_message.js";

export const installInputValidation = (
  input,
  { onCancel, customConstraints = [] } = {},
) => {
  const validationInterface = {};

  const cleanupCallbackSet = new Set();
  const uninstall = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  validationInterface.uninstall = uninstall;

  let validationMessage;
  const openInputValidationMessage = () => {
    input.focus();
    const closeOnCleanup = () => {
      validationMessage.close();
    };
    validationMessage = openValidationMessage(input, lastFailedValidityInfo, {
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
  for (const customConstraint of customConstraints) {
    constraintSet.add(customConstraint);
  }

  let lastFailedValidityInfo = null;
  const validityInfoMap = new Map();
  const updateValidity = ({ openOnFailure } = {}) => {
    validityInfoMap.clear();
    lastFailedValidityInfo = null;

    for (const constraint of constraintSet) {
      const contraintMessage = constraint.check(input);
      if (contraintMessage) {
        validityInfoMap.set(constraint, contraintMessage);
        lastFailedValidityInfo = contraintMessage;
      }
    }

    if (!openOnFailure) {
      if (validationMessage) {
        validationMessage.close();
      }
      return !lastFailedValidityInfo;
    }
    if (!lastFailedValidityInfo) {
      if (validationMessage) {
        validationMessage.close();
      }
      return true;
    }
    if (validationMessage) {
      validationMessage.update(lastFailedValidityInfo);
      return false;
    }
    openInputValidationMessage();
    return false;
  };

  update_on_input: {
    const oninput = () => {
      updateValidity();
    };
    input.addEventListener("input", oninput);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("input", oninput);
    });
  }

  close_on_escape: {
    const onkeydown = (e) => {
      if (e.key === "Escape") {
        if (validationMessage) {
          validationMessage.close();
        } else if (onCancel) {
          onCancel("escape_key");
        }
      }
    };
    input.addEventListener("keydown", onkeydown);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("keydown", onkeydown);
    });
  }

  cancel_on_blur_empty: {
    if (onCancel) {
      const onblur = () => {
        if (input.value === "") {
          onCancel("blur_empty");
        }
      };
      input.addEventListener("blur", onblur);
      cleanupCallbackSet.add(() => {
        input.removeEventListener("blur", onblur);
      });
    }
  }

  report_validity: {
    const reportValidity = input.reportValidity;
    input.reportValidity = () => {
      updateValidity({ openOnFailure: true });
    };
    cleanupCallbackSet.add(() => {
      input.reportValidity = reportValidity;
    });
  }

  report_on_enter_without_form: {
    const onkeydown = (e) => {
      if (!input.form && e.key === "Enter") {
        updateValidity({ openOnFailure: true });
      }
    };
    input.addEventListener("keydown", onkeydown);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("keydown", onkeydown);
    });
  }

  report_on_form_submit_requested_by_api: {
    const onRequestSubmit = (form, { prevent }) => {
      if (form === input.form && !updateValidity({ openOnFailure: true })) {
        prevent();
      }
    };
    requestSubmitCallbackSet.add(onRequestSubmit);
    cleanupCallbackSet.add(() => {
      requestSubmitCallbackSet.delete(onRequestSubmit);
    });
  }

  report_on_form_submit_requested_by_click: {
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
      if (willSubmitFormOnClick(target)) {
        if (!updateValidity({ openOnFailure: true })) {
          e.preventDefault();
        }
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
      if (!updateValidity({ openOnFailure: true })) {
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", onKeydown, { capture: true });
    cleanupCallbackSet.add(() => {
      window.removeEventListener("keydown", onClick, { capture: true });
    });
  }

  custom_message: {
    const customMessageMap = new Map();
    constraintSet.add({
      name: "custom_message",
      check: () => {
        for (const [, message] of customMessageMap) {
          if (message) {
            return message;
          }
        }
        return null;
      },
    });
    const addCustomMessage = (key, message) => {
      customMessageMap.set(key, message);
      updateValidity({ openOnFailure: true });
      return () => {
        customMessageMap.delete(key);
      };
    };
    const removeCustomMessage = (key) => {
      customMessageMap.delete(key);
      updateValidity();
    };
    cleanupCallbackSet.add(() => {
      customMessageMap.clear();
    });
    Object.assign(validationInterface, {
      addCustomMessage,
      removeCustomMessage,
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

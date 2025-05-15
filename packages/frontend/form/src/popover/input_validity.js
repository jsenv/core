/**
 * I'll re-implement a custom validity api
 * because the native one is not configurable enough:
 *
 * - REALLY PAINFUL can't tell if the message is displayed or not, nor remove it with escape or something
 * - ok but complex: have to listen many evens in all directions to decide wether it's time to display the message or not
 * - ok but sitll not great: have to hack setCustomValidity to hold many validation messages
 * - ok but might be great to have some form of control on the design: can't customize the message
 */

import { openValidationMessage } from "./validation_message.js";

export const installInputValidation = (input) => {
  const cleanupCallbackSet = new Set();

  let validationMessage;
  const openInputValidationMessage = () => {
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
  constraintSet.add({
    name: "pattern",
    check: (input) => {
      const pattern = input.pattern;
      if (!pattern) {
        return null;
      }
      const regex = new RegExp(pattern);
      if (!regex.test(input.value)) {
        // we should add input.title to the message
        return `Veuillez respecter le format requis.`;
      }
      return null;
    },
  });

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
    console.log("open", validationMessage);
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

  report_on_enter: {
    const onkeydown = (e) => {
      if (e.key === "Enter") {
        if (!updateValidity({ openOnFailure: true })) {
          e.preventDefault();
        }
      }
    };
    input.addEventListener("keydown", onkeydown);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("keydown", onkeydown);
    });
  }

  close_on_escape: {
    const onkeydown = (e) => {
      if (e.key === "Escape") {
        if (validationMessage) {
          validationMessage.close();
        }
      }
    };
    input.addEventListener("keydown", onkeydown);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("keydown", onkeydown);
    });
  }

  report_validity: {
    const reportValidity = input.reportValidity;
    input.reportValidity = () => {
      input.focus();
      updateValidity({ openOnFailure: true });
    };
    cleanupCallbackSet.add(() => {
      input.reportValidity = reportValidity;
    });
  }

  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
};

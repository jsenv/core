/**
 * TODO:
 *
 * j'aimerais que le type d'erreur influe le comportement:
 *
 * required -> si on blur on reprend la valeure précédente
 * escape key -> on revient a la valeur précédente
 * custom validity genre name already taken -> on garde la valeur actuelle
 * et meme on blur on garde le bord rouge et le message ne se reset que lorsqu'on input
 * custom validity erreur serveur -> on garde la valeur actuelle
 * pareil que précédent
 *
 * mais tout ca doit etre configurable
 *
 * par example le code de useRequired
 * ca va juste venir ici et faire partie de comment on gere ce type de validation
 * et on pourra controler chaque type de validation
 *
 * -> le code de use_required vient ici
 * -> le code de use_data_active vient ici
 *
 */

import "./input_validity.css" with { type: "css" };

const wrapperWeakMap = new WeakMap();

export const createInputValidity = (input, { onCancel } = {}) => {
  const fromCache = wrapperWeakMap.get(input);
  if (fromCache) {
    const { inputValidity, cancelCallbackSet } = fromCache;
    if (onCancel) {
      cancelCallbackSet.add(onCancel);
    }
    return inputValidity;
  }

  const cancelCallbackSet = new Set();
  const triggerOnCancel = () => {
    for (const cancelCallback of cancelCallbackSet) {
      cancelCallback();
    }
  };
  if (onCancel) {
    cancelCallbackSet.add(onCancel);
  }

  const cleanupCallbackSet = new Set();
  const inputValidity = {
    cleanup: () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    },
  };
  wrapperWeakMap.set(input, { inputValidity, cancelCallbackSet });

  const addSelfCleanedEventListenerOnInput = (eventName, eventCallback) => {
    input.addEventListener(eventName, eventCallback);
    const remove = () => {
      input.removeEventListener(eventName, eventCallback);
    };
    cleanupCallbackSet.add(remove);
    return remove;
  };

  /**
   * The following html
   *
   * ```html
   * <style>
   *   input:invalid {
   *     outline-color: red;
   *   }
   * </style>
   *
   * <input required>
   * ```
   *
   * Would make input red without user interaction.
   *
   * Here we want to change that for the required validity check:
   *
   * 1. When user don't interact, input:invalid should not be visible
   * 2. When user focus the input, input:invalid should not be visible
   * 3. When user start typing, input:invalid does not match so we're good
   * 4. While typing if user makes input empty, input:invalid matches and should be visible
   *
   * - It's important to keep input:invalid matching and required attribute at all times
   * to ensure form submission is blocked.
   * - We need something to help CSS display :invalid only when condition 4 is met
   *
   * -> We put [data-active] when user starts typing and we remove it when input is blurred
   */
  debounce_invalid_by_interaction: {
    addSelfCleanedEventListenerOnInput("input", () => {
      input.setAttribute("data-active", "");
    });
    addSelfCleanedEventListenerOnInput("blur", () => {
      input.removeAttribute("data-active", "");
    });
  }

  /**
   * Many part of code might want to set a custom validity message
   * When the error is gone, we want to the the custom validity message
   * But there is no way for a given part of the app to know if all other errors still applies
   *
   * Here we are going to give ability to set/unset a custom validity message by key
   */
  keyed_custom_validity: {
    const validityMessageMap = new Map();

    const setAndReportValidity = (message) => {
      input.setAttribute("data-error", "");
      input.setCustomValidity(message);
      input.reportValidity();
    };
    const resetCustomValidity = () => {
      input.setCustomValidity("");
      input.removeAttribute("data-error");
    };

    let wasJustSet = false;
    inputValidity.addCustomValidity = (key, message) => {
      validityMessageMap.set(key, message);
      setAndReportValidity(message);
      wasJustSet = true;
      setTimeout(() => {
        wasJustSet = false;
      }, 0);
    };

    inputValidity.removeCustomValidity = (key) => {
      validityMessageMap.delete(key);
      if (validityMessageMap.size === 0) {
        resetCustomValidity();
      }
    };
    addSelfCleanedEventListenerOnInput("input", () => {
      if (wasJustSet) {
        // if code does set a custom validity message during input
        // we keep it, the next input will reset it
        return;
      }
      resetCustomValidity();
    });
  }

  cancel_on_escape: {
    addSelfCleanedEventListenerOnInput("keydown", (event) => {
      if (event.key === "Escape") {
        triggerOnCancel();
      }
    });
  }

  required: {
    addSelfCleanedEventListenerOnInput("input", () => {
      if (input.validity.valueMissing) {
        input.reportValidity();
      }
    });
    addSelfCleanedEventListenerOnInput("blur", () => {
      if (input.validity.valueMissing) {
        // blur + empty when required is considered as a cancel
        triggerOnCancel();
      }
    });
  }

  enter_report_validity_outside_form: {
    addSelfCleanedEventListenerOnInput("keydown", (event) => {
      if (!input.form && event.key === "Enter") {
        input.reportValidity();
      }
    });
  }

  return inputValidity;
};

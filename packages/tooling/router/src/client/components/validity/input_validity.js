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

export const createInputValidity = (input) => {
  const fromCache = wrapperWeakMap.get(input);
  if (fromCache) {
    return fromCache;
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
  wrapperWeakMap.set(input, inputValidity);

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
    const onfocus = () => {
      input.addEventListener("input", oninput);
    };
    const onblur = () => {
      input.removeAttribute("data-active", "");
    };
    const oninput = () => {
      input.removeEventListener("input", oninput);
      input.setAttribute("data-active", "");
    };

    input.addEventListener("focus", onfocus);
    input.addEventListener("blur", onblur);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("focus", onfocus);
      input.removeEventListener("blur", onblur);
      input.removeEventListener("input", oninput);
    });
  }

  /**
   * Many part of code might want to set a custom validity message
   * When the error is gone, we want to the the cusotm validity message
   * But there is no way for a given part of the app to know if all other errors still applies
   *
   * Here we are going to give ability to set/unset a custom validity message by key
   */
  keyed_custom_validity: {
    const validityMessageMap = new Map();

    const setAndReportValidity = (message) => {
      input.setCustomValidity(message);
      input.reportValidity();
    };
    const resetCustomValidity = () => {
      input.setCustomValidity("");
      input.removeAttribute("data-error", "");
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

    const oninput = () => {
      if (wasJustSet) {
        // if code does set a custom validity message during input
        // we keep it, the next input will reset it
        return;
      }
      resetCustomValidity();
    };
    input.addEventListener("input", oninput);
  }

  required: {
    if (!input.required) {
      break required;
    }

    const oninput = () => {
      if (input.validity.valueMissing) {
        input.reportValidity();
      }
    };
    const onblur = () => {
      if (input.validity.valueMissing) {
        // dont keep the invalid invalid and empty, restore
        // the value when user stops interacting
        // input.value = value;
      }
    };
    input.addEventListener("input", oninput);
    input.addEventListener("blur", onblur);
    cleanupCallbackSet.add(() => {
      input.removeEventListener("input", oninput);
      input.removeEventListener("blur", onblur);
    });
  }

  return inputValidity;
};

/**
 * Input Validity Manager
 *
 * This module provides utilities to manage HTML input validation in a more controlled
 * and user-friendly way than the default browser behavior. It addresses several limitations
 * of the native HTML5 validation:
 *
 * 1. Controls when validation errors are shown to avoid premature error displays
 * 2. Provides a key-based custom validation system to manage multiple validation sources
 * 3. Adds escape key support to cancel input operations
 * 4. Enhances required field behavior with improved UX
 *
 * Usage:
 *   const validity = createInputValidity(inputElement, { onCancel: () => { ... } });
 *   validity.addCustomValidity("unique_name", "Name already exists");
 *   validity.removeCustomValidity("unique_name");
 */

import "./input_validity.css" with { type: "css" };

const wrapperWeakMap = new WeakMap();

/**
 * Creates an input validity controller for the specified input element
 *
 * @param {HTMLInputElement} input - The input element to enhance with validity features
 * @param {Object} options - Configuration options
 * @param {Function} [options.onCancel] - Callback triggered when the input operation is cancelled
 * @returns {Object} An object with methods to control input validity
 */
export const createInputValidity = (
  input,
  key,
  { requestSubmitOnChange = true, onCancel } = {},
) => {
  const fromCache = wrapperWeakMap.get(input);
  if (fromCache) {
    const inputValidity = fromCache;
    return inputValidity.subscribe(key, { requestSubmitOnChange, onCancel });
  }

  const inputValidity = _createInputValidity(input);
  wrapperWeakMap.set(input, inputValidity);
  return inputValidity.subscribe(key, { requestSubmitOnChange, onCancel });
};

const _createInputValidity = (input) => {
  const cancelCallbackSet = new Set();
  /**
   * Triggers all registered cancel callbacks
   * This is called when user presses Escape or when required fields are
   * abandoned without input
   */
  const triggerOnCancel = (reason) => {
    for (const cancelCallback of cancelCallbackSet) {
      cancelCallback(reason);
    }
  };

  const cleanupCallbackSet = new Set();
  let subscribeCount = 0;
  const inputValidity = {
    subscribe: (key, { requestSubmitOnChange, onCancel }) => {
      if (requestSubmitOnChange) {
        inputValidity.requestSubmitOnChange = requestSubmitOnChange;
      }
      if (onCancel) {
        cancelCallbackSet.add(onCancel);
      }
      return {
        addCustomValidity: (message) =>
          inputValidity.addCustomValidity(key, message),
        removeCustomValidity: () => inputValidity.removeCustomValidity(key),
        unsubscribe: () => {
          subscribeCount--;
          if (subscribeCount > 0) {
            return;
          }
          for (const cleanupCallback of cleanupCallbackSet) {
            cleanupCallback();
          }
          cleanupCallbackSet.clear();
          wrapperWeakMap.delete(input);
        },
      };
    },
  };
  wrapperWeakMap.set(input, inputValidity);

  /**
   * Attaches an event listener to the input element that will be automatically
   * removed when the validity controller is cleaned up
   *
   * @param {string} eventName - The DOM event name to listen for
   * @param {Function} eventCallback - Event handler function
   * @returns {Function} A function that removes this specific event listener
   */
  const addSelfCleanedEventListenerOnInput = (eventName, eventCallback) => {
    input.addEventListener(eventName, eventCallback);
    const remove = () => {
      input.removeEventListener(eventName, eventCallback);
    };
    cleanupCallbackSet.add(remove);
    return () => {
      remove();
      cleanupCallbackSet.delete(remove);
    };
  };

  /**
   * Visual validation feedback enhancement
   *
   * Controls when and how validation errors are displayed to the user:
   * 1. Uses a data-validity-feedback attribute to indicate active validation state
   * 2. Shows validation errors immediately when appropriate
   * 3. Removes validation state indicators when input loses focus
   * 4. Maintains validation state for form-embedded elements on form submission
   *
   * This allows CSS to style invalid inputs only when appropriate,
   * preventing premature error displays while maintaining validation integrity.
   */
  let reportValidity = () => {
    input.reportValidity();
    input.setAttribute("data-validity-feedback", "");
  };
  addSelfCleanedEventListenerOnInput("blur", () => {
    input.removeAttribute("data-validity-feedback");
  });
  addSelfCleanedEventListenerOnInput("invalid", () => {
    if (input.form) {
      input.setAttribute("data-validity-feedback", "");
    }
  });

  /**
   * Temporarily removes validation attributes to hide browser validation tooltips
   *
   * This is a workaround for browsers that don't automatically hide validation
   * tooltips when programmatically clearing validation errors. The function:
   * 1. Saves all validation attribute values
   * 2. Temporarily removes these attributes
   * 3. Restores them in the next event loop to maintain validation behavior
   *
   * This solution addresses a UI inconsistency in browsers without requiring extra CSS.
   */
  const removeValidityToLetBrowserTooltipHide = () => {
    if (input.validity.valid) {
      return;
    }
    const validationAttributes = [
      "pattern",
      "min",
      "max",
      "required",
      "minlength",
      "maxlength",
    ];
    const savedAttributeMap = new Map();
    for (const validationAttribute of validationAttributes) {
      if (input.hasAttribute(validationAttribute)) {
        savedAttributeMap.set(
          validationAttribute,
          input.getAttribute(validationAttribute),
        );
        input.removeAttribute(validationAttribute);
      }
    }
    setTimeout(() => {
      for (const [attr, value] of savedAttributeMap) {
        input.setAttribute(attr, value);
      }
    });
  };
  cancelCallbackSet.add(() => {
    removeValidityToLetBrowserTooltipHide();
  });

  /**
   * Key-based custom validation system
   *
   * Allows different parts of an application to set validation errors
   * independently without interfering with each other. Each validation
   * message is associated with a unique key.
   *
   * When multiple validation messages exist:
   * - All are stored in the internal map
   * - The first message encountered is displayed to the user
   * - Removing any key will update the displayed message or clear it if no errors remain
   *
   * This solves the problem where multiple validation sources might
   * conflict when trying to set/clear custom validation messages.
   */
  keyed_custom_validity: {
    const validityMessageMap = new Map();
    /**
     * Sets a custom validation message associated with the specified key
     *
     * When called, this method will:
     * 1. Store the validation message in an internal map
     * 2. Apply the message to the input element
     * 3. If the input is not focused, show validation feedback and focus the input
     * 4. Set up an event listener to clear this specific error on the first input event
     *
     * @param {string} key - Unique identifier for this validation message
     * @param {string} message - The validation error message to display
     */
    inputValidity.addCustomValidity = (key, message) => {
      validityMessageMap.set(key, message);
      input.setCustomValidity(message);
      if (document.activeElement !== input) {
        // called outside "input" event
        reportValidity();
        input.focus();
        const remove = addSelfCleanedEventListenerOnInput("input", () => {
          remove();
          inputValidity.removeCustomValidity(key);
        });
      }
    };

    /**
     * Removes a previously set custom validation message
     *
     * This method:
     * 1. Removes the specified validation key from the internal map
     * 2. If no validation messages remain, clears the input's custom validity state
     * 3. Ensures any lingering browser validation tooltips are hidden
     *
     * @param {string} key - The key of the validation message to remove
     */
    inputValidity.removeCustomValidity = (key) => {
      validityMessageMap.delete(key);
      if (validityMessageMap.size === 0) {
        input.setCustomValidity("");
        if (document.activeElement !== input) {
          removeValidityToLetBrowserTooltipHide();
        }
      }
    };
  }

  /**
   * Escape key handler
   *
   * Provides standardized behavior when user presses Escape:
   * triggers the onCancel callback which typically reverts to previous value
   * or exits editing mode.
   */
  let blurFromEscape = false;
  cancel_on_escape: {
    addSelfCleanedEventListenerOnInput("keydown", (event) => {
      if (event.key === "Escape") {
        blurFromEscape = true;
        input.blur();
        blurFromEscape = false;
        triggerOnCancel("escape_key");
        if (input.isConnected) {
          input.focus();
        }
      }
    });
  }

  /**
   * Enhanced empty field handling
   *
   * Improves UX by treating blur events on empty inputs as a cancellation,
   * assuming the user doesn't want to complete the action.
   *
   * This is especially useful for optional fields or when a user starts
   * an edit operation but changes their mind.
   */
  cancel_on_blur_empty: {
    addSelfCleanedEventListenerOnInput("blur", () => {
      if (input.value === "" && !blurFromEscape) {
        triggerOnCancel("blur_empty");
      }
    });
  }

  /**
   * Enter key validation outside forms
   *
   * Makes the Enter key trigger validation display even when input is not within a form,
   * providing consistent behavior with form-embedded inputs.
   *
   * This is particularly useful for standalone inputs that still need validation feedback.
   */
  enter_report_validity_outside_form: {
    addSelfCleanedEventListenerOnInput("keydown", (event) => {
      if (!input.form && event.key === "Enter") {
        reportValidity();
      }
    });
  }

  inputValidity.requestSubmitOnChange = false;
  addSelfCleanedEventListenerOnInput("change", () => {
    if (!inputValidity.requestSubmitOnChange) {
      return;
    }
    const form = input.form;
    if (!form) {
      return;
    }
    if (input.validity.valueMissing) {
      // considered as cancellation
      return;
    }
    if (input.checkValidity()) {
      form.requestSubmit();
    } else {
      input.reportValidity();
    }
  });

  return inputValidity;
};

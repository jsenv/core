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
export const createInputValidity = (input, { onCancel } = {}) => {
  // Cache management - retrieves existing controller if one exists for this input
  // or creates a new one to avoid duplicating event listeners
  const fromCache = wrapperWeakMap.get(input);
  if (fromCache) {
    const { inputValidity, cancelCallbackSet } = fromCache;
    if (onCancel) {
      cancelCallbackSet.add(onCancel);
    }
    return inputValidity;
  }

  const cancelCallbackSet = new Set();
  /**
   * Triggers all registered cancel callbacks
   * This is called when user presses Escape or when required fields are
   * abandoned without input
   */
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
      wrapperWeakMap.delete(input);
    },
  };
  wrapperWeakMap.set(input, { inputValidity, cancelCallbackSet });

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
   * Prevents inputs from appearing invalid before user interaction by:
   * 1. Adding a data-active attribute when user starts typing
   * 2. Removing it when input loses focus
   *
   * CSS can then use [data-active]:invalid to only show validation errors
   * after user interaction, while still maintaining form validation integrity.
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
    queueMicrotask(() => {
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
   * This solves the problem where multiple validation sources might
   * conflict when trying to set/clear custom validation messages.
   */
  keyed_custom_validity: {
    const validityMessageMap = new Map();
    /**
     * Sets a custom validation message associated with the specified key
     * The message will be displayed immediately and persist until explicitly removed
     * or until the user modifies the input (unless set during the input event)
     *
     * @param {string} key - Unique identifier for this validation message
     * @param {string} message - The validation error message to display
     */
    inputValidity.addCustomValidity = (key, message) => {
      validityMessageMap.set(key, message);
      console.log("custom", message);
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
     * If no other validation messages exist, the input will return to valid state
     *
     * @param {string} key - The key of the validation message to remove
     */
    inputValidity.removeCustomValidity = (key) => {
      validityMessageMap.delete(key);
      if (validityMessageMap.size === 0) {
        input.setCustomValidity("");
        removeValidityToLetBrowserTooltipHide();
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
  cancel_on_escape: {
    addSelfCleanedEventListenerOnInput("keydown", (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        input.blur();
        triggerOnCancel();
      }
    });
  }

  /**
   * Enhanced required field behavior
   *
   * Improves UX for required fields by:
   * 1. Showing validation errors immediately when typing if field becomes empty
   * 2. Treating blur events on empty required fields as cancellation
   *    (assuming user doesn't want to complete the action)
   */
  cancel_on_blur_empty: {
    addSelfCleanedEventListenerOnInput("blur", () => {
      if (input.value === "") {
        triggerOnCancel();
      }
    });
  }

  /**
   * Enter key validation outside forms
   *
   * Makes the Enter key trigger validation even when input is not within a form,
   * providing consistent behavior with form-embedded inputs.
   */
  enter_report_validity_outside_form: {
    addSelfCleanedEventListenerOnInput("keydown", (event) => {
      if (!input.form && event.key === "Enter") {
        reportValidity();
      }
    });
  }

  return inputValidity;
};

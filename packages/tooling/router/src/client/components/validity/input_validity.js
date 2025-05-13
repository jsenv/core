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
    return remove;
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
  debounce_invalid_by_interaction: {
    addSelfCleanedEventListenerOnInput("input", () => {
      input.setAttribute("data-active", "");
    });
    addSelfCleanedEventListenerOnInput("blur", () => {
      input.removeAttribute("data-active", "");
    });
  }

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

    const setAndReportValidity = (message) => {
      input.setAttribute("data-error", "");
      input.setCustomValidity(message);
      input.reportValidity();
    };
    const resetCustomValidity = () => {
      input.setCustomValidity("");
      input.removeAttribute("data-error");
    };

    /**
     * Flag to temporarily ignore input events right after setting a validation message
     *
     * This is necessary because:
     * 1. When addCustomValidity is called during an input event, we want to preserve
     *    the error message despite the input event that triggered it
     * 2. When addCustomValidity is called outside an input event, we still want
     *    subsequent user typing to clear the error message
     *
     * Using queueMicrotask ensures the flag is reset after the current event loop,
     * allowing us to differentiate between:
     * - The same input event that triggered validation
     * - Subsequent input events from user typing (which should clear the error)
     */
    let wasJustSet = false;
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
      setAndReportValidity(message);
      wasJustSet = true;
      // Reset the flag after the current event loop completes
      // This ensures we only ignore input events that are part of
      // the same synchronous execution context
      queueMicrotask(() => {
        wasJustSet = false;
      });
    };
    addSelfCleanedEventListenerOnInput("input", () => {
      if (wasJustSet) {
        // If a validation message was just set (in the same event loop),
        // preserve it for now - this prevents a race condition where
        // the same input event that triggered a validation would immediately clear it
        return;
      }
      // For normal typing from the user (different event loop than when
      // the error was set), clear the validation message
      resetCustomValidity();
    });

    /**
     * Removes a previously set custom validation message
     * If no other validation messages exist, the input will return to valid state
     *
     * @param {string} key - The key of the validation message to remove
     */
    inputValidity.removeCustomValidity = (key) => {
      validityMessageMap.delete(key);
      if (validityMessageMap.size === 0) {
        resetCustomValidity();
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

  /**
   * Enter key validation outside forms
   *
   * Makes the Enter key trigger validation even when input is not within a form,
   * providing consistent behavior with form-embedded inputs.
   */
  enter_report_validity_outside_form: {
    addSelfCleanedEventListenerOnInput("keydown", (event) => {
      if (!input.form && event.key === "Enter") {
        input.reportValidity();
      }
    });
  }

  return inputValidity;
};

/**
 * Where an action asks "are you sure?", and where whatever knows how to ask it
 * registers itself.
 *
 * Two directions meet here: the action execution path (use_execute_action.js)
 * needs to ask the question, and what asks it (confirm_popup.jsx) is a popup
 * built out of navi's own controls — which are themselves built out of the
 * action execution path. Neither side can import the other, so the question
 * travels through this leaf module instead. Same shape as registerNaviCommand.
 */

let confirmImplementation = null;

export const registerConfirmImplementation = (implementation) => {
  confirmImplementation = implementation;
};

/**
 * @param {object} options
 * @param {string} options.message - The question.
 * @param {Element} [options.anchor] - What asked, so the question can be shown
 *   next to it.
 * @returns {Promise<boolean>}
 */
export const requestConfirmation = async ({ message, anchor }) => {
  if (!confirmImplementation) {
    // Reachable only when navi is used through its own submodules rather than
    // its entry point (which registers the popup). An unanswerable question
    // must not silently swallow the action the user asked for.
    console.warn(
      `no confirm implementation registered, "${message}" is considered confirmed`,
    );
    return true;
  }
  return confirmImplementation({ message, anchor });
};

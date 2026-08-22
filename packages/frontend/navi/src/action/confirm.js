/**
 * Where an action asks "are you sure?", and where whatever knows how to ask it
 * registers itself.
 *
 * Two directions meet here: the action execution path (use_execute_action.js)
 * needs to ask the question, and what asks it (confirm_popup.jsx) is a popup
 * built out of navi's own controls — which are themselves built out of the
 * action execution path. Neither side can import the other, so the question
 * travels through this leaf module instead. Same shape as registerNaviCommand.
 *
 * The question itself is attached to the control that asks it, not carried as
 * a prop down the action pipeline: the control that requests an action is not
 * always the one that runs it (a submit button hands the send to its form), so
 * the request has an element to read the question off, and nothing else.
 */

import { useLayoutEffect } from "preact/hooks";

let confirmImplementation = null;

export const registerConfirmImplementation = (implementation) => {
  confirmImplementation = implementation;
};

const confirmParamsWeakMap = new WeakMap();

/**
 * Attaches a confirmation to whatever `elementRef` points at, for as long as
 * it is mounted.
 *
 * @param {import("preact/hooks").Ref<Element>} elementRef
 * @param {object} params
 * @param {string|import("preact").ComponentChildren} [params.message] - The
 *   question. Plain text, or JSX when it needs a link, an emphasis, a list.
 * @param {import("preact").ComponentChildren} [params.content] - The whole
 *   popup body, replacing the default question + buttons. Answer from inside it
 *   with the `--navi-confirm` and `--navi-cancel` commands.
 */
export const useConfirmParams = (elementRef, { message, content }) => {
  // No dependency array: `content` is JSX, a fresh object on every render, so
  // there is nothing stable to compare — and writing to a WeakMap costs less
  // than deciding whether to.
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return undefined;
    }
    if (message === undefined && content === undefined) {
      confirmParamsWeakMap.delete(element);
      return undefined;
    }
    confirmParamsWeakMap.set(element, { message, content });
    return () => {
      confirmParamsWeakMap.delete(element);
    };
  });
};

export const getConfirmParams = (element) => {
  if (!element) {
    return undefined;
  }
  if (confirmAnsweredSet.has(element)) {
    return undefined;
  }
  return confirmParamsWeakMap.get(element);
};

const confirmAnsweredSet = new WeakSet();

/**
 * One press asks its question once. What a press sets off can come back through
 * the action path with the same element as requester — clearing a picker sends
 * it, and the send reads the question off whoever asked for it — so whoever
 * already asked says so, for as long as that press lasts.
 *
 * @param {Element} element - The one that was asked.
 * @returns {() => void} Call it when the press is over.
 */
export const suspendConfirmParams = (element) => {
  if (!element) {
    return () => {};
  }
  confirmAnsweredSet.add(element);
  return () => {
    confirmAnsweredSet.delete(element);
  };
};

/**
 * @param {object} params
 * @param {string|import("preact").ComponentChildren} [params.message]
 * @param {import("preact").ComponentChildren} [params.content]
 * @param {Element} [params.anchor] - What asked, so the question can be shown
 *   next to it.
 * @returns {Promise<boolean>}
 */
export const requestConfirmation = async ({ message, content, anchor }) => {
  if (!confirmImplementation) {
    // Reachable only when navi is used through its own submodules rather than
    // its entry point (which registers the popup). An unanswerable question
    // must not silently swallow the action the user asked for.
    console.warn(
      `no confirm implementation registered, the confirmation is considered given`,
    );
    return true;
  }
  return confirmImplementation({ message, content, anchor });
};

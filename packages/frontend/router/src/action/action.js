/**
 * Action Management System
 *
 * This module provides a system for creating, tracking and executing async actions with state
 * management and parameter binding capabilities. It leverages the Preact signals library for
 * reactive state updates.
 *
 * Key Features:
 * - Registry of reusable actions via WeakMap
 * - State management (idle, executing, done, failed, aborted)
 * - Parameter binding with memory-efficient caching using WeakRefs
 * - Automatic garbage collection of unused bound actions
 * - Subscription system for tracking usage and cleanup
 * - Integration with routing system
 *
 * Usage:
 * ```javascript
 * // Register an action
 * const fetchUsers = registerAction(async ({ signal, limit = 10 }) => {
 *   const response = await fetch(`/api/users?limit=${limit}`, { signal });
 *   return response.json();
 * }, "fetchUsers");
 *
 * // Bind parameters
 * const fetchAdminUsers = fetchUsers.bindParams({ limit: 5, role: "admin" });
 *
 * // Execute with abort signal
 * const abortController = new AbortController();
 * const result = await applyAction(fetchAdminUsers, {
 *   signal: abortController.signal
 * });
 * ```
 */

import { batch, effect, signal } from "@preact/signals";
import { compareTwoJsValues } from "../compare_two_js_values.js";
import { routingWhile } from "../document_routing.js";
import { ABORTED, DONE, EXECUTING, FAILED, IDLE } from "./action_status.js";

let debug = false;

// Registry of original actions
const actionWeakMap = new WeakMap();

/**
 * Registers a function as an action, caching it for reuse
 *
 * @param {Function} fn - The function to register as an action
 * @param {string} [name] - Optional name for the action (defaults to function name)
 * @returns {Object} The registered action object
 */
export const registerAction = (fn, name = fn.name || "anonymous") => {
  const existingAction = actionWeakMap.get(fn);
  if (existingAction) {
    return existingAction;
  }
  const action = createAction(fn, name);
  action.bindParams = (params) => bindParamsToAction(action, params);
  actionWeakMap.set(fn, action);
  return action;
};

/**
 * Creates an action object with state management
 *
 * @param {Function} fn - The function to wrap as an action
 * @param {string} name - Name for the action
 * @returns {Object} The action object
 */
const createAction = (fn, name = fn.name || "anonymous") => {
  let disposeErrorSignalEffect;
  let disposeDataSignalEffect;

  const executionStateSignal = signal(IDLE);
  let error;
  const errorSignal = signal(null);
  let data;
  const dataSignal = signal(null);

  let subscribeCount = 0;
  const subscribe = () => {
    subscribeCount++;
    action.subscribeCount = subscribeCount;
    if (subscribeCount === 1) {
      disposeDataSignalEffect = effect(() => {
        data = dataSignal.value;
        action.data = data;
      });
      disposeErrorSignalEffect = effect(() => {
        error = errorSignal.value;
        action.error = error;
      });
    }
  };
  const unsubscribe = () => {
    subscribeCount--;
    action.subscribeCount = subscribeCount;
    if (subscribeCount === 0) {
      if (disposeDataSignalEffect) {
        disposeDataSignalEffect();
        disposeDataSignalEffect = null;
      }
      if (disposeErrorSignalEffect) {
        disposeErrorSignalEffect();
        disposeErrorSignalEffect = null;
      }
    }
  };

  const action = {
    isAction: true,
    fn,
    name,
    executionStateSignal,
    errorSignal,
    dataSignal,
    error,
    data,
    subscribeCount,
    subscribe,
    unsubscribe,
    toString: () => `<Action> ${name}()`,
  };
  return action;
};

// Cache for bound actions to prevent excessive recreations
const boundActionWeakMap = new WeakMap();

/**
 * Binds parameters to an action, creating a new derived action
 * Uses memory-efficient WeakRefs to store bound actions that can be garbage collected
 *
 * @param {Function|Object} fnOrAction - Either a function or an action object
 * @param {Object} params - Parameters to bind to the action
 * @returns {Object} A new action with bound parameters
 */
export const bindParamsToAction = (fnOrAction, params) => {
  let fn;
  let name;
  if (typeof fnOrAction === "function") {
    fn = fnOrAction;
    name = fn.name || "anonymous";
  } else if (fnOrAction.isAction) {
    fn = fnOrAction.fn;
    name = fnOrAction.name;
  } else {
    throw new Error(
      `bindParamsToAction expects an action or a function, got ${typeof fnOrAction}`,
    );
  }

  // Get or create the array for this function
  let boundActions = boundActionWeakMap.get(fn);
  if (!boundActions) {
    boundActions = [];
    boundActionWeakMap.set(fn, boundActions);
  }

  // Clean up any garbage collected references
  const liveActions = boundActions.filter((ref) => ref.deref() !== undefined);
  boundActions.length = 0;
  boundActions.push(...liveActions);

  // Check if we already have a matching bound action
  for (const actionRef of boundActions) {
    const boundActionCandidate = actionRef.deref();
    if (
      boundActionCandidate &&
      compareTwoJsValues(boundActionCandidate.params, params)
    ) {
      return boundActionCandidate;
    }
  }

  // Create a new bound action
  const boundAction = createAction(
    (navParams) => fn({ ...navParams, ...params }),
    `${name}[bound]`,
  );

  boundAction.params = params;
  boundAction.toString = () => {
    const paramsString = Object.entries(params)
      .map(
        ([key, value]) =>
          `${key}: ${typeof value === "object" ? "{...}" : JSON.stringify(value)}`,
      )
      .join(", ");
    return `<BoundAction> ${name}({ ${paramsString} })`;
  };

  // Store weak reference to allow garbage collection
  boundActions.push(new WeakRef(boundAction));

  return boundAction;
};

/**
 * Executes an action with the provided context and handles state management
 *
 * @param {Object} action - The action to execute
 * @param {Object} options - Execution options
 * @param {AbortSignal} options.signal - AbortSignal to cancel the action
 * @param {FormData} [options.formData] - Optional form data to pass to the action
 * @returns {Promise<Object>} The execution result
 */
export const applyAction = async (action, { signal, formData }) => {
  const result = await routingWhile(async () => {
    const abortController = new AbortController();
    const abortSignal = abortController.signal;
    const abort = (reason) => {
      if (debug) {
        console.log(`abort action "${action}"`);
      }
      abortController.abort(reason);
      action.executionStateSignal.value = ABORTED;
    };

    if (signal) {
      signal.addEventListener("abort", () => {
        abort(signal.reason);
      });
    }

    try {
      if (debug) {
        console.log(`executing action ${action}`);
      }
      batch(() => {
        action.executionStateSignal.value = EXECUTING;
        action.errorSignal.value = null;
      });
      const data = await action.fn({ signal: abortSignal, formData });
      if (abortSignal.aborted) {
        return { aborted: true, error: null };
      }
      if (debug) {
        console.log(`${action} execution done`);
      }
      batch(() => {
        action.executionStateSignal.value = DONE;
        action.dataSignal.value = data;
      });
      return { aborted: false, error: null };
    } catch (e) {
      if (abortSignal.aborted && e === abortSignal.reason) {
        action.executionStateSignal.value = ABORTED;
        return { aborted: true, error: null };
      }
      batch(() => {
        action.executionStateSignal.value = FAILED;
        action.errorSignal.value = e;
      });
      return { aborted: false, error: e };
    }
  });
  return result;
};

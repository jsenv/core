import { installImportMetaCss } from "./jsenv_navi_side_effects.js";
import { useErrorBoundary, useLayoutEffect, useEffect, useCallback, useRef, useState, useContext, useMemo, useImperativeHandle, useId } from "preact/hooks";
import { jsxs, jsx, Fragment } from "preact/jsx-runtime";
import { createIterableWeakSet, mergeOneStyle, stringifyStyle, createPubSub, mergeTwoStyles, normalizeStyles, createGroupTransitionController, getElementSignature, getBorderRadius, preventIntermediateScrollbar, createOpacityTransition, findBefore, findAfter, createValueEffect, getVisuallyVisibleInfo, getFirstVisuallyVisibleAncestor, allowWheelThrough, resolveCSSColor, createStyleController, visibleRectEffect, pickPositionRelativeTo, getBorderSizes, getPaddingSizes, hasCSSSizeUnit, resolveCSSSize, activeElementSignal, canInterceptKeys, pickLightOrDark, resolveColorLuminance, initFocusGroup, dragAfterThreshold, getScrollContainer, stickyAsRelativeCoords, createDragToMoveGestureController, getDropTargetInfo, setStyles, useActiveElement, elementIsFocusable } from "@jsenv/dom";
import { prefixFirstAndIndentRemainingLines } from "@jsenv/humanize";
import { effect, signal, computed, batch, useSignal } from "@preact/signals";
import { createValidity } from "@jsenv/validity";
import { createContext, toChildArray, render, isValidElement, createRef, cloneElement } from "preact";
import { createPortal, forwardRef } from "preact/compat";

const actionPrivatePropertiesWeakMap = new WeakMap();
const getActionPrivateProperties = (action) => {
  const actionPrivateProperties = actionPrivatePropertiesWeakMap.get(action);
  if (!actionPrivateProperties) {
    throw new Error(`Cannot find action private properties for "${action}"`);
  }
  return actionPrivateProperties;
};
const setActionPrivateProperties = (action, properties) => {
  actionPrivatePropertiesWeakMap.set(action, properties);
};

const IDLE = { id: "idle" };
const RUNNING = { id: "running" };
const ABORTED = { id: "aborted" };
const FAILED = { id: "failed" };
const COMPLETED = { id: "completed" };

const useActionStatus = (action) => {
  if (!action) {
    return {
      params: undefined,
      runningState: IDLE,
      isPrerun: false,
      idle: true,
      loading: false,
      aborted: false,
      error: null,
      completed: false,
      data: undefined,
    };
  }
  const {
    paramsSignal,
    runningStateSignal,
    isPrerunSignal,
    errorSignal,
    computedDataSignal,
  } = getActionPrivateProperties(action);

  const params = paramsSignal.value;
  const isPrerun = isPrerunSignal.value;
  const runningState = runningStateSignal.value;
  const idle = runningState === IDLE;
  const aborted = runningState === ABORTED;
  const error = errorSignal.value;
  const loading = runningState === RUNNING;
  const completed = runningState === COMPLETED;
  const data = computedDataSignal.value;

  return {
    params,
    runningState,
    isPrerun,
    idle,
    loading,
    aborted,
    error,
    completed,
    data,
  };
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .action_error {
    margin-top: 0;
    margin-bottom: 20px;
    padding: 20px;
    background: #fdd;
    border: 1px solid red;
  }
`;
const renderIdleDefault = () => null;
const renderLoadingDefault = () => null;
const renderAbortedDefault = () => null;
const renderErrorDefault = error => {
  let routeErrorText = error && error.message ? error.message : error;
  return jsxs("p", {
    className: "action_error",
    children: ["An error occured: ", routeErrorText]
  });
};
const renderCompletedDefault = () => null;
const ActionRenderer = ({
  action,
  children,
  disabled
}) => {
  const {
    idle: renderIdle = renderIdleDefault,
    loading: renderLoading = renderLoadingDefault,
    aborted: renderAborted = renderAbortedDefault,
    error: renderError = renderErrorDefault,
    completed: renderCompleted,
    always: renderAlways
  } = typeof children === "function" ? {
    completed: children
  } : children || {};
  if (disabled) {
    return null;
  }
  if (action === undefined) {
    throw new Error("ActionRenderer requires an action to render, but none was provided.");
  }
  const {
    idle,
    loading,
    aborted,
    error,
    data
  } = useActionStatus(action);
  const UIRenderedPromise = useUIRenderedPromise(action);
  const [errorBoundary, resetErrorBoundary] = useErrorBoundary();

  // Mark this action as bound to UI components (has renderers)
  // This tells the action system that errors should be caught and stored
  // in the action's error state rather than bubbling up
  useLayoutEffect(() => {
    if (action) {
      const {
        ui
      } = getActionPrivateProperties(action);
      ui.hasRenderers = true;
    }
  }, [action]);
  useLayoutEffect(() => {
    resetErrorBoundary();
  }, [action, loading, idle, resetErrorBoundary]);
  useLayoutEffect(() => {
    UIRenderedPromise.resolve();
    return () => {
      actionUIRenderedPromiseWeakMap.delete(action);
    };
  }, [action]);

  // If renderAlways is provided, it wins and handles all rendering
  if (renderAlways) {
    return renderAlways({
      idle,
      loading,
      aborted,
      error,
      data
    });
  }
  if (idle) {
    return renderIdle(action);
  }
  if (errorBoundary) {
    return renderError(errorBoundary, "ui_error", action);
  }
  if (error) {
    return renderError(error, "action_error", action);
  }
  if (aborted) {
    return renderAborted(action);
  }
  let renderCompletedSafe;
  if (renderCompleted) {
    renderCompletedSafe = renderCompleted;
  } else {
    const {
      ui
    } = getActionPrivateProperties(action);
    if (ui.renderCompleted) {
      renderCompletedSafe = ui.renderCompleted;
    } else {
      renderCompletedSafe = renderCompletedDefault;
    }
  }
  if (loading) {
    if (action.canDisplayOldData && data !== undefined) {
      return renderCompletedSafe(data, action);
    }
    return renderLoading(action);
  }
  return renderCompletedSafe(data, action);
};
const defaultPromise = Promise.resolve();
defaultPromise.resolve = () => {};
const actionUIRenderedPromiseWeakMap = new WeakMap();
const useUIRenderedPromise = action => {
  if (!action) {
    return defaultPromise;
  }
  const actionUIRenderedPromise = actionUIRenderedPromiseWeakMap.get(action);
  if (actionUIRenderedPromise) {
    return actionUIRenderedPromise;
  }
  let resolve;
  const promise = new Promise(res => {
    resolve = res;
  });
  promise.resolve = resolve;
  actionUIRenderedPromiseWeakMap.set(action, promise);
  return promise;
};

const isSignal = (value) => {
  return getSignalType(value) !== null;
};

const BRAND_SYMBOL = Symbol.for("preact-signals");
const getSignalType = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (value.brand !== BRAND_SYMBOL) {
    return null;
  }

  if (typeof value._fn === "function") {
    return "computed";
  }

  return "signal";
};

/**
 * Deep equality comparison for JavaScript values with cycle detection and identity optimization.
 *
 * This function performs a comprehensive deep comparison between two JavaScript values,
 * handling all primitive types, objects, arrays, and edge cases that standard equality
 * operators miss.
 *
 * Key features:
 * - **Deep comparison**: Recursively compares nested objects and arrays
 * - **Cycle detection**: Prevents infinite loops with circular references
 * - **Identity optimization**: Uses SYMBOL_IDENTITY for fast comparison of objects with same identity
 * - **Edge case handling**: Properly handles NaN, null, undefined, 0, false comparisons
 * - **Type safety**: Ensures both values have same type before deep comparison
 *
 * Performance optimizations:
 * - Early exit for reference equality (a === b)
 * - Identity symbol check for objects (avoids deep comparison when possible)
 * - Efficient array length check before element-by-element comparison
 *
 * **SYMBOL_IDENTITY explained**:
 * This symbol allows recognizing objects as "conceptually the same" even when they are
 * different object instances. When two objects share the same SYMBOL_IDENTITY value,
 * they are considered equal without performing deep comparison.
 *
 * This is particularly useful for:
 * - Copied objects that should be treated as the same entity
 * - Objects reconstructed from serialization that represent the same data
 * - Parameters passed through spread operator: `{ ...originalParams, newProp: value }`
 * - Memoization scenarios where object content identity matters more than reference identity
 *
 * Use cases:
 * - Memoization cache key comparison ({ id: 1 } should equal { id: 1 })
 * - React/Preact dependency comparison for effects and memos
 * - State change detection in signals and stores
 * - Action parameter comparison for avoiding duplicate requests
 * - Object recognition across serialization/deserialization boundaries
 *
 * Examples:
 * ```js
 * // Standard deep comparison
 * compareTwoJsValues({ id: 1 }, { id: 1 }) // true (slow - deep comparison)
 *
 * // NaN edge case handling
 * compareTwoJsValues(NaN, NaN) // true (unlike === which gives false)
 *
 * // Identity optimization - objects are different instances but same identity
 * const originalParams = { userId: 123, filters: ['active'] };
 * const copiedParams = { ...originalParams, newFlag: true };
 *
 * // Without SYMBOL_IDENTITY: slow deep comparison every time
 * compareTwoJsValues(originalParams, copiedParams) // false (different content)
 *
 * // With SYMBOL_IDENTITY: fast path recognition
 * const sharedIdentity = Symbol('params-identity');
 * originalParams[SYMBOL_IDENTITY] = sharedIdentity;
 * copiedParams[SYMBOL_IDENTITY] = sharedIdentity;
 *
 * compareTwoJsValues(originalParams, copiedParams) // true (fast - identity match)
 * // ↑ This returns true immediately without comparing all properties
 *
 * // Real-world scenario: action memoization
 * const params1 = { userId: 123 };
 * const action1 = createAction(params1);
 *
 * const params2 = { ...params1, extra: 'data' }; // Different object reference
 * params2[SYMBOL_IDENTITY] = params1[SYMBOL_IDENTITY]; // Same conceptual identity
 *
 * const action2 = createAction(params2);
 * // action1 === action2 because params are recognized as conceptually identical
 * ```
 *
 * @param {any} a - First value to compare
 * @param {any} b - Second value to compare
 * @param {Object} [options={}] - Comparison options
 * @param {Function} [options.keyComparator] - Custom comparator function for object properties and array elements
 * @param {boolean} [options.ignoreArrayOrder=false] - If true, arrays are considered equal regardless of element order
 * @returns {boolean} true if values are deeply equal, false otherwise
 */

/**
 * Symbol used to mark objects with a conceptual identity that transcends reference equality.
 *
 * When two different object instances share the same SYMBOL_IDENTITY value, they are
 * considered equal by compareTwoJsValues without performing expensive deep comparison.
 *
 * This enables recognition of "the same logical object" even when:
 * - The object has been copied via spread operator: `{ ...obj, newProp }`
 * - The object has been reconstructed from serialization
 * - The object is a different instance but represents the same conceptual entity
 *
 * Use Symbol.for() to ensure the same symbol across different modules/contexts.
 */
const SYMBOL_IDENTITY = Symbol.for("navi_object_identity");

const compareTwoJsValues = (
  rootA,
  rootB,
  { keyComparator, ignoreArrayOrder = false } = {},
) => {
  const seenSet = new Set();
  const compare = (a, b) => {
    if (a === b) {
      return true;
    }
    const aIsIsTruthy = Boolean(a);
    const bIsTruthy = Boolean(b);
    if (aIsIsTruthy && !bIsTruthy) {
      return false;
    }
    if (!aIsIsTruthy && !bIsTruthy) {
      // null, undefined, 0, false, NaN
      if (isNaN(a) && isNaN(b)) {
        return true;
      }
      return a === b;
    }
    const aType = typeof a;
    const bType = typeof b;
    if (aType !== bType) {
      return false;
    }
    const aIsPrimitive =
      a === null || (aType !== "object" && aType !== "function");
    const bIsPrimitive =
      b === null || (bType !== "object" && bType !== "function");
    if (aIsPrimitive !== bIsPrimitive) {
      return false;
    }
    if (aIsPrimitive && bIsPrimitive) {
      return a === b;
    }
    if (seenSet.has(a)) {
      return false;
    }
    if (seenSet.has(b)) {
      return false;
    }
    seenSet.add(a);
    seenSet.add(b);
    const aIsArray = Array.isArray(a);
    const bIsArray = Array.isArray(b);
    if (aIsArray !== bIsArray) {
      return false;
    }
    if (aIsArray) {
      // compare arrays
      if (a.length !== b.length) {
        return false;
      }
      if (ignoreArrayOrder) {
        // Unordered array comparison: each element in 'a' must have a match in 'b'
        const usedIndices = new Set();
        for (let i = 0; i < a.length; i++) {
          const aValue = a[i];
          let foundMatch = false;

          for (let j = 0; j < b.length; j++) {
            if (usedIndices.has(j)) continue; // Already matched with another element

            const bValue = b[j];
            const comparator = keyComparator || compare;
            if (comparator(aValue, bValue, i, compare)) {
              foundMatch = true;
              usedIndices.add(j);
              break;
            }
          }

          if (!foundMatch) {
            return false;
          }
        }
        return true;
      }
      // Ordered array comparison (original behavior)
      let i = 0;
      while (i < a.length) {
        const aValue = a[i];
        const bValue = b[i];
        const comparator = keyComparator || compare;
        if (!comparator(aValue, bValue, i, compare)) {
          return false;
        }
        i++;
      }
      return true;
    }
    // compare objects
    const aIdentity = a[SYMBOL_IDENTITY];
    const bIdentity = b[SYMBOL_IDENTITY];
    if (
      aIdentity === bIdentity &&
      SYMBOL_IDENTITY in a &&
      SYMBOL_IDENTITY in b
    ) {
      return true;
    }
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.length !== bKeys.length) {
      return false;
    }
    for (const key of aKeys) {
      const aValue = a[key];
      const bValue = b[key];
      const comparator = keyComparator || compare;
      if (!comparator(aValue, bValue, key, compare)) {
        return false;
      }
    }
    return true;
  };
  return compare(rootA, rootB);
};

/**
 * jsenv/navi - createJsValueWeakMap
 *
 * Key/value cache with true ephemeron behavior and deep equality support.
 *
 * Features:
 * - Mutual retention: key keeps value alive, value keeps key alive
 * - Deep equality: different objects with same content are treated as identical keys
 * - Automatic GC: entries are eligible for collection when unreferenced
 * - Iteration support: can iterate over live entries for deep equality lookup
 *
 * Implementation:
 * - Dual WeakMap (key->value, value->key) provides ephemeron behavior
 * - WeakRef registry enables iteration without preventing GC
 * - Primitives stored in Map (permanent retention - avoid for keys)
 *
 * Use case: Action caching where params (key) and action (value) should have
 * synchronized lifetimes while allowing natural garbage collection.
 */


const createJsValueWeakMap = () => {
  // Core ephemeron maps for mutual retention
  const keyToValue = new WeakMap(); // key -> value
  const valueToKey = new WeakMap(); // value -> key

  // Registry for iteration/deep equality (holds WeakRefs)
  const keyRegistry = new Set(); // Set of WeakRef(key)

  // Primitive cache
  const primitiveCache = new Map();

  function cleanupKeyRegistry() {
    for (const keyRef of keyRegistry) {
      if (keyRef.deref() === undefined) {
        keyRegistry.delete(keyRef);
      }
    }
  }

  return {
    *[Symbol.iterator]() {
      cleanupKeyRegistry();
      for (const keyRef of keyRegistry) {
        const key = keyRef.deref();
        if (key && keyToValue.has(key)) {
          yield [key, keyToValue.get(key)];
        }
      }
      for (const [k, v] of primitiveCache) {
        yield [k, v];
      }
    },

    get(key) {
      const isObject =
        key && (typeof key === "object" || typeof key === "function");
      if (isObject) {
        // Fast path: exact key match
        if (keyToValue.has(key)) {
          return keyToValue.get(key);
        }

        // Slow path: deep equality search
        cleanupKeyRegistry();
        for (const keyRef of keyRegistry) {
          const existingKey = keyRef.deref();
          if (existingKey && compareTwoJsValues(existingKey, key)) {
            return keyToValue.get(existingKey);
          }
        }
        return undefined;
      }
      return primitiveCache.get(key);
    },

    set(key, value) {
      const isObject =
        key && (typeof key === "object" || typeof key === "function");
      if (isObject) {
        cleanupKeyRegistry();

        // Remove existing deep-equal key
        for (const keyRef of keyRegistry) {
          const existingKey = keyRef.deref();
          if (existingKey && compareTwoJsValues(existingKey, key)) {
            const existingValue = keyToValue.get(existingKey);
            keyToValue.delete(existingKey);
            valueToKey.delete(existingValue);
            keyRegistry.delete(keyRef);
            break;
          }
        }

        // Set ephemeron pair
        keyToValue.set(key, value);
        valueToKey.set(value, key);
        keyRegistry.add(new WeakRef(key));
      } else {
        primitiveCache.set(key, value);
      }
    },

    delete(key) {
      const isObject =
        key && (typeof key === "object" || typeof key === "function");
      if (isObject) {
        cleanupKeyRegistry();

        // Try exact match first
        if (keyToValue.has(key)) {
          const value = keyToValue.get(key);
          keyToValue.delete(key);
          valueToKey.delete(value);

          // Remove from registry
          for (const keyRef of keyRegistry) {
            if (keyRef.deref() === key) {
              keyRegistry.delete(keyRef);
              break;
            }
          }
          return true;
        }

        // Try deep equality
        for (const keyRef of keyRegistry) {
          const existingKey = keyRef.deref();
          if (existingKey && compareTwoJsValues(existingKey, key)) {
            const value = keyToValue.get(existingKey);
            keyToValue.delete(existingKey);
            valueToKey.delete(value);
            keyRegistry.delete(keyRef);
            return true;
          }
        }
        return false;
      }
      return primitiveCache.delete(key);
    },

    getStats: () => {
      cleanupKeyRegistry();
      const aliveKeys = Array.from(keyRegistry).filter((ref) =>
        ref.deref(),
      ).length;

      return {
        ephemeronPairs: {
          total: keyRegistry.size,
          alive: aliveKeys,
          note: "True ephemeron: key ↔ value mutual retention via dual WeakMap",
        },
        primitive: {
          total: primitiveCache.size,
          note: "Primitive keys never GC'd",
        },
      };
    },
  };
};

const MERGE_AS_PRIMITIVE_SYMBOL = Symbol("navi_merge_as_primitive");

const mergeTwoJsValues = (firstValue, secondValue) => {
  const firstIsPrimitive =
    firstValue === null ||
    typeof firstValue !== "object" ||
    MERGE_AS_PRIMITIVE_SYMBOL in firstValue;

  if (firstIsPrimitive) {
    return secondValue;
  }
  const secondIsPrimitive =
    secondValue === null ||
    typeof secondValue !== "object" ||
    MERGE_AS_PRIMITIVE_SYMBOL in secondValue;
  if (secondIsPrimitive) {
    return secondValue;
  }
  const objectMerge = {};
  const firstKeys = Object.keys(firstValue);
  const secondKeys = Object.keys(secondValue);
  let hasChanged = false;

  // First loop: check for keys in first object and recursively merge with second
  for (const key of firstKeys) {
    const firstValueForKey = firstValue[key];
    const secondHasKey = secondKeys.includes(key);

    if (secondHasKey) {
      const secondValueForKey = secondValue[key];
      const mergedValue = mergeTwoJsValues(firstValueForKey, secondValueForKey);
      objectMerge[key] = mergedValue;
      if (mergedValue !== firstValueForKey) {
        hasChanged = true;
      }
    } else {
      objectMerge[key] = firstValueForKey;
    }
  }

  for (const key of secondKeys) {
    if (firstKeys.includes(key)) {
      continue;
    }
    objectMerge[key] = secondValue[key];
    hasChanged = true;
  }

  if (!hasChanged) {
    return firstValue;
  }
  return objectMerge;
};

const MAX_ENTRIES = 5;

const stringifyForDisplay = (
  value,
  maxDepth = 2,
  currentDepth = 0,
  options = {},
) => {
  const { asFunctionArgs = false } = options;
  const indent = "  ".repeat(currentDepth);
  const nextIndent = "  ".repeat(currentDepth + 1);

  if (currentDepth >= maxDepth) {
    return typeof value === "object" && value !== null
      ? "[Object]"
      : String(value);
  }

  if (value === null) {
    return "null";
  }
  if (value === undefined) {
    return "undefined";
  }
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (value instanceof Date) {
    return `Date(${value.toISOString()})`;
  }
  if (value instanceof RegExp) {
    return value.toString();
  }

  if (Array.isArray(value)) {
    const openBracket = asFunctionArgs ? "(" : "[";
    const closeBracket = asFunctionArgs ? ")" : "]";

    if (value.length === 0) return `${openBracket}${closeBracket}`;

    // Display arrays with only one element on a single line
    if (value.length === 1) {
      const item = stringifyForDisplay(
        value[0],
        maxDepth,
        currentDepth + 1,
        // Remove asFunctionArgs for nested calls
        { ...options, asFunctionArgs: false },
      );
      return `${openBracket}${item}${closeBracket}`;
    }

    if (value.length > MAX_ENTRIES) {
      const preview = value
        .slice(0, MAX_ENTRIES)
        .map(
          (v) =>
            `${nextIndent}${stringifyForDisplay(v, maxDepth, currentDepth + 1, { ...options, asFunctionArgs: false })}`,
        );
      return `${openBracket}\n${preview.join(",\n")},\n${nextIndent}...${value.length - MAX_ENTRIES} more\n${indent}${closeBracket}`;
    }

    const items = value.map(
      (v) =>
        `${nextIndent}${stringifyForDisplay(v, maxDepth, currentDepth + 1, { ...options, asFunctionArgs: false })}`,
    );
    return `${openBracket}\n${items.join(",\n")}\n${indent}${closeBracket}`;
  }

  if (typeof value === "object") {
    const signalType = getSignalType(value);
    if (signalType) {
      const signalValue = value.peek();
      const prefix = signalType === "computed" ? "computed" : "signal";
      return `${prefix}(${stringifyForDisplay(signalValue, maxDepth, currentDepth, { ...options, asFunctionArgs: false })})`;
    }

    const entries = Object.entries(value);
    if (entries.length === 0) return "{}";

    // ✅ Inclure les clés avec valeurs undefined/null
    const allEntries = [];
    for (const [key, val] of entries) {
      allEntries.push([key, val]);
    }

    // Ajouter les clés avec undefined (que Object.entries omet)
    const descriptor = Object.getOwnPropertyDescriptors(value);
    for (const [key, desc] of Object.entries(descriptor)) {
      if (desc.value === undefined && !entries.some(([k]) => k === key)) {
        allEntries.push([key, undefined]);
      }
    }

    // Display objects with only one key on a single line
    if (allEntries.length === 1) {
      const [key, val] = allEntries[0];
      const valueStr = stringifyForDisplay(val, maxDepth, currentDepth + 1, {
        ...options,
        asFunctionArgs: false,
      });
      return `{ ${key}: ${valueStr} }`;
    }

    if (allEntries.length > MAX_ENTRIES) {
      const preview = allEntries
        .slice(0, MAX_ENTRIES)
        .map(
          ([k, v]) =>
            `${nextIndent}${k}: ${stringifyForDisplay(v, maxDepth, currentDepth + 1, { ...options, asFunctionArgs: false })}`,
        );
      return `{\n${preview.join(",\n")},\n${nextIndent}...${allEntries.length - MAX_ENTRIES} more\n${indent}}`;
    }

    const pairs = allEntries.map(
      ([k, v]) =>
        `${nextIndent}${k}: ${stringifyForDisplay(v, maxDepth, currentDepth + 1, { ...options, asFunctionArgs: false })}`,
    );
    return `{\n${pairs.join(",\n")}\n${indent}}`;
  }

  return String(value);
};

/**
 * Creates an effect that uses WeakRef to prevent garbage collection of referenced values.
 *
 * This utility is useful when you want to create reactive effects that watch objects
 * without preventing those objects from being garbage collected. If any of the referenced
 * values is collected, the effect automatically disposes itself.
 *
 * @param {Array} values - Array of values to create weak references for
 * @param {Function} callback - Function to call when the effect runs, receives dereferenced values as arguments
 * @returns {Function} dispose - Function to manually dispose the effect
 *
 * @example
 * ```js
 * const objectA = { name: "A" };
 * const objectB = { name: "B" };
 * const prefixSignal = signal('demo');
 *
 * const dispose = weakEffect([objectA, objectB], (a, b) => {
 *   const prefix = prefixSignal.value
 *   console.log(prefix, a.name, b.name);
 * });
 *
 * // Effect will auto-dispose if objectA or objectB where garbage collected
 * // or can be manually disposed:
 * dispose();
 * ```
 */
const weakEffect = (values, callback) => {
  const weakRefSet = new Set();
  for (const value of values) {
    weakRefSet.add(new WeakRef(value));
  }
  const dispose = effect(() => {
    const values = [];
    for (const weakRef of weakRefSet) {
      const value = weakRef.deref();
      if (value === undefined) {
        dispose();
        return;
      }
      values.push(value);
    }
    callback(...values);
  });
  return dispose;
};

const SYMBOL_OBJECT_SIGNAL = Symbol.for("navi_object_signal");

let DEBUG$3 = false;
const enableDebugActions = () => {
  DEBUG$3 = true;
};

let dispatchActions = (params) => {
  const { requestedResult } = updateActions({
    globalAbortSignal: new AbortController().signal,
    abortSignal: new AbortController().signal,
    ...params,
  });
  return requestedResult;
};

const dispatchSingleAction = (action, method, options) => {
  const requestedResult = dispatchActions({
    prerunSet: method === "prerun" ? new Set([action]) : undefined,
    runSet: method === "run" ? new Set([action]) : undefined,
    rerunSet: method === "rerun" ? new Set([action]) : undefined,
    resetSet: method === "reset" ? new Set([action]) : undefined,
    ...options,
  });
  if (requestedResult && typeof requestedResult.then === "function") {
    return requestedResult.then((resolvedResult) =>
      resolvedResult ? resolvedResult[0] : undefined,
    );
  }
  return requestedResult ? requestedResult[0] : undefined;
};
const setActionDispatcher = (value) => {
  dispatchActions = value;
};

const getActionDispatcher = () => dispatchActions;

const rerunActions = async (
  actionSet,
  { reason = "rerunActions was called" } = {},
) => {
  return dispatchActions({
    rerunSet: actionSet,
    reason,
  });
};

/**
 * Registry that prevents prerun actions from being garbage collected.
 *
 * When an action is prerun, it might not have any active references yet
 * (e.g., the component that will use it hasn't loaded yet due to dynamic imports).
 * This registry keeps a reference to prerun actions for a configurable duration
 * to ensure they remain available when needed.
 *
 * Actions are automatically unprotected when:
 * - The protection duration expires (default: 5 minutes)
 * - The action is explicitly stopped via .stop()
 */
const prerunProtectionRegistry = (() => {
  const protectedActionMap = new Map(); // action -> { timeoutId, timestamp }
  const PROTECTION_DURATION = 5 * 60 * 1000; // 5 minutes en millisecondes

  const unprotect = (action) => {
    const protection = protectedActionMap.get(action);
    if (protection) {
      clearTimeout(protection.timeoutId);
      protectedActionMap.delete(action);
      if (DEBUG$3) {
        const elapsed = Date.now() - protection.timestamp;
        console.debug(`"${action}": GC protection removed after ${elapsed}ms`);
      }
    }
  };

  return {
    protect(action) {
      // Si déjà protégée, étendre la protection
      if (protectedActionMap.has(action)) {
        const existing = protectedActionMap.get(action);
        clearTimeout(existing.timeoutId);
      }

      const timestamp = Date.now();
      const timeoutId = setTimeout(() => {
        unprotect(action);
        if (DEBUG$3) {
          console.debug(
            `"${action}": prerun protection expired after ${PROTECTION_DURATION}ms`,
          );
        }
      }, PROTECTION_DURATION);

      protectedActionMap.set(action, { timeoutId, timestamp });

      if (DEBUG$3) {
        console.debug(
          `"${action}": protected from GC for ${PROTECTION_DURATION}ms`,
        );
      }
    },

    unprotect,

    isProtected(action) {
      return protectedActionMap.has(action);
    },

    // Pour debugging
    getProtectedActions() {
      return Array.from(protectedActionMap.keys());
    },

    // Nettoyage manuel si nécessaire
    clear() {
      for (const [, protection] of protectedActionMap) {
        clearTimeout(protection.timeoutId);
      }
      protectedActionMap.clear();
    },
  };
})();

const formatActionSet = (actionSet, prefix = "") => {
  let message = "";
  message += `${prefix}`;
  for (const action of actionSet) {
    message += "\n";
    message += prefixFirstAndIndentRemainingLines(String(action), {
      prefix: "  -",
    });
  }
  return message;
};

const actionAbortMap = new Map();
const actionPromiseMap = new Map();
const activationWeakSet = createIterableWeakSet("activation");

const getActivationInfo = () => {
  const runningSet = new Set();
  const settledSet = new Set();

  for (const action of activationWeakSet) {
    const privateProps = getActionPrivateProperties(action);
    const runningState = privateProps.runningStateSignal.peek();

    if (runningState === RUNNING) {
      runningSet.add(action);
    } else if (
      runningState === COMPLETED ||
      runningState === FAILED ||
      runningState === ABORTED
    ) {
      settledSet.add(action);
    } else {
      throw new Error(
        `An action in the activation weak set must be RUNNING, ABORTED, FAILED or COMPLETED, found "${runningState.id}" for action "${action}"`,
      );
    }
  }

  return {
    runningSet,
    settledSet,
  };
};

const updateActions = ({
  globalAbortSignal,
  abortSignal,
  isReplace = false,
  reason,
  prerunSet = new Set(),
  runSet = new Set(),
  rerunSet = new Set(),
  resetSet = new Set(),
  abortSignalMap = new Map(),
  onComplete,
  onAbort,
  onError,
} = {}) => {
  /*
   * Action update flow:
   *
   * Input: 4 sets of requested operations
   * - prerunSet: actions to prerun (background, low priority)
   * - runSet: actions to run (user-visible, medium priority)
   * - rerunSet: actions to force rerun (highest priority)
   * - resetSet: actions to reset/clear
   *
   * Priority resolution:
   * - reset always wins (explicit cleanup)
   * - rerun > run > prerun (rerun forces refresh even if already running)
   * - An action in multiple sets triggers warnings in dev mode
   *
   * Output: Internal operation sets that track what will actually happen
   * - willResetSet: actions that will be reset/cleared
   * - willPrerunSet: actions that will be prerun
   * - willRunSet: actions that will be run
   * - willPromoteSet: prerun actions that become run-requested
   * - stays*Set: actions that remain in their current state
   */

  const { runningSet, settledSet } = getActivationInfo();

  if (DEBUG$3) {
    let argSource = `reason: \`${reason}\``;
    if (isReplace) {
      argSource += `, isReplace: true`;
    }
    console.group(`updateActions({ ${argSource} })`);
    const lines = [
      ...(prerunSet.size ? [formatActionSet(prerunSet, "- prerun:")] : []),
      ...(runSet.size ? [formatActionSet(runSet, "- run:")] : []),
      ...(rerunSet.size ? [formatActionSet(rerunSet, "- rerun:")] : []),
      ...(resetSet.size ? [formatActionSet(resetSet, "- reset:")] : []),
    ];
    console.debug(
      `requested operations:
${lines.join("\n")}`,
    );
  }

  // Internal sets that track what operations will actually be performed
  const willResetSet = new Set();
  const willPrerunSet = new Set();
  const willRunSet = new Set();
  const willPromoteSet = new Set(); // prerun -> run requested
  const staysRunningSet = new Set();
  const staysAbortedSet = new Set();
  const staysFailedSet = new Set();
  const staysCompletedSet = new Set();

  // Step 1: Determine which actions will be reset
  {
    for (const actionToReset of resetSet) {
      if (actionToReset.runningState !== IDLE) {
        willResetSet.add(actionToReset);
      }
    }
  }

  // Step 2: Process prerun, run, and rerun sets
  {
    const handleActionRequest = (
      action,
      requestType, // "prerun", "run", or "rerun"
    ) => {
      const isPrerun = requestType === "prerun";
      const isRerun = requestType === "rerun";

      if (
        action.runningState === RUNNING ||
        action.runningState === COMPLETED
      ) {
        // Action is already running/completed
        // By default, we don't interfere with already active actions
        // Unless it's a rerun or the action is also being reset
        if (isRerun || willResetSet.has(action)) {
          // Force reset first, then rerun/run
          willResetSet.add(action);
          if (isPrerun) {
            willPrerunSet.add(action);
          } else {
            willRunSet.add(action);
          }
        }
        // Otherwise, ignore the request (action stays as-is)
      } else if (isPrerun) {
        willPrerunSet.add(action);
      } else {
        willRunSet.add(action);
      }
    };

    // Process prerunSet (lowest priority)
    for (const actionToPrerun of prerunSet) {
      if (runSet.has(actionToPrerun) || rerunSet.has(actionToPrerun)) {
        // run/rerun wins over prerun - skip prerun
        continue;
      }
      handleActionRequest(actionToPrerun, "prerun");
    }

    // Process runSet (medium priority)
    for (const actionToRun of runSet) {
      if (rerunSet.has(actionToRun)) {
        // rerun wins over run - skip run
        continue;
      }
      if (actionToRun.isPrerun && actionToRun.runningState !== IDLE) {
        // Special case: action was prerun but not yet requested to run
        // Just promote it to "run requested" without rerunning
        willPromoteSet.add(actionToRun);
        continue;
      }
      handleActionRequest(actionToRun, "run");
    }

    // Process rerunSet (highest priority)
    for (const actionToRerun of rerunSet) {
      handleActionRequest(actionToRerun, "rerun");
    }
  }
  const allThenableArray = [];

  // Step 3: Determine which actions will stay in their current state
  {
    for (const actionRunning of runningSet) {
      if (willResetSet.has(actionRunning)) ; else if (
        willRunSet.has(actionRunning) ||
        willPrerunSet.has(actionRunning)
      ) ; else {
        // an action that was running and not affected by this update
        const actionPromise = actionPromiseMap.get(actionRunning);
        allThenableArray.push(actionPromise);
        staysRunningSet.add(actionRunning);
      }
    }
    for (const actionSettled of settledSet) {
      if (willResetSet.has(actionSettled)) ; else if (actionSettled.runningState === ABORTED) {
        staysAbortedSet.add(actionSettled);
      } else if (actionSettled.runningState === FAILED) {
        staysFailedSet.add(actionSettled);
      } else {
        staysCompletedSet.add(actionSettled);
      }
    }
  }
  if (DEBUG$3) {
    const lines = [
      ...(willResetSet.size
        ? [formatActionSet(willResetSet, "- will reset:")]
        : []),
      ...(willPrerunSet.size
        ? [formatActionSet(willPrerunSet, "- will prerun:")]
        : []),
      ...(willPromoteSet.size
        ? [formatActionSet(willPromoteSet, "- will promote:")]
        : []),
      ...(willRunSet.size ? [formatActionSet(willRunSet, "- will run:")] : []),
      ...(staysRunningSet.size
        ? [formatActionSet(staysRunningSet, "- stays running:")]
        : []),
      ...(staysAbortedSet.size
        ? [formatActionSet(staysAbortedSet, "- stays aborted:")]
        : []),
      ...(staysFailedSet.size
        ? [formatActionSet(staysFailedSet, "- stays failed:")]
        : []),
      ...(staysCompletedSet.size
        ? [formatActionSet(staysCompletedSet, "- stays completed:")]
        : []),
    ];
    console.debug(`operations that will be performed:
${lines.join("\n")}`);
  }

  // Step 4: Execute resets
  {
    for (const actionToReset of willResetSet) {
      const actionToResetPrivateProperties =
        getActionPrivateProperties(actionToReset);
      actionToResetPrivateProperties.performStop({ reason });
      activationWeakSet.delete(actionToReset);
    }
  }

  const resultArray = []; // Store results with their execution order
  let hasAsync = false;

  // Step 5: Execute preruns and runs
  {
    const onActionToRunOrPrerun = (actionToPrerunOrRun, isPrerun) => {
      const actionSpecificSignal = abortSignalMap.get(actionToPrerunOrRun);
      const effectiveSignal = actionSpecificSignal || abortSignal;

      const actionToRunPrivateProperties =
        getActionPrivateProperties(actionToPrerunOrRun);
      const performRunResult = actionToRunPrivateProperties.performRun({
        globalAbortSignal,
        abortSignal: effectiveSignal,
        reason,
        isPrerun,
        onComplete,
        onAbort,
        onError,
      });
      activationWeakSet.add(actionToPrerunOrRun);

      if (performRunResult && typeof performRunResult.then === "function") {
        actionPromiseMap.set(actionToPrerunOrRun, performRunResult);
        allThenableArray.push(performRunResult);
        hasAsync = true;
        // Store async result with order info
        resultArray.push({
          type: "async",
          promise: performRunResult,
        });
      } else {
        // Store sync result with order info
        resultArray.push({
          type: "sync",
          result: performRunResult,
        });
      }
    };

    // Execute preruns
    for (const actionToPrerun of willPrerunSet) {
      onActionToRunOrPrerun(actionToPrerun, true);
    }

    // Execute runs
    for (const actionToRun of willRunSet) {
      onActionToRunOrPrerun(actionToRun, false);
    }

    // Execute promotions (prerun -> run requested)
    for (const actionToPromote of willPromoteSet) {
      const actionToPromotePrivateProperties =
        getActionPrivateProperties(actionToPromote);
      actionToPromotePrivateProperties.isPrerunSignal.value = false;
    }
  }
  if (DEBUG$3) {
    console.groupEnd();
  }

  // Calculate requestedResult based on the execution results
  let requestedResult;
  if (resultArray.length === 0) {
    requestedResult = null;
  } else if (hasAsync) {
    requestedResult = Promise.all(
      resultArray.map((item) =>
        item.type === "sync" ? item.result : item.promise,
      ),
    );
  } else {
    requestedResult = resultArray.map((item) => item.result);
  }

  const allResult = allThenableArray.length
    ? Promise.allSettled(allThenableArray)
    : null;
  const runningActionSet = new Set([...willPrerunSet, ...willRunSet]);
  return {
    requestedResult,
    allResult,
    runningActionSet,
  };
};

const NO_PARAMS = {};
const initialParamsDefault = NO_PARAMS;

const actionWeakMap = new WeakMap();
const createAction = (callback, rootOptions = {}) => {
  const existing = actionWeakMap.get(callback);
  if (existing) {
    return existing;
  }

  let rootAction;

  const createActionCore = (options, { parentAction } = {}) => {
    let {
      name = callback.name || "anonymous",
      params,
      isPrerun = true,
      runningState = IDLE,
      aborted = false,
      error = null,
      data,
      computedData,
      compute,
      completed = false,
      renderLoadedAsync,
      sideEffect = () => {},
      keepOldData = false,
      meta = {},
      dataEffect,
      completeSideEffect,
    } = options;
    if (!Object.hasOwn(options, "params")) {
      // even undefined should be respect it's only when not provided at all we use default
      params = initialParamsDefault;
    }

    const initialData = data;
    const paramsSignal = signal(params);
    const isPrerunSignal = signal(isPrerun);
    const runningStateSignal = signal(runningState);
    const errorSignal = signal(error);
    const dataSignal = signal(initialData);
    const computedDataSignal = compute
      ? computed(() => {
          const data = dataSignal.value;
          return compute(data);
        })
      : dataSignal;
    computedData =
      computedData === undefined
        ? compute
          ? compute(data)
          : data
        : computedData;

    const prerun = (options) => {
      return dispatchSingleAction(action, "prerun", options);
    };
    const run = (options) => {
      return dispatchSingleAction(action, "run", options);
    };
    const rerun = (options) => {
      return dispatchSingleAction(action, "rerun", options);
    };
    /**
     * Stop the action completely - this will:
     * 1. Abort the action if it's currently running
     * 2. Reset the action to IDLE state
     * 3. Clean up any resources and side effects
     * 4. Reset data to initial value (unless keepOldData is true)
     */
    const stop = (options) => {
      return dispatchSingleAction(action, "stop", options);
    };
    const abort = (reason) => {
      if (runningState !== RUNNING) {
        return false;
      }
      const actionAbort = actionAbortMap.get(action);
      if (!actionAbort) {
        return false;
      }
      if (DEBUG$3) {
        console.log(`"${action}": aborting (reason: ${reason})`);
      }
      actionAbort(reason);
      return true;
    };

    let action;

    const childActionWeakSet = createIterableWeakSet("child_action");
    /*
     * Ephemeron behavior is critical here: actions must keep params alive.
     * Without this, bindParams(params) could create a new action while code
     * still references the old action with GC'd params. This would cause:
     * - Duplicate actions in activationWeakSet (old + new)
     * - Cache misses when looking up existing actions
     * - Subtle bugs where different parts of code use different action instances
     * The ephemeron pattern ensures params and actions have synchronized lifetimes.
     */
    const childActionWeakMap = createJsValueWeakMap();
    const _bindParams = (newParamsOrSignal, options = {}) => {
      // ✅ CAS 1: Signal direct -> proxy
      if (isSignal(newParamsOrSignal)) {
        const combinedParamsSignal = computed(() => {
          const newParams = newParamsOrSignal.value;
          const result = mergeTwoJsValues(params, newParams);
          return result;
        });
        return createActionProxyFromSignal(
          action,
          combinedParamsSignal,
          options,
        );
      }

      // ✅ CAS 2: Objet -> vérifier s'il contient des signals
      if (newParamsOrSignal && typeof newParamsOrSignal === "object") {
        const staticParams = {};
        const signalMap = new Map();

        const keyArray = Object.keys(newParamsOrSignal);
        for (const key of keyArray) {
          const value = newParamsOrSignal[key];
          if (isSignal(value)) {
            signalMap.set(key, value);
          } else {
            const objectSignal = value ? value[SYMBOL_OBJECT_SIGNAL] : null;
            if (objectSignal) {
              signalMap.set(key, objectSignal);
            } else {
              staticParams[key] = value;
            }
          }
        }

        if (signalMap.size === 0) {
          // Pas de signals, merge statique normal
          if (params === null || typeof params !== "object") {
            return createChildAction({
              ...options,
              params: newParamsOrSignal,
            });
          }
          const combinedParams = mergeTwoJsValues(params, newParamsOrSignal);
          return createChildAction({
            ...options,
            params: combinedParams,
          });
        }

        // Combiner avec les params existants pour les valeurs statiques
        const paramsSignal = computed(() => {
          const params = {};
          for (const key of keyArray) {
            const signalForThisKey = signalMap.get(key);
            if (signalForThisKey) {
              params[key] = signalForThisKey.value;
            } else {
              params[key] = staticParams[key];
            }
          }
          return params;
        });
        return createActionProxyFromSignal(action, paramsSignal, options);
      }

      // ✅ CAS 3: Primitive -> action enfant
      return createChildAction({
        params: newParamsOrSignal,
        ...options,
      });
    };
    const bindParams = (newParamsOrSignal, options = {}) => {
      const existingChildAction = childActionWeakMap.get(newParamsOrSignal);
      if (existingChildAction) {
        return existingChildAction;
      }
      const childAction = _bindParams(newParamsOrSignal, options);
      childActionWeakMap.set(newParamsOrSignal, childAction);
      childActionWeakSet.add(childAction);

      return childAction;
    };

    const createChildAction = (childOptions) => {
      const childActionOptions = {
        ...rootOptions,
        ...childOptions,
        meta: {
          ...rootOptions.meta,
          ...childOptions.meta,
        },
      };
      const childAction = createActionCore(childActionOptions, {
        parentAction: action,
      });
      return childAction;
    };

    // ✅ Implement matchAllSelfOrDescendant
    const matchAllSelfOrDescendant = (predicate, { includeProxies } = {}) => {
      const matches = [];

      const traverse = (currentAction) => {
        if (currentAction.isProxy && !includeProxies) {
          // proxy action should be ignored because the underlying action will be found anyway
          // and if we check the proxy action we'll end up with duplicates
          // (loading the proxy would load the action it proxies)
          // and as they are 2 different objects they would be added to the set
          return;
        }

        if (predicate(currentAction)) {
          matches.push(currentAction);
        }

        // Get child actions from the current action
        const currentActionPrivateProps =
          getActionPrivateProperties(currentAction);
        const childActionWeakSet = currentActionPrivateProps.childActionWeakSet;
        for (const childAction of childActionWeakSet) {
          traverse(childAction);
        }
      };

      traverse(action);
      return matches;
    };

    name = generateActionName(name, params);
    {
      // Create the action as a function that can be called directly
      action = function actionFunction(params) {
        const boundAction = bindParams(params);
        return boundAction.rerun();
      };
      Object.defineProperty(action, "name", {
        configurable: true,
        writable: true,
        value: name,
      });
    }

    // Assign all the action properties and methods to the function
    Object.assign(action, {
      isAction: true,
      callback,
      rootAction,
      parentAction,
      params,
      isPrerun,
      runningState,
      aborted,
      error,
      data,
      computedData,
      completed,
      prerun,
      run,
      rerun,
      stop,
      abort,
      bindParams,
      matchAllSelfOrDescendant, // ✅ Add the new method
      replaceParams: (newParams) => {
        const currentParams = paramsSignal.value;
        const nextParams = mergeTwoJsValues(currentParams, newParams);
        if (nextParams === currentParams) {
          return false;
        }

        // Update the weak map BEFORE updating the signal
        // so that any code triggered by the signal update finds this action
        if (parentAction) {
          const parentActionPrivateProps =
            getActionPrivateProperties(parentAction);
          const parentChildActionWeakMap =
            parentActionPrivateProps.childActionWeakMap;
          parentChildActionWeakMap.delete(currentParams);
          parentChildActionWeakMap.set(nextParams, action);
        }

        params = nextParams;
        action.params = nextParams;
        action.name = generateActionName(name, nextParams);
        paramsSignal.value = nextParams;
        return true;
      },
      toString: () => action.name,
      meta,
    });
    Object.preventExtensions(action);

    // Effects pour synchroniser les propriétés
    {
      weakEffect([action], (actionRef) => {
        isPrerun = isPrerunSignal.value;
        actionRef.isPrerun = isPrerun;
      });
      weakEffect([action], (actionRef) => {
        runningState = runningStateSignal.value;
        actionRef.runningState = runningState;
        aborted = runningState === ABORTED;
        actionRef.aborted = aborted;
        completed = runningState === COMPLETED;
        actionRef.completed = completed;
      });
      weakEffect([action], (actionRef) => {
        error = errorSignal.value;
        actionRef.error = error;
      });
      weakEffect([action], (actionRef) => {
        data = dataSignal.value;
        computedData = computedDataSignal.value;
        actionRef.data = data;
        actionRef.computedData = computedData;
      });
    }

    // Propriétés privées
    {
      const ui = {
        renderLoaded: null,
        renderLoadedAsync,
        hasRenderers: false, // Flag to track if action is bound to UI components
      };
      let sideEffectCleanup;

      const performRun = (runParams) => {
        const {
          globalAbortSignal,
          abortSignal,
          reason,
          isPrerun,
          onComplete,
          onAbort,
          onError,
        } = runParams;

        if (isPrerun) {
          prerunProtectionRegistry.protect(action);
        }

        const internalAbortController = new AbortController();
        const internalAbortSignal = internalAbortController.signal;
        const abort = (abortReason) => {
          runningStateSignal.value = ABORTED;
          internalAbortController.abort(abortReason);
          actionAbortMap.delete(action);
          if (isPrerun && (globalAbortSignal.aborted || abortSignal.aborted)) {
            prerunProtectionRegistry.unprotect(action);
          }
          if (DEBUG$3) {
            console.log(`"${action}": aborted (reason: ${abortReason})`);
          }
        };

        const onAbortFromSpecific = () => {
          abort(abortSignal.reason);
        };
        const onAbortFromGlobal = () => {
          abort(globalAbortSignal.reason);
        };

        if (abortSignal) {
          abortSignal.addEventListener("abort", onAbortFromSpecific);
        }
        if (globalAbortSignal) {
          globalAbortSignal.addEventListener("abort", onAbortFromGlobal);
        }

        actionAbortMap.set(action, abort);

        batch(() => {
          errorSignal.value = null;
          runningStateSignal.value = RUNNING;
          if (!isPrerun) {
            isPrerunSignal.value = false;
          }
        });

        const args = [];
        args.push(params);
        args.push({ signal: internalAbortSignal, reason, isPrerun });
        const returnValue = sideEffect(...args);
        if (typeof returnValue === "function") {
          sideEffectCleanup = returnValue;
        }

        let runResult;
        let rejected = false;
        let rejectedValue;
        const onRunEnd = () => {
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbortFromSpecific);
          }
          if (globalAbortSignal) {
            globalAbortSignal.removeEventListener("abort", onAbortFromGlobal);
          }
          prerunProtectionRegistry.unprotect(action);
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          /*
           * Critical: dataEffect, onComplete and completeSideEffect must be batched together to prevent
           * UI inconsistencies. The dataEffect might modify shared state (e.g.,
           * deleting items from a store), and onLoad callbacks might trigger
           * dependent action state changes.
           *
           * Without batching, the UI could render with partially updated state:
           * - dataEffect deletes a resource from the store
           * - UI renders immediately and tries to display the deleted resource
           * - onLoad hasn't yet updated dependent actions to loading state
           *
           * Example: When deleting a resource, we need to both update the store
           * AND put the action that loaded that resource back into loading state
           * before the UI attempts to render the now-missing resource.
           */
          batch(() => {
            dataSignal.value = dataEffect
              ? dataEffect(runResult, action)
              : runResult;
            runningStateSignal.value = COMPLETED;
            onComplete?.(computedDataSignal.peek(), action);
            completeSideEffect?.(action);
          });
          if (DEBUG$3) {
            console.log(`"${action}": completed`);
          }
          return computedDataSignal.peek();
        };
        const onRunError = (e) => {
          if (abortSignal) {
            abortSignal.removeEventListener("abort", onAbortFromSpecific);
          }
          if (globalAbortSignal) {
            globalAbortSignal.removeEventListener("abort", onAbortFromGlobal);
          }
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          if (internalAbortSignal.aborted && e === internalAbortSignal.reason) {
            runningStateSignal.value = ABORTED;
            if (isPrerun && abortSignal.aborted) {
              prerunProtectionRegistry.unprotect(action);
            }
            onAbort(e, action);
            return e;
          }
          if (e.name === "AbortError") {
            throw new Error(
              "never supposed to happen, abort error should be handled by the abort signal",
            );
          }
          if (DEBUG$3) {
            console.log(
              `"${action}": failed (error: ${e}, handled by ui: ${ui.hasRenderers})`,
            );
          }
          batch(() => {
            errorSignal.value = e;
            runningStateSignal.value = FAILED;
            onError?.(e, action);
          });

          if (ui.hasRenderers || onError) {
            console.error(e);
            // For UI-bound actions: error is properly handled by logging + UI display
            // Return error instead of throwing to signal it's handled and prevent:
            // - jsenv error overlay from appearing
            // - error being treated as unhandled by runtime
            return e;
          }
          throw e;
        };

        try {
          const thenableArray = [];
          const callbackResult = callback(...args);
          if (callbackResult && typeof callbackResult.then === "function") {
            thenableArray.push(
              callbackResult.then(
                (value) => {
                  runResult = value;
                },
                (e) => {
                  rejected = true;
                  rejectedValue = e;
                },
              ),
            );
          } else {
            runResult = callbackResult;
          }
          if (ui.renderLoadedAsync && !ui.renderLoaded) {
            const renderLoadedPromise = ui.renderLoadedAsync(...args).then(
              (renderLoaded) => {
                ui.renderLoaded = renderLoaded;
              },
              (e) => {
                if (!rejected) {
                  rejected = true;
                  rejectedValue = e;
                }
              },
            );
            thenableArray.push(renderLoadedPromise);
          }
          if (thenableArray.length === 0) {
            return onRunEnd();
          }
          return Promise.all(thenableArray).then(() => {
            if (rejected) {
              return onRunError(rejectedValue);
            }
            return onRunEnd();
          });
        } catch (e) {
          return onRunError(e);
        }
      };

      const performStop = ({ reason }) => {
        abort(reason);
        if (DEBUG$3) {
          console.log(`"${action}": stopping (reason: ${reason})`);
        }

        prerunProtectionRegistry.unprotect(action);

        if (sideEffectCleanup) {
          sideEffectCleanup(reason);
          sideEffectCleanup = undefined;
        }

        actionPromiseMap.delete(action);
        batch(() => {
          errorSignal.value = null;
          if (!keepOldData) {
            dataSignal.value = initialData;
          }
          isPrerunSignal.value = true;
          runningStateSignal.value = IDLE;
        });
      };

      const privateProperties = {
        initialData,

        paramsSignal,
        runningStateSignal,
        isPrerunSignal,
        dataSignal,
        computedDataSignal,
        errorSignal,

        performRun,
        performStop,
        ui,

        childActionWeakSet,
        childActionWeakMap,
      };
      setActionPrivateProperties(action, privateProperties);
    }

    return action;
  };

  rootAction = createActionCore(rootOptions);
  actionWeakMap.set(callback, rootAction);
  return rootAction;
};

const createActionProxyFromSignal = (
  action,
  paramsSignal,
  { rerunOnChange = false, onChange } = {},
) => {
  const actionTargetChangeCallbackSet = new Set();
  const onActionTargetChange = (callback) => {
    actionTargetChangeCallbackSet.add(callback);
    return () => {
      actionTargetChangeCallbackSet.delete(callback);
    };
  };
  const changeCleanupCallbackSet = new Set();
  const triggerTargetChange = (actionTarget, previousTarget) => {
    for (const changeCleanupCallback of changeCleanupCallbackSet) {
      changeCleanupCallback();
    }
    changeCleanupCallbackSet.clear();
    for (const callback of actionTargetChangeCallbackSet) {
      const returnValue = callback(actionTarget, previousTarget);
      if (typeof returnValue === "function") {
        changeCleanupCallbackSet.add(returnValue);
      }
    }
  };

  let actionTarget = null;
  let currentAction = action;
  let currentActionPrivateProperties = getActionPrivateProperties(action);
  let actionTargetPreviousWeakRef = null;

  const _updateTarget = (params) => {
    const previousActionTarget = actionTargetPreviousWeakRef?.deref();

    if (params === NO_PARAMS) {
      actionTarget = null;
      currentAction = action;
      currentActionPrivateProperties = getActionPrivateProperties(action);
    } else {
      actionTarget = action.bindParams(params);
      if (previousActionTarget === actionTarget) {
        return;
      }
      currentAction = actionTarget;
      currentActionPrivateProperties = getActionPrivateProperties(actionTarget);
    }
    actionTargetPreviousWeakRef = actionTarget
      ? new WeakRef(actionTarget)
      : null;
    triggerTargetChange(actionTarget, previousActionTarget);
  };

  const proxyMethod = (method) => {
    return (...args) => {
      /*
       * Ensure the proxy targets the correct action before method execution.
       * This prevents race conditions where external effects run before our
       * internal parameter synchronization effect. Using peek() avoids creating
       * reactive dependencies within this pass-through method.
       */
      _updateTarget(proxyParamsSignal.peek());
      return currentAction[method](...args);
    };
  };

  const nameSignal = signal();
  let actionProxy;
  {
    actionProxy = function actionProxyFunction() {
      return actionProxy.rerun();
    };
    Object.defineProperty(actionProxy, "name", {
      configurable: true,
      get() {
        return nameSignal.value;
      },
    });
  }
  Object.assign(actionProxy, {
    isProxy: true,
    callback: undefined,
    params: undefined,
    isPrerun: undefined,
    runningState: undefined,
    aborted: undefined,
    error: undefined,
    data: undefined,
    computedData: undefined,
    completed: undefined,
    prerun: proxyMethod("prerun"),
    run: proxyMethod("run"),
    rerun: proxyMethod("rerun"),
    stop: proxyMethod("stop"),
    abort: proxyMethod("abort"),
    matchAllSelfOrDescendant: proxyMethod("matchAllSelfOrDescendant"),
    getCurrentAction: () => {
      _updateTarget(proxyParamsSignal.peek());
      return currentAction;
    },
    bindParams: () => {
      throw new Error(
        `bindParams() is not supported on action proxies, use the underlying action instead`,
      );
    },
    replaceParams: null, // Will be set below
    toString: () => actionProxy.name,
    meta: {},
  });
  Object.preventExtensions(actionProxy);

  onActionTargetChange((actionTarget) => {
    const currentAction = actionTarget || action;
    nameSignal.value = `[Proxy] ${currentAction.name}`;
    actionProxy.callback = currentAction.callback;
    actionProxy.params = currentAction.params;
    actionProxy.isPrerun = currentAction.isPrerun;
    actionProxy.runningState = currentAction.runningState;
    actionProxy.aborted = currentAction.aborted;
    actionProxy.error = currentAction.error;
    actionProxy.data = currentAction.data;
    actionProxy.computedData = currentAction.computedData;
    actionProxy.completed = currentAction.completed;
  });

  const proxyPrivateSignal = (signalPropertyName, propertyName) => {
    const signalProxy = signal();
    let dispose;
    onActionTargetChange(() => {
      if (dispose) {
        dispose();
        dispose = undefined;
      }
      dispose = effect(() => {
        const currentActionSignal =
          currentActionPrivateProperties[signalPropertyName];
        const currentActionSignalValue = currentActionSignal.value;
        signalProxy.value = currentActionSignalValue;
        if (propertyName) {
          actionProxy[propertyName] = currentActionSignalValue;
        }
      });
      return dispose;
    });
    return signalProxy;
  };
  const proxyPrivateMethod = (method) => {
    return (...args) => currentActionPrivateProperties[method](...args);
  };

  // Create our own signal for params that we control completely
  const proxyParamsSignal = signal(paramsSignal.value);

  // Watch for changes in the original paramsSignal and update ours
  // (original signal wins over any replaceParams calls)
  weakEffect(
    [paramsSignal, proxyParamsSignal],
    (paramsSignalRef, proxyParamsSignalRef) => {
      proxyParamsSignalRef.value = paramsSignalRef.value;
    },
  );

  const proxyPrivateProperties = {
    get currentAction() {
      return currentAction;
    },
    paramsSignal: proxyParamsSignal,
    isPrerunSignal: proxyPrivateSignal("isPrerunSignal", "isPrerun"),
    runningStateSignal: proxyPrivateSignal(
      "runningStateSignal",
      "runningState",
    ),
    errorSignal: proxyPrivateSignal("errorSignal", "error"),
    dataSignal: proxyPrivateSignal("dataSignal", "data"),
    computedDataSignal: proxyPrivateSignal("computedDataSignal"),
    performRun: proxyPrivateMethod("performRun"),
    performStop: proxyPrivateMethod("performStop"),
    ui: currentActionPrivateProperties.ui,
  };

  onActionTargetChange((actionTarget, previousTarget) => {
    proxyPrivateProperties.ui = currentActionPrivateProperties.ui;
    if (previousTarget && actionTarget) {
      const previousPrivateProps = getActionPrivateProperties(previousTarget);
      if (previousPrivateProps.ui.hasRenderers) {
        const newPrivateProps = getActionPrivateProperties(actionTarget);
        newPrivateProps.ui.hasRenderers = true;
      }
    }
    proxyPrivateProperties.childActionWeakSet =
      currentActionPrivateProperties.childActionWeakSet;
  });
  setActionPrivateProperties(actionProxy, proxyPrivateProperties);

  {
    weakEffect([action], () => {
      const params = proxyParamsSignal.value;
      _updateTarget(params);
    });
  }

  actionProxy.replaceParams = (newParams) => {
    if (currentAction === action) {
      const currentParams = proxyParamsSignal.value;
      const nextParams = mergeTwoJsValues(currentParams, newParams);
      if (nextParams === currentParams) {
        return false;
      }
      proxyParamsSignal.value = nextParams;
      return true;
    }
    if (!currentAction.replaceParams(newParams)) {
      return false;
    }
    proxyParamsSignal.value =
      currentActionPrivateProperties.paramsSignal.peek();
    return true;
  };

  if (rerunOnChange) {
    onActionTargetChange((actionTarget, actionTargetPrevious) => {
      if (
        actionTarget &&
        actionTargetPrevious &&
        !actionTargetPrevious.isPrerun
      ) {
        actionTarget.rerun();
      }
    });
  }
  if (onChange) {
    onActionTargetChange((actionTarget, actionTargetPrevious) => {
      onChange(actionTarget, actionTargetPrevious);
    });
  }

  return actionProxy;
};

const generateActionName = (name, params) => {
  if (params === NO_PARAMS) {
    return `${name}({})`;
  }
  // Use stringifyForDisplay with asFunctionArgs option for the entire args array
  const argsString = stringifyForDisplay([params], 3, 0, {
    asFunctionArgs: true,
  });
  return `${name}${argsString}`;
};

const useActionData = (action) => {
  if (!action) {
    return undefined;
  }
  const { computedDataSignal } = getActionPrivateProperties(action);
  const data = computedDataSignal.value;
  return data;
};

const useRunOnMount = (action, Component) => {
  useEffect(() => {
    action.run({
      reason: `<${Component.name} /> mounted`,
    });
  }, []);
};

const localStorageSignal = (key) => {
  const initialValue = localStorage.getItem(key);

  const valueSignal = signal(initialValue === null ? undefined : initialValue);
  effect(() => {
    const value = valueSignal.value;
    if (value === undefined) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
    }
  });

  return valueSignal;
};

const valueInLocalStorage = (key, { type = "any" } = {}) => {
  const converter = TYPE_CONVERTERS[type];

  const get = () => {
    let valueInLocalStorage = window.localStorage.getItem(key);
    if (valueInLocalStorage === null) {
      return undefined;
    }
    let valueToReturn = valueInLocalStorage;
    if (converter && converter.decode) {
      try {
        const valueDecoded = converter.decode(valueInLocalStorage);
        valueToReturn = valueDecoded;
      } catch (e) {
        console.error(`Error decoding localStorage "${key}" value:`, e);
        return undefined;
      }
    }
    if (type !== "any" && typeof valueToReturn !== type) {
      console.warn(
        `localStorage "${key}" value is invalid: should be a "${type}", got ${valueInLocalStorage}`,
      );
      return undefined;
    }
    return valueToReturn;
  };

  const set = (value) => {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    let valueToStore = value;
    if (converter && converter.encode) {
      const valueEncoded = converter.encode(valueToStore);
      valueToStore = valueEncoded;
    }
    window.localStorage.setItem(key, valueToStore);
  };
  const remove = () => {
    window.localStorage.removeItem(key);
  };

  return [get, set, remove];
};

const TYPE_CONVERTERS = {
  any: {
    decode: (valueFromLocalStorage) => JSON.parse(valueFromLocalStorage),
    encode: (value) => JSON.stringify(value),
  },
  boolean: {
    decode: (valueFromLocalStorage) => {
      if (
        valueFromLocalStorage === "true" ||
        valueFromLocalStorage === "on" ||
        valueFromLocalStorage === "1"
      ) {
        return true;
      }
      return false;
    },
    encode: (value) => {
      return value ? "true" : "false";
    },
  },
  number: {
    decode: (valueFromLocalStorage) => {
      const valueParsed = parseFloat(valueFromLocalStorage);
      return valueParsed;
    },
  },
  object: {
    decode: (valueFromLocalStorage) => {
      const valueParsed = JSON.parse(valueFromLocalStorage);
      return valueParsed;
    },
    encode: (value) => {
      const valueStringified = JSON.stringify(value);
      return valueStringified;
    },
  },
};

// Global signal registry for route template detection
const globalSignalRegistry = new Map();
let signalIdCounter = 0;
const generateSignalId = () => {
  const id = signalIdCounter++;
  return id;
};

/**
 * Creates an advanced signal with dynamic default value, local storage persistence, and validation.
 *
 * The first parameter can be either a static value or a signal acting as a "dynamic default":
 * - If a static value: traditional default behavior
 * - If a signal: acts as a dynamic default that updates the signal ONLY when no explicit value has been set
 *
 * Dynamic default behavior (when first param is a signal):
 * 1. Initially takes value from the default signal
 * 2. When explicitly set (programmatically or via localStorage), the explicit value takes precedence
 * 3. When default signal changes, it only updates if no explicit value was ever set
 * 4. Calling reset() or setting to undefined makes the signal use the dynamic default again
 * 5. If dynamic default is undefined and options.default is provided, uses the static fallback
 *
 * This is useful for:
 * - Backend data that can change but shouldn't override user preferences
 * - Route parameters with dynamic defaults based on other state
 * - Cascading configuration where defaults can be updated without losing user customizations
 * - Having a static fallback when dynamic defaults might be undefined
 *
 * @param {any|import("@preact/signals").Signal} defaultValue - Static default value OR signal for dynamic default behavior
 * @param {Object} [options={}] - Configuration options
 * @param {string|number} [options.id] - Custom ID for the signal. If not provided, an auto-generated ID will be used. Used for localStorage key and route pattern detection.
 * @param {any} [options.default] - Static fallback value used when defaultValue is a signal and that signal's value is undefined
 * @param {boolean} [options.persists=false] - Whether to persist the signal value in localStorage using the signal ID as key
 * @param {"string" | "number" | "boolean" | "object"} [options.type="string"] - Type for localStorage serialization/deserialization
 * @param {number} [options.step] - For number type: step size for precision. Values will be rounded to nearest multiple of step.
 * @param {Array} [options.oneOf] - Array of valid values for validation. Signal will be marked invalid if value is not in this array
 * @param {boolean} [options.debug=false] - Enable debug logging for this signal's operations
 * @returns {import("@preact/signals").Signal} A signal that can be synchronized with a source signal and/or persisted in localStorage. The signal includes a `validity` property for validation state.
 *
 * @example
 * // Basic signal with default value
 * const count = stateSignal(0);
 *
 * @example
 * // Signal with custom ID and persistence
 * const theme = stateSignal("light", {
 *   id: "user-theme",
 *   persists: true,
 *   type: "string"
 * });
 *
 * @example
 * // Signal with validation and auto-fix
 * const tab = stateSignal("overview", {
 *   id: "current-tab",
 *   oneOf: ["overview", "details", "settings"],
 *   autoFix: () => "overview",
 *   persists: true
 * });
 *
 * @example
 * // Dynamic default that doesn't override user choices
 * const backendTheme = signal("light");
 * const userTheme = stateSignal(backendTheme, { persists: true });
 *
 * // Initially: userTheme.value = "light" (from dynamic default)
 * // User sets: userTheme.value = "dark" (explicit choice, persisted)
 * // Backend changes: backendTheme.value = "blue"
 * // Result: userTheme.value = "dark" (user choice preserved)
 * // Reset: userTheme.value = undefined; // Now follows dynamic default again
 *
 * @example
 * // Dynamic default with static fallback
 * const backendValue = signal(undefined); // might be undefined initially
 * const userValue = stateSignal(backendValue, {
 *   default: "fallback",
 *   persists: true
 * });
 *
 * // Initially: userValue.value = "fallback" (static fallback since dynamic is undefined)
 * // Backend loads: backendValue.value = "loaded"; userValue.value = "loaded" (follows dynamic)
 * // User sets: userValue.value = "custom" (explicit choice, persisted)
 * // Backend changes: backendValue.value = "updated"
 * // Result: userValue.value = "custom" (user choice preserved)
 * // Reset: userValue.value = undefined; userValue.value = "updated" (follows dynamic again)
 *
 * @example
 * // Route parameter with dynamic default from parent route
 * const parentTab = signal("overview");
 * const childTab = stateSignal(parentTab);
 * // childTab follows parentTab changes unless explicitly set
 */
const NO_LOCAL_STORAGE = [() => undefined, () => {}, () => {}];
const stateSignal = (defaultValue, options = {}) => {
  const {
    id,
    type,
    min,
    max,
    step,
    oneOf,
    persists = false,
    debug,
    default: staticFallback,
  } = options;

  // Check if defaultValue is a signal (dynamic default) or static value
  const isDynamicDefault =
    defaultValue &&
    typeof defaultValue === "object" &&
    "value" in defaultValue &&
    "peek" in defaultValue;
  const dynamicDefaultSignal = isDynamicDefault ? defaultValue : null;
  const staticDefaultValue = isDynamicDefault ? staticFallback : defaultValue;
  const signalId = id || generateSignalId();
  // Convert numeric IDs to strings for consistency
  const signalIdString = String(signalId);
  if (globalSignalRegistry.has(signalIdString)) {
    const conflictInfo = globalSignalRegistry.get(signalIdString);
    throw new Error(
      `Signal ID conflict: A signal with ID "${signalIdString}" already exists (existing default: ${conflictInfo.options.getDefaultValue()})`,
    );
  }

  // Determine localStorage key: use id if persists=true, or legacy localStorage option
  const localStorageKey = signalIdString;
  const [readFromLocalStorage, writeIntoLocalStorage, removeFromLocalStorage] =
    persists
      ? valueInLocalStorage(localStorageKey, {
          type: localStorageTypeMap[type] || type,
        })
      : NO_LOCAL_STORAGE;

  /**
   * Returns the current default value from code logic only (static or dynamic).
   * NEVER considers localStorage - used for URL building and route matching.
   *
   * @returns {any} The current code default value, undefined if no default
   */
  const getDefaultValue = (internalCall) => {
    if (dynamicDefaultSignal) {
      const dynamicValue = dynamicDefaultSignal.peek();
      if (dynamicValue === undefined) {
        if (staticDefaultValue === undefined) {
          return undefined;
        }
        if (debug && internalCall) {
          console.debug(
            `[stateSignal:${signalIdString}] dynamic default is undefined, using static default=${staticDefaultValue}`,
          );
        }
        return staticDefaultValue;
      }
      if (debug && internalCall) {
        console.debug(
          `[stateSignal:${signalIdString}] using value from dynamic default signal=${dynamicValue}`,
        );
      }
      return dynamicValue;
    }
    if (debug && internalCall) {
      console.debug(
        `[stateSignal:${signalIdString}] using static default value=${staticDefaultValue}`,
      );
    }
    return staticDefaultValue;
  };

  /**
   * Returns fallback value: localStorage first, then code default.
   * Used for signal initialization and resets.
   *
   * @returns {any} The fallback value (localStorage or code default)
   */
  const getFallbackValue = () => {
    if (persists) {
      const valueFromLocalStorage = readFromLocalStorage();
      if (valueFromLocalStorage !== undefined) {
        if (debug) {
          console.debug(
            `[stateSignal:${signalIdString}] using value from localStorage "${localStorageKey}"=${valueFromLocalStorage}`,
          );
        }
        return valueFromLocalStorage;
      }
    }
    return getDefaultValue(true);
  };
  const isCustomValue = (value) => {
    if (value === undefined) {
      return false;
    }
    if (dynamicDefaultSignal) {
      const dynamicValue = dynamicDefaultSignal.peek();
      if (dynamicValue === undefined) {
        return !compareTwoJsValues(value, staticDefaultValue, {
          ignoreArrayOrder: true,
        });
      }
      return !compareTwoJsValues(value, dynamicValue, {
        ignoreArrayOrder: true,
      });
    }
    return !compareTwoJsValues(value, staticDefaultValue, {
      ignoreArrayOrder: true,
    });
  };

  // Create signal with initial value: use stored value, or undefined to indicate no explicit value
  const [validity, updateValidity] = createValidity({
    type,
    min,
    max,
    step,
    oneOf,
  });
  const processValue = (value) => {
    const wasValid = validity.valid;
    updateValidity(value);
    if (validity.valid) {
      if (!wasValid) {
        if (debug) {
          console.debug(
            `[stateSignal:${signalIdString}] validation now passes`,
            { value },
          );
        }
      }
      return value;
    }
    if (debug) {
      console.debug(`[stateSignal:${signalIdString}] validation failed`, {
        value,
        min,
        max,
        step,
        oneOf,
        hasAutoFix: Boolean(validity.validSuggestion),
      });
    }
    if (validity.validSuggestion) {
      const validValue = validity.validSuggestion.value;
      if (debug) {
        console.debug(
          `[stateSignal:${signalIdString}] autoFix applied: ${value} → ${validValue}`,
          {
            value,
            validValue,
          },
        );
      }
      return validValue;
    }
    return value;
  };
  const preactSignal = signal(processValue(getFallbackValue()));

  // Create wrapper signal that applies step rounding on setValue
  const facadeSignal = {
    get value() {
      return preactSignal.value;
    },
    set value(newValue) {
      preactSignal.value = processValue(newValue);
    },
    peek() {
      return preactSignal.peek();
    },
    subscribe(fn) {
      return preactSignal.subscribe(fn);
    },
    valueOf() {
      return preactSignal.valueOf();
    },
  };

  facadeSignal.validity = validity;
  facadeSignal.__signalId = signalIdString;
  facadeSignal.toString = () => `{navi_state_signal:${signalIdString}}`;
  // 1. when signal value changes to undefined, it needs to fallback to default value
  // 2. when dynamic default changes and signal value is not custom, it needs to update
  {
    let isFirstRun = true;
    effect(() => {
      const value = preactSignal.value;
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      if (value !== undefined) {
        return;
      }
      const defaultValue = getDefaultValue(true);
      if (defaultValue === value) {
        return;
      }
      if (debug) {
        console.debug(
          `[stateSignal:${signalIdString}] becomes undefined, reset to ${defaultValue}`,
        );
      }
      facadeSignal.value = defaultValue;
    });
  }
  dynamic_signal_effect: {
    if (!dynamicDefaultSignal) {
      break dynamic_signal_effect;
    }
    // here we listen only on the dynamic default signal
    let isFirstRun = true;
    let dynamicDefaultPreviousValue;
    effect(() => {
      const value = preactSignal.peek();
      const dynamicDefaultValue = dynamicDefaultSignal.value;
      if (isFirstRun) {
        isFirstRun = false;
        dynamicDefaultPreviousValue = dynamicDefaultValue;
        return;
      }
      // Check if current signal value matches the PREVIOUS dynamic default
      // If so, it was following the dynamic default and should update
      // Special case: if previous was undefined and we were using static fallback
      let wasFollowingDefault = false;
      if (
        dynamicDefaultPreviousValue === undefined &&
        staticDefaultValue !== undefined
      ) {
        // Signal might have been using static fallback
        wasFollowingDefault = value === staticDefaultValue;
      } else {
        // Signal was following the previous dynamic default
        wasFollowingDefault = value === dynamicDefaultPreviousValue;
      }

      if (!wasFollowingDefault) {
        // Signal has a custom value, don't update even if dynamic default changes
        dynamicDefaultPreviousValue = dynamicDefaultValue;
        return;
      }

      // Signal was using default value, update to new default
      const newDefaultValue = getDefaultValue(true);
      if (newDefaultValue === value) {
        dynamicDefaultPreviousValue = dynamicDefaultValue;
        return;
      }
      if (debug) {
        console.debug(
          `[stateSignal:${signalIdString}] dynamic default updated, update to ${newDefaultValue}`,
        );
      }
      dynamicDefaultPreviousValue = dynamicDefaultValue;
      facadeSignal.value = newDefaultValue;
    });
  }
  persist_in_local_storage: {
    if (!localStorageKey) {
      break persist_in_local_storage;
    }
    effect(() => {
      const value = preactSignal.value;

      if (dynamicDefaultSignal) {
        // With dynamic defaults: always persist to preserve user intent
        // even when value matches dynamic defaults that may change
        if (value !== undefined) {
          if (debug) {
            console.debug(
              `[stateSignal:${signalIdString}] dynamic default: writing to localStorage "${localStorageKey}"=${value}`,
            );
          }
          writeIntoLocalStorage(value);
        }
        return;
      }
      // Static defaults: only persist custom values
      if (isCustomValue(value)) {
        if (debug) {
          console.debug(
            `[stateSignal:${signalIdString}] writing into localStorage "${localStorageKey}"=${value}`,
          );
        }
        writeIntoLocalStorage(value);
      } else {
        if (debug) {
          console.debug(
            `[stateSignal:${signalIdString}] removing "${localStorageKey}" from localStorage (value=${value})`,
          );
        }
        removeFromLocalStorage();
      }
    });
  }
  // update validity object according to the signal value
  {
    effect(() => {
      const value = preactSignal.value;
      facadeSignal.value = processValue(value);
    });
  }

  // Create isDefaultValue function for this signal
  const isDefaultValue = (value) => {
    const currentDefault = getDefaultValue(false);
    return value === currentDefault;
  };

  // Store signal with its options (used by route_pattern.js)
  globalSignalRegistry.set(signalIdString, {
    signal: facadeSignal,
    options: {
      staticDefaultValue,
      getDefaultValue,
      dynamicDefaultSignal,
      isCustomValue,
      isDefaultValue,
      type,
      step,
      min,
      max,
      persists,
      localStorageKey,
      debug,
      ...options,
    },
  });
  if (debug) {
    console.debug(
      `[stateSignal:${signalIdString}] created with initial value=${facadeSignal.value}`,
      {
        staticDefaultValue,
        hasDynamicDefault: Boolean(dynamicDefaultSignal),
        hasStoredValue: persists && readFromLocalStorage() !== undefined,
        persists,
        localStorageKey: persists ? localStorageKey : undefined,
      },
    );
  }

  return facadeSignal;
};

const localStorageTypeMap = {
  float: "number",
  integer: "number",
  ratio: "number",
  longitude: "number",
  latitude: "number",
  percentage: "string",
  url: "string",
  date: "string",
  time: "string",
  email: "string",
  array: "object",
};

const getCallerInfo = (targetFunction = null, additionalOffset = 0) => {
  const originalPrepareStackTrace = Error.prepareStackTrace;
  try {
    Error.prepareStackTrace = (_, stack) => stack;

    const error = new Error();
    const stack = error.stack;

    if (!stack || stack.length === 0 || !Array.isArray(stack)) {
      return { raw: "unknown" };
    }

    let targetIndex = -1;

    if (targetFunction) {
      // ✅ Chercher la fonction cible par référence directe
      for (let i = 0; i < stack.length; i++) {
        const frame = stack[i];
        const frameFunction = frame.getFunction();

        // ✅ Comparaison directe par référence
        if (frameFunction === targetFunction) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex === -1) {
        return {
          raw: `target function not found in stack`,
          targetFunction: targetFunction.name,
        };
      }

      // ✅ Prendre la fonction qui appelle targetFunction + offset
      const callerIndex = targetIndex + 1 + additionalOffset;

      if (callerIndex >= stack.length) {
        return {
          raw: `caller at offset ${additionalOffset} not found`,
          targetFunction: targetFunction.name,
          requestedIndex: callerIndex,
          stackLength: stack.length,
        };
      }

      const callerFrame = stack[callerIndex];
      return {
        file: callerFrame.getFileName(),
        line: callerFrame.getLineNumber(),
        column: callerFrame.getColumnNumber(),
        function: callerFrame.getFunctionName() || "<anonymous>",
        raw: callerFrame.toString(),
        targetFunction: targetFunction.name,
        offset: additionalOffset,
      };
    }

    // ✅ Comportement original si pas de targetFunction
    if (stack.length > 2) {
      const callerFrame = stack[2 + additionalOffset];

      if (!callerFrame) {
        return {
          raw: `caller at offset ${additionalOffset} not found`,
          requestedIndex: 2 + additionalOffset,
          stackLength: stack.length,
        };
      }

      return {
        file: callerFrame.getFileName(),
        line: callerFrame.getLineNumber(),
        column: callerFrame.getColumnNumber(),
        function: callerFrame.getFunctionName() || "<anonymous>",
        raw: callerFrame.toString(),
        offset: additionalOffset,
      };
    }

    return { raw: "unknown" };
  } finally {
    Error.prepareStackTrace = originalPrepareStackTrace;
  }
};

const primitiveCanBeId = (value) => {
  const type = typeof value;
  if (type === "string" || type === "number" || type === "symbol") {
    return true;
  }
  return false;
};

const arraySignalStore = (
  initialArray = [],
  idKey = "id",
  {
    mutableIdKeys = [],
    name,
    createItem = (props) => {
      return { ...props };
    },
  },
) => {
  const store = {
    name,
  };

  const createItemFromProps = (props) => {
    if (props === null || typeof props !== "object") {
      return props;
    }
    const item = createItem(props);
    return item;
  };

  const arraySignal = signal(initialArray);
  const derivedSignal = computed(() => {
    const array = arraySignal.value;
    const idSet = new Set(); // will be used to detect id changes (deletion, addition)
    const idMap = new Map(); // used to speep up finding item by id
    for (const item of array) {
      const id = item[idKey];
      idSet.add(id);
      idMap.set(id, item);
    }
    return [idSet, idMap];
  });
  const idSetSignal = computed(() => derivedSignal.value[0]);
  const idMapSignal = computed(() => derivedSignal.value[1]);
  const previousIdSetSignal = signal(new Set(idSetSignal.peek()));
  const idChangeCallbackSet = new Set();
  effect(() => {
    const idSet = idSetSignal.value;
    const previousIdSet = previousIdSetSignal.peek();
    const setCopy = new Set();
    let modified = false;
    for (const id of idSet) {
      if (!previousIdSet.has(id)) {
        modified = true;
      }
      setCopy.add(id);
    }
    if (modified) {
      previousIdSetSignal.value = setCopy;
      for (const idChangeCallback of idChangeCallbackSet) {
        idChangeCallback(idSet, previousIdSet);
      }
    }
  });

  const propertiesObserverSet = new Set();
  const observeProperties = (itemSignal, callback) => {
    const observer = { itemSignal, callback };
    propertiesObserverSet.add(observer);

    // Return cleanup function
    return () => {
      propertiesObserverSet.delete(observer);
    };
  };

  const removalsCallbackSet = new Set();
  const observeRemovals = (callback) => {
    removalsCallbackSet.add(callback);
  };

  const itemMatchLifecycleSet = new Set();
  const registerItemMatchLifecycle = (matchPredicate, { match, nomatch }) => {
    const matchState = {
      hasMatched: false,
      hadMatchedBefore: false,
    };
    const itemMatchLifecycle = {
      matchPredicate,
      match,
      nomatch,
      matchState,
    };
    itemMatchLifecycleSet.add(itemMatchLifecycle);
  };

  const readIdFromItemProps = (props, array) => {
    let id;
    if (Object.hasOwn(props, idKey)) {
      id = props[idKey];
      return id;
    }
    if (mutableIdKeys.length === 0) {
      return undefined;
    }

    let mutableIdKey;
    for (const mutableIdKeyCandidate of mutableIdKeys) {
      if (Object.hasOwn(props, mutableIdKeyCandidate)) {
        mutableIdKey = mutableIdKeyCandidate;
        break;
      }
    }
    if (!mutableIdKey) {
      throw new Error(
        `item properties must have one of the following keys:
${[idKey, ...mutableIdKeys].join(", ")}`,
      );
    }
    const mutableIdValue = props[mutableIdKey];
    for (const itemCandidate of array) {
      const mutableIdCandidate = itemCandidate[mutableIdKey];
      if (mutableIdCandidate === mutableIdValue) {
        id = itemCandidate[idKey];
        break;
      }
    }
    if (!id) {
      throw new Error(
        `None of the existing item uses ${mutableIdKey}: ${mutableIdValue}, so item properties must specify the "${idKey}" key.`,
      );
    }
    return id;
  };

  effect(() => {
    const array = arraySignal.value;

    for (const {
      matchPredicate,
      match,
      nomatch,
      matchState,
    } of itemMatchLifecycleSet) {
      let currentlyHasMatch = false;

      // Check if any item currently matches
      for (const item of array) {
        if (matchPredicate(item)) {
          currentlyHasMatch = true;
          break;
        }
      }

      // Handle state transitions
      if (currentlyHasMatch && !matchState.hasMatched) {
        // New match found
        matchState.hasMatched = true;
        const isRematch = matchState.hadMatchedBefore;
        if (match) {
          match(isRematch);
        }
      } else if (!currentlyHasMatch && matchState.hasMatched) {
        // No longer has match
        matchState.hasMatched = false;
        matchState.hadMatchedBefore = true;
        if (nomatch) {
          nomatch();
        }
      }
    }
  });

  const select = (...args) => {
    const array = arraySignal.value;
    const idMap = idMapSignal.value;

    let property;
    let value;
    if (args.length === 1) {
      property = idKey;
      value = args[0];
      if (value !== null && typeof value === "object") {
        value = readIdFromItemProps(value, array);
      }
    } else if (args.length === 2) {
      property = args[0];
      value = args[1];
    }
    if (property === idKey) {
      return idMap.get(value);
    }
    for (const itemCandidate of array) {
      const valueCandidate =
        typeof property === "function"
          ? property(itemCandidate)
          : itemCandidate[property];
      if (valueCandidate === value) {
        return itemCandidate;
      }
    }
    return null;
  };
  const selectAll = (toMatchArray) => {
    const array = arraySignal.value;
    const result = [];
    const idMap = idMapSignal.value;
    for (const toMatch of toMatchArray) {
      const id =
        toMatch !== null && typeof toMatch === "object"
          ? readIdFromItemProps(toMatch, array)
          : toMatch;
      const item = idMap.get(id);
      if (item) {
        result.push(item);
      }
    }
    return result;
  };
  const upsert = (...args) => {
    const itemMutationsMap = new Map(); // Map<itemId, propertyMutations>
    const triggerPropertyMutations = () => {
      if (itemMutationsMap.size === 0) {
        return;
      }
      // we call at the end so that itemWithProps and arraySignal.value was set too
      for (const observer of propertiesObserverSet) {
        const { itemSignal, callback } = observer;
        const watchedItem = itemSignal.peek();
        if (!watchedItem) {
          continue;
        }

        // Check if this item has mutations
        const itemSpecificMutations = itemMutationsMap.get(watchedItem[idKey]);
        if (itemSpecificMutations) {
          callback(itemSpecificMutations);
        }
      }
    };
    const assign = (item, props) => {
      const itemOwnPropertyDescriptors = Object.getOwnPropertyDescriptors(item);
      const itemOwnKeys = Object.keys(itemOwnPropertyDescriptors);
      const itemWithProps = Object.create(
        Object.getPrototypeOf(item),
        itemOwnPropertyDescriptors,
      );
      let hasChanges = false;
      const propertyMutations = {};

      for (const key of Object.keys(props)) {
        const newValue = props[key];
        if (itemOwnKeys.includes(key)) {
          const oldValue = item[key];
          if (newValue !== oldValue) {
            hasChanges = true;
            itemWithProps[key] = newValue;
            propertyMutations[key] = {
              oldValue,
              newValue,
              target: item,
              newTarget: itemWithProps,
            };
          }
        } else {
          hasChanges = true;
          itemWithProps[key] = newValue;
          propertyMutations[key] = {
            added: true,
            newValue,
            target: item,
            newTarget: itemWithProps,
          };
        }
      }

      if (!hasChanges) {
        return item;
      }

      // Store mutations for this specific item
      itemMutationsMap.set(item[idKey], propertyMutations);
      return itemWithProps;
    };

    const array = arraySignal.peek();
    if (args.length === 1 && Array.isArray(args[0])) {
      const propsArray = args[0];
      if (array.length === 0) {
        const arrayAllCreated = [];
        for (const props of propsArray) {
          const item = createItemFromProps(props);
          arrayAllCreated.push(item);
        }
        arraySignal.value = arrayAllCreated;
        return arrayAllCreated;
      }
      let hasNew = false;
      let hasUpdate = false;
      const arraySomeUpdated = [];
      const arrayWithOnlyAffectedItems = [];
      const existingEntryMap = new Map();
      let index = 0;
      while (index < array.length) {
        const existingItem = array[index];
        const id = existingItem[idKey];
        existingEntryMap.set(id, {
          existingItem,
          existingItemIndex: index,
          processed: false,
        });
        index++;
      }

      for (const props of propsArray) {
        const id = readIdFromItemProps(props, array);
        const existingEntry = existingEntryMap.get(id);
        if (existingEntry) {
          const { existingItem } = existingEntry;
          const itemWithPropsOrItem = assign(existingItem, props);
          if (itemWithPropsOrItem !== existingItem) {
            hasUpdate = true;
          }
          arraySomeUpdated.push(itemWithPropsOrItem);
          existingEntry.processed = true;
          arrayWithOnlyAffectedItems.push(itemWithPropsOrItem);
        } else {
          hasNew = true;
          const item = createItemFromProps(props);
          arraySomeUpdated.push(item);
          arrayWithOnlyAffectedItems.push(item);
        }
      }

      for (const [, existingEntry] of existingEntryMap) {
        if (!existingEntry.processed) {
          arraySomeUpdated.push(existingEntry.existingItem);
        }
      }

      if (hasNew || hasUpdate) {
        arraySignal.value = arraySomeUpdated;
        triggerPropertyMutations();
        return arrayWithOnlyAffectedItems;
      }
      return arrayWithOnlyAffectedItems;
    }
    let existingItem = null;
    let updatedItem = null;
    const arraySomeUpdated = [];
    let propertyToMatch;
    let valueToMatch;
    let props;
    if (args.length === 1) {
      const firstArg = args[0];
      propertyToMatch = idKey;
      if (!firstArg || typeof firstArg !== "object") {
        throw new TypeError(
          `Expected an object as first argument, got ${firstArg}`,
        );
      }
      valueToMatch = readIdFromItemProps(firstArg, array);
      props = firstArg;
    } else if (args.length === 2) {
      propertyToMatch = idKey;
      valueToMatch = args[0];
      if (typeof valueToMatch === "object") {
        valueToMatch = valueToMatch[idKey];
      }
      props = args[1];
    } else if (args.length === 3) {
      propertyToMatch = args[0];
      valueToMatch = args[1];
      props = args[2];
    }
    for (const itemCandidate of array) {
      const itemCandidateValue =
        typeof propertyToMatch === "function"
          ? propertyToMatch(itemCandidate)
          : itemCandidate[propertyToMatch];
      if (itemCandidateValue === valueToMatch) {
        const itemWithPropsOrItem = assign(itemCandidate, props);
        if (itemWithPropsOrItem === itemCandidate) {
          existingItem = itemCandidate;
        } else {
          updatedItem = itemWithPropsOrItem;
        }
        arraySomeUpdated.push(itemWithPropsOrItem);
      } else {
        arraySomeUpdated.push(itemCandidate);
      }
    }
    if (existingItem) {
      return existingItem;
    }
    if (updatedItem) {
      arraySignal.value = arraySomeUpdated;
      triggerPropertyMutations();
      return updatedItem;
    }
    const item = createItemFromProps(props);
    arraySomeUpdated.push(item);
    arraySignal.value = arraySomeUpdated;
    triggerPropertyMutations();
    return item;
  };
  const drop = (...args) => {
    const removedItemArray = [];
    const triggerRemovedMutations = () => {
      if (removedItemArray.length === 0) {
        return;
      }
      // we call at the end so that itemWithProps and arraySignal.value was set too
      for (const removalsCallback of removalsCallbackSet) {
        removalsCallback(removedItemArray);
      }
    };

    const array = arraySignal.peek();
    if (args.length === 1 && Array.isArray(args[0])) {
      const firstArg = args[0];
      const arrayWithoutDroppedItems = [];
      let hasFound = false;
      const idToRemoveSet = new Set();
      const idRemovedArray = [];

      for (const value of firstArg) {
        if (typeof value === "object" && value !== null) {
          const id = readIdFromItemProps(value, array);
          idToRemoveSet.add(id);
        } else if (!primitiveCanBeId(value)) {
          throw new TypeError(`id to drop must be an id, got ${value}`);
        }
        idToRemoveSet.add(value);
      }
      for (const existingItem of array) {
        const existingItemId = existingItem[idKey];
        if (idToRemoveSet.has(existingItemId)) {
          hasFound = true;
          idToRemoveSet.delete(existingItemId);
          idRemovedArray.push(existingItemId);
        } else {
          arrayWithoutDroppedItems.push(existingItem);
        }
      }
      if (idToRemoveSet.size > 0) {
        console.warn(
          `arraySignalStore.drop: Some ids were not found in the array: ${Array.from(idToRemoveSet).join(", ")}`,
        );
      }
      if (hasFound) {
        arraySignal.value = arrayWithoutDroppedItems;
        triggerRemovedMutations();
        return idRemovedArray;
      }
      return [];
    }
    let propertyToMatch;
    let valueToMatch;
    if (args.length === 1) {
      propertyToMatch = idKey;
      valueToMatch = args[0];
      if (valueToMatch !== null && typeof valueToMatch === "object") {
        valueToMatch = readIdFromItemProps(valueToMatch, array);
      } else if (!primitiveCanBeId(valueToMatch)) {
        throw new TypeError(`id to drop must be an id, got ${valueToMatch}`);
      }
    } else {
      propertyToMatch = args[0];
      valueToMatch = args[1];
    }
    const arrayWithoutItemToDrop = [];
    let found = false;
    let itemDropped = null;
    for (const itemCandidate of array) {
      const itemCandidateValue =
        typeof propertyToMatch === "function"
          ? propertyToMatch(itemCandidate)
          : itemCandidate[propertyToMatch];
      if (itemCandidateValue === valueToMatch) {
        itemDropped = itemCandidate;
        found = true;
      } else {
        arrayWithoutItemToDrop.push(itemCandidate);
      }
    }
    if (found) {
      arraySignal.value = arrayWithoutItemToDrop;
      removedItemArray.push(itemDropped);
      triggerRemovedMutations();
      return itemDropped[idKey];
    }
    return null;
  };

  const signalForMutableIdKey = (mutableIdKey, mutableIdValueSignal) => {
    const itemIdSignal = signal(null);
    const check = (value) => {
      const item = select(mutableIdKey, value);
      if (!item) {
        return false;
      }
      itemIdSignal.value = item[idKey];
      return true;
    };
    if (!check()) {
      effect(function () {
        const mutableIdValue = mutableIdValueSignal.value;
        if (check(mutableIdValue)) {
          this.dispose();
        }
      });
    }

    return computed(() => {
      return select(itemIdSignal.value);
    });
  };

  Object.assign(store, {
    mutableIdKeys,
    arraySignal,
    select,
    selectAll,
    upsert,
    drop,

    observeProperties,
    observeRemovals,
    registerItemMatchLifecycle,
    signalForMutableIdKey,
  });
  return store;
};

// Resource Lifecycle Manager
// This handles ALL resource lifecycle logic (rerun/reset) across all resources
const createResourceLifecycleManager = () => {
  const registeredResources = new Map(); // Map<resourceInstance, lifecycleConfig>
  const resourceDependencies = new Map(); // Map<resourceInstance, Set<dependentResources>>

  const registerResource = (resourceInstance, config) => {
    const {
      rerunOn,
      paramScope = null,
      dependencies = [],
      mutableIdKeys = [],
    } = config;

    registeredResources.set(resourceInstance, {
      rerunOn,
      paramScope,
      mutableIdKeys,
      httpActions: new Set(),
    });

    // Register dependencies
    if (dependencies.length > 0) {
      for (const dependency of dependencies) {
        if (!resourceDependencies.has(dependency)) {
          resourceDependencies.set(dependency, new Set());
        }
        resourceDependencies.get(dependency).add(resourceInstance);
      }
    }
  };

  const registerAction = (resourceInstance, httpAction) => {
    const config = registeredResources.get(resourceInstance);
    if (config) {
      config.httpActions.add(httpAction);
    }
  };

  const shouldRerunAfter = (rerunConfig, httpVerb) => {
    if (rerunConfig === false) return false;
    if (rerunConfig === "*") return true;
    if (Array.isArray(rerunConfig)) {
      const verbSet = new Set(rerunConfig.map((v) => v.toUpperCase()));
      if (verbSet.has("*")) return true;
      return verbSet.has(httpVerb.toUpperCase());
    }
    return false;
  };

  const isParamSubset = (parentParams, childParams) => {
    if (!parentParams || !childParams) return false;
    for (const [key, value] of Object.entries(parentParams)) {
      if (
        !(key in childParams) ||
        !compareTwoJsValues(childParams[key], value)
      ) {
        return false;
      }
    }
    return true;
  };

  const findEffectOnActions = (triggeringAction) => {
    // Determines which actions to rerun/reset when an action completes.

    const actionsToRerun = new Set();
    const actionsToReset = new Set();
    const reasonSet = new Set();

    for (const [resourceInstance, config] of registeredResources) {
      const shouldRerunGetMany = shouldRerunAfter(
        config.rerunOn.GET_MANY,
        triggeringAction.meta.httpVerb,
      );
      const shouldRerunGet = shouldRerunAfter(
        config.rerunOn.GET,
        triggeringAction.meta.httpVerb,
      );

      // Skip if no rerun or reset rules apply
      const hasMutableIdAutorerun =
        (triggeringAction.meta.httpVerb === "POST" ||
          triggeringAction.meta.httpVerb === "PUT" ||
          triggeringAction.meta.httpVerb === "PATCH") &&
        config.mutableIdKeys.length > 0;

      if (
        !shouldRerunGetMany &&
        !shouldRerunGet &&
        triggeringAction.meta.httpVerb !== "DELETE" &&
        !hasMutableIdAutorerun
      ) {
        continue;
      }

      // Parameter scope predicate for config-driven rules
      // Same scope ID or no scope = compatible, subset check for different scopes
      const paramScopePredicate = config.paramScope
        ? (candidateAction) => {
            if (candidateAction.meta.paramScope?.id === config.paramScope.id)
              return true;
            if (!candidateAction.meta.paramScope) return true;
            const candidateParams = candidateAction.meta.paramScope.params;
            const currentParams = config.paramScope.params;
            return isParamSubset(candidateParams, currentParams);
          }
        : (candidateAction) => !candidateAction.meta.paramScope;

      for (const httpAction of config.httpActions) {
        // Find all instances of this action
        const actionCandidateArray = httpAction.matchAllSelfOrDescendant(
          (action) =>
            !action.isPrerun && action.completed && action !== triggeringAction,
        );

        for (const actionCandidate of actionCandidateArray) {
          const triggerVerb = triggeringAction.meta.httpVerb;
          const candidateVerb = actionCandidate.meta.httpVerb;
          const candidateIsPlural = actionCandidate.meta.httpMany;
          if (triggerVerb === candidateVerb) {
            continue;
          }

          const triggeringResource = getResourceForAction(triggeringAction);
          const isSameResource = triggeringResource === resourceInstance;

          // Config-driven same-resource effects (respects param scope)
          config_effect: {
            if (
              !isSameResource ||
              triggerVerb === "GET" ||
              candidateVerb !== "GET"
            ) {
              break config_effect;
            }
            const shouldRerun = candidateIsPlural
              ? shouldRerunGetMany
              : shouldRerunGet;
            if (!shouldRerun) {
              break config_effect;
            }
            if (!paramScopePredicate(actionCandidate)) {
              break config_effect;
            }
            actionsToRerun.add(actionCandidate);
            reasonSet.add("same-resource autorerun");
            continue;
          }

          // DELETE effects on same resource (ignores param scope)
          delete_effect: {
            if (!isSameResource || triggerVerb !== "DELETE") {
              break delete_effect;
            }
            if (candidateIsPlural) {
              if (!shouldRerunGetMany) {
                break delete_effect;
              }
              actionsToRerun.add(actionCandidate);
              reasonSet.add("same-resource DELETE rerun GET_MANY");
              continue;
            }
            // Get the ID(s) that were deleted
            const { dataSignal } = getActionPrivateProperties(triggeringAction);
            const deleteIdSet = triggeringAction.meta.httpMany
              ? new Set(dataSignal.peek())
              : new Set([dataSignal.peek()]);

            const candidateId = actionCandidate.data;
            const isAffected = deleteIdSet.has(candidateId);
            if (!isAffected) {
              break delete_effect;
            }
            if (candidateVerb === "GET" && shouldRerunGet) {
              actionsToRerun.add(actionCandidate);
              reasonSet.add("same-resource DELETE rerun GET");
              continue;
            }
            actionsToReset.add(actionCandidate);
            reasonSet.add("same-resource DELETE reset");
            continue;
          }

          // MutableId effects: rerun GET when matching resource created/updated
          {
            if (
              hasMutableIdAutorerun &&
              candidateVerb === "GET" &&
              !candidateIsPlural &&
              isSameResource
            ) {
              const { computedDataSignal } =
                getActionPrivateProperties(triggeringAction);
              const modifiedData = computedDataSignal.peek();

              if (modifiedData && typeof modifiedData === "object") {
                for (const mutableIdKey of config.mutableIdKeys) {
                  const modifiedMutableId = modifiedData[mutableIdKey];
                  const candidateParams = actionCandidate.params;

                  if (
                    modifiedMutableId !== undefined &&
                    candidateParams &&
                    typeof candidateParams === "object" &&
                    candidateParams[mutableIdKey] === modifiedMutableId
                  ) {
                    actionsToRerun.add(actionCandidate);
                    reasonSet.add(
                      `${triggeringAction.meta.httpVerb}-mutableId autorerun`,
                    );
                    break;
                  }
                }
              }
            }
          }

          // Cross-resource dependency effects: rerun dependent GET_MANY
          {
            if (
              triggeringResource &&
              resourceDependencies
                .get(triggeringResource)
                ?.has(resourceInstance) &&
              triggerVerb !== "GET" &&
              candidateVerb === "GET" &&
              candidateIsPlural
            ) {
              actionsToRerun.add(actionCandidate);
              reasonSet.add("dependency autorerun");
              continue;
            }
          }
        }
      }
    }

    return {
      actionsToRerun,
      actionsToReset,
      reasons: Array.from(reasonSet),
    };
  };

  const onActionComplete = (httpAction) => {
    const { actionsToRerun, actionsToReset, reasons } =
      findEffectOnActions(httpAction);

    if (actionsToRerun.size > 0 || actionsToReset.size > 0) {
      const reason = `${httpAction} triggered ${reasons.join(" and ")}`;
      const dispatchActions = getActionDispatcher();
      dispatchActions({
        rerunSet: actionsToRerun,
        resetSet: actionsToReset,
        reason,
      });
    }
  };

  // Helper to find which resource an action belongs to
  const getResourceForAction = (action) => {
    return action.meta.resourceInstance;
  };

  return {
    registerResource,
    registerAction,
    onActionComplete,
  };
};

// Global resource lifecycle manager instance
const resourceLifecycleManager = createResourceLifecycleManager();

// Cache for parameter scope identifiers
const paramScopeWeakSet = createIterableWeakSet();
let paramScopeIdCounter = 0;
const getParamScope = (params) => {
  for (const existingParamScope of paramScopeWeakSet) {
    if (compareTwoJsValues(existingParamScope.params, params)) {
      return existingParamScope;
    }
  }
  const id = Symbol(`paramScope-${++paramScopeIdCounter}`);
  const newParamScope = {
    params,
    id,
  };
  paramScopeWeakSet.add(newParamScope);
  return newParamScope;
};

const createHttpHandlerForRootResource = (
  name,
  {
    idKey,
    store,
    /*
    Default autorerun behavior explanation:

    GET: false (RECOMMENDED)
    What happens:
    - GET actions are reset by DELETE operations (not rerun)
    - DELETE operation on the displayed item would display nothing in the UI (action is in IDLE state)
    - PUT/PATCH operations update UI via signals, no rerun needed
    - This approach minimizes unnecessary API calls

    How to handle:
    - Applications can provide custom UI for deleted items (e.g., "Item not found")
    - Or redirect users to appropriate pages (e.g., back to list view)

    Alternative (NOT RECOMMENDED):
    - Use GET: ["DELETE"] to rerun and display 404 error received from backend
    - Poor UX: users expect immediate feedback, not loading + error state

    GET_MANY: ["POST"]
    - POST: New items may or may not appear in lists (depends on filters, pagination, etc.)
      Backend determines visibility better than client-side logic
    - DELETE: Excluded by default because:
      • UI handles deletions via store signals (selectAll filters out deleted items)
      • DELETE operations rarely change list content beyond item removal
      • Avoids unnecessary API calls (can be overridden if needed)
    */
    rerunOn = {
      GET: false,
      GET_MANY: [
        "POST",
        // "DELETE"
      ],
    },
    paramScope,
    dependencies = [],
    resourceInstance,
    mutableIdKeys = [],
  },
) => {
  // Register this resource with the resource lifecycle manager
  resourceLifecycleManager.registerResource(resourceInstance, {
    rerunOn,
    paramScope,
    dependencies,
    idKey,
    mutableIdKeys,
  });

  const createActionAffectingOneItem = (httpVerb, { callback, ...options }) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? (itemIdOrItemProps) => {
            const itemId = store.drop(itemIdOrItemProps);
            return itemId;
          }
        : (data) => {
            let item;
            if (Array.isArray(data)) {
              // the callback is returning something like [property, value, props]
              // this is to support a case like:
              // store.upsert("name", "currentName", { name: "newName" })
              // where we want to update the name property of an existing item
              item = store.upsert(...data);
            } else {
              item = store.upsert(data);
            }
            const itemId = item[idKey];
            return itemId;
          };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${httpVerb}`;
    const httpActionAffectingOneItem = createAction(callback, {
      meta: { httpVerb, httpMany: false, paramScope, resourceInstance, store },
      name: `${name}.${httpVerb}`,
      dataEffect: (data, action) => {
        const actionLabel = action.name;

        if (httpVerb === "DELETE") {
          if (!isProps(data) && !primitiveCanBeId(data)) {
            throw new TypeError(
              `${actionLabel} must return an object (that will be used to drop "${name}" resource), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyDataEffect(data);
        }
        if (!isProps(data)) {
          throw new TypeError(
            `${actionLabel} must return an object (that will be used to upsert "${name}" resource), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyDataEffect(data);
      },
      compute: (itemId) => store.select(itemId),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      httpActionAffectingOneItem,
    );
    return httpActionAffectingOneItem;
  };
  const GET = (callback, options) =>
    createActionAffectingOneItem("GET", {
      callback,
      applyDataEffect: (data) => {
        const item = store.upsert(data);
        const itemId = item[idKey];
        return itemId;
      },
      compute: (itemId) => store.select(itemId),
      ...options,
    });
  const POST = (callback, options) =>
    createActionAffectingOneItem("POST", {
      callback,
      applyDataEffect: (data) => {
        const item = store.upsert(data);
        const itemId = item[idKey];
        return itemId;
      },
      compute: (itemId) => store.select(itemId),
      ...options,
    });
  const PUT = (callback, options) =>
    createActionAffectingOneItem("PUT", {
      callback,
      ...options,
    });
  const PATCH = (callback, options) =>
    createActionAffectingOneItem("PATCH", {
      callback,
      ...options,
    });
  const DELETE = (callback, options) =>
    createActionAffectingOneItem("DELETE", {
      callback,
      ...options,
    });

  const createActionAffectingManyItems = (
    httpVerb,
    { callback, ...options },
  ) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? (idOrMutableIdArray) => {
            const idArray = store.drop(idOrMutableIdArray);
            return idArray;
          }
        : (dataArray) => {
            const itemArray = store.upsert(dataArray);
            const idArray = itemArray.map((item) => item[idKey]);
            return idArray;
          };

    const httpActionAffectingManyItems = createAction(callback, {
      meta: { httpVerb, httpMany: true, paramScope, resourceInstance, store },
      name: `${name}.${httpVerb}_MANY`,
      data: [],
      dataEffect: applyDataEffect,
      compute: (idArray) => store.selectAll(idArray),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      httpActionAffectingManyItems,
    );
    return httpActionAffectingManyItems;
  };
  const GET_MANY = (callback, options) =>
    createActionAffectingManyItems("GET", { callback, ...options });
  const POST_MANY = (callback, options) =>
    createActionAffectingManyItems("POST", { callback, ...options });
  const PUT_MANY = (callback, options) =>
    createActionAffectingManyItems("PUT", { callback, ...options });
  const PATCH_MANY = (callback, options) =>
    createActionAffectingManyItems("PATCH", { callback, ...options });
  const DELETE_MANY = (callback, options) =>
    createActionAffectingManyItems("DELETE", { callback, ...options });

  return {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    GET_MANY,
    POST_MANY,
    PUT_MANY,
    PATCH_MANY,
    DELETE_MANY,
  };
};
const createHttpHandlerForRelationshipToOneResource = (
  name,
  {
    idKey,
    store,
    propertyName,
    childIdKey,
    childStore,
    resourceInstance,
    resourceLifecycleManager,
  },
) => {
  const createActionAffectingOneItem = (httpVerb, { callback, ...options }) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? (itemId) => {
            const item = store.select(itemId);
            const childItemId = item[propertyName][childIdKey];
            store.upsert({
              [idKey]: itemId,
              [propertyName]: null,
            });
            return childItemId;
          }
        : // callback must return object with the following format:
          // {
          //   [idKey]: 123,
          //   [propertyName]: {
          //     [childIdKey]: 456, ...childProps
          //   }
          // }
          // the following could happen too if there is no relationship
          // {
          //   [idKey]: 123,
          //   [propertyName]: null
          // }
          (data) => {
            const item = store.upsert(data);
            const childItem = item[propertyName];
            const childItemId = childItem ? childItem[childIdKey] : undefined;
            return childItemId;
          };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${httpVerb}`;

    const httpActionAffectingOneItem = createAction(callback, {
      meta: { httpVerb, httpMany: false, resourceInstance, store },
      name: `${name}.${httpVerb}`,
      dataEffect: (data, action) => {
        const actionLabel = action.name;

        if (httpVerb === "DELETE") {
          if (!isProps(data) && !primitiveCanBeId(data)) {
            throw new TypeError(
              `${actionLabel} must return an object (that will be used to drop "${name}" resource), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyDataEffect(data);
        }
        if (!isProps(data)) {
          throw new TypeError(
            `${actionLabel} must return an object (that will be used to upsert "${name}" resource), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyDataEffect(data);
      },
      compute: (childItemId) => childStore.select(childItemId),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      httpActionAffectingOneItem,
    );
    return httpActionAffectingOneItem;
  };

  const GET = (callback, options) =>
    createActionAffectingOneItem("GET", {
      callback,
      ...options,
    });
  const PUT = (callback, options) =>
    createActionAffectingOneItem("PUT", {
      callback,
      ...options,
    });
  const DELETE = (callback, options) =>
    createActionAffectingOneItem("DELETE", {
      callback,
      ...options,
    });

  // il n'y a pas de many puisque on cible une seule resource
  // genre table.owner -> c'est un seul owner qu'on peut
  // GET -> recup les infos de l'objet
  // PUT -> mettre a jour l'owner de la table
  // DELETE -> supprimer l'owner de la table

  return { GET, PUT, DELETE };
};
const createHttpHandlerRelationshipToManyResource = (
  name,
  {
    idKey,
    store,
    propertyName,
    childIdKey,
    childStore,
    resourceInstance,
    resourceLifecycleManager,
  } = {},
) => {
  // idéalement s'il y a un GET sur le store originel on voudrait ptet le reload
  // parce que le store originel peut retourner cette liste ou etre impacté
  // pour l'instant on ignore

  // one item AND many child items
  const createActionAffectingOneItem = (httpVerb, { callback, ...options }) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? ([itemId, childItemId]) => {
            const item = store.select(itemId);
            const childItemArray = item[propertyName];
            const childItemArrayWithoutThisOne = [];
            let found = false;
            for (const childItemCandidate of childItemArray) {
              const childItemCandidateId = childItemCandidate[childIdKey];
              if (childItemCandidateId === childItemId) {
                found = true;
              } else {
                childItemArrayWithoutThisOne.push(childItemCandidate);
              }
            }
            if (found) {
              store.upsert({
                [idKey]: itemId,
                [propertyName]: childItemArrayWithoutThisOne,
              });
            }
            return childItemId;
          }
        : (childData) => {
            const childItem = childStore.upsert(childData); // if the child item was used it will reload thanks to signals
            const childItemId = childItem[childIdKey];
            return childItemId;
          };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${httpVerb}`;

    const httpActionAffectingOneItem = createAction(callback, {
      meta: { httpVerb, httpMany: false, resourceInstance, store: childStore },
      name: `${name}.${httpVerb}`,
      dataEffect: (data, action) => {
        const actionLabel = action.name;

        if (httpVerb === "DELETE") {
          // For DELETE in many relationship, we expect [itemId, childItemId] array
          if (!Array.isArray(data) || data.length !== 2) {
            throw new TypeError(
              `${actionLabel} must return an array [itemId, childItemId] (that will be used to remove relationship), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyDataEffect(data);
        }
        if (!isProps(data)) {
          throw new TypeError(
            `${actionLabel} must return an object (that will be used to upsert child item), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyDataEffect(data);
      },
      compute: (childItemId) => childStore.select(childItemId),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      httpActionAffectingOneItem,
    );
    return httpActionAffectingOneItem;
  };
  const GET = (callback, options) =>
    createActionAffectingOneItem("GET", {
      callback,
      ...options,
    });
  // le souci que je vois ici c'est que je n'ai pas la moindre idée d'ou
  // inserer le childItem (ni meme s'il doit etre visible)
  // je pense que la bonne chose a faire est de reload
  // l'objet user.tables s'il en existe un
  // TODO: find any GET action on "user" and reload it
  const POST = (callback, options) =>
    createActionAffectingOneItem("POST", {
      callback,
      ...options,
    });
  const PUT = (callback, options) =>
    createActionAffectingOneItem("PUT", {
      callback,
      ...options,
    });
  const PATCH = (callback, options) =>
    createActionAffectingOneItem("PATCH", {
      callback,
      ...options,
    });
  const DELETE = (callback, options) =>
    createActionAffectingOneItem("DELETE", {
      callback,
      ...options,
    });

  const createActionAffectingManyItems = (
    httpVerb,
    { callback, ...options },
  ) => {
    const applyDataEffect =
      httpVerb === "GET"
        ? (data) => {
            // callback must return object with the following format:
            // {
            //   [idKey]: 123,
            //   [propertyName]: [
            //      { [childIdKey]: 456, ...childProps },
            //      { [childIdKey]: 789, ...childProps },
            //      ...
            //   ]
            // }
            // the array can be empty
            const item = store.upsert(data);
            const childItemArray = item[propertyName];
            const childItemIdArray = childItemArray.map(
              (childItem) => childItem[childIdKey],
            );
            return childItemIdArray;
          }
        : httpVerb === "DELETE"
          ? ([itemIdOrMutableId, childItemIdOrMutableIdArray]) => {
              const item = store.select(itemIdOrMutableId);
              const childItemArray = item[propertyName];
              const deletedChildItemIdArray = [];
              const childItemArrayWithoutThoose = [];
              let someFound = false;
              const deletedChildItemArray = childStore.select(
                childItemIdOrMutableIdArray,
              );
              for (const childItemCandidate of childItemArray) {
                if (deletedChildItemArray.includes(childItemCandidate)) {
                  someFound = true;
                  deletedChildItemIdArray.push(childItemCandidate[childIdKey]);
                } else {
                  childItemArrayWithoutThoose.push(childItemCandidate);
                }
              }
              if (someFound) {
                store.upsert({
                  [idKey]: item[idKey],
                  [propertyName]: childItemArrayWithoutThoose,
                });
              }
              return deletedChildItemIdArray;
            }
          : (childDataArray) => {
              // hum ici aussi on voudra reload "user" pour POST
              // les autres les signals se charge de reload si visible
              const childItemArray = childStore.upsert(childDataArray);
              const childItemIdArray = childItemArray.map(
                (childItem) => childItem[childIdKey],
              );
              return childItemIdArray;
            };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${httpVerb}[many]`;

    const httpActionAffectingManyItem = createAction(callback, {
      meta: { httpVerb, httpMany: true, resourceInstance, store: childStore },
      name: `${name}.${httpVerb}[many]`,
      data: [],
      dataEffect: (data, action) => {
        const actionLabel = action.name;

        if (httpVerb === "GET") {
          if (!isProps(data)) {
            throw new TypeError(
              `${actionLabel} must return an object (that will be used to upsert "${name}" resource with many relationships), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyDataEffect(data);
        }
        if (httpVerb === "DELETE") {
          // For DELETE_MANY in many relationship, we expect [itemId, childItemIdArray] array
          if (
            !Array.isArray(data) ||
            data.length !== 2 ||
            !Array.isArray(data[1])
          ) {
            throw new TypeError(
              `${actionLabel} must return an array [itemId, childItemIdArray] (that will be used to remove relationships), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyDataEffect(data);
        }
        // For POST, PUT, PATCH - expect array of objects
        if (!Array.isArray(data)) {
          throw new TypeError(
            `${actionLabel} must return an array of objects (that will be used to upsert child items), received ${data}.
           ${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyDataEffect(data);
      },
      compute: (childItemIdArray) => childStore.selectAll(childItemIdArray),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      httpActionAffectingManyItem,
    );
    return httpActionAffectingManyItem;
  };

  const GET_MANY = (callback, options) =>
    createActionAffectingManyItems("GET", { callback, ...options });
  const POST_MANY = (callback, options) =>
    createActionAffectingManyItems("POST", { callback, ...options });
  const PUT_MANY = (callback, options) =>
    createActionAffectingManyItems("PUT", { callback, ...options });
  const PATCH_MANY = (callback, options) =>
    createActionAffectingManyItems("PATCH", { callback, ...options });
  const DELETE_MANY = (callback, options) =>
    createActionAffectingManyItems("DELETE", { callback, ...options });

  return {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    GET_MANY,
    POST_MANY,
    PUT_MANY,
    PATCH_MANY,
    DELETE_MANY,
  };
};

const resource = (
  name,
  { idKey, mutableIdKeys = [], rerunOn, httpHandler, ...rest } = {},
) => {
  if (idKey === undefined) {
    idKey = mutableIdKeys.length === 0 ? "id" : mutableIdKeys[0];
  }
  const resourceInstance = {
    isResource: true,
    name,
    idKey,
    httpActions: {},
    addItemSetup: undefined,
    httpHandler,
  };
  if (!httpHandler) {
    const setupCallbackSet = new Set();
    const addItemSetup = (callback) => {
      setupCallbackSet.add(callback);
    };
    resourceInstance.addItemSetup = addItemSetup;

    const itemPrototype = {
      [Symbol.toStringTag]: name,
      toString() {
        let string = `${name}`;
        if (mutableIdKeys.length) {
          for (const mutableIdKey of mutableIdKeys) {
            const mutableId = this[mutableIdKey];
            if (mutableId !== undefined) {
              string += `[${mutableIdKey}=${mutableId}]`;
              return string;
            }
          }
        }
        const id = this[idKey];
        if (id) {
          string += `[${idKey}=${id}]`;
        }
        return string;
      },
    };

    const store = arraySignalStore([], idKey, {
      mutableIdKeys,
      name: `${name} store`,
      createItem: (props) => {
        const item = Object.create(itemPrototype);
        Object.assign(item, props);
        Object.defineProperty(item, SYMBOL_IDENTITY, {
          value: item[idKey],
          writable: false,
          enumerable: false,
          configurable: false,
        });
        for (const setupCallback of setupCallbackSet) {
          setupCallback(item);
        }
        return item;
      },
    });
    const useArray = () => {
      return store.arraySignal.value;
    };
    const useById = (id) => {
      return store.select(idKey, id);
    };

    Object.assign(resourceInstance, {
      useArray,
      useById,
      store,
    });

    httpHandler = createHttpHandlerForRootResource(name, {
      idKey,
      store,
      rerunOn,
      resourceInstance,
      mutableIdKeys,
    });
  }
  resourceInstance.httpHandler = httpHandler;

  // Store the action callback definitions for withParams to use later
  resourceInstance.httpActions = rest;

  // Create HTTP actions
  for (const key of Object.keys(rest)) {
    const method = httpHandler[key];
    if (!method) {
      continue;
    }
    const action = method(rest[key]);
    resourceInstance[key] = action;
  }

  resourceInstance.one = (propertyName, childResource, options) => {
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    resourceInstance.addItemSetup((item) => {
      const childItemIdSignal = signal();
      const updateChildItemId = (value) => {
        const currentChildItemId = childItemIdSignal.peek();
        if (isProps(value)) {
          const childItem = childResource.store.upsert(value);
          const childItemId = childItem[childIdKey];
          if (currentChildItemId === childItemId) {
            return false;
          }
          childItemIdSignal.value = childItemId;
          return true;
        }
        if (primitiveCanBeId(value)) {
          const childItemProps = { [childIdKey]: value };
          const childItem = childResource.store.upsert(childItemProps);
          const childItemId = childItem[childIdKey];
          if (currentChildItemId === childItemId) {
            return false;
          }
          childItemIdSignal.value = childItemId;
          return true;
        }
        if (currentChildItemId === undefined) {
          return false;
        }
        childItemIdSignal.value = undefined;
        return true;
      };
      updateChildItemId(item[propertyName]);

      const childItemSignal = computed(() => {
        const childItemId = childItemIdSignal.value;
        const childItem = childResource.store.select(childItemId);
        return childItem;
      });
      const childItemFacadeSignal = computed(() => {
        const childItem = childItemSignal.value;
        if (childItem) {
          const childItemCopy = Object.create(
            Object.getPrototypeOf(childItem),
            Object.getOwnPropertyDescriptors(childItem),
          );
          Object.defineProperty(childItemCopy, SYMBOL_OBJECT_SIGNAL, {
            value: childItemSignal,
            writable: false,
            enumerable: false,
            configurable: false,
          });
          return childItemCopy;
        }
        const nullItem = {
          [SYMBOL_OBJECT_SIGNAL]: childItemSignal,
          valueOf: () => null,
        };
        return nullItem;
      });

      Object.defineProperty(item, propertyName, {
        get: () => {
          const childItemFacade = childItemFacadeSignal.value;
          return childItemFacade;
        },
        set: (value) => {
          if (!updateChildItemId(value)) {
            return;
          }
        },
      });
    });
    const httpHandlerForRelationshipToOneChild =
      createHttpHandlerForRelationshipToOneResource(childName, {
        idKey,
        store: resourceInstance.store,
        propertyName,
        childIdKey,
        childStore: childResource.store,
        resourceInstance,
        resourceLifecycleManager,
      });
    return resource(childName, {
      idKey: childIdKey,
      httpHandler: httpHandlerForRelationshipToOneChild,
      ...options,
    });
  };
  resourceInstance.many = (propertyName, childResource, options) => {
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    resourceInstance.addItemSetup((item) => {
      const childItemIdArraySignal = signal([]);
      const updateChildItemIdArray = (valueArray) => {
        const currentIdArray = childItemIdArraySignal.peek();

        if (!Array.isArray(valueArray)) {
          if (currentIdArray.length === 0) {
            return;
          }
          childItemIdArraySignal.value = [];
          return;
        }

        let i = 0;
        const idArray = [];
        let modified = false;
        while (i < valueArray.length) {
          const value = valueArray[i];
          const currentIdAtIndex = currentIdArray[idArray.length];
          i++;
          if (isProps(value)) {
            const childItem = childResource.store.upsert(value);
            const childItemId = childItem[childIdKey];
            if (currentIdAtIndex !== childItemId) {
              modified = true;
            }
            idArray.push(childItemId);
            continue;
          }
          if (primitiveCanBeId(value)) {
            const childItemProps = { [childIdKey]: value };
            const childItem = childResource.store.upsert(childItemProps);
            const childItemId = childItem[childIdKey];
            if (currentIdAtIndex !== childItemId) {
              modified = true;
            }
            idArray.push(childItemId);
            continue;
          }
        }
        if (modified || currentIdArray.length !== idArray.length) {
          childItemIdArraySignal.value = idArray;
        }
      };
      updateChildItemIdArray(item[propertyName]);

      const childItemArraySignal = computed(() => {
        const childItemIdArray = childItemIdArraySignal.value;
        const childItemArray = childResource.store.selectAll(childItemIdArray);
        Object.defineProperty(childItemArray, SYMBOL_OBJECT_SIGNAL, {
          value: childItemArraySignal,
          writable: false,
          enumerable: false,
          configurable: false,
        });
        return childItemArray;
      });

      Object.defineProperty(item, propertyName, {
        get: () => {
          const childItemArray = childItemArraySignal.value;
          return childItemArray;
        },
        set: (value) => {
          updateChildItemIdArray(value);
        },
      });
    });
    const httpHandleForChildManyResource =
      createHttpHandlerRelationshipToManyResource(childName, {
        idKey,
        store: resourceInstance.store,
        propertyName,
        childIdKey,
        childStore: childResource.store,
        resourceInstance,
        resourceLifecycleManager,
      });
    return resource(childName, {
      idKey: childIdKey,
      httpHandler: httpHandleForChildManyResource,
      ...options,
    });
  };

  /**
   * Creates a parameterized version of the resource with isolated resource lifecycle behavior.
   *
   * Actions from parameterized resources only trigger rerun/reset for other actions with
   * identical parameters, preventing cross-contamination between different parameter sets.
   *
   * @param {Object} params - Parameters to bind to all actions of this resource (required)
   * @param {Object} options - Additional options for the parameterized resource
   * @param {Array} options.dependencies - Array of resources that should trigger autorerun when modified
   * @param {Object} options.rerunOn - Configuration for when to rerun GET/GET_MANY actions
   * @param {false|Array|string} options.rerunOn.GET - HTTP verbs that trigger GET rerun (false = reset on DELETE)
   * @param {false|Array|string} options.rerunOn.GET_MANY - HTTP verbs that trigger GET_MANY rerun (false = reset on DELETE)
   * @returns {Object} A new resource instance with parameter-bound actions and isolated lifecycle
   * @see {@link ./docs/resource_with_params.md} for detailed documentation and examples
   *
   * @example
   * const ROLE = resource("role", { GET: (params) => fetchRole(params) });
   * const adminRoles = ROLE.withParams({ canlogin: true });
   * const guestRoles = ROLE.withParams({ canlogin: false });
   * // adminRoles and guestRoles have isolated autorerun behavior
   *
   * @example
   * // Cross-resource dependencies
   * const role = resource("role");
   * const database = resource("database");
   * const tables = resource("tables");
   * const ROLE_WITH_OWNERSHIP = role.withParams({ owners: true }, {
   *   dependencies: [role, database, tables],
   * });
   * // ROLE_WITH_OWNERSHIP.GET_MANY will autorerun when any table/database/role is POST/DELETE
   */
  const withParams = (params, options = {}) => {
    // Require parameters
    if (!params || Object.keys(params).length === 0) {
      throw new Error(`resource(${name}).withParams() requires parameters`);
    }

    const { dependencies = [], rerunOn: customRerunOn } = options;

    // Generate unique param scope for these parameters
    const paramScopeObject = getParamScope(params);

    // Use custom rerunOn settings if provided, otherwise use resource defaults
    const finalRerunOn = customRerunOn || rerunOn;

    // Create a new httpHandler with the param scope for isolated autorerun
    const parameterizedHttpHandler = createHttpHandlerForRootResource(name, {
      idKey,
      store: resourceInstance.store,
      rerunOn: finalRerunOn,
      paramScope: paramScopeObject,
      dependencies,
      resourceInstance,
      mutableIdKeys,
    });

    // Create parameterized resource
    const parameterizedResource = {
      isResource: true,
      name,
      idKey,
      useArray: resourceInstance.useArray,
      useById: resourceInstance.useById,
      store: resourceInstance.store,
      addItemSetup: resourceInstance.addItemSetup,
      httpHandler: parameterizedHttpHandler,
      one: resourceInstance.one,
      many: resourceInstance.many,
      dependencies, // Store dependencies for debugging/inspection
      httpActions: resourceInstance.httpActions,
    };

    // Create HTTP actions from the parameterized handler and bind parameters
    for (const key of Object.keys(resourceInstance.httpActions)) {
      const method = parameterizedHttpHandler[key];
      if (method) {
        const action = method(resourceInstance.httpActions[key]);
        // Bind the parameters to get a parameterized action instance
        parameterizedResource[key] = action.bindParams(params);
      }
    }

    // Add withParams method to the parameterized resource for chaining
    parameterizedResource.withParams = (newParams, newOptions = {}) => {
      if (!newParams || Object.keys(newParams).length === 0) {
        throw new Error(`resource(${name}).withParams() requires parameters`);
      }
      // Merge current params with new ones for chaining
      const mergedParams = { ...params, ...newParams };
      // Merge options, with new options taking precedence
      const mergedOptions = {
        dependencies,
        rerunOn: finalRerunOn,
        ...newOptions,
      };
      return withParams(mergedParams, mergedOptions);
    };

    return parameterizedResource;
  };

  resourceInstance.withParams = withParams;

  return resourceInstance;
};

const isProps = (value) => {
  return value !== null && typeof value === "object";
};

const addIntoArray = (array, ...valuesToAdd) => {
  if (valuesToAdd.length === 1) {
    const [valueToAdd] = valuesToAdd;
    const arrayWithThisValue = [];
    for (const value of array) {
      if (value === valueToAdd) {
        return array;
      }
      arrayWithThisValue.push(value);
    }
    arrayWithThisValue.push(valueToAdd);
    return arrayWithThisValue;
  }

  const existingValueSet = new Set();
  const arrayWithTheseValues = [];
  for (const existingValue of array) {
    arrayWithTheseValues.push(existingValue);
    existingValueSet.add(existingValue);
  }
  let hasNewValues = false;
  for (const valueToAdd of valuesToAdd) {
    if (existingValueSet.has(valueToAdd)) {
      continue;
    }
    arrayWithTheseValues.push(valueToAdd);
    hasNewValues = true;
  }
  return hasNewValues ? arrayWithTheseValues : array;
};

const removeFromArray = (array, ...valuesToRemove) => {
  if (valuesToRemove.length === 1) {
    const [valueToRemove] = valuesToRemove;
    const arrayWithoutThisValue = [];
    let found = false;
    for (const value of array) {
      if (value === valueToRemove) {
        found = true;
        continue;
      }
      arrayWithoutThisValue.push(value);
    }
    if (!found) {
      return array;
    }
    return arrayWithoutThisValue;
  }

  const valuesToRemoveSet = new Set(valuesToRemove);
  const arrayWithoutTheseValues = [];
  let hasRemovedValues = false;
  for (const value of array) {
    if (valuesToRemoveSet.has(value)) {
      hasRemovedValues = true;
      continue;
    }
    arrayWithoutTheseValues.push(value);
  }
  return hasRemovedValues ? arrayWithoutTheseValues : array;
};

const useArraySignalMembership = (arraySignal, id) => {
  const array = arraySignal.value;
  const isMember = array.includes(id);

  const add = useCallback(() => {
    const arrayWithId = addIntoArray(arraySignal.peek(), id);
    arraySignal.value = arrayWithId;
    return arrayWithId;
  }, []);

  const remove = useCallback(() => {
    const arrayWithoutId = removeFromArray(arraySignal.peek(), id);
    arraySignal.value = arrayWithoutId;
    return arrayWithoutId;
  }, []);

  return [isMember, add, remove];
};

/**
 * Creates a signal that stays synchronized with an external value,
 * only updating the signal when the value actually changes.
 *
 * This hook solves a common reactive UI pattern where:
 * 1. A signal controls a UI element (like an input field)
 * 2. The UI element can be modified by user interaction
 * 3. When the external "source of truth" changes, it should take precedence
 *
 * @param {any} value - The external value to sync with (the "source of truth")
 * @param {any} [initialValue] - Optional initial value for the signal (defaults to value)
 * @returns {Signal} A signal that tracks the external value but allows temporary local changes
 *
 * @example
 * const FileNameEditor = ({ file }) => {
 *   // Signal stays in sync with file.name, but allows user editing
 *   const nameSignal = useSignalSync(file.name);
 *
 *   return (
 *     <Editable
 *       valueSignal={nameSignal}  // User can edit this
 *       action={renameFileAction} // Saves changes
 *     />
 *   );
 * };
 *
 * // Scenario:
 * // 1. file.name = "doc.txt", nameSignal.value = "doc.txt"
 * // 2. User types "report" -> nameSignal.value = "report.txt"
 * // 3. External update: file.name = "shared-doc.txt"
 * // 4. Next render: nameSignal.value = "shared-doc.txt" (model wins!)
 *
 */

const useSignalSync = (value, initialValue = value) => {
  const signal = useSignal(initialValue);
  const previousValueRef = useRef(value);

  // Only update signal when external value actually changes
  // This preserves user input between external changes
  if (previousValueRef.current !== value) {
    previousValueRef.current = value;
    signal.value = value; // Model takes precedence
  }

  return signal;
};

/**
 * Picks the best initial value from three options using a simple priority system.
 *
 * @param {any} externalValue - Value from props or parent component
 * @param {any} fallbackValue - Backup value if external value isn't useful
 * @param {any} defaultValue - Final fallback (usually empty/neutral value)
 *
 * @returns {any} The chosen value using this priority:
 *   1. externalValue (if provided and different from default)
 *   2. fallbackValue (if external value is missing/same as default)
 *   3. defaultValue (if nothing else works)
 *
 * @example
 * resolveInitialValue("hello", "backup", "") → "hello"
 * resolveInitialValue(undefined, "backup", "") → "backup"
 * resolveInitialValue("", "backup", "") → "backup" (empty same as default)
 */
const resolveInitialValue = (
  externalValue,
  fallbackValue,
  defaultValue,
) => {
  if (externalValue !== undefined && externalValue !== defaultValue) {
    return externalValue;
  }
  if (fallbackValue !== undefined) {
    return fallbackValue;
  }
  return defaultValue;
};

/**
 * Hook that syncs external value changes to a setState function.
 * Always syncs when external value changes, regardless of what it changes to.
 *
 * @param {any} externalValue - Value from props or parent component to watch for changes
 * @param {any} defaultValue - Default value to use when external value is undefined
 * @param {Function} setValue - Function to call when external value changes
 * @param {string} name - Parameter name for debugging
 */
const useExternalValueSync = (
  externalValue,
  defaultValue,
  setValue,
  name = "",
) => {
  // Track external value changes and sync them
  const previousExternalValueRef = useRef(externalValue);
  if (externalValue !== previousExternalValueRef.current) {
    previousExternalValueRef.current = externalValue;
    // Always sync external value changes - use defaultValue only when external is undefined
    const valueToSet =
      externalValue === undefined ? defaultValue : externalValue;
    setValue(valueToSet);
  }
};

const UNSET$1 = {};
const useInitialValue = (compute) => {
  const initialValueRef = useRef(UNSET$1);
  let initialValue = initialValueRef.current;
  if (initialValue !== UNSET$1) {
    return initialValue;
  }

  initialValue = compute();
  initialValueRef.current = initialValue;
  return initialValue;
};

const FIRST_MOUNT = {};
const useStateArray = (
  externalValue,
  fallbackValue,
  defaultValue = [],
) => {
  const initialValueRef = useRef(FIRST_MOUNT);
  if (initialValueRef.current === FIRST_MOUNT) {
    const initialValue = resolveInitialValue(
      externalValue,
      fallbackValue,
      defaultValue,
    );
    initialValueRef.current = initialValue;
  }
  const initialValue = initialValueRef.current;
  const [array, setArray] = useState(initialValue);

  // Only sync external value changes if externalValue was explicitly provided
  useExternalValueSync(externalValue, defaultValue, setArray, "state_array");

  const add = useCallback((valueToAdd) => {
    setArray((array) => {
      const newArray = addIntoArray(array, valueToAdd);
      return newArray;
    });
  }, []);

  const remove = useCallback((valueToRemove) => {
    setArray((array) => {
      return removeFromArray(array, valueToRemove);
    });
  }, []);

  const reset = useCallback(() => {
    setArray(initialValue);
  }, [initialValue]);

  return [array, add, remove, reset];
};

/**
 * Creates a function that generates abort signals, automatically cancelling previous requests.
 *
 * This prevents race conditions when multiple fetch requests are triggered rapidly,
 * ensuring only the most recent request completes while canceling outdated ones.
 *
 * @param {string} [reason="Request superseded"] - Custom reason for the abort signal
 * @returns {() => AbortSignal} A function that returns a fresh AbortSignal and cancels the previous one
 *
 * @example
 * // Setup the request canceller
 * const cancelPrevious = createRequestCanceller();
 *
 * // Use it in sequential fetch operations
 * const searchUsers = async (query) => {
 *   const signal = cancelPrevious(); // Cancels previous search
 *   const response = await fetch(`/api/users?q=${query}`, { signal });
 *   return response.json();
 * };
 *
 * // Rapid successive calls - only the last one will complete
 * searchUsers("john");  // Will be aborted
 * searchUsers("jane");  // Will be aborted
 * searchUsers("jack");  // Will complete
 *
 * @example
 * // With custom reason
 * const cancelPrevious = createRequestCanceller("Search cancelled");
 */
const createRequestCanceller = (reason = "Request superseded") => {
  let previousAbortController;
  return () => {
    if (previousAbortController) {
      const abortError = new DOMException(reason, "AbortError");
      abortError.isHandled = true;
      previousAbortController.abort(abortError);
    }
    previousAbortController = new AbortController();
    return previousAbortController.signal;
  };
};
window.addEventListener("unhandledrejection", (event) => {
  if (event.reason?.isHandled) {
    event.preventDefault(); // 💥 empêche les "uncaught rejection" devtools pour nos cancellations
  }
});

/**
 * Merges a component's base className with className received from props.
 *
 * ```jsx
 * const MyButton = ({ className, children }) => (
 *   <button className={withPropsClassName("btn", className)}>
 *     {children}
 *   </button>
 * );
 *
 * // Usage:
 * <MyButton className="primary large" /> // Results in "btn primary large"
 * <MyButton /> // Results in "btn"
 * ```
 *
 * @param {string} baseClassName - The component's base CSS class name
 * @param {string} [classNameFromProps] - Additional className from props (optional)
 * @returns {string} The merged className string
 */
const withPropsClassName = (baseClassName, classNameFromProps) => {
  if (!classNameFromProps) {
    return baseClassName;
  }

  // Trim and normalize whitespace from the props className
  const trimmedPropsClassName = classNameFromProps.trim();
  if (!trimmedPropsClassName) {
    return baseClassName;
  }

  // Normalize multiple spaces to single spaces and combine
  const normalizedPropsClassName = trimmedPropsClassName.replace(/\s+/g, " ");
  if (!baseClassName) {
    return normalizedPropsClassName;
  }
  return `${baseClassName} ${normalizedPropsClassName}`;
};

const BoxFlowContext = createContext();

const normalizeSpacingStyle = (value, property = "padding") => {
  const cssSize = sizeSpacingScale[value];
  return cssSize || stringifyStyle(value, property);
};
const normalizeTypoStyle = (value, property = "fontSize") => {
  const cssSize = sizeTypoScale[value];
  return cssSize || stringifyStyle(value, property);
};

const PASS_THROUGH = { name: "pass_through" };
const applyOnCSSProp = (cssStyle) => {
  return (value) => {
    return { [cssStyle]: value };
  };
};
const applyOnTwoCSSProps = (cssStyleA, cssStyleB) => {
  return (value) => {
    return {
      [cssStyleA]: value,
      [cssStyleB]: value,
    };
  };
};
const applyToCssPropWhenTruthy = (
  cssProp,
  cssPropValue,
  cssPropValueOtherwise,
) => {
  return (value, styleContext) => {
    if (value) {
      return { [cssProp]: cssPropValue };
    }
    if (cssPropValueOtherwise === undefined) {
      return null;
    }
    if (value === undefined) {
      return null;
    }
    if (styleContext.styles[cssProp] !== undefined) {
      // keep any value previously set
      return null;
    }
    return { [cssProp]: cssPropValueOtherwise };
  };
};
const applyOnTwoProps = (propA, propB) => {
  return (value, context) => {
    const firstProp = All_PROPS[propA];
    const secondProp = All_PROPS[propB];
    const firstPropResult = firstProp(value, context);
    const secondPropResult = secondProp(value, context);
    if (firstPropResult && secondPropResult) {
      return {
        ...firstPropResult,
        ...secondPropResult,
      };
    }
    return firstPropResult || secondPropResult;
  };
};

const FLOW_PROPS = {
  // all are handled by data-attributes
  inline: () => {},
  box: () => {},
  row: () => {},
  column: () => {},
};
const OUTER_SPACING_PROPS = {
  margin: PASS_THROUGH,
  marginLeft: PASS_THROUGH,
  marginRight: PASS_THROUGH,
  marginTop: PASS_THROUGH,
  marginBottom: PASS_THROUGH,
  marginX: applyOnTwoCSSProps("marginLeft", "marginRight"),
  marginY: applyOnTwoCSSProps("marginTop", "marginBottom"),
};
const INNER_SPACING_PROPS = {
  padding: PASS_THROUGH,
  paddingLeft: PASS_THROUGH,
  paddingRight: PASS_THROUGH,
  paddingTop: PASS_THROUGH,
  paddingBottom: PASS_THROUGH,
  paddingX: applyOnTwoCSSProps("paddingLeft", "paddingRight"),
  paddingY: applyOnTwoCSSProps("paddingTop", "paddingBottom"),
};
const hasWidthHeight = (context) => {
  return (
    (context.styles.width || context.remainingProps.width) &&
    (context.styles.height || context.remainingProps.height)
  );
};
const DIMENSION_PROPS = {
  boxSizing: PASS_THROUGH,
  width: PASS_THROUGH,
  minWidth: PASS_THROUGH,
  maxWidth: PASS_THROUGH,
  height: PASS_THROUGH,
  minHeight: PASS_THROUGH,
  maxHeight: PASS_THROUGH,
  square: (v, context) => {
    if (!v) {
      return null;
    }
    if (hasWidthHeight(context)) {
      // width/height are defined, remove aspect ratio, we explicitely allow rectanglular shapes
      return null;
    }
    return {
      aspectRatio: "1/1",
    };
  },
  circle: (v, context) => {
    if (!v) {
      return null;
    }
    return {
      aspectRatio: hasWidthHeight(context) ? undefined : "1/1",
      borderRadius: "100%",
    };
  },
  expand: applyOnTwoProps("expandX", "expandY"),
  shrink: applyOnTwoProps("shrinkX", "shrinkY"),
  // apply after width/height to override if both are set
  expandX: (value, { parentBoxFlow }) => {
    if (!value) {
      return null;
    }
    if (parentBoxFlow === "column" || parentBoxFlow === "inline-column") {
      return { flexGrow: 1, flexBasis: "0%" }; // Grow horizontally in row
    }
    if (parentBoxFlow === "row") {
      return { minWidth: "100%", width: "auto" }; // Take full width in column
    }
    return { minWidth: "100%", width: "auto" }; // Take full width outside flex
  },
  expandY: (value, { parentBoxFlow }) => {
    if (!value) {
      return null;
    }
    if (parentBoxFlow === "column") {
      return { minHeight: "100%", height: "auto" }; // Make column full height
    }
    if (parentBoxFlow === "row" || parentBoxFlow === "inline-row") {
      return { flexGrow: 1, flexBasis: "0%" }; // Make row full height
    }
    return { minHeight: "100%", height: "auto" }; // Take full height outside flex
  },
  shrinkX: (value, { parentBoxFlow }) => {
    if (parentBoxFlow === "row" || parentBoxFlow === "inline-row") {
      if (!value || value === "0") {
        return { flexShrink: 0 };
      }
      return { flexShrink: 1 };
    }
    return { maxWidth: "100%" };
  },
  shrinkY: (value, { parentBoxFlow }) => {
    if (parentBoxFlow === "column" || parentBoxFlow === "inline-column") {
      if (!value || value === "0") {
        return { flexShrink: 0 };
      }
      return { flexShrink: 1 };
    }
    return { maxHeight: "100%" };
  },

  scaleX: (value) => {
    return { transform: `scaleX(${stringifyStyle(value, "scaleX")})` };
  },
  scaleY: (value) => {
    return { transform: `scaleY(${value})` };
  },
  scale: (value) => {
    if (Array.isArray(value)) {
      const [x, y] = value;
      return { transform: `scale(${x}, ${y})` };
    }
    return { transform: `scale(${value})` };
  },
  scaleZ: (value) => {
    return { transform: `scaleZ(${value})` };
  },
};
const POSITION_PROPS = {
  // For row, selfAlignX uses auto margins for positioning
  // NOTE: Auto margins only work effectively for positioning individual items.
  // When multiple adjacent items have the same auto margin alignment (e.g., selfAlignX="end"),
  // only the first item will be positioned as expected because subsequent items
  // will be positioned relative to the previous item's margins, not the container edge.
  selfAlignX: (value, { parentBoxFlow }) => {
    const inRowFlow = parentBoxFlow === "row" || parentBoxFlow === "inline-row";

    if (value === "start") {
      if (inRowFlow) {
        return { alignSelf: "start" };
      }
      return { marginRight: "auto" };
    }
    if (value === "end") {
      if (inRowFlow) {
        return { alignSelf: "end" };
      }
      return { marginLeft: "auto" };
    }
    if (value === "center") {
      if (inRowFlow) {
        return { alignSelf: "center" };
      }
      return { marginLeft: "auto", marginRight: "auto" };
    }
    if (inRowFlow && value !== "stretch") {
      return { alignSelf: value };
    }
    return undefined;
  },
  selfAlignY: (value, { parentBoxFlow }) => {
    const inColumnFlow =
      parentBoxFlow === "column" || parentBoxFlow === "inline-column";

    if (value === "start") {
      if (inColumnFlow) {
        return { alignSelf: "start" };
      }
      return { marginBottom: "auto" };
    }
    if (value === "center") {
      if (inColumnFlow) {
        return { alignSelf: "center" };
      }
      return { marginTop: "auto", marginBottom: "auto" };
    }
    if (value === "end") {
      if (inColumnFlow) {
        return { alignSelf: "end" };
      }
      return { marginTop: "auto" };
    }
    return undefined;
  },
  position: PASS_THROUGH,
  absolute: applyToCssPropWhenTruthy("position", "absolute", "static"),
  relative: applyToCssPropWhenTruthy("position", "relative", "static"),
  fixed: applyToCssPropWhenTruthy("position", "fixed", "static"),
  sticky: applyToCssPropWhenTruthy("position", "sticky", "static"),
  left: (value) => {
    return { left: value === true ? 0 : value };
  },
  // Allow to write <Box sticky top /> instead of <Box sticky top="0" />
  top: (value) => {
    return { top: value === true ? 0 : value };
  },
  bottom: (value) => {
    return { bottom: value === true ? 0 : value };
  },
  right: (value) => {
    return { right: value === true ? 0 : value };
  },

  transform: PASS_THROUGH,
  translateX: (value) => {
    return { transform: `translateX(${value})` };
  },
  translateY: (value) => {
    return { transform: `translateY(${value})` };
  },
  translate: (value) => {
    if (Array.isArray(value)) {
      const [x, y] = value;
      return { transform: `translate(${x}, ${y})` };
    }
    return { transform: `translate(${stringifyStyle(value, "translateX")})` };
  },
  rotateX: (value) => {
    return { transform: `rotateX(${value})` };
  },
  rotateY: (value) => {
    return { transform: `rotateY(${value})` };
  },
  rotateZ: (value) => {
    return { transform: `rotateZ(${value})` };
  },
  rotate: (value) => {
    return { transform: `rotate(${value})` };
  },
  skewX: (value) => {
    return { transform: `skewX(${value})` };
  },
  skewY: (value) => {
    return { transform: `skewY(${value})` };
  },
  skew: (value) => {
    if (Array.isArray(value)) {
      const [x, y] = value;
      return { transform: `skew(${x}, ${y})` };
    }
    return { transform: `skew(${value})` };
  },
};
const TYPO_PROPS = {
  font: applyOnCSSProp("fontFamily"),
  fontFamily: PASS_THROUGH,
  fontWeight: PASS_THROUGH,
  size: applyOnCSSProp("fontSize"),
  fontSize: PASS_THROUGH,
  bold: applyToCssPropWhenTruthy("fontWeight", "bold", "normal"),
  think: applyToCssPropWhenTruthy("fontWeight", "thin", "normal"),
  italic: applyToCssPropWhenTruthy("fontStyle", "italic", "normal"),
  underline: applyToCssPropWhenTruthy("textDecoration", "underline", "none"),
  underlineStyle: applyOnCSSProp("textDecorationStyle"),
  underlineColor: applyOnCSSProp("textDecorationColor"),
  textShadow: PASS_THROUGH,
  lineHeight: PASS_THROUGH,
  color: PASS_THROUGH,
  noWrap: applyToCssPropWhenTruthy("whiteSpace", "nowrap", "normal"),
  pre: applyToCssPropWhenTruthy("whiteSpace", "pre", "normal"),
  preWrap: applyToCssPropWhenTruthy("whiteSpace", "pre-wrap", "normal"),
  preLine: applyToCssPropWhenTruthy("whiteSpace", "pre-line", "normal"),
  userSelect: PASS_THROUGH,
};
const VISUAL_PROPS = {
  outline: PASS_THROUGH,
  outlineStyle: PASS_THROUGH,
  outlineColor: PASS_THROUGH,
  outlineWidth: PASS_THROUGH,
  boxDecorationBreak: PASS_THROUGH,
  boxShadow: PASS_THROUGH,
  background: PASS_THROUGH,
  backgroundColor: PASS_THROUGH,
  backgroundImage: PASS_THROUGH,
  backgroundSize: PASS_THROUGH,
  border: PASS_THROUGH,
  borderTop: PASS_THROUGH,
  borderLeft: PASS_THROUGH,
  borderRight: PASS_THROUGH,
  borderBottom: PASS_THROUGH,
  borderWidth: PASS_THROUGH,
  borderRadius: PASS_THROUGH,
  borderColor: PASS_THROUGH,
  borderStyle: PASS_THROUGH,
  opacity: PASS_THROUGH,
  filter: PASS_THROUGH,
  cursor: PASS_THROUGH,
  transition: PASS_THROUGH,
  overflow: PASS_THROUGH,
  overflowX: PASS_THROUGH,
  overflowY: PASS_THROUGH,
  accentColor: PASS_THROUGH,
};
const CONTENT_PROPS = {
  align: applyOnTwoProps("alignX", "alignY"),
  alignX: (value, { boxFlow }) => {
    if (boxFlow === "row" || boxFlow === "inline-row") {
      if (value === "stretch") {
        return undefined; // this is the default
      }
      return { alignItems: value };
    }
    if (boxFlow === "column" || boxFlow === "inline-column") {
      if (value === "start") {
        return undefined; // this is the default
      }
      return { justifyContent: value };
    }
    return { textAlign: value };
  },
  alignY: (value, { boxFlow }) => {
    if (boxFlow === "row" || boxFlow === "inline-row") {
      if (value === "start") {
        return undefined;
      }
      return {
        justifyContent: value,
      };
    }
    if (boxFlow === "column" || boxFlow === "inline-column") {
      if (value === "stretch") {
        return undefined;
      }
      return { alignItems: value };
    }

    return {
      verticalAlign:
        { center: "middle", start: "top", end: "bottom" }[value] || value,
    };
  },
  spacing: (value, { boxFlow }) => {
    if (
      boxFlow === "row" ||
      boxFlow === "column" ||
      boxFlow === "inline-row" ||
      boxFlow === "inline-column"
    ) {
      return {
        gap: resolveSpacingSize(value, "gap"),
      };
    }
    return undefined;
  },
};
const All_PROPS = {
  ...FLOW_PROPS,
  ...OUTER_SPACING_PROPS,
  ...INNER_SPACING_PROPS,
  ...DIMENSION_PROPS,
  ...POSITION_PROPS,
  ...TYPO_PROPS,
  ...VISUAL_PROPS,
  ...CONTENT_PROPS,
};
const FLOW_PROP_NAME_SET = new Set(Object.keys(FLOW_PROPS));
const OUTER_SPACING_PROP_NAME_SET = new Set(Object.keys(OUTER_SPACING_PROPS));
const INNER_SPACING_PROP_NAME_SET = new Set(Object.keys(INNER_SPACING_PROPS));
const DIMENSION_PROP_NAME_SET = new Set(Object.keys(DIMENSION_PROPS));
const POSITION_PROP_NAME_SET = new Set(Object.keys(POSITION_PROPS));
const TYPO_PROP_NAME_SET = new Set(Object.keys(TYPO_PROPS));
const VISUAL_PROP_NAME_SET = new Set(Object.keys(VISUAL_PROPS));
const CONTENT_PROP_NAME_SET = new Set(Object.keys(CONTENT_PROPS));
const STYLE_PROP_NAME_SET = new Set(Object.keys(All_PROPS));

const COPIED_ON_VISUAL_CHILD_PROP_SET = new Set([
  ...FLOW_PROP_NAME_SET,
  "expand",
  "shrink",
  "expandX",
  "expandY",
  "alignX",
  "alignY",
]);
const HANDLED_BY_VISUAL_CHILD_PROP_SET = new Set([
  ...INNER_SPACING_PROP_NAME_SET,
  ...VISUAL_PROP_NAME_SET,
  ...CONTENT_PROP_NAME_SET,
]);
const getVisualChildStylePropStrategy = (name) => {
  if (COPIED_ON_VISUAL_CHILD_PROP_SET.has(name)) {
    return "copy";
  }
  if (HANDLED_BY_VISUAL_CHILD_PROP_SET.has(name)) {
    return "forward";
  }
  return null;
};

const isStyleProp = (name) => STYLE_PROP_NAME_SET.has(name);
const isCSSVar = (name) => name.startsWith("--");

const getStylePropGroup = (name) => {
  if (FLOW_PROP_NAME_SET.has(name)) {
    return "flow";
  }
  if (OUTER_SPACING_PROP_NAME_SET.has(name)) {
    return "margin";
  }
  if (INNER_SPACING_PROP_NAME_SET.has(name)) {
    return "padding";
  }
  if (DIMENSION_PROP_NAME_SET.has(name)) {
    return "dimension";
  }
  if (POSITION_PROP_NAME_SET.has(name)) {
    return "position";
  }
  if (TYPO_PROP_NAME_SET.has(name)) {
    return "typo";
  }
  if (VISUAL_PROP_NAME_SET.has(name)) {
    return "visual";
  }
  if (CONTENT_PROP_NAME_SET.has(name)) {
    return "content";
  }
  return null;
};
const getNormalizer = (key) => {
  if (key === "borderRadius") {
    return normalizeSpacingStyle;
  }
  const group = getStylePropGroup(key);
  if (group === "margin" || group === "padding") {
    return normalizeSpacingStyle;
  }
  if (group === "typo") {
    return normalizeTypoStyle;
  }
  return normalizeRegularStyle;
};
const normalizeRegularStyle = (
  value,
  name,
  // styleContext, context
) => {
  return stringifyStyle(value, name);
};
const getHowToHandleStyleProp = (name) => {
  const getStyle = All_PROPS[name];
  if (getStyle === PASS_THROUGH) {
    return null;
  }
  return getStyle;
};
const prepareStyleValue = (
  existingValue,
  value,
  name,
  styleContext,
  context,
) => {
  const normalizer = getNormalizer(name);
  const cssValue = normalizer(value, name, styleContext, context);
  const mergedValue = mergeOneStyle(existingValue, cssValue, name, context);
  return mergedValue;
};

// Unified design scale using t-shirt sizes with rem units for accessibility.
// This scale is used for spacing to create visual harmony
// and consistent proportions throughout the design system.
const sizeSpacingScale = {
  xxs: "0.125em", // 0.125 = 2px at 16px base
  xs: "0.25em", // 0.25 = 4px at 16px base
  sm: "0.5em", // 0.5 = 8px at 16px base
  md: "1em", // 1 = 16px at 16px base (base font size)
  lg: "1.5em", // 1.5 = 24px at 16px base
  xl: "2em", // 2 = 32px at 16px base
  xxl: "3em", // 3 = 48px at 16px base
};
sizeSpacingScale.s = sizeSpacingScale.sm;
sizeSpacingScale.m = sizeSpacingScale.md;
sizeSpacingScale.l = sizeSpacingScale.lg;
const sizeSpacingScaleKeys = new Set(Object.keys(sizeSpacingScale));
const isSizeSpacingScaleKey = (key) => {
  return sizeSpacingScaleKeys.has(key);
};
const resolveSpacingSize = (size, property = "padding") => {
  return stringifyStyle(sizeSpacingScale[size] || size, property);
};

const sizeTypoScale = {
  xxs: "0.625rem", // 0.625 = 10px at 16px base (smaller than before for more range)
  xs: "0.75rem", // 0.75 = 12px at 16px base
  sm: "0.875rem", // 0.875 = 14px at 16px base
  md: "1rem", // 1 = 16px at 16px base (base font size)
  lg: "1.125rem", // 1.125 = 18px at 16px base
  xl: "1.25rem", // 1.25 = 20px at 16px base
  xxl: "1.5rem", // 1.5 = 24px at 16px base
};
sizeTypoScale.s = sizeTypoScale.sm;
sizeTypoScale.m = sizeTypoScale.md;
sizeTypoScale.l = sizeTypoScale.lg;

const DEFAULT_DISPLAY_BY_TAG_NAME = {
  "inline": new Set([
    "a",
    "abbr",
    "b",
    "bdi",
    "bdo",
    "br",
    "cite",
    "code",
    "dfn",
    "em",
    "i",
    "kbd",
    "label",
    "mark",
    "q",
    "s",
    "samp",
    "small",
    "span",
    "strong",
    "sub",
    "sup",
    "time",
    "u",
    "var",
    "wbr",
    "area",
    "audio",
    "img",
    "map",
    "track",
    "video",
    "embed",
    "iframe",
    "object",
    "picture",
    "portal",
    "source",
    "svg",
    "math",
    "input",
    "meter",
    "output",
    "progress",
    "select",
    "textarea",
  ]),
  "block": new Set([
    "address",
    "article",
    "aside",
    "blockquote",
    "div",
    "dl",
    "fieldset",
    "figure",
    "footer",
    "form",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "header",
    "hr",
    "main",
    "nav",
    "ol",
    "p",
    "pre",
    "section",
    "table",
    "ul",
    "video",
    "canvas",
    "details",
    "dialog",
    "dd",
    "dt",
    "figcaption",
    "li",
    "summary",
    "caption",
    "colgroup",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
  ]),
  "inline-block": new Set([
    "button",
    "input",
    "select",
    "textarea",
    "img",
    "video",
    "audio",
    "canvas",
    "embed",
    "iframe",
    "object",
  ]),
  "table-cell": new Set(["td", "th"]),
  "table-row": new Set(["tr"]),
  "list-item": new Set(["li"]),
  "none": new Set([
    "head",
    "meta",
    "title",
    "link",
    "style",
    "script",
    "noscript",
    "template",
    "slot",
  ]),
};

// Create a reverse map for quick lookup: tagName -> display value
const TAG_NAME_TO_DEFAULT_DISPLAY = new Map();
for (const display of Object.keys(DEFAULT_DISPLAY_BY_TAG_NAME)) {
  const displayTagnameSet = DEFAULT_DISPLAY_BY_TAG_NAME[display];
  for (const tagName of displayTagnameSet) {
    TAG_NAME_TO_DEFAULT_DISPLAY.set(tagName, display);
  }
}

/**
 * Get the default CSS display value for a given HTML tag name
 * @param {string} tagName - The HTML tag name (case-insensitive)
 * @returns {string} The default display value ("block", "inline", "inline-block", etc.) or "inline" as fallback
 * @example
 * getDefaultDisplay("div")      // "block"
 * getDefaultDisplay("span")     // "inline"
 * getDefaultDisplay("img")      // "inline-block"
 * getDefaultDisplay("unknown")  // "inline" (fallback)
 */
const getDefaultDisplay = (tagName) => {
  const normalizedTagName = tagName.toLowerCase();
  return TAG_NAME_TO_DEFAULT_DISPLAY.get(normalizedTagName) || "inline";
};

const PSEUDO_CLASSES = {
  ":hover": {
    attribute: "data-hover",
    setup: (el, callback) => {
      let onmouseenter = () => {
        callback();
      };
      let onmouseleave = () => {
        callback();
      };

      if (el.tagName === "LABEL") {
        // input.matches(":hover") is true when hovering the label
        // so when label is hovered/not hovered we need to recheck the input too
        const recheckInput = () => {
          if (el.htmlFor) {
            const input = document.getElementById(el.htmlFor);
            if (!input) {
              // cannot find the input for this label in the DOM
              return;
            }
            input.dispatchEvent(
              new CustomEvent(NAVI_CHECK_PSEUDO_STATE_CUSTOM_EVENT),
            );
            return;
          }
          const input = el.querySelector("input, textarea, select");
          if (!input) {
            // label does not contain an input
            return;
          }
          input.dispatchEvent(
            new CustomEvent(NAVI_CHECK_PSEUDO_STATE_CUSTOM_EVENT),
          );
        };
        onmouseenter = () => {
          callback();
          recheckInput();
        };
        onmouseleave = () => {
          callback();
          recheckInput();
        };
      }

      el.addEventListener("mouseenter", onmouseenter);
      el.addEventListener("mouseleave", onmouseleave);
      return () => {
        el.removeEventListener("mouseenter", onmouseenter);
        el.removeEventListener("mouseleave", onmouseleave);
      };
    },
    test: (el) => el.matches(":hover"),
  },
  ":active": {
    attribute: "data-active",
    setup: (el, callback) => {
      el.addEventListener("mousedown", callback);
      document.addEventListener("mouseup", callback);
      return () => {
        el.removeEventListener("mousedown", callback);
        document.removeEventListener("mouseup", callback);
      };
    },
    test: (el) => el.matches(":active"),
  },
  ":visited": {
    attribute: "data-visited",
  },
  ":checked": {
    attribute: "data-checked",
    setup: (el, callback) => {
      if (el.type === "checkbox") {
        // Listen to user interactions
        el.addEventListener("input", callback);
        // Intercept programmatic changes to .checked property
        const originalDescriptor = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "checked",
        );
        Object.defineProperty(el, "checked", {
          get: originalDescriptor.get,
          set(value) {
            originalDescriptor.set.call(this, value);
            callback();
          },
          configurable: true,
        });
        return () => {
          // Restore original property descriptor
          Object.defineProperty(el, "checked", originalDescriptor);
          el.removeEventListener("input", callback);
        };
      }
      if (el.type === "radio") {
        // Listen to changes on the radio group
        const radioSet =
          el.closest("[data-radio-list], fieldset, form") || document;
        radioSet.addEventListener("input", callback);

        // Intercept programmatic changes to .checked property
        const originalDescriptor = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "checked",
        );
        Object.defineProperty(el, "checked", {
          get: originalDescriptor.get,
          set(value) {
            originalDescriptor.set.call(this, value);
            callback();
          },
          configurable: true,
        });
        return () => {
          radioSet.removeEventListener("input", callback);
          // Restore original property descriptor
          Object.defineProperty(el, "checked", originalDescriptor);
        };
      }
      if (el.tagName === "INPUT") {
        el.addEventListener("input", callback);
        return () => {
          el.removeEventListener("input", callback);
        };
      }
      return () => {};
    },
    test: (el) => el.matches(":checked"),
  },
  ":focus": {
    attribute: "data-focus",
    setup: (el, callback) => {
      el.addEventListener("focusin", callback);
      el.addEventListener("focusout", callback);
      return () => {
        el.removeEventListener("focusin", callback);
        el.removeEventListener("focusout", callback);
      };
    },
    test: (el) => {
      if (el.matches(":focus")) {
        return true;
      }
      const focusProxy = el.getAttribute("focus-proxy");
      if (focusProxy) {
        return document.querySelector(`#${focusProxy}`).matches(":focus");
      }
      return false;
    },
  },
  ":focus-visible": {
    attribute: "data-focus-visible",
    setup: (el, callback) => {
      document.addEventListener("keydown", callback);
      document.addEventListener("keyup", callback);
      return () => {
        document.removeEventListener("keydown", callback);
        document.removeEventListener("keyup", callback);
      };
    },
    test: (el) => {
      if (el.matches(":focus-visible")) {
        return true;
      }
      const focusProxy = el.getAttribute("focus-proxy");
      if (focusProxy) {
        return document
          .querySelector(`#${focusProxy}`)
          .matches(":focus-visible");
      }
      return false;
    },
  },
  ":disabled": {
    attribute: "data-disabled",
    add: (el) => {
      if (
        el.tagName === "BUTTON" ||
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      ) {
        el.disabled = true;
      }
    },
    remove: (el) => {
      if (
        el.tagName === "BUTTON" ||
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      ) {
        el.disabled = false;
      }
    },
  },
  ":read-only": {
    attribute: "data-readonly",
    add: (el) => {
      if (
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      ) {
        if (el.type === "checkbox" || el.type === "radio") {
          // there is no readOnly for checkboxes/radios
          return;
        }
        el.readOnly = true;
      }
    },
    remove: (el) => {
      if (
        el.tagName === "INPUT" ||
        el.tagName === "SELECT" ||
        el.tagName === "TEXTAREA"
      ) {
        if (el.type === "checkbox" || el.type === "radio") {
          // there is no readOnly for checkboxes/radios
          return;
        }
        el.readOnly = false;
      }
    },
  },
  ":valid": {
    attribute: "data-valid",
    test: (el) => el.matches(":valid"),
  },
  ":invalid": {
    attribute: "data-invalid",
    test: (el) => el.matches(":invalid"),
  },
  ":-navi-loading": {
    attribute: "data-loading",
  },
  ":-navi-status-info": {
    attribute: "data-status-info",
  },
  ":-navi-status-success": {
    attribute: "data-status-success",
  },
  ":-navi-status-warning": {
    attribute: "data-status-warning",
  },
  ":-navi-status-error": {
    attribute: "data-status-error",
  },
};

const NAVI_PSEUDO_STATE_CUSTOM_EVENT = "navi_pseudo_state";
const NAVI_CHECK_PSEUDO_STATE_CUSTOM_EVENT = "navi_check_pseudo_state";
const dispatchNaviPseudoStateEvent = (element, value, oldValue) => {
  if (!element) {
    return;
  }
  element.dispatchEvent(
    new CustomEvent(NAVI_PSEUDO_STATE_CUSTOM_EVENT, {
      detail: {
        pseudoState: value,
        oldPseudoState: oldValue,
      },
    }),
  );
};

const EMPTY_STATE = {};
const initPseudoStyles = (
  element,
  {
    pseudoClasses,
    pseudoState, // ":disabled", ":read-only", ":-navi-loading", etc...
    effect,
    elementToImpact = element,
    elementListeningPseudoState,
  },
) => {
  if (elementListeningPseudoState === element) {
    console.warn(
      `elementListeningPseudoState should not be the same as element to avoid infinite loop`,
    );
    elementListeningPseudoState = null;
  }

  const onStateChange = (value, oldValue) => {
    effect?.(value, oldValue);
    if (elementListeningPseudoState) {
      dispatchNaviPseudoStateEvent(
        elementListeningPseudoState,
        value,
        oldValue,
      );
    }
  };

  if (!pseudoClasses || pseudoClasses.length === 0) {
    onStateChange(EMPTY_STATE);
    return () => {};
  }

  const [teardown, addTeardown] = createPubSub();

  let state;
  const checkPseudoClasses = () => {
    let someChange = false;
    const currentState = {};
    for (const pseudoClass of pseudoClasses) {
      const pseudoClassDefinition = PSEUDO_CLASSES[pseudoClass];
      if (!pseudoClassDefinition) {
        console.warn(`Unknown pseudo class: ${pseudoClass}`);
        continue;
      }
      let currentValue;
      if (
        pseudoState &&
        Object.hasOwn(pseudoState, pseudoClass) &&
        pseudoState[pseudoClass] !== undefined
      ) {
        currentValue = pseudoState[pseudoClass];
      } else {
        const { test } = pseudoClassDefinition;
        if (test) {
          currentValue = test(element, pseudoState);
        }
      }
      currentState[pseudoClass] = currentValue;
      const oldValue = state ? state[pseudoClass] : undefined;
      if (oldValue !== currentValue || !state) {
        someChange = true;
        const { attribute, add, remove } = pseudoClassDefinition;
        if (currentValue) {
          if (attribute) {
            elementToImpact.setAttribute(attribute, "");
          }
          add?.(element);
        } else {
          if (attribute) {
            elementToImpact.removeAttribute(attribute);
          }
          remove?.(element);
        }
      }
    }
    if (!someChange) {
      return;
    }
    const oldState = state;
    state = currentState;
    onStateChange(state, oldState);
  };

  element.addEventListener(NAVI_PSEUDO_STATE_CUSTOM_EVENT, (event) => {
    const oldState = event.detail.oldPseudoState;
    state = event.detail.pseudoState;
    onStateChange(state, oldState);
  });
  element.addEventListener(NAVI_CHECK_PSEUDO_STATE_CUSTOM_EVENT, () => {
    checkPseudoClasses();
  });

  for (const pseudoClass of pseudoClasses) {
    const pseudoClassDefinition = PSEUDO_CLASSES[pseudoClass];
    if (!pseudoClassDefinition) {
      console.warn(`Unknown pseudo class: ${pseudoClass}`);
      continue;
    }
    const { setup } = pseudoClassDefinition;
    if (setup) {
      const cleanup = setup(element, () => {
        checkPseudoClasses();
      });
      addTeardown(cleanup);
    }
  }
  checkPseudoClasses();
  // just in case + catch use forcing them in chrome devtools
  const interval = setInterval(() => {
    checkPseudoClasses();
  }, 1_000);
  addTeardown(() => {
    clearInterval(interval);
  });

  return teardown;
};

const applyStyle = (
  element,
  style,
  pseudoState,
  pseudoNamedStyles,
  preventInitialTransition,
) => {
  if (!element) {
    return;
  }
  const styleToApply = getStyleToApply(style, pseudoState, pseudoNamedStyles);
  updateStyle(element, styleToApply, preventInitialTransition);
};

const PSEUDO_STATE_DEFAULT = {};
const PSEUDO_NAMED_STYLES_DEFAULT = {};
const getStyleToApply = (styles, pseudoState, pseudoNamedStyles) => {
  if (
    !pseudoState ||
    pseudoState === PSEUDO_STATE_DEFAULT ||
    !pseudoNamedStyles ||
    pseudoNamedStyles === PSEUDO_NAMED_STYLES_DEFAULT
  ) {
    return styles;
  }

  const isMatching = (pseudoKey) => {
    if (pseudoKey.startsWith("::")) {
      const nextColonIndex = pseudoKey.indexOf(":", 2);
      if (nextColonIndex === -1) {
        return true;
      }
      // Handle pseudo-elements with states like "::-navi-loader:checked:disabled"
      const pseudoStatesString = pseudoKey.slice(nextColonIndex);
      return isMatching(pseudoStatesString);
    }
    const nextColonIndex = pseudoKey.indexOf(":", 1);
    if (nextColonIndex === -1) {
      return pseudoState[pseudoKey];
    }
    // Handle compound pseudo-states like ":checked:disabled"
    return pseudoKey
      .slice(1)
      .split(":")
      .every((state) => pseudoState[state]);
  };

  const styleToAddSet = new Set();
  for (const pseudoKey of Object.keys(pseudoNamedStyles)) {
    if (isMatching(pseudoKey)) {
      const stylesToApply = pseudoNamedStyles[pseudoKey];
      styleToAddSet.add(stylesToApply);
    }
  }
  if (styleToAddSet.size === 0) {
    return styles;
  }
  let style = styles || {};
  for (const styleToAdd of styleToAddSet) {
    style = mergeTwoStyles(style, styleToAdd, "css");
  }
  return style;
};

const styleKeySetWeakMap = new WeakMap();
const elementTransitionWeakMap = new WeakMap();
const elementRenderedWeakSet = new WeakSet();
const NO_STYLE_KEY_SET = new Set();
const updateStyle = (element, style, preventInitialTransition) => {
  const styleKeySet = style ? new Set(Object.keys(style)) : NO_STYLE_KEY_SET;
  const oldStyleKeySet = styleKeySetWeakMap.get(element) || NO_STYLE_KEY_SET;
  // TRANSITION ANTI-FLICKER STRATEGY:
  // Problem: When setting both transition and styled properties simultaneously
  // (e.g., el.style.transition = "border-radius 0.3s ease"; el.style.borderRadius = "20px"),
  // the browser will immediately perform a transition even if no transition existed before.
  //
  // Solution: Temporarily disable transitions during initial style application by setting
  // transition to "none", then restore the intended transition after the frame completes.
  // We handle multiple updateStyle calls in the same frame gracefully - only one
  // requestAnimationFrame is scheduled per element, and the final transition value wins.
  let styleKeySetToApply = styleKeySet;
  if (!elementRenderedWeakSet.has(element)) {
    const hasTransition = styleKeySet.has("transition");
    if (hasTransition || preventInitialTransition) {
      if (elementTransitionWeakMap.has(element)) {
        elementTransitionWeakMap.set(element, style?.transition);
      } else {
        element.style.transition = "none";
        elementTransitionWeakMap.set(element, style?.transition);
      }
      // Don't apply the transition property now - we've set it to "none" temporarily
      styleKeySetToApply = new Set(styleKeySet);
      styleKeySetToApply.delete("transition");
    }
    requestAnimationFrame(() => {
      if (elementTransitionWeakMap.has(element)) {
        const transitionToRestore = elementTransitionWeakMap.get(element);
        if (transitionToRestore === undefined) {
          element.style.transition = "";
        } else {
          element.style.transition = transitionToRestore;
        }
        elementTransitionWeakMap.delete(element);
      }
      elementRenderedWeakSet.add(element);
    });
  }

  // Apply all styles normally (excluding transition during anti-flicker)
  const keysToDelete = new Set(oldStyleKeySet);
  for (const key of styleKeySetToApply) {
    keysToDelete.delete(key);
    const value = style[key];
    if (key.startsWith("--")) {
      element.style.setProperty(key, value);
    } else {
      element.style[key] = value;
    }
  }

  // Remove obsolete styles
  for (const key of keysToDelete) {
    if (key.startsWith("--")) {
      element.style.removeProperty(key);
    } else {
      element.style[key] = "";
    }
  }

  styleKeySetWeakMap.set(element, styleKeySet);
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  [data-flow-inline] {
    display: inline;
  }
  [data-flow-row] {
    display: flex;
    flex-direction: column;
  }
  [data-flow-column] {
    display: flex;
    flex-direction: row;
  }
  [data-flow-inline][data-flow-row],
  [data-flow-inline][data-flow-column] {
    display: inline-flex;
  }
`;
const PSEUDO_CLASSES_DEFAULT = [];
const PSEUDO_ELEMENTS_DEFAULT = [];
const STYLE_CSS_VARS_DEFAULT = {};
const Box = props => {
  const {
    as = "div",
    baseClassName,
    className,
    baseStyle,
    // style management
    style,
    styleCSSVars = STYLE_CSS_VARS_DEFAULT,
    basePseudoState,
    pseudoState,
    // for demo purposes it's possible to control pseudo state from props
    pseudoClasses = PSEUDO_CLASSES_DEFAULT,
    pseudoElements = PSEUDO_ELEMENTS_DEFAULT,
    // visualSelector convey the following:
    // The box itself is visually "invisible", one of its descendant is responsible for visual representation
    // - Some styles will be used on the box itself (for instance margins)
    // - Some styles will be used on the visual element (for instance paddings, backgroundColor)
    // -> introduced for <Button /> with transform:scale on press
    visualSelector,
    // pseudoStateSelector convey the following:
    // The box contains content that holds pseudoState
    // -> introduced for <Input /> with a wrapped for loading, checkboxes, etc
    pseudoStateSelector,
    hasChildFunction,
    // preventInitialTransition can be used to prevent transition on mount
    // (when transition is set via props, this is done automatically)
    // so this prop is useful only when transition is enabled from "outside" (via CSS)
    preventInitialTransition,
    children,
    separator,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const TagName = as;
  const defaultDisplay = getDefaultDisplay(TagName);
  let {
    box,
    inline,
    row,
    column
  } = rest;
  if (box === "auto" || inline || defaultDisplay === "inline") {
    if (rest.width !== undefined || rest.height !== undefined) {
      box = true;
    }
  }
  if (box) {
    if (inline === undefined) {
      inline = true;
    }
    if (column === undefined && !row) {
      column = true;
    }
  }
  let boxFlow;
  if (inline) {
    if (row) {
      boxFlow = "inline-row";
    } else if (column) {
      boxFlow = "inline-column";
    } else {
      boxFlow = "inline";
    }
  } else if (row) {
    boxFlow = "row";
  } else if (column) {
    boxFlow = "column";
  } else {
    boxFlow = defaultDisplay;
  }
  const remainingPropKeySet = new Set(Object.keys(rest));
  // some props not destructured but that are neither
  // style props, nor should be forwarded to the child
  remainingPropKeySet.delete("ref");
  const innerClassName = withPropsClassName(baseClassName, className);
  const selfForwardedProps = {};
  const childForwardedProps = {};
  {
    const parentBoxFlow = useContext(BoxFlowContext);
    const styleDeps = [
    // Layout and alignment props
    parentBoxFlow, boxFlow,
    // Style context dependencies
    styleCSSVars, pseudoClasses, pseudoElements,
    // Selectors
    visualSelector, pseudoStateSelector, preventInitialTransition];
    let innerPseudoState;
    if (basePseudoState && pseudoState) {
      innerPseudoState = {};
      const baseStateKeys = Object.keys(basePseudoState);
      const pseudoStateKeySet = new Set(Object.keys(pseudoState));
      for (const key of baseStateKeys) {
        if (pseudoStateKeySet.has(key)) {
          pseudoStateKeySet.delete(key);
          const value = pseudoState[key];
          styleDeps.push(value);
          innerPseudoState[key] = value;
        } else {
          const value = basePseudoState[key];
          styleDeps.push(value);
          innerPseudoState[key] = value;
        }
      }
      for (const key of pseudoStateKeySet) {
        const value = pseudoState[key];
        styleDeps.push(value);
        innerPseudoState[key] = value;
      }
    } else if (basePseudoState) {
      innerPseudoState = basePseudoState;
      for (const key of Object.keys(basePseudoState)) {
        const value = basePseudoState[key];
        styleDeps.push(value);
      }
    } else if (pseudoState) {
      innerPseudoState = pseudoState;
      for (const key of Object.keys(pseudoState)) {
        const value = pseudoState[key];
        styleDeps.push(value);
      }
    } else {
      innerPseudoState = PSEUDO_STATE_DEFAULT;
    }
    const boxStyles = {};
    const styleContext = {
      parentBoxFlow,
      boxFlow,
      styleCSSVars,
      pseudoState: innerPseudoState,
      pseudoClasses,
      pseudoElements,
      remainingProps: rest,
      styles: boxStyles
    };
    let boxPseudoNamedStyles = PSEUDO_NAMED_STYLES_DEFAULT;
    const shouldForwardAllToChild = visualSelector && pseudoStateSelector;
    const addStyle = (value, name, styleContext, stylesTarget, context) => {
      styleDeps.push(name, value); // impact box style -> add to deps
      const cssVar = styleContext.styleCSSVars[name];
      const mergedValue = prepareStyleValue(stylesTarget[name], value, name, styleContext, context);
      if (cssVar) {
        stylesTarget[cssVar] = mergedValue;
        return true;
      }
      stylesTarget[name] = mergedValue;
      return false;
    };
    const addStyleMaybeForwarding = (value, name, styleContext, stylesTarget, context, visualChildPropStrategy) => {
      if (!visualChildPropStrategy) {
        addStyle(value, name, styleContext, stylesTarget, context);
        return false;
      }
      const cssVar = styleCSSVars[name];
      if (cssVar) {
        // css var wins over visual child handling
        addStyle(value, name, styleContext, stylesTarget, context);
        return false;
      }
      if (visualChildPropStrategy === "copy") {
        // we stylyze ourself + forward prop to the child
        addStyle(value, name, styleContext, stylesTarget, context);
      }
      return true;
    };

    // By default ":hover", ":active" are not tracked.
    // But if code explicitely do something like:
    // style={{ ":hover": { backgroundColor: "red" } }}
    // then we'll track ":hover" state changes even for basic elements like <div>
    const pseudoClassesFromStyleSet = new Set();
    boxPseudoNamedStyles = {};
    const visitProp = (value, name, styleContext, boxStylesTarget, styleOrigin) => {
      const isPseudoElement = name.startsWith("::");
      const isPseudoClass = name.startsWith(":");
      if (isPseudoElement || isPseudoClass) {
        styleDeps.push(name);
        pseudoClassesFromStyleSet.add(name);
        const pseudoStyleContext = {
          ...styleContext,
          styleCSSVars: {
            ...styleCSSVars,
            ...styleCSSVars[name]
          },
          pseudoName: name
        };
        const pseudoStyleKeys = Object.keys(value);
        if (isPseudoElement) {
          const pseudoElementStyles = {};
          for (const key of pseudoStyleKeys) {
            visitProp(value[key], key, pseudoStyleContext, pseudoElementStyles, "pseudo_style");
          }
          boxPseudoNamedStyles[name] = pseudoElementStyles;
          return;
        }
        const pseudoClassStyles = {};
        for (const key of pseudoStyleKeys) {
          visitProp(value[key], key, pseudoStyleContext, pseudoClassStyles, "pseudo_style");
          boxPseudoNamedStyles[name] = pseudoClassStyles;
        }
        return;
      }
      const context = styleOrigin === "base_style" ? "js" : "css";
      const isCss = styleOrigin === "base_style" || styleOrigin === "style";
      if (isCss) {
        addStyle(value, name, styleContext, boxStylesTarget, context);
        return;
      }
      if (isCSSVar(name)) {
        addStyle(value, name, styleContext, boxStylesTarget, context);
        return;
      }
      const isPseudoStyle = styleOrigin === "pseudo_style";
      if (isStyleProp(name)) {
        // it's a style prop, we need first to check if we have css var to handle them
        // otherwise we decide to put it either on self or child
        const visualChildPropStrategy = visualSelector && getVisualChildStylePropStrategy(name);
        const getStyle = getHowToHandleStyleProp(name);
        if (
        // prop name === css style name
        !getStyle) {
          const needForwarding = addStyleMaybeForwarding(value, name, styleContext, boxStylesTarget, context, visualChildPropStrategy);
          if (needForwarding) {
            if (isPseudoStyle) ; else {
              childForwardedProps[name] = value;
            }
          }
          return;
        }
        const cssValues = getStyle(value, styleContext);
        if (!cssValues) {
          return;
        }
        let needForwarding = false;
        for (const styleName of Object.keys(cssValues)) {
          const cssValue = cssValues[styleName];
          needForwarding = addStyleMaybeForwarding(cssValue, styleName, styleContext, boxStylesTarget, context, visualChildPropStrategy);
        }
        if (needForwarding) {
          if (isPseudoStyle) ; else {
            childForwardedProps[name] = value;
          }
        }
        return;
      }
      // not a style prop what do we do with it?
      if (shouldForwardAllToChild) {
        if (isPseudoStyle) ; else {
          childForwardedProps[name] = value;
        }
      } else {
        if (isPseudoStyle) {
          console.warn(`unsupported pseudo style key "${name}"`);
        }
        selfForwardedProps[name] = value;
      }
      return;
    };
    if (baseStyle) {
      for (const key of baseStyle) {
        const value = baseStyle[key];
        visitProp(value, key, styleContext, boxStyles, "baseStyle");
      }
    }
    for (const propName of remainingPropKeySet) {
      const propValue = rest[propName];
      const isDataAttribute = propName.startsWith("data-");
      if (isDataAttribute) {
        selfForwardedProps[propName] = propValue;
        continue;
      }
      visitProp(propValue, propName, styleContext, boxStyles, "prop");
    }
    if (typeof style === "string") {
      const styleObject = normalizeStyles(style, "css");
      for (const styleName of Object.keys(styleObject)) {
        const styleValue = styleObject[styleName];
        visitProp(styleValue, styleName, styleContext, boxStyles, "style");
      }
    } else if (style && typeof style === "object") {
      for (const styleName of Object.keys(style)) {
        const styleValue = style[styleName];
        visitProp(styleValue, styleName, styleContext, boxStyles, "style");
      }
    }
    const updateStyle = useCallback(state => {
      const boxEl = ref.current;
      applyStyle(boxEl, boxStyles, state, boxPseudoNamedStyles, preventInitialTransition);
    }, styleDeps);
    const finalStyleDeps = [pseudoStateSelector, innerPseudoState, updateStyle];
    let innerPseudoClasses;
    if (pseudoClassesFromStyleSet.size) {
      innerPseudoClasses = [...pseudoClasses];
      if (pseudoClasses !== PSEUDO_CLASSES_DEFAULT) {
        finalStyleDeps.push(...pseudoClasses);
      }
      for (const key of pseudoClassesFromStyleSet) {
        innerPseudoClasses.push(key);
        finalStyleDeps.push(key);
      }
    } else {
      innerPseudoClasses = pseudoClasses;
      if (pseudoClasses !== PSEUDO_CLASSES_DEFAULT) {
        finalStyleDeps.push(...pseudoClasses);
      }
    }
    useLayoutEffect(() => {
      const boxEl = ref.current;
      if (!boxEl) {
        return null;
      }
      const pseudoStateEl = pseudoStateSelector ? boxEl.querySelector(pseudoStateSelector) : boxEl;
      const visualEl = visualSelector ? boxEl.querySelector(visualSelector) : null;
      return initPseudoStyles(pseudoStateEl, {
        pseudoClasses: innerPseudoClasses,
        pseudoState: innerPseudoState,
        effect: updateStyle,
        elementToImpact: boxEl,
        elementListeningPseudoState: visualEl === pseudoStateEl ? null : visualEl
      });
    }, finalStyleDeps);
  }

  // When hasChildFunction is used it means
  // Some/all the children needs to access remainingProps
  // to render and will provide a function to do so.
  let innerChildren;
  if (hasChildFunction) {
    if (Array.isArray(children)) {
      innerChildren = children.map(child => typeof child === "function" ? child(childForwardedProps) : child);
    } else if (typeof children === "function") {
      innerChildren = children(childForwardedProps);
    } else {
      innerChildren = children;
    }
  } else {
    innerChildren = children;
  }
  if (separator) {
    // Flatten nested arrays (e.g., from .map()) to treat each element as individual child
    const flattenedChildren = toChildArray(innerChildren);
    if (flattenedChildren.length > 1) {
      const childrenWithSeparators = [];
      let i = 0;
      while (true) {
        const child = flattenedChildren[i];
        childrenWithSeparators.push(child);
        i++;
        if (i === flattenedChildren.length) {
          break;
        }
        // Support function separators that receive separator index
        const separatorElement = typeof separator === "function" ? separator(i - 1) // i-1 because i was incremented after pushing child
        : separator;
        childrenWithSeparators.push(separatorElement);
      }
      innerChildren = childrenWithSeparators;
    } else {
      innerChildren = flattenedChildren;
    }
  }
  return jsx(TagName, {
    ref: ref,
    className: innerClassName,
    "data-flow-inline": inline ? "" : undefined,
    "data-flow-row": row ? "" : undefined,
    "data-flow-column": column ? "" : undefined,
    "data-visual-selector": visualSelector,
    ...selfForwardedProps,
    children: jsx(BoxFlowContext.Provider, {
      value: boxFlow,
      children: innerChildren
    })
  });
};

/**
 * Fix alignment behavior for flex/grid containers that use `height: 100%`.
 *
 * Context:
 * - When a flex/grid container has `height: 100%`, it is "height-locked".
 * - If its content becomes taller than the container, alignment rules like
 *   `align-items: center` will cause content to be partially clipped.
 *
 * Goal:
 * - Center content only when it fits.
 * - Align content at start when it overflows.
 *
 * How:
 * - Temporarily remove height-constraint (`height:auto`) to measure natural height.
 * - Compare natural height to container height.
 * - Add/remove an attribute so CSS can adapt alignment.
 *
 * Usage:
 *   monitorItemsOverflow(containerElement);
 *
 * CSS example:
 *   .container { align-items: center; }
 *   .container[data-items-height-overflow] { align-items: flex-start; }
 */


const WIDTH_ATTRIBUTE_NAME = "data-items-width-overflow";
const HEIGHT_ATTRIBUTE_NAME = "data-items-height-overflow";
const monitorItemsOverflow = (container) => {
  let widthIsOverflowing;
  let heightIsOverflowing;
  const onItemsWidthOverflowChange = () => {
    if (widthIsOverflowing) {
      container.setAttribute(WIDTH_ATTRIBUTE_NAME, "");
    } else {
      container.removeAttribute(WIDTH_ATTRIBUTE_NAME);
    }
  };
  const onItemsHeightOverflowChange = () => {
    if (heightIsOverflowing) {
      container.setAttribute(HEIGHT_ATTRIBUTE_NAME, "");
    } else {
      container.removeAttribute(HEIGHT_ATTRIBUTE_NAME);
    }
  };

  const update = () => {
    // Save current manual height constraint
    const prevWidth = container.style.width;
    const prevHeight = container.style.height;
    // Remove constraint → get true content dimension
    container.style.width = "auto";
    container.style.height = "auto";
    const naturalWidth = container.scrollWidth;
    const naturalHeight = container.scrollHeight;
    if (prevWidth) {
      container.style.width = prevWidth;
    } else {
      container.style.removeProperty("width");
    }
    if (prevHeight) {
      container.style.height = prevHeight;
    } else {
      container.style.removeProperty("height");
    }

    const lockedWidth = container.clientWidth;
    const lockedHeight = container.clientHeight;
    const currentWidthIsOverflowing = naturalWidth > lockedWidth;
    const currentHeightIsOverflowing = naturalHeight > lockedHeight;
    if (currentWidthIsOverflowing !== widthIsOverflowing) {
      widthIsOverflowing = currentWidthIsOverflowing;
      onItemsWidthOverflowChange();
    }
    if (currentHeightIsOverflowing !== heightIsOverflowing) {
      heightIsOverflowing = currentHeightIsOverflowing;
      onItemsHeightOverflowChange();
    }
  };

  const [teardown, addTeardown] = createPubSub();

  update();

  // mutation observer
  const mutationObserver = new MutationObserver(() => {
    update();
  });
  mutationObserver.observe(container, {
    childList: true,
    characterData: true,
  });
  addTeardown(() => {
    mutationObserver.disconnect();
  });

  // resize observer
  const resizeObserver = new ResizeObserver(update);
  resizeObserver.observe(container);
  addTeardown(() => {
    resizeObserver.disconnect();
  });

  const destroy = () => {
    teardown();
    container.removeAttribute(WIDTH_ATTRIBUTE_NAME);
    container.removeAttribute(HEIGHT_ATTRIBUTE_NAME);
  };
  return destroy;
};

installImportMetaCss(import.meta);
import.meta.css = /* css */ `
  * {
    box-sizing: border-box;
  }

  .ui_transition {
    --transition-duration: 300ms;
    --justify-content: center;
    --align-items: center;

    --x-transition-duration: var(--transition-duration);
    --x-justify-content: var(--justify-content);
    --x-align-items: var(--align-items);

    position: relative;
  }
  /* Alignment controls */
  .ui_transition[data-align-x="start"] {
    --x-justify-content: flex-start;
  }
  .ui_transition[data-align-x="center"] {
    --x-justify-content: center;
  }
  .ui_transition[data-align-x="end"] {
    --x-justify-content: flex-end;
  }
  .ui_transition[data-align-y="start"] {
    --x-align-items: flex-start;
  }
  .ui_transition[data-align-y="center"] {
    --x-align-items: center;
  }
  .ui_transition[data-align-y="end"] {
    --x-align-items: flex-end;
  }

  .ui_transition,
  .ui_transition_active_group,
  .ui_transition_previous_group,
  .ui_transition_target_slot,
  .ui_transition_previous_target_slot,
  .ui_transition_outgoing_slot,
  .ui_transition_previous_outgoing_slot {
    width: 100%;
    height: 100%;
  }

  .ui_transition_target_slot,
  .ui_transition_outgoing_slot,
  .ui_transition_previous_target_slot,
  .ui_transition_previous_outgoing_slot {
    display: flex;
    align-items: var(--x-align-items);
    justify-content: var(--x-justify-content);
  }
  .ui_transition_target_slot[data-items-width-overflow],
  .ui_transition_previous_target_slot[data-items-width-overflow],
  .ui_transition_previous_target_slot[data-items-width-overflow],
  .ui_transition_previous_outgoing_slot[data-items-width-overflow] {
    --x-justify-content: flex-start;
  }
  .ui_transition_target_slot[data-items-height-overflow],
  .ui_transition_previous_slot[data-items-height-overflow],
  .ui_transition_previous_target_slot[data-items-height-overflow],
  .ui_transition_previous_outgoing_slot[data-items-height-overflow] {
    --x-align-items: flex-start;
  }

  .ui_transition_active_group {
    position: relative;
  }
  .ui_transition_target_slot {
    position: relative;
  }
  .ui_transition_outgoing_slot,
  .ui_transition_previous_outgoing_slot {
    position: absolute;
    top: 0;
    left: 0;
  }
  .ui_transition_previous_group {
    position: absolute;
    inset: 0;
  }
  .ui_transition[data-only-previous-group] .ui_transition_previous_group {
    position: relative;
  }

  .ui_transition_target_slot_background {
    position: absolute;
    top: 0;
    left: 0;
    z-index: -1;
    display: none;
    width: var(--target-slot-width, 100%);
    height: var(--target-slot-height, 100%);
    background: var(--target-slot-background, transparent);
    pointer-events: none;
  }
  .ui_transition[data-transitioning] .ui_transition_target_slot_background {
    display: block;
  }
`;

const CONTENT_ID_ATTRIBUTE = "data-content-id";
const CONTENT_PHASE_ATTRIBUTE = "data-content-phase";
const UNSET = {
  domNodes: [],
  domNodesClone: [],
  isEmpty: true,

  type: "unset",
  contentId: "unset",
  contentPhase: undefined,
  isContentPhase: false,
  isContent: false,
  toString: () => "unset",
};

const isSameConfiguration = (configA, configB) => {
  return configA.toString() === configB.toString();
};

const createUITransitionController = (
  root,
  {
    duration = 300,
    alignX = "center",
    alignY = "center",
    onStateChange = () => {},
    pauseBreakpoints = [],
  } = {},
) => {
  const debugConfig = {
    detection: root.hasAttribute("data-debug-detection"),
    size: root.hasAttribute("data-debug-size"),
  };
  const hasDebugLogs = debugConfig.size;
  const debugDetection = (message) => {
    if (!debugConfig.detection) return;
    console.debug(`[detection]`, message);
  };
  const debugSize = (message) => {
    if (!debugConfig.size) return;
    console.debug(`[size]`, message);
  };

  const activeGroup = root.querySelector(".ui_transition_active_group");
  const targetSlot = root.querySelector(".ui_transition_target_slot");
  const outgoingSlot = root.querySelector(".ui_transition_outgoing_slot");
  const previousGroup = root.querySelector(".ui_transition_previous_group");
  const previousTargetSlot = previousGroup?.querySelector(
    ".ui_transition_previous_target_slot",
  );
  const previousOutgoingSlot = previousGroup?.querySelector(
    ".ui_transition_previous_outgoing_slot",
  );

  if (
    !root ||
    !activeGroup ||
    !targetSlot ||
    !outgoingSlot ||
    !previousGroup ||
    !previousTargetSlot ||
    !previousOutgoingSlot
  ) {
    throw new Error(
      "createUITransitionController requires element with .active_group, .target_slot, .outgoing_slot, .previous_group, .previous_target_slot, and .previous_outgoing_slot elements",
    );
  }

  // we maintain a background copy behind target slot to avoid showing
  // the body flashing during the fade-in
  const targetSlotBackground = document.createElement("div");
  targetSlotBackground.className = "ui_transition_target_slot_background";
  activeGroup.insertBefore(targetSlotBackground, targetSlot);

  root.style.setProperty("--x-transition-duration", `${duration}ms`);
  outgoingSlot.setAttribute("inert", "");
  previousGroup.setAttribute("inert", "");

  const detectConfiguration = (slot, { contentId, contentPhase } = {}) => {
    const domNodes = Array.from(slot.childNodes);
    if (!domNodes) {
      return UNSET;
    }

    const isEmpty = domNodes.length === 0;
    let textNodeCount = 0;
    let elementNodeCount = 0;
    let firstElementNode;
    const domNodesClone = [];
    if (isEmpty) {
      if (contentPhase === undefined) {
        contentPhase = "empty";
      }
    } else {
      const contentIdSlotAttr = slot.getAttribute(CONTENT_ID_ATTRIBUTE);
      let contentIdChildAttr;
      for (const domNode of domNodes) {
        if (domNode.nodeType === Node.TEXT_NODE) {
          textNodeCount++;
        } else {
          if (!firstElementNode) {
            firstElementNode = domNode;
          }
          elementNodeCount++;

          if (domNode.hasAttribute("data-content-phase")) {
            const contentPhaseAttr = domNode.getAttribute("data-content-phase");
            contentPhase = contentPhaseAttr || "attr";
          }
          if (domNode.hasAttribute("data-content-key")) {
            contentIdChildAttr = domNode.getAttribute("data-content-key");
          }
        }
        const domNodeClone = domNode.cloneNode(true);
        domNodesClone.push(domNodeClone);
      }

      if (contentIdSlotAttr && contentIdChildAttr) {
        console.warn(
          `Slot and slot child both have a [${CONTENT_ID_ATTRIBUTE}]. Slot is ${contentIdSlotAttr} and child is ${contentIdChildAttr}, using the child.`,
        );
      }
      if (contentId === undefined) {
        contentId = contentIdChildAttr || contentIdSlotAttr || undefined;
      }
    }
    const isOnlyTextNodes = elementNodeCount === 0 && textNodeCount > 1;
    const singleElementNode = elementNodeCount === 1 ? firstElementNode : null;

    contentId = contentId || getElementSignature(domNodes[0]);
    if (!contentPhase && isEmpty) {
      // Imagine code rendering null while switching to a new content
      // or even while staying on the same content.
      // In the UI we want to consider this as an "empty" phase.
      // meaning the ui will keep the same size until something else happens
      // This prevent layout shifts of code not properly handling
      // intermediate states.
      contentPhase = "empty";
    }

    let width;
    let height;
    let borderRadius;
    let border;
    let background;

    if (isEmpty) {
      debugSize(`measureSlot(".${slot.className}") -> it is empty`);
    } else if (singleElementNode) {
      const visualSelector = singleElementNode.getAttribute(
        "data-visual-selector",
      );
      const visualElement = visualSelector
        ? singleElementNode.querySelector(visualSelector) || singleElementNode
        : singleElementNode;
      const rect = visualElement.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      debugSize(`measureSlot(".${slot.className}") -> [${width}x${height}]`);
      borderRadius = getBorderRadius(visualElement);
      border = getComputedStyle(visualElement).border;
      background = getComputedStyle(visualElement).background;
    } else {
      // text, multiple elements
      const rect = slot.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      debugSize(`measureSlot(".${slot.className}") -> [${width}x${height}]`);
    }

    const commonProperties = {
      domNodes,
      domNodesClone,
      isEmpty,
      isOnlyTextNodes,
      singleElementNode,

      width,
      height,
      borderRadius,
      border,
      background,

      contentId,
    };

    if (contentPhase) {
      return {
        ...commonProperties,
        type: "content_phase",
        contentPhase,
        isContentPhase: true,
        isContent: false,
        toString: () => `content(${contentId}).phase(${contentPhase})`,
      };
    }
    return {
      ...commonProperties,
      type: "content",
      contentPhase: undefined,
      isContentPhase: false,
      isContent: true,
      toString: () => `content(${contentId})`,
    };
  };

  const targetSlotInitialConfiguration = detectConfiguration(targetSlot);
  const outgoingSlotInitialConfiguration = detectConfiguration(outgoingSlot, {
    contentPhase: "true",
  });
  let targetSlotConfiguration = targetSlotInitialConfiguration;
  let outgoingSlotConfiguration = outgoingSlotInitialConfiguration;
  let previousTargetSlotConfiguration = UNSET;

  const updateSlotAttributes = () => {
    if (targetSlotConfiguration.isEmpty && outgoingSlotConfiguration.isEmpty) {
      root.setAttribute("data-only-previous-group", "");
    } else {
      root.removeAttribute("data-only-previous-group");
    }
  };
  const updateAlignment = () => {
    // Set data attributes for CSS-based alignment
    root.setAttribute("data-align-x", alignX);
    root.setAttribute("data-align-y", alignY);
  };

  const moveConfigurationIntoSlot = (configuration, slot) => {
    slot.innerHTML = "";
    for (const domNode of configuration.domNodesClone) {
      slot.appendChild(domNode);
    }
    // in case border or stuff like that have changed we re-detect the config
    const updatedConfig = detectConfiguration(slot);
    if (slot === targetSlot) {
      targetSlotConfiguration = updatedConfig;
    } else if (slot === outgoingSlot) {
      outgoingSlotConfiguration = updatedConfig;
    } else if (slot === previousTargetSlot) {
      previousTargetSlotConfiguration = updatedConfig;
    } else if (slot === previousOutgoingSlot) ; else {
      throw new Error("Unknown slot for applyConfiguration");
    }
  };

  updateAlignment();

  let transitionType = "none";
  const groupTransitionOptions = {
    // debugBreakpoints: [0.25],
    pauseBreakpoints,
    lifecycle: {
      setup: () => {
        updateSlotAttributes();
        root.setAttribute("data-transitioning", "");
        onStateChange({ isTransitioning: true });
        return {
          teardown: () => {
            root.removeAttribute("data-transitioning");
            updateSlotAttributes(); // Update positioning after transition
            onStateChange({ isTransitioning: false });
          },
        };
      },
    },
  };
  const transitionController = createGroupTransitionController(
    groupTransitionOptions,
  );

  const elementToClip = root;
  const morphContainerIntoTarget = () => {
    const morphTransitions = [];
    {
      // TODO: ideally when scrollContainer is document AND we transition
      // from a layout with scrollbar to a layout without
      // we have clip path detecting we go from a given width/height to a new width/height
      // that might just be the result of scrollbar appearing/disappearing
      // we should detect when this happens to avoid clipping what correspond to the scrollbar presence toggling
      const fromWidth = previousTargetSlotConfiguration.width || 0;
      const fromHeight = previousTargetSlotConfiguration.height || 0;
      const toWidth = targetSlotConfiguration.width || 0;
      const toHeight = targetSlotConfiguration.height || 0;
      debugSize(
        `transition from [${fromWidth}x${fromHeight}] to [${toWidth}x${toHeight}]`,
      );
      const restoreOverflow = preventIntermediateScrollbar(root, {
        fromWidth,
        fromHeight,
        toWidth,
        toHeight,
        onPrevent: ({ x, y, scrollContainer }) => {
          if (x) {
            debugSize(
              `Temporarily hiding horizontal overflow during transition on ${getElementSignature(scrollContainer)}`,
            );
          }
          if (y) {
            debugSize(
              `Temporarily hiding vertical overflow during transition on ${getElementSignature(scrollContainer)}`,
            );
          }
        },
        onRestore: () => {
          debugSize(`Restored overflow after transition`);
        },
      });

      const onSizeTransitionFinished = () => {
        // Restore overflow when transition is complete
        restoreOverflow();
      };

      // https://emilkowal.ski/ui/the-magic-of-clip-path
      const elementToClipRect = elementToClip.getBoundingClientRect();
      const elementToClipWidth = elementToClipRect.width;
      const elementToClipHeight = elementToClipRect.height;
      // Calculate where content is positioned within the large container
      const getAlignedPosition = (containerSize, contentSize, align) => {
        switch (align) {
          case "start":
            return 0;
          case "end":
            return containerSize - contentSize;
          case "center":
          default:
            return (containerSize - contentSize) / 2;
        }
      };
      // Position of "from" content within large container
      const fromLeft = getAlignedPosition(
        elementToClipWidth,
        fromWidth,
        alignX,
      );
      const fromTop = getAlignedPosition(
        elementToClipHeight,
        fromHeight,
        alignY,
      );
      // Position of target content within large container
      const targetLeft = getAlignedPosition(
        elementToClipWidth,
        toWidth,
        alignX,
      );
      const targetTop = getAlignedPosition(
        elementToClipHeight,
        toHeight,
        alignY,
      );
      debugSize(
        `Positions in container: from [${fromLeft},${fromTop}] ${fromWidth}x${fromHeight} to [${targetLeft},${targetTop}] ${toWidth}x${toHeight}`,
      );
      // Get border-radius values
      const fromBorderRadius =
        previousTargetSlotConfiguration.borderRadius || 0;
      const toBorderRadius = targetSlotConfiguration.borderRadius || 0;
      const startInsetTop = fromTop;
      const startInsetRight = elementToClipWidth - (fromLeft + fromWidth);
      const startInsetBottom = elementToClipHeight - (fromTop + fromHeight);
      const startInsetLeft = fromLeft;

      const endInsetTop = targetTop;
      const endInsetRight = elementToClipWidth - (targetLeft + toWidth);
      const endInsetBottom = elementToClipHeight - (targetTop + toHeight);
      const endInsetLeft = targetLeft;

      const startClipPath = `inset(${startInsetTop}px ${startInsetRight}px ${startInsetBottom}px ${startInsetLeft}px round ${fromBorderRadius}px)`;
      const endClipPath = `inset(${endInsetTop}px ${endInsetRight}px ${endInsetBottom}px ${endInsetLeft}px round ${toBorderRadius}px)`;
      // Create clip-path animation using Web Animations API
      const clipAnimation = elementToClip.animate(
        [{ clipPath: startClipPath }, { clipPath: endClipPath }],
        {
          duration,
          easing: "ease",
          fill: "forwards",
        },
      );

      // Handle finish
      clipAnimation.finished
        .then(() => {
          // Clear clip-path to restore normal behavior
          elementToClip.style.clipPath = "";
          clipAnimation.cancel();
          onSizeTransitionFinished();
        })
        .catch(() => {
          // Animation was cancelled
        });
      clipAnimation.play();
    }

    return morphTransitions;
  };
  const fadeInTargetSlot = () => {
    targetSlotBackground.style.setProperty(
      "--target-slot-background",
      targetSlotConfiguration.background,
    );
    targetSlotBackground.style.setProperty(
      "--target-slot-width",
      `${targetSlotConfiguration.width || 0}px`,
    );
    targetSlotBackground.style.setProperty(
      "--target-slot-height",
      `${targetSlotConfiguration.height || 0}px`,
    );
    return createOpacityTransition(targetSlot, 1, {
      from: 0,
      duration,
      styleSynchronizer: "inline_style",
      onFinish: (targetSlotOpacityTransition) => {
        targetSlotBackground.style.removeProperty("--target-slot-background");
        targetSlotBackground.style.removeProperty("--target-slot-width");
        targetSlotBackground.style.removeProperty("--target-slot-height");
        targetSlotOpacityTransition.cancel();
      },
    });
  };
  const fadeOutPreviousGroup = () => {
    return createOpacityTransition(previousGroup, 0, {
      from: 1,
      duration,
      styleSynchronizer: "inline_style",
      onFinish: (previousGroupOpacityTransition) => {
        previousGroupOpacityTransition.cancel();
        previousGroup.style.opacity = "0"; // keep previous group visually hidden
      },
    });
  };
  const fadeOutOutgoingSlot = () => {
    return createOpacityTransition(outgoingSlot, 0, {
      duration,
      from: 1,
      styleSynchronizer: "inline_style",
      onFinish: (outgoingSlotOpacityTransition) => {
        outgoingSlotOpacityTransition.cancel();
        outgoingSlot.style.opacity = "0"; // keep outgoing slot visually hidden
      },
    });
  };

  // content_to_content transition (uses previous_group)
  const applyContentToContentTransition = (toConfiguration) => {
    // 1. move target slot to previous
    moveConfigurationIntoSlot(targetSlotConfiguration, previousTargetSlot);
    targetSlotConfiguration = toConfiguration;
    // 2. move outgoing slot to previous
    moveConfigurationIntoSlot(outgoingSlotConfiguration, previousOutgoingSlot);
    moveConfigurationIntoSlot(UNSET, outgoingSlot);

    const transitions = [
      ...morphContainerIntoTarget(),
      fadeInTargetSlot(),
      fadeOutPreviousGroup(),
    ];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        moveConfigurationIntoSlot(UNSET, previousTargetSlot);
        moveConfigurationIntoSlot(UNSET, previousOutgoingSlot);
        if (hasDebugLogs) {
          console.groupEnd();
        }
      },
    });
    transition.play();
  };
  // content_phase_to_content_phase transition (uses outgoing_slot)
  const applyContentPhaseToContentPhaseTransition = (toConfiguration) => {
    // 1. Move target slot to outgoing
    moveConfigurationIntoSlot(targetSlotConfiguration, outgoingSlot);
    targetSlotConfiguration = toConfiguration;

    const transitions = [
      ...morphContainerIntoTarget(),
      fadeInTargetSlot(),
      fadeOutOutgoingSlot(),
    ];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        moveConfigurationIntoSlot(UNSET, outgoingSlot);

        if (hasDebugLogs) {
          console.groupEnd();
        }
      },
    });
    transition.play();
  };
  // any_to_empty transition
  const applyToEmptyTransition = () => {
    // 1. move target slot to previous
    moveConfigurationIntoSlot(targetSlotConfiguration, previousTargetSlot);
    targetSlotConfiguration = UNSET;
    // 2. move outgoing slot to previous
    moveConfigurationIntoSlot(outgoingSlotConfiguration, previousOutgoingSlot);
    outgoingSlotConfiguration = UNSET;

    const transitions = [...morphContainerIntoTarget(), fadeOutPreviousGroup()];
    const transition = transitionController.update(transitions, {
      onFinish: () => {
        moveConfigurationIntoSlot(UNSET, previousTargetSlot);
        moveConfigurationIntoSlot(UNSET, previousOutgoingSlot);
        if (hasDebugLogs) {
          console.groupEnd();
        }
      },
    });
    transition.play();
  };
  // Main transition method
  const transitionTo = (
    newContentElement,
    { contentPhase, contentId } = {},
  ) => {
    if (contentId) {
      targetSlot.setAttribute(CONTENT_ID_ATTRIBUTE, contentId);
    } else {
      targetSlot.removeAttribute(CONTENT_ID_ATTRIBUTE);
    }
    if (contentPhase) {
      targetSlot.setAttribute(CONTENT_PHASE_ATTRIBUTE, contentPhase);
    } else {
      targetSlot.removeAttribute(CONTENT_PHASE_ATTRIBUTE);
    }
    if (newContentElement) {
      targetSlot.innerHTML = "";
      targetSlot.appendChild(newContentElement);
    } else {
      targetSlot.innerHTML = "";
    }
  };
  // Reset to initial content
  const resetContent = () => {
    transitionController.cancel();
    moveConfigurationIntoSlot(targetSlotInitialConfiguration, targetSlot);
    moveConfigurationIntoSlot(outgoingSlotInitialConfiguration, outgoingSlot);
    moveConfigurationIntoSlot(UNSET, previousTargetSlot);
    moveConfigurationIntoSlot(UNSET, previousOutgoingSlot);
  };

  const targetSlotEffect = (reasons) => {
    if (root.hasAttribute("data-disabled")) {
      return;
    }
    const fromConfiguration = targetSlotConfiguration;
    const toConfiguration = detectConfiguration(targetSlot);
    if (hasDebugLogs) {
      console.group(`targetSlotEffect()`);
      console.debug(`reasons:`);
      console.debug(`- ${reasons.join("\n- ")}`);
    }
    if (isSameConfiguration(fromConfiguration, toConfiguration)) {
      debugDetection(
        `already in desired state (${toConfiguration}) -> early return`,
      );
      if (hasDebugLogs) {
        console.groupEnd();
      }
      return;
    }
    const fromConfigType = fromConfiguration.type;
    const toConfigType = toConfiguration.type;
    transitionType = `${fromConfigType}_to_${toConfigType}`;
    debugDetection(
      `Prepare "${transitionType}" transition (${fromConfiguration} -> ${toConfiguration})`,
    );
    // content_to_empty / content_phase_to_empty
    if (toConfiguration.isEmpty) {
      applyToEmptyTransition();
      return;
    }
    // content_phase_to_content_phase
    if (fromConfiguration.isContentPhase && toConfiguration.isContentPhase) {
      applyContentPhaseToContentPhaseTransition(toConfiguration);
      return;
    }
    // content_phase_to_content
    if (fromConfiguration.isContentPhase && toConfiguration.isContent) {
      applyContentPhaseToContentPhaseTransition(toConfiguration);
      return;
    }
    // content_to_content_phase
    if (fromConfiguration.isContent && toConfiguration.isContentPhase) {
      applyContentPhaseToContentPhaseTransition(toConfiguration);
      return;
    }
    // content_to_content (default case)
    applyContentToContentTransition(toConfiguration);
  };

  const [teardown, addTeardown] = createPubSub();
  {
    const mutationObserver = new MutationObserver((mutations) => {
      const reasonParts = [];
      for (const mutation of mutations) {
        if (mutation.type === "childList") {
          const added = mutation.addedNodes.length;
          const removed = mutation.removedNodes.length;
          if (added && removed) {
            reasonParts.push(`addedNodes(${added}) removedNodes(${removed})`);
          } else if (added) {
            reasonParts.push(`addedNodes(${added})`);
          } else {
            reasonParts.push(`removedNodes(${removed})`);
          }
          continue;
        }
        if (mutation.type === "attributes") {
          const { attributeName } = mutation;
          if (
            attributeName === CONTENT_ID_ATTRIBUTE ||
            attributeName === CONTENT_PHASE_ATTRIBUTE
          ) {
            const { oldValue } = mutation;
            if (oldValue === null) {
              const value = targetSlot.getAttribute(attributeName);
              reasonParts.push(
                value
                  ? `added [${attributeName}=${value}]`
                  : `added [${attributeName}]`,
              );
            } else if (targetSlot.hasAttribute(attributeName)) {
              const value = targetSlot.getAttribute(attributeName);
              reasonParts.push(`[${attributeName}] ${oldValue} -> ${value}`);
            } else {
              reasonParts.push(
                oldValue
                  ? `removed [${attributeName}=${oldValue}]`
                  : `removed [${attributeName}]`,
              );
            }
          }
        }
      }

      if (reasonParts.length === 0) {
        return;
      }
      targetSlotEffect(reasonParts);
    });
    mutationObserver.observe(targetSlot, {
      childList: true,
      attributes: true,
      attributeFilter: [CONTENT_ID_ATTRIBUTE, CONTENT_PHASE_ATTRIBUTE],
      characterData: false,
    });
    addTeardown(() => {
      mutationObserver.disconnect();
    });
  }
  {
    const slots = [
      targetSlot,
      outgoingSlot,
      previousTargetSlot,
      previousOutgoingSlot,
    ];
    for (const slot of slots) {
      addTeardown(monitorItemsOverflow(slot));
    }
  }

  const setDuration = (newDuration) => {
    duration = newDuration;
    // Update CSS variable immediately
    root.style.setProperty("--x-transition-duration", `${duration}ms`);
  };
  const setAlignment = (newAlignX, newAlignY) => {
    alignX = newAlignX;
    alignY = newAlignY;
    updateAlignment();
  };

  return {
    updateContentId: (value) => {
      if (value) {
        targetSlot.setAttribute(CONTENT_ID_ATTRIBUTE, value);
      } else {
        targetSlot.removeAttribute(CONTENT_ID_ATTRIBUTE);
      }
    },

    transitionTo,
    resetContent,
    setDuration,
    setAlignment,
    updateAlignment,
    setPauseBreakpoints: (value) => {
      groupTransitionOptions.pauseBreakpoints = value;
    },
    cleanup: () => {
      teardown();
    },
  };
};

/**
 * UITransition
 *
 * A Preact component that enables smooth animated transitions between its children when the content changes.
 * It observes content keys and phases to create different types of transitions.
 *
 * Features:
 * - Content transitions: Between different content keys (e.g., user profiles, search results)
 * - Phase transitions: Between loading/content/error states for the same content key
 * - Automatic size animation to accommodate content changes
 * - Configurable transition types: "slide-left", "cross-fade"
 * - Independent duration control for content and phase transitions
 *
 * Usage:
 * - Wrap dynamic content in <UITransition> to animate between states
 * - Set a unique `data-content-id` on your rendered content to identify each content variant
 * - Use `data-content-phase` to mark loading/error states for phase transitions
 * - Configure transition types and durations for both content and phase changes
 *
 * Example:
 *
 *   <UITransition>
 *     {isLoading
 *       ? <Spinner data-content-key={userId} data-content-phase />
 *       : <UserProfile user={user} data-content-key={userId} />}
 *   </UITransition>
 *
 * When `data-content-id` changes, UITransition animates content transitions.
 * When `data-content-phase` changes for the same key, it animates phase transitions.
 */

const UITransitionContentIdContext = createContext();
const UITransition = ({
  children,
  contentId,
  type,
  duration,
  debugDetection,
  debugContent,
  debugSize,
  disabled,
  uiTransitionRef,
  alignX,
  alignY,
  ...props
}) => {
  const contentIdRef = useRef(contentId);
  const updateContentId = () => {
    const uiTransition = uiTransitionRef.current;
    if (!uiTransition) {
      return;
    }
    const value = contentIdRef.current;
    uiTransition.updateContentId(value);
  };
  const uiTransitionContentIdContextValue = useMemo(() => {
    const set = new Set();
    const onSetChange = () => {
      const value = Array.from(set).join("|");
      contentIdRef.current = value;
      updateContentId();
    };
    const update = (part, newPart) => {
      if (!set.has(part)) {
        if (set.size === 0) {
          console.warn(`UITransition: content id update "${part}" -> "${newPart}" ignored because content id set is empty`);
          return;
        }
        console.warn(`UITransition: content id update "${part}" -> "${newPart}" ignored because content id not found in set, only got [${Array.from(set).join(", ")}]`);
        return;
      }
      set.delete(part);
      set.add(newPart);
      onSetChange();
    };
    const add = part => {
      if (!part) {
        return;
      }
      if (set.has(part)) {
        return;
      }
      set.add(part);
      onSetChange();
    };
    const remove = part => {
      if (!part) {
        return;
      }
      if (!set.has(part)) {
        return;
      }
      set.delete(part);
      onSetChange();
    };
    return {
      add,
      update,
      remove
    };
  }, []);
  const ref = useRef();
  const uiTransitionRefDefault = useRef();
  uiTransitionRef = uiTransitionRef || uiTransitionRefDefault;
  useLayoutEffect(() => {
    const uiTransition = createUITransitionController(ref.current, {
      alignX,
      alignY
    });
    uiTransitionRef.current = uiTransition;
    return () => {
      uiTransition.cleanup();
    };
  }, [disabled, alignX, alignY]);
  return jsxs("div", {
    ref: ref,
    ...props,
    className: "ui_transition",
    "data-disabled": disabled ? "" : undefined,
    "data-transition-type": type,
    "data-transition-duration": duration,
    "data-debug-detection": debugDetection ? "" : undefined,
    "data-debug-size": debugSize ? "" : undefined,
    "data-debug-content": debugContent ? "" : undefined,
    children: [jsxs("div", {
      className: "ui_transition_active_group",
      children: [jsx("div", {
        className: "ui_transition_target_slot",
        "data-content-id": contentIdRef.current ? contentIdRef.current : undefined,
        children: jsx(UITransitionContentIdContext.Provider, {
          value: uiTransitionContentIdContextValue,
          children: children
        })
      }), jsx("div", {
        className: "ui_transition_outgoing_slot",
        inert: true
      })]
    }), jsxs("div", {
      className: "ui_transition_previous_group",
      inert: true,
      children: [jsx("div", {
        className: "ui_transition_previous_target_slot"
      }), jsx("div", {
        className: "ui_transition_previous_outgoing_slot"
      })]
    })]
  });
};

/**
 * The goal of this hook is to allow a component to set a "content key"
 * Meaning all content within the component is identified by that key
 *
 * When the key changes, UITransition will be able to detect that and consider the content
 * as changed even if the component is still the same
 *
 * This is used by <Route> to set the content key to the route path
 * When the route becomes inactive it will call useUITransitionContentId(undefined)
 * And if a sibling route becones active it will call useUITransitionContentId with its own path
 *
 */
const useUITransitionContentId = value => {
  const contentId = useContext(UITransitionContentIdContext);
  const valueRef = useRef();
  if (contentId !== undefined && valueRef.current !== value) {
    const previousValue = valueRef.current;
    valueRef.current = value;
    if (previousValue === undefined) {
      contentId.add(value);
    } else {
      contentId.update(previousValue, value);
    }
  }
  useLayoutEffect(() => {
    if (contentId === undefined) {
      return null;
    }
    return () => {
      contentId.remove(valueRef.current);
    };
  }, []);
};

/**
 * Custom route pattern matching system
 * Replaces URLPattern with a simpler, more predictable approach
 */


// Raw URL part functionality for bypassing encoding
const rawUrlPartSymbol = Symbol("raw_url_part");
const rawUrlPart = (value) => {
  return {
    [rawUrlPartSymbol]: true,
    value,
  };
};

/**
 * Encode parameter values for URL usage, with special handling for raw URL parts.
 * When a parameter is wrapped with rawUrlPart(), it bypasses encoding and is
 * inserted as-is into the URL.
 */
const encodeParamValue = (value, isWildcard = false) => {
  if (value && value[rawUrlPartSymbol]) {
    return value.value;
  }

  if (isWildcard) {
    // For wildcards, only encode characters that are invalid in URL paths,
    // but preserve slashes as they are path separators
    return value
      ? value.replace(/[^a-zA-Z0-9\-._~!$&'()*+,;=:@/]/g, (char) => {
          return encodeURIComponent(char);
        })
      : value;
  }

  // For named parameters and search params, encode everything including slashes
  return encodeURIComponent(value);
};

/**
 * Build query string from parameters, respecting rawUrlPart values
 */
const buildQueryString = (params) => {
  const searchParamPairs = [];

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      const encodedKey = encodeURIComponent(key);

      // Handle array values - join with commas
      if (Array.isArray(value)) {
        if (value.length === 0) ; else {
          const encodedValue = value
            .map((item) => encodeURIComponent(String(item)))
            .join(",");
          searchParamPairs.push(`${encodedKey}=${encodedValue}`);
        }
      }
      // Handle boolean values - if true, just add the key without value
      else if (value === true || value === "") {
        searchParamPairs.push(encodedKey);
      } else {
        const encodedValue = encodeParamValue(value, false); // Search params encode slashes
        searchParamPairs.push(`${encodedKey}=${encodedValue}`);
      }
    }
  }

  return searchParamPairs.join("&");
};

const DEBUG$2 =
  typeof process === "object" ? process.env.DEBUG === "true" : false;

// Base URL management
let baseFileUrl;
let baseUrl;
const setBaseUrl = (value) => {
  baseFileUrl = new URL(
    value,
    typeof window === "undefined" ? "http://localhost/" : window.location,
  ).href;
  baseUrl = new URL(".", baseFileUrl).href;
};
setBaseUrl(
  typeof window === "undefined"
    ? "/"
    : window.location.origin,
);

// Function to detect signals in route patterns and connect them
const detectSignals = (routePattern) => {
  const signalConnections = [];
  let updatedPattern = routePattern;

  // First check for the common mistake: :${signalName} without parameter name
  const anonymousSignalRegex = /([?:&])(\{navi_state_signal:[^}]+\})/g;
  let anonymousMatch;
  while ((anonymousMatch = anonymousSignalRegex.exec(routePattern)) !== null) {
    const [fullMatch, prefix, signalString] = anonymousMatch;
    console.warn(
      `[detectSignals] Anonymous signal parameter detected: "${fullMatch}". ` +
        `This pattern won't work correctly because it lacks a parameter name. ` +
        `Consider using "${prefix}paramName=${signalString}" instead. ` +
        `For example, if this should be a "mode" parameter, use "${prefix}mode=${signalString}".`,
    );
  }

  // Look for signals in two formats:
  // 1. Expected format: :paramName={navi_state_signal:id} or ?paramName={navi_state_signal:id} or &paramName={navi_state_signal:id}
  // 2. Typoe format (missing = sign): &paramName{navi_state_signal:id}
  const signalParamRegex = /([?:&])(\w+)(=)?(\{navi_state_signal:[^}]+\})/g;
  let match;

  while ((match = signalParamRegex.exec(routePattern)) !== null) {
    const [fullMatch, prefix, paramName, equalSign, signalString] = match;

    // Emit warning if equal sign is missing
    if (!equalSign) {
      console.warn(
        `[detectSignals] Missing '=' sign in route pattern: "${prefix}${paramName}${signalString}". ` +
          `Consider using "${prefix}${paramName}=${signalString}" for better clarity.`,
      );
    }

    // Extract the signal ID from the format: {navi_state_signal:id}
    const signalIdMatch = signalString.match(/\{navi_state_signal:([^}]+)\}/);
    if (!signalIdMatch) {
      console.warn(
        `[detectSignals] Failed to extract signal ID from: ${signalString}`,
      );
      continue;
    }

    const signalId = signalIdMatch[1];
    const signalData = globalSignalRegistry.get(signalId);

    if (signalData) {
      const { signal, options } = signalData;

      let replacement;
      if (prefix === ":") {
        // Path parameter: :section={navi_state_signal:...} becomes :section
        replacement = `${prefix}${paramName}`;
      } else if (prefix === "?" || prefix === "&") {
        // Query parameter: ?city={navi_state_signal:...} or &lon{navi_state_signal:...} becomes ?city or &lon
        replacement = `${prefix}${paramName}`;
      }
      updatedPattern = updatedPattern.replace(fullMatch, replacement);

      signalConnections.push({
        paramName,
        signal,
        ...options,
      });
    } else {
      console.warn(
        `[detectSignals] Signal not found in registry for ID: "${signalId}"`,
      );
      console.warn(
        `[detectSignals] Available signal IDs in registry:`,
        Array.from(globalSignalRegistry.keys()),
      );
      console.warn(`[detectSignals] Full pattern: "${routePattern}"`);
    }
  }

  return [updatedPattern, signalConnections];
};

/**
 * Creates a custom route pattern matcher
 */
const createRoutePattern = (pattern) => {
  // Detect and process signals in the pattern first
  const [cleanPattern, connections] = detectSignals(pattern);
  // Build parameter connection map for efficient lookups
  const connectionMap = new Map();
  // Create signalSet to track all signals this pattern depends on
  const signalSet = new Set();
  for (const connection of connections) {
    connectionMap.set(connection.paramName, connection);
    signalSet.add(connection.signal);
  }

  const parsedPattern = parsePattern(cleanPattern, connectionMap);

  if (DEBUG$2) {
    console.debug(`[CustomPattern] Created pattern:`, parsedPattern);
    console.debug(`[CustomPattern] Signal connections:`, connections);
    console.debug(`[CustomPattern] SignalSet size:`, signalSet.size);
  }

  const applyOn = (url) => {
    const result = matchUrl(parsedPattern, url, {
      baseUrl,
      connectionMap,
      patternObj: patternObject,
    });

    if (DEBUG$2) {
      console.debug(
        `[CustomPattern] Matching "${url}" against "${cleanPattern}":`,
        result,
      );
    }

    return result;
  };

  const resolveParams = (providedParams = {}) => {
    let resolvedParams = { ...providedParams };

    // Process all connections for parameter resolution
    for (const [paramName, connection] of connectionMap) {
      if (paramName in providedParams) {
        // Parameter was explicitly provided - always respect explicit parameters
        // Don't check signal value - explicit parameter takes precedence
        continue;
      }
      const signalValue = connection.signal.value;
      if (signalValue !== undefined) {
        // Parameter was not provided, check signal value
        resolvedParams[paramName] = signalValue;
      }
    }

    // Add defaults for parameters that are still missing
    // Use current dynamic defaults from signal connections
    for (const [paramName, connection] of connectionMap) {
      if (paramName in resolvedParams) {
        continue;
      }
      const currentDefault = connection.getDefaultValue();
      if (currentDefault !== undefined) {
        resolvedParams[paramName] = currentDefault;
      }
    }

    // Include active non-default parameters from child routes for URL optimization
    // Only include from child routes that would actually match the current parameters
    const childPatternObjs = patternObject.children;
    for (const childPatternObj of childPatternObjs) {
      // Check if this child route would match the current resolved parameters
      // by simulating URL building and seeing if the child segments align
      let childWouldMatch = true;

      // Compare child segments with what would be built from current params
      for (let i = 0; i < childPatternObj.pattern.segments.length; i++) {
        const childSegment = childPatternObj.pattern.segments[i];
        const parentSegment = parsedPattern.segments[i];

        if (childSegment.type === "literal") {
          if (parentSegment && parentSegment.type === "param") {
            // Child has literal where parent has parameter - check if values match
            const paramValue = resolvedParams[parentSegment.name];
            if (paramValue !== childSegment.value) {
              childWouldMatch = false;
              break;
            }
          }
          // If parent also has literal at this position, they should already match from route hierarchy
        }
        // Parameter segments are always compatible
      }

      if (childWouldMatch) {
        for (const [
          childParam,
          childConnection,
        ] of childPatternObj.connectionMap) {
          if (childParam in resolvedParams) {
            continue;
          }
          const childSignalValue = childConnection.signal.value;
          // Only include if not already resolved and is non-default
          if (
            childSignalValue !== undefined &&
            childSignalValue !== childConnection.getDefaultValue()
          ) {
            resolvedParams[childParam] = childSignalValue;
          }
        }
      }
    }

    return resolvedParams;
  };

  /**
   * Build the most precise URL by using route relationships from pattern registry.
   * Each route is responsible for its own URL generation using its own signals.
   */

  /**
   * Helper: Filter out default values from parameters for cleaner URLs
   *
   * This function removes parameters that match their default values (static or dynamic)
   * while preserving custom values and inherited parameters from ancestor routes.
   * Parameter inheritance from parent routes is intentional - only default values
   * for the current route's own parameters are filtered out.
   */
  const removeDefaultValues = (params) => {
    const filtered = { ...params };

    for (const [paramName, connection] of connectionMap) {
      if (paramName in filtered) {
        // Parameter is explicitly provided - check if we should remove it
        const paramValue = filtered[paramName];

        if (!connection.isCustomValue(paramValue)) {
          delete filtered[paramName];
        }
      } else {
        // Parameter not provided but signal has a value
        const signalValue = connection.signal.value;
        if (connection.isCustomValue(signalValue)) {
          // Only include custom values
          filtered[paramName] = signalValue;
        }
      }
    }

    return filtered;
  };

  /**
   * Helper: Check if a literal value can be reached through available parameters
   */
  const canReachLiteralValue = (literalValue, params) => {
    // Check parent's own parameters (signals and user params)
    const parentCanProvide = connections.some((conn) => {
      const signalValue = conn.signal.value;
      const userValue = params[conn.paramName];
      const effectiveValue = userValue !== undefined ? userValue : signalValue;
      return (
        effectiveValue === literalValue && conn.isCustomValue(effectiveValue)
      );
    });

    // Check user-provided parameters
    const userCanProvide = Object.entries(params).some(
      ([, value]) => value === literalValue,
    );

    // Check if any signal in the current pattern tree can provide this literal
    // We traverse ancestors and descendants to find signals that could provide the literal
    const getAncestorSignals = (pattern) => {
      const signals = [];
      let current = pattern;
      while (current) {
        signals.push(...current.connections);
        current = current.parent;
      }
      return signals;
    };

    const getDescendantSignals = (pattern) => {
      const signals = [...pattern.connections];
      for (const child of pattern.children) {
        signals.push(...getDescendantSignals(child));
      }
      return signals;
    };

    const allRelevantSignals = [
      ...getAncestorSignals(patternObject),
      ...getDescendantSignals(patternObject),
    ];

    const systemCanProvide = allRelevantSignals.some((conn) => {
      const signalValue = conn.signal.value;
      return signalValue === literalValue && conn.isCustomValue(signalValue);
    });

    return parentCanProvide || userCanProvide || systemCanProvide;
  };
  const checkChildRouteCompatibility = (childPatternObj, params) => {
    const childParams = {};
    let isCompatible = true;

    // CRITICAL: Check if parent route can reach all child route's literal segments
    // A route can only optimize to a descendant if there's a viable path through parameters
    // to reach all the descendant's literal segments (e.g., "/" cannot reach "/admin"
    // without a parameter that produces "admin")
    const childLiterals = childPatternObj.pattern.segments.filter(
      (segment) => segment.type === "literal",
    );
    // Check each child literal segment
    for (let i = 0; i < childLiterals.length; i++) {
      const childLiteral = childLiterals[i];
      const childPosition = childLiteral.index;
      const literalValue = childLiteral.value;

      // Check what the parent has at this position
      const parentSegmentAtPosition = parsedPattern.segments.find(
        (segment) => segment.index === childPosition,
      );

      if (parentSegmentAtPosition) {
        if (parentSegmentAtPosition.type === "literal") {
          // Parent has a literal at this position
          if (parentSegmentAtPosition.value === literalValue) {
            // Same literal - no problem
            continue;
          }
          // Different literal - incompatible
          if (DEBUG$2) {
            console.debug(
              `[${pattern}] INCOMPATIBLE with ${childPatternObj.originalPattern}: conflicting literal "${parentSegmentAtPosition.value}" vs "${literalValue}" at position ${childPosition}`,
            );
          }
          return { isCompatible: false, childParams: {} };
        }
        if (parentSegmentAtPosition.type === "param") {
          // Parent has a parameter at this position - child literal can satisfy this parameter
          // BUT we need to check if the parent's parameter value matches the child's literal

          // Find the parent's parameter value from signals or params
          const paramName = parentSegmentAtPosition.name;
          let parentParamValue = params[paramName];

          // If not in params, check signals
          if (parentParamValue === undefined) {
            const parentConnection = connectionMap.get(paramName);
            if (parentConnection) {
              parentParamValue = parentConnection.signal.value;
            }
          }

          // If parent has a specific value for this parameter, it must match the child literal
          if (
            parentParamValue !== undefined &&
            parentParamValue !== literalValue
          ) {
            return { isCompatible: false, childParams: {} };
          }

          continue;
        }
      }
      // Parent doesn't have a segment at this position - child extends beyond parent
      // Check if any available parameter can produce this literal value
      else if (!canReachLiteralValue(literalValue, params)) {
        if (DEBUG$2) {
          console.debug(
            `[${pattern}] INCOMPATIBLE with ${childPatternObj.originalPattern}: cannot reach literal segment "${literalValue}" at position ${childPosition} - no viable parameter path`,
          );
        }
        return { isCompatible: false, childParams: {} };
      }
    }

    // Check both parent signals AND user-provided params for child route matching
    const paramsToCheck = [
      ...connections,
      ...Object.entries(params).map(([key, value]) => ({
        paramName: key,
        userValue: value,
        isUserProvided: true,
      })),
    ];

    for (const item of paramsToCheck) {
      const result = processParameterForChildRoute(
        item,
        childPatternObj.pattern,
      );

      if (DEBUG$2) {
        console.debug(
          `[${pattern}] Processing param '${item.paramName}' (userProvided: ${item.isUserProvided}, value: ${item.isUserProvided ? item.userValue : item.signal?.value}) for child ${childPatternObj.originalPattern}: compatible=${result.isCompatible}, shouldInclude=${result.shouldInclude}`,
        );
      }

      if (!result.isCompatible) {
        isCompatible = false;
        if (DEBUG$2) {
          console.debug(
            `[${pattern}] Child ${childPatternObj.originalPattern} INCOMPATIBLE due to param '${item.paramName}'`,
          );
        }
        break;
      }

      if (result.shouldInclude) {
        childParams[result.paramName] = result.paramValue;
      }
    }

    if (DEBUG$2) {
      console.debug(
        `[${pattern}] Final compatibility result for ${childPatternObj.originalPattern}: ${isCompatible}`,
      );
    }

    return { isCompatible, childParams };
  };

  /**
   * Helper: Process a single parameter for child route compatibility
   */
  const processParameterForChildRoute = (item, childParsedPattern) => {
    let paramName;
    let paramValue;

    if (item.isUserProvided) {
      paramName = item.paramName;
      paramValue = item.userValue;
    } else {
      paramName = item.paramName;
      paramValue = item.signal.value;
      // Only include custom parent signal values (not using defaults)
      if (paramValue === undefined || !item.isCustomValue(paramValue)) {
        return { isCompatible: true, shouldInclude: false };
      }
    }

    // Check if parameter value matches a literal segment in child pattern
    const matchesChildLiteral = paramMatchesChildLiteral(
      paramValue,
      childParsedPattern,
    );
    if (matchesChildLiteral) {
      // Compatible - parameter value matches child literal
      return {
        isCompatible: true,
        shouldInclude: !item.isUserProvided,
        paramName,
        paramValue,
      };
    }

    // ROBUST FIX: For path parameters, check semantic compatibility by verifying
    // that parent parameter values can actually produce the child route structure
    const isParentPathParam = connectionMap.has(paramName);
    if (isParentPathParam) {
      // Check if parent parameter value matches any child literal where it should
      // The key insight: if parent has a specific parameter value, child route must
      // be reachable with that value or they're incompatible
      const parameterCanReachChild = canParameterReachChildRoute(
        paramName,
        paramValue,
        parsedPattern,
        childParsedPattern,
      );

      if (!parameterCanReachChild) {
        return { isCompatible: false };
      }
    }

    // Check if this is a query parameter in the parent pattern
    const isParentQueryParam = parsedPattern.queryParams.some(
      (qp) => qp.name === paramName,
    );
    if (isParentQueryParam) {
      // Query parameters are always compatible and can be inherited by child routes
      return {
        isCompatible: true,
        shouldInclude: !item.isUserProvided && !matchesChildLiteral,
        paramName,
        paramValue,
      };
    }

    // Check for generic parameter-literal conflicts (only for path parameters)
    if (!matchesChildLiteral) {
      // Check if this is a path parameter from parent pattern
      const isParentPathParam = connectionMap.has(paramName);
      if (isParentPathParam) {
        // Parameter value (from user or signal) doesn't match this child's literals
        // Check if child has any literal segments that would conflict with this parameter
        const hasConflictingLiteral = childParsedPattern.segments.some(
          (segment) =>
            segment.type === "literal" && segment.value !== paramValue,
        );
        if (hasConflictingLiteral) {
          return { isCompatible: false };
        }
      }
    }

    // Compatible but should only include if from signal (not user-provided)
    return {
      isCompatible: true,
      shouldInclude: !item.isUserProvided && !matchesChildLiteral,
      paramName,
      paramValue,
    };
  };

  /**
   * Helper: Determine if child route should be used based on active parameters
   */
  const shouldUseChildRoute = (
    childPatternObj,
    params,
    compatibility,
    resolvedParams,
  ) => {
    // CRITICAL: Check if user explicitly passed undefined for parameters that would
    // normally be used to select this child route via sibling route relationships
    for (const [paramName, paramValue] of Object.entries(params)) {
      if (paramValue !== undefined) {
        continue;
      }

      // Look for sibling routes (other children of the same parent) that use this parameter
      const siblingPatternObjs = patternObject.children;
      for (const siblingPatternObj of siblingPatternObjs) {
        if (siblingPatternObj === childPatternObj) continue; // Skip self

        // Check if sibling route uses this parameter and get the connection
        const siblingConnection =
          siblingPatternObj.connectionMap.get(paramName);
        if (!siblingConnection) {
          continue;
        }
        const siblingSignalValue = siblingConnection.signal.value;
        if (siblingSignalValue === undefined) {
          continue;
        }
        // Check if this child route has a literal that matches the signal value
        const signalMatchesThisChildLiteral =
          childPatternObj.pattern.segments.some(
            (segment) =>
              segment.type === "literal" &&
              segment.value === siblingSignalValue,
          );
        if (signalMatchesThisChildLiteral) {
          // This child route's literal matches the sibling's signal value
          // User passed undefined to override that signal - don't use this child route
          if (DEBUG$2) {
            console.debug(
              `[${pattern}] Blocking child route ${childPatternObj.originalPattern} because ${paramName}:undefined overrides sibling signal value "${siblingSignalValue}"`,
            );
          }
          return false;
        }
      }
    }

    // CRITICAL: Block child routes that have literal segments requiring specific parameter values
    // that aren't available. Only check literal segments that replace parameter positions.
    // Example: /map/flow/ replaces /:panel/ with "flow", so panel must equal "flow"
    let hasIncompatibleLiterals = false;
    let hasMatchingNonDefaultLiterals = false;

    for (let i = 0; i < childPatternObj.pattern.segments.length; i++) {
      const childSegment = childPatternObj.pattern.segments[i];
      const parentSegment = parsedPattern.segments[i];

      if (
        childSegment.type === "literal" &&
        parentSegment &&
        parentSegment.type === "param"
      ) {
        // This literal segment replaces a parameter in the parent
        const paramName = parentSegment.name;
        const explicitValue = params[paramName];
        const connection = connectionMap.get(paramName);
        const signalValue = connection ? connection.signal.value : undefined;

        // Check if the parameter has the required value
        if (
          explicitValue !== childSegment.value &&
          signalValue !== childSegment.value
        ) {
          hasIncompatibleLiterals = true;
          if (DEBUG$2) {
            console.debug(
              `[${pattern}] Blocking child route ${childPatternObj.originalPattern} because parameter "${paramName}" must be "${childSegment.value}" but current values are explicit="${explicitValue}" signal="${signalValue}"`,
            );
          }
          break;
        }

        // Check if this matching literal represents a non-default parameter value
        // (for forcing child route selection later)
        if (explicitValue === childSegment.value && connection) {
          const defaultValue = connection.getDefaultValue();
          if (explicitValue !== defaultValue) {
            hasMatchingNonDefaultLiterals = true;
          }
        }
      }
    }

    // Block incompatible child routes immediately
    if (hasIncompatibleLiterals) {
      return false;
    }

    // Check if child has active non-default signal values
    let hasActiveParams = false;
    const childParams = { ...compatibility.childParams };

    for (const [paramName, connection] of childPatternObj.connectionMap) {
      // Check if parameter was explicitly provided by user
      const hasExplicitParam = paramName in params;
      const explicitValue = params[paramName];

      if (hasExplicitParam) {
        // User explicitly provided this parameter - use their value
        childParams[paramName] = explicitValue;
        if (
          explicitValue !== undefined &&
          connection.isCustomValue(explicitValue)
        ) {
          hasActiveParams = true;
        }
      } else {
        const signalValue = connection.signal.value;
        if (signalValue !== undefined) {
          // No explicit override - use signal value
          childParams[paramName] = signalValue;
          if (connection.isCustomValue(signalValue)) {
            hasActiveParams = true;
          }
        }
      }
    }

    // Check if child pattern can be fully satisfied
    const initialMergedParams = { ...childParams, ...params };
    const canBuildChildCompletely = childPatternObj.pattern.segments.every(
      (segment) => {
        if (segment.type === "literal") return true;
        if (segment.type === "param") {
          return (
            segment.optional || initialMergedParams[segment.name] !== undefined
          );
        }
        return true;
      },
    );

    // Count only non-undefined provided parameters that are NOT default values
    const nonDefaultParams = Object.entries(params).filter(
      ([paramName, value]) => {
        if (value === undefined) return false;

        // Check if this parameter has a default value in child's connections
        const childConnection = childPatternObj.connectionMap.get(paramName);
        if (childConnection) {
          const childDefault = childConnection.getDefaultValue();
          return value !== childDefault;
        }

        // Check if this parameter has a default value in parent's connections (current pattern)
        const parentConnection = connectionMap.get(paramName);
        if (parentConnection) {
          const parentDefault = parentConnection.getDefaultValue();
          return value !== parentDefault;
        }

        return true; // Non-connection parameters are considered non-default
      },
    );

    const hasNonDefaultProvidedParams = nonDefaultParams.length > 0;

    // Use child route if:
    // 1. Child has active non-default parameters, OR
    // 2. User provided non-default params AND child can be built completely, OR
    // 3. User provided params that match child literal segments AND are non-default values
    // EXCEPT: Don't use child if parent can produce cleaner URL by omitting defaults
    let shouldUse =
      hasActiveParams ||
      (hasNonDefaultProvidedParams && canBuildChildCompletely) ||
      (hasMatchingNonDefaultLiterals && canBuildChildCompletely);

    if (DEBUG$2) {
      console.debug(
        `[${pattern}] shouldUseChildRoute decision for ${childPatternObj.originalPattern}:`,
        {
          hasActiveParams,
          hasNonDefaultProvidedParams,
          canBuildChildCompletely,
          shouldUse,
        },
      );
    }

    // Optimization: Check if child would include literal segments that represent default values
    if (shouldUse) {
      // Check if child pattern has literal segments that correspond to default parameter values
      const childLiterals = childPatternObj.pattern.segments
        .filter((seg) => seg.type === "literal")
        .map((seg) => seg.value);

      const parentLiterals = parsedPattern.segments
        .filter((seg) => seg.type === "literal")
        .map((seg) => seg.value);

      // If child has more literal segments than parent, check if the extra ones are defaults
      if (childLiterals.length > parentLiterals.length) {
        const extraLiterals = childLiterals.slice(parentLiterals.length);

        // Check if any extra literal matches a default parameter value
        // BUT only skip if user didn't explicitly provide that parameter AND
        // both conditions are true:
        // 1. The parameters that would cause us to use this child route are defaults
        // 2. The child route doesn't have non-default parameters that would be lost
        let childSpecificParamsAreDefaults = true;

        // Check if parameters that determine child selection are non-default
        // OR if any descendant parameters indicate explicit navigation
        for (const [paramName, connection] of connectionMap) {
          const currentDefault = connection.getDefaultValue(); // Use current dynamic default
          const resolvedValue = resolvedParams[paramName];
          const userProvidedParam = paramName in params;

          if (extraLiterals.includes(currentDefault)) {
            // This literal corresponds to a parameter in the parent
            if (
              userProvidedParam ||
              (resolvedValue !== undefined &&
                connection.isCustomValue(resolvedValue))
            ) {
              // Parameter was explicitly provided or has custom value - child is needed
              childSpecificParamsAreDefaults = false;
              break;
            }
          }
        }

        // Additional check: if child route has path parameters that are non-default,
        // this indicates explicit navigation even if structural parameters happen to be default
        // (Query parameters don't count as they don't indicate structural navigation)
        if (childSpecificParamsAreDefaults) {
          for (const childConnection of childPatternObj.connections) {
            const childParamName = childConnection.paramName;
            const childDefaultValue = childConnection.getDefaultValue();
            const childResolvedValue = resolvedParams[childParamName];

            // Only consider path parameters, not query parameters
            const isPathParam = childPatternObj.pattern.segments.some(
              (seg) => seg.type === "param" && seg.name === childParamName,
            );

            if (
              isPathParam &&
              childResolvedValue !== undefined &&
              childResolvedValue !== childDefaultValue
            ) {
              // Child has non-default path parameters, indicating explicit navigation
              childSpecificParamsAreDefaults = false;
              if (DEBUG$2) {
                console.debug(
                  `[${pattern}] Child has non-default path parameter '${childParamName}=${childResolvedValue}' (default: ${childDefaultValue}) - indicates explicit navigation`,
                );
              }
              break;
            }
          }
        }

        // When structural parameters (those that determine child selection) are defaults,
        // prefer parent route regardless of whether child has other non-default parameters
        if (childSpecificParamsAreDefaults) {
          for (const [paramName, connection] of connectionMap) {
            const currentDefault = connection.getDefaultValue(); // Use current dynamic default
            const userProvidedParam = paramName in params;

            if (extraLiterals.includes(currentDefault) && !userProvidedParam) {
              // This child includes a literal that represents a default value
              // AND user didn't explicitly provide this parameter
              // When structural parameters are defaults, prefer parent for cleaner URL
              shouldUse = false;
              if (DEBUG$2) {
                console.debug(
                  `[${pattern}] Preferring parent over child - child includes default literal '${currentDefault}' for param '${paramName}' (structural parameter is default)`,
                );
              }
              break;
            }
          }
        } else if (DEBUG$2) {
          console.debug(
            `[${pattern}] Using child route - parameters that determine child selection are non-default`,
          );
        }
      }
    }

    if (DEBUG$2 && shouldUse) {
      console.debug(
        `[${pattern}] Will use child route ${childPatternObj.originalPattern}`,
      );
    }

    return shouldUse;
  };

  /**
   * Helper: Build URL for selected child route with proper parameter filtering
   */
  const buildChildRouteUrl = (
    childPatternObj,
    params,
    parentResolvedParams = {},
  ) => {
    // Start with child signal values
    const baseParams = {};
    for (const [paramName, connection] of childPatternObj.connectionMap) {
      // Check if parameter was explicitly provided by user
      const hasExplicitParam = paramName in params;
      const explicitValue = params[paramName];

      if (hasExplicitParam) {
        // User explicitly provided this parameter - use their value (even if undefined)
        if (explicitValue !== undefined) {
          baseParams[paramName] = explicitValue;
        }
        // If explicitly undefined, don't include it (which means don't use child route)
      } else {
        const signalValue = connection.signal.value;
        if (
          signalValue !== undefined &&
          connection.isCustomValue(signalValue)
        ) {
          // No explicit override - use signal value if non-default
          baseParams[paramName] = signalValue;
        }
      }
    }

    // Collect parameters from ALL ancestor routes in the hierarchy (not just immediate parent)
    const collectAncestorParameters = (currentPatternObj) => {
      if (!currentPatternObj?.parent) {
        return; // No more ancestors
      }

      const parentPatternObj = currentPatternObj.parent;

      // Add parent's signal parameters
      for (const connection of parentPatternObj.connections) {
        const { paramName } = connection;

        // Skip if child route already handles this parameter
        if (childPatternObj.connectionMap.has(paramName)) {
          continue; // Child route handles this parameter directly
        }

        // Skip if parameter is already collected
        if (paramName in baseParams) {
          continue; // Already have this parameter
        }

        const signalValue = connection.signal.value;
        // Only include custom signal values (not using defaults)
        if (
          signalValue !== undefined &&
          connection.isCustomValue(signalValue)
        ) {
          // Skip if parameter is consumed by child's literal path segments
          const isConsumedByChildPath = childPatternObj.pattern.segments.some(
            (segment) =>
              segment.type === "literal" && segment.value === signalValue,
          );
          if (!isConsumedByChildPath) {
            baseParams[paramName] = signalValue;
          }
        }
      }

      // Recursively collect from higher ancestors
      collectAncestorParameters(parentPatternObj);
    };

    // Start collecting from the child's parent
    collectAncestorParameters(childPatternObj);

    // Add parent parameters from the immediate calling context
    for (const [paramName, parentValue] of Object.entries(
      parentResolvedParams,
    )) {
      // Skip if already collected from ancestors or child handles it
      if (paramName in baseParams) {
        continue;
      }

      // Skip if child route already handles this parameter
      if (childPatternObj.connectionMap.has(paramName)) {
        continue; // Child route handles this parameter directly
      }

      // Skip if parameter is consumed by child's literal path segments
      const isConsumedByChildPath = childPatternObj.pattern.segments.some(
        (segment) =>
          segment.type === "literal" && segment.value === parentValue,
      );
      if (isConsumedByChildPath) {
        continue; // Parameter is consumed by child's literal path
      }

      // Check if parent parameter is at default value
      const parentConnection = connectionMap.get(paramName);
      const parentDefault = parentConnection
        ? parentConnection.getDefaultValue()
        : undefined;
      if (parentValue === parentDefault) {
        continue; // Don't inherit default values
      }

      // Inherit this parameter as it's not handled by child and not at default
      baseParams[paramName] = parentValue;
    }

    // Apply user params with filtering logic
    for (const [paramName, userValue] of Object.entries(params)) {
      const childConnection = childPatternObj.connectionMap.get(paramName);

      if (childConnection) {
        // Only include if it's a custom value (not default)
        if (childConnection.isCustomValue(userValue)) {
          baseParams[paramName] = userValue;
        } else {
          // User provided the default value - complete omission
          delete baseParams[paramName];
        }
      } else {
        // Check if param corresponds to a literal segment in child pattern
        const isConsumedByChildPath = childPatternObj.pattern.segments.some(
          (segment) =>
            segment.type === "literal" && segment.value === userValue,
        );

        if (!isConsumedByChildPath) {
          // Not consumed by child path, keep it as query param
          baseParams[paramName] = userValue;
        }
      }
    }

    // Build child URL using buildUrl (not buildMostPreciseUrl) to prevent recursion
    const childUrl = buildUrlFromPattern(
      childPatternObj.pattern,
      baseParams,
      childPatternObj.originalPattern,
      childPatternObj,
    );

    if (childUrl && !childUrl.includes(":")) {
      // Check for parent optimization before returning
      const optimizedUrl = checkChildParentOptimization(
        childPatternObj,
        childUrl,
        baseParams,
      );
      return optimizedUrl || childUrl;
    }

    return null;
  };

  /**
   * Helper: Check if parent route optimization applies to child route
   */
  const checkChildParentOptimization = (
    childPatternObj,
    childUrl,
    baseParams,
  ) => {
    if (Object.keys(baseParams).length > 0) {
      return null; // No optimization if parameters exist
    }

    const childParent = childPatternObj.parent;

    if (childParent && childParent.originalPattern === pattern) {
      // Check if child has any non-default signal values
      const hasNonDefaultChildParams = childPatternObj.connections.some(
        (childConnection) => {
          return childConnection.isCustomValue(childConnection.signal.value);
        },
      );

      if (hasNonDefaultChildParams) {
        // Child has non-default signal values - use child URL instead of parent
        if (DEBUG$2) {
          console.debug(
            `[${pattern}] Using child route ${childPatternObj.originalPattern} because it has non-default signal values`,
          );
        }
        return childUrl;
      }
    }

    return null;
  };

  const buildMostPreciseUrl = (params = {}) => {
    if (DEBUG$2) {
      console.debug(`[${pattern}] buildMostPreciseUrl called`);
    }

    // Use the pattern object's signalSet (updated by setupPatterns)
    const effectiveSignalSet = patternObject.signalSet;

    // Access signal.value to trigger dependency tracking
    if (DEBUG$2) {
      console.debug(
        `[${pattern}] Reading ${effectiveSignalSet.size} signals for reactive dependencies`,
      );
    }
    // for (const signal of effectiveSignalSet) {
    //   // Access signal.value to trigger dependency tracking
    //   // eslint-disable-next-line no-unused-expressions
    //   signal.value; // This line is critical for signal reactivity - when commented out, routes may not update properly
    // }

    // Step 1: Resolve and clean parameters
    const resolvedParams = resolveParams(params);

    // Step 2: Try ancestors first - find the highest ancestor that works
    const parentPattern = patternObject.parent;

    if (DEBUG$2 && parentPattern) {
      console.debug(
        `[${pattern}] Available ancestor:`,
        parentPattern.originalPattern,
      );
    }

    let bestAncestorUrl = null;
    if (parentPattern) {
      // Skip root route - never use as optimization target
      if (parentPattern.originalPattern !== "/") {
        // Try to use this ancestor and traverse up to find the highest possible
        const highestAncestorUrl = findHighestAncestor(
          parentPattern,
          resolvedParams,
        );
        if (DEBUG$2) {
          console.debug(
            `[${pattern}] Highest ancestor from ${parentPattern.originalPattern}:`,
            highestAncestorUrl,
          );
        }

        if (highestAncestorUrl) {
          bestAncestorUrl = highestAncestorUrl;
        }
      }
    }

    if (bestAncestorUrl) {
      if (DEBUG$2) {
        console.debug(`[${pattern}] Using ancestor optimization`);
      }
      return bestAncestorUrl;
    }

    // Step 3: Remove default values for normal URL building
    let finalParams = removeDefaultValues(resolvedParams);

    // Step 4: Try descendants - find the deepest descendant that works
    const childPatternObjs = patternObject.children;

    let bestDescendantUrl = null;
    for (const childPatternObj of childPatternObjs) {
      const deepestDescendantUrl = findDeepestDescendant(
        childPatternObj,
        params,
        resolvedParams,
      );
      if (deepestDescendantUrl) {
        // Take the first valid deepest descendant we find (or keep deepest among multiple)
        if (!bestDescendantUrl) {
          bestDescendantUrl = deepestDescendantUrl;
        }
      }
    }

    if (bestDescendantUrl) {
      if (DEBUG$2) {
        console.debug(`[${pattern}] Using descendant optimization`);
      }
      return bestDescendantUrl;
    }
    if (DEBUG$2) {
      console.debug(`[${pattern}] No suitable child route found`);
    }

    // Step 5: Inherit parameters from parent routes
    inheritParentParameters(finalParams);

    // Step 6: Build the current route URL
    const generatedUrl = buildCurrentRouteUrl(finalParams);

    return generatedUrl;
  };

  /**
   * Helper: Find the highest ancestor by traversing parent chain recursively
   */
  const findHighestAncestor = (startAncestor, resolvedParams) => {
    // Check if we can use this ancestor directly
    const directUrl = tryUseAncestor(startAncestor, resolvedParams);
    if (!directUrl) {
      return null;
    }

    // Look for an even higher ancestor by checking the ancestor's parent
    if (startAncestor.parent) {
      const higherAncestor = startAncestor.parent;

      // Skip root pattern
      if (higherAncestor.originalPattern === "/") {
        return directUrl;
      }

      // Recursively check if we can optimize to an even higher ancestor
      const higherUrl = findHighestAncestor(higherAncestor, resolvedParams);
      if (higherUrl) {
        return higherUrl; // Found a higher ancestor, return that
      }
    }

    // No higher ancestor found, return the direct optimization
    return directUrl;
  };

  /**
   * Helper: Find the deepest descendant that can be used for this route
   */
  const findDeepestDescendant = (startChild, params, resolvedParams) => {
    // Check if we can use this child directly
    const directUrl = tryUseDescendant(startChild, params, resolvedParams);
    if (!directUrl) {
      return null;
    }

    // Now traverse down the child chain to find the deepest possible descendant
    let currentChild = startChild;
    let deepestUrl = directUrl;

    while (true) {
      const childChildren = currentChild.children || [];

      let foundDeeper = false;
      for (const deeperChild of childChildren) {
        const deeperUrl = tryUseDescendant(deeperChild, params, resolvedParams);
        if (deeperUrl) {
          // Found a deeper descendant that works
          deepestUrl = deeperUrl;
          currentChild = deeperChild;
          foundDeeper = true;
          break;
        }
      }

      if (!foundDeeper) {
        break; // No deeper descendant found, we're at the bottom
      }
    }

    return deepestUrl;
  };

  /**
   * Helper: Try to use an ancestor route (only immediate parent for parameter optimization)
   */
  const tryUseAncestor = (ancestorPatternObj, resolvedParams) => {
    // Check if this ancestor is the immediate parent (for parameter optimization safety)
    const immediateParent = patternObject.parent;

    if (
      immediateParent &&
      immediateParent.originalPattern === ancestorPatternObj.originalPattern
    ) {
      // This is the immediate parent - check if we can optimize
      if (DEBUG$2) {
        console.debug(
          `[${pattern}] tryUseAncestor: Trying immediate parent ${ancestorPatternObj.originalPattern}`,
        );
      }

      // For immediate parent optimization with parameters, only allow if:
      // 1. All path/route parameters have default values, OR
      // 2. The source route has only query parameters that are non-default
      const hasNonDefaultPathParams = connections.some((connection) => {
        const resolvedValue = resolvedParams[connection.paramName];

        // Check if this is a query parameter (not in the pattern path)
        const isQueryParam = parsedPattern.queryParams.some(
          (qp) => qp.name === connection.paramName,
        );
        // Allow non-default query parameters, but not path parameters
        return !isQueryParam && connection.isCustomValue(resolvedValue);
      });

      if (hasNonDefaultPathParams) {
        if (DEBUG$2) {
          console.debug(
            `[${pattern}] tryUseAncestor: Has non-default path parameters, skipping`,
          );
        }
        return null;
      }

      const result = tryDirectOptimization(
        parsedPattern,
        connections,
        ancestorPatternObj,
        resolvedParams,
      );
      if (DEBUG$2) {
        console.debug(
          `[${pattern}] tryUseAncestor: tryDirectOptimization result:`,
          result,
        );
      }
      return result;
    }

    // For non-immediate parents, only allow optimization if all resolved parameters have default values
    const hasNonDefaultParameters = connections.some((connection) => {
      const resolvedValue = resolvedParams[connection.paramName];
      return connection.isCustomValue(resolvedValue);
    });

    if (hasNonDefaultParameters) {
      if (DEBUG$2) {
        console.debug(
          `[${pattern}] tryUseAncestor: Non-immediate parent with non-default parameters, skipping`,
        );
      }
      return null;
    }

    // This is not the immediate parent - only allow literal-only optimization
    const hasParameters =
      connections.length > 0 ||
      parsedPattern.segments.some((seg) => seg.type === "param");

    if (hasParameters) {
      if (DEBUG$2) {
        console.debug(
          `[${pattern}] tryUseAncestor: Non-immediate parent with parameters, skipping`,
        );
      }
      return null;
    }

    // Pure literal route - only optimize to pure literal ancestors (not parametric ones)
    const ancestorHasParameters =
      ancestorPatternObj.connections.length > 0 ||
      ancestorPatternObj.pattern.segments.some((seg) => seg.type === "param");

    if (ancestorHasParameters) {
      if (DEBUG$2) {
        console.debug(
          `[${pattern}] tryUseAncestor: Literal route cannot optimize to parametric ancestor ${ancestorPatternObj.originalPattern}`,
        );
      }
      return null;
    }

    // Both are pure literal routes - can optimize
    if (DEBUG$2) {
      console.debug(
        `[${pattern}] tryUseAncestor: Trying literal-to-literal optimization to ${ancestorPatternObj.originalPattern}`,
      );
    }

    const result = tryDirectOptimization(
      parsedPattern,
      connections,
      ancestorPatternObj,
      resolvedParams,
    );
    if (DEBUG$2) {
      console.debug(
        `[${pattern}] tryUseAncestor: tryDirectOptimization result:`,
        result,
      );
    }
    return result;
  };

  /**
   * Helper: Check if current literal route can be optimized to target ancestor
   */
  const tryDirectOptimization = (
    sourcePattern,
    sourceConnections,
    targetAncestor,
    resolvedParams,
  ) => {
    const sourceLiterals = sourcePattern.segments
      .filter((seg) => seg.type === "literal")
      .map((seg) => seg.value);

    const targetLiterals = targetAncestor.pattern.segments
      .filter((seg) => seg.type === "literal")
      .map((seg) => seg.value);

    const targetParams = targetAncestor.pattern.segments.filter(
      (seg) => seg.type === "param",
    );

    if (DEBUG$2) {
      console.debug(
        `[${pattern}] tryDirectOptimization: sourceLiterals:`,
        sourceLiterals,
      );
      console.debug(
        `[${pattern}] tryDirectOptimization: targetLiterals:`,
        targetLiterals,
      );
      console.debug(
        `[${pattern}] tryDirectOptimization: targetParams:`,
        targetParams,
      );
    }

    // Source must extend target's literal path
    if (sourceLiterals.length <= targetLiterals.length) {
      if (DEBUG$2) {
        console.debug(`[${pattern}] tryDirectOptimization: Source too short`);
      }
      return null;
    }

    // Source must start with same literals as target
    for (let i = 0; i < targetLiterals.length; i++) {
      if (sourceLiterals[i] !== targetLiterals[i]) {
        if (DEBUG$2) {
          console.debug(
            `[${pattern}] tryDirectOptimization: Literal mismatch at ${i}`,
          );
        }
        return null;
      }
    }

    // For literal-only optimization: if both source and target have only literals AND no parameters,
    // and source extends target, we can optimize directly
    const sourceHasOnlyLiterals =
      sourcePattern.segments.every((seg) => seg.type === "literal") &&
      sourceConnections.length === 0;

    const targetHasOnlyLiterals =
      targetAncestor.pattern.segments.every((seg) => seg.type === "literal") &&
      targetAncestor.connections.length === 0;

    if (sourceHasOnlyLiterals && targetHasOnlyLiterals) {
      // Check if user provided any parameters that would be lost in optimization
      const hasUserProvidedParams = Object.keys(resolvedParams).some(
        (paramName) => {
          // Check if this parameter was explicitly provided by the user
          // (not just inherited from signal values with default values)
          const userProvided = resolvedParams[paramName] !== undefined;
          return userProvided;
        },
      );

      if (hasUserProvidedParams) {
        if (DEBUG$2) {
          console.debug(
            `[${pattern}] tryDirectOptimization: Cannot optimize literal-only routes - would lose user-provided parameters`,
            Object.keys(resolvedParams),
          );
        }
        return null;
      }

      if (DEBUG$2) {
        console.debug(
          `[${pattern}] tryDirectOptimization: Both are pure literal-only routes, allowing optimization`,
        );
      }
      return buildUrlFromPattern(
        targetAncestor.pattern,
        {},
        targetAncestor.originalPattern,
      );
    }

    // For parametric optimization: remaining segments must match target's parameter defaults
    const extraSegments = sourceLiterals.slice(targetLiterals.length);
    if (extraSegments.length !== targetParams.length) {
      if (DEBUG$2) {
        console.debug(
          `[${pattern}] tryDirectOptimization: Extra segments ${extraSegments.length} != target params ${targetParams.length}`,
        );
      }
      return null;
    }

    for (let i = 0; i < extraSegments.length; i++) {
      const segment = extraSegments[i];
      const param = targetParams[i];
      const connection = targetAncestor.connections.find(
        (conn) => conn.paramName === param.name,
      );
      if (!connection || connection.getDefaultValue() !== segment) {
        if (DEBUG$2) {
          console.debug(
            `[${pattern}] tryDirectOptimization: Parameter default mismatch for ${param.name}`,
          );
        }
        return null;
      }
    }

    if (DEBUG$2) {
      console.debug(
        `[${pattern}] tryDirectOptimization: SUCCESS! Returning ancestor URL`,
      );
      console.debug(
        `[${pattern}] tryDirectOptimization: resolvedParams:`,
        resolvedParams,
      );
    }

    // Build ancestor URL with inherited parameters that don't conflict with optimization
    const ancestorParams = {};

    // First, add extra parameters from the original resolvedParams
    // These are parameters that don't correspond to any pattern segments or query params
    const sourcePatternParamNames = new Set(
      sourceConnections.map((conn) => conn.paramName),
    );
    const sourceQueryParamNames = new Set(
      sourcePattern.queryParams.map((qp) => qp.name),
    );
    const targetPatternParamNames = new Set(
      targetAncestor.connections.map((conn) => conn.paramName),
    );
    const targetQueryParamNames = new Set(
      targetAncestor.pattern.queryParams.map((qp) => qp.name),
    );

    for (const [paramName, value] of Object.entries(resolvedParams)) {
      if (DEBUG$2) {
        console.debug(
          `[${pattern}] tryDirectOptimization: Considering param ${paramName}=${value}`,
        );
      }
      // Include parameters that target pattern specifically needs
      if (targetQueryParamNames.has(paramName)) {
        // Only include if the value is not the default value
        const connection = targetAncestor.connectionMap.get(paramName);
        if (connection && connection.getDefaultValue() !== value) {
          ancestorParams[paramName] = value;
          if (DEBUG$2) {
            console.debug(
              `[${pattern}] tryDirectOptimization: Added target param ${paramName}=${value}`,
            );
          }
        }
      }
      // Include source query parameters (these should be inherited during ancestor optimization)
      else if (sourceQueryParamNames.has(paramName)) {
        // Only include if the value is not the default value
        const connection = sourceConnections.find(
          (conn) => conn.paramName === paramName,
        );
        if (connection && connection.getDefaultValue() !== value) {
          ancestorParams[paramName] = value;
          if (DEBUG$2) {
            console.debug(
              `[${pattern}] tryDirectOptimization: Added source param ${paramName}=${value}`,
            );
          }
        }
      }
      // Include extra parameters that are not part of either pattern (true extra parameters)
      else if (
        !sourcePatternParamNames.has(paramName) &&
        !targetPatternParamNames.has(paramName)
      ) {
        ancestorParams[paramName] = value;
        if (DEBUG$2) {
          console.debug(
            `[${pattern}] tryDirectOptimization: Added extra param ${paramName}=${value}`,
          );
        }
      }
    }

    // Also check target ancestor's own signal values for parameters not in resolvedParams
    for (const connection of targetAncestor.connections) {
      const { paramName } = connection;
      if (paramName in ancestorParams) {
        continue;
      }

      // Only include if not already processed and has custom value (not default)
      const signalValue = connection.signal.value;
      if (signalValue !== undefined && connection.isCustomValue(signalValue)) {
        // Don't include path parameters that correspond to literal segments we're optimizing away
        const targetParam = targetParams.find((p) => p.name === paramName);
        const isPathParam = targetParam !== undefined; // Any param in segments is a path param
        if (isPathParam) {
          // Skip path parameters - we want them to use default values for optimization
          if (DEBUG$2) {
            console.debug(
              `[${pattern}] tryDirectOptimization: Skipping path param ${paramName}=${signalValue} (will use default)`,
            );
          }
          continue;
        }

        ancestorParams[paramName] = signalValue;
        if (DEBUG$2) {
          console.debug(
            `[${pattern}] tryDirectOptimization: Added target signal param ${paramName}=${signalValue}`,
          );
        }
      }
    }

    // Then, get all ancestors starting from the target ancestor's parent (skip the target itself)
    let currentParent = targetAncestor.parent;

    while (currentParent) {
      for (const connection of currentParent.connections) {
        const { paramName } = connection;
        if (paramName in ancestorParams) {
          continue;
        }

        // Only inherit custom values (not defaults) that we don't already have
        const signalValue = connection.signal.value;
        if (
          signalValue !== undefined &&
          connection.isCustomValue(signalValue)
        ) {
          // Check if this parameter would be redundant with target ancestor's literal segments
          const isRedundant = isParameterRedundantWithLiteralSegments(
            targetAncestor.pattern,
            currentParent.pattern,
            paramName);

          if (!isRedundant) {
            ancestorParams[paramName] = signalValue;
          }
        }
      }

      // Move up the parent chain
      currentParent = currentParent.parent;
    }

    return buildUrlFromPattern(
      targetAncestor.pattern,
      ancestorParams,
      targetAncestor.originalPattern,
      targetAncestor,
    );
  };

  /**
   * Helper: Try to use a descendant route (simple compatibility check)
   */
  const tryUseDescendant = (
    descendantPatternObj,
    params,
    parentResolvedParams,
  ) => {
    // Check basic compatibility
    const compatibility = checkChildRouteCompatibility(
      descendantPatternObj,
      params,
    );
    if (!compatibility.isCompatible) {
      return null;
    }

    // Check if we should use this descendant
    const shouldUse = shouldUseChildRoute(
      descendantPatternObj,
      params,
      compatibility,
      parentResolvedParams,
    );
    if (!shouldUse) {
      return null;
    }

    // Build descendant URL using buildUrl (not buildMostPreciseUrl) to prevent recursion
    return buildChildRouteUrl(
      descendantPatternObj,
      params,
      parentResolvedParams,
    );
  };

  /**
   * Helper: Inherit query parameters from parent patterns
   */
  const inheritParentParameters = (finalParams) => {
    let currentParent = patternObject.parent;

    // Traverse up the parent chain to inherit parameters
    while (currentParent) {
      // Check parent's signal connections for non-default values to inherit
      for (const parentConnection of currentParent.connections) {
        const { paramName } = parentConnection;
        if (paramName in finalParams) {
          continue; // Already have this parameter
        }

        // Only inherit if we don't have this param and parent has custom value (not default)
        const parentSignalValue = parentConnection.signal.value;
        if (
          parentSignalValue !== undefined &&
          parentConnection.isCustomValue(parentSignalValue)
        ) {
          // Don't inherit if parameter corresponds to a literal in our path
          const shouldInherit = !isParameterRedundantWithLiteralSegments(
            parsedPattern,
            currentParent.pattern,
            paramName);

          if (shouldInherit) {
            finalParams[paramName] = parentSignalValue;
          }
        }
      }
      // Move to the next parent up the chain
      currentParent = currentParent.parent;
    }
  };

  /**
   * Helper: Build URL for current route with filtered pattern
   */
  const buildCurrentRouteUrl = (finalParams) => {
    if (!parsedPattern.segments) {
      return "/";
    }

    // Filter out parameter segments that don't have values
    const filteredPattern = {
      ...parsedPattern,
      segments: parsedPattern.segments.filter((segment) => {
        if (segment.type === "param") {
          return segment.name in finalParams;
        }
        return true; // Keep literal segments
      }),
    };

    // Remove trailing slash if we filtered out segments
    if (
      filteredPattern.segments.length < parsedPattern.segments.length &&
      parsedPattern.trailingSlash
    ) {
      filteredPattern.trailingSlash = false;
    }

    return buildUrlFromPattern(
      filteredPattern,
      finalParams,
      pattern,
      patternObject,
    );
  };

  // Pattern object with unified data and methods
  const patternObject = {
    // Pattern data properties (formerly patternData)
    urlPatternRaw: pattern,
    cleanPattern,
    connections,
    connectionMap,
    parsedPattern,
    signalSet,
    children: [],
    parent: null,
    depth: 0, // Will be calculated after relationships are built

    // Pattern methods (formerly patternObj methods)
    originalPattern: pattern,
    pattern: parsedPattern,
    applyOn,
    buildMostPreciseUrl,
    resolveParams,
  };

  return patternObject;
};

/**
 * Helper: Check if parameter matches any literal in child pattern
 */
const paramMatchesChildLiteral = (paramValue, childParsedPattern) => {
  return childParsedPattern.segments.some(
    (segment) => segment.type === "literal" && segment.value === paramValue,
  );
};

/**
 * Helper: Check if a parent parameter can semantically reach a child route
 * This replaces the fragile position-based matching with semantic verification
 */
const canParameterReachChildRoute = (
  paramName,
  paramValue,
  parentPattern,
  childPattern,
) => {
  // Find the parent parameter segment
  const parentParamSegment = parentPattern.segments.find(
    (segment) => segment.type === "param" && segment.name === paramName,
  );

  if (!parentParamSegment) {
    return true; // Not a path parameter, no conflict
  }

  // Get parameter's logical path position (not array index)
  const paramPathPosition = parentParamSegment.index;

  // Find corresponding child segment at the same logical path position
  const childSegmentAtSamePosition = childPattern.segments.find(
    (segment) => segment.index === paramPathPosition,
  );

  if (!childSegmentAtSamePosition) {
    return true; // Child doesn't extend to this position, no conflict
  }

  if (childSegmentAtSamePosition.type === "literal") {
    // Child has a literal at this position - parent parameter must match exactly
    return childSegmentAtSamePosition.value === paramValue;
  }

  // Child has parameter at same position - compatible
  return true;
};

/**
 * Parse a route pattern string into structured segments
 */
const parsePattern = (pattern, connectionMap) => {
  // Handle root route
  if (pattern === "/") {
    return {
      original: pattern,
      segments: [],
      trailingSlash: true,
      wildcard: false,
      queryParams: [],
    };
  }

  // Separate path and query portions
  const [pathPortion, queryPortion] = pattern.split("?");

  // Parse query parameters if present
  const queryParams = [];
  if (queryPortion) {
    // Split query parameters by & and parse each one
    const querySegments = queryPortion.split("&");
    for (const querySegment of querySegments) {
      if (querySegment.includes("=")) {
        // Parameter with potential value: tab=value or just tab
        const [paramName, paramValue] = querySegment.split("=", 2);
        queryParams.push({
          type: "query_param",
          name: paramName,
          hasDefaultValue: paramValue === undefined, // No value means it uses signal/default
        });
      } else {
        // Parameter without value: tab
        queryParams.push({
          type: "query_param",
          name: querySegment,
          hasDefaultValue: true,
        });
      }
    }
  }

  // Remove leading slash for processing the path portion
  let cleanPattern = pathPortion.startsWith("/")
    ? pathPortion.slice(1)
    : pathPortion;

  // Check for wildcard first
  const wildcard = cleanPattern.endsWith("*");
  if (wildcard) {
    cleanPattern = cleanPattern.slice(0, -1); // Remove *
    // Also remove the slash before * if present
    if (cleanPattern.endsWith("/")) {
      cleanPattern = cleanPattern.slice(0, -1);
    }
  }

  // Check for trailing slash (after wildcard check)
  const trailingSlash = !wildcard && pathPortion.endsWith("/");
  if (trailingSlash) {
    cleanPattern = cleanPattern.slice(0, -1); // Remove trailing /
  }

  // Split into segments (filter out empty segments)
  const segmentStrings = cleanPattern
    ? cleanPattern.split("/").filter((s) => s !== "")
    : [];
  const segments = segmentStrings.map((seg, index) => {
    if (seg.startsWith(":")) {
      // Parameter segment
      const paramName = seg.slice(1).replace("?", ""); // Remove : and optional ?

      // Check if parameter should be optional:
      // 1. Explicitly marked with ?
      // 2. Has a default value
      // 3. Connected signal has undefined value and no explicit default (allows /map to match /map/:panel)
      const connection = connectionMap.get(paramName);
      const hasDefault =
        connection && connection.getDefaultValue() !== undefined;
      let isOptional = seg.endsWith("?") || hasDefault;

      if (!isOptional) {
        // Check if connected signal has undefined value (making parameter optional for index routes)
        if (
          connection &&
          connection.signal &&
          connection.signal.value === undefined &&
          !hasDefault
        ) {
          isOptional = true;
        }
      }

      return {
        type: "param",
        name: paramName,
        optional: isOptional,
        index,
      };
    }
    // Literal segment
    return {
      type: "literal",
      value: seg,
      index,
    };
  });

  return {
    original: pattern,
    segments,
    queryParams, // Add query parameters to the parsed pattern
    trailingSlash,
    wildcard,
  };
};

/**
 * Check if a literal segment can be treated as optional based on pattern hierarchy
 */
const checkIfLiteralCanBeOptionalWithPatternObj = (
  literalValue,
  patternObj,
) => {
  if (!patternObj) {
    return false; // No pattern object available, cannot determine optionality
  }

  // Check current pattern's connections
  for (const connection of patternObj.connections) {
    if (connection.isDefaultValue(literalValue)) {
      return true;
    }
  }

  // Check parent pattern's connections
  let currentParent = patternObj.parent;
  while (currentParent) {
    for (const connection of currentParent.connections) {
      if (connection.isDefaultValue(literalValue)) {
        return true;
      }
    }
    currentParent = currentParent.parent;
  }

  // Check children pattern's connections
  const checkChildrenRecursively = (pattern) => {
    for (const child of pattern.children || []) {
      for (const connection of child.connections) {
        if (connection.isDefaultValue(literalValue)) {
          return true;
        }
      }
      if (checkChildrenRecursively(child)) {
        return true;
      }
    }
    return false;
  };

  return checkChildrenRecursively(patternObj);
};

/**
 * Match a URL against a parsed pattern
 */
const matchUrl = (
  parsedPattern,
  url,
  { baseUrl, connectionMap, patternObj = null },
) => {
  // Parse the URL
  const urlObj = new URL(url, baseUrl);
  let pathname = urlObj.pathname;
  const originalPathname = pathname; // Store original pathname before baseUrl processing

  // If baseUrl is provided, calculate the pathname relative to the baseUrl's directory
  if (baseUrl) {
    const baseUrlObj = new URL(baseUrl);
    // if the base url is a file, we want to be relative to the directory containing that file
    const baseDir = baseUrlObj.pathname.endsWith("/")
      ? baseUrlObj.pathname
      : baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf("/"));
    if (pathname.startsWith(baseDir)) {
      pathname = pathname.slice(baseDir.length);
    }
  }

  // Handle root route - only matches empty path or just "/"
  // OR when URL exactly matches baseUrl (treating baseUrl as root)
  if (parsedPattern.segments.length === 0) {
    if (pathname === "/" || pathname === "") {
      return extractSearchParams(urlObj, connectionMap);
    }

    // Special case: if URL exactly matches baseUrl, treat as root route
    if (baseUrl) {
      const baseUrlObj = new URL(baseUrl);
      if (originalPathname === baseUrlObj.pathname) {
        return extractSearchParams(urlObj, connectionMap);
      }
    }

    return null;
  }

  // Remove leading slash and split into segments
  let urlSegments = pathname.startsWith("/")
    ? pathname
        .slice(1)
        .split("/")
        .filter((s) => s !== "")
    : pathname.split("/").filter((s) => s !== "");

  // Handle trailing slash flexibility: if pattern has trailing slash but URL doesn't (or vice versa)
  // and we're at the end of segments, allow the match
  const urlHasTrailingSlash = pathname.endsWith("/") && pathname !== "/";
  const patternHasTrailingSlash = parsedPattern.trailingSlash;

  const params = {};
  let urlSegmentIndex = 0;

  // Process each pattern segment
  for (let i = 0; i < parsedPattern.segments.length; i++) {
    const patternSeg = parsedPattern.segments[i];

    if (patternSeg.type === "literal") {
      // Check if URL has this segment
      if (urlSegmentIndex >= urlSegments.length) {
        // URL is too short for this literal segment
        // Check if this literal segment can be treated as optional based on pattern hierarchy
        const canBeOptional = checkIfLiteralCanBeOptionalWithPatternObj(
          patternSeg.value,
          patternObj,
        );
        if (canBeOptional) {
          // Skip this literal segment, don't increment urlSegmentIndex
          continue;
        }
        return null; // URL too short and literal is not optional
      }

      const urlSeg = urlSegments[urlSegmentIndex];
      if (urlSeg !== patternSeg.value) {
        // Literal mismatch - this route doesn't match this URL
        return null;
      }
      urlSegmentIndex++;
    } else if (patternSeg.type === "param") {
      // Parameter segment
      if (urlSegmentIndex >= urlSegments.length) {
        // No URL segment for this parameter
        if (patternSeg.optional) {
          // Optional parameter - don't add default here, let resolveParams handle it
          continue;
        }
        // Required parameter missing - but check if we can use trailing slash logic
        // If this is the last segment and we have a trailing slash difference, it might still match
        const isLastSegment = i === parsedPattern.segments.length - 1;
        if (isLastSegment && patternHasTrailingSlash && !urlHasTrailingSlash) {
          // Pattern expects trailing slash segment, URL doesn't have it - allow missing optional param
          continue;
        }
        return null; // Required parameter missing
      }

      // Capture URL segment as parameter value
      const urlSeg = urlSegments[urlSegmentIndex];
      params[patternSeg.name] = decodeURIComponent(urlSeg);
      urlSegmentIndex++;
    }
  }

  // Check for remaining URL segments
  // Patterns with trailing slashes can match additional URL segments (like wildcards)
  // Patterns without trailing slashes should match exactly (unless they're wildcards)
  // BUT: if pattern has children, it can also match additional segments (hierarchical matching)
  const hasChildren = patternObj && patternObj.children.length > 0;
  if (
    !parsedPattern.wildcard &&
    !parsedPattern.trailingSlash &&
    !hasChildren &&
    urlSegmentIndex < urlSegments.length
  ) {
    return null; // Pattern without trailing slash/wildcard/children should not match extra segments
  }
  // If pattern has trailing slash, wildcard, or children, allow extra segments

  // Add search parameters
  const searchParams = extractSearchParams(urlObj, connectionMap);
  Object.assign(params, searchParams);

  // Don't add defaults here - rawParams should only contain what's in the URL
  // Defaults are handled by resolveParams() to create the final merged parameters

  return params;
};

/**
 * Extract search parameters from URL
 */
const extractSearchParams = (urlObj, connectionMap) => {
  const params = {};

  // Parse the raw query string manually instead of using urlObj.searchParams
  // This is necessary for array parameters to handle encoded commas correctly.
  // urlObj.searchParams automatically decodes %2C to , which breaks our comma-based array splitting.
  //
  // Design choice: We use comma-separated values (colors=red,blue,green) instead of
  // the standard repeated parameters (colors=red&colors=blue&colors=green) because:
  // 1. More human-readable URLs
  // 2. Shorter URL length
  // 3. Easier to copy/paste and manually edit
  if (!urlObj.search) {
    return params;
  }

  const rawQuery = urlObj.search.slice(1); // Remove leading ?
  const pairs = rawQuery.split("&");

  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");
    let key;
    let rawValue;

    if (eqIndex > -1) {
      key = decodeURIComponent(pair.slice(0, eqIndex));
      rawValue = pair.slice(eqIndex + 1); // Keep raw for array processing
    } else {
      key = decodeURIComponent(pair);
      rawValue = "";
    }

    const connection = connectionMap.get(key);
    const signalType = connection ? connection.type : null;

    // Cast value based on signal type
    if (signalType === "array") {
      // Handle array query parameters with proper comma encoding:
      // ?colors=red,blue,green → ["red", "blue", "green"]
      // ?colors=red,blue%2Cgreen → ["red", "blue,green"] (comma in value)
      // ?colors= → []
      // ?colors → []
      if (rawValue === "") {
        params[key] = [];
      } else {
        params[key] = rawValue
          .split(",")
          .map((item) => decodeURIComponent(item))
          .filter((item) => item.trim() !== "");
      }
    } else if (signalType === "number" || signalType === "float") {
      const decodedValue = decodeURIComponent(rawValue);
      const numberValue = Number(decodedValue);
      params[key] = isNaN(numberValue) ? decodedValue : numberValue;
    } else if (signalType === "boolean") {
      const decodedValue = decodeURIComponent(rawValue);
      // Handle boolean query parameters:
      // ?walk=true → true
      // ?walk=1 → true
      // ?walk → true (parameter present without value)
      // ?walk=false → false
      // ?walk=0 → false
      params[key] =
        decodedValue === "true" || decodedValue === "1" || decodedValue === "";
    } else {
      params[key] = decodeURIComponent(rawValue);
    }
  }

  return params;
};

/**
 * Build query parameters respecting hierarchical order from ancestor patterns
 */
/**
 * Build hierarchical query parameters from pattern hierarchy
 *
 * IMPORTANT: This function implements parameter inheritance - child routes inherit
 * query parameters from their ancestor routes. This is intentional behavior that
 * allows child routes to preserve context from parent routes.
 *
 * For example:
 * - Parent route: /map/?lon=123
 * - Child route: /map/isochrone?iso_lon=456
 * - Final URL: /map/isochrone?lon=123&iso_lon=456
 *
 * The child route inherits 'lon' from its parent, maintaining navigation context.
 * Only parameters that match their defaults (static or dynamic) are omitted.
 */
const buildHierarchicalQueryParams = (
  parsedPattern,
  params,
  originalPattern,
  patternObj,
) => {
  const queryParams = {};
  const processedParams = new Set();

  // Get pattern data for this pattern - use direct pattern object or null
  const patternData = patternObj;

  // Collect all ancestors by traversing parent chain - only if we have pattern data
  const ancestorPatterns = [];
  if (patternData) {
    let currentParent = patternData.parent;
    while (currentParent) {
      ancestorPatterns.unshift(currentParent); // Add to front for correct order
      // Move to next parent in the chain
      currentParent = currentParent.parent;
    }
  }

  // DEBUG: Log what we found
  if (DEBUG$2) {
    // Force debug for now
    console.debug(`Building params for ${originalPattern}`);
    console.debug(`parsedPattern:`, parsedPattern.original);
    console.debug(`params:`, params);
    console.debug(
      `ancestorPatterns:`,
      ancestorPatterns.map((p) => p.urlPatternRaw),
    );
  }

  // Step 1: Add query parameters from ancestor patterns (oldest to newest)
  // This ensures ancestor parameters come first in their declaration order
  // ancestorPatterns is in correct order: root ancestor first, then immediate parent

  for (const ancestorPatternObj of ancestorPatterns) {
    if (ancestorPatternObj.parsedPattern?.queryParams) {
      for (const queryParam of ancestorPatternObj.parsedPattern.queryParams) {
        const paramName = queryParam.name;
        if (
          params[paramName] !== undefined &&
          !processedParams.has(paramName)
        ) {
          queryParams[paramName] = params[paramName];
          processedParams.add(paramName);

          if (DEBUG$2) {
            console.debug(
              `Added ancestor param: ${paramName}=${params[paramName]}`,
            );
          }
        }
      }
    }
  }

  // Step 2: Add query parameters from current pattern
  if (parsedPattern.queryParams) {
    if (DEBUG$2) {
      console.debug(
        `Processing current pattern query params:`,
        parsedPattern.queryParams.map((q) => q.name),
      );
    }

    for (const queryParam of parsedPattern.queryParams) {
      const paramName = queryParam.name;
      if (params[paramName] !== undefined && !processedParams.has(paramName)) {
        queryParams[paramName] = params[paramName];
        processedParams.add(paramName);

        if (DEBUG$2) {
          console.debug(
            `Added current param: ${paramName}=${params[paramName]}`,
          );
        }
      }
    }
  }

  // Step 3: Add remaining parameters (extra params) alphabetically
  const extraParams = [];

  // Get all path parameter names to exclude them
  const pathParamNames = new Set(
    parsedPattern.segments.filter((s) => s.type === "param").map((s) => s.name),
  );

  for (const [key, value] of Object.entries(params)) {
    if (
      !pathParamNames.has(key) &&
      !processedParams.has(key) &&
      value !== undefined
    ) {
      extraParams.push([key, value]);
    }
  }

  // Sort extra params alphabetically for consistent order
  extraParams.sort(([a], [b]) => a.localeCompare(b));

  // Add sorted extra params
  for (const [key, value] of extraParams) {
    queryParams[key] = value;
  }

  return queryParams;
};

/**
 * Build a URL from a pattern and parameters
 */
const buildUrlFromPattern = (
  parsedPattern,
  params = {},
  originalPattern = null,
  patternObj = null,
) => {
  if (parsedPattern.segments.length === 0) {
    // Root route
    const queryParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        queryParams[key] = value;
      }
    }
    const search = buildQueryString(queryParams);
    return `/${search ? `?${search}` : ""}`;
  }

  const segments = [];

  for (const patternSeg of parsedPattern.segments) {
    if (patternSeg.type === "literal") {
      segments.push(patternSeg.value);
    } else if (patternSeg.type === "param") {
      const value = params[patternSeg.name];

      // If value is provided, include it
      if (value !== undefined) {
        segments.push(encodeParamValue(value, false)); // Named parameters encode slashes
      } else if (!patternSeg.optional) {
        // For required parameters without values, keep the placeholder
        segments.push(`:${patternSeg.name}`);
      }
      // Optional parameters with undefined values are omitted
    }
  }

  let path = `/${segments.join("/")}`;

  // Handle trailing slash - only add if it serves a purpose
  if (parsedPattern.trailingSlash && !path.endsWith("/") && path !== "/") {
    // Only add trailing slash if the original pattern suggests there could be more content
    // For patterns like "/admin/:section/" where the slash is at the very end,
    // it's not needed in the generated URL if there are no more segments
    const lastSegment =
      parsedPattern.segments[parsedPattern.segments.length - 1];
    const hasMorePotentialContent =
      parsedPattern.wildcard || (lastSegment && lastSegment.type === "literal"); // Only add slash after literals, not parameters

    if (hasMorePotentialContent) {
      path += "/";
    }
  } else if (
    !parsedPattern.trailingSlash &&
    path.endsWith("/") &&
    path !== "/"
  ) {
    // Remove trailing slash for patterns without trailing slash
    path = path.slice(0, -1);
  }

  // Check if we'll have query parameters to decide on trailing slash removal
  const willHaveQueryParams =
    parsedPattern.queryParams?.some((qp) => {
      const value = params[qp.name];
      return value !== undefined;
    }) ||
    Object.entries(params).some(([key, value]) => {
      const isPathParam = parsedPattern.segments.some(
        (s) => s.type === "param" && s.name === key,
      );
      const isQueryParam = parsedPattern.queryParams?.some(
        (qp) => qp.name === key,
      );
      return value !== undefined && !isPathParam && !isQueryParam;
    });

  // Remove trailing slash when we have query params for prettier URLs
  if (willHaveQueryParams && path.endsWith("/") && path !== "/") {
    path = path.slice(0, -1);
  }

  // Always remove trailing slash from simple paths (unless root) for cleaner URLs
  if (path.endsWith("/") && path !== "/" && !willHaveQueryParams) {
    path = path.slice(0, -1);
  }

  // Build query parameters respecting hierarchical order
  const queryParams = buildHierarchicalQueryParams(
    parsedPattern,
    params,
    originalPattern,
    patternObj,
  );

  const search = buildQueryString(queryParams);

  // No longer handle trailing slash inheritance here

  return path + (search ? `?${search}` : "");
};

/**
 * Check if childPattern is a child route of parentPattern
 * This determines parent-child relationships for signal clearing behavior.
 *
 * Route families vs parent-child relationships:
 * - Different families: preserve signals (e.g., "/" and "/settings")
 * - Parent-child: clear signals when navigating to parent (e.g., "/settings" and "/settings/:tab")
 *
 * E.g., "/admin/settings/:tab" is a child of "/admin/:section/"
 * Also, "/admin/?tab=something" is a child of "/admin/"
 */
const isChildPattern = (childPattern, parentPattern) => {
  if (!childPattern || !parentPattern) {
    return false;
  }

  // Split path and query parts
  const [childPath, childQuery] = childPattern.split("?");
  const [parentPath, parentQuery] = parentPattern.split("?");

  // Remove trailing slashes for path comparison
  const cleanChild = childPath.replace(/\/$/, "");
  const cleanParent = parentPath.replace(/\/$/, "");

  // CASE 1: Same path, child has query params, parent doesn't
  // E.g., "/admin/?tab=something" is child of "/admin/"
  if (cleanChild === cleanParent && childQuery && !parentQuery) {
    return true;
  }

  // CASE 2: Traditional path-based child relationship
  const childSegments = cleanChild.split("/").filter((s) => s);
  const parentSegments = cleanParent.split("/").filter((s) => s);

  // Root route special handling - different families for signal preservation
  if (parentSegments.length === 0) {
    // Parent is root route ("/")
    // Root can only be parent of parameterized routes like "/:section"
    // But NOT literal routes like "/settings" (different families)
    return childSegments.length === 1 && childSegments[0].startsWith(":");
  }

  // For non-root parents, child must have at least as many segments
  if (childSegments.length < parentSegments.length) {
    return false;
  }

  let hasMoreSpecificSegment = false;

  // Check if all parent segments match child segments (allowing for parameters)
  for (let i = 0; i < parentSegments.length; i++) {
    const parentSeg = parentSegments[i];
    const childSeg = childSegments[i];

    if (parentSeg.startsWith(":")) {
      // Parent has parameter - child can have any value in that position
      // Child is more specific if it has a literal value for a parent parameter
      if (!childSeg.startsWith(":")) {
        hasMoreSpecificSegment = true;
      }
      continue;
    }

    // Parent has literal - child must match exactly
    if (parentSeg !== childSeg) {
      return false;
    }
  }

  // Child must be more specific (more segments OR more specific segments)
  return childSegments.length > parentSegments.length || hasMoreSpecificSegment;
};

/**
 * Check if a parameter is redundant because the child pattern already has it as a literal segment
 * E.g., parameter "section" is redundant for pattern "/admin/settings/:tab" because "settings" is literal
 */
const isParameterRedundantWithLiteralSegments = (
  childPattern,
  parentPattern,
  paramName,
) => {
  // Find which segment position corresponds to this parameter in the parent
  let paramSegmentIndex = -1;
  for (let i = 0; i < parentPattern.segments.length; i++) {
    const segment = parentPattern.segments[i];
    if (segment.type === "param" && segment.name === paramName) {
      paramSegmentIndex = i;
      break;
    }
  }

  // If parameter not found in parent segments, it's not redundant with path
  if (paramSegmentIndex === -1) {
    return false;
  }

  // Check if child has a literal segment at the same position
  if (childPattern.segments.length > paramSegmentIndex) {
    const childSegment = childPattern.segments[paramSegmentIndex];
    if (childSegment.type === "literal") {
      // Child has a literal segment where parent has parameter
      // This means the child is more specific and shouldn't inherit this parameter
      return true; // Redundant - child already specifies this position with a literal
    }
  }

  return false;
};

/**
 * Register all patterns at once and build their relationships
 */
const setupPatterns = (patternDefinitions) => {
  // Create local pattern registry as Set
  const patternRegistry = new Set(); // Set of pattern objects
  const patternsByKey = {}; // key -> pattern object

  // Phase 1: Create all pattern objects
  for (const [key, urlPatternRaw] of Object.entries(patternDefinitions)) {
    // Create the unified pattern object
    const pattern = createRoutePattern(urlPatternRaw);

    // Register in both collections
    patternRegistry.add(pattern);
    patternsByKey[key] = pattern;
  }

  // Phase 2: Build relationships between all patterns
  const allPatterns = Array.from(patternRegistry); // Convert Set to Array

  for (const currentPatternObj of allPatterns) {
    for (const otherPatternObj of allPatterns) {
      if (currentPatternObj === otherPatternObj) continue;

      // Check if current pattern is a child of other pattern using clean patterns
      if (
        currentPatternObj.cleanPattern &&
        otherPatternObj.cleanPattern &&
        isChildPattern(
          currentPatternObj.cleanPattern,
          otherPatternObj.cleanPattern,
        )
      ) {
        // Store the most specific parent (closest parent in hierarchy)
        const getPathSegmentCount = (pattern) => {
          // Only count path segments, not query parameters
          const pathPart = pattern.split("?")[0];
          return pathPart.split("/").filter(Boolean).length;
        };

        const currentSegmentCount = currentPatternObj.parent
          ? getPathSegmentCount(currentPatternObj.parent.originalPattern)
          : 0;
        const otherSegmentCount = getPathSegmentCount(
          otherPatternObj.originalPattern,
        );

        if (
          !currentPatternObj.parent ||
          otherSegmentCount > currentSegmentCount
        ) {
          currentPatternObj.parent = otherPatternObj;
        }
        otherPatternObj.children = otherPatternObj.children || [];
        otherPatternObj.children.push(currentPatternObj);
      }
    }
  }

  // Phase 3: Collect all relevant signals for each pattern based on relationships
  for (const currentPatternObj of patternRegistry) {
    const allRelevantSignals = new Set();

    // Add own signals
    for (const signal of currentPatternObj.signalSet) {
      allRelevantSignals.add(signal);
    }

    // Add signals from ancestors (they might be inherited)
    let parentPatternObj = currentPatternObj.parent;
    while (parentPatternObj) {
      for (const connection of parentPatternObj.connections) {
        allRelevantSignals.add(connection.signal);
      }
      // Move up the parent chain
      parentPatternObj = parentPatternObj.parent;
    }

    // Add signals from descendants (they might be used for optimization)
    const addDescendantSignals = (patternObj) => {
      for (const childPatternObj of patternObj.children || []) {
        // Add child's own signals
        for (const connection of childPatternObj.connections) {
          allRelevantSignals.add(connection.signal);
        }
        // Recursively add grandchildren signals
        addDescendantSignals(childPatternObj);
      }
    };
    addDescendantSignals(currentPatternObj);

    // Update the pattern's signalSet with all relevant signals
    currentPatternObj.signalSet = allRelevantSignals;

    if (DEBUG$2 && allRelevantSignals.size > 0) {
      console.debug(
        `[${currentPatternObj.urlPatternRaw}] Collected ${allRelevantSignals.size} relevant signals`,
      );
    }
  }

  // Phase 4: Calculate depths for all patterns
  const calculatePatternDepth = (patternObj) => {
    if (patternObj.depth !== 0) return patternObj.depth; // Already calculated

    if (!patternObj.parent) {
      patternObj.depth = 0;
      return 0;
    }

    const parentDepth = calculatePatternDepth(patternObj.parent);
    patternObj.depth = parentDepth + 1;
    return patternObj.depth;
  };

  for (const patternObj of patternRegistry) {
    calculatePatternDepth(patternObj);
  }

  if (DEBUG$2) {
    console.debug("Pattern registry updated");
  }

  return patternsByKey;
};

const resolveRouteUrl = (relativeUrl) => {
  if (relativeUrl[0] === "/") {
    // we remove the leading slash because we want to resolve against baseUrl which may
    // not be the root url
    relativeUrl = relativeUrl.slice(1);
  }

  // we don't use URL constructor on PURPOSE (in case the relativeUrl contains invalid url chars)
  // and we want to support use cases where people WANT to produce invalid urls (for example rawUrlPart with spaces)
  // because these urls will be handled by non standard clients (like a backend service allowing url like stuff)
  if (baseUrl.endsWith("/")) {
    return `${baseUrl}${relativeUrl}`;
  }
  return `${baseUrl}/${relativeUrl}`;
};

/**
 * Route management with pattern-first architecture
 * Routes work with relative URLs, patterns handle base URL resolution
 */


/**
 * Set up all application routes with reactive state management.
 *
 * Creates route objects that automatically sync with the current URL and provide
 * reactive signals for building dynamic UIs. Each route tracks its matching state,
 * extracted parameters, and computed URLs.
 *
 * @example
 * ```js
 * import { setupRoutes, stateSignal } from "@jsenv/navi";
 *
 * const settingsTabSignal = stateSignal('general', { type: "string", oneOf: ['general', 'overview'] });
 *
 * let { USER_PROFILE } = setupRoutes({
 *   HOME: "/",
 *   SETTINGS: "/settings/:tab=${settingsTabSignal}/",
 * });
 *
 * USER_PROFILE.matching // boolean
 * USER_PROFILE.matchingSignal.value // reactive signal
 * settingsTabSignal.value = 'overview'; // updates URL automatically
 * ```
 *
 * ⚠️ HOT RELOAD: Use 'let' instead of 'const' when destructuring:
 * ```js
 * // ❌ const { HOME, USER_PROFILE } = setupRoutes({...})
 * // ✅ let { HOME, USER_PROFILE } = setupRoutes({...})
 * ```
 *
 * @param {Object} routeDefinition - Object mapping route names to URL patterns
 * @param {string} routeDefinition[key] - URL pattern with optional parameters
 * @returns {Object} Object with route names as keys and route objects as values
 * @returns {Object.<string, {
 *   pattern: string,
 *   matching: boolean,
 *   params: Object,
 *   url: string,
 *   relativeUrl: string,
 *   matchingSignal: import("@preact/signals").Signal<boolean>,
 *   paramsSignal: import("@preact/signals").Signal<Object>,
 *   urlSignal: import("@preact/signals").Signal<string>,
 *   navTo: (params?: Object) => Promise<void>,
 *   redirectTo: (params?: Object) => Promise<void>,
 *   replaceParams: (params: Object) => Promise<void>,
 *   buildUrl: (params?: Object) => string,
 *   buildRelativeUrl: (params?: Object) => string,
 * }>} Route objects with reactive state and navigation methods
 *
 * All routes MUST be created at once because any url can be accessed
 * at any given time (url can be shared, reloaded, etc..)
 */

const setupRoutes = (routeDefinition) => {
  // Prevent calling setupRoutes when routes already exist - enforce clean setup
  if (routeSet.size > 0) {
    throw new Error(
      "Routes already exist. Call clearAllRoutes() first to clean up existing routes before creating new ones. This prevents cross-test pollution and ensures clean state.",
    );
  }
  // PHASE 1: Setup patterns with unified objects (includes all relationships and signal connections)
  const routePatterns = setupPatterns(routeDefinition);

  // PHASE 2: Create routes using the unified pattern objects
  const routes = {};
  for (const key of Object.keys(routeDefinition)) {
    const routePattern = routePatterns[key];
    const route = registerRoute(routePattern);
    routes[key] = route;
  }
  onRouteDefined();

  return routes;
};

const useRouteStatus = (route) => {
  const { urlSignal, matchingSignal, paramsSignal, visitedSignal } = route;
  const url = urlSignal.value;
  const matching = matchingSignal.value;
  const params = paramsSignal.value;
  const visited = visitedSignal.value;

  return {
    url,
    matching,
    params,
    visited,
  };
};

// for unit tests
const clearAllRoutes = () => {
  for (const [, routePrivateProperties] of routePrivatePropertiesMap) {
    routePrivateProperties.cleanup();
  }
  routeSet.clear();
  routePrivatePropertiesMap.clear();
  // Pattern registry is now local to setupPatterns, no global cleanup needed
  // Don't clear signal registry here - let tests manage it explicitly
  // This prevents clearing signals that are still being used across multiple route registrations
};

// Flag to prevent signal-to-URL synchronization during URL-to-signal synchronization
let isUpdatingRoutesFromUrl = false;

// Controls what happens to actions when their route stops matching:
// 'abort' - Cancel the action immediately when route stops matching
// 'keep-loading' - Allow action to continue running after route stops matching
//
// The 'keep-loading' strategy could act like preloading, keeping data ready for potential return.
// However, since route reactivation triggers action reload anyway, the old data won't be used
// so it's better to abort the action to avoid unnecessary resource usage.
const ROUTE_DEACTIVATION_STRATEGY = "abort"; // 'abort', 'keep-loading'
const ROUTE_NOT_MATCHING_PARAMS = {};

const routeSet = new Set();
const routePrivatePropertiesMap = new Map();
const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesMap.get(route);
};
// Store previous route states to detect changes
const routePreviousStateMap = new WeakMap();
// Store abort controllers per action to control their lifecycle based on route state
const actionAbortControllerWeakMap = new WeakMap();

/**
 * Get the isDefaultValue function for a signal from the registry
 * @param {import("@preact/signals").Signal} signal
 * @returns {Function}
 */
const updateRoutes = (
  url,
  {
    navigationType = "push",
    isVisited = () => false,
    // state
  } = {},
) => {
  const routeMatchInfoSet = new Set();
  for (const route of routeSet) {
    const routePrivateProperties = getRoutePrivateProperties(route);
    const { routePattern } = routePrivateProperties;

    // Get previous state
    const previousState = routePreviousStateMap.get(route) || {
      matching: false,
      params: ROUTE_NOT_MATCHING_PARAMS,
    };
    const oldMatching = previousState.matching;
    const oldParams = previousState.params;

    // Use custom pattern matching - much simpler than URLPattern approach
    let extractedParams = routePattern.applyOn(url);
    let newMatching = Boolean(extractedParams);

    let newParams;

    if (extractedParams) {
      // No need for complex wildcard correction - custom system handles it properly
      if (compareTwoJsValues(oldParams, extractedParams)) {
        // No change in parameters, keep the old params
        newParams = oldParams;
      } else {
        newParams = extractedParams;
      }
    } else {
      newParams = ROUTE_NOT_MATCHING_PARAMS;
    }

    const routeMatchInfo = {
      route,
      routePrivateProperties,
      oldMatching,
      newMatching,
      oldParams,
      newParams,
    };
    routeMatchInfoSet.add(routeMatchInfo);
    // Store current state for next comparison
    routePreviousStateMap.set(route, {
      matching: newMatching,
      params: newParams,
    });
  }

  // Apply all signal updates in a batch
  const matchingRouteSet = new Set();
  batch(() => {
    for (const {
      route,
      routePrivateProperties,
      newMatching,
      newParams,
    } of routeMatchInfoSet) {
      const { updateStatus } = routePrivateProperties;
      const visited = isVisited(route.url);
      updateStatus({
        matching: newMatching,
        params: newParams,
        visited,
      });
      if (newMatching) {
        matchingRouteSet.add(route);
      }
    }

    // URL -> Signal synchronization (moved from individual route effects to eliminate circular dependency)
    // Prevent signal-to-URL synchronization during URL-to-signal synchronization
    isUpdatingRoutesFromUrl = true;

    for (const {
      route,
      routePrivateProperties,
      newMatching,
    } of routeMatchInfoSet) {
      const { routePattern } = routePrivateProperties;
      const { connectionMap } = routePattern;

      for (const [paramName, connection] of connectionMap) {
        const { signal: paramSignal, debug } = connection;
        const rawParams = route.rawParamsSignal.value;
        const urlParamValue = rawParams[paramName];

        if (!newMatching) {
          // Route doesn't match - check if any matching route extracts this parameter
          let parameterExtractedByMatchingRoute = false;
          let matchingRouteInSameFamily = false;

          for (const otherRoute of routeSet) {
            if (otherRoute === route || !otherRoute.matching) {
              continue;
            }
            const otherRawParams = otherRoute.rawParamsSignal.value;
            const otherRoutePrivateProperties =
              getRoutePrivateProperties(otherRoute);

            // Check if this matching route extracts the parameter
            if (paramName in otherRawParams) {
              parameterExtractedByMatchingRoute = true;
            }

            // Check if this matching route is in the same family using parent-child relationships
            const thisPatternObj = routePattern;
            const otherPatternObj = otherRoutePrivateProperties.routePattern;

            // Routes are in same family if they share a hierarchical relationship:
            // 1. One is parent/ancestor of the other
            // 2. They share a common parent/ancestor
            let inSameFamily = false;

            // Check if other route is ancestor of this route
            let currentParent = thisPatternObj.parent;
            while (currentParent) {
              if (currentParent === otherPatternObj) {
                inSameFamily = true;
                break;
              }
              currentParent = currentParent.parent;
            }

            // Check if this route is ancestor of other route
            if (!inSameFamily) {
              currentParent = otherPatternObj.parent;
              while (currentParent) {
                if (currentParent === thisPatternObj) {
                  inSameFamily = true;
                  break;
                }
                currentParent = currentParent.parent;
              }
            }

            // Check if they share a common parent (siblings or cousins)
            if (!inSameFamily) {
              const thisAncestors = new Set();
              currentParent = thisPatternObj.parent;
              while (currentParent) {
                thisAncestors.add(currentParent);
                currentParent = currentParent.parent;
              }

              currentParent = otherPatternObj.parent;
              while (currentParent) {
                if (thisAncestors.has(currentParent)) {
                  inSameFamily = true;
                  break;
                }
                currentParent = currentParent.parent;
              }
            }

            if (inSameFamily) {
              matchingRouteInSameFamily = true;
            }
          }

          // Only reset signal if:
          // 1. We're navigating within the same route family (not to completely unrelated routes)
          // 2. AND no matching route extracts this parameter from URL
          // 3. AND parameter has no default value (making it truly optional)
          if (matchingRouteInSameFamily && !parameterExtractedByMatchingRoute) {
            const defaultValue = connection.getDefaultValue();
            if (defaultValue === undefined) {
              // Parameter is not extracted within same family and has no default - reset it
              if (debug) {
                console.debug(
                  `[route] Same family navigation, ${paramName} not extracted and has no default: resetting signal`,
                );
              }
              paramSignal.value = undefined;
            } else if (debug) {
              // Parameter has a default value - preserve current signal value
              console.debug(
                `[route] Parameter ${paramName} has default value ${defaultValue}: preserving signal value: ${paramSignal.value}`,
              );
            }
          } else if (debug) {
            if (!matchingRouteInSameFamily) {
              console.debug(
                `[route] Different route family: preserving ${paramName} signal value: ${paramSignal.value}`,
              );
            } else {
              console.debug(
                `[route] Parameter ${paramName} extracted by matching route: preserving signal value: ${paramSignal.value}`,
              );
            }
          }
          continue;
        }

        // URL -> Signal sync: When route matches, ensure signal matches URL state
        // URL is the source of truth for explicit parameters
        const value = paramSignal.peek();
        if (urlParamValue === undefined) {
          // No URL parameter - reset signal to its current default value
          // (handles both static fallback and dynamic default cases)
          const defaultValue = connection.getDefaultValue();
          if (connection.isDefaultValue(value)) {
            // Signal already has correct default value, no sync needed
            continue;
          }
          if (debug) {
            console.debug(
              `[route] URL->Signal: ${paramName} not in URL, reset signal to default (${defaultValue})`,
            );
          }
          paramSignal.value = defaultValue;
          continue;
        }
        if (urlParamValue === value) {
          // Values already match, no sync needed
          continue;
        }
        if (debug) {
          console.debug(
            `[route] URL->Signal: ${paramName}=${urlParamValue} in url, sync signal with url`,
          );
        }
        paramSignal.value = urlParamValue;
        continue;
      }
    }
  });

  // Reset flag after URL -> Signal synchronization is complete
  isUpdatingRoutesFromUrl = false;

  // must be after paramsSignal.value update to ensure the proxy target is set
  // (so after the batch call)
  const toLoadSet = new Set();
  const toReloadSet = new Set();
  const abortSignalMap = new Map();
  const routeLoadRequestedMap = new Map();

  const shouldLoadOrReload = (route, shouldLoad) => {
    const routeAction = route.action;
    const currentAction = routeAction.getCurrentAction();
    if (shouldLoad) {
      if (
        navigationType === "replace" ||
        currentAction.aborted ||
        currentAction.error
      ) {
        shouldLoad = false;
      }
    }
    if (shouldLoad) {
      toLoadSet.add(currentAction);
    } else {
      toReloadSet.add(currentAction);
    }
    routeLoadRequestedMap.set(route, currentAction);
    // Create a new abort controller for this action
    const actionAbortController = new AbortController();
    actionAbortControllerWeakMap.set(currentAction, actionAbortController);
    abortSignalMap.set(currentAction, actionAbortController.signal);
  };

  const shouldLoad = (route) => {
    shouldLoadOrReload(route, true);
  };
  const shouldReload = (route) => {
    shouldLoadOrReload(route, false);
  };
  const shouldAbort = (route) => {
    const routeAction = route.action;
    const currentAction = routeAction.getCurrentAction();
    const actionAbortController =
      actionAbortControllerWeakMap.get(currentAction);
    if (actionAbortController) {
      actionAbortController.abort(`route no longer matching`);
      actionAbortControllerWeakMap.delete(currentAction);
    }
  };

  for (const {
    route,
    routePrivateProperties,
    newMatching,
    oldMatching,
    newParams,
    oldParams,
  } of routeMatchInfoSet) {
    const routeAction = route.action;
    if (!routeAction) {
      continue;
    }

    const becomesMatching = newMatching && !oldMatching;
    const becomesNotMatching = !newMatching && oldMatching;
    const paramsChangedWhileMatching =
      newMatching && oldMatching && newParams !== oldParams;

    // Handle actions for routes that become matching
    if (becomesMatching) {
      shouldLoad(route);
      continue;
    }

    // Handle actions for routes that become not matching - abort them
    if (becomesNotMatching && ROUTE_DEACTIVATION_STRATEGY === "abort") {
      shouldAbort(route);
      continue;
    }

    // Handle parameter changes while route stays matching
    if (paramsChangedWhileMatching) {
      shouldReload(route);
    }
  }

  return {
    loadSet: toLoadSet,
    reloadSet: toReloadSet,
    abortSignalMap,
    routeLoadRequestedMap,
    matchingRouteSet,
  };
};

const registerRoute = (routePattern) => {
  const urlPatternRaw = routePattern.originalPattern;
  const { cleanPattern, connectionMap } = routePattern;
  const [publishStatus, subscribeStatus] = createPubSub();

  // prepare route object
  const route = {
    urlPattern: cleanPattern,
    pattern: cleanPattern,
    isRoute: true,
    matching: false,
    params: ROUTE_NOT_MATCHING_PARAMS,
    buildUrl: null,
    bindAction: null,
    relativeUrl: null,
    url: null,
    action: null,
    matchingSignal: null,
    paramsSignal: null,
    urlSignal: null,
    replaceParams: undefined,
    subscribeStatus,
    toString: () => {
      return `route "${cleanPattern}"`;
    },
  };
  routeSet.add(route);
  const routePrivateProperties = {
    routePattern,
    originalPattern: urlPatternRaw,
    pattern: cleanPattern,
    updateStatus: null,
    cleanup: null,
  };
  routePrivatePropertiesMap.set(route, routePrivateProperties);
  const cleanupCallbackSet = new Set();
  routePrivateProperties.cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };
  routePrivateProperties.updateStatus = ({ matching, params, visited }) => {
    let someChange = false;
    route.matchingSignal.value = matching;

    if (route.matching !== matching) {
      route.matching = matching;
      someChange = true;
    }
    route.visitedSignal.value = visited;
    if (route.visited !== visited) {
      route.visited = visited;
      someChange = true;
    }
    // Store raw params (from URL) - paramsSignal will reactively compute merged params
    route.rawParamsSignal.value = params;
    // Get merged params for comparison (computed signal will handle the merging)
    const mergedParams = route.paramsSignal.value;
    if (route.params !== mergedParams) {
      route.params = mergedParams;
      someChange = true;
    }
    if (someChange) {
      publishStatus({
        matching,
        params: mergedParams,
        visited,
      });
    }
  };

  // populate route object
  route.matchingSignal = signal(false);
  route.rawParamsSignal = signal(ROUTE_NOT_MATCHING_PARAMS);
  route.paramsSignal = computed(() => {
    const rawParams = route.rawParamsSignal.value;
    const resolvedParams = routePattern.resolveParams(rawParams);
    return resolvedParams;
  });
  route.visitedSignal = signal(false);
  // Keep route.params synchronized with computed paramsSignal
  // This ensures route.params includes parameters from child routes
  effect(() => {
    const computedParams = route.paramsSignal.value;
    if (route.params !== computedParams) {
      route.params = computedParams;
    }
  });
  for (const [paramName, connection] of connectionMap) {
    const { signal: paramSignal, debug } = connection;

    if (debug) {
      console.debug(
        `[route] connecting url param "${paramName}" to signal`,
        paramSignal,
      );
    }
    // Signal -> URL sync: When signal changes, update URL to reflect meaningful state
    // Only sync non-default values to keep URLs clean (static fallbacks stay invisible)
    // eslint-disable-next-line no-loop-func
    effect(() => {
      const value = paramSignal.value;
      const rawParams = route.rawParamsSignal.value;
      const urlParamValue = rawParams[paramName];
      const matching = route.matchingSignal.value;

      // Signal returned to default - clean up URL by removing the parameter
      // Skip cleanup during URL-to-signal synchronization to prevent recursion
      if (isUpdatingRoutesFromUrl) {
        return;
      }

      if (!matching) {
        // Route not matching, no URL sync needed
        return;
      }
      if (urlParamValue === undefined) {
        // No URL parameter exists - check if signal has meaningful value to add
        if (connection.isDefaultValue(value)) {
          // Signal using default value, keep URL clean (no parameter needed)
          return;
        }
        if (debug) {
          console.debug(
            `[route] Signal->URL: ${paramName} adding custom value ${value} to URL (default: ${connection.getDefaultValue()})`,
          );
        }
        route.replaceParams({ [paramName]: value });
        return;
      }

      // URL parameter exists - check if we need to update or clean it up
      if (connection.isDefaultValue(value)) {
        if (debug) {
          console.debug(
            `[route] Signal->URL: ${paramName} cleaning URL (removing default value ${value})`,
          );
        }
        route.replaceParams({ [paramName]: undefined });
        return;
      }

      if (value === urlParamValue) {
        // Values already match, no sync needed
        return;
      }
      if (debug) {
        console.debug(
          `[route] Signal->URL: ${paramName} updating URL ${urlParamValue} -> ${value}`,
        );
      }
      route.replaceParams({ [paramName]: value });
    });
  }
  route.navTo = (params) => {
    if (!integration) {
      return Promise.resolve();
    }
    const routeUrl = route.buildUrl(params);
    return integration.navTo(routeUrl);
  };
  route.redirectTo = (params) => {
    if (!integration) {
      return Promise.resolve();
    }
    return integration.navTo(route.buildUrl(params), {
      replace: true,
    });
  };
  route.replaceParams = (newParams) => {
    const matching = route.matchingSignal.peek();
    if (!matching) {
      console.warn(
        `Cannot replace params on route ${route} because it is not matching the current URL.`,
      );
      return null;
    }

    // Find all matching routes and update their actions, then delegate to most specific
    const allMatchingRoutes = Array.from(routeSet).filter((r) => r.matching);

    // Update action params on all matching routes
    for (const matchingRoute of allMatchingRoutes) {
      if (matchingRoute.action) {
        const matchingRoutePrivateProperties =
          getRoutePrivateProperties(matchingRoute);
        const { routePattern: matchingRoutePattern } =
          matchingRoutePrivateProperties;
        const currentResolvedParams = matchingRoutePattern.resolveParams();
        const updatedActionParams = {
          ...currentResolvedParams,
          ...newParams,
        };
        matchingRoute.action.replaceParams(updatedActionParams);
      }
    }

    // Find the most specific route using pattern depth (deeper = more specific)
    let mostSpecificRoute = route;
    const routePrivateProperties = getRoutePrivateProperties(route);
    let maxDepth = routePrivateProperties.routePattern.depth;

    for (const matchingRoute of allMatchingRoutes) {
      if (matchingRoute === route) {
        continue;
      }
      const matchingRoutePrivateProperties =
        getRoutePrivateProperties(matchingRoute);
      const depth = matchingRoutePrivateProperties.routePattern.depth;

      if (depth > maxDepth) {
        maxDepth = depth;
        mostSpecificRoute = matchingRoute;
      }
    }

    // If we found a more specific route, delegate to it; otherwise handle it ourselves
    if (mostSpecificRoute !== route) {
      return mostSpecificRoute.redirectTo(newParams);
    }
    return route.redirectTo(newParams);
  };
  route.buildRelativeUrl = (params) => {
    // buildMostPreciseUrl now handles parameter resolution internally
    return routePattern.buildMostPreciseUrl(params);
  };
  route.buildUrl = (params) => {
    const routeRelativeUrl = route.buildRelativeUrl(params);
    const routeUrl = resolveRouteUrl(routeRelativeUrl);
    return routeUrl;
  };
  route.matchesParams = (providedParams) => {
    const currentParams = route.params;
    const resolvedParams = routePattern.resolveParams({
      ...currentParams,
      ...providedParams,
    });
    const same = compareTwoJsValues(currentParams, resolvedParams);
    return same;
  };

  // relativeUrl/url
  route.relativeUrlSignal = computed(() => {
    const rawParams = route.rawParamsSignal.value;
    const relativeUrl = route.buildRelativeUrl(rawParams);
    return relativeUrl;
  });
  route.urlSignal = computed(() => {
    const routeUrl = route.buildUrl();
    return routeUrl;
  });
  const disposeRelativeUrlEffect = effect(() => {
    route.relativeUrl = route.relativeUrlSignal.value;
  });
  const disposeUrlEffect = effect(() => {
    route.url = route.urlSignal.value;
  });
  cleanupCallbackSet.add(disposeRelativeUrlEffect);
  cleanupCallbackSet.add(disposeUrlEffect);

  // action stuff (for later)
  route.bindAction = (action) => {
    const { store } = action.meta;
    if (store) {
      const { mutableIdKeys } = store;
      if (mutableIdKeys.length) {
        const mutableIdKey = mutableIdKeys[0];
        const mutableIdValueSignal = computed(() => {
          const params = route.paramsSignal.value;
          const mutableIdValue = params[mutableIdKey];
          return mutableIdValue;
        });
        const routeItemSignal = store.signalForMutableIdKey(
          mutableIdKey,
          mutableIdValueSignal,
        );
        store.observeProperties(routeItemSignal, (propertyMutations) => {
          const mutableIdPropertyMutation = propertyMutations[mutableIdKey];
          if (!mutableIdPropertyMutation) {
            return;
          }
          route.replaceParams({
            [mutableIdKey]: mutableIdPropertyMutation.newValue,
          });
        });
      }
    }

    const actionBoundToThisRoute = action.bindParams(route.paramsSignal);
    route.action = actionBoundToThisRoute;
    return actionBoundToThisRoute;
  };

  return route;
};

let integration;
const setRouteIntegration = (integrationInterface) => {
  integration = integrationInterface;
};
let onRouteDefined = () => {};
const setOnRouteDefined = (v) => {
  onRouteDefined = v;
};

const arraySignal = (initialValue = []) => {
  const theSignal = signal(initialValue);

  const add = (...args) => {
    theSignal.value = addIntoArray(theSignal.peek(), ...args);
  };
  const remove = (...args) => {
    theSignal.value = removeFromArray(theSignal.peek(), ...args);
  };

  return [theSignal, add, remove];
};

const executeWithCleanup = (fn, cleanup) => {
  let isThenable;
  try {
    const result = fn();
    isThenable = result && typeof result.then === "function";
    if (isThenable) {
      return (async () => {
        try {
          return await result;
        } finally {
          cleanup();
        }
      })();
    }
    return result;
  } finally {
    if (!isThenable) {
      cleanup();
    }
  }
};

let DEBUG$1 = false;
const enableDebugOnDocumentLoading = () => {
  DEBUG$1 = true;
};

const windowIsLoadingSignal = signal(true);
if (document.readyState === "complete") {
  windowIsLoadingSignal.value = false;
} else {
  document.addEventListener("readystatechange", () => {
    if (document.readyState === "complete") {
      windowIsLoadingSignal.value = false;
    }
  });
}

const [
  documentLoadingRouteArraySignal,
  addToDocumentLoadingRouteArraySignal,
  removeFromDocumentLoadingRouteArraySignal,
] = arraySignal([]);
const routingWhile = (fn, routeNames = []) => {
  if (DEBUG$1 && routeNames.length > 0) {
    console.debug(`routingWhile: Adding routes to loading state:`, routeNames);
  }
  addToDocumentLoadingRouteArraySignal(...routeNames);
  return executeWithCleanup(fn, () => {
    removeFromDocumentLoadingRouteArraySignal(...routeNames);
    if (DEBUG$1 && routeNames.length > 0) {
      console.debug(
        `routingWhile: Removed routes from loading state:`,
        routeNames,
        "state after removing:",
        documentLoadingRouteArraySignal.peek(),
      );
    }
  });
};

const [
  documentLoadingActionArraySignal,
  addToDocumentLoadingActionArraySignal,
  removeFromDocumentLoadingActionArraySignal,
] = arraySignal([]);
const workingWhile = (fn, actionNames = []) => {
  if (DEBUG$1 && actionNames.length > 0) {
    console.debug(
      `workingWhile: Adding actions to loading state:`,
      actionNames,
    );
  }
  addToDocumentLoadingActionArraySignal(...actionNames);
  return executeWithCleanup(fn, () => {
    removeFromDocumentLoadingActionArraySignal(...actionNames);
    if (DEBUG$1 && actionNames.length > 0) {
      console.debug(
        `routingWhile: Removed action from loading state:`,
        actionNames,
        "start after removing:",
        documentLoadingActionArraySignal.peek(),
      );
    }
  });
};

const documentIsBusySignal = computed(() => {
  return (
    documentLoadingRouteArraySignal.value.length > 0 ||
    documentLoadingActionArraySignal.value.length > 0
  );
});

computed(() => {
  const windowIsLoading = windowIsLoadingSignal.value;
  const routesLoading = documentLoadingRouteArraySignal.value;
  const actionsLoading = documentLoadingActionArraySignal.value;
  const reasonArray = [];
  if (windowIsLoading) {
    reasonArray.push("window_loading");
  }
  if (routesLoading.length > 0) {
    reasonArray.push("document_routing");
  }
  if (actionsLoading.length > 0) {
    reasonArray.push("document_working");
  }
  return reasonArray;
});

const documentUrlSignal = signal(
  typeof window === "undefined" ? "http://localhost" : window.location.href,
);
const useDocumentUrl = () => {
  return documentUrlSignal.value;
};
const updateDocumentUrl = (value) => {
  documentUrlSignal.value = value;
};

const documentResourceSignal = computed(() => {
  const documentUrl = documentUrlSignal.value;
  const documentResource = urlToResource(documentUrl);
  return documentResource;
});
const useDocumentResource = () => {
  return documentResourceSignal.value;
};
const urlToResource = (url) => {
  const scheme = urlToScheme(url);
  if (scheme === "file") {
    const urlAsStringWithoutFileProtocol = String(url).slice("file://".length);
    return urlAsStringWithoutFileProtocol;
  }
  if (scheme === "https" || scheme === "http") {
    // remove origin
    const afterProtocol = String(url).slice(scheme.length + "://".length);
    const pathnameSlashIndex = afterProtocol.indexOf("/", "://".length);
    const urlAsStringWithoutOrigin = afterProtocol.slice(pathnameSlashIndex);
    return urlAsStringWithoutOrigin;
  }
  const urlAsStringWithoutProtocol = String(url).slice(scheme.length + 1);
  return urlAsStringWithoutProtocol;
};
const urlToScheme = (url) => {
  const urlString = String(url);
  const colonIndex = urlString.indexOf(":");
  if (colonIndex === -1) {
    return "";
  }
  const scheme = urlString.slice(0, colonIndex);
  return scheme;
};

const documentStateSignal = signal(null);
const useDocumentState = () => {
  return documentStateSignal.value;
};
const updateDocumentState = (value) => {
  documentStateSignal.value = value;
};

const getHrefTargetInfo = (href) => {
  href = String(href);

  if (!href || href.trim() === "") {
    return {
      isEmpty: true,
      isCurrent: false,
      isAnchor: false,
      isSameOrigin: true,
      isSameSite: true,
    };
  }

  const currentUrl = new URL(window.location.href);
  const targetUrl = new URL(href, window.location.href);

  let isCurrent = false;
  {
    isCurrent = currentUrl.href === targetUrl.href;
  }
  let isAnchor = false;
  {
    if (
      currentUrl.pathname === targetUrl.pathname &&
      currentUrl.search === targetUrl.search &&
      targetUrl.hash !== ""
    ) {
      isAnchor = true;
    }
  }
  let isSameOrigin = false;
  {
    const currentOrigin = currentUrl.origin;
    const targetOrigin = targetUrl.origin;
    isSameOrigin = currentOrigin === targetOrigin;
  }
  let isSameSite = false;
  {
    const baseDomain = (hostname) => {
      const parts = hostname.split(".").slice(-2);
      return parts.join(".");
    };
    const currentDomain = baseDomain(currentUrl.hostname);
    const targetDomain = baseDomain(targetUrl.hostname);
    isSameSite = currentDomain === targetDomain;
  }

  return {
    isEmpty: false,
    isCurrent,
    isAnchor,
    isSameOrigin,
    isSameSite,
  };
};

const setupBrowserIntegrationViaHistory = ({
  applyActions,
  applyRouting,
}) => {
  const { history } = window;

  let globalAbortController = new AbortController();
  const triggerGlobalAbort = (reason) => {
    globalAbortController.abort(reason);
    globalAbortController = new AbortController();
  };

  const dispatchActions = (params) => {
    const { requestedResult } = applyActions({
      globalAbortSignal: globalAbortController.signal,
      abortSignal: new AbortController().signal,
      ...params,
    });
    return requestedResult;
  };
  setActionDispatcher(dispatchActions);

  const getDocumentState = () => {
    return window.history.state ? { ...window.history.state } : null;
  };

  const replaceDocumentState = (
    newState,
    { reason = "replaceDocumentState called" } = {},
  ) => {
    const url = window.location.href;
    handleRoutingTask(url, {
      reason,
      navigationType: "replace",
      state: newState,
    });
  };

  const historyStartAtStart = getDocumentState();
  const visitedUrlSet = historyStartAtStart
    ? new Set(historyStartAtStart.jsenv_visited_urls || [])
    : new Set();

  // Create a signal that tracks visited URLs for reactive updates
  // Using a counter instead of the Set directly for better performance
  // Links will check isVisited() when this signal changes
  const visitedUrlsSignal = signal(0);

  const isVisited = (url) => {
    url = new URL(url, window.location.href).href;
    return visitedUrlSet.has(url);
  };
  const markUrlAsVisited = (url) => {
    if (visitedUrlSet.has(url)) {
      return;
    }
    visitedUrlSet.add(url);
    visitedUrlsSignal.value++; // Increment signal to notify subscribers that visited URLs changed

    const historyState = getDocumentState() || {};
    const historyStateWithVisitedUrls = {
      ...historyState,
      jsenv_visited_urls: Array.from(visitedUrlSet),
    };
    window.history.replaceState(
      historyStateWithVisitedUrls,
      null,
      window.location.href,
    );
    updateDocumentState(historyStateWithVisitedUrls);
  };

  let abortController = null;
  const handleRoutingTask = (
    url,
    {
      reason,
      navigationType, // "push", "reload", "replace", "traverse"
      state,
    },
  ) => {
    if (navigationType === "push") {
      window.history.pushState(state, null, url);
    } else if (navigationType === "replace") {
      window.history.replaceState(state, null, url);
    }

    updateDocumentUrl(url);
    updateDocumentState(state);
    markUrlAsVisited(url);
    if (abortController) {
      abortController.abort(`navigating to ${url}`);
    }
    abortController = new AbortController();
    const abortSignal = abortController.signal;
    const { allResult, requestedResult } = applyRouting(url, {
      globalAbortSignal: globalAbortController.signal,
      abortSignal,
      reason,
      navigationType,
      isVisited,
      state,
    });
    executeWithCleanup(
      () => allResult,
      () => {
        abortController = undefined;
      },
    );
    return requestedResult;
  };

  // Browser event handlers
  window.addEventListener(
    "click",
    (e) => {
      if (e.button !== 0) {
        // Ignore non-left clicks
        return;
      }
      if (e.metaKey) {
        // Ignore clicks with meta key (e.g. open in new tab)
        return;
      }
      if (e.defaultPrevented) {
        return;
      }
      const linkElement = e.target.closest("a");
      if (!linkElement) {
        return;
      }
      if (linkElement.hasAttribute("data-readonly")) {
        return;
      }
      const href = linkElement.href;
      const { isEmpty, isSameOrigin, isAnchor } = getHrefTargetInfo(href);
      if (
        isEmpty ||
        // Let link to other origins be handled by the browser
        !isSameOrigin ||
        // Ignore anchor navigation (same page, different hash)
        isAnchor
      ) {
        return;
      }
      e.preventDefault();
      handleRoutingTask(href, {
        reason: `"click" on a[href="${href}"]`,
        navigationType: "push",
        state: null,
      });
    },
    { capture: true },
  );

  window.addEventListener(
    "submit",
    () => {
      // Handle form submissions?
      // Not needed yet
    },
    { capture: true },
  );

  window.addEventListener("popstate", (popstateEvent) => {
    const url = window.location.href;
    const state = popstateEvent.state;
    handleRoutingTask(url, {
      reason: `"popstate" event for ${url}`,
      navigationType: "traverse",
      state,
    });
  });

  const navTo = async (url, { replace, state = null } = {}) => {
    handleRoutingTask(url, {
      reason: `navTo called with "${url}"`,
      navigationType: replace ? "replace" : "push",
      state,
    });
  };

  const stop = (reason = "stop called") => {
    triggerGlobalAbort(reason);
  };

  const reload = () => {
    const url = window.location.href;
    const state = history.state;
    handleRoutingTask(url, {
      reason: "reload called",
      navigationType: "reload",
      state,
    });
  };

  const navBack = () => {
    window.history.back();
  };

  const navForward = () => {
    window.history.forward();
  };

  const init = () => {
    const url = window.location.href;
    const state = history.state;
    handleRoutingTask(url, {
      reason: "routing initialization",
      navigationType: "replace",
      state,
    });
  };

  return {
    integration: "browser_history_api",
    init,
    navTo,
    stop,
    reload,
    navBack,
    navForward,
    getDocumentState,
    replaceDocumentState,
    isVisited,
    visitedUrlsSignal,
  };
};

const applyActions = (params) => {
  const updateActionsResult = updateActions(params);
  const { allResult, runningActionSet } = updateActionsResult;
  const pendingTaskNameArray = [];
  for (const runningAction of runningActionSet) {
    pendingTaskNameArray.push(runningAction.name);
  }
  workingWhile(() => allResult, pendingTaskNameArray);
  return updateActionsResult;
};

const applyRouting = (
  url,
  {
    globalAbortSignal,
    abortSignal,
    // state
    navigationType,
    isVisited,
    reason,
  },
) => {
  const {
    loadSet,
    reloadSet,
    abortSignalMap,
    routeLoadRequestedMap,
    activeRouteSet,
  } = updateRoutes(url, {
    navigationType,
    isVisited,
    // state,
  });
  if (loadSet.size === 0 && reloadSet.size === 0) {
    return {
      allResult: undefined,
      requestedResult: undefined,
      activeRouteSet: new Set(),
    };
  }
  const updateActionsResult = updateActions({
    globalAbortSignal,
    abortSignal,
    runSet: loadSet,
    rerunSet: reloadSet,
    abortSignalMap,
    reason,
  });
  const { allResult, runningActionSet } = updateActionsResult;
  const pendingTaskNameArray = [];
  for (const [route, routeAction] of routeLoadRequestedMap) {
    if (runningActionSet.has(routeAction)) {
      pendingTaskNameArray.push(`${route.relativeUrl} -> ${routeAction.name}`);
    }
  }
  routingWhile(() => allResult, pendingTaskNameArray);
  return { ...updateActionsResult, activeRouteSet };
};

const browserIntegration = setupBrowserIntegrationViaHistory({
  applyActions,
  applyRouting,
});

setOnRouteDefined(() => {
  browserIntegration.init();
});
setRouteIntegration(browserIntegration);

const actionIntegratedVia = browserIntegration.integration;
const navTo = (target, options) => {
  const url = new URL(target, window.location.href).href;
  const currentUrl = documentUrlSignal.peek();
  if (url === currentUrl) {
    return null;
  }
  return browserIntegration.navTo(url, options);
};
const stopLoad = (reason = "stopLoad() called") => {
  const windowIsLoading = windowIsLoadingSignal.value;
  if (windowIsLoading) {
    window.stop();
  }
  const documentIsBusy = documentIsBusySignal.value;
  if (documentIsBusy) {
    browserIntegration.stop(reason);
  }
};
const reload = browserIntegration.reload;
const navBack = browserIntegration.navBack;
const navForward = browserIntegration.navForward;
const isVisited = browserIntegration.isVisited;
const visitedUrlsSignal = browserIntegration.visitedUrlsSignal;
browserIntegration.handleActionTask;

const NOT_SET = {};
const NO_OP = () => {};
const NO_ID_GIVEN = [undefined, NO_OP, NO_OP];
const useNavStateBasic = (id, initialValue, { debug } = {}) => {
  const navStateRef = useRef(NOT_SET);
  if (!id) {
    return NO_ID_GIVEN;
  }

  if (navStateRef.current === NOT_SET) {
    const documentState = browserIntegration.getDocumentState();
    const valueInDocumentState = documentState ? documentState[id] : undefined;
    if (valueInDocumentState === undefined) {
      navStateRef.current = initialValue;
      if (initialValue !== undefined) {
        console.debug(
          `useNavState(${id}) initial value is ${initialValue} (from initialValue passed in as argument)`,
        );
      }
    } else {
      navStateRef.current = valueInDocumentState;
      if (debug) {
        console.debug(
          `useNavState(${id}) initial value is ${initialValue} (from nav state)`,
        );
      }
    }
  }

  const set = (value) => {
    const currentValue = navStateRef.current;
    if (typeof value === "function") {
      value = value(currentValue);
    }
    if (debug) {
      console.debug(
        `useNavState(${id}) set ${value} (previous was ${currentValue})`,
      );
    }

    const currentState = browserIntegration.getDocumentState() || {};

    if (value === undefined) {
      if (!Object.hasOwn(currentState, id)) {
        return;
      }
      delete currentState[id];
      browserIntegration.replaceDocumentState(currentState, {
        reason: `delete "${id}" from browser state`,
      });
      return;
    }

    const valueInBrowserState = currentState[id];
    if (valueInBrowserState === value) {
      return;
    }
    currentState[id] = value;
    browserIntegration.replaceDocumentState(currentState, {
      reason: `set { ${id}: ${value} } in browser state`,
    });
  };

  return [
    navStateRef.current,
    set,
    () => {
      set(undefined);
    },
  ];
};

const useNavState$1 = useNavStateBasic;

const NEVER_SET = {};
const useUrlSearchParam = (paramName, defaultValue) => {
  const documentUrl = documentUrlSignal.value;
  const searchParam = new URL(documentUrl).searchParams.get(paramName);
  const valueRef = useRef(NEVER_SET);
  const [value, setValue] = useState(defaultValue);
  if (valueRef.current !== searchParam) {
    valueRef.current = searchParam;
    setValue(searchParam);
  }

  const setSearchParamValue = (newValue, { replace = false } = {}) => {
    const newUrlObject = new URL(window.location.href);
    newUrlObject.searchParams.set(paramName, newValue);
    const newUrl = newUrlObject.href;
    navTo(newUrl, { replace });
  };

  return [value, setSearchParamValue];
};

// import { signal } from "@preact/signals";


const useForceRender = () => {
  const [, setState] = useState(null);
  return () => {
    setState({});
  };
};

/**
 *
 * . Refactor les actions pour qu'elles utilisent use. Ce qui va ouvrir la voie pour
 * Suspense et ErrorBoundary sur tous les composants utilisant des actions
 *
 * . Tester le code splitting avec .lazy + import dynamique
 * pour les elements des routes
 *
 * 3. Ajouter la possibilite d'avoir des action sur les routes
 * Tester juste les data pour commencer
 * On aura ptet besoin d'un useRouteData au lieu de passer par un element qui est une fonction
 * pour que react ne re-render pas tout
 *
 * 4. Utiliser use() pour compar Suspense et ErrorBoundary lorsque route action se produit.
 *
 *
 */

const debug$1 = (...args) => {
  return;
};

// Check if a route is a "parent" route (catches multiple routes) and if current URL matches exactly
const isParentRouteExactMatch = route => {
  if (!route) {
    return false;
  }
  const currentUrl = window.location.href;
  const parentUrl = route.buildUrl();
  if (currentUrl === parentUrl) {
    return true;
  }
  const currentUrlObject = new URL(currentUrl);
  if (!currentUrlObject.pathname.endsWith("/")) {
    return false;
  }
  const pathnameWithoutSlash = currentUrlObject.pathname.slice(0, -1);
  currentUrlObject.pathname = pathnameWithoutSlash;
  const currentUrlWithoutTrailingSlash = currentUrlObject.href;
  return currentUrlWithoutTrailingSlash === parentUrl;
};
const RootElement = () => {
  return jsx(Route.Slot, {});
};
const SlotContext = createContext(null);
const RouteInfoContext = createContext(null);
const Routes = ({
  element = RootElement,
  children
}) => {
  const routeInfo = useMatchingRouteInfo();
  const route = routeInfo?.route;
  return jsx(Route, {
    route: route,
    element: element,
    children: children
  });
};
const useMatchingRouteInfo = () => useContext(RouteInfoContext);
const Route = ({
  element,
  route,
  index,
  fallback,
  meta,
  children,
  routeParams
}) => {
  const forceRender = useForceRender();
  const hasDiscoveredRef = useRef(false);
  const matchingInfoRef = useRef(null);
  if (!hasDiscoveredRef.current) {
    return jsx(MatchingRouteManager, {
      element: element,
      route: route,
      index: index,
      fallback: fallback,
      meta: meta,
      routeParams: routeParams,
      onMatchingInfoChange: matchingInfo => {
        hasDiscoveredRef.current = true;
        matchingInfoRef.current = matchingInfo;
        forceRender();
      },
      children: children
    });
  }
  const matchingInfo = matchingInfoRef.current;
  if (!matchingInfo) {
    return null;
  }
  const {
    MatchingElement
  } = matchingInfo;
  return jsx(MatchingElement, {});
};
const RegisterChildRouteContext = createContext(null);

/* This component is ensure to be rendered once
So no need to cleanup things or whatever we know and ensure that 
it's executed once for the entire app lifecycle */
const MatchingRouteManager = ({
  element,
  route,
  index,
  fallback,
  meta,
  routeParams,
  onMatchingInfoChange,
  children
}) => {
  if (route && fallback) {
    throw new Error("Route cannot have both route and fallback props");
  }
  const registerChildRouteFromContext = useContext(RegisterChildRouteContext);
  const elementId = getElementSignature(element);
  const candidateSet = new Set();
  let indexCandidate = null;
  let fallbackCandidate = null;
  const registerChildRoute = childRouteInfo => {
    const childElementId = getElementSignature(childRouteInfo.element);
    candidateSet.add(childRouteInfo);
    if (childRouteInfo.index) {
      if (indexCandidate) {
        throw new Error(`Multiple index routes registered under the same parent route (${elementId}):
- ${getElementSignature(indexCandidate.element)}
- ${childElementId}`);
      }
      indexCandidate = childRouteInfo;
    }
    if (childRouteInfo.fallback) {
      if (fallbackCandidate) {
        throw new Error(`Multiple fallback routes registered under the same parent route (${elementId}):
- ${getElementSignature(fallbackCandidate.element)}
- ${childElementId}`);
      }
      if (childRouteInfo.route.routeFromProps) {
        throw new Error(`Fallback route cannot have a route prop (${childElementId})`);
      }
      fallbackCandidate = childRouteInfo;
    }
  };
  useLayoutEffect(() => {
    initRouteObserver({
      element,
      route,
      index,
      fallback,
      meta,
      routeParams,
      indexCandidate,
      fallbackCandidate,
      candidateSet,
      onMatchingInfoChange,
      registerChildRouteFromContext
    });
  }, []);
  return jsx(RegisterChildRouteContext.Provider, {
    value: registerChildRoute,
    children: children
  });
};
const initRouteObserver = ({
  element,
  route,
  index,
  fallback,
  meta,
  routeParams,
  indexCandidate,
  fallbackCandidate,
  candidateSet,
  onMatchingInfoChange,
  registerChildRouteFromContext
}) => {
  if (!fallbackCandidate && indexCandidate && indexCandidate.fallback !== false) {
    // no fallback + an index -> index behaves as a fallback (handle urls under a parent when no sibling matches)
    // to disable this behavior set fallback={false} on the index route
    // (in that case no route will be rendered when no child matches meaning only parent route element will be shown)
    fallbackCandidate = indexCandidate;
  }
  const [teardown, addTeardown] = createPubSub();
  const elementId = getElementSignature(element);
  const candidateElementIds = Array.from(candidateSet, c => getElementSignature(c.element));
  if (candidateElementIds.length === 0) ; else {
    debug$1(`initRouteObserver ${elementId}, child candidates:
  - ${candidateElementIds.join("\n  - ")}`);
  }
  const [publishCompositeStatus, subscribeCompositeStatus] = createPubSub();
  const compositeRoute = {
    urlPattern: `composite(${candidateElementIds})`,
    isComposite: true,
    matching: false,
    subscribeStatus: subscribeCompositeStatus,
    toString: () => `composite(${candidateSet.size} candidates)`,
    routeFromProps: route,
    elementFromProps: element
  };
  const findMatchingChildInfo = () => {
    for (const candidate of candidateSet) {
      if (candidate.route?.matching) {
        return candidate;
      }
    }
    if (indexCandidate) {
      if (indexCandidate === fallbackCandidate) {
        // the index is also used as fallback (catch all routes under a parent)
        return indexCandidate;
      }
      // Only return the index candidate if the current URL matches exactly the parent route
      // This allows fallback routes to handle non-defined URLs under this parent route
      if (route && isParentRouteExactMatch(route)) {
        return indexCandidate;
      }
    }
    if (fallbackCandidate) {
      return fallbackCandidate;
    }
    return null;
  };
  const getMatchingInfo = route ? () => {
    if (!route.matching) {
      // we have a route and it does not match no need to go further
      return null;
    }

    // Check if routeParams match current route parameters
    if (routeParams && !route.matchesParams(routeParams)) {
      return null; // routeParams don't match, don't render
    }

    // we have a route and it is matching
    // we search the first matching child to put it in the slot
    const matchingChildInfo = findMatchingChildInfo();
    if (matchingChildInfo) {
      return matchingChildInfo;
    }
    return {
      route,
      element: null,
      meta
    };
  } : () => {
    // we don't have a route, do we have a matching child?
    const matchingChildInfo = findMatchingChildInfo();
    if (matchingChildInfo) {
      return matchingChildInfo;
    }
    return null;
  };
  const matchingRouteInfoSignal = signal();
  const SlotMatchingElementSignal = signal();
  const MatchingElement = () => {
    const matchingRouteInfo = matchingRouteInfoSignal.value;
    useUITransitionContentId(matchingRouteInfo ? matchingRouteInfo.route.urlPattern : fallback ? "fallback" : undefined);
    const SlotMatchingElement = SlotMatchingElementSignal.value;
    if (typeof element === "function") {
      const Element = element;
      element = jsx(Element, {});
    }
    return jsx(RouteInfoContext.Provider, {
      value: matchingRouteInfo,
      children: jsx(SlotContext.Provider, {
        value: SlotMatchingElement,
        children: element
      })
    });
  };
  MatchingElement.underlyingElementId = candidateSet.size === 0 ? `${getElementSignature(element)} without slot` : `[${getElementSignature(element)} with slot one of ${candidateElementIds}]`;
  const updateMatchingInfo = () => {
    const newMatchingInfo = getMatchingInfo();
    if (newMatchingInfo) {
      compositeRoute.matching = true;
      matchingRouteInfoSignal.value = newMatchingInfo;
      SlotMatchingElementSignal.value = newMatchingInfo.element;
      onMatchingInfoChange({
        route: newMatchingInfo.route,
        MatchingElement,
        SlotMatchingElement: newMatchingInfo.element,
        index: newMatchingInfo.index,
        fallback: newMatchingInfo.fallback,
        meta: newMatchingInfo.meta
      });
    } else {
      compositeRoute.matching = false;
      matchingRouteInfoSignal.value = null;
      SlotMatchingElementSignal.value = null;
      onMatchingInfoChange(null);
    }
  };
  const onChange = () => {
    updateMatchingInfo();
    publishCompositeStatus();
  };
  if (route) {
    addTeardown(route.subscribeStatus(onChange));
  }
  for (const candidate of candidateSet) {
    addTeardown(candidate.route.subscribeStatus(onChange));
  }
  if (registerChildRouteFromContext) {
    registerChildRouteFromContext({
      route: compositeRoute,
      element: MatchingElement,
      index,
      fallback,
      meta
    });
  }
  updateMatchingInfo();
  return () => {
    teardown();
  };
};
const RouteSlot = () => {
  const SlotElement = useContext(SlotContext);
  if (SlotElement === undefined) {
    return jsx("p", {
      children: "RouteSlot must be used inside a Route"
    });
  }
  if (SlotElement === null) {
    return null;
  }
  return jsx(SlotElement, {});
};
Route.Slot = RouteSlot;

const FormContext = createContext();

const FormActionContext = createContext();

const renderActionableComponent = (props, {
  Basic,
  WithAction,
  WithActionInsideForm
}) => {
  const {
    action,
    shortcuts
  } = props;
  const formContext = useContext(FormContext);
  const hasActionProps = Boolean(action || shortcuts && shortcuts.length > 0);
  const considerInsideForm = Boolean(formContext);
  if (hasActionProps && WithAction) {
    if (considerInsideForm && WithActionInsideForm) {
      return jsx(WithActionInsideForm, {
        ...props
      });
    }
    return jsx(WithAction, {
      ...props
    });
  }
  return jsx(Basic, {
    ...props
  });
};

/**
 * Custom hook creating a stable callback that doesn't trigger re-renders.
 *
 * PROBLEM: Parent components often forget to use useCallback, causing library
 * components to re-render unnecessarily when receiving callback props.
 *
 * SOLUTION: Library components can use this hook to create stable callback
 * references internally, making them defensive against parents who don't
 * optimize their callbacks. This ensures library components don't force
 * consumers to think about useCallback.
 *
 * USAGE:
 * ```js
 * // Parent component (consumer) - no useCallback needed
 * const Parent = () => {
 *   const [count, setCount] = useState(0);
 *
 *   // Parent naturally creates new function reference each render
 *   // (forgetting useCallback is common and shouldn't break performance)
 *   return <LibraryButton onClick={(e) => setCount(count + 1)} />;
 * };
 *
 * // Library component - defensive against changing callbacks
 * const LibraryButton = ({ onClick }) => {
 *   // ✅ Create stable reference from parent's potentially changing callback
 *   const stableClick = useStableCallback(onClick);
 *
 *   // Internal expensive components won't re-render when parent updates
 *   return <ExpensiveInternalButton onClick={stableClick} />;
 * };
 *
 * // Deep internal component gets stable reference
 * const ExpensiveInternalButton = memo(({ onClick }) => {
 *   // This won't re-render when Parent's count changes
 *   // But onClick will always call the latest Parent callback
 *   return <button onClick={onClick}>Click me</button>;
 * });
 * ```
 *
 * Perfect for library components that need performance without burdening consumers.
 */


const useStableCallback = (callback, mapper) => {
  const callbackRef = useRef();
  callbackRef.current = callback;
  const stableCallbackRef = useRef();

  // Return original falsy value directly when callback is not a function
  if (!callback) {
    return callback;
  }

  const existingStableCallback = stableCallbackRef.current;
  if (existingStableCallback) {
    return existingStableCallback;
  }
  const stableCallback = (...args) => {
    const currentCallback = callbackRef.current;
    return currentCallback(...args);
  };
  stableCallbackRef.current = stableCallback;
  return stableCallback;
};

const DEBUG = {
  registration: false,
  // Element registration/unregistration
  interaction: false,
  // Click and keyboard interactions
  selection: false,
  // Selection state changes (set, add, remove, toggle)
  navigation: false,
  // Arrow key navigation and element finding
  valueExtraction: false // Value extraction from elements
};
const debug = (category, ...args) => {
  if (DEBUG[category]) {
    console.debug(`[selection:${category}]`, ...args);
  }
};
const SelectionContext = createContext();
const useSelectionController = ({
  elementRef,
  layout,
  value,
  onChange,
  multiple,
  selectAllName
}) => {
  if (!elementRef) {
    throw new Error("useSelectionController: elementRef is required");
  }
  onChange = useStableCallback(onChange);
  const currentValueRef = useRef(value);
  currentValueRef.current = value;
  const lastInternalValueRef = useRef(null);
  const selectionController = useMemo(() => {
    const innerOnChange = (newValue, ...args) => {
      lastInternalValueRef.current = newValue;
      onChange?.(newValue, ...args);
    };
    const getCurrentValue = () => currentValueRef.current;
    if (layout === "grid") {
      return createGridSelectionController({
        getCurrentValue,
        onChange: innerOnChange,
        enabled: Boolean(onChange),
        multiple,
        selectAllName
      });
    }
    return createLinearSelectionController({
      getCurrentValue,
      onChange: innerOnChange,
      layout,
      elementRef,
      multiple,
      enabled: Boolean(onChange),
      selectAllName
    });
  }, [layout, multiple, elementRef]);
  useEffect(() => {
    selectionController.element = elementRef.current;
  }, [selectionController]);
  useLayoutEffect(() => {
    selectionController.enabled = Boolean(onChange);
  }, [selectionController, onChange]);

  // Smart sync: only update selection when value changes externally
  useEffect(() => {
    // Check if this is an external change (not from our internal onChange)
    const isExternalChange = !compareTwoJsValues(value, lastInternalValueRef.current);
    if (isExternalChange) {
      selectionController.update(value);
    }
  }, [value, selectionController]);
  return selectionController;
};
// Base Selection - shared functionality between grid and linear
const createBaseSelectionController = ({
  getCurrentValue,
  registry,
  onChange,
  type,
  enabled,
  multiple,
  selectAllName,
  navigationMethods: {
    getElementRange,
    getElementAfter,
    getElementBefore,
    getElementBelow,
    getElementAbove
  }
}) => {
  const [publishChange, subscribeChange] = createPubSub();
  const getElementByValue = valueToFind => {
    for (const element of registry) {
      if (getElementValue(element) === valueToFind) {
        return element;
      }
    }
    return null;
  };
  const update = (newValue, event) => {
    if (!baseSelection.enabled) {
      console.warn("cannot change selection: no onChange provided");
      return;
    }
    const currentValue = getCurrentValue();
    if (compareTwoJsValues(newValue, currentValue)) {
      return;
    }
    const allValues = [];
    for (const element of registry) {
      const value = getElementValue(element);
      allValues.push(value);
    }
    const oldSelectedSet = new Set(currentValue);
    const newSelectedSet = new Set(newValue);
    const willBeUnselectedSet = new Set();
    for (const item of oldSelectedSet) {
      if (!newSelectedSet.has(item)) {
        willBeUnselectedSet.add(item);
      }
    }
    const selectionSet = new Set(newValue);
    for (const newSelected of newSelectedSet) {
      const element = getElementByValue(newSelected);
      if (element._selectionImpact) {
        const impactedValues = element._selectionImpact(allValues);
        for (const impactedValue of impactedValues) {
          selectionSet.add(impactedValue);
        }
      }
    }
    for (const willBeUnselected of willBeUnselectedSet) {
      const element = getElementByValue(willBeUnselected);
      if (element._selectionImpact) {
        const impactedValues = element._selectionImpact(allValues);
        for (const impactedValue of impactedValues) {
          if (selectionSet.has(impactedValue)) {
            // want to be selected -> keep it
            // - might be explicit : initially part of newValue/selectionSet)
            // - or implicit: added to selectionSet by selectionImpact
            continue;
          }
          selectionSet.delete(impactedValue);
        }
      }
    }
    const finalValue = Array.from(selectionSet);
    debug("selection", `${type} setSelection: calling onChange with:`, finalValue);
    onChange(finalValue, event);
    publishChange(finalValue, event);
  };
  let anchorElement = null;
  let activeElement = null;
  const registerElement = (element, options = {}) => {
    const elementValue = getElementValue(element);
    debug("registration", `${type} registerElement:`, element, "value:", elementValue, "registry size before:", registry.size);
    registry.add(element);
    // Store the selectionImpact callback if provided
    if (options.selectionImpact) {
      element._selectionImpact = options.selectionImpact;
    }
    debug("registration", `${type} registerElement: registry size after:`, registry.size);
  };
  const unregisterElement = element => {
    const elementValue = getElementValue(element);
    debug("registration", `${type} unregisterElement:`, element, "value:", elementValue, "registry size before:", registry.size);
    registry.delete(element);
    debug("registration", `${type} unregisterElement: registry size after:`, registry.size);
  };
  const setActiveElement = element => {
    activeElement = element;
  };
  const setAnchorElement = element => {
    const elementValue = getElementValue(element);
    debug("selection", `${type} setAnchorElement:`, element, "value:", elementValue);
    anchorElement = element;
  };
  const isElementSelected = element => {
    const elementValue = getElementValue(element);
    const isSelected = baseSelection.value.includes(elementValue);
    return isSelected;
  };
  const isValueSelected = value => {
    const isSelected = baseSelection.value.includes(value);
    return isSelected;
  };
  // Selection manipulation methods
  const setSelection = (newSelection, event = null) => {
    debug("selection", `${type} setSelection called with:`, newSelection, "current selection:", baseSelection.value);
    if (newSelection.length === baseSelection.value.length && newSelection.every((value, index) => value === baseSelection.value[index])) {
      debug("selection", `${type} setSelection: no change, returning early`);
      return;
    }
    update(newSelection, event);
  };
  const addToSelection = (arrayOfValuesToAdd, event = null) => {
    debug("selection", `${type} addToSelection called with:`, arrayOfValuesToAdd, "current selection:", baseSelection.value);
    const selectionWithValues = [...baseSelection.value];
    let modified = false;
    for (const valueToAdd of arrayOfValuesToAdd) {
      if (!selectionWithValues.includes(valueToAdd)) {
        modified = true;
        selectionWithValues.push(valueToAdd);
        debug("selection", `${type} addToSelection: adding value:`, valueToAdd);
      }
    }
    if (modified) {
      update(selectionWithValues, event);
    } else {
      debug("selection", `${type} addToSelection: no changes made`);
    }
  };
  const removeFromSelection = (arrayOfValuesToRemove, event = null) => {
    let modified = false;
    const selectionWithoutValues = [];
    for (const elementValue of baseSelection.value) {
      if (arrayOfValuesToRemove.includes(elementValue)) {
        modified = true;
      } else {
        selectionWithoutValues.push(elementValue);
      }
    }
    if (modified) {
      update(selectionWithoutValues, event);
    }
  };
  const toggleElement = (element, event = null) => {
    const elementValue = getElementValue(element);
    if (baseSelection.value.includes(elementValue)) {
      baseSelection.removeFromSelection([elementValue], event);
    } else {
      baseSelection.addToSelection([elementValue], event);
    }
  };
  const selectFromAnchorTo = (element, event = null) => {
    if (anchorElement) {
      const currentAnchor = anchorElement; // Preserve the current anchor
      const range = getElementRange(anchorElement, element);
      baseSelection.setSelection(range, event);
      // Restore the original anchor (setSelection changes it to the last element)
      anchorElement = currentAnchor;
    } else {
      baseSelection.setSelection([getElementValue(element)], event);
    }
  };
  const selectAll = event => {
    const allValues = [];
    for (const element of registry) {
      if (selectAllName && getElementSelectionName(element) !== selectAllName) {
        continue;
      }
      const value = getElementValue(element);
      allValues.push(value);
    }
    debug("interaction", "Select All - setting selection to all values:", allValues);
    baseSelection.setSelection(allValues, event);
  };
  const baseSelection = {
    type,
    multiple,
    enabled,
    get value() {
      return getCurrentValue();
    },
    registry,
    get anchorElement() {
      return anchorElement;
    },
    get activeElement() {
      return activeElement;
    },
    channels: {
      change: {
        add: subscribeChange
      }
    },
    update,
    registerElement,
    unregisterElement,
    setAnchorElement,
    setActiveElement,
    isElementSelected,
    isValueSelected,
    setSelection,
    addToSelection,
    removeFromSelection,
    toggleElement,
    selectFromAnchorTo,
    selectAll,
    // Navigation methods (will be overridden by specific implementations)
    getElementRange,
    getElementAfter,
    getElementBefore,
    getElementBelow,
    getElementAbove
  };
  return baseSelection;
};
// Grid Selection Provider - for 2D layouts like tables
const createGridSelectionController = ({
  ...options
}) => {
  const registry = new Set();
  const navigationMethods = {
    getElementRange: (fromElement, toElement) => {
      const fromPos = getElementPosition(fromElement);
      const toPos = getElementPosition(toElement);
      if (!fromPos || !toPos) {
        return [];
      }

      // Check selection types to ensure we only select compatible elements
      const fromSelectionName = getElementSelectionName(fromElement);
      const toSelectionName = getElementSelectionName(toElement);

      // Calculate rectangular selection area
      const {
        x: fromX,
        y: fromY
      } = fromPos;
      const {
        x: toX,
        y: toY
      } = toPos;
      const minX = Math.min(fromX, toX);
      const maxX = Math.max(fromX, toX);
      const minY = Math.min(fromY, toY);
      const maxY = Math.max(fromY, toY);

      // Find all registered elements within the rectangular area
      const valuesInRange = [];
      for (const element of registry) {
        const pos = getElementPosition(element);
        if (pos && pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY) {
          const elementSelectionName = getElementSelectionName(element);
          // Only include elements with matching selection type
          if (elementSelectionName === fromSelectionName && elementSelectionName === toSelectionName) {
            valuesInRange.push(getElementValue(element));
          }
        }
      }
      return valuesInRange;
    },
    getElementAfter: element => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }
      const {
        x,
        y
      } = currentPos;
      const nextX = x + 1;
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName = getElementSelectionName(candidateElement);
        if (pos && pos.x === nextX && pos.y === y) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    },
    getElementBefore: element => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }
      const {
        x,
        y
      } = currentPos;
      const prevX = x - 1;
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName = getElementSelectionName(candidateElement);
        if (pos && pos.x === prevX && pos.y === y) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    },
    getElementBelow: element => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }
      const {
        x,
        y
      } = currentPos;
      const nextY = y + 1;
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName = getElementSelectionName(candidateElement);
        if (pos && pos.x === x && pos.y === nextY) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    },
    getElementAbove: element => {
      const currentPos = getElementPosition(element);
      if (!currentPos) {
        return null;
      }
      const {
        x,
        y
      } = currentPos;
      const prevY = y - 1;
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      // Single loop: prioritize same selection name
      for (const candidateElement of registry) {
        const pos = getElementPosition(candidateElement);
        const candidateSelectionName = getElementSelectionName(candidateElement);
        if (pos && pos.x === x && pos.y === prevY) {
          if (candidateSelectionName === currentSelectionName) {
            return candidateElement;
          }
          if (!fallbackElement) {
            fallbackElement = candidateElement;
          }
        }
      }
      return fallbackElement;
    }
  };
  const gridSelectionController = createBaseSelectionController({
    ...options,
    registry,
    type: "grid",
    navigationMethods
  });
  gridSelectionController.axis = {
    x: true,
    y: true
  };
  return gridSelectionController;
};
// Linear Selection Provider - for 1D layouts like lists
const createLinearSelectionController = ({
  layout = "vertical",
  // "horizontal" or "vertical"
  elementRef,
  // Root element to scope DOM traversal
  ...options
}) => {
  if (!["horizontal", "vertical"].includes(layout)) {
    throw new Error(`useLinearSelection: Invalid axis "${layout}". Must be "horizontal" or "vertical".`);
  }
  const registry = new Set();

  // Define navigation methods that need access to registry
  const navigationMethods = {
    getElementRange: (fromElement, toElement) => {
      if (!registry.has(fromElement) || !registry.has(toElement)) {
        return [];
      }

      // Check selection types to ensure we only select compatible elements
      const fromSelectionName = getElementSelectionName(fromElement);
      const toSelectionName = getElementSelectionName(toElement);

      // Use compareDocumentPosition to determine order
      const comparison = fromElement.compareDocumentPosition(toElement);
      let startElement;
      let endElement;
      if (comparison & Node.DOCUMENT_POSITION_FOLLOWING) {
        // toElement comes after fromElement
        startElement = fromElement;
        endElement = toElement;
      } else if (comparison & Node.DOCUMENT_POSITION_PRECEDING) {
        // toElement comes before fromElement
        startElement = toElement;
        endElement = fromElement;
      } else {
        // Same element
        return [getElementValue(fromElement)];
      }
      const valuesInRange = [];

      // Check all registered elements to see if they're in the range
      for (const element of registry) {
        // Check if element is between startElement and endElement
        const afterStart = startElement.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING;
        const beforeEnd = element.compareDocumentPosition(endElement) & Node.DOCUMENT_POSITION_FOLLOWING;
        if (element === startElement || element === endElement || afterStart && beforeEnd) {
          const elementSelectionName = getElementSelectionName(element);

          // Only include elements with matching selection type
          if (elementSelectionName === fromSelectionName && elementSelectionName === toSelectionName) {
            valuesInRange.push(getElementValue(element));
          }
        }
      }
      return valuesInRange;
    },
    getElementAfter: element => {
      if (!registry.has(element)) {
        return null;
      }
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      const sameTypeElement = findAfter(element, candidate => {
        if (!registry.has(candidate)) {
          return false;
        }
        const candidateSelectionName = getElementSelectionName(candidate);
        // If same selection name, this is our preferred result
        if (candidateSelectionName === currentSelectionName) {
          return true;
        }
        // Different selection name - store as fallback but keep searching
        if (!fallbackElement) {
          fallbackElement = candidate;
        }
        return false;
      }, {
        root: elementRef.current || document.body
      });
      return sameTypeElement || fallbackElement;
    },
    getElementBefore: element => {
      if (!registry.has(element)) {
        return null;
      }
      const currentSelectionName = getElementSelectionName(element);
      let fallbackElement = null;
      const sameTypeElement = findBefore(element, candidate => {
        if (!registry.has(candidate)) {
          return false;
        }
        const candidateSelectionName = getElementSelectionName(candidate);
        // If same selection name, this is our preferred result
        if (candidateSelectionName === currentSelectionName) {
          return true;
        }
        // Different selection name - store as fallback but keep searching
        if (!fallbackElement) {
          fallbackElement = candidate;
        }
        return false;
      }, {
        root: elementRef.current || document.body
      });
      return sameTypeElement || fallbackElement;
    },
    // Add axis-dependent methods
    getElementBelow: element => {
      if (layout === "vertical") {
        return navigationMethods.getElementAfter(element);
      }
      return null;
    },
    getElementAbove: element => {
      if (layout === "vertical") {
        return navigationMethods.getElementBefore(element);
      }
      return null;
    }
  };

  // Create base selection with navigation methods
  const linearSelectionController = createBaseSelectionController({
    ...options,
    registry,
    type: "linear",
    navigationMethods
  });
  linearSelectionController.axis = {
    x: layout === "horizontal",
    y: layout === "vertical"
  };
  return linearSelectionController;
};
// Helper function to extract value from an element
const getElementValue = element => {
  let value;
  if (element.value !== undefined) {
    value = element.value;
  } else if (element.hasAttribute("data-value")) {
    value = element.getAttribute("data-value");
  } else {
    value = undefined;
  }
  debug("valueExtraction", "getElementValue:", element, "->", value);
  return value;
};
const getElementSelectionName = element => {
  return element.getAttribute("data-selection-name");
};

// Helper functions to find end elements for jump to end functionality
const getJumpToEndElement = (selection, element, keydownEvent) => {
  if (selection.type === "grid") {
    return getJumpToEndElementGrid(selection, element, keydownEvent);
  } else if (selection.type === "linear") {
    return getJumpToEndElementLinear(selection, element, keydownEvent);
  }
  return null;
};
const getJumpToEndElementGrid = (selection, element, keydownEvent) => {
  const currentPos = getElementPosition(element);
  if (!currentPos) {
    return null;
  }
  const {
    key
  } = keydownEvent;
  const {
    x,
    y
  } = currentPos;
  const currentSelectionName = getElementSelectionName(element);
  if (key === "ArrowRight") {
    // Jump to last element in current row with matching selection name
    let lastInRow = null;
    let fallbackElement = null;
    let maxX = -1;
    let fallbackMaxX = -1;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);
      if (pos && pos.y === y) {
        if (candidateSelectionName === currentSelectionName && pos.x > maxX) {
          maxX = pos.x;
          lastInRow = candidateElement;
        } else if (candidateSelectionName !== currentSelectionName && pos.x > fallbackMaxX) {
          fallbackMaxX = pos.x;
          fallbackElement = candidateElement;
        }
      }
    }
    return lastInRow || fallbackElement;
  }
  if (key === "ArrowLeft") {
    // Jump to first element in current row with matching selection name
    let firstInRow = null;
    let fallbackElement = null;
    let minX = Infinity;
    let fallbackMinX = Infinity;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);
      if (pos && pos.y === y) {
        if (candidateSelectionName === currentSelectionName && pos.x < minX) {
          minX = pos.x;
          firstInRow = candidateElement;
        } else if (candidateSelectionName !== currentSelectionName && pos.x < fallbackMinX) {
          fallbackMinX = pos.x;
          fallbackElement = candidateElement;
        }
      }
    }
    return firstInRow || fallbackElement;
  }
  if (key === "ArrowDown") {
    // Jump to last element in current column with matching selection name
    let lastInColumn = null;
    let fallbackElement = null;
    let maxY = -1;
    let fallbackMaxY = -1;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);
      if (pos && pos.x === x) {
        if (candidateSelectionName === currentSelectionName && pos.y > maxY) {
          maxY = pos.y;
          lastInColumn = candidateElement;
        } else if (candidateSelectionName !== currentSelectionName && pos.y > fallbackMaxY) {
          fallbackMaxY = pos.y;
          fallbackElement = candidateElement;
        }
      }
    }
    return lastInColumn || fallbackElement;
  }
  if (key === "ArrowUp") {
    // Jump to first element in current column with matching selection name
    let firstInColumn = null;
    let fallbackElement = null;
    let minY = Infinity;
    let fallbackMinY = Infinity;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      const pos = getElementPosition(candidateElement);
      if (pos && pos.x === x) {
        if (candidateSelectionName === currentSelectionName && pos.y < minY) {
          minY = pos.y;
          firstInColumn = candidateElement;
        } else if (candidateSelectionName !== currentSelectionName && pos.y < fallbackMinY) {
          fallbackMinY = pos.y;
          fallbackElement = candidateElement;
        }
      }
    }
    return firstInColumn || fallbackElement;
  }
  return null;
};
const getJumpToEndElementLinear = (selection, element, direction) => {
  const currentSelectionName = getElementSelectionName(element);
  if (direction === "ArrowDown" || direction === "ArrowRight") {
    // Jump to last element in the registry with matching selection name
    let lastElement = null;
    let fallbackElement = null;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      if (candidateSelectionName === currentSelectionName) {
        if (!lastElement || candidateElement.compareDocumentPosition(lastElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
          lastElement = candidateElement;
        }
      } else if (!fallbackElement) {
        if (!fallbackElement || candidateElement.compareDocumentPosition(fallbackElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
          fallbackElement = candidateElement;
        }
      }
    }
    return lastElement || fallbackElement;
  }
  if (direction === "ArrowUp" || direction === "ArrowLeft") {
    // Jump to first element in the registry with matching selection name
    let firstElement = null;
    let fallbackElement = null;
    for (const candidateElement of selection.registry) {
      const candidateSelectionName = getElementSelectionName(candidateElement);
      if (candidateSelectionName === currentSelectionName) {
        if (!firstElement || firstElement.compareDocumentPosition(candidateElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
          firstElement = candidateElement;
        }
      } else if (!fallbackElement) {
        if (!fallbackElement || fallbackElement.compareDocumentPosition(candidateElement) & Node.DOCUMENT_POSITION_FOLLOWING) {
          fallbackElement = candidateElement;
        }
      }
    }
    return firstElement || fallbackElement;
  }
  return null;
};

// Helper function for grid positioning (moved here from createGridSelection)
const getElementPosition = element => {
  // Get position by checking element's position in table structure
  const cell = element.closest("td, th");
  if (!cell) return null;
  const row = cell.closest("tr");
  if (!row) return null;
  const table = row.closest("table");
  if (!table) return null;
  const rows = Array.from(table.rows);
  const cells = Array.from(row.cells);
  return {
    x: cells.indexOf(cell),
    y: rows.indexOf(row)
  };
};
const useSelectableElement = (elementRef, {
  selection,
  selectionController,
  selectionImpact
}) => {
  if (!selectionController) {
    throw new Error("useSelectableElement needs a selectionController");
  }
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    const value = getElementValue(element);
    const selectionName = getElementSelectionName(element);
    debug("registration", "useSelectableElement: registering element:", element, "value:", value, "selectionName:", selectionName);
    selectionController.registerElement(element, {
      selectionImpact
    });
    element.setAttribute("data-selectable", "");
    return () => {
      debug("registration", "useSelectableElement: unregistering element:", element, "value:", value);
      selectionController.unregisterElement(element);
      element.removeAttribute("data-selectable");
    };
  }, [selectionController, selectionImpact]);
  const [selected, setSelected] = useState(false);
  debug("selection", "useSelectableElement: initial selected state:", selected);
  // Update selected state when selection value changes
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      debug("selection", "useSelectableElement: no element, setting selected to false");
      setSelected(false);
      return;
    }
    // Use selection values directly for better performance
    const elementValue = getElementValue(element);
    const isSelected = selection.includes(elementValue);
    debug("selection", "useSelectableElement: updating selected state", element, "isSelected:", isSelected);
    setSelected(isSelected);
  }, [selection]);

  // Add event listeners directly to the element
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    let isDragging = false;
    let dragStartElement = null;
    let cleanup = () => {};
    const handleMouseDown = e => {
      if (!selectionController.enabled) {
        return;
      }
      if (e.button !== 0) {
        // Only handle left mouse button
        return;
      }

      // if (e.defaultPrevented) {
      //   // If the event was prevented by another handler, do not interfere
      //   debug("interaction", "mousedown: event already prevented, skipping");
      //   return;
      // }
      const isMultiSelect = e.metaKey || e.ctrlKey;
      const isShiftSelect = e.shiftKey;
      const isSingleSelect = !isMultiSelect && !isShiftSelect;
      const value = getElementValue(element);
      debug("interaction", "mousedown:", {
        element,
        value,
        isMultiSelect,
        isShiftSelect,
        isSingleSelect,
        currentSelection: selectionController.value
      });

      // Handle immediate selection based on modifier keys
      if (isSingleSelect) {
        // Single select - replace entire selection with just this item
        debug("interaction", "mousedown: single select, setting selection to:", [value]);
        selectionController.setSelection([value], e);
      } else if (isMultiSelect && !isShiftSelect) {
        // Multi select without shift - toggle element
        debug("interaction", "mousedown: multi select, toggling element");
        selectionController.toggleElement(element, e);
      } else if (isShiftSelect) {
        e.preventDefault(); // Prevent navigation
        debug("interaction", "mousedown: shift select, selecting from anchor to element");
        selectionController.selectFromAnchorTo(element, e);
      }
      if (!selectionController.dragToSelect) {
        return;
      }

      // Set up for potential drag selection (now works with all modifier combinations)
      dragStartElement = element;
      isDragging = false; // Will be set to true if mouse moves beyond threshold

      // Store initial mouse position for drag threshold
      const startX = e.clientX;
      const startY = e.clientY;
      const dragThreshold = 5; // pixels

      const handleMouseMove = e => {
        if (!dragStartElement) {
          return;
        }
        if (!isDragging) {
          // Check if we've exceeded the drag threshold
          const deltaX = Math.abs(e.clientX - startX);
          const deltaY = Math.abs(e.clientY - startY);
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
          if (distance < dragThreshold) {
            return; // Don't start dragging yet
          }
          isDragging = true;
          // mark it as drag-selecting
          selectionController.element.setAttribute("data-drag-selecting", "");
        }

        // Find the element under the current mouse position
        const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
        if (!elementUnderMouse) {
          return;
        }
        // Find the closest selectable element (look for element with data-value or in registry)
        let targetElement = elementUnderMouse;
        while (true) {
          if (selectionController.registry.has(targetElement)) {
            break;
          }
          if (targetElement.hasAttribute("data-value") || targetElement.hasAttribute("aria-selected")) {
            break;
          }
          targetElement = targetElement.parentElement;
          if (!targetElement) {
            return;
          }
        }
        if (!selectionController.registry.has(targetElement)) {
          return;
        }
        // Check if we're mixing selection types (like row and cell selections)
        const dragStartSelectionName = getElementSelectionName(dragStartElement);
        const targetSelectionName = getElementSelectionName(targetElement);
        // Only allow drag between elements of the same selection type
        if (dragStartSelectionName !== targetSelectionName) {
          debug("interaction", "drag select: skipping mixed selection types", {
            dragStartSelectionName,
            targetSelectionName
          });
          return;
        }

        // Get the range from anchor to current target
        const rangeValues = selectionController.getElementRange(dragStartElement, targetElement);

        // Handle different drag behaviors based on modifier keys
        const isShiftSelect = e.shiftKey;
        const isMultiSelect = e.metaKey || e.ctrlKey;
        if (isShiftSelect) {
          // For shift drag, use selectFromAnchorTo behavior (replace selection with range from anchor)
          debug("interaction", "shift drag select: selecting from anchor to target", rangeValues);
          selectionController.selectFromAnchorTo(targetElement, e);
          return;
        }
        if (isMultiSelect) {
          // For multi-select drag, add to existing selection
          debug("interaction", "multi-select drag: adding range to selection", rangeValues);
          const currentSelection = [...selectionController.value];
          const newSelection = [...new Set([...currentSelection, ...rangeValues])];
          selectionController.setSelection(newSelection, e);
          return;
        }
        // For normal drag, replace selection
        debug("interaction", "drag select: setting selection to range", rangeValues);
        selectionController.setSelection(rangeValues, e);
      };
      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Remove drag-selecting state from table
        if (isDragging) {
          selectionController.element.removeAttribute("data-drag-selecting");
        }

        // Reset drag state
        dragStartElement = null;
        isDragging = false;
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      cleanup = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    };
    element.addEventListener("mousedown", handleMouseDown);
    return () => {
      element.removeEventListener("mousedown", handleMouseDown);
      cleanup();
    };
  }, [selectionController]);
  return {
    selected
  };
};

// Helper function to handle cross-type navigation
const handleCrossTypeNavigation = (currentElement, targetElement, isMultiSelect) => {
  const currentSelectionName = getElementSelectionName(currentElement);
  const targetSelectionName = getElementSelectionName(targetElement);

  // Check if we're switching between different selection types
  if (currentSelectionName !== targetSelectionName) {
    debug("navigation", "Cross-type navigation detected:", currentSelectionName, "->", targetSelectionName);

    // Return info about cross-type navigation for caller to handle
    return {
      isCrossType: true,
      shouldClearPreviousSelection: !isMultiSelect
    };
  }
  return {
    isCrossType: false,
    shouldClearPreviousSelection: false
  };
};
const createSelectionKeyboardShortcuts = (selectionController, {
  toggleEnabled,
  enabled,
  toggleKey = "space"
} = {}) => {
  const getSelectableElement = keydownEvent => {
    return keydownEvent.target.closest("[data-selectable]");
  };
  const moveSelection = (keyboardEvent, getElementToSelect) => {
    const selectableElement = getSelectableElement(keyboardEvent);
    const elementToSelect = getElementToSelect(selectableElement, keyboardEvent);
    if (!elementToSelect) {
      return false;
    }
    const {
      key
    } = keyboardEvent;
    const isMetaOrCtrlPressed = keyboardEvent.metaKey || keyboardEvent.ctrlKey;
    const isShiftSelect = keyboardEvent.shiftKey;
    const isMultiSelect = isMetaOrCtrlPressed && isShiftSelect; // Only add to selection when BOTH are pressed
    const targetValue = getElementValue(elementToSelect);
    const {
      isCrossType,
      shouldClearPreviousSelection
    } = handleCrossTypeNavigation(selectableElement, elementToSelect, isMultiSelect);
    if (isShiftSelect) {
      debug("interaction", `keydownToSelect: ${key} with Shift - selecting from anchor to target element`);
      selectionController.setActiveElement(elementToSelect);
      selectionController.selectFromAnchorTo(elementToSelect, keyboardEvent);
      return true;
    }
    if (isMultiSelect && !isCrossType) {
      debug("interaction", `keydownToSelect: ${key} with multi-select - adding to selection`);
      selectionController.addToSelection([targetValue], keyboardEvent);
      return true;
    }
    // Handle cross-type navigation
    if (shouldClearPreviousSelection) {
      debug("interaction", `keydownToSelect: ${key} - cross-type navigation, clearing and setting new selection`);
      selectionController.setSelection([targetValue], keyboardEvent);
      return true;
    }
    if (isCrossType && !shouldClearPreviousSelection) {
      debug("interaction", `keydownToSelect: ${key} - cross-type navigation with Cmd, adding to selection`);
      selectionController.addToSelection([targetValue], keyboardEvent);
      return true;
    }
    debug("interaction", `keydownToSelect: ${key} - setting selection to target element`);
    selectionController.setSelection([targetValue], keyboardEvent);
    return true;
  };
  if (enabled !== undefined && typeof enabled !== "function") {
    const v = enabled;
    enabled = () => v;
  }
  return [{
    description: "Add element above to selection",
    key: "command+shift+up",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.y) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, getJumpToEndElement);
    }
  }, {
    description: "Select element above",
    key: "up",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.y) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, selectableElement => selectionController.getElementAbove(selectableElement));
    }
  }, {
    description: "Add element below to selection",
    key: "command+shift+down",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.y) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, getJumpToEndElement);
    }
  }, {
    description: "Select element below",
    key: "down",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.y) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, selectableElement => {
        return selectionController.getElementBelow(selectableElement);
      });
    }
  }, {
    description: "Add left element to selection",
    key: "command+shift+left",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.x) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, getJumpToEndElement);
    }
  }, {
    description: "Select left element",
    key: "left",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.x) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, selectableElement => {
        return selectionController.getElementBefore(selectableElement);
      });
    }
  }, {
    description: "Add right element to selection",
    key: "command+shift+right",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.x) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, getJumpToEndElement);
    }
  }, {
    description: "Select right element",
    key: "right",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!selectionController.axis.x) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      return moveSelection(keyboardEvent, selectableElement => {
        return selectionController.getElementAfter(selectableElement);
      });
    }
  }, {
    description: "Set element as anchor for shift selections",
    key: "shift",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      const element = getSelectableElement(keyboardEvent);
      selectionController.setAnchorElement(element);
      return true;
    }
  }, {
    description: "Select all",
    key: "command+a",
    enabled: () => {
      if (!selectionController.enabled) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    handler: keyboardEvent => {
      selectionController.selectAll(keyboardEvent);
      return true;
    }
  }, {
    description: "Toggle element selected state",
    enabled: keyboardEvent => {
      if (!selectionController.enabled) {
        return false;
      }
      if (!toggleEnabled) {
        return false;
      }
      const elementWithToggleShortcut = keyboardEvent.target.closest("[data-selection-keyboard-toggle]");
      if (!elementWithToggleShortcut) {
        return false;
      }
      if (enabled && !enabled()) {
        return false;
      }
      return true;
    },
    key: toggleKey,
    handler: keyboardEvent => {
      const element = getSelectableElement(keyboardEvent);
      const elementValue = getElementValue(element);
      const isCurrentlySelected = selectionController.isElementSelected(element);
      if (isCurrentlySelected) {
        selectionController.removeFromSelection([elementValue], keyboardEvent);
        return true;
      }
      selectionController.addToSelection([elementValue], keyboardEvent);
      return true;
    }
  }];
};

const addManyEventListeners = (element, events) => {
  const cleanupCallbackSet = new Set();
  for (const event of Object.keys(events)) {
    const callback = events[event];
    element.addEventListener(event, callback);
    cleanupCallbackSet.add(() => {
      element.removeEventListener(event, callback);
    });
  }
  return () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
  };
};

const useActionEvents = (
  elementRef,
  {
    actionOrigin = "action_prop",
    /**
     * @param {Event} e - L'événement original
     * @param {"form_reset" | "blur_invalid" | "escape_key"} reason - Raison du cancel
     */
    onCancel,
    onRequested,
    onPrevented,
    onAction,
    onStart,
    onAbort,
    onError,
    onEnd,
  },
) => {
  onCancel = useStableCallback(onCancel);
  onRequested = useStableCallback(onRequested);
  onPrevented = useStableCallback(onPrevented);
  onAction = useStableCallback(onAction);
  onStart = useStableCallback(onStart);
  onAbort = useStableCallback(onAbort);
  onError = useStableCallback(onError);
  onEnd = useStableCallback(onEnd);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }

    return addManyEventListeners(element, {
      cancel: (e) => {
        // cancel don't need to check for actionOrigin because
        // it's actually unrelated to a specific actions
        // in that sense it should likely be moved elsewhere as it's related to
        // interaction and constraint validation, not to a specific action
        onCancel?.(e, e.detail.reason);
      },
      actionrequested: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onRequested?.(e);
      },
      actionprevented: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onPrevented?.(e);
      },
      action: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onAction?.(e);
      },
      actionstart: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onStart?.(e);
      },
      actionabort: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onAbort?.(e);
      },
      actionerror: (e) => {
        if (e.detail.actionOrigin !== actionOrigin) {
          return;
        }
        onError?.(e.detail.error, e);
      },
      actionend: onEnd,
    });
  }, [
    actionOrigin,
    onCancel,
    onRequested,
    onPrevented,
    onAction,
    onStart,
    onAbort,
    onError,
    onEnd,
  ]);
};

const useRequestedActionStatus = (elementRef) => {
  const [actionRequester, setActionRequester] = useState(null);
  const [actionPending, setActionPending] = useState(false);
  const [actionAborted, setActionAborted] = useState(false);
  const [actionError, setActionError] = useState(null);

  useActionEvents(elementRef, {
    onAction: (actionEvent) => {
      setActionRequester(actionEvent.detail.requester);
    },
    onStart: () => {
      setActionPending(true);
      setActionAborted(false);
      setActionError(null);
    },
    onAbort: () => {
      setActionPending(false);
      setActionAborted(true);
    },
    onError: (error) => {
      setActionPending(false);
      setActionError(error);
    },
    onEnd: () => {
      setActionPending(false);
    },
  });

  return {
    actionRequester,
    actionPending,
    actionAborted,
    actionError,
  };
};

// autoFocus does not work so we focus in a useLayoutEffect,
// see https://github.com/preactjs/preact/issues/1255


let blurEvent = null;
let timeout;
document.body.addEventListener(
  "blur",
  (e) => {
    blurEvent = e;
    setTimeout(() => {
      blurEvent = null;
    });
  },
  { capture: true },
);
document.body.addEventListener(
  "focus",
  () => {
    clearTimeout(timeout);
    blurEvent = null;
  },
  { capture: true },
);

const useAutoFocus = (
  focusableElementRef,
  autoFocus,
  { autoFocusVisible, autoSelect } = {},
) => {
  useLayoutEffect(() => {
    if (!autoFocus) {
      return null;
    }
    const activeElement = document.activeElement;
    const focusableElement = focusableElementRef.current;
    focusableElement.focus({ focusVisible: autoFocusVisible });
    if (autoSelect) {
      focusableElement.select();
      // Keep the beginning of the text visible instead of scrolling to the end
      focusableElement.scrollLeft = 0;
    }
    return () => {
      const focusIsOnSelfOrInsideSelf =
        document.activeElement === focusableElement ||
        focusableElement.contains(document.activeElement);
      if (
        !focusIsOnSelfOrInsideSelf &&
        document.activeElement !== document.body
      ) {
        // focus is not on our element (or body) anymore
        // keep it where it is
        return;
      }

      // We have focus but we are unmounted
      // -> try to move focus back to something more meaningful that what browser would do
      // (browser would put it to document.body)
      // -> We'll try to move focus back to the element that had focus before we moved it to this element

      if (!document.body.contains(activeElement)) {
        // previously active element is no longer in the document
        return;
      }

      if (blurEvent) {
        // But if this element is unmounted during a blur, the element that is about to receive focus should prevail
        const elementAboutToReceiveFocus = blurEvent.relatedTarget;
        const isSelfOrInsideSelf =
          elementAboutToReceiveFocus === focusableElement ||
          focusableElement.contains(elementAboutToReceiveFocus);
        const isPreviouslyActiveElementOrInsideIt =
          elementAboutToReceiveFocus === activeElement ||
          (activeElement && activeElement.contains(elementAboutToReceiveFocus));
        if (!isSelfOrInsideSelf && !isPreviouslyActiveElementOrInsideIt) {
          // the element about to receive focus is not the input itself or inside it
          // and is not the previously active element or inside it
          // -> the element about to receive focus should prevail
          return;
        }
      }

      activeElement.focus();
    };
  }, []);

  useEffect(() => {
    if (autoFocus) {
      const focusableElement = focusableElementRef.current;
      focusableElement.scrollIntoView({ inline: "nearest", block: "nearest" });
    }
  }, []);
};

const CalloutCloseContext = createContext();
const useCalloutClose = () => {
  return useContext(CalloutCloseContext);
};
const renderIntoCallout = (jsx$1, calloutMessageElement, {
  close
}) => {
  const calloutJsx = jsx(CalloutCloseContext.Provider, {
    value: close,
    children: jsx$1
  });
  render(calloutJsx, calloutMessageElement);
};

installImportMetaCss(import.meta);
/**
 * A callout component that mimics native browser validation messages.
 * Features:
 * - Positions above or below target element based on available space
 * - Follows target element during scrolling and resizing
 * - Automatically hides when target element is not visible
 * - Arrow automatically shows when pointing at a valid anchor element
 * - Centers in viewport when no anchor element provided or anchor is too big
 */

import.meta.css = /* css */ `
  @layer navi {
    .navi_callout {
      --callout-success-color: #4caf50;
      --callout-info-color: #2196f3;
      --callout-warning-color: #ff9800;
      --callout-error-color: #f44336;

      --callout-background-color: white;
      --callout-icon-color: black;
      --callout-padding: 8px;
      --callout-z-index: 1000;
    }
  }

  .navi_callout {
    --x-callout-border-color: var(--x-callout-status-color);
    --x-callout-background-color: var(--callout-background-color);
    --x-callout-icon-color: var(--x-callout-status-color);

    position: absolute;
    top: 0;
    left: 0;
    z-index: var(--callout-z-index);
    display: block;
    height: auto;
    opacity: 0;
    /* will be positioned with transform: translate */
    transition: opacity 0.2s ease-in-out;
    overflow: visible;

    &[data-status="success"] {
      --x-callout-status-color: var(--callout-success-color);
    }
    &[data-status="info"] {
      --x-callout-status-color: var(--callout-info-color);
    }
    &[data-status="warning"] {
      --x-callout-status-color: var(--callout-warning-color);
    }
    &[data-status="error"] {
      --x-callout-status-color: var(--callout-error-color);
    }

    .navi_callout_box {
      position: relative;
      border-style: solid;
      border-color: transparent;

      .navi_callout_frame {
        position: absolute;
        filter: drop-shadow(4px 4px 3px rgba(0, 0, 0, 0.2));
        pointer-events: none;

        svg {
          position: absolute;
          inset: 0;
          overflow: visible;

          .navi_callout_border {
            fill: var(--x-callout-border-color);
          }
          .navi_callout_background {
            fill: var(--x-callout-background-color);
          }
        }
      }

      .navi_callout_body {
        position: relative;
        display: flex;
        max-width: 47vw;
        padding: var(--callout-padding);
        flex-direction: row;
        gap: 10px;

        .navi_callout_icon {
          display: flex;
          width: 22px;
          height: 22px;
          flex-shrink: 0;
          align-items: center;
          align-self: flex-start;
          justify-content: center;
          background-color: var(--x-callout-icon-color);
          border-radius: 2px;

          svg {
            width: 16px;
            height: 12px;
            color: white;
          }
        }

        .navi_callout_message {
          position: relative;
          display: block;
          box-sizing: border-box;
          box-decoration-break: clone;
          align-self: center;
          word-break: break-word;
          overflow-wrap: anywhere;

          .navi_callout_error_stack {
            max-height: 200px;
            overflow: auto;
          }
          iframe {
            display: block;
            margin: 0;
          }
        }
      }
    }

    .navi_callout_close_button_column {
      display: flex;
      height: 22px;

      .navi_callout_close_button {
        width: 1em;
        height: 1em;
        padding: 0;
        align-self: center;
        color: currentColor;
        font-size: inherit;
        background: none;
        border: none;
        border-radius: 0.2em;
        cursor: pointer;

        &:hover {
          background: rgba(0, 0, 0, 0.1);
        }

        .navi_callout_close_button_svg {
          width: 100%;
          height: 100%;
        }
      }
    }
  }
`;

/**
 * Shows a callout attached to the specified element
 * @param {string} message - HTML content for the callout
 * @param {Object} options - Configuration options
 * @param {HTMLElement} [options.anchorElement] - Element the callout should follow. If not provided or too big, callout will be centered in viewport
 * @param {string} [options.status=""] - Callout status: "info" | "warning" | "error" | "success"
 * @param {Function} [options.onClose] - Callback when callout is closed
 * @param {boolean} [options.closeOnClickOutside] - Whether to close on outside clicks (defaults to true for "info" status)
 * @param {boolean} [options.debug=false] - Enable debug logging
 * @returns {Object} - Callout object with properties:
 *   - {Function} close - Function to close the callout
 *   - {Function} update - Function to update message and options
 *   - {Function} updatePosition - Function to update position
 *   - {HTMLElement} element - The callout DOM element
 *   - {boolean} opened - Whether the callout is currently open
 */
const openCallout = (
  message,
  {
    anchorElement,
    // status determines visual styling and behavior:
    // "info" - polite announcement (e.g., "This element cannot be modified")
    // "warning" - expected failure requiring user action (e.g., "Field is required")
    // "error" - unexpected failure, may not be actionable (e.g., "Server error")
    // "success" - positive feedback (e.g., "Changes saved successfully")
    // "" - neutral information
    status = "",
    onClose,
    closeOnClickOutside = status === "info",
    showErrorStack,
    debug = false,
  } = {},
) => {
  const callout = {
    opened: true,
    close: null,
    status: undefined,

    update: null,
    updatePosition: null,

    element: null,
  };

  if (debug) {
    console.debug("open callout", {
      anchorElement,
      message,
      status,
    });
  }

  const [teardown, addTeardown] = createPubSub(true);
  const close = (reason) => {
    if (!callout.opened) {
      return;
    }
    if (debug) {
      console.debug(`callout closed (reason: ${reason})`);
    }
    callout.opened = false;
    teardown(reason);
  };
  if (onClose) {
    addTeardown(onClose);
  }

  const [updateStatus, addStatusEffect, cleanupStatusEffects] =
    createValueEffect(undefined);
  addTeardown(cleanupStatusEffects);

  // Create and add callout to document
  const calloutElement = createCalloutElement();
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );
  const calloutCloseButton = calloutElement.querySelector(
    ".navi_callout_close_button",
  );
  calloutCloseButton.onclick = () => {
    close("click_close_button");
  };
  const calloutId = `navi_callout_${Date.now()}`;
  calloutElement.id = calloutId;
  calloutStyleController.set(calloutElement, { opacity: 0 });
  const update = (newMessage, options = {}) => {
    // Connect callout with target element for accessibility
    if (options.status && options.status !== callout.status) {
      callout.status = status;
      updateStatus(status);
    }

    if (options.closeOnClickOutside) {
      closeOnClickOutside = options.closeOnClickOutside;
    }

    if (isValidElement(newMessage)) {
      calloutMessageElement.innerHTML = "";
      renderIntoCallout(newMessage, calloutMessageElement, { close });
    } else if (newMessage instanceof Node) {
      // Handle DOM node (cloned from CSS selector)
      calloutMessageElement.innerHTML = "";
      calloutMessageElement.appendChild(newMessage);
    } else if (typeof newMessage === "function") {
      calloutMessageElement.innerHTML = "";
      newMessage({
        renderIntoCallout: (jsx) =>
          renderIntoCallout(jsx, calloutMessageElement, { close }),
        close,
      });
    } else {
      if (Error.isError(newMessage)) {
        const error = newMessage;
        newMessage = error.message;
        if (showErrorStack && error.stack) {
          newMessage += `<pre class="navi_callout_error_stack">${escapeHtml(String(error.stack))}</pre>`;
        }
      }

      // Check if the message is a full HTML document (starts with DOCTYPE)
      if (typeof newMessage === "string" && isHtmlDocument(newMessage)) {
        // Create iframe to isolate the HTML document
        const iframe = document.createElement("iframe");
        iframe.style.border = "none";
        iframe.style.width = "100%";
        iframe.style.backgroundColor = "white";
        iframe.srcdoc = newMessage;

        // Clear existing content and add iframe
        calloutMessageElement.innerHTML = "";
        calloutMessageElement.appendChild(iframe);
      } else {
        calloutMessageElement.innerHTML = newMessage;
      }
    }
  };
  {
    const handleClickOutside = (event) => {
      if (!closeOnClickOutside) {
        return;
      }

      const clickTarget = event.target;
      if (
        clickTarget === calloutElement ||
        calloutElement.contains(clickTarget)
      ) {
        return;
      }
      // if (
      //   clickTarget === targetElement ||
      //   targetElement.contains(clickTarget)
      // ) {
      //   return;
      // }
      close("click_outside");
    };
    document.addEventListener("click", handleClickOutside, true);
    addTeardown(() => {
      document.removeEventListener("click", handleClickOutside, true);
    });
  }
  {
    const handleCustomCloseEvent = () => {
      close("custom_event");
    };
    calloutElement.addEventListener(
      "navi_callout_close",
      handleCustomCloseEvent,
    );
  }
  Object.assign(callout, {
    element: calloutElement,
    update,
    close,
  });
  addStatusEffect(() => {
    if (status) {
      calloutElement.setAttribute("data-status", status);
    } else {
      calloutElement.removeAttribute("data-status");
    }

    if (!status || status === "info" || status === "success") {
      calloutElement.setAttribute("role", "status");
    } else if (status) {
      calloutElement.setAttribute("role", "alert");
    }
  });
  document.body.appendChild(calloutElement);
  addTeardown(() => {
    calloutElement.remove();
  });

  if (anchorElement) {
    const anchorVisuallyVisibleInfo = getVisuallyVisibleInfo(anchorElement, {
      countOffscreenAsVisible: true,
    });
    if (!anchorVisuallyVisibleInfo.visible) {
      console.warn(
        `anchor element is not visually visible (${anchorVisuallyVisibleInfo.reason}) -> will be anchored to first visually visible ancestor`,
      );
      anchorElement = getFirstVisuallyVisibleAncestor(anchorElement);
    }

    allowWheelThrough(calloutElement, anchorElement);
    anchorElement.setAttribute("data-callout", calloutId);
    addTeardown(() => {
      anchorElement.removeAttribute("data-callout");
    });

    addStatusEffect((status) => {
      if (!status) {
        return () => {};
      }
      // todo:
      // - dispatch something on the element to indicate the status
      // and that would in turn be used by pseudo styles system to eventually apply styles
      const statusColor = resolveCSSColor(
        `var(--callout-${status}-color)`,
        calloutElement,
      );
      anchorElement.setAttribute("data-callout-status", status);
      anchorElement.style.setProperty("--callout-color", statusColor);
      return () => {
        anchorElement.removeAttribute("data-callout-status");
        anchorElement.style.removeProperty("--callout-color");
      };
    });
    addStatusEffect((status) => {
      if (!status || status === "info" || status === "success") {
        anchorElement.setAttribute("aria-describedby", calloutId);
        return () => {
          anchorElement.removeAttribute("aria-describedby");
        };
      }
      anchorElement.setAttribute("aria-errormessage", calloutId);
      anchorElement.setAttribute("aria-invalid", "true");
      return () => {
        anchorElement.removeAttribute("aria-errormessage");
        anchorElement.removeAttribute("aria-invalid");
      };
    });

    {
      const onfocus = () => {
        if (status === "error") {
          // error messages must be explicitely closed by the user
          return;
        }
        if (anchorElement.hasAttribute("data-callout-stay-on-focus")) {
          return;
        }
        close("target_element_focus");
      };
      anchorElement.addEventListener("focus", onfocus);
      addTeardown(() => {
        anchorElement.removeEventListener("focus", onfocus);
      });
    }
    anchorElement.callout = callout;
    addTeardown(() => {
      delete anchorElement.callout;
    });
  }

  update(message, { status });

  {
    const documentScrollLeftAtOpen = document.documentElement.scrollLeft;
    const documentScrollTopAtOpen = document.documentElement.scrollTop;

    let positioner;
    let strategy;
    const determine = () => {
      if (!anchorElement) {
        return "centered";
      }
      // Check if anchor element is too big to reasonably position callout relative to it
      const anchorRect = anchorElement.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const anchorTooBig = anchorRect.height > viewportHeight - 50;
      if (anchorTooBig) {
        return "centered";
      }
      return "anchored";
    };
    const updatePositioner = () => {
      const newStrategy = determine();
      if (newStrategy === strategy) {
        return;
      }
      positioner?.stop();
      if (newStrategy === "centered") {
        positioner = centerCalloutInViewport(calloutElement, {
          documentScrollLeftAtOpen,
          documentScrollTopAtOpen,
        });
      } else {
        positioner = stickCalloutToAnchor(calloutElement, anchorElement);
      }
      strategy = newStrategy;
    };
    updatePositioner();
    addTeardown(() => {
      positioner.stop();
    });
    {
      const handleResize = () => {
        updatePositioner();
      };
      window.addEventListener("resize", handleResize);
      addTeardown(() => {
        window.removeEventListener("resize", handleResize);
      });
    }
    callout.updatePosition = () => positioner.update();
  }

  return callout;
};

// Configuration parameters for callout appearance
const BORDER_WIDTH = 1;
const CORNER_RADIUS = 3;
const ARROW_WIDTH = 16;
const ARROW_HEIGHT = 8;
const ARROW_SPACING = 8;

// HTML template for the callout
const calloutTemplate = /* html */ `
  <div class="navi_callout">
    <div class="navi_callout_box">
      <div class="navi_callout_frame"></div>
      <div class="navi_callout_body">
        <div class="navi_callout_icon">
          <svg viewBox="0 0 125 300" xmlns="http://www.w3.org/2000/svg">
            <path
              fill="currentColor"
              d="m25,1 8,196h59l8-196zm37,224a37,37 0 1,0 2,0z"
            />
          </svg>
        </div>
        <div class="navi_callout_message">Default message</div>
        <div class="navi_callout_close_button_column">
          <button class="navi_callout_close_button">
            <svg
              class="navi_callout_close_button_svg"
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fill-rule="evenodd"
                clip-rule="evenodd"
                d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z"
                fill="currentColor"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
`;

const calloutStyleController = createStyleController("callout");

/**
 * Creates a new callout element from template
 * @returns {HTMLElement} - The callout element
 */
const createCalloutElement = () => {
  const div = document.createElement("div");
  div.innerHTML = calloutTemplate;
  const calloutElement = div.firstElementChild;
  return calloutElement;
};

const centerCalloutInViewport = (
  calloutElement,
  { documentScrollLeftAtOpen, documentScrollTopAtOpen },
) => {
  // Set up initial styles for centered positioning
  const calloutBoxElement = calloutElement.querySelector(".navi_callout_box");
  const calloutFrameElement = calloutElement.querySelector(
    ".navi_callout_frame",
  );
  const calloutBodyElement = calloutElement.querySelector(".navi_callout_body");
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );

  // Remove any margins and set frame positioning for no arrow
  calloutBoxElement.style.marginTop = "";
  calloutBoxElement.style.marginBottom = "";
  calloutBoxElement.style.borderWidth = `${BORDER_WIDTH}px`;
  calloutFrameElement.style.left = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.right = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.top = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.bottom = `-${BORDER_WIDTH}px`;

  // Generate simple rectangle SVG without arrow and position in center
  const updateCenteredPosition = () => {
    const calloutElementClone =
      cloneCalloutToMeasureNaturalSize(calloutElement);
    const { height } = calloutElementClone.getBoundingClientRect();
    calloutElementClone.remove();

    // Handle content overflow when viewport is too small
    const viewportHeight = window.innerHeight;
    const maxAllowedHeight = viewportHeight - 40; // Leave some margin from viewport edges

    if (height > maxAllowedHeight) {
      const paddingSizes = getPaddingSizes(calloutBodyElement);
      const paddingY = paddingSizes.top + paddingSizes.bottom;
      const spaceNeededAroundContent = BORDER_WIDTH * 2 + paddingY;
      const spaceAvailableForContent =
        maxAllowedHeight - spaceNeededAroundContent;
      calloutMessageElement.style.maxHeight = `${spaceAvailableForContent}px`;
      calloutMessageElement.style.overflowY = "scroll";
    } else {
      // Reset overflow styles if not needed
      calloutMessageElement.style.maxHeight = "";
      calloutMessageElement.style.overflowY = "";
    }

    // Get final dimensions after potential overflow adjustments
    const { width: finalWidth, height: finalHeight } =
      calloutElement.getBoundingClientRect();
    calloutFrameElement.innerHTML = generateSvgWithoutArrow(
      finalWidth,
      finalHeight,
    );

    // Center in viewport (accounting for document scroll)
    const viewportWidth = window.innerWidth;
    const left = documentScrollLeftAtOpen + (viewportWidth - finalWidth) / 2;
    const top = documentScrollTopAtOpen + (viewportHeight - finalHeight) / 2;

    calloutStyleController.set(calloutElement, {
      opacity: 1,
      transform: {
        translateX: left,
        translateY: top,
      },
    });
  };

  // Initial positioning
  updateCenteredPosition();
  window.addEventListener("resize", updateCenteredPosition);

  // Return positioning function for dynamic updates
  return {
    update: updateCenteredPosition,
    stop: () => {
      window.removeEventListener("resize", updateCenteredPosition);
    },
  };
};

/**
 * Positions a callout relative to an anchor element with an arrow pointing to it
 * @param {HTMLElement} calloutElement - The callout element to position
 * @param {HTMLElement} anchorElement - The anchor element to stick to
 * @returns {Object} - Object with update and stop functions
 */
const stickCalloutToAnchor = (calloutElement, anchorElement) => {
  // Get references to callout parts
  const calloutBoxElement = calloutElement.querySelector(".navi_callout_box");
  const calloutFrameElement = calloutElement.querySelector(
    ".navi_callout_frame",
  );
  const calloutBodyElement = calloutElement.querySelector(".navi_callout_body");
  const calloutMessageElement = calloutElement.querySelector(
    ".navi_callout_message",
  );

  // Set initial border styles
  calloutBoxElement.style.borderWidth = `${BORDER_WIDTH}px`;
  calloutFrameElement.style.left = `-${BORDER_WIDTH}px`;
  calloutFrameElement.style.right = `-${BORDER_WIDTH}px`;

  const anchorVisibleRectEffect = visibleRectEffect(
    anchorElement,
    ({ left: anchorLeft, right: anchorRight, visibilityRatio }) => {
      const calloutElementClone =
        cloneCalloutToMeasureNaturalSize(calloutElement);
      // Check for preferred and forced position from anchor element
      const preferredPosition = anchorElement.getAttribute(
        "data-callout-position",
      );
      const forcedPosition = anchorElement.getAttribute(
        "data-callout-position-force",
      );

      const {
        position,
        left: calloutLeft,
        top: calloutTop,
        width: calloutWidth,
        height: calloutHeight,
        spaceAboveTarget,
        spaceBelowTarget,
      } = pickPositionRelativeTo(calloutElementClone, anchorElement, {
        alignToViewportEdgeWhenTargetNearEdge: 20,
        // when fully to the left, the border color is collé to the browser window making it hard to see
        minLeft: 1,
        positionPreference:
          // we want to avoid the callout to switch position when it can still fit so
          // we start with preferredPosition if given but once a position is picked we stick to it
          // This is implemented by favoring the data attribute of the callout then of the anchor
          calloutElement.getAttribute("data-position") || preferredPosition,
        forcePosition: forcedPosition,
      });
      calloutElementClone.remove();

      // Calculate arrow position to point at anchorElement element
      let arrowLeftPosOnCallout;
      // Determine arrow target position based on attribute
      const arrowPositionAttribute = anchorElement.getAttribute(
        "data-callout-arrow-x",
      );
      let arrowAnchorLeft;
      if (arrowPositionAttribute === "center") {
        // Target the center of the anchorElement element
        arrowAnchorLeft = (anchorLeft + anchorRight) / 2;
      } else if (arrowPositionAttribute === "end") {
        const anchorBorderSizes = getBorderSizes(anchorElement);
        // Target the right edge of the anchorElement element (before borders)
        arrowAnchorLeft = anchorRight - anchorBorderSizes.right;
      } else {
        const anchorBorderSizes = getBorderSizes(anchorElement);
        // Default behavior: target the left edge of the anchorElement element (after borders)
        arrowAnchorLeft = anchorLeft + anchorBorderSizes.left;
      }

      // Calculate arrow position within the callout
      if (calloutLeft < arrowAnchorLeft) {
        // Callout is left of the target point, move arrow right
        const diff = arrowAnchorLeft - calloutLeft;
        arrowLeftPosOnCallout = diff;
      } else if (calloutLeft + calloutWidth < arrowAnchorLeft) {
        // Edge case: target point is beyond right edge of callout
        arrowLeftPosOnCallout = calloutWidth - ARROW_WIDTH;
      } else {
        // Target point is within callout width
        arrowLeftPosOnCallout = arrowAnchorLeft - calloutLeft;
      }

      // Ensure arrow stays within callout bounds with some padding
      const minArrowPos = CORNER_RADIUS + ARROW_WIDTH / 2 + ARROW_SPACING;
      const maxArrowPos = calloutWidth - minArrowPos;
      arrowLeftPosOnCallout = Math.max(
        minArrowPos,
        Math.min(arrowLeftPosOnCallout, maxArrowPos),
      );

      // Force content overflow when there is not enough space to display
      // the entirety of the callout
      const spaceAvailable =
        position === "below" ? spaceBelowTarget : spaceAboveTarget;
      const paddingSizes = getPaddingSizes(calloutBodyElement);
      const paddingY = paddingSizes.top + paddingSizes.bottom;
      const spaceNeededAroundContent =
        ARROW_HEIGHT + BORDER_WIDTH * 2 + paddingY;
      const spaceAvailableForContent =
        spaceAvailable - spaceNeededAroundContent;
      const contentHeight = calloutHeight - spaceNeededAroundContent;
      const spaceRemainingAfterContent =
        spaceAvailableForContent - contentHeight;
      if (spaceRemainingAfterContent < 2) {
        const maxHeight = spaceAvailableForContent;
        calloutMessageElement.style.maxHeight = `${maxHeight}px`;
        calloutMessageElement.style.overflowY = "scroll";
      } else {
        calloutMessageElement.style.maxHeight = "";
        calloutMessageElement.style.overflowY = "";
      }

      const { width, height } = calloutElement.getBoundingClientRect();
      if (position === "above") {
        // Position above target element
        calloutBoxElement.style.marginTop = "";
        calloutBoxElement.style.marginBottom = `${ARROW_HEIGHT}px`;
        calloutFrameElement.style.top = `-${BORDER_WIDTH}px`;
        calloutFrameElement.style.bottom = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
        calloutFrameElement.innerHTML = generateSvgWithBottomArrow(
          width,
          height,
          arrowLeftPosOnCallout,
        );
      } else {
        calloutBoxElement.style.marginTop = `${ARROW_HEIGHT}px`;
        calloutBoxElement.style.marginBottom = "";
        calloutFrameElement.style.top = `-${BORDER_WIDTH + ARROW_HEIGHT - 0.5}px`;
        calloutFrameElement.style.bottom = `-${BORDER_WIDTH}px`;
        calloutFrameElement.innerHTML = generateSvgWithTopArrow(
          width,
          height,
          arrowLeftPosOnCallout,
        );
      }

      calloutElement.setAttribute("data-position", position);
      calloutStyleController.set(calloutElement, {
        opacity: visibilityRatio ? 1 : 0,
        transform: {
          translateX: calloutLeft,
          translateY: calloutTop,
        },
      });
    },
  );
  const calloutSizeChangeObserver = observeCalloutSizeChange(
    calloutMessageElement,
    (width, height) => {
      anchorVisibleRectEffect.check(`callout_size_change (${width}x${height})`);
    },
  );
  anchorVisibleRectEffect.onBeforeAutoCheck(() => {
    // prevent feedback loop because check triggers size change which triggers check...
    calloutSizeChangeObserver.disable();
    return () => {
      calloutSizeChangeObserver.enable();
    };
  });

  return {
    update: anchorVisibleRectEffect.check,
    stop: () => {
      calloutSizeChangeObserver.disconnect();
      anchorVisibleRectEffect.disconnect();
    },
  };
};

const observeCalloutSizeChange = (elementSizeToObserve, callback) => {
  let lastContentWidth;
  let lastContentHeight;
  const resizeObserver = new ResizeObserver((entries) => {
    const [entry] = entries;
    const { width, height } = entry.contentRect;
    // Debounce tiny changes that are likely sub-pixel rounding
    if (lastContentWidth !== undefined) {
      const widthDiff = Math.abs(width - lastContentWidth);
      const heightDiff = Math.abs(height - lastContentHeight);
      const threshold = 1; // Ignore changes smaller than 1px
      if (widthDiff < threshold && heightDiff < threshold) {
        return;
      }
    }
    lastContentWidth = width;
    lastContentHeight = height;
    callback(width, height);
  });
  resizeObserver.observe(elementSizeToObserve);

  return {
    disable: () => {
      resizeObserver.unobserve(elementSizeToObserve);
    },
    enable: () => {
      resizeObserver.observe(elementSizeToObserve);
    },
    disconnect: () => {
      resizeObserver.disconnect();
    },
  };
};

const escapeHtml = (string) => {
  return string
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

/**
 * Checks if a string is a full HTML document (starts with DOCTYPE)
 * @param {string} content - The content to check
 * @returns {boolean} - True if it looks like a complete HTML document
 */
const isHtmlDocument = (content) => {
  if (typeof content !== "string") {
    return false;
  }
  // Trim whitespace and check if it starts with DOCTYPE (case insensitive)
  const trimmed = content.trim();
  return /^<!doctype\s+html/i.test(trimmed);
};

// It's ok to do this because the element is absolutely positioned
const cloneCalloutToMeasureNaturalSize = (calloutElement) => {
  // Create invisible clone to measure natural size
  const calloutElementClone = calloutElement.cloneNode(true);
  calloutElementClone.style.visibility = "hidden";
  const calloutMessageElementClone = calloutElementClone.querySelector(
    ".navi_callout_message",
  );
  // Reset any overflow constraints on the clone
  calloutMessageElementClone.style.maxHeight = "";
  calloutMessageElementClone.style.overflowY = "";

  // Add clone to DOM to measure
  calloutElement.parentNode.appendChild(calloutElementClone);

  return calloutElementClone;
};

/**
 * Generates SVG path for callout with arrow on top
 * @param {number} width - Callout width
 * @param {number} height - Callout height
 * @param {number} arrowPosition - Horizontal position of arrow
 * @returns {string} - SVG markup
 */
const generateSvgWithTopArrow = (width, height, arrowPosition) => {
  // Calculate valid arrow position range
  const arrowLeft =
    ARROW_WIDTH / 2 + CORNER_RADIUS + BORDER_WIDTH + ARROW_SPACING;
  const minArrowPos = arrowLeft;
  const maxArrowPos = width - arrowLeft;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Calculate content height
  const contentHeight = height - ARROW_HEIGHT;

  // Create two paths: one for the border (outer) and one for the content (inner)
  const adjustedWidth = width;
  const adjustedHeight = contentHeight + ARROW_HEIGHT;

  // Slight adjustment for visual balance
  const innerArrowWidthReduction = Math.min(BORDER_WIDTH * 0.3, 1);

  // Outer path (border)
  const outerPath = `
      M${CORNER_RADIUS},${ARROW_HEIGHT} 
      H${constrainedArrowPos - ARROW_WIDTH / 2} 
      L${constrainedArrowPos},0 
      L${constrainedArrowPos + ARROW_WIDTH / 2},${ARROW_HEIGHT} 
      H${width - CORNER_RADIUS} 
      Q${width},${ARROW_HEIGHT} ${width},${ARROW_HEIGHT + CORNER_RADIUS} 
      V${adjustedHeight - CORNER_RADIUS} 
      Q${width},${adjustedHeight} ${width - CORNER_RADIUS},${adjustedHeight} 
      H${CORNER_RADIUS} 
      Q0,${adjustedHeight} 0,${adjustedHeight - CORNER_RADIUS} 
      V${ARROW_HEIGHT + CORNER_RADIUS} 
      Q0,${ARROW_HEIGHT} ${CORNER_RADIUS},${ARROW_HEIGHT}
    `;

  // Inner path (content) - keep arrow width almost the same
  const innerRadius = Math.max(0, CORNER_RADIUS - BORDER_WIDTH);
  const innerPath = `
    M${innerRadius + BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH} 
    H${constrainedArrowPos - ARROW_WIDTH / 2 + innerArrowWidthReduction} 
    L${constrainedArrowPos},${BORDER_WIDTH} 
    L${constrainedArrowPos + ARROW_WIDTH / 2 - innerArrowWidthReduction},${ARROW_HEIGHT + BORDER_WIDTH} 
    H${width - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH} ${width - BORDER_WIDTH},${ARROW_HEIGHT + innerRadius + BORDER_WIDTH} 
    V${adjustedHeight - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${adjustedHeight - BORDER_WIDTH} ${width - innerRadius - BORDER_WIDTH},${adjustedHeight - BORDER_WIDTH} 
    H${innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${adjustedHeight - BORDER_WIDTH} ${BORDER_WIDTH},${adjustedHeight - innerRadius - BORDER_WIDTH} 
    V${ARROW_HEIGHT + innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH} ${innerRadius + BORDER_WIDTH},${ARROW_HEIGHT + BORDER_WIDTH}
  `;

  return /* html */ `
    <svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <path d="${outerPath}" class="navi_callout_border" />
      <path d="${innerPath}" class="navi_callout_background" />
    </svg>`;
};

/**
 * Generates SVG path for callout with arrow on bottom
 * @param {number} width - Callout width
 * @param {number} height - Callout height
 * @param {number} arrowPosition - Horizontal position of arrow
 * @returns {string} - SVG markup
 */
const generateSvgWithBottomArrow = (width, height, arrowPosition) => {
  // Calculate valid arrow position range
  const arrowLeft =
    ARROW_WIDTH / 2 + CORNER_RADIUS + BORDER_WIDTH + ARROW_SPACING;
  const minArrowPos = arrowLeft;
  const maxArrowPos = width - arrowLeft;
  const constrainedArrowPos = Math.max(
    minArrowPos,
    Math.min(arrowPosition, maxArrowPos),
  );

  // Calculate content height
  const contentHeight = height - ARROW_HEIGHT;

  // Create two paths: one for the border (outer) and one for the content (inner)
  const adjustedWidth = width;
  const adjustedHeight = contentHeight + ARROW_HEIGHT;

  // For small border widths, keep inner arrow nearly the same size as outer
  const innerArrowWidthReduction = Math.min(BORDER_WIDTH * 0.3, 1);

  // Outer path with rounded corners
  const outerPath = `
      M${CORNER_RADIUS},0 
      H${width - CORNER_RADIUS} 
      Q${width},0 ${width},${CORNER_RADIUS} 
      V${contentHeight - CORNER_RADIUS} 
      Q${width},${contentHeight} ${width - CORNER_RADIUS},${contentHeight} 
      H${constrainedArrowPos + ARROW_WIDTH / 2} 
      L${constrainedArrowPos},${adjustedHeight} 
      L${constrainedArrowPos - ARROW_WIDTH / 2},${contentHeight} 
      H${CORNER_RADIUS} 
      Q0,${contentHeight} 0,${contentHeight - CORNER_RADIUS} 
      V${CORNER_RADIUS} 
      Q0,0 ${CORNER_RADIUS},0
    `;

  // Inner path with correct arrow direction and color
  const innerRadius = Math.max(0, CORNER_RADIUS - BORDER_WIDTH);
  const innerPath = `
    M${innerRadius + BORDER_WIDTH},${BORDER_WIDTH} 
    H${width - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${BORDER_WIDTH} ${width - BORDER_WIDTH},${innerRadius + BORDER_WIDTH} 
    V${contentHeight - innerRadius - BORDER_WIDTH} 
    Q${width - BORDER_WIDTH},${contentHeight - BORDER_WIDTH} ${width - innerRadius - BORDER_WIDTH},${contentHeight - BORDER_WIDTH} 
    H${constrainedArrowPos + ARROW_WIDTH / 2 - innerArrowWidthReduction} 
    L${constrainedArrowPos},${adjustedHeight - BORDER_WIDTH} 
    L${constrainedArrowPos - ARROW_WIDTH / 2 + innerArrowWidthReduction},${contentHeight - BORDER_WIDTH} 
    H${innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${contentHeight - BORDER_WIDTH} ${BORDER_WIDTH},${contentHeight - innerRadius - BORDER_WIDTH} 
    V${innerRadius + BORDER_WIDTH} 
    Q${BORDER_WIDTH},${BORDER_WIDTH} ${innerRadius + BORDER_WIDTH},${BORDER_WIDTH}
  `;

  return /* html */ `
    <svg
      width="${adjustedWidth}"
      height="${adjustedHeight}"
      viewBox="0 0 ${adjustedWidth} ${adjustedHeight}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <path d="${outerPath}" class="navi_callout_border" />
      <path d="${innerPath}" class="navi_callout_background" />
    </svg>`;
};

/**
 * Generates SVG path for callout without arrow (simple rectangle)
 * @param {number} width - Callout width
 * @param {number} height - Callout height
 * @returns {string} - SVG markup
 */
const generateSvgWithoutArrow = (width, height) => {
  return /* html */ `
    <svg
      width="${width}"
      height="${height}"
      viewBox="0 0 ${width} ${height}"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="presentation"
      aria-hidden="true"
    >
      <rect
        class="navi_callout_border"
        x="0"
        y="0"
        width="${width}"
        height="${height}"
        rx="${CORNER_RADIUS}"
        ry="${CORNER_RADIUS}"
      />
      <rect
        class="navi_callout_background"
        x="${BORDER_WIDTH}"
        y="${BORDER_WIDTH}"
        width="${width - BORDER_WIDTH * 2}"
        height="${height - BORDER_WIDTH * 2}"
        rx="${Math.max(0, CORNER_RADIUS - BORDER_WIDTH)}"
        ry="${Math.max(0, CORNER_RADIUS - BORDER_WIDTH)}"
      />
    </svg>`;
};

/**
 * Creates a live mirror of a source DOM element that automatically stays in sync.
 *
 * The mirror is implemented as a custom element (`<navi-mirror>`) that:
 * - Copies the source element's content (innerHTML) and attributes
 * - Automatically updates when the source element changes
 * - Efficiently manages observers based on DOM presence (starts observing when
 *   added to DOM, stops when removed)
 * - Excludes the 'id' attribute to avoid conflicts
 *
 * @param {Element} sourceElement - The DOM element to mirror. Any changes to this
 *   element's content, attributes, or structure will be automatically reflected
 *   in the returned mirror element.
 *
 * @returns {NaviMirror} A custom element that mirrors the source element. Can be
 *   inserted into the DOM like any other element. The mirror will automatically
 *   start/stop observing the source based on its DOM presence.
 */
const createNaviMirror = (sourceElement) => {
  const naviMirror = new NaviMirror(sourceElement);
  return naviMirror;
};

// Custom element that mirrors another element's content
class NaviMirror extends HTMLElement {
  constructor(sourceElement) {
    super();
    this.sourceElement = null;
    this.sourceObserver = null;
    this.setSourceElement(sourceElement);
  }

  setSourceElement(sourceElement) {
    this.sourceElement = sourceElement;
    this.updateFromSource();
  }

  updateFromSource() {
    if (!this.sourceElement) return;

    this.innerHTML = this.sourceElement.innerHTML;
    // Copy attributes from source (except id to avoid conflicts)
    for (const attr of Array.from(this.sourceElement.attributes)) {
      if (attr.name !== "id") {
        this.setAttribute(attr.name, attr.value);
      }
    }
  }

  startObserving() {
    if (this.sourceObserver || !this.sourceElement) return;
    this.sourceObserver = new MutationObserver(() => {
      this.updateFromSource();
    });
    this.sourceObserver.observe(this.sourceElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });
  }

  stopObserving() {
    if (this.sourceObserver) {
      this.sourceObserver.disconnect();
      this.sourceObserver = null;
    }
  }

  // Called when element is added to DOM
  connectedCallback() {
    this.startObserving();
  }

  // Called when element is removed from DOM
  disconnectedCallback() {
    this.stopObserving();
  }
}

// Register the custom element if not already registered
if (!customElements.get("navi-mirror")) {
  customElements.define("navi-mirror", NaviMirror);
}

const getMessageFromAttribute = (
  originalElement,
  attributeName,
  generatedMessage,
) => {
  const selectorAttributeName = `${attributeName}-selector`;
  const eventAttributeName = `${attributeName}-event`;
  const resolutionSteps = [
    {
      description: "original element",
      element: originalElement,
    },
    {
      description: "closest fieldset",
      element: originalElement.closest("fieldset"),
    },
    {
      description: "closest form",
      element: originalElement.closest("form"),
    },
  ];
  // Sub-steps for each element (in order of priority)
  const subSteps = ["event", "selector", "message"];
  let currentStepIndex = 0;
  let currentSubStepIndex = 0;
  const resolve = () => {
    while (currentStepIndex < resolutionSteps.length) {
      const { element } = resolutionSteps[currentStepIndex];
      if (element) {
        while (currentSubStepIndex < subSteps.length) {
          const subStep = subSteps[currentSubStepIndex];
          currentSubStepIndex++;
          if (subStep === "event") {
            const eventAttribute = element.getAttribute(eventAttributeName);
            if (eventAttribute) {
              return createEventHandler(element, eventAttribute);
            }
          }
          if (subStep === "selector") {
            const selectorAttribute = element.getAttribute(
              selectorAttributeName,
            );
            if (selectorAttribute) {
              return fromSelectorAttribute(selectorAttribute);
            }
          }
          if (subStep === "message") {
            const messageAttribute = element.getAttribute(attributeName);
            if (messageAttribute) {
              return messageAttribute;
            }
          }
        }
      }
      currentStepIndex++;
      currentSubStepIndex = 0;
    }
    return generatedMessage;
  };

  const createEventHandler = (element, eventName) => {
    return ({ renderIntoCallout }) => {
      element.dispatchEvent(
        new CustomEvent(eventName, {
          detail: {
            render: (message) => {
              if (message) {
                renderIntoCallout(message);
              } else {
                // Resume resolution from next step
                const nextResult = resolve();
                renderIntoCallout(nextResult);
              }
            },
          },
        }),
      );
    };
  };

  return resolve();
};

// Helper function to resolve messages that might be CSS selectors
const fromSelectorAttribute = (messageAttributeValue) => {
  // It's a CSS selector, find the DOM element
  const messageSourceElement = document.querySelector(messageAttributeValue);
  if (!messageSourceElement) {
    console.warn(
      `Message selector "${messageAttributeValue}" not found in DOM`,
    );
    return null; // Fallback to the generic message
  }
  const mirror = createNaviMirror(messageSourceElement);
  mirror.setAttribute("data-source-selector", messageAttributeValue);
  return mirror;
};

const generateFieldInvalidMessage = (template, { field }) => {
  return replaceStringVars(template, {
    "{field}": () => generateThisFieldText(field),
  });
};

const generateThisFieldText = (field) => {
  if (field.type === "password") {
    return "Ce mot de passe";
  }
  if (field.type === "email") {
    return "Cette adresse e-mail";
  }
  if (field.type === "checkbox") {
    return "Cette case";
  }
  if (field.type === "radio") {
    return "Cette option";
  }
  return "Ce champ";
};

const replaceStringVars = (string, replacers) => {
  return string.replace(/(\{\w+\})/g, (match, name) => {
    const replacer = replacers[name];
    if (replacer === undefined) {
      return match;
    }
    if (typeof replacer === "function") {
      return replacer();
    }
    return replacer;
  });
};

const MIN_LOWER_LETTER_CONSTRAINT = {
  name: "min_lower_letter",
  messageAttribute: "data-min-lower-letter-message",
  check: (field) => {
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return "";
    }
    const minAttribute = field.getAttribute("data-min-lower-letter");
    if (!minAttribute) {
      return "";
    }
    const min = parseInt(minAttribute, 10);
    let numberOfLowercaseChars = 0;
    for (const char of fieldValue) {
      if (char >= "a" && char <= "z") {
        numberOfLowercaseChars++;
      }
    }
    if (numberOfLowercaseChars < min) {
      if (min === 0) {
        return generateFieldInvalidMessage(
          `{field} doit contenir au moins une lettre minuscule.`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} contenir au moins ${min} lettres minuscules.`,
        { field },
      );
    }
    return "";
  },
};
const MIN_UPPER_LETTER_CONSTRAINT = {
  name: "min_upper_letter",
  messageAttribute: "data-min-upper-letter-message",
  check: (field) => {
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return "";
    }
    const minAttribute = field.getAttribute("data-min-upper-letter");
    if (!minAttribute) {
      return "";
    }
    const min = parseInt(minAttribute, 10);
    let numberOfUppercaseChars = 0;
    for (const char of fieldValue) {
      if (char >= "A" && char <= "Z") {
        numberOfUppercaseChars++;
      }
    }
    if (numberOfUppercaseChars < min) {
      if (min === 0) {
        return generateFieldInvalidMessage(
          `{field} doit contenir au moins une lettre majuscule.`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} contenir au moins ${min} lettres majuscules.`,
        { field },
      );
    }
    return "";
  },
};
const MIN_DIGIT_CONSTRAINT = {
  name: "min_digit",
  messageAttribute: "data-min-digit-message",
  check: (field) => {
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return "";
    }
    const minAttribute = field.getAttribute("data-min-digit");
    if (!minAttribute) {
      return "";
    }
    const min = parseInt(minAttribute, 10);
    let numberOfDigitChars = 0;
    for (const char of fieldValue) {
      if (char >= "0" && char <= "9") {
        numberOfDigitChars++;
      }
    }
    if (numberOfDigitChars < min) {
      if (min === 0) {
        return generateFieldInvalidMessage(
          `{field} doit contenir au moins un chiffre.`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} doit contenir au moins ${min} chiffres.`,
        { field },
      );
    }
    return "";
  },
};
const MIN_SPECIAL_CHAR_CONSTRAINT = {
  name: "min_special_char",
  messageAttribute: "data-min-special-char-message",
  check: (field) => {
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return "";
    }
    const minSpecialChars = field.getAttribute("data-min-special-char");
    if (!minSpecialChars) {
      return "";
    }
    const min = parseInt(minSpecialChars, 10);
    const specialCharset = field.getAttribute("data-special-charset");
    if (!specialCharset) {
      return "L'attribut data-special-charset doit être défini pour utiliser data-min-special-char.";
    }

    let numberOfSpecialChars = 0;
    for (const char of fieldValue) {
      if (specialCharset.includes(char)) {
        numberOfSpecialChars++;
      }
    }
    if (numberOfSpecialChars < min) {
      if (min === 1) {
        return generateFieldInvalidMessage(
          `{field} doit contenir au moins un caractère spécial. (${specialCharset})`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} doit contenir au moins ${min} caractères spéciaux (${specialCharset})`,
        { field },
      );
    }
    return "";
  },
};

const READONLY_CONSTRAINT = {
  name: "readonly",
  messageAttribute: "data-readonly-message",
  check: (field, { skipReadonly }) => {
    if (skipReadonly) {
      return null;
    }
    if (!field.readonly && !field.hasAttribute("data-readonly")) {
      return null;
    }
    if (field.type === "hidden") {
      return null;
    }
    const isButton = field.tagName === "BUTTON";
    const isBusy = field.getAttribute("aria-busy") === "true";
    const readonlySilent = field.hasAttribute("data-readonly-silent");
    if (readonlySilent) {
      return { silent: true };
    }
    if (isBusy) {
      return {
        target: field,
        message: `Cette action est en cours. Veuillez patienter.`,
        status: "info",
      };
    }
    return {
      target: field,
      message: isButton
        ? `Cet action n'est pas disponible pour l'instant.`
        : `Cet élément est en lecture seule et ne peut pas être modifié.`,
      status: "info",
    };
  },
};

const SAME_AS_CONSTRAINT = {
  name: "same_as",
  messageAttribute: "data-same-as-message",
  check: (field) => {
    const sameAs = field.getAttribute("data-same-as");
    if (!sameAs) {
      return null;
    }
    const otherField = document.querySelector(sameAs);
    if (!otherField) {
      console.warn(
        `Same as constraint: could not find element for selector ${sameAs}`,
      );
      return null;
    }
    const fieldValue = field.value;
    if (!fieldValue && !field.required) {
      return null;
    }
    const otherFieldValue = otherField.value;
    if (!otherFieldValue && !otherField.required) {
      // don't validate if one of the two values is empty
      return null;
    }
    if (fieldValue === otherFieldValue) {
      return null;
    }
    const type = field.type;
    if (type === "password") {
      return `Ce mot de passe doit être identique au précédent.`;
    }
    if (type === "email") {
      return `Cette adresse e-mail doit être identique a la précédente.`;
    }
    return `Ce champ doit être identique au précédent.`;
  },
};

const SINGLE_SPACE_CONSTRAINT = {
  name: "single_space",
  messageAttribute: "data-single-space-message",
  check: (field) => {
    const singleSpace = field.hasAttribute("data-single-space");
    if (!singleSpace) {
      return null;
    }
    const fieldValue = field.value;
    const hasLeadingSpace = fieldValue.startsWith(" ");
    const hasTrailingSpace = fieldValue.endsWith(" ");
    const hasDoubleSpace = fieldValue.includes("  ");
    if (hasLeadingSpace || hasDoubleSpace || hasTrailingSpace) {
      if (hasLeadingSpace) {
        return generateFieldInvalidMessage(
          `{field} ne doit pas commencer par un espace.`,
          { field },
        );
      }
      if (hasTrailingSpace) {
        return generateFieldInvalidMessage(
          `{field} ne doit pas finir par un espace.`,
          { field },
        );
      }
      return generateFieldInvalidMessage(
        `{field} ne doit pas contenir plusieurs espaces consécutifs.`,
        { field },
      );
    }
    return "";
  },
};

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */


// this constraint is not really a native constraint and browser just not let this happen at all
// in our case it's just here in case some code is wrongly calling "requestAction" or "checkValidity" on a disabled element
const DISABLED_CONSTRAINT = {
  name: "disabled",
  messageAttribute: "data-disabled-message",
  check: (field) => {
    if (field.disabled) {
      return generateFieldInvalidMessage(`{field} est désactivé.`, { field });
    }
    return null;
  },
};

const REQUIRED_CONSTRAINT = {
  name: "required",
  messageAttribute: "data-required-message",
  check: (field, { registerChange }) => {
    if (!field.required) {
      return null;
    }

    if (field.type === "checkbox") {
      if (!field.checked) {
        return `Veuillez cocher cette case.`;
      }
      return null;
    }
    if (field.type === "radio") {
      // For radio buttons, check if any radio with the same name is selected
      const name = field.name;
      if (!name) {
        // If no name, check just this radio
        if (!field.checked) {
          return `Veuillez sélectionner une option.`;
        }
        return null;
      }

      const closestFieldset = field.closest("fieldset");
      // Find the container (form or closest fieldset)
      const container = field.form || closestFieldset || document;
      // Check if any radio with the same name is checked
      const radioSelector = `input[type="radio"][name="${CSS.escape(name)}"]`;
      const radiosWithSameName = container.querySelectorAll(radioSelector);
      for (const radio of radiosWithSameName) {
        if (radio.checked) {
          return null; // At least one radio is selected
        }
        registerChange((onChange) => {
          radio.addEventListener("change", onChange);
          return () => {
            radio.removeEventListener("change", onChange);
          };
        });
      }

      return {
        message: `Veuillez sélectionner une option.`,
        target: closestFieldset
          ? closestFieldset.querySelector("legend")
          : undefined,
      };
    }
    if (field.value) {
      return null;
    }
    if (field.type === "password") {
      return field.hasAttribute("data-same-as")
        ? `Veuillez confirmer le mot de passe.`
        : `Veuillez saisir un mot de passe.`;
    }
    if (field.type === "email") {
      return field.hasAttribute("data-same-as")
        ? `Veuillez confirmer l'adresse e-mail`
        : `Veuillez saisir une adresse e-mail.`;
    }
    return field.hasAttribute("data-same-as")
      ? `Veuillez confirmer le champ précédent`
      : `Veuillez remplir ce champ.`;
  },
};

const PATTERN_CONSTRAINT = {
  name: "pattern",
  messageAttribute: "data-pattern-message",
  check: (field) => {
    const pattern = field.pattern;
    if (!pattern) {
      return null;
    }
    const value = field.value;
    if (!value && !field.required) {
      return null;
    }
    const regex = new RegExp(pattern);
    if (regex.test(value)) {
      return null;
    }
    let message = generateFieldInvalidMessage(
      `{field} ne correspond pas au format requis.`,
      { field },
    );
    const title = field.title;
    if (title) {
      message += `<br />${title}`;
    }
    return message;
  },
};
// https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/email#validation
const emailregex =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
const TYPE_EMAIL_CONSTRAINT = {
  name: "type_email",
  messageAttribute: "data-type-message",
  check: (field) => {
    if (field.type !== "email") {
      return null;
    }
    const value = field.value;
    if (!value && !field.required) {
      return null;
    }
    if (!value.includes("@")) {
      return `Veuillez inclure "@" dans l'adresse e-mail. Il manque un symbole "@" dans ${value}.`;
    }
    if (!emailregex.test(value)) {
      return `Veuillez saisir une adresse e-mail valide.`;
    }
    return null;
  },
};

const MIN_LENGTH_CONSTRAINT = {
  name: "min_length",
  messageAttribute: "data-min-length-message",
  check: (field) => {
    if (field.tagName === "INPUT") {
      if (!INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET.has(field.type)) {
        return null;
      }
    } else if (field.tagName !== "TEXTAREA") {
      return null;
    }

    const minLength = field.minLength;
    if (minLength === -1) {
      return null;
    }
    const value = field.value;
    if (!value && !field.required) {
      return null;
    }
    const valueLength = value.length;
    if (valueLength >= minLength) {
      return null;
    }
    if (valueLength === 1) {
      return generateFieldInvalidMessage(
        `{field} doit contenir au moins ${minLength} caractère (il contient actuellement un seul caractère).`,
        { field },
      );
    }
    return generateFieldInvalidMessage(
      `{field} doit contenir au moins ${minLength} caractères (il contient actuellement ${valueLength} caractères).`,
      { field },
    );
  },
};
const INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET = new Set([
  "text",
  "search",
  "url",
  "tel",
  "email",
  "password",
]);

const MAX_LENGTH_CONSTRAINT = {
  name: "max_length",
  messageAttribute: "data-max-length-message",
  check: (field) => {
    if (field.tagName === "INPUT") {
      if (!INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET.has(field.type)) {
        return null;
      }
    } else if (field.tagName !== "TEXTAREA") {
      return null;
    }
    const maxLength = field.maxLength;
    if (maxLength === -1) {
      return null;
    }
    const value = field.value;
    const valueLength = value.length;
    if (valueLength <= maxLength) {
      return null;
    }
    return generateFieldInvalidMessage(
      `{field} doit contenir au maximum ${maxLength} caractères (il contient actuellement ${valueLength} caractères).`,
      { field },
    );
  },
};
const INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET = new Set(
  INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET,
);

const TYPE_NUMBER_CONSTRAINT = {
  name: "type_number",
  messageAttribute: "data-type-message",
  check: (field) => {
    if (field.tagName !== "INPUT") {
      return null;
    }
    if (field.type !== "number") {
      return null;
    }
    if (field.validity.valueMissing) {
      // let required handle that
      return null;
    }
    const valueAsNumber = field.valueAsNumber;
    const valueAsNumberIsNaN = isNaN(valueAsNumber);
    if (valueAsNumberIsNaN) {
      return generateFieldInvalidMessage(`{field} doit être un nombre.`, {
        field,
      });
    }
    return null;
  },
};

const MIN_CONSTRAINT = {
  name: "min",
  messageAttribute: "data-min-message",
  check: (field) => {
    if (field.tagName !== "INPUT") {
      return null;
    }
    if (field.type === "number") {
      const minString = field.min;
      if (minString === "") {
        return null;
      }
      const minNumber = parseFloat(minString);
      if (isNaN(minNumber)) {
        return null;
      }
      const valueAsNumber = field.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber < minNumber) {
        return generateFieldInvalidMessage(
          `{field} doit être supérieur ou égal à <strong>${minString}</strong>.`,
          { field },
        );
      }
      return null;
    }
    if (field.type === "time") {
      const min = field.min;
      if (min === undefined) {
        return null;
      }
      const [minHours, minMinutes] = min.split(":").map(Number);
      const value = field.value;
      const [hours, minutes] = value.split(":").map(Number);
      if (hours < minHours || (hours === minHours && minMinutes < minutes)) {
        return generateFieldInvalidMessage(
          `{field} doit être <strong>${min}</strong> ou plus.`,
          { field },
        );
      }
      return null;
    }
    // "range"
    // - user interface do not let user enter anything outside the boundaries
    // - when setting value via js browser enforce boundaries too
    // "date", "month", "week", "datetime-local"
    // - same as "range"
    return null;
  },
};

const MAX_CONSTRAINT = {
  name: "max",
  messageAttribute: "data-max-message",
  check: (field) => {
    if (field.tagName !== "INPUT") {
      return null;
    }
    if (field.type === "number") {
      const maxAttribute = field.max;
      if (maxAttribute === "") {
        return null;
      }
      const maxNumber = parseFloat(maxAttribute);
      if (isNaN(maxNumber)) {
        return null;
      }
      const valueAsNumber = field.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber > maxNumber) {
        return generateFieldInvalidMessage(
          `{field} doit être <strong>${maxAttribute}</strong> ou moins.`,
          { field },
        );
      }
      return null;
    }
    if (field.type === "time") {
      const max = field.max;
      if (max === undefined) {
        return null;
      }
      const [maxHours, maxMinutes] = max.split(":").map(Number);
      const value = field.value;
      const [hours, minutes] = value.split(":").map(Number);
      if (hours > maxHours || (hours === maxHours && maxMinutes > minutes)) {
        return generateFieldInvalidMessage(
          `{field} doit être <strong>${max}</strong> ou moins.`,
          { field },
        );
      }
      return null;
    }
    return null;
  },
};

const listenInputChange = (input, callback) => {
  const [teardown, addTeardown] = createPubSub();

  let valueAtInteraction;
  const oninput = () => {
    valueAtInteraction = undefined;
  };
  const onkeydown = (e) => {
    if (e.key === "Enter") {
      /**
       * Browser trigger a "change" event right after the enter is pressed
       * if the input value has changed.
       * We need to prevent the next change event otherwise we would request action twice
       */
      valueAtInteraction = input.value;
    }
    if (e.key === "Escape") {
      /**
       * Browser trigger a "change" event right after the escape is pressed
       * if the input value has changed.
       * We need to prevent the next change event otherwise we would request action when
       * we actually want to cancel
       */
      valueAtInteraction = input.value;
    }
  };
  const onchange = (e) => {
    if (
      valueAtInteraction !== undefined &&
      e.target.value === valueAtInteraction
    ) {
      valueAtInteraction = undefined;
      return;
    }
    callback(e);
  };
  input.addEventListener("input", oninput);
  input.addEventListener("keydown", onkeydown);
  input.addEventListener("change", onchange);
  addTeardown(() => {
    input.removeEventListener("input", oninput);
    input.removeEventListener("keydown", onkeydown);
    input.removeEventListener("change", onchange);
  });

  {
    // Handle programmatic value changes that don't trigger browser change events
    //
    // Problem: When input values are set programmatically (not by user typing),
    // browsers don't fire the 'change' event. However, our application logic
    // still needs to detect these changes.
    //
    // Example scenario:
    // 1. User starts editing (letter key pressed, value set programmatically)
    // 2. User doesn't type anything additional (this is the key part)
    // 3. User clicks outside to finish editing
    // 4. Without this code, no change event would fire despite the fact that the input value did change from its original state
    //
    // This distinction is crucial because:
    //
    // - If the user typed additional text after the initial programmatic value,
    //   the browser would fire change events normally
    // - But when they don't type anything else, the browser considers it as "no user interaction"
    //   even though the programmatic initial value represents a meaningful change
    //
    // We achieve this by checking if the input value has changed between focus and blur without any user interaction
    // if yes we fire the callback because input value did change
    let valueAtStart = input.value;
    let interacted = false;

    const onfocus = () => {
      interacted = false;
      valueAtStart = input.value;
    };
    const oninput = (e) => {
      if (!e.isTrusted) {
        // non trusted "input" events will be ignored by the browser when deciding to fire "change" event
        // we ignore them too
        return;
      }
      interacted = true;
    };
    const onblur = (e) => {
      if (interacted) {
        return;
      }
      if (valueAtStart === input.value) {
        return;
      }
      callback(e);
    };

    input.addEventListener("focus", onfocus);
    input.addEventListener("input", oninput);
    input.addEventListener("blur", onblur);
    addTeardown(() => {
      input.removeEventListener("focus", onfocus);
      input.removeEventListener("input", oninput);
      input.removeEventListener("blur", onblur);
    });
  }

  return teardown;
};

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
 * Features:
 * - Constraint-based validation system with built-in and custom constraints
 * - Custom validation messages with different severity levels
 * - Form submission prevention on validation failure
 * - Validation on Enter key in forms or standalone inputs
 * - Escape key to dismiss validation messages
 * - Support for standard HTML validation attributes (required, pattern, type="email")
 * - Validation messages that follow the input element and adapt to viewport
 *
 * Constraint evaluation behavior:
 * This implementation differs from browser native validation in how it handles empty values.
 * Native validation typically ignores constraints (like minLength) when the input is empty,
 * only validating them once the user starts typing. This prevents developers from knowing
 * the validation state until user interaction begins.
 *
 * Our approach:
 * - When 'required' attribute is not set: behaves like native validation (ignores constraints on empty values)
 * - When 'required' attribute is set: evaluates all constraints even on empty values
 *
 * This allows for complete constraint state visibility when fields are required, enabling
 * better UX patterns like showing all validation requirements upfront.
 */

const NAVI_VALIDITY_CHANGE_CUSTOM_EVENT = "navi_validity_change";

const STANDARD_CONSTRAINT_SET = new Set([
  DISABLED_CONSTRAINT,
  REQUIRED_CONSTRAINT,
  PATTERN_CONSTRAINT,
  TYPE_EMAIL_CONSTRAINT,
  TYPE_NUMBER_CONSTRAINT,
  MIN_LENGTH_CONSTRAINT,
  MAX_LENGTH_CONSTRAINT,
  MIN_CONSTRAINT,
  MAX_CONSTRAINT,
]);
const NAVI_CONSTRAINT_SET = new Set([
  // the order matters here, the last constraint is picked first when multiple constraints fail
  // so it's better to keep the most complex constraints at the beginning of the list
  // so the more basic ones shows up first
  MIN_SPECIAL_CHAR_CONSTRAINT,
  SINGLE_SPACE_CONSTRAINT,
  MIN_DIGIT_CONSTRAINT,
  MIN_UPPER_LETTER_CONSTRAINT,
  MIN_LOWER_LETTER_CONSTRAINT,
  SAME_AS_CONSTRAINT,
  READONLY_CONSTRAINT,
]);
const DEFAULT_CONSTRAINT_SET = new Set([
  ...STANDARD_CONSTRAINT_SET,
  ...NAVI_CONSTRAINT_SET,
]);

const validationInProgressWeakSet = new WeakSet();

const requestAction = (
  target,
  action,
  {
    actionOrigin,
    event,
    requester = target,
    method = "rerun",
    meta = {},
    confirmMessage,
  } = {},
) => {
  if (!actionOrigin) {
    console.warn("requestAction: actionOrigin is required");
  }
  let elementToValidate = requester;

  let validationInterface = elementToValidate.__validationInterface__;
  if (!validationInterface) {
    validationInterface = installCustomConstraintValidation(elementToValidate);
  }

  const customEventDetail = {
    action,
    actionOrigin,
    method,
    event,
    requester,
    meta,
  };

  // Determine what needs to be validated and how to handle the result
  const isForm = elementToValidate.tagName === "FORM";
  const formToValidate = isForm ? elementToValidate : elementToValidate.form;

  let isValid = false;
  let elementForConfirmation = elementToValidate;
  let elementForDispatch = elementToValidate;

  if (formToValidate) {
    // Form validation case
    if (validationInProgressWeakSet.has(formToValidate)) {
      return false;
    }
    validationInProgressWeakSet.add(formToValidate);
    setTimeout(() => {
      validationInProgressWeakSet.delete(formToValidate);
    });

    // Validate all form elements
    const formElements = formToValidate.elements;
    isValid = true; // Assume valid until proven otherwise
    for (const formElement of formElements) {
      const elementValidationInterface = formElement.__validationInterface__;
      if (!elementValidationInterface) {
        continue;
      }

      const elementIsValid = elementValidationInterface.checkValidity({
        fromRequestAction: true,
        skipReadonly:
          formElement.tagName === "BUTTON" && formElement !== requester,
      });
      if (!elementIsValid) {
        elementValidationInterface.reportValidity();
        isValid = false;
        break;
      }
    }

    elementForConfirmation = formToValidate;
    elementForDispatch = target;
  } else {
    // Single element validation case
    isValid = validationInterface.checkValidity({ fromRequestAction: true });
    if (!isValid) {
      validationInterface.reportValidity();
    }
    elementForConfirmation = target;
    elementForDispatch = target;
  }

  // If validation failed, dispatch actionprevented and return
  if (!isValid) {
    const actionPreventedCustomEvent = new CustomEvent("actionprevented", {
      detail: customEventDetail,
    });
    elementForDispatch.dispatchEvent(actionPreventedCustomEvent);
    return false;
  }

  // Validation passed, check for confirmation
  confirmMessage =
    confirmMessage ||
    elementForConfirmation.getAttribute("data-confirm-message");
  if (confirmMessage) {
    // eslint-disable-next-line no-alert
    if (!window.confirm(confirmMessage)) {
      const actionPreventedCustomEvent = new CustomEvent("actionprevented", {
        detail: customEventDetail,
      });
      elementForDispatch.dispatchEvent(actionPreventedCustomEvent);
      return false;
    }
  }

  // All good, dispatch the action
  const actionCustomEvent = new CustomEvent("action", {
    detail: customEventDetail,
  });
  elementForDispatch.dispatchEvent(actionCustomEvent);
  return true;
};

const forwardActionRequested = (e, action, target = e.target) => {
  requestAction(target, action, {
    actionOrigin: e.detail?.actionOrigin,
    event: e.detail?.event || e,
    requester: e.detail?.requester,
    meta: e.detail?.meta,
  });
};

const closeValidationMessage = (element, reason) => {
  const validationInterface = element.__validationInterface__;
  if (!validationInterface) {
    return false;
  }
  const { validationMessage } = validationInterface;
  if (!validationMessage) {
    return false;
  }
  return validationMessage.close(reason);
};

const formInstrumentedWeakSet = new WeakSet();
const installCustomConstraintValidation = (
  element,
  elementReceivingValidationMessage = element,
) => {
  if (element.tagName === "INPUT" && element.type === "hidden") {
    elementReceivingValidationMessage = element.form || document.body;
  }

  const validationInterface = {
    uninstall: undefined,
    registerConstraint: undefined,
    addCustomMessage: undefined,
    removeCustomMessage: undefined,
    checkValidity: undefined,
    reportValidity: undefined,
    validationMessage: null,
  };

  const [teardown, addTeardown] = createPubSub();
  {
    const uninstall = () => {
      teardown();
    };
    validationInterface.uninstall = uninstall;
  }

  const isForm = element.tagName === "FORM";
  if (isForm) {
    formInstrumentedWeakSet.add(element);
    addTeardown(() => {
      formInstrumentedWeakSet.delete(element);
    });
  }

  {
    element.__validationInterface__ = validationInterface;
    addTeardown(() => {
      delete element.__validationInterface__;
    });
  }

  const dispatchCancelCustomEvent = (options) => {
    const cancelEvent = new CustomEvent("cancel", options);
    element.dispatchEvent(cancelEvent);
  };
  const closeElementValidationMessage = (reason) => {
    if (validationInterface.validationMessage) {
      validationInterface.validationMessage.close(reason);
      return true;
    }
    return false;
  };

  const constraintSet = new Set(DEFAULT_CONSTRAINT_SET);

  {
    validationInterface.registerConstraint = (constraint) => {
      if (typeof constraint === "function") {
        constraint = {
          name: constraint.name || "custom_function",
          check: constraint,
        };
      }
      constraintSet.add(constraint);
      return () => {
        constraintSet.delete(constraint);
      };
    };
  }

  let failedConstraintInfo = null;
  const validityInfoMap = new Map();
  const hasTitleAttribute = element.hasAttribute("title");

  let constraintValidityState = { valid: true };
  const getConstraintValidityState = () => constraintValidityState;
  validationInterface.getConstraintValidityState = getConstraintValidityState;

  const resetValidity = ({ fromRequestAction } = {}) => {
    if (fromRequestAction && failedConstraintInfo) {
      for (const [key, customMessage] of customMessageMap) {
        if (customMessage.removeOnRequestAction) {
          customMessageMap.delete(key);
        }
      }
    }
    for (const [, validityInfo] of validityInfoMap) {
      if (validityInfo.cleanup) {
        validityInfo.cleanup();
      }
    }
    validityInfoMap.clear();
    failedConstraintInfo = null;
  };
  addTeardown(resetValidity);

  const checkValidity = ({ fromRequestAction, skipReadonly } = {}) => {
    let newConstraintValidityState = { valid: true };

    resetValidity({ fromRequestAction });
    for (const constraint of constraintSet) {
      const constraintCleanupSet = new Set();
      const registerChange = (register) => {
        const registerResult = register(() => {
          checkValidity();
        });
        if (typeof registerResult === "function") {
          constraintCleanupSet.add(registerResult);
        }
      };
      const cleanup = () => {
        for (const cleanupCallback of constraintCleanupSet) {
          cleanupCallback();
        }
        constraintCleanupSet.clear();
      };

      const checkResult = constraint.check(element, {
        fromRequestAction,
        skipReadonly,
        registerChange,
      });
      if (!checkResult) {
        cleanup();
        newConstraintValidityState[constraint.name] = null;
        continue;
      }
      const constraintValidityInfo =
        typeof checkResult === "string"
          ? { message: checkResult }
          : checkResult;
      constraintValidityInfo.messageString = constraintValidityInfo.message;

      if (constraint.messageAttribute) {
        const messageFromAttribute = getMessageFromAttribute(
          element,
          constraint.messageAttribute,
          constraintValidityInfo.message,
        );
        if (messageFromAttribute !== constraintValidityInfo.message) {
          constraintValidityInfo.message = messageFromAttribute;
          if (typeof messageFromAttribute === "string") {
            constraintValidityInfo.messageString = messageFromAttribute;
          }
        }
      }
      const thisConstraintFailureInfo = {
        name: constraint.name,
        constraint,
        status: "warning",
        ...constraintValidityInfo,
        cleanup,
        reportStatus: "not_reported",
      };
      validityInfoMap.set(constraint, thisConstraintFailureInfo);
      newConstraintValidityState.valid = false;
      newConstraintValidityState[constraint.name] = thisConstraintFailureInfo;

      // Constraint evaluation: evaluate all constraints when required is set,
      // otherwise follow native behavior (skip constraints on empty values)
      if (failedConstraintInfo) {
        // there is already a failing constraint, which one to we pick?
        const constraintPicked = pickConstraint(
          failedConstraintInfo.constraint,
          constraint,
        );
        if (constraintPicked === constraint) {
          failedConstraintInfo = thisConstraintFailureInfo;
        }
      } else {
        // first failing constraint
        failedConstraintInfo = thisConstraintFailureInfo;
      }
    }

    if (failedConstraintInfo && !failedConstraintInfo.silent) {
      if (!hasTitleAttribute) {
        // when a constraint is failing browser displays that constraint message if the element has no title attribute.
        // We want to do the same with our message (overriding the browser in the process to get better messages)
        element.setAttribute("title", failedConstraintInfo.messageString);
      }
    } else {
      if (!hasTitleAttribute) {
        element.removeAttribute("title");
      }
      closeElementValidationMessage("becomes_valid");
    }

    if (
      !compareTwoJsValues(constraintValidityState, newConstraintValidityState)
    ) {
      constraintValidityState = newConstraintValidityState;
      element.dispatchEvent(new CustomEvent(NAVI_VALIDITY_CHANGE_CUSTOM_EVENT));
    }
    return newConstraintValidityState.valid;
  };
  const reportValidity = ({ skipFocus } = {}) => {
    if (!failedConstraintInfo) {
      closeElementValidationMessage("becomes_valid");
      return;
    }
    if (failedConstraintInfo.silent) {
      closeElementValidationMessage("invalid_silent");
      return;
    }
    if (validationInterface.validationMessage) {
      const { message, status, closeOnClickOutside } = failedConstraintInfo;
      validationInterface.validationMessage.update(message, {
        status,
        closeOnClickOutside,
      });
      return;
    }
    if (!skipFocus) {
      element.focus();
    }
    const removeCloseOnCleanup = addTeardown(() => {
      closeElementValidationMessage("cleanup");
    });

    const anchorElement =
      failedConstraintInfo.target || elementReceivingValidationMessage;
    validationInterface.validationMessage = openCallout(
      failedConstraintInfo.message,
      {
        anchorElement,
        status: failedConstraintInfo.status,
        closeOnClickOutside: failedConstraintInfo.closeOnClickOutside,
        onClose: () => {
          removeCloseOnCleanup();
          validationInterface.validationMessage = null;
          if (failedConstraintInfo) {
            failedConstraintInfo.reportStatus = "closed";
          }
          if (!skipFocus) {
            element.focus();
          }
        },
      },
    );
    failedConstraintInfo.reportStatus = "reported";
  };
  validationInterface.checkValidity = checkValidity;
  validationInterface.reportValidity = reportValidity;

  const customMessageMap = new Map();
  {
    constraintSet.add({
      name: "custom_message",
      check: () => {
        for (const [, { message, status }] of customMessageMap) {
          return { message, status };
        }
        return null;
      },
    });
    const addCustomMessage = (
      key,
      message,
      { status = "info", removeOnRequestAction = false } = {},
    ) => {
      customMessageMap.set(key, { message, status, removeOnRequestAction });
      checkValidity();
      reportValidity();
      return () => {
        removeCustomMessage(key);
      };
    };
    const removeCustomMessage = (key) => {
      if (customMessageMap.has(key)) {
        customMessageMap.delete(key);
        checkValidity();
        reportValidity();
      }
    };
    addTeardown(() => {
      customMessageMap.clear();
    });
    Object.assign(validationInterface, {
      addCustomMessage,
      removeCustomMessage,
    });
  }

  checkValidity();
  {
    const oninput = () => {
      customMessageMap.clear();
      closeElementValidationMessage("input_event");
      checkValidity();
    };
    element.addEventListener("input", oninput);
    addTeardown(() => {
      element.removeEventListener("input", oninput);
    });
  }

  {
    // this ensure we re-check validity (and remove message no longer relevant)
    // once the action ends (used to remove the NOT_BUSY_CONSTRAINT message)
    const onactionend = () => {
      checkValidity();
    };
    element.addEventListener("actionend", onactionend);
    addTeardown(() => {
      element.removeEventListener("actionend", onactionend);
    });
  }

  {
    const nativeReportValidity = element.reportValidity;
    element.reportValidity = () => {
      reportValidity();
    };
    addTeardown(() => {
      element.reportValidity = nativeReportValidity;
    });
  }

  request_on_enter: {
    if (element.tagName !== "INPUT") {
      // maybe we want it too for checkboxes etc, we'll see
      break request_on_enter;
    }
    const onkeydown = (keydownEvent) => {
      if (keydownEvent.defaultPrevented) {
        return;
      }
      if (keydownEvent.key !== "Enter") {
        return;
      }
      const elementWithAction = closestElementWithAction(element);
      if (!elementWithAction) {
        return;
      }

      const determineClosestFormSubmitTargetForEnterKeyEvent = () => {
        if (keydownEvent.defaultPrevented) {
          return null;
        }
        const keydownTarget = keydownEvent.target;
        const { form } = keydownTarget;
        if (!form) {
          return null;
        }
        if (keydownTarget.tagName === "BUTTON") {
          if (
            keydownTarget.type !== "submit" &&
            keydownTarget.type !== "image"
          ) {
            return null;
          }
          return keydownTarget;
        }
        if (keydownTarget.tagName === "INPUT") {
          if (
            ![
              "text",
              "email",
              "password",
              "search",
              "number",
              "url",
              "tel",
            ].includes(keydownTarget.type)
          ) {
            return null;
          }
          // when present, we use first button submitting the form as the requester
          // not the input, it aligns with browser behavior where
          // hitting Enter in a text input triggers the first submit button of the form, not the input itself
          return getFirstButtonSubmittingForm(keydownTarget) || keydownTarget;
        }
        return null;
      };
      const formSubmitTarget =
        determineClosestFormSubmitTargetForEnterKeyEvent();
      if (formSubmitTarget) {
        keydownEvent.preventDefault();
      }
      dispatchActionRequestedCustomEvent(elementWithAction, {
        event: keydownEvent,
        requester: formSubmitTarget || element,
      });
    };
    element.addEventListener("keydown", onkeydown);
    addTeardown(() => {
      element.removeEventListener("keydown", onkeydown);
    });
  }

  {
    const onclick = (clickEvent) => {
      if (clickEvent.defaultPrevented) {
        return;
      }
      if (element.tagName !== "BUTTON") {
        return;
      }
      const button = element;
      const elementWithAction = closestElementWithAction(button);
      if (!elementWithAction) {
        return;
      }
      const determineClosestFormSubmitTargetForClickEvent = () => {
        if (clickEvent.defaultPrevented) {
          return null;
        }
        const clickTarget = clickEvent.target;
        const { form } = clickTarget;
        if (!form) {
          return null;
        }
        const wouldSubmitFormByType =
          button.type === "submit" || button.type === "image";
        if (wouldSubmitFormByType) {
          return button;
        }
        if (button.type) {
          // "reset", "button" or any other non submit type, it won't submit the form
          return null;
        }
        const firstButtonSubmittingForm = getFirstButtonSubmittingForm(form);
        if (button !== firstButtonSubmittingForm) {
          // an other button is explicitly submitting the form, this one would not submit it
          return null;
        }
        // this is the only button inside the form without type attribute, so it defaults to type="submit"
        return button;
      };
      const formSubmitTarget = determineClosestFormSubmitTargetForClickEvent();
      if (formSubmitTarget) {
        clickEvent.preventDefault();
      }
      dispatchActionRequestedCustomEvent(elementWithAction, {
        event: clickEvent,
        requester: formSubmitTarget || button,
      });
    };
    element.addEventListener("click", onclick);
    addTeardown(() => {
      element.removeEventListener("click", onclick);
    });
  }

  request_on_input_change: {
    const isInput =
      element.tagName === "INPUT" || element.tagName === "TEXTAREA";
    if (!isInput) {
      break request_on_input_change;
    }
    const stop = listenInputChange(element, (e) => {
      const elementWithAction = closestElementWithAction(element);
      if (!elementWithAction) {
        return;
      }
      dispatchActionRequestedCustomEvent(elementWithAction, {
        event: e,
        requester: element,
      });
    });
    addTeardown(() => {
      stop();
    });
  }

  request_on_checkbox_change: {
    const isCheckbox =
      element.tagName === "INPUT" && element.type === "checkbox";
    if (!isCheckbox) {
      break request_on_checkbox_change;
    }
    const onchange = (e) => {
      if (element.parentNode.hasAttribute("data-action")) {
        dispatchActionRequestedCustomEvent(element, {
          event: e,
          requester: element,
        });
        return;
      }
    };
    element.addEventListener("change", onchange);
    addTeardown(() => {
      element.removeEventListener("change", onchange);
    });
  }

  execute_on_form_submit: {
    if (!isForm) {
      break execute_on_form_submit;
    }
    // We will dispatch "action" when "submit" occurs (code called from.submit() to bypass validation)
    const form = element;
    const removeListener = addEventListener(form, "submit", (e) => {
      e.preventDefault();
      const actionCustomEvent = new CustomEvent("action", {
        detail: {
          action: null,
          event: e,
          method: "rerun",
          requester: form,
          meta: {
            isSubmit: true,
          },
        },
      });
      form.dispatchEvent(actionCustomEvent);
    });
    addTeardown(() => {
      removeListener();
    });
  }

  {
    const onkeydown = (e) => {
      if (e.key === "Escape") {
        if (!closeElementValidationMessage("escape_key")) {
          dispatchCancelCustomEvent({ detail: { reason: "escape_key" } });
        }
      }
    };
    element.addEventListener("keydown", onkeydown);
    addTeardown(() => {
      element.removeEventListener("keydown", onkeydown);
    });
  }

  {
    const onblur = () => {
      if (element.value === "") {
        dispatchCancelCustomEvent({
          detail: {
            reason: "blur_empty",
          },
        });
        return;
      }
      // if we have failed constraint, we cancel too
      if (failedConstraintInfo) {
        dispatchCancelCustomEvent({
          detail: {
            reason: "blur_invalid",
            failedConstraintInfo,
          },
        });
        return;
      }
    };
    element.addEventListener("blur", onblur);
    addTeardown(() => {
      element.removeEventListener("blur", onblur);
    });
  }

  return validationInterface;
};

// When interacting with an element we want to find the closest element
// eventually handling the action
// 1. <button> itself has an action
// 2. <button> is inside a <form> with an action
// 3. <button> is inside a wrapper <div> with an action (data-action is not necessarly on the interactive element itself, it can be on a wrapper, we want to support that)
// 4. <button> is inside a <fieldset> or any element that catches the action like a <form> would
// In examples above <button> can also be <input> etc..
const closestElementWithAction = (el) => {
  if (el.hasAttribute("data-action")) {
    return el;
  }
  const closestDataActionElement = el.closest("[data-action]");
  if (!closestDataActionElement) {
    return null;
  }
  const visualSelector = closestDataActionElement.getAttribute(
    "data-visual-selector",
  );
  if (!visualSelector) {
    return closestDataActionElement;
  }
  const visualElement = closestDataActionElement.querySelector(visualSelector);
  return visualElement;
};

const pickConstraint = (a, b) => {
  const aPrio = getConstraintPriority(a);
  const bPrio = getConstraintPriority(b);
  if (aPrio > bPrio) {
    return a;
  }
  return b;
};
const getConstraintPriority = (constraint) => {
  if (constraint.name === "required") {
    return 100;
  }
  if (STANDARD_CONSTRAINT_SET.has(constraint)) {
    return 10;
  }
  return 1;
};

const getFirstButtonSubmittingForm = (form) => {
  return form.querySelector(
    `button[type="submit"], input[type="submit"], input[type="image"]`,
  );
};

const dispatchActionRequestedCustomEvent = (
  elementWithAction,
  { actionOrigin = "action_prop", event, requester },
) => {
  const actionRequestedCustomEvent = new CustomEvent("actionrequested", {
    cancelable: true,
    detail: {
      actionOrigin,
      event,
      requester,
    },
  });
  elementWithAction.dispatchEvent(actionRequestedCustomEvent);
};
// https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
const requestSubmit = HTMLFormElement.prototype.requestSubmit;
HTMLFormElement.prototype.requestSubmit = function (submitter) {
  const form = this;
  const isInstrumented = formInstrumentedWeakSet.has(form);
  if (!isInstrumented) {
    requestSubmit.call(form, submitter);
    return;
  }
  const programmaticEvent = new CustomEvent("programmatic_requestsubmit", {
    cancelable: true,
    detail: {
      submitter,
    },
  });
  dispatchActionRequestedCustomEvent(form, {
    event: programmaticEvent,
    requester: submitter,
  });

  // When all fields are valid calling the native requestSubmit would let browser go through the
  // standard form validation steps leading to form submission.
  // We don't want that because we have our own action system to handle forms
  // If we did that the form submission would happen in parallel of our action system
  // and because we listen to "submit" event to dispatch "action" event
  // we would end up with two actions being executed.
  //
  // In case we have discrepencies in our implementation compared to the browser standard
  // this also prevent the native validation message to show up.

  // requestSubmit.call(this, submitter);
};

// const submit = HTMLFormElement.prototype.submit;
// HTMLFormElement.prototype.submit = function (...args) {
//   const form = this;
//   if (form.hasAttribute("data-method")) {
//     console.warn("You must use form.requestSubmit() instead of form.submit()");
//     return form.requestSubmit();
//   }
//   return submit.apply(this, args);
// };

const addEventListener = (element, event, callback) => {
  element.addEventListener(event, callback);
  return () => {
    element.removeEventListener(event, callback);
  };
};

const useCustomValidationRef = (elementRef, targetSelector) => {
  const customValidationRef = useRef();

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      console.warn(
        "useCustomValidationRef: elementRef.current is null, make sure to pass a ref to an element",
      );
      /* can happen if the component does this for instance:
      const Component = () => {
        const ref = useRef(null) 
        
        if (something) {
          return <input ref={ref} />  
        }
        return <span></span>
      }

      usually it's better to split the component in two but hey 
      */
      return null;
    }
    let target;
    if (targetSelector) {
      target = element.querySelector(targetSelector);
      if (!target) {
        console.warn(
          `useCustomValidationRef: targetSelector "${targetSelector}" did not match in element`,
        );
        return null;
      }
    } else {
      target = element;
    }
    const unsubscribe = subscribe(element, target);
    const validationInterface = element.__validationInterface__;
    customValidationRef.current = validationInterface;
    return () => {
      unsubscribe();
    };
  }, [targetSelector]);

  return customValidationRef;
};

const subscribeCountWeakMap = new WeakMap();
const subscribe = (element, target) => {
  if (element.__validationInterface__) {
    let subscribeCount = subscribeCountWeakMap.get(element);
    subscribeCountWeakMap.set(element, subscribeCount + 1);
  } else {
    installCustomConstraintValidation(element, target);
    subscribeCountWeakMap.set(element, 1);
  }
  return () => {
    unsubscribe(element);
  };
};

const unsubscribe = (element) => {
  const subscribeCount = subscribeCountWeakMap.get(element);
  if (subscribeCount === 1) {
    element.__validationInterface__.uninstall();
    subscribeCountWeakMap.delete(element);
  } else {
    subscribeCountWeakMap.set(element, subscribeCount - 1);
  }
};

const NO_CONSTRAINTS = [];
const useConstraints = (elementRef, props, { targetSelector } = {}) => {
  const {
    constraints = NO_CONSTRAINTS,
    disabledMessage,
    requiredMessage,
    patternMessage,
    minLengthMessage,
    maxLengthMessage,
    typeMessage,
    minMessage,
    maxMessage,
    singleSpaceMessage,
    sameAsMessage,
    minDigitMessage,
    minLowerLetterMessage,
    minUpperLetterMessage,
    minSpecialCharMessage,
    availableMessage,
    ...remainingProps
  } = props;

  const customValidationRef = useCustomValidationRef(
    elementRef,
    targetSelector,
  );
  useLayoutEffect(() => {
    const customValidation = customValidationRef.current;
    const cleanupCallbackSet = new Set();
    for (const constraint of constraints) {
      const unregister = customValidation.registerConstraint(constraint);
      cleanupCallbackSet.add(unregister);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
    };
  }, constraints);

  useLayoutEffect(() => {
    const el = elementRef.current;
    if (!el) {
      return null;
    }
    const cleanupCallbackSet = new Set();
    const setupCustomEvent = (el, constraintName, Component) => {
      const attrName = `data-${constraintName}-message-event`;
      const customEventName = `${constraintName}_message_jsx`;
      el.setAttribute(attrName, customEventName);
      const onCustomEvent = (e) => {
        e.detail.render(Component);
      };
      el.addEventListener(customEventName, onCustomEvent);
      cleanupCallbackSet.add(() => {
        el.removeEventListener(customEventName, onCustomEvent);
        el.removeAttribute(attrName);
      });
    };

    if (disabledMessage) {
      setupCustomEvent(el, "disabled", disabledMessage);
    }
    if (requiredMessage) {
      setupCustomEvent(el, "required", requiredMessage);
    }
    if (patternMessage) {
      setupCustomEvent(el, "pattern", patternMessage);
    }
    if (minLengthMessage) {
      setupCustomEvent(el, "min-length", minLengthMessage);
    }
    if (maxLengthMessage) {
      setupCustomEvent(el, "max-length", maxLengthMessage);
    }
    if (typeMessage) {
      setupCustomEvent(el, "type", typeMessage);
    }
    if (minMessage) {
      setupCustomEvent(el, "min", minMessage);
    }
    if (maxMessage) {
      setupCustomEvent(el, "max", maxMessage);
    }
    if (singleSpaceMessage) {
      setupCustomEvent(el, "single-space", singleSpaceMessage);
    }
    if (sameAsMessage) {
      setupCustomEvent(el, "same-as", sameAsMessage);
    }
    if (minDigitMessage) {
      setupCustomEvent(el, "min-digit", minDigitMessage);
    }
    if (minLowerLetterMessage) {
      setupCustomEvent(el, "min-lower-letter", minLowerLetterMessage);
    }
    if (minUpperLetterMessage) {
      setupCustomEvent(el, "min-upper-letter", minUpperLetterMessage);
    }
    if (minSpecialCharMessage) {
      setupCustomEvent(el, "min-special-char", minSpecialCharMessage);
    }
    if (availableMessage) {
      setupCustomEvent(el, "available", availableMessage);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
    };
  }, [
    disabledMessage,
    requiredMessage,
    patternMessage,
    minLengthMessage,
    maxLengthMessage,
    typeMessage,
    minMessage,
    maxMessage,
    singleSpaceMessage,
    sameAsMessage,
    minDigitMessage,
    minLowerLetterMessage,
    minUpperLetterMessage,
    minSpecialCharMessage,
    availableMessage,
  ]);

  return remainingProps;
};

const useInitialTextSelection = (ref, textSelection) => {
  const deps = [];
  if (Array.isArray(textSelection)) {
    deps.push(...textSelection);
  } else {
    deps.push(textSelection);
  }
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !textSelection) {
      return;
    }
    const range = document.createRange();
    const selection = window.getSelection();
    if (Array.isArray(textSelection)) {
      if (textSelection.length === 2) {
        const [start, end] = textSelection;
        if (typeof start === "number" && typeof end === "number") {
          // Format: [0, 10] - character indices
          selectByCharacterIndices(el, range, start, end);
        } else if (typeof start === "string" && typeof end === "string") {
          // Format: ["Click on the", "button to return"] - text strings
          selectByTextStrings(el, range, start, end);
        }
      }
    } else if (typeof textSelection === "string") {
      // Format: "some text" - select the entire string occurrence
      selectSingleTextString(el, range, textSelection);
    }
    selection.removeAllRanges();
    selection.addRange(range);
  }, deps);
};
const selectByCharacterIndices = (element, range, startIndex, endIndex) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  let currentIndex = 0;
  let startNode = null;
  let startOffset = 0;
  let endNode = null;
  let endOffset = 0;
  while (walker.nextNode()) {
    const textContent = walker.currentNode.textContent;
    const nodeLength = textContent.length;

    // Check if start position is in this text node
    if (!startNode && currentIndex + nodeLength > startIndex) {
      startNode = walker.currentNode;
      startOffset = startIndex - currentIndex;
    }

    // Check if end position is in this text node
    if (currentIndex + nodeLength >= endIndex) {
      endNode = walker.currentNode;
      endOffset = endIndex - currentIndex;
      break;
    }
    currentIndex += nodeLength;
  }
  if (startNode && endNode) {
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
  }
};
const selectSingleTextString = (element, range, text) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  while (walker.nextNode()) {
    const textContent = walker.currentNode.textContent;
    const index = textContent.indexOf(text);
    if (index !== -1) {
      range.setStart(walker.currentNode, index);
      range.setEnd(walker.currentNode, index + text.length);
      return;
    }
  }
};
const selectByTextStrings = (element, range, startText, endText) => {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
  let startNode = null;
  let endNode = null;
  let foundStart = false;
  while (walker.nextNode()) {
    const textContent = walker.currentNode.textContent;
    if (!foundStart && textContent.includes(startText)) {
      startNode = walker.currentNode;
      foundStart = true;
    }
    if (foundStart && textContent.includes(endText)) {
      endNode = walker.currentNode;
      break;
    }
  }
  if (startNode && endNode) {
    const startOffset = startNode.textContent.indexOf(startText);
    const endOffset = endNode.textContent.indexOf(endText) + endText.length;
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
  }
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  *[data-navi-space] {
    /* user-select: none; */
  }

  .navi_text {
    position: relative;
    color: inherit;

    &[data-has-absolute-child] {
      display: inline-block;
    }
  }

  .navi_text_overflow {
    flex-wrap: wrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .navi_text_overflow_wrapper {
    display: flex;
    width: 0;
    flex-grow: 1;
    gap: 0.3em;
  }

  .navi_text_overflow_text {
    max-width: 100%;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  .navi_custom_space {
  }

  .navi_text_bold_wrapper {
    position: relative;
    display: inline-block;
  }
  .navi_text_bold_clone {
    font-weight: bold;
    opacity: 0;
  }
  .navi_text_bold_foreground {
    position: absolute;
    inset: 0;
  }

  .navi_text_bold_background {
    position: absolute;
    top: 0;
    left: 0;
    color: currentColor;
    font-weight: normal;
    background: currentColor;
    background-clip: text;
    -webkit-background-clip: text;
    transform-origin: center;
    -webkit-text-fill-color: transparent;
    opacity: 0;
  }

  .navi_text[data-bold] {
    .navi_text_bold_background {
      opacity: 1;
    }
  }

  .navi_text[data-bold-transition] {
    .navi_text_bold_foreground {
      transition-property: font-weight;
      transition-duration: 0.3s;
      transition-timing-function: ease;
    }

    .navi_text_bold_background {
      transition-property: opacity;
      transition-duration: 0.3s;
      transition-timing-function: ease;
    }
  }
`;
const REGULAR_SPACE = jsx("span", {
  "data-navi-space": "",
  children: " "
});
const CustomWidthSpace = ({
  value
}) => {
  return jsx("span", {
    className: "navi_custom_space",
    style: `padding-left: ${value}`,
    children: "\u200B"
  });
};
const applySpacingOnTextChildren = (children, spacing) => {
  if (spacing === "pre" || spacing === "0" || spacing === 0) {
    return children;
  }
  if (!children) {
    return children;
  }
  const childArray = toChildArray(children);
  const childCount = childArray.length;
  if (childCount <= 1) {
    return children;
  }
  let separator;
  if (spacing === undefined) {
    spacing = REGULAR_SPACE;
  } else if (typeof spacing === "string") {
    if (isSizeSpacingScaleKey(spacing)) {
      separator = jsx(CustomWidthSpace, {
        value: resolveSpacingSize(spacing)
      });
    } else if (hasCSSSizeUnit(spacing)) {
      separator = jsx(CustomWidthSpace, {
        value: resolveSpacingSize(spacing)
      });
    } else {
      separator = spacing;
    }
  } else if (typeof spacing === "number") {
    separator = jsx(CustomWidthSpace, {
      value: spacing
    });
  } else {
    separator = spacing;
  }
  const childrenWithGap = [];
  let i = 0;
  while (true) {
    const child = childArray[i];
    childrenWithGap.push(child);
    i++;
    if (i === childCount) {
      break;
    }
    const currentChild = childArray[i - 1];
    const nextChild = childArray[i];
    if (endsWithWhitespace(currentChild)) {
      continue;
    }
    if (startsWithWhitespace(nextChild)) {
      continue;
    }
    childrenWithGap.push(separator);
  }
  return childrenWithGap;
};
const endsWithWhitespace = jsxChild => {
  if (typeof jsxChild === "string") {
    return /\s$/.test(jsxChild);
  }
  return false;
};
const startsWithWhitespace = jsxChild => {
  if (typeof jsxChild === "string") {
    return /^\s/.test(jsxChild);
  }
  return false;
};
const OverflowPinnedElementContext = createContext(null);
const Text = props => {
  const {
    overflowEllipsis,
    ...rest
  } = props;
  if (overflowEllipsis) {
    return jsx(TextOverflow, {
      ...rest
    });
  }
  if (props.overflowPinned) {
    return jsx(TextOverflowPinned, {
      ...props
    });
  }
  if (props.selectRange) {
    return jsx(TextWithSelectRange, {
      ...props
    });
  }
  return jsx(TextBasic, {
    ...props
  });
};
const TextOverflow = ({
  noWrap,
  children,
  ...rest
}) => {
  const [OverflowPinnedElement, setOverflowPinnedElement] = useState(null);
  return jsx(Text, {
    column: true,
    as: "div",
    nowWrap: noWrap,
    pre: !noWrap
    // For paragraph we prefer to keep lines and only hide unbreakable long sections
    ,
    preLine: rest.as === "p",
    ...rest,
    className: "navi_text_overflow",
    expandX: true,
    spacing: "pre",
    children: jsxs("span", {
      className: "navi_text_overflow_wrapper",
      children: [jsx(OverflowPinnedElementContext.Provider, {
        value: setOverflowPinnedElement,
        children: jsx(Text, {
          className: "navi_text_overflow_text",
          children: children
        })
      }), OverflowPinnedElement]
    })
  });
};
const TextOverflowPinned = ({
  overflowPinned,
  ...props
}) => {
  const setOverflowPinnedElement = useContext(OverflowPinnedElementContext);
  const text = jsx(Text, {
    ...props
  });
  if (!setOverflowPinnedElement) {
    console.warn("<Text overflowPinned> declared outside a <Text overflowEllipsis>");
    return text;
  }
  if (overflowPinned) {
    setOverflowPinnedElement(text);
    return null;
  }
  setOverflowPinnedElement(null);
  return text;
};
const TextWithSelectRange = ({
  selectRange,
  ...props
}) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  useInitialTextSelection(ref, selectRange);
  return jsx(Text, {
    ref: ref,
    ...props
  });
};
const TextBasic = ({
  spacing = " ",
  boldTransition,
  boldStable,
  preventBoldLayoutShift = boldTransition,
  children,
  ...rest
}) => {
  const boxProps = {
    "as": "span",
    "data-bold-transition": boldTransition ? "" : undefined,
    ...rest,
    "baseClassName": withPropsClassName("navi_text", rest.baseClassName)
  };
  const shouldPreserveSpacing = rest.as === "pre" || rest.box || rest.column || rest.row;
  if (shouldPreserveSpacing) {
    boxProps.spacing = spacing;
  } else {
    children = applySpacingOnTextChildren(children, spacing);
  }
  if (boldStable) {
    const {
      bold
    } = boxProps;
    return jsxs(Box, {
      ...boxProps,
      bold: undefined,
      "data-bold": bold ? "" : undefined,
      "data-has-absolute-child": "",
      children: [jsx("span", {
        className: "navi_text_bold_background",
        "aria-hidden": "true",
        children: children
      }), children]
    });
  }
  if (preventBoldLayoutShift) {
    const alignX = rest.alignX || rest.align || "start";

    // La technique consiste a avoid un double gras qui force une taille
    // et la version light par dessus en position absolute
    // on la centre aussi pour donner l'impression que le gras s'applique depuis le centre
    // ne fonctionne que sur une seul ligne de texte (donc lorsque noWrap est actif)
    // on pourrait auto-active cela sur une prop genre boldCanChange
    return jsx(Box, {
      ...boxProps,
      children: jsxs("span", {
        className: "navi_text_bold_wrapper",
        children: [jsx("span", {
          className: "navi_text_bold_clone",
          "aria-hidden": "true",
          children: children
        }), jsx("span", {
          className: "navi_text_bold_foreground",
          "data-align": alignX,
          children: children
        })]
      })
    });
  }
  return jsx(Box, {
    ...boxProps,
    children: children
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_icon {
    display: inline-block;
    box-sizing: border-box;
    max-width: 100%;
    max-height: 100%;

    &[data-flow-inline] {
      width: 1em;
      height: 1em;
    }
    &[data-icon-char] {
      flex-grow: 0 !important;
      line-height: normal;
    }
  }

  .navi_icon[data-interactive] {
    cursor: pointer;
  }

  .navi_icon_char_slot {
    opacity: 0;
    cursor: default;
    user-select: none;
  }
  .navi_icon_foreground {
    position: absolute;
    inset: 0;
  }
  .navi_icon_foreground > .navi_text {
    display: flex;
    aspect-ratio: 1 / 1;
    min-width: 0;
    height: 100%;
    max-height: 1em;
    align-items: center;
    justify-content: center;
  }

  .navi_icon > svg,
  .navi_icon > img {
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
  }
  .navi_icon[data-has-width] > svg,
  .navi_icon[data-has-width] > img {
    width: 100%;
    height: auto;
  }
  .navi_icon[data-has-height] > svg,
  .navi_icon[data-has-height] > img {
    width: auto;
    height: 100%;
  }
  .navi_icon[data-has-width][data-has-height] > svg,
  .navi_icon[data-has-width][data-has-height] > img {
    width: 100%;
    height: 100%;
  }

  .navi_icon[data-icon-char] svg,
  .navi_icon[data-icon-char] img {
    width: 100%;
    height: 100%;
  }
  .navi_icon[data-icon-char] svg {
    overflow: visible;
  }
`;
const Icon = ({
  href,
  children,
  charWidth = 1,
  // 0 (zéro) is the real char width
  // but 2 zéros gives too big icons
  // while 1 "W" gives a nice result
  baseChar = "W",
  decorative,
  onClick,
  ...props
}) => {
  const innerChildren = href ? jsx("svg", {
    width: "100%",
    height: "100%",
    children: jsx("use", {
      href: href
    })
  }) : children;
  let {
    box,
    width,
    height
  } = props;
  if (width === "auto") width = undefined;
  if (height === "auto") height = undefined;
  const hasExplicitWidth = width !== undefined;
  const hasExplicitHeight = height !== undefined;
  if (!hasExplicitWidth && !hasExplicitHeight) {
    if (decorative === undefined && !onClick) {
      decorative = true;
    }
  } else {
    box = true;
  }
  const ariaProps = decorative ? {
    "aria-hidden": "true"
  } : {};
  if (typeof children === "string") {
    return jsx(Text, {
      ...props,
      ...ariaProps,
      "data-icon-text": "",
      children: children
    });
  }
  if (box) {
    return jsx(Box, {
      square: true,
      ...props,
      ...ariaProps,
      box: box,
      baseClassName: "navi_icon",
      "data-has-width": hasExplicitWidth ? "" : undefined,
      "data-has-height": hasExplicitHeight ? "" : undefined,
      "data-interactive": onClick ? "" : undefined,
      onClick: onClick,
      children: innerChildren
    });
  }
  const invisibleText = baseChar.repeat(charWidth);
  return jsxs(Text, {
    ...props,
    ...ariaProps,
    className: withPropsClassName("navi_icon", props.className),
    spacing: "pre",
    "data-icon-char": "",
    "data-has-width": hasExplicitWidth ? "" : undefined,
    "data-has-height": hasExplicitHeight ? "" : undefined,
    "data-interactive": onClick ? "" : undefined,
    onClick: onClick,
    children: [jsx("span", {
      className: "navi_icon_char_slot",
      "aria-hidden": "true",
      children: invisibleText
    }), jsx(Text, {
      className: "navi_icon_foreground",
      spacing: "pre",
      children: innerChildren
    })]
  });
};

const EmailSvg = () => {
  return jsxs("svg", {
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
    children: [jsx("path", {
      d: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2"
    }), jsx("path", {
      d: "m2 6 8 5 2 1.5 2-1.5 8-5",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    })]
  });
};

const LinkBlankTargetSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
    children: jsx("path", {
      d: "M10.0002 5H8.2002C7.08009 5 6.51962 5 6.0918 5.21799C5.71547 5.40973 5.40973 5.71547 5.21799 6.0918C5 6.51962 5 7.08009 5 8.2002V15.8002C5 16.9203 5 17.4801 5.21799 17.9079C5.40973 18.2842 5.71547 18.5905 6.0918 18.7822C6.5192 19 7.07899 19 8.19691 19H15.8031C16.921 19 17.48 19 17.9074 18.7822C18.2837 18.5905 18.5905 18.2839 18.7822 17.9076C19 17.4802 19 16.921 19 15.8031V14M20 9V4M20 4H15M20 4L13 11",
      stroke: "currentColor",
      fill: "none",
      "stroke-width": "2",
      "stroke-linecap": "round",
      "stroke-linejoin": "round"
    })
  });
};
const LinkAnchorSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
    children: jsxs("g", {
      children: [jsx("path", {
        d: "M13.2218 3.32234C15.3697 1.17445 18.8521 1.17445 21 3.32234C23.1479 5.47022 23.1479 8.95263 21 11.1005L17.4645 14.636C15.3166 16.7839 11.8342 16.7839 9.6863 14.636C9.48752 14.4373 9.30713 14.2271 9.14514 14.0075C8.90318 13.6796 8.97098 13.2301 9.25914 12.9419C9.73221 12.4688 10.5662 12.6561 11.0245 13.1435C11.0494 13.1699 11.0747 13.196 11.1005 13.2218C12.4673 14.5887 14.6834 14.5887 16.0503 13.2218L19.5858 9.6863C20.9526 8.31947 20.9526 6.10339 19.5858 4.73655C18.219 3.36972 16.0029 3.36972 14.636 4.73655L13.5754 5.79721C13.1849 6.18774 12.5517 6.18774 12.1612 5.79721C11.7706 5.40669 11.7706 4.77352 12.1612 4.383L13.2218 3.32234Z",
        fill: "currentColor"
      }), jsx("path", {
        d: "M6.85787 9.6863C8.90184 7.64233 12.2261 7.60094 14.3494 9.42268C14.7319 9.75083 14.7008 10.3287 14.3444 10.685C13.9253 11.1041 13.2317 11.0404 12.7416 10.707C11.398 9.79292 9.48593 9.88667 8.27209 11.1005L4.73655 14.636C3.36972 16.0029 3.36972 18.219 4.73655 19.5858C6.10339 20.9526 8.31947 20.9526 9.6863 19.5858L10.747 18.5251C11.1375 18.1346 11.7706 18.1346 12.1612 18.5251C12.5517 18.9157 12.5517 19.5488 12.1612 19.9394L11.1005 21C8.95263 23.1479 5.47022 23.1479 3.32234 21C1.17445 18.8521 1.17445 15.3697 3.32234 13.2218L6.85787 9.6863Z",
        fill: "currentColor"
      })]
    })
  });
};

const PhoneSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
    children: jsx("path", {
      d: "M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z",
      fill: "currentColor"
    })
  });
};

const useDebounceTrue = (value, delay = 300) => {
  const [debouncedTrue, setDebouncedTrue] = useState(false);
  const timerRef = useRef(null);

  useLayoutEffect(() => {
    // If value is true or becomes true, start a timer
    if (value) {
      timerRef.current = setTimeout(() => {
        setDebouncedTrue(true);
      }, delay);
    } else {
      // If value becomes false, clear any pending timer and immediately set to false
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      setDebouncedTrue(false);
    }

    // Cleanup function
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [value, delay]);

  return debouncedTrue;
};

const useNetworkSpeed = () => {
  return networkSpeedSignal.value;
};

const connection =
  window.navigator.connection ||
  window.navigator.mozConnection ||
  window.navigator.webkitConnection;

const getNetworkSpeed = () => {
  // ✅ Network Information API (support moderne)
  if (!connection) {
    return "3g";
  }
  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType) {
      return effectiveType; // "slow-2g", "2g", "3g", "4g", "5g"
    }
    const downlink = connection.downlink;
    if (downlink) {
      // downlink is in Mbps
      if (downlink < 1) return "slow-2g"; // < 1 Mbps
      if (downlink < 2.5) return "2g"; // 1-2.5 Mbps
      if (downlink < 10) return "3g"; // 2.5-10 Mbps
      return "4g"; // > 10 Mbps
    }
  }
  return "3g";
};

const updateNetworkSpeed = () => {
  networkSpeedSignal.value = getNetworkSpeed();
};

const networkSpeedSignal = signal(getNetworkSpeed());

const setupNetworkMonitoring = () => {
  const cleanupFunctions = [];

  // ✅ 1. Écouter les changements natifs

  if (connection) {
    connection.addEventListener("change", updateNetworkSpeed);
    cleanupFunctions.push(() => {
      connection.removeEventListener("change", updateNetworkSpeed);
    });
  }

  // ✅ 2. Polling de backup (toutes les 60 secondes)
  const pollInterval = setInterval(updateNetworkSpeed, 60000);
  cleanupFunctions.push(() => clearInterval(pollInterval));

  // ✅ 3. Vérifier lors de la reprise d'activité
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      updateNetworkSpeed();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  cleanupFunctions.push(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  // ✅ 4. Vérifier lors de la reprise de connexion
  const handleOnline = () => {
    updateNetworkSpeed();
  };

  window.addEventListener("online", handleOnline);
  cleanupFunctions.push(() => {
    window.removeEventListener("online", handleOnline);
  });

  // Cleanup global
  return () => {
    cleanupFunctions.forEach((cleanup) => cleanup());
  };
};
setupNetworkMonitoring();

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_rectangle_loading {
    position: relative;
    display: flex;
    width: 100%;
    height: 100%;
    opacity: 0;
  }

  .navi_rectangle_loading[data-visible] {
    opacity: 1;
  }
`;
const RectangleLoading = ({
  shouldShowSpinner,
  color = "currentColor",
  radius = 0,
  size = 2
}) => {
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return null;
    }
    const {
      width,
      height
    } = container.getBoundingClientRect();
    setContainerWidth(width);
    setContainerHeight(height);
    let animationFrameId = null;
    // Create a resize observer to detect changes in the container's dimensions
    const resizeObserver = new ResizeObserver(entries => {
      // Use requestAnimationFrame to debounce updates
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = requestAnimationFrame(() => {
        const [containerEntry] = entries;
        const {
          width,
          height
        } = containerEntry.contentRect;
        setContainerWidth(width);
        setContainerHeight(height);
      });
    });
    resizeObserver.observe(container);
    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();
    };
  }, []);
  return jsx("span", {
    ref: containerRef,
    className: "navi_rectangle_loading",
    "data-visible": shouldShowSpinner ? "" : undefined,
    children: containerWidth > 0 && containerHeight > 0 && jsx(RectangleLoadingSvg, {
      radius: radius,
      color: color,
      width: containerWidth,
      height: containerHeight,
      strokeWidth: size
    })
  });
};
const RectangleLoadingSvg = ({
  width,
  height,
  color,
  radius,
  trailColor = "transparent",
  strokeWidth
}) => {
  const margin = Math.max(2, Math.min(width, height) * 0.03);

  // Calculate the drawable area
  const drawableWidth = width - margin * 2;
  const drawableHeight = height - margin * 2;

  // ✅ Check if this should be a circle - only if width and height are nearly equal
  const maxPossibleRadius = Math.min(drawableWidth, drawableHeight) / 2;
  const actualRadius = Math.min(radius || Math.min(drawableWidth, drawableHeight) * 0.05, maxPossibleRadius // ✅ Limité au radius maximum possible
  );
  const aspectRatio = Math.max(drawableWidth, drawableHeight) / Math.min(drawableWidth, drawableHeight);
  const isNearlySquare = aspectRatio <= 1.2; // Allow some tolerance for nearly square shapes
  const isCircle = isNearlySquare && actualRadius >= maxPossibleRadius * 0.95;
  let pathLength;
  let rectPath;
  if (isCircle) {
    // ✅ Circle: perimeter = 2πr
    pathLength = 2 * Math.PI * actualRadius;

    // ✅ Circle path centered in the drawable area
    const centerX = margin + drawableWidth / 2;
    const centerY = margin + drawableHeight / 2;
    rectPath = `
      M ${centerX + actualRadius},${centerY}
      A ${actualRadius},${actualRadius} 0 1 1 ${centerX - actualRadius},${centerY}
      A ${actualRadius},${actualRadius} 0 1 1 ${centerX + actualRadius},${centerY}
    `;
  } else {
    // ✅ Rectangle: calculate perimeter properly
    const straightEdges = 2 * (drawableWidth - 2 * actualRadius) + 2 * (drawableHeight - 2 * actualRadius);
    const cornerArcs = actualRadius > 0 ? 2 * Math.PI * actualRadius : 0;
    pathLength = straightEdges + cornerArcs;
    rectPath = `
      M ${margin + actualRadius},${margin}
      L ${margin + drawableWidth - actualRadius},${margin}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin + drawableWidth},${margin + actualRadius}
      L ${margin + drawableWidth},${margin + drawableHeight - actualRadius}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin + drawableWidth - actualRadius},${margin + drawableHeight}
      L ${margin + actualRadius},${margin + drawableHeight}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin},${margin + drawableHeight - actualRadius}
      L ${margin},${margin + actualRadius}
      A ${actualRadius},${actualRadius} 0 0 1 ${margin + actualRadius},${margin}
    `;
  }

  // Fixed segment size in pixels
  const maxSegmentSize = 40;
  const segmentLength = Math.min(maxSegmentSize, pathLength * 0.25);
  const gapLength = pathLength - segmentLength;

  // Vitesse constante en pixels par seconde
  const networkSpeed = useNetworkSpeed();
  const pixelsPerSecond = {
    "slow-2g": 40,
    "2g": 60,
    "3g": 80,
    "4g": 120
  }[networkSpeed] || 80;
  const animationDuration = Math.max(1.5, pathLength / pixelsPerSecond);

  // ✅ Calculate correct offset based on actual segment size
  const segmentRatio = segmentLength / pathLength;
  const circleOffset = -animationDuration * segmentRatio;
  return jsxs("svg", {
    width: "100%",
    height: "100%",
    viewBox: `0 0 ${width} ${height}`,
    preserveAspectRatio: "none",
    style: "overflow: visible",
    xmlns: "http://www.w3.org/2000/svg",
    "shape-rendering": "geometricPrecision",
    children: [isCircle ? jsx("circle", {
      cx: margin + drawableWidth / 2,
      cy: margin + drawableHeight / 2,
      r: actualRadius,
      fill: "none",
      stroke: trailColor,
      strokeWidth: strokeWidth
    }) : jsx("rect", {
      x: margin,
      y: margin,
      width: drawableWidth,
      height: drawableHeight,
      fill: "none",
      stroke: trailColor,
      strokeWidth: strokeWidth,
      rx: actualRadius
    }), jsx("path", {
      d: rectPath,
      fill: "none",
      stroke: color,
      strokeWidth: strokeWidth,
      strokeLinecap: "round",
      strokeDasharray: `${segmentLength} ${gapLength}`,
      pathLength: pathLength,
      children: jsx("animate", {
        attributeName: "stroke-dashoffset",
        from: pathLength,
        to: "0",
        dur: `${animationDuration}s`,
        repeatCount: "indefinite",
        begin: "0s"
      })
    }), jsx("circle", {
      r: strokeWidth,
      fill: color,
      children: jsx("animateMotion", {
        path: rectPath,
        dur: `${animationDuration}s`,
        repeatCount: "indefinite",
        rotate: "auto",
        begin: `${circleOffset}s`
      })
    })]
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_loading_rectangle_wrapper {
    position: absolute;
    top: var(--rectangle-top, 0);
    right: var(--rectangle-right, 0);
    bottom: var(--rectangle-bottom, 0);
    left: var(--rectangle-left, 0);
    z-index: 1;
    opacity: 0;
    pointer-events: none;
  }
  .navi_loading_rectangle_wrapper[data-visible] {
    opacity: 1;
  }
`;
const LoaderBackground = ({
  loading,
  containerRef,
  targetSelector,
  color,
  inset = 0,
  spacingTop = 0,
  spacingLeft = 0,
  spacingBottom = 0,
  spacingRight = 0,
  children
}) => {
  if (containerRef) {
    const container = containerRef.current;
    if (!container) {
      return children;
    }
    return createPortal(jsx(LoaderBackgroundWithPortal, {
      container: container,
      loading: loading,
      color: color,
      inset: inset,
      spacingTop: spacingTop,
      spacingLeft: spacingLeft,
      spacingBottom: spacingBottom,
      spacingRight: spacingRight,
      children: children
    }), container);
  }
  return jsx(LoaderBackgroundBasic, {
    targetSelector: targetSelector,
    loading: loading,
    color: color,
    inset: inset,
    spacingTop: spacingTop,
    spacingLeft: spacingLeft,
    spacingBottom: spacingBottom,
    spacingRight: spacingRight,
    children: children
  });
};
const LoaderBackgroundWithPortal = ({
  container,
  loading,
  color,
  inset,
  spacingTop,
  spacingLeft,
  spacingBottom,
  spacingRight,
  children
}) => {
  const shouldShowSpinner = useDebounceTrue(loading, 300);
  if (!shouldShowSpinner) {
    return children;
  }
  container.style.position = "relative";
  let paddingTop = 0;
  if (container.nodeName === "DETAILS") {
    paddingTop = container.querySelector("summary").offsetHeight;
  }
  return jsxs(Fragment, {
    children: [jsx("div", {
      style: {
        position: "absolute",
        top: `${inset + paddingTop + spacingTop}px`,
        bottom: `${inset + spacingBottom}px`,
        left: `${inset + spacingLeft}px`,
        right: `${inset + spacingRight}px`
      },
      children: shouldShowSpinner && jsx(RectangleLoading, {
        color: color
      })
    }), children]
  });
};
const LoaderBackgroundBasic = ({
  loading,
  targetSelector,
  color,
  spacingTop,
  spacingLeft,
  spacingBottom,
  spacingRight,
  inset,
  children
}) => {
  const shouldShowSpinner = useDebounceTrue(loading, 300);
  const rectangleRef = useRef(null);
  const [, setOutlineOffset] = useState(0);
  const [borderRadius, setBorderRadius] = useState(0);
  const [borderTopWidth, setBorderTopWidth] = useState(0);
  const [borderLeftWidth, setBorderLeftWidth] = useState(0);
  const [borderRightWidth, setBorderRightWidth] = useState(0);
  const [borderBottomWidth, setBorderBottomWidth] = useState(0);
  const [marginTop, setMarginTop] = useState(0);
  const [marginBottom, setMarginBottom] = useState(0);
  const [marginLeft, setMarginLeft] = useState(0);
  const [marginRight, setMarginRight] = useState(0);
  const [paddingTop, setPaddingTop] = useState(0);
  const [paddingLeft, setPaddingLeft] = useState(0);
  const [paddingRight, setPaddingRight] = useState(0);
  const [paddingBottom, setPaddingBottom] = useState(0);
  const [currentColor, setCurrentColor] = useState(color);
  useLayoutEffect(() => {
    let animationFrame;
    const updateStyles = () => {
      const rectangle = rectangleRef.current;
      if (!rectangle) {
        return;
      }
      const container = rectangle.parentElement;
      const containedElement = rectangle.nextElementSibling;
      const target = targetSelector ? container.querySelector(targetSelector) : containedElement;
      if (target) {
        const {
          width,
          height
        } = target.getBoundingClientRect();
        const containedComputedStyle = window.getComputedStyle(containedElement);
        const targetComputedStyle = window.getComputedStyle(target);
        const newBorderTopWidth = resolveCSSSize(targetComputedStyle.borderTopWidth);
        const newBorderLeftWidth = resolveCSSSize(targetComputedStyle.borderLeftWidth);
        const newBorderRightWidth = resolveCSSSize(targetComputedStyle.borderRightWidth);
        const newBorderBottomWidth = resolveCSSSize(targetComputedStyle.borderBottomWidth);
        const newBorderRadius = resolveCSSSize(targetComputedStyle.borderRadius, {
          availableSize: Math.min(width, height)
        });
        const newOutlineColor = targetComputedStyle.outlineColor;
        const newBorderColor = targetComputedStyle.borderColor;
        const newDetectedColor = targetComputedStyle.color;
        const newOutlineOffset = resolveCSSSize(targetComputedStyle.outlineOffset);
        const newMarginTop = resolveCSSSize(targetComputedStyle.marginTop);
        const newMarginBottom = resolveCSSSize(targetComputedStyle.marginBottom);
        const newMarginLeft = resolveCSSSize(targetComputedStyle.marginLeft);
        const newMarginRight = resolveCSSSize(targetComputedStyle.marginRight);
        const paddingTop = resolveCSSSize(containedComputedStyle.paddingTop);
        const paddingLeft = resolveCSSSize(containedComputedStyle.paddingLeft);
        const paddingRight = resolveCSSSize(containedComputedStyle.paddingRight);
        const paddingBottom = resolveCSSSize(containedComputedStyle.paddingBottom);
        setBorderTopWidth(newBorderTopWidth);
        setBorderLeftWidth(newBorderLeftWidth);
        setBorderRightWidth(newBorderRightWidth);
        setBorderBottomWidth(newBorderBottomWidth);
        setBorderRadius(newBorderRadius);
        setOutlineOffset(newOutlineOffset);
        setMarginTop(newMarginTop);
        setMarginBottom(newMarginBottom);
        setMarginLeft(newMarginLeft);
        setMarginRight(newMarginRight);
        setPaddingTop(paddingTop);
        setPaddingLeft(paddingLeft);
        setPaddingRight(paddingRight);
        setPaddingBottom(paddingBottom);
        if (color) {
          // const resolvedColor = resolveCSSColor(color, rectangle, "css");
          //  console.log(resolvedColor);
          setCurrentColor(color);
        } else if (newOutlineColor && newOutlineColor !== "rgba(0, 0, 0, 0)" && (document.activeElement === containedElement || newBorderColor === "rgba(0, 0, 0, 0)")) {
          setCurrentColor(newOutlineColor);
        } else if (newBorderColor && newBorderColor !== "rgba(0, 0, 0, 0)") {
          setCurrentColor(newBorderColor);
        } else {
          setCurrentColor(newDetectedColor);
        }
      }
      // updateStyles is very cheap so we run it every frame
      animationFrame = requestAnimationFrame(updateStyles);
    };
    updateStyles();
    return () => {
      cancelAnimationFrame(animationFrame);
    };
  }, [color, targetSelector]);
  spacingTop += inset;
  // spacingTop += outlineOffset;
  // spacingTop -= borderTopWidth;
  spacingTop += marginTop;
  spacingLeft += inset;
  // spacingLeft += outlineOffset;
  // spacingLeft -= borderLeftWidth;
  spacingLeft += marginLeft;
  spacingRight += inset;
  // spacingRight += outlineOffset;
  // spacingRight -= borderRightWidth;
  spacingRight += marginRight;
  spacingBottom += inset;
  // spacingBottom += outlineOffset;
  // spacingBottom -= borderBottomWidth;
  spacingBottom += marginBottom;
  if (targetSelector) {
    // oversimplification that actually works
    // (simplified because it assumes the targeted element is a direct child of the contained element which may have padding)
    spacingTop += paddingTop;
    spacingLeft += paddingLeft;
    spacingRight += paddingRight;
    spacingBottom += paddingBottom;
  }
  const maxBorderWidth = Math.max(borderTopWidth, borderLeftWidth, borderRightWidth, borderBottomWidth);
  const halfMaxBorderSize = maxBorderWidth / 2;
  const size = halfMaxBorderSize < 2 ? 2 : halfMaxBorderSize;
  const lineHalfSize = size / 2;
  spacingTop -= lineHalfSize;
  spacingLeft -= lineHalfSize;
  spacingRight -= lineHalfSize;
  spacingBottom -= lineHalfSize;
  return jsxs(Fragment, {
    children: [jsx("span", {
      ref: rectangleRef,
      className: "navi_loading_rectangle_wrapper",
      "data-visible": shouldShowSpinner ? "" : undefined,
      style: {
        "--rectangle-top": `${spacingTop}px`,
        "--rectangle-left": `${spacingLeft}px`,
        "--rectangle-bottom": `${spacingBottom}px`,
        "--rectangle-right": `${spacingRight}px`
      },
      children: loading && jsx(RectangleLoading, {
        shouldShowSpinner: shouldShowSpinner,
        color: currentColor,
        radius: borderRadius,
        size: size
      })
    }), children]
  });
};

// used by form elements such as <input>, <select>, <textarea> to have their own action bound to a single parameter
// when inside a <form> the form params are updated when the form element single param is updated
const useActionBoundToOneParam = (action, externalValue) => {
  const actionFirstArgSignal = useSignal(externalValue);
  const boundAction = useBoundAction(action, actionFirstArgSignal);
  const getValue = useCallback(() => actionFirstArgSignal.value, []);
  const setValue = useCallback((value) => {
    actionFirstArgSignal.value = value;
  }, []);
  const externalValueRef = useRef(externalValue);
  if (externalValue !== externalValueRef.current) {
    externalValueRef.current = externalValue;
    setValue(externalValue);
  }

  const value = getValue();
  return [boundAction, value, setValue];
};
const useActionBoundToOneArrayParam = (
  action,
  name,
  externalValue,
  fallbackValue,
  defaultValue,
) => {
  const [boundAction, value, setValue] = useActionBoundToOneParam(
    action,
    name);

  const add = (valueToAdd, valueArray = value) => {
    setValue(addIntoArray(valueArray, valueToAdd));
  };

  const remove = (valueToRemove, valueArray = value) => {
    setValue(removeFromArray(valueArray, valueToRemove));
  };

  const result = [boundAction, value, setValue];
  result.add = add;
  result.remove = remove;
  return result;
};
// used by <details> to just call their action
const useAction = (action, paramsSignal) => {
  return useBoundAction(action, paramsSignal);
};

const useBoundAction = (action, actionParamsSignal) => {
  const actionRef = useRef();
  const actionCallbackRef = useRef();

  if (!action) {
    return null;
  }
  if (isFunctionButNotAnActionFunction(action)) {
    actionCallbackRef.current = action;
    const existingAction = actionRef.current;
    if (existingAction) {
      return existingAction;
    }
    const actionFromFunction = createAction(
      (...args) => {
        return actionCallbackRef.current?.(...args);
      },
      {
        name: action.name,
        // We don't want to give empty params by default
        // we want to give undefined for regular functions
        params: undefined,
      },
    );
    if (!actionParamsSignal) {
      actionRef.current = actionFromFunction;
      return actionFromFunction;
    }
    const actionBoundToParams =
      actionFromFunction.bindParams(actionParamsSignal);
    actionRef.current = actionBoundToParams;
    return actionBoundToParams;
  }
  if (actionParamsSignal) {
    return action.bindParams(actionParamsSignal);
  }
  return action;
};

const isFunctionButNotAnActionFunction = (action) => {
  return typeof action === "function" && !action.isAction;
};

const ErrorBoundaryContext = createContext(null);

const useResetErrorBoundary = () => {
  const resetErrorBoundary = useContext(ErrorBoundaryContext);
  return resetErrorBoundary;
};

const addCustomMessage = (element, key, message, options) => {
  const customConstraintValidation =
    element.__validationInterface__ ||
    (element.__validationInterface__ =
      installCustomConstraintValidation(element));

  return customConstraintValidation.addCustomMessage(key, message, options);
};

const removeCustomMessage = (element, key) => {
  const customConstraintValidation = element.__validationInterface__;
  if (!customConstraintValidation) {
    return;
  }
  customConstraintValidation.removeCustomMessage(key);
};

const useExecuteAction = (
  elementRef,
  {
    errorEffect = "show_validation_message", // "show_validation_message" or "throw"
    errorMapping,
  } = {},
) => {
  // see https://medium.com/trabe/catching-asynchronous-errors-in-react-using-error-boundaries-5e8a5fd7b971
  // and https://codepen.io/dmail/pen/XJJqeGp?editors=0010
  // To change if https://github.com/preactjs/preact/issues/4754 lands
  const [error, setError] = useState(null);
  const resetErrorBoundary = useResetErrorBoundary();
  useLayoutEffect(() => {
    if (error) {
      error.__handled__ = true; // prevent jsenv from displaying it
      throw error;
    }
  }, [error]);

  const validationMessageTargetRef = useRef(null);
  const addErrorMessage = (error) => {
    let calloutAnchor = validationMessageTargetRef.current;
    let message;
    if (errorMapping) {
      const errorMappingResult = errorMapping(error);
      if (typeof errorMappingResult === "string") {
        message = errorMappingResult;
      } else if (Error.isError(errorMappingResult)) {
        message = errorMappingResult;
      } else if (isValidElement(errorMappingResult)) {
        message = errorMappingResult;
      } else if (
        typeof errorMappingResult === "object" &&
        errorMappingResult !== null
      ) {
        message = errorMappingResult.message || error.message;
        calloutAnchor = errorMappingResult.target || calloutAnchor;
      }
    } else {
      message = error;
    }
    addCustomMessage(calloutAnchor, "action_error", message, {
      status: "error",
      // This error should not prevent <form> submission
      // so whenever user tries to submit the form the error is cleared
      // (Hitting enter key, clicking on submit button, etc. would allow to re-submit the form in error state)
      removeOnRequestAction: true,
    });
  };
  const removeErrorMessage = () => {
    const validationMessageTarget = validationMessageTargetRef.current;
    if (validationMessageTarget) {
      removeCustomMessage(validationMessageTarget, "action_error");
    }
  };

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }
    const form = element.tagName === "FORM" ? element : element.form;
    if (!form) {
      return null;
    }
    const onReset = () => {
      removeErrorMessage();
    };
    form.addEventListener("reset", onReset);
    return () => {
      form.removeEventListener("reset", onReset);
    };
  });

  // const errorEffectRef = useRef();
  // errorEffectRef.current = errorEffect;
  const executeAction = useCallback(
    (actionEvent) => {
      const { action, actionOrigin, requester, event, method } =
        actionEvent.detail;
      const sharedActionEventDetail = {
        action,
        actionOrigin,
        requester,
        event,
        method,
      };

      const dispatchCustomEvent = (type, options) => {
        const element = elementRef.current;
        const customEvent = new CustomEvent(type, options);
        element.dispatchEvent(customEvent);
      };
      if (resetErrorBoundary) {
        resetErrorBoundary();
      }
      removeErrorMessage();
      setError(null);

      const validationMessageTarget = requester || elementRef.current;
      validationMessageTargetRef.current = validationMessageTarget;

      dispatchCustomEvent("actionstart", {
        detail: sharedActionEventDetail,
      });

      return action[method]({
        reason: `"${event.type}" event on ${(() => {
          const target = event.target;
          const tagName = target.tagName.toLowerCase();

          if (target.id) {
            return `${tagName}#${target.id}`;
          }

          const uiName = target.getAttribute("data-ui-name");
          if (uiName) {
            return `${tagName}[data-ui-name="${uiName}"]`;
          }

          return `<${tagName}>`;
        })()}`,
        onAbort: (reason) => {
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            elementRef.current
          ) {
            dispatchCustomEvent("actionabort", {
              detail: {
                ...sharedActionEventDetail,
                reason,
              },
            });
          }
        },
        onError: (error) => {
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            elementRef.current
          ) {
            dispatchCustomEvent("actionerror", {
              detail: {
                ...sharedActionEventDetail,
                error,
              },
            });
          }
          if (errorEffect === "show_validation_message") {
            addErrorMessage(error);
          } else if (errorEffect === "throw") {
            setError(error);
          }
        },
        onComplete: (data) => {
          if (
            // at this stage the action side effect might have removed the <element> from the DOM
            // (in theory no because action side effect are batched to happen after)
            // but other side effects might do this
            elementRef.current
          ) {
            dispatchCustomEvent("actionend", {
              detail: {
                ...sharedActionEventDetail,
                data,
              },
            });
          }
        },
      });
    },
    [errorEffect],
  );

  return executeAction;
};

const detectMac = () => {
  // Modern way using User-Agent Client Hints API
  if (window.navigator.userAgentData) {
    return window.navigator.userAgentData.platform === "macOS";
  }
  // Fallback to userAgent string parsing
  return /Mac|iPhone|iPad|iPod/.test(window.navigator.userAgent);
};
const isMac = detectMac();

// Maps canonical browser key names to their user-friendly aliases.
// Used for both event matching and ARIA normalization.
const keyMapping = {
  " ": { alias: ["space"] },
  "escape": { alias: ["esc"] },
  "arrowup": { alias: ["up"] },
  "arrowdown": { alias: ["down"] },
  "arrowleft": { alias: ["left"] },
  "arrowright": { alias: ["right"] },
  "delete": { alias: ["del"] },
  // Platform-specific mappings
  ...(isMac
    ? { delete: { alias: ["backspace"] } }
    : { backspace: { alias: ["delete"] } }),
};

const activeShortcutsSignal = signal([]);
const shortcutsMap = new Map();

const areShortcutsEqual = (shortcutA, shortcutB) => {
  return (
    shortcutA.key === shortcutB.key &&
    shortcutA.description === shortcutB.description &&
    shortcutA.enabled === shortcutB.enabled
  );
};

const areShortcutArraysEqual = (arrayA, arrayB) => {
  if (arrayA.length !== arrayB.length) {
    return false;
  }

  for (let i = 0; i < arrayA.length; i++) {
    if (!areShortcutsEqual(arrayA[i], arrayB[i])) {
      return false;
    }
  }

  return true;
};

const updateActiveShortcuts = () => {
  const activeElement = activeElementSignal.peek();
  const currentActiveShortcuts = activeShortcutsSignal.peek();
  const activeShortcuts = [];
  for (const [element, { shortcuts }] of shortcutsMap) {
    if (element === activeElement || element.contains(activeElement)) {
      activeShortcuts.push(...shortcuts);
    }
  }

  // Only update if shortcuts have actually changed
  if (!areShortcutArraysEqual(currentActiveShortcuts, activeShortcuts)) {
    activeShortcutsSignal.value = activeShortcuts;
  }
};
effect(() => {
  // eslint-disable-next-line no-unused-expressions
  activeElementSignal.value;
  updateActiveShortcuts();
});
const addShortcuts = (element, shortcuts) => {
  shortcutsMap.set(element, { shortcuts });
  updateActiveShortcuts();
};
const removeShortcuts = (element) => {
  shortcutsMap.delete(element);
  updateActiveShortcuts();
};

const useKeyboardShortcuts = (
  elementRef,
  shortcuts,
  {
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    allowConcurrentActions,
  } = {},
) => {
  if (!elementRef) {
    throw new Error(
      "useKeyboardShortcuts requires an elementRef to attach shortcuts to.",
    );
  }

  const executeAction = useExecuteAction(elementRef);
  const shortcutActionIsBusyRef = useRef(false);
  useActionEvents(elementRef, {
    actionOrigin: "keyboard_shortcut",
    onPrevented: onActionPrevented,
    onAction: (actionEvent) => {
      const { shortcut } = actionEvent.detail.meta || {};
      if (!shortcut) {
        // not a shortcut (an other interaction triggered the action, don't request it again)
        return;
      }
      // action can be a function or an action object, whem a function we must "wrap" it in a function returning that function
      // otherwise setState would call that action immediately
      // setAction(() => actionEvent.detail.action);
      executeAction(actionEvent, {
        requester: document.activeElement,
      });
    },
    onStart: (e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      if (!allowConcurrentActions) {
        shortcutActionIsBusyRef.current = true;
      }
      shortcut.onStart?.(e);
      onActionStart?.(e);
    },
    onAbort: (e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      shortcutActionIsBusyRef.current = false;
      shortcut.onAbort?.(e);
      onActionAbort?.(e);
    },
    onError: (error, e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      shortcutActionIsBusyRef.current = false;
      shortcut.onError?.(error, e);
      onActionError?.(error, e);
    },
    onEnd: (e) => {
      const { shortcut } = e.detail.meta || {};
      if (!shortcut) {
        return;
      }
      shortcutActionIsBusyRef.current = false;
      shortcut.onEnd?.(e);
      onActionEnd?.(e);
    },
  });

  const shortcutDeps = [];
  for (const shortcut of shortcuts) {
    shortcutDeps.push(
      shortcut.key,
      shortcut.description,
      shortcut.enabled,
      shortcut.confirmMessage,
    );
    shortcut.action = useAction(shortcut.action);
  }

  useEffect(() => {
    const element = elementRef.current;
    const shortcutsCopy = [];
    for (const shortcutCandidate of shortcuts) {
      shortcutsCopy.push({
        ...shortcutCandidate,
        handler: (keyboardEvent) => {
          if (shortcutCandidate.handler) {
            return shortcutCandidate.handler(keyboardEvent);
          }
          if (shortcutActionIsBusyRef.current) {
            return false;
          }
          const { action } = shortcutCandidate;
          return requestAction(element, action, {
            actionOrigin: "keyboard_shortcut",
            event: keyboardEvent,
            requester: document.activeElement,
            confirmMessage: shortcutCandidate.confirmMessage,
            meta: {
              shortcut: shortcutCandidate,
            },
          });
        },
      });
    }

    addShortcuts(element, shortcuts);

    const onKeydown = (event) => {
      applyKeyboardShortcuts(shortcutsCopy, event);
    };
    element.addEventListener("keydown", onKeydown);
    return () => {
      element.removeEventListener("keydown", onKeydown);
      removeShortcuts(element);
    };
  }, [shortcutDeps]);
};

const applyKeyboardShortcuts = (shortcuts, keyboardEvent) => {
  if (!canInterceptKeys(keyboardEvent)) {
    return null;
  }
  for (const shortcutCandidate of shortcuts) {
    let { enabled = true, key } = shortcutCandidate;
    if (!enabled) {
      continue;
    }

    if (typeof key === "function") {
      const keyReturnValue = key(keyboardEvent);
      if (!keyReturnValue) {
        continue;
      }
      key = keyReturnValue;
    }
    if (!key) {
      console.error(shortcutCandidate);
      throw new TypeError(`key is required in keyboard shortcut, got ${key}`);
    }

    // Handle platform-specific combination objects
    let actualCombination;
    let crossPlatformCombination;
    if (typeof key === "object" && key !== null) {
      actualCombination = isMac ? key.mac : key.other;
    } else {
      actualCombination = key;
      if (containsPlatformSpecificKeys(key)) {
        crossPlatformCombination = generateCrossPlatformCombination(key);
      }
    }

    // Check both the actual combination and cross-platform combination
    const matchesActual =
      actualCombination &&
      keyboardEventIsMatchingKeyCombination(keyboardEvent, actualCombination);
    const matchesCrossPlatform =
      crossPlatformCombination &&
      crossPlatformCombination !== actualCombination &&
      keyboardEventIsMatchingKeyCombination(
        keyboardEvent,
        crossPlatformCombination,
      );

    if (!matchesActual && !matchesCrossPlatform) {
      continue;
    }
    if (typeof enabled === "function" && !enabled(keyboardEvent)) {
      continue;
    }
    const returnValue = shortcutCandidate.handler(keyboardEvent);
    if (returnValue) {
      keyboardEvent.preventDefault();
    }
    return shortcutCandidate;
  }
  return null;
};
const containsPlatformSpecificKeys = (combination) => {
  const lowerCombination = combination.toLowerCase();
  const macSpecificKeys = ["command", "cmd"];

  return macSpecificKeys.some((key) => lowerCombination.includes(key));
};
const generateCrossPlatformCombination = (combination) => {
  let crossPlatform = combination;

  if (isMac) {
    // No need to convert anything TO Windows/Linux-specific format since we're on Mac
    return null;
  }
  // If not on Mac but combination contains Mac-specific keys, generate Windows equivalent
  crossPlatform = crossPlatform.replace(/\bcommand\b/gi, "control");
  crossPlatform = crossPlatform.replace(/\bcmd\b/gi, "control");

  return crossPlatform;
};
const keyboardEventIsMatchingKeyCombination = (event, keyCombination) => {
  const keys = keyCombination.toLowerCase().split("+");

  for (const key of keys) {
    let modifierFound = false;

    // Check if this key is a modifier
    for (const [eventProperty, config] of Object.entries(modifierKeyMapping)) {
      const allNames = [...config.names];

      // Add Mac-specific names only if we're on Mac and they exist
      if (isMac && config.macNames) {
        allNames.push(...config.macNames);
      }

      if (allNames.includes(key)) {
        // Check if the corresponding event property is pressed
        if (!event[eventProperty]) {
          return false;
        }
        modifierFound = true;
        break;
      }
    }
    if (modifierFound) {
      continue;
    }

    // Check if it's a range pattern like "a-z" or "0-9"
    if (key.includes("-") && key.length === 3) {
      const [startChar, dash, endChar] = key;
      if (dash === "-") {
        // Only check ranges for single alphanumeric characters
        const eventKey = event.key.toLowerCase();
        if (eventKey.length !== 1) {
          return false; // Not a single character key
        }

        // Only allow a-z and 0-9 ranges
        const isValidRange =
          (startChar >= "a" && endChar <= "z") ||
          (startChar >= "0" && endChar <= "9");

        if (!isValidRange) {
          return false; // Invalid range pattern
        }

        const eventKeyCode = eventKey.charCodeAt(0);
        const startCode = startChar.charCodeAt(0);
        const endCode = endChar.charCodeAt(0);

        if (eventKeyCode >= startCode && eventKeyCode <= endCode) {
          continue; // Range matched
        }
        return false; // Range not matched
      }
    }

    // If it's not a modifier or range, check if it matches the actual key
    if (!isSameKey(event.key, key)) {
      return false;
    }
  }
  return true;
};
// Configuration for mapping shortcut key names to browser event properties
const modifierKeyMapping = {
  metaKey: {
    names: ["meta"],
    macNames: ["command", "cmd"],
  },
  ctrlKey: {
    names: ["control", "ctrl"],
  },
  shiftKey: {
    names: ["shift"],
  },
  altKey: {
    names: ["alt"],
    macNames: ["option"],
  },
};
const isSameKey = (browserEventKey, key) => {
  browserEventKey = browserEventKey.toLowerCase();
  key = key.toLowerCase();

  if (browserEventKey === key) {
    return true;
  }

  // Check if either key is an alias for the other
  for (const [canonicalKey, config] of Object.entries(keyMapping)) {
    const allKeys = [canonicalKey, ...config.alias];
    if (allKeys.includes(browserEventKey) && allKeys.includes(key)) {
      return true;
    }
  }

  return false;
};

const useFormEvents = (
  elementRef,
  {
    onFormReset,
    onFormActionRequested,
    onFormActionPrevented,
    onFormActionStart,
    onFormActionAbort,
    onFormActionError,
    onFormActionEnd,
  },
) => {
  onFormReset = useStableCallback(onFormReset);
  onFormActionRequested = useStableCallback(onFormActionRequested);
  onFormActionPrevented = useStableCallback(onFormActionPrevented);
  onFormActionStart = useStableCallback(onFormActionStart);
  onFormActionAbort = useStableCallback(onFormActionAbort);
  onFormActionError = useStableCallback(onFormActionError);
  onFormActionEnd = useStableCallback(onFormActionEnd);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return null;
    }

    let form = element.form;
    if (!form) {
      // some non input elements may want to listen form events (<RadioList> is a <div>)
      form = element.closest("form");
      if (!form) {
        console.warn("No form found for element", element);
        return null;
      }
    }
    return addManyEventListeners(form, {
      reset: onFormReset,
      actionrequested: onFormActionRequested,
      actionprevented: onFormActionPrevented,
      actionstart: onFormActionStart,
      actionabort: onFormActionAbort,
      actionerror: onFormActionError,
      actionend: onFormActionEnd,
    });
  }, [
    onFormReset,
    onFormActionRequested,
    onFormActionPrevented,
    onFormActionStart,
    onFormActionAbort,
    onFormActionError,
    onFormActionEnd,
  ]);
};

const debugUIState = (...args) => {
};
const debugUIGroup = (...args) => {
};

const UIStateControllerContext = createContext();
const UIStateContext = createContext();
const ParentUIStateControllerContext = createContext();

const FieldNameContext = createContext();
const ReadOnlyContext = createContext();
const DisabledContext = createContext();
const RequiredContext = createContext();
const LoadingContext = createContext();
const LoadingElementContext = createContext();

/**
 * UI State Controller Hook
 *
 * Manages the relationship between external state (props) and UI state (what user sees).
 * Allows UI state to diverge temporarily for responsive interactions, with mechanisms
 * to sync back to external state when needed.
 *
 * Key features:
 * - Immediate UI updates for responsive interactions
 * - State divergence with sync capabilities (resetUIState)
 * - Group integration for coordinated form inputs
 * - External control via custom events (onsetuistate/onresetuistate)
 * - Error recovery and form reset support
 *
 * See README.md for detailed usage examples and patterns.
 */
const useUIStateController = (
  props,
  componentType,
  {
    statePropName = "value",
    defaultStatePropName = "defaultValue",
    fallbackState = "",
    getStateFromProp = (prop) => prop,
    getPropFromState = (state) => state,
    getStateFromParent,
  } = {},
) => {
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const formContext = useContext(FormContext);
  const { id, name, onUIStateChange, action } = props;
  const uncontrolled = !formContext && !action;
  const [navState, setNavState] = useNavState$1(id);

  const uiStateControllerRef = useRef();
  const hasStateProp = Object.hasOwn(props, statePropName);
  const state = props[statePropName];
  const defaultState = props[defaultStatePropName];
  const stateInitial = useInitialValue(() => {
    if (hasStateProp) {
      // controlled by state prop ("value" or "checked")
      return getStateFromProp(state);
    }
    if (defaultState) {
      // not controlled but want an initial state (a value or being checked)
      return getStateFromProp(defaultState);
    }
    if (formContext && navState) {
      // not controlled but want to use value from nav state
      // (I think this should likely move earlier to win over the hasUIStateProp when it's undefined)
      return getStateFromProp(navState);
    }
    if (parentUIStateController && getStateFromParent) {
      return getStateFromParent(parentUIStateController);
    }
    return getStateFromProp(fallbackState);
  });

  /**
   * This check is needed only for basic field because
   * When using action/form we consider the action/form code
   * will have a side effect that will re-render the component with the up-to-date state
   *
   * In practice we set the checked from the backend state
   * We use action to fetch the new state and update the local state
   * The component re-renders so it's the action/form that is considered as responsible
   * to update the state and as a result allowed to have "checked"/"value" prop without "onUIStateChange"
   */
  const readOnly =
    uncontrolled &&
    hasStateProp &&
    !onUIStateChange &&
    !parentUIStateController;

  const [
    notifyParentAboutChildMount,
    notifyParentAboutChildUIStateChange,
    notifyParentAboutChildUnmount,
  ] = useParentControllerNotifiers(
    parentUIStateController,
    uiStateControllerRef);
  useLayoutEffect(() => {
    notifyParentAboutChildMount();
    return notifyParentAboutChildUnmount;
  }, []);

  const existingUIStateController = uiStateControllerRef.current;
  if (existingUIStateController) {
    existingUIStateController._checkForUpdates({
      readOnly,
      name,
      onUIStateChange,
      getPropFromState,
      getStateFromProp,
      hasStateProp,
      stateInitial,
      state,
    });
    return existingUIStateController;
  }
  debugUIState(
    `Creating "${componentType}" ui state controller - initial state:`,
    JSON.stringify(stateInitial),
  );
  const [publishUIState, subscribeUIState] = createPubSub();
  const uiStateController = {
    _checkForUpdates: ({
      readOnly,
      name,
      onUIStateChange,
      getPropFromState,
      getStateFromProp,
      hasStateProp,
      stateInitial,
      state,
    }) => {
      uiStateController.readOnly = readOnly;
      uiStateController.name = name;
      uiStateController.onUIStateChange = onUIStateChange;
      uiStateController.getPropFromState = getPropFromState;
      uiStateController.getStateFromProp = getStateFromProp;
      uiStateController.stateInitial = stateInitial;

      if (hasStateProp) {
        uiStateController.hasStateProp = true;
        const currentState = uiStateController.state;
        const stateFromProp = getStateFromProp(state);
        if (stateFromProp !== currentState) {
          uiStateController.state = stateFromProp;
          uiStateController.setUIState(
            uiStateController.getPropFromState(state),
            new CustomEvent("state_prop"),
          );
        }
      } else if (uiStateController.hasStateProp) {
        uiStateController.hasStateProp = false;
        uiStateController.state = uiStateController.stateInitial;
      }
    },

    componentType,
    readOnly,
    name,
    hasStateProp,
    state: stateInitial,
    uiState: stateInitial,
    onUIStateChange,
    getPropFromState,
    getStateFromProp,
    setUIState: (prop, e) => {
      const newUIState = uiStateController.getStateFromProp(prop);
      if (formContext) {
        setNavState(prop);
      }
      const currentUIState = uiStateController.uiState;
      if (newUIState === currentUIState) {
        return;
      }
      debugUIState(
        `${componentType}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> updating to ${JSON.stringify(newUIState)}`,
      );
      uiStateController.uiState = newUIState;
      publishUIState(newUIState);
      uiStateController.onUIStateChange?.(newUIState, e);
      notifyParentAboutChildUIStateChange(e);
    },
    resetUIState: (e) => {
      const currentState = uiStateController.state;
      uiStateController.setUIState(currentState, e);
    },
    actionEnd: () => {
      if (formContext) {
        setNavState(undefined);
      }
    },
    subscribe: subscribeUIState,
  };
  uiStateControllerRef.current = uiStateController;
  return uiStateController;
};

const NO_PARENT = [() => {}, () => {}, () => {}];
const useParentControllerNotifiers = (
  parentUIStateController,
  uiStateControllerRef,
  componentType,
) => {
  return useMemo(() => {
    if (!parentUIStateController) {
      return NO_PARENT;
    }

    parentUIStateController.componentType;
    const notifyParentAboutChildMount = () => {
      const uiStateController = uiStateControllerRef.current;
      parentUIStateController.registerChild(uiStateController);
    };

    const notifyParentAboutChildUIStateChange = (e) => {
      const uiStateController = uiStateControllerRef.current;
      parentUIStateController.onChildUIStateChange(uiStateController, e);
    };

    const notifyParentAboutChildUnmount = () => {
      const uiStateController = uiStateControllerRef.current;
      parentUIStateController.unregisterChild(uiStateController);
    };

    return [
      notifyParentAboutChildMount,
      notifyParentAboutChildUIStateChange,
      notifyParentAboutChildUnmount,
    ];
  }, []);
};

/**
 * UI Group State Controller Hook
 *
 * This hook manages a collection of child UI state controllers and aggregates their states
 * into a unified group state. It provides a way to coordinate multiple form inputs that
 * work together as a logical unit.
 *
 * What it provides:
 *
 * 1. **Child State Aggregation**:
 *    - Collects state from multiple child UI controllers
 *    - Combines them into a single meaningful group state
 *    - Updates group state automatically when any child changes
 *
 * 2. **Child Filtering**:
 *    - Can filter which child controllers to include based on component type
 *    - Useful for mixed content where only specific inputs matter
 *    - Enables type-safe aggregation patterns
 *
 * 3. **Group Operations**:
 *    - Provides `resetUIState()` that cascades to all children
 *    - Enables group-level operations like "clear all" or "reset form section"
 *    - Maintains consistency across related inputs
 *
 * 4. **External State Management**:
 *    - Notifies external code of group state changes via `onUIStateChange`
 *    - Allows external systems to react to group-level state changes
 *    - Supports complex form validation and submission logic
 *
 * Why use it:
 * - When you have multiple related inputs that should be treated as one logical unit
 * - For implementing checkbox lists, radio groups, or form sections
 * - When you need to perform operations on multiple inputs simultaneously
 * - To aggregate input states for validation or submission
 *
 * How it works:
 * - Child controllers automatically register themselves when mounted
 * - Group controller listens for child state changes and re-aggregates
 * - Custom aggregation function determines how child states combine
 * - Group state updates trigger notifications to external code
 *
 * @param {Object} props - Component props containing onUIStateChange callback
 * @param {string} componentType - Type identifier for this group controller
 * @param {Object} config - Configuration object
 * @param {string} [config.childComponentType] - Filter children by this type (e.g., "checkbox")
 * @param {Function} config.aggregateChildStates - Function to aggregate child states
 * @param {any} [config.emptyState] - State to use when no children have values
 * @returns {Object} UI group state controller
 *
 * Usage Examples:
 * - **Checkbox List**: Aggregates multiple checkboxes into array of checked values
 * - **Radio Group**: Manages radio buttons to ensure single selection
 * - **Form Section**: Groups related inputs for validation and reset operations
 * - **Dynamic Lists**: Handles variable number of repeated input groups
 */

const useUIGroupStateController = (
  props,
  componentType,
  { childComponentType, aggregateChildStates, emptyState = undefined },
) => {
  if (typeof aggregateChildStates !== "function") {
    throw new TypeError("aggregateChildStates must be a function");
  }
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const { onUIStateChange, name, value } = props;
  const childUIStateControllerArrayRef = useRef([]);
  const childUIStateControllerArray = childUIStateControllerArrayRef.current;
  const uiStateControllerRef = useRef();

  const groupIsRenderingRef = useRef(false);
  const pendingChangeRef = useRef(false);
  groupIsRenderingRef.current = true;
  pendingChangeRef.current = false;

  const [
    notifyParentAboutChildMount,
    notifyParentAboutChildUIStateChange,
    notifyParentAboutChildUnmount,
  ] = useParentControllerNotifiers(
    parentUIStateController,
    uiStateControllerRef);
  useLayoutEffect(() => {
    notifyParentAboutChildMount();
    return notifyParentAboutChildUnmount;
  }, []);

  const onChange = (_, e) => {
    if (groupIsRenderingRef.current) {
      pendingChangeRef.current = true;
      return;
    }
    const newUIState = aggregateChildStates(
      childUIStateControllerArray,
      emptyState,
    );
    const uiStateController = uiStateControllerRef.current;
    uiStateController.setUIState(newUIState, e);
  };

  useLayoutEffect(() => {
    groupIsRenderingRef.current = false;
    if (pendingChangeRef.current) {
      pendingChangeRef.current = false;
      onChange(
        null,
        new CustomEvent(`${componentType}_batched_ui_state_update`),
      );
    }
  });

  const existingUIStateController = uiStateControllerRef.current;
  if (existingUIStateController) {
    existingUIStateController.name = name;
    existingUIStateController.onUIStateChange = onUIStateChange;
    existingUIStateController.value = value;
    return existingUIStateController;
  }

  const [publishUIState, subscribeUIState] = createPubSub();
  const isMonitoringChild = (childUIStateController) => {
    if (childComponentType === "*") {
      return true;
    }
    return childUIStateController.componentType === childComponentType;
  };
  const uiStateController = {
    componentType,
    name,
    value,
    onUIStateChange,
    uiState: emptyState,
    setUIState: (newUIState, e) => {
      const currentUIState = uiStateController.uiState;
      if (newUIState === currentUIState) {
        return;
      }
      uiStateController.uiState = newUIState;
      debugUIGroup(
        `${componentType}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> updates from ${JSON.stringify(currentUIState)} to ${JSON.stringify(newUIState)}`,
      );
      publishUIState(newUIState);
      uiStateController.onUIStateChange?.(newUIState, e);
      notifyParentAboutChildUIStateChange(e);
    },
    registerChild: (childUIStateController) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      const childComponentType = childUIStateController.componentType;
      childUIStateControllerArray.push(childUIStateController);
      debugUIGroup(
        `${componentType}.registerChild("${childComponentType}") -> registered (total: ${childUIStateControllerArray.length})`,
      );
      onChange(
        childUIStateController,
        new CustomEvent(`${childComponentType}_mount`),
      );
    },
    onChildUIStateChange: (childUIStateController, e) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      debugUIGroup(
        `${componentType}.onChildUIStateChange("${childComponentType}") to ${JSON.stringify(
          childUIStateController.uiState,
        )}`,
      );
      onChange(childUIStateController, e);
    },
    unregisterChild: (childUIStateController) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      const childComponentType = childUIStateController.componentType;
      const index = childUIStateControllerArray.indexOf(childUIStateController);
      if (index === -1) {
        return;
      }
      childUIStateControllerArray.splice(index, 1);
      debugUIGroup(
        `${componentType}.unregisterChild("${childComponentType}") -> unregisteed (remaining: ${childUIStateControllerArray.length})`,
      );
      onChange(
        childUIStateController,
        new CustomEvent(`${childComponentType}_unmount`),
      );
    },
    resetUIState: (e) => {
      // we should likely batch the changes that will be reported for performances
      for (const childUIStateController of childUIStateControllerArray) {
        childUIStateController.resetUIState(e);
      }
    },
    actionEnd: (e) => {
      for (const childUIStateController of childUIStateControllerArray) {
        childUIStateController.actionEnd(e);
      }
    },
    subscribe: subscribeUIState,
  };
  uiStateControllerRef.current = uiStateController;
  return uiStateController;
};

/**
 * Hook to track UI state from a UI state controller
 *
 * This hook allows external code to react to UI state changes without
 * causing the controller itself to re-create. It returns the current UI state
 * and will cause re-renders when the UI state changes.
 *
 * @param {Object} uiStateController - The UI state controller to track
 * @returns {any} The current UI state
 */
const useUIState = (uiStateController) => {
  const [trackedUIState, setTrackedUIState] = useState(
    uiStateController.uiState,
  );

  useLayoutEffect(() => {
    // Subscribe to UI state changes
    const unsubscribe = uiStateController.subscribe(setTrackedUIState);

    // Sync with current state in case it changed before subscription
    setTrackedUIState(uiStateController.uiState);

    return unsubscribe;
  }, [uiStateController]);

  return trackedUIState;
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_button {
      --button-outline-width: 1px;
      --button-border-width: 1px;
      --button-border-radius: 2px;
      --button-padding-x: 6px;
      --button-padding-y: 1px;
      /* default */
      --button-outline-color: var(--navi-focus-outline-color);
      --button-loader-color: var(--navi-loader-color);
      --button-border-color: light-dark(#767676, #8e8e93);
      --button-background-color: light-dark(#f3f4f6, #2d3748);
      --button-color: currentColor;
      --button-cursor: pointer;

      /* Hover */
      --button-border-color-hover: color-mix(
        in srgb,
        var(--button-border-color) 70%,
        black
      );
      --button-background-color-hover: color-mix(
        in srgb,
        var(--button-background-color) 95%,
        black
      );
      --button-color-hover: var(--button-color);
      /* Active */
      --button-border-color-active: color-mix(
        in srgb,
        var(--button-border-color) 90%,
        black
      );
      /* Readonly */
      --button-border-color-readonly: color-mix(
        in srgb,
        var(--button-border-color) 30%,
        white
      );
      --button-background-color-readonly: var(--button-background-color);
      --button-color-readonly: color-mix(
        in srgb,
        var(--button-color) 30%,
        transparent
      );
      /* Disabled */
      --button-border-color-disabled: var(--button-border-color-readonly);
      --button-background-color-disabled: var(
        --button-background-color-readonly
      );
      --button-color-disabled: var(--button-color-readonly);
    }
  }

  .navi_button {
    /* Internal css vars are the one controlling final values */
    /* allowing to override them on interactions (like hover, disabled, etc.) */
    --x-button-outline-width: var(--button-outline-width);
    --x-button-border-radius: var(--button-border-radius);
    --x-button-border-width: var(--button-border-width);
    --x-button-outer-width: calc(
      var(--x-button-border-width) + var(--x-button-outline-width)
    );
    --x-button-outline-color: var(--button-outline-color);
    --x-button-border-color: var(--button-border-color);
    --x-button-background: var(--button-background);
    --x-button-background-color: var(--button-background-color);
    --x-button-color: var(--button-color);
    --x-button-cursor: var(--button-cursor);

    position: relative;
    box-sizing: border-box;
    aspect-ratio: inherit;
    padding: 0;
    vertical-align: middle;
    background: none;
    border: none;
    border-radius: var(--x-button-border-radius);
    outline: none;
    cursor: var(--x-button-cursor);

    &[data-icon] {
      --button-padding: 0;
    }

    .navi_button_content {
      position: relative;
      display: inherit;
      box-sizing: border-box;
      aspect-ratio: inherit;
      width: 100%;
      height: 100%;
      padding-top: var(
        --button-padding-top,
        var(--button-padding-y, var(--button-padding))
      );
      padding-right: var(
        --button-padding-right,
        var(--button-padding-x, var(--button-padding))
      );
      padding-bottom: var(
        --button-padding-bottom,
        var(--button-padding-y, var(--button-padding))
      );
      padding-left: var(
        --button-padding-left,
        var(--button-padding-x, var(--button-padding))
      );
      align-items: inherit;
      justify-content: inherit;
      color: var(--x-button-color);
      background: var(--x-button-background);
      background-color: var(
        --x-button-background-color,
        var(--x-button-background)
      );

      border-width: var(--x-button-outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--x-button-border-radius);
      outline-width: var(--x-button-border-width);
      outline-style: solid;
      outline-color: var(--x-button-border-color);
      outline-offset: calc(-1 * (var(--x-button-border-width)));
      transition-property: transform;
      transition-duration: 0.15s;
      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);

      .navi_button_shadow {
        position: absolute;
        inset: calc(-1 * var(--x-button-outer-width));
        border-radius: inherit;
        pointer-events: none;
      }
    }

    &[data-reveal-on-interaction] {
      --x-button-background-color: transparent;
      --x-button-border-color: transparent;
    }

    /* Hover */
    &[data-hover] {
      --x-button-border-color: var(--button-border-color-hover);
      --x-button-background-color: var(--button-background-color-hover);
      --x-button-color: var(--button-color-hover);
    }
    &[data-nohover] {
      --x-button-border-color: var(--button-border-color);
      --x-button-background-color: var(--button-background-color);
      --x-button-color: var(--button-color);
    }
    /* Active */
    &[data-active] {
      --x-button-outline-color: var(--button-border-color-active);
    }
    &[data-active] {
      .navi_button_content {
        transform: scale(0.9);
      }
    }
    &[data-active] {
      .navi_button_shadow {
        box-shadow:
          inset 0 3px 6px rgba(0, 0, 0, 0.2),
          inset 0 1px 2px rgba(0, 0, 0, 0.3),
          inset 0 0 0 1px rgba(0, 0, 0, 0.1),
          inset 2px 0 4px rgba(0, 0, 0, 0.1),
          inset -2px 0 4px rgba(0, 0, 0, 0.1);
      }
    }
    /* Readonly */
    &[data-readonly] {
      --x-button-border-color: var(--button-border-color-readonly);
      --x-button-background-color: var(--button-background-color-readonly);
      --x-button-color: var(--button-color-readonly);
      --x-button-cursor: default;
    }
    /* Focus */
    &[data-focus-visible] {
      --x-button-border-color: var(--x-button-outline-color);
    }
    &[data-focus-visible] {
      .navi_button_content {
        outline-width: var(--x-button-outer-width);
        outline-offset: calc(-1 * var(--x-button-outer-width));
      }
    }
    /* Disabled */
    &[data-disabled] {
      --x-button-border-color: var(--button-border-color-disabled);
      --x-button-background-color: var(--button-background-color-disabled);
      --x-button-color: var(--button-color-disabled);
      --x-button-cursor: default;

      color: unset;

      /* Remove active effects */
      .navi_button_content {
        transform: none;

        .navi_button_shadow {
          box-shadow: none;
        }
      }
    }
    /* Discrete variant */
    &[data-discrete] {
      --x-button-background-color: transparent;
      --x-button-border-color: transparent;

      &[data-hover] {
        --x-button-border-color: var(--button-border-color-hover);
      }
      &[data-nohover] {
        --x-button-border-color: transparent;
      }
      &[data-readonly] {
        --x-button-border-color: transparent;
      }
      &[data-disabled] {
        --x-button-border-color: transparent;
      }
    }
  }
  /* Callout (info, warning, error) */
  .navi_button[data-callout] {
    --x-button-border-color: var(--callout-color);
  }
  .navi_button > img {
    border-radius: inherit;
  }
`;
const Button = props => {
  return renderActionableComponent(props, {
    Basic: ButtonBasic,
    WithAction: ButtonWithAction,
    WithActionInsideForm: ButtonWithActionInsideForm
  });
};
const ButtonStyleCSSVars = {
  "outlineWidth": "--button-outline-width",
  "borderWidth": "--button-border-width",
  "borderRadius": "--button-border-radius",
  "border": "--button-border",
  "padding": "--button-padding",
  "paddingX": "--button-padding-x",
  "paddingY": "--button-padding-y",
  "paddingTop": "--button-padding-top",
  "paddingRight": "--button-padding-right",
  "paddingBottom": "--button-padding-bottom",
  "paddingLeft": "--button-padding-left",
  "borderColor": "--button-border-color",
  "background": "--button-background",
  "backgroundColor": "--button-background-color",
  "color": "--button-color",
  ":hover": {
    backgroundColor: "--button-background-color-hover",
    borderColor: "--button-border-color-hover",
    color: "--button-color-hover"
  },
  ":active": {
    borderColor: "--button-border-color-active"
  },
  ":read-only": {
    backgroundColor: "--button-background-color-readonly",
    borderColor: "--button-border-color-readonly",
    color: "--button-color-readonly"
  },
  ":disabled": {
    backgroundColor: "--button-background-color-disabled",
    borderColor: "--button-border-color-disabled",
    color: "--button-color-disabled"
  }
};
const ButtonPseudoClasses = [":hover", ":active", ":focus", ":focus-visible", ":read-only", ":disabled", ":-navi-loading"];
const ButtonPseudoElements = ["::-navi-loader"];
const ButtonBasic = props => {
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const {
    readOnly,
    disabled,
    loading,
    autoFocus,
    // visual
    icon,
    revealOnInteraction = icon,
    discrete = icon && !revealOnInteraction,
    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  useAutoFocus(ref, autoFocus);
  const remainingProps = useConstraints(ref, rest);
  const innerLoading = loading || contextLoading && contextLoadingElement === ref.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading;
  const innerDisabled = disabled || contextDisabled;
  const renderButtonContent = buttonProps => {
    return jsxs(Text, {
      ...buttonProps,
      className: "navi_button_content",
      children: [children, jsx("span", {
        className: "navi_button_shadow"
      })]
    });
  };
  const renderButtonContentMemoized = useCallback(renderButtonContent, [children]);
  return jsxs(Box, {
    "data-readonly-silent": innerLoading ? "" : undefined,
    ...remainingProps,
    as: "button",
    ref: ref,
    "data-icon": icon ? "" : undefined,
    "data-reveal-on-interaction": revealOnInteraction ? "" : undefined,
    "data-discrete": discrete ? "" : undefined,
    "data-callout-arrow-x": "center",
    "aria-busy": innerLoading
    // style management
    ,
    baseClassName: "navi_button",
    styleCSSVars: ButtonStyleCSSVars,
    pseudoClasses: ButtonPseudoClasses,
    pseudoElements: ButtonPseudoElements,
    basePseudoState: {
      ":read-only": innerReadOnly,
      ":disabled": innerDisabled,
      ":-navi-loading": innerLoading
    },
    visualSelector: ".navi_button_content",
    hasChildFunction: true,
    children: [jsx(LoaderBackground, {
      loading: innerLoading,
      inset: -1,
      color: "var(--button-loader-color)"
    }), renderButtonContentMemoized]
  });
};
const ButtonWithAction = props => {
  const {
    action,
    loading,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const boundAction = useAction(action);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect
  });
  const innerLoading = loading || actionLoading;
  useActionEvents(ref, {
    onPrevented: onActionPrevented,
    onRequested: e => forwardActionRequested(e, boundAction),
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd
  });
  return jsx(ButtonBasic
  // put data-action first to help find it in devtools
  , {
    "data-action": boundAction.name,
    ...rest,
    ref: ref,
    loading: innerLoading,
    children: children
  });
};
const ButtonWithActionInsideForm = props => {
  const formAction = useContext(FormActionContext);
  const {
    type,
    action,
    loading,
    children,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const formParamsSignal = getActionPrivateProperties(formAction).paramsSignal;
  const actionBoundToFormParams = useAction(action, formParamsSignal);
  const {
    loading: actionLoading
  } = useActionStatus(actionBoundToFormParams);
  const innerLoading = loading || actionLoading;
  useFormEvents(ref, {
    onFormActionPrevented: e => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionPrevented?.(e);
      }
    },
    onFormActionStart: e => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionStart?.(e);
      }
    },
    onFormActionAbort: e => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionAbort?.(e);
      }
    },
    onFormActionError: e => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionError?.(e.detail.error);
      }
    },
    onFormActionEnd: e => {
      if (e.detail.action === actionBoundToFormParams) {
        onActionEnd?.(e);
      }
    }
  });
  return jsx(ButtonBasic, {
    "data-action": actionBoundToFormParams.name,
    ...rest,
    ref: ref,
    type: type,
    loading: innerLoading,
    onactionrequested: e => {
      forwardActionRequested(e, actionBoundToFormParams, e.target.form);
    },
    children: children
  });
};

const CloseSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    children: jsx("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z",
      fill: "currentColor"
    })
  });
};

const SuccessSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 16 16",
    fill: "currentColor",
    children: jsx("path", {
      d: "M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm1.5 0a6.5 6.5 0 1 0 13 0 6.5 6.5 0 0 0-13 0Zm10.28-1.72-4.5 4.5a.75.75 0 0 1-1.06 0l-2-2a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018l1.47 1.47 3.97-3.97a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042Z"
    })
  });
};
const ErrorSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 16 16",
    fill: "currentColor",
    children: jsx("path", {
      d: "M4.47.22A.749.749 0 0 1 5 0h6c.199 0 .389.079.53.22l4.25 4.25c.141.14.22.331.22.53v6a.749.749 0 0 1-.22.53l-4.25 4.25A.749.749 0 0 1 11 16H5a.749.749 0 0 1-.53-.22L.22 11.53A.749.749 0 0 1 0 11V5c0-.199.079-.389.22-.53Zm.84 1.28L1.5 5.31v5.38l3.81 3.81h5.38l3.81-3.81V5.31L10.69 1.5ZM8 4a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 8 4Zm0 8a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
    })
  });
};
const InfoSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 16 16",
    fill: "currentColor",
    children: jsx("path", {
      d: "M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
    })
  });
};
const WarningSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 16 16",
    fill: "currentColor",
    children: jsx("path", {
      d: "M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z"
    })
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_message_box {
      --background-color-info: var(--navi-info-color-light);
      --color-info: var(--navi-info-color);
      --background-color-success: var(--navi-success-color-light);
      --color-success: var(--navi-success-color);
      --background-color-warning: var(--navi-warning-color-light);
      --color-warning: var(--navi-warning-color);
      --background-color-error: var(--navi-error-color-light);
      --color-error: var(--navi-error-color);
    }
  }

  .navi_message_box {
    --x-message-background-color: var(--background-color-info);
    --x-message-color: var(--color-info);
    /* color: var(--x-color); */
    background-color: var(--x-message-background-color);
  }

  .navi_message_box[data-status-info] {
    --x-message-background-color: var(--background-color-info);
    --x-message-color: var(--color-info);
  }
  .navi_message_box[data-status-success] {
    --x-message-background-color: var(--background-color-success);
    --x-message-color: var(--color-success);
  }
  .navi_message_box[data-status-warning] {
    --x-message-background-color: var(--background-color-warning);
    --x-message-color: var(--color-warning);
  }
  .navi_message_box[data-status-error] {
    --x-message-background-color: var(--background-color-error);
    --x-message-color: var(--color-error);
  }

  .navi_message_box[data-left-stripe] {
    border-left: 6px solid var(--x-message-color);
    border-top-left-radius: 6px;
    border-bottom-left-radius: 6px;
  }
`;
const MessageBoxPseudoClasses = [":-navi-status-info", ":-navi-status-success", ":-navi-status-warning", ":-navi-status-error"];
const MessageBoxStatusContext = createContext();
const MessageBoxReportTitleChildContext = createContext();
const MessageBox = ({
  status = "info",
  padding = "sm",
  icon,
  leftStripe,
  children,
  onClose,
  ...rest
}) => {
  const [hasTitleChild, setHasTitleChild] = useState(false);
  const innerLeftStripe = leftStripe === undefined ? hasTitleChild : leftStripe;
  if (icon === true) {
    icon = status === "info" ? jsx(InfoSvg, {}) : status === "success" ? jsx(SuccessSvg, {}) : status === "warning" ? jsx(WarningSvg, {}) : status === "error" ? jsx(ErrorSvg, {}) : null;
  } else if (typeof icon === "function") {
    const Comp = icon;
    icon = jsx(Comp, {});
  }
  return jsx(Box, {
    as: "div",
    role: status === "info" ? "status" : "alert",
    "data-left-stripe": innerLeftStripe ? "" : undefined,
    inline: true,
    column: true,
    alignY: "start",
    spacing: "sm",
    ...rest,
    className: withPropsClassName("navi_message_box", rest.className),
    padding: padding,
    pseudoClasses: MessageBoxPseudoClasses,
    basePseudoState: {
      ":-navi-status-info": status === "info",
      ":-navi-status-success": status === "success",
      ":-navi-status-warning": status === "warning",
      ":-navi-status-error": status === "error"
    },
    children: jsx(MessageBoxStatusContext.Provider, {
      value: status,
      children: jsxs(MessageBoxReportTitleChildContext.Provider, {
        value: setHasTitleChild,
        children: [icon && jsx(Icon, {
          color: "var(--x-message-color)",
          children: icon
        }), jsx(Text, {
          children: children
        }), onClose && jsx(Button, {
          action: onClose,
          icon: true,
          border: "none",
          alignX: "center",
          alignY: "center",
          style: {
            ":hover": {
              backgroundColor: "rgba(0, 0, 0, 0.1)"
            }
          },
          children: jsx(Icon, {
            children: jsx(CloseSvg, {})
          })
        })]
      })
    })
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_message_box {
    .navi_title {
      margin-top: 0;
      margin-bottom: var(--navi-s);
      color: var(--x-message-color);
    }
  }
`;
const TitleLevelContext = createContext();
const useTitleLevel = () => {
  return useContext(TitleLevelContext);
};
const TitlePseudoClasses = [":hover"];
const Title = props => {
  const messageBoxStatus = useContext(MessageBoxStatusContext);
  const innerAs = props.as || (messageBoxStatus ? "h4" : "h1");
  const titleLevel = parseInt(innerAs.slice(1));
  const reportTitleToMessageBox = useContext(MessageBoxReportTitleChildContext);
  reportTitleToMessageBox?.(true);
  return jsx(TitleLevelContext.Provider, {
    value: titleLevel,
    children: jsx(Text, {
      bold: true,
      className: withPropsClassName("navi_title"),
      as: messageBoxStatus ? "h4" : "h1",
      ...props,
      pseudoClasses: TitlePseudoClasses,
      children: props.children
    })
  });
};

/**
 * Hook that reactively checks if a URL is visited.
 * Re-renders when the visited URL set changes.
 *
 * @param {string} url - The URL to check
 * @returns {boolean} Whether the URL has been visited
 */
const useIsVisited = (url) => {
  return useMemo(() => {
    // Access the signal to create reactive dependency
    // eslint-disable-next-line no-unused-expressions
    visitedUrlsSignal.value;

    return isVisited(url);
  }, [url, visitedUrlsSignal.value]);
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_link {
      --link-border-radius: 2px;
      --link-outline-color: var(--navi-focus-outline-color);
      --link-loader-color: var(--navi-loader-color);
      --link-color: rgb(0, 0, 238);
      --link-color-visited: light-dark(#6a1b9a, #ab47bc);
      --link-color-active: red;
      --link-text-decoration: underline;
      --link-text-decoration-hover: var(--link-text-decoration);
      --link-cursor: pointer;
    }
  }

  .navi_link {
    --x-link-color: var(--link-color);
    --x-link-color-hover: var(--link-color-hover, var(--link-color));
    --x-link-color-visited: var(--link-color-visited);
    --x-link-color-active: var(--link-color-active);
    --x-link-text-decoration: var(--link-text-decoration);
    --x-link-text-decoration-hover: var(--link-text-decoration-hover);
    --x-link-cursor: var(--link-cursor);

    position: relative;
    aspect-ratio: inherit;
    color: var(--x-link-color);
    text-decoration: var(--x-link-text-decoration);
    border-radius: var(--link-border-radius);
    outline-width: 0;
    outline-style: solid;
    outline-color: var(--link-outline-color);
    cursor: var(--x-link-cursor);

    /* Current */
    &[data-href-current] {
      --x-link-cursor: default;
    }
    /* Hover */
    &[data-hover] {
      --x-link-color: var(--x-link-color-hover);
      --x-link-text-decoration: var(--x-link-text-decoration-hover);
    }
    /* Focus */
    &[data-focus],
    &[data-focus-visible] {
      position: relative;
      z-index: 1; /* Ensure focus outline is above other elements */
    }
    &[data-focus-visible] {
      outline-width: 2px;
    }
    /* Visited */
    &[data-visited] {
      --x-link-color: var(--x-link-color-visited);
      &[data-anchor] {
        /* Visited is meant to help user see what links he already seen / what remains to discover */
        /* But anchor links are already in the area user is currently seeing */
        /* No need for a special color for visited anchors */
        --x-link-color: var(--link-color);
      }
    }
    /* Selected */
    &[aria-selected] {
      position: relative;
    }
    &[aria-selected="true"] {
      background-color: light-dark(#bbdefb, #2563eb);
    }
    &[aria-selected] input[type="checkbox"] {
      position: absolute;
      opacity: 0;
    }
    /* Active */
    &[data-active] {
      /* Redefine it otherwise [data-visited] prevails */
      --x-link-color: var(--x-link-color-active);
    }
    /* Readonly */
    &[data-readonly] > * {
      opacity: 0.5;
    }
    /* Disabled */
    &[data-disabled] {
      pointer-events: none;
    }
    &[data-disabled] > * {
      opacity: 0.5;
    }
    &[data-discrete] {
      --link-color: inherit;
      --link-text-decoration: none;
      --x-link-color: var(--link-color);
    }
    /* Reveal on interaction */
    &[data-reveal-on-interaction] {
      position: absolute !important;
      top: 0;
      left: -1em;
      width: 1em;
      height: 1em;
      font-size: 1em;
      opacity: 0;
      /* The anchor link is displayed only on :hover */
      /* So we "need" a visual indicator when it's shown by focus */
      /* (even if it's focused by mouse aka not :focus-visible) */
      /* otherwise we might wonder why we see this UI element */
      &[data-focus] {
        outline-width: 2px;
      }
      &[data-hover],
      &[data-focus],
      &[data-focus-visible] {
        opacity: 1;
      }

      .navi_icon {
        vertical-align: top;
      }
    }
  }

  *:hover > .navi_link[data-reveal-on-interaction] {
    opacity: 1;
  }

  .navi_text .navi_link[data-reveal-on-interaction] {
    top: 0.1em;
  }
  .navi_title .navi_link[data-reveal-on-interaction] {
    top: 0.25em;
  }
`;
const LinkStyleCSSVars = {
  "outlineColor": "--link-outline-color",
  "borderRadius": "--link-border-radius",
  "color": "--link-color",
  "cursor": "--link-cursor",
  "textDecoration": "--link-text-decoration",
  ":hover": {
    color: "--link-color-hover",
    textDecoration: "--link-text-decoration-hover"
  },
  ":active": {
    color: "--link-color-active"
  }
};
const LinkPseudoClasses = [":hover", ":active", ":focus", ":focus-visible", ":read-only", ":disabled", ":visited", ":-navi-loading", ":-navi-href-internal", ":-navi-href-external", ":-navi-href-anchor", ":-navi-href-current"];
const LinkPseudoElements = ["::-navi-loader"];
Object.assign(PSEUDO_CLASSES, {
  ":-navi-href-internal": {
    attribute: "data-href-internal"
  },
  ":-navi-href-external": {
    attribute: "data-href-external"
  },
  ":-navi-href-anchor": {
    attribute: "data-href-anchor"
  },
  ":-navi-href-current": {
    attribute: "data-href-current"
  }
});
const Link = props => {
  return renderActionableComponent(props, {
    Basic: LinkBasic,
    WithAction: LinkWithAction
  });
};
const LinkBasic = props => {
  const selectionContext = useContext(SelectionContext);
  if (selectionContext) {
    return jsx(LinkWithSelection, {
      ...props
    });
  }
  return jsx(LinkPlain, {
    ...props
  });
};
const LinkPlain = props => {
  const titleLevel = useContext(TitleLevelContext);
  const {
    loading,
    readOnly,
    disabled,
    autoFocus,
    spaceToClick = true,
    onClick,
    onKeyDown,
    href,
    target,
    rel,
    preventDefault,
    anchor,
    // visual
    discrete,
    blankTargetIcon,
    anchorIcon,
    icon,
    spacing,
    revealOnInteraction = Boolean(titleLevel),
    hrefFallback = !anchor,
    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const visited = useIsVisited(href);
  useAutoFocus(ref, autoFocus);
  const remainingProps = useConstraints(ref, rest);
  const shouldDimColor = readOnly || disabled;
  useDimColorWhen(ref, shouldDimColor);
  // subscribe to document url to re-render and re-compute getHrefTargetInfo
  useDocumentUrl();
  const {
    isSameSite,
    isAnchor,
    isCurrent
  } = getHrefTargetInfo(href);
  const innerTarget = target === undefined ? isSameSite ? "_self" : "_blank" : target;
  const innerRel = rel === undefined ? isSameSite ? undefined : "noopener noreferrer" : rel;
  let innerIcon;
  if (icon === undefined) {
    // Check for special protocol or domain-specific icons first
    if (href?.startsWith("tel:")) {
      innerIcon = jsx(PhoneSvg, {});
    } else if (href?.startsWith("sms:")) {
      innerIcon = jsx(SmsSvg, {});
    } else if (href?.startsWith("mailto:")) {
      innerIcon = jsx(EmailSvg, {});
    } else if (href?.includes("github.com")) {
      innerIcon = jsx(GithubSvg, {});
    } else {
      // Fall back to default icon logic
      const innerBlankTargetIcon = blankTargetIcon === undefined ? innerTarget === "_blank" : blankTargetIcon;
      const innerAnchorIcon = anchorIcon === undefined ? isAnchor : anchorIcon;
      if (innerBlankTargetIcon) {
        innerIcon = innerBlankTargetIcon === true ? jsx(LinkBlankTargetSvg, {}) : innerBlankTargetIcon;
      } else if (innerAnchorIcon) {
        innerIcon = innerAnchorIcon === true ? jsx(LinkAnchorSvg, {}) : anchorIcon;
      }
    }
  } else {
    innerIcon = icon;
  }
  const innerChildren = children || (hrefFallback ? href : children);
  return jsxs(Box, {
    as: "a",
    color: anchor && !innerChildren ? "inherit" : undefined,
    id: anchor ? href.slice(1) : undefined,
    ...remainingProps,
    ref: ref,
    href: href,
    rel: innerRel,
    target: innerTarget === "_self" ? undefined : target,
    "aria-busy": loading,
    inert: disabled,
    spacing: "pre"
    // Visual
    ,
    "data-anchor": anchor ? "" : undefined,
    "data-reveal-on-interaction": revealOnInteraction ? "" : undefined,
    "data-discrete": discrete ? "" : undefined,
    baseClassName: "navi_link",
    styleCSSVars: LinkStyleCSSVars,
    pseudoClasses: LinkPseudoClasses,
    pseudoElements: LinkPseudoElements,
    basePseudoState: {
      ":read-only": readOnly,
      ":disabled": disabled,
      ":visited": visited,
      ":-navi-loading": loading,
      ":-navi-href-internal": isSameSite,
      ":-navi-href-external": !isSameSite,
      ":-navi-href-anchor": isAnchor,
      ":-navi-href-current": isCurrent
    },
    onClick: e => {
      if (preventDefault) {
        e.preventDefault();
      }
      closeValidationMessage(e.target, "click");
      if (readOnly) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    },
    onKeyDown: e => {
      if (spaceToClick && e.key === " ") {
        e.preventDefault(); // Prevent page scroll
        if (!readOnly && !disabled) {
          e.target.click();
        }
      }
      onKeyDown?.(e);
    },
    children: [jsx(LoaderBackground, {
      loading: loading,
      color: "var(--link-loader-color)"
    }), applySpacingOnTextChildren(innerChildren, spacing), innerIcon && jsx(Icon, {
      marginLeft: innerChildren ? "xxs" : undefined,
      children: innerIcon
    })]
  });
};
const SmsSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
    children: jsx("path", {
      d: "M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z",
      fill: "currentColor"
    })
  });
};
const GithubSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
    children: jsx("path", {
      d: "M12 2C6.48 2 2 6.48 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z",
      fill: "currentColor"
    })
  });
};
const LinkWithSelection = props => {
  const {
    selection,
    selectionController
  } = useContext(SelectionContext);
  const {
    value = props.href,
    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const {
    selected
  } = useSelectableElement(ref, {
    selection,
    selectionController
  });
  return jsx(LinkPlain, {
    ...rest,
    ref: ref,
    "data-value": value,
    "aria-selected": selected,
    children: children
  });
};

/*
 * Custom hook to apply semi-transparent color when an element should be dimmed.
 *
 * Why we do it this way:
 * 1. **Precise timing**: Captures the element's natural color exactly when transitioning
 *    from normal to dimmed state (not before, not after)
 * 2. **Avoids CSS inheritance issues**: CSS `currentColor` and `color-mix()` don't work
 *    reliably for creating true transparency that matches `opacity: 0.5`
 * 3. **Performance**: Only executes when the dimmed state actually changes, not on every render
 * 4. **Color accuracy**: Uses `color(from ... / 0.5)` syntax to preserve the exact visual
 *    appearance of `opacity: 0.5` but applied only to color
 * 5. **Works with any color**: Handles default blue, visited purple, inherited colors, etc.
 * 6. **Maintains focus outline**: Since we only dim the text color, focus outlines remain
 *    fully visible for accessibility
 */
const useDimColorWhen = (elementRef, shouldDim) => {
  const shouldDimPreviousRef = useRef();
  useLayoutEffect(() => {
    const element = elementRef.current;
    const shouldDimPrevious = shouldDimPreviousRef.current;
    if (shouldDim === shouldDimPrevious) {
      return;
    }
    shouldDimPreviousRef.current = shouldDim;
    if (shouldDim) {
      // Capture color just before applying disabled state
      const computedStyle = getComputedStyle(element);
      const currentColor = computedStyle.color;
      element.style.color = `color(from ${currentColor} srgb r g b / 0.5)`;
    } else {
      // Clear the inline style to let CSS take over
      element.style.color = "";
    }
  });
};
const LinkWithAction = props => {
  const {
    shortcuts = [],
    readOnly,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    children,
    loading,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const {
    actionPending
  } = useRequestedActionStatus(ref);
  const innerLoading = Boolean(loading || actionPending);
  useKeyboardShortcuts(ref, shortcuts, {
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd
  });
  return jsx(LinkBasic, {
    ...rest,
    ref: ref,
    loading: innerLoading,
    readOnly: readOnly || actionPending,
    "data-readonly-silent": actionPending && !readOnly ? "" : undefined
    /* When we have keyboard shortcuts the link outline is visible on focus (not solely on focus-visible) */,
    "data-focus-visible": "",
    children: children
  });
};

const RouteLink = ({
  route,
  routeParams,
  children,
  ...rest
}) => {
  if (!route) {
    throw new Error("route prop is required");
  }
  useRouteStatus(route);
  const url = route.buildUrl(routeParams);
  return jsx(Link, {
    ...rest,
    href: url,
    children: children || route.buildRelativeUrl(routeParams)
  });
};

installImportMetaCss(import.meta);Object.assign(PSEUDO_CLASSES, {
  ":-navi-tab-selected": {
    attribute: "data-tab-selected"
  }
});
import.meta.css = /* css */`
  @layer navi {
    .navi_tablist {
      --tablist-border-radius: 0px;
      --tablist-background: transparent;
      --tab-border-radius: calc(var(--tablist-border-radius) - 2px);

      --tab-background: transparent;
      --tab-background-hover: #dae0e7;
      --tab-background-selected: transparent;
      --tab-color: inherit;
      --tab-color-hover: #010409;
      --tab-color-selected: inherit;
      --tab-indicator-size: 2px;
      --tab-indicator-spacing: 0;
      --tab-indicator-color: rgb(205, 52, 37);
    }
  }

  .navi_tablist {
    display: flex;
    line-height: 2;
    /* overflow-x: auto; */
    /* overflow-y: hidden; */

    &[data-tab-indicator-position="start"] {
      .navi_tab {
        margin-top: var(--tab-indicator-spacing);
      }
    }
    &[data-tab-indicator-position="end"] {
      .navi_tab {
        margin-bottom: var(--tab-indicator-spacing);
      }
    }

    > ul {
      display: flex;
      width: 100%;
      margin: 0;
      padding: 0;
      align-items: center;
      gap: 0.5rem;
      list-style: none;
      background: var(--tablist-background);
      border-radius: var(--tablist-border-radius);

      > li {
        position: relative;
        display: inline-flex;

        .navi_tab {
          --x-tab-background: var(
            --tab-background-color,
            var(--tab-background)
          );
          --x-tab-background-hover: var(
            --tab-background-color-hover,
            var(--tab-background-color, var(--tab-background-hover))
          );
          --x-tab-background-selected: var(
            --tab-background-color-selected,
            var(--tab-background-selected)
          );
          --x-tab-color: var(--tab-color);

          display: flex;
          padding: 2px; /* Space for eventual outline inside the tab (link) */
          flex-direction: column;
          color: var(--x-tab-color);
          white-space: nowrap;
          background: var(--x-tab-background);
          border-radius: var(--tab-border-radius);
          transition: background 0.12s ease-out;
          user-select: none;

          > .navi_text,
          .navi_link,
          .navi_button,
          .navi_text_bold_wrapper,
          .navi_text_bold_clone,
          .navi_text_bold_foreground {
            display: inline-flex;
            flex-grow: 1;
            justify-content: center;
            text-align: center;
            border-radius: inherit;
          }

          .navi_tab_indicator {
            position: absolute;
            z-index: 1;
            display: flex;
            width: 100%;
            height: var(--tab-indicator-size);
            background: transparent;
            border-radius: 0.1px;

            &[data-position="start"] {
              top: 0;
              left: 0;
            }

            &[data-position="end"] {
              bottom: 0;
              left: 0;
            }
          }

          /* Interactive */
          &[data-interactive] {
            cursor: pointer;
          }
          /* Hover */
          &[data-hover] {
            --x-tab-background: var(--x-tab-background-hover);
            --x-tab-color: var(--tab-color-hover);
          }
          /* Selected */
          &[data-tab-selected] {
            --x-tab-background: var(--x-tab-background-selected);
            --x-tab-color: var(--tab-color-selected);
            &[data-bold-when-selected] {
              font-weight: bold;
            }

            .navi_tab_indicator {
              background: var(--tab-indicator-color);
            }
          }
        }
      }
    }

    /* Vertical layout */
    &[data-vertical] {
      /* overflow-x: hidden; */
      /* overflow-y: auto; */

      > ul {
        flex-direction: column;
        align-items: start;

        > li {
          width: 100%;

          .navi_tab {
            flex-direction: row;
            text-align: left;

            .navi_tab_indicator {
              width: var(--tab-indicator-size);
              height: 100%;
            }

            > .navi_text,
            .navi_link,
            .navi_text_bold_foreground {
              justify-content: start;
            }

            &[data-align-x="end"] {
              > .navi_text,
              .navi_link,
              .navi_text_bold_foreground {
                justify-content: end;
              }
            }
          }
        }
      }

      &[data-tab-indicator-position="start"] {
        .navi_tab {
          margin-top: 0;
          margin-left: var(--tab-indicator-spacing);

          .navi_tab_indicator {
            top: 0;
            left: 0;
          }
        }
      }
      &[data-tab-indicator-position="end"] {
        .navi_tab {
          margin-right: var(--tab-indicator-spacing);
          margin-bottom: 0;

          .navi_tab_indicator {
            top: 0;
            right: 0;
            left: auto;
          }
        }
      }
    }

    &[data-expand] {
      > ul {
        .navi_tab {
          width: 100%;
          flex: 1;
          align-items: stretch;
          justify-content: start;
        }
      }
    }
  }
`;
const TabListIndicatorContext = createContext();
const TabListAlignXContext = createContext();
const TabListStyleCSSVars = {
  borderRadius: "--tablist-border-radius",
  background: "--tablist-background"
};
const TabList = ({
  children,
  spacing,
  vertical,
  indicator = vertical ? "start" : "end",
  alignX,
  expand,
  expandX,
  paddingX,
  paddingY,
  padding,
  ...props
}) => {
  children = toChildArray(children);
  return jsx(Box, {
    as: "nav",
    baseClassName: "navi_tablist",
    role: "tablist",
    "data-tab-indicator-position": indicator === "start" || indicator === "end" ? indicator : undefined,
    "data-expand": expand || expandX ? "" : undefined,
    "data-vertical": vertical ? "" : undefined,
    expand: expand,
    expandX: expandX,
    ...props,
    styleCSSVars: TabListStyleCSSVars,
    children: jsx(Box, {
      as: "ul",
      column: true,
      role: "list",
      paddingX: paddingX,
      paddingY: paddingY,
      padding: padding,
      spacing: spacing,
      children: jsx(TabListIndicatorContext.Provider, {
        value: indicator,
        children: jsx(TabListAlignXContext.Provider, {
          value: alignX,
          children: children.map(child => {
            return jsx(Box, {
              as: "li",
              column: true,
              expandX: expandX,
              expand: expand,
              children: child
            }, child.props.key);
          })
        })
      })
    })
  });
};
const TAB_STYLE_CSS_VARS = {
  "background": "--tab-background",
  "backgroundColor": "--tab-background-color",
  "color": "--tab-color",
  ":hover": {
    background: "--tab-background-hover",
    backgroundColor: "--tab-background-color-hover",
    color: "--tab-color-hover"
  },
  ":-navi-tab-selected": {
    background: "--tab-background-selected",
    backgroundColor: "--tab-background-color-selected",
    color: "--tab-color-selected"
  }
};
const TAB_PSEUDO_CLASSES = [":hover", ":-navi-tab-selected"];
const TAB_PSEUDO_ELEMENTS = ["::-navi-indicator"];
const Tab = props => {
  if (props.route) {
    return jsx(TabRoute, {
      ...props
    });
  }
  return jsx(TabBasic, {
    ...props
  });
};
TabList.Tab = Tab;
const TabRoute = ({
  circle,
  route,
  routeParams,
  children,
  padding = 2,
  paddingX = padding,
  paddingY = padding,
  paddingLeft = paddingX,
  paddingRight = paddingX,
  paddingTop = paddingY,
  paddingBottom = paddingY,
  alignX,
  alignY,
  ...props
}) => {
  const {
    matching
  } = useRouteStatus(route);
  const paramsAreMatching = route.matchesParams(routeParams);
  const selected = matching && paramsAreMatching;
  return jsx(TabBasic, {
    selected: selected,
    ...props,
    circle: circle,
    padding: "0",
    alignX: alignX,
    alignY: alignY,
    children: jsx(RouteLink, {
      box: true,
      circle: circle,
      route: route,
      routeParams: routeParams,
      expand: true,
      discrete: true,
      padding: padding,
      paddingX: paddingX,
      paddingY: paddingY,
      paddingLeft: paddingLeft,
      paddingRight: paddingRight,
      paddingTop: paddingTop,
      paddingBottom: paddingBottom,
      alignX: alignX,
      alignY: alignY,
      children: children
    })
  });
};
const TabBasic = ({
  children,
  icon,
  selected,
  boldWhenSelected = !icon,
  onClick,
  ...props
}) => {
  const tabListIndicator = useContext(TabListIndicatorContext);
  const tabListAlignX = useContext(TabListAlignXContext);
  return jsxs(Box, {
    role: "tab",
    "aria-selected": selected ? "true" : "false",
    "data-interactive": onClick ? "" : undefined,
    "data-bold-when-selected": boldWhenSelected ? "" : undefined,
    onClick: onClick
    // Style system
    ,
    baseClassName: "navi_tab",
    styleCSSVars: TAB_STYLE_CSS_VARS,
    pseudoClasses: TAB_PSEUDO_CLASSES,
    pseudoElements: TAB_PSEUDO_ELEMENTS,
    basePseudoState: {
      ":-navi-tab-selected": selected
    },
    selfAlignX: tabListAlignX,
    "data-align-x": tabListAlignX,
    ...props,
    children: [(tabListIndicator === "start" || tabListIndicator === "end") && jsx("span", {
      className: "navi_tab_indicator",
      "data-position": tabListIndicator
    }), boldWhenSelected ? jsx(Text, {
      preventBoldLayoutShift: true
      // boldTransition
      ,
      children: children
    }) : children]
  });
};

const createAvailableConstraint = (
  // the set might be incomplete (the front usually don't have the full copy of all the items from the backend)
  // but this is already nice to help user with what we know
  // it's also possible that front is unsync with backend, preventing user to choose a value
  // that is actually free.
  // But this is unlikely to happen and user could reload the page to be able to choose that name
  // that suddenly became available
  existingValueSet,
  message = `"{value}" est utilisé. Veuillez entrer une autre valeur.`,
) => {
  return {
    name: "available",
    messageAttribute: "data-available-message",
    check: (field) => {
      const fieldValue = field.value;
      const hasConflict = existingValueSet.has(fieldValue);
      // console.log({
      //   inputValue,
      //   names: Array.from(otherNameSet.values()),
      //   hasConflict,
      // });
      if (hasConflict) {
        return replaceStringVars(message, {
          "{value}": fieldValue,
        });
      }
      return "";
    },
  };
};

const DEFAULT_VALIDITY_STATE = { valid: true };
const useConstraintValidityState = (ref) => {
  const checkValue = () => {
    const element = ref.current;
    if (!element) {
      return DEFAULT_VALIDITY_STATE;
    }
    const { __validationInterface__ } = element;
    if (!__validationInterface__) {
      return DEFAULT_VALIDITY_STATE;
    }
    const value = __validationInterface__.getConstraintValidityState();
    return value;
  };

  const [constraintValidityState, setConstraintValidityState] =
    useState(checkValue);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    setConstraintValidityState(checkValue());
    element.addEventListener(NAVI_VALIDITY_CHANGE_CUSTOM_EVENT, () => {
      setConstraintValidityState(checkValue());
    });
  }, []);

  return constraintValidityState;
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    label {
      cursor: pointer;
    }

    label[data-readonly],
    label[data-disabled] {
      color: rgba(0, 0, 0, 0.5);
      cursor: default;
    }
  }
`;
const ReportReadOnlyOnLabelContext = createContext();
const ReportDisabledOnLabelContext = createContext();
const LabelPseudoClasses = [":hover", ":active", ":focus", ":focus-visible", ":read-only", ":disabled", ":-navi-loading"];
const Label = props => {
  const {
    readOnly,
    disabled,
    children,
    ...rest
  } = props;
  const [inputReadOnly, setInputReadOnly] = useState(false);
  const innerReadOnly = readOnly || inputReadOnly;
  const [inputDisabled, setInputDisabled] = useState(false);
  const innerDisabled = disabled || inputDisabled;
  return jsx(Box, {
    ...rest,
    as: "label",
    pseudoClasses: LabelPseudoClasses,
    basePseudoState: {
      ":read-only": innerReadOnly,
      ":disabled": innerDisabled
    },
    children: jsx(ReportReadOnlyOnLabelContext.Provider, {
      value: setInputReadOnly,
      children: jsx(ReportDisabledOnLabelContext.Provider, {
        value: setInputDisabled,
        children: children
      })
    })
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_checkbox {
      --margin: 3px 3px 3px 4px;
      --outline-offset: 1px;
      --outline-width: 2px;
      --border-width: 1px;
      --border-radius: 2px;
      --width: 0.815em;
      --height: 0.815em;

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: light-dark(#4476ff, #3b82f6);
      --background-color-checked: var(--accent-color);
      --border-color-checked: var(--accent-color);
      --checkmark-color-light: white;
      --checkmark-color-dark: rgb(55, 55, 55);
      --checkmark-color: var(--checkmark-color-light);
      --cursor: pointer;

      --color-mix-light: black;
      --color-mix-dark: white;
      --color-mix: var(--color-mix-light);

      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 60%, black);
      --border-color-hover-checked: color-mix(
        in srgb,
        var(--border-color-checked) 80%,
        var(--color-mix)
      );
      --background-color-hover: var(--background-color);
      --background-color-hover-checked: color-mix(
        in srgb,
        var(--background-color-checked) 80%,
        var(--color-mix)
      );
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-readonly-checked: #d3d3d3;
      --background-color-readonly-checked: color-mix(
        in srgb,
        var(--background-color-checked) 30%,
        grey
      );
      --checkmark-color-readonly: #eeeeee;
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: rgba(248, 248, 248, 0.7);
      --checkmark-color-disabled: #eeeeee;
      --border-color-disabled-checked: #d3d3d3;
      --background-color-disabled-checked: #d3d3d3;

      /* Toggle specific */
      --toggle-margin: 2px;
      --toggle-width: 2.5em;
      --toggle-thumb-size: 1.2em;
      /* Padding uses px and not em otherwise it can be resolved to a float which does not play well */
      /* With the translation calc in some configurations. In the end 2px is nice in all sizes and can still be configured for exceptions */
      --toggle-padding: 2px;
      --toggle-border-radius: calc(
        var(--toggle-thumb-size) / 2 + calc(var(--toggle-padding) * 2)
      );
      --toggle-thumb-border-radius: 50%;
      --toggle-background-color: light-dark(#767676, #8e8e93);
      --toggle-background-color-checked: var(--accent-color);
      --toggle-background-color-hover: color-mix(
        in srgb,
        var(--toggle-background-color) 60%,
        white
      );
      --toggle-background-color-readonly: color-mix(
        in srgb,
        var(--toggle-background-color) 40%,
        transparent
      );
      --toggle-background-color-disabled: color-mix(
        in srgb,
        var(--toggle-background-color) 15%,
        #d3d3d3
      );
      --toggle-background-color-hover-checked: color-mix(
        in srgb,
        var(--toggle-background-color-checked) 90%,
        black
      );
      --toggle-background-color-readonly-checked: color-mix(
        in srgb,
        var(--toggle-background-color-checked) 40%,
        transparent
      );
      --toggle-background-color-disabled-checked: color-mix(
        in srgb,
        var(--toggle-background-color-checked) 15%,
        #d3d3d3
      );
      --toggle-thumb-color: white;

      /* Button specific */
      --button-border-color: light-dark(#767676, #8e8e93);
      --button-background-color: light-dark(#f3f4f6, #2d3748);
      --button-border-color-hover: color-mix(
        in srgb,
        var(--button-border-color) 70%,
        black
      );
      --button-background-color-hover: color-mix(
        in srgb,
        var(--button-background-color) 95%,
        black
      );

      &[data-dark] {
        --color-mix: var(--color-mix-dark);
        --checkmark-color: var(--checkmark-color-dark);
      }
    }
  }

  .navi_checkbox {
    --x-background-color: var(--background-color);
    --x-border-color: var(--border-color);
    --x-checkmark-color: var(--checkmark-color);
    --x-cursor: var(--cursor);

    position: relative;
    display: inline-flex;
    box-sizing: content-box;
    margin: var(--margin);

    .navi_native_field {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 0;
      border: none;
      border-radius: inherit;
      opacity: 0;
      appearance: none; /* This allows border-radius to have an effect */
      cursor: var(--x-cursor);
    }

    .navi_checkbox_field {
      display: inline-flex;
      box-sizing: border-box;
      width: var(--width);
      height: var(--height);
      background-color: var(--x-background-color);
      border-width: var(--border-width);
      border-style: solid;
      border-color: var(--x-border-color);
      border-radius: var(--border-radius);
      outline-width: var(--outline-width);
      outline-style: none;
      outline-color: var(--outline-color);
      outline-offset: var(--outline-offset);
      pointer-events: none;
    }

    /* Focus */
    &[data-focus-visible] {
      z-index: 1;
      .navi_checkbox_field {
        outline-style: solid;
      }
    }
    /* Hover */
    &[data-hover] {
      --x-background-color: var(--background-color-hover);
      --x-border-color: var(--border-color-hover);

      &[data-checked] {
        --x-border-color: var(--border-color-hover-checked);
        --x-background-color: var(--background-color-hover-checked);
      }
    }
    /* Checked */
    &[data-checked] {
      --x-background-color: var(--background-color-checked);
      --x-border-color: var(--border-color-checked);
    }
    /* Readonly */
    &[data-readonly],
    &[data-readonly][data-hover] {
      --x-border-color: var(--border-color-readonly);
      --x-background-color: var(--background-color-readonly);
      --x-cursor: default;

      &[data-checked] {
        --x-border-color: var(--border-color-readonly-checked);
        --x-background-color: var(--background-color-readonly-checked);
        --x-checkmark-color: var(--checkmark-color-readonly);
      }
    }
    /* Disabled */
    &[data-disabled] {
      --x-border-color: var(--border-color-disabled);
      --x-background-color: var(--background-color-disabled);
      --x-cursor: default;

      &[data-checked] {
        --x-border-color: var(--border-color-disabled-checked);
        --x-background-color: var(--background-color-disabled-checked);
        --x-checkmark-color: var(--checkmark-color-disabled);
      }
    }

    /* Checkbox appearance */
    &[data-appearance="checkbox"] {
      .navi_checkbox_marker {
        width: 100%;
        height: 100%;
        opacity: 0;
        stroke: var(--x-checkmark-color);
        transform: scale(0.5);
      }

      &[data-checked] {
        .navi_checkbox_marker {
          opacity: 1;
          transform: scale(1);
          transition-property: opacity, transform;
          transition-duration: 0.15s;
          transition-timing-function: ease;
        }
      }
    }

    /* Toggle appearance */
    &[data-appearance="toggle"] {
      --margin: var(--toggle-margin);
      --padding: var(--toggle-padding);
      --width: var(--toggle-width);
      --height: unset;
      --border-radius: var(--toggle-border-radius);
      --background-color: var(--toggle-background-color);
      --background-color-hover: var(--toggle-background-color-hover);
      --background-color-readonly: var(--toggle-background-color-readonly);
      --background-color-disabled: var(--toggle-background-color-disabled);
      --background-color-checked: var(--toggle-background-color-checked);
      --background-color-hover-checked: var(
        --toggle-background-color-hover-checked
      );
      --background-color-readonly-checked: var(
        --toggle-background-color-readonly-checked
      );
      --background-color-disabled-checked: var(
        --toggle-background-color-disabled-checked
      );

      .navi_checkbox_field {
        position: relative;
        box-sizing: border-box;
        width: var(--width);
        height: var(--height);
        padding: var(--padding);
        background-color: var(--x-background-color);
        border-color: transparent;
        user-select: none;

        .navi_checkbox_toggle {
          width: var(--toggle-thumb-size);
          height: var(--toggle-thumb-size);
          border-radius: var(--toggle-thumb-border-radius);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          fill: var(--toggle-thumb-color);
          transform: translateX(0);
          transition: transform 0.2s ease;
        }
      }

      &[data-checked] {
        .navi_checkbox_toggle {
          /* We remove padding 3 times */
          /* - twice to get real width (box-sizing: border-box) */
          /* - one more to apply right padding to the translation */
          transform: translateX(
            calc(
              var(--toggle-width) - var(--toggle-thumb-size) - var(
                  --toggle-padding
                ) *
                3
            )
          );
        }
      }
    }

    &[data-appearance="icon"] {
      --margin: 0;
      --outline-offset: 0px;
      --width: auto;
      --height: auto;

      .navi_checkbox_field {
        background: none;
        border: none;
      }
    }

    &[data-appearance="button"] {
      --margin: 0;
      --outline-offset: 0px;
      --width: auto;
      --height: auto;
      --padding: 4px;
      --border-color: var(--button-border-color);
      --border-color-hover: var(--button-border-color-hover);
      --background-color: var(--button-background-color);
      --background-color-hover: var(--button-background-color-hover);
      --background-color-readonly: var(--button-background-color-readonly);
      --background-color-disabled: var(--button-background-color-disabled);
      --border-color-checked: var(--button-border-color);
      --background-color-checked: var(--button-background-color);

      .navi_checkbox_field {
        padding-top: var(--padding-top, var(--padding-y, var(--padding)));
        padding-right: var(--padding-right, var(--padding-x, var(--padding)));
        padding-bottom: var(--padding-bottom, var(--padding-y, var(--padding)));
        padding-left: var(--padding-left, var(--padding-x, var(--padding)));
      }
    }
  }
`;
const InputCheckbox = props => {
  const {
    value = "on"
  } = props;
  const uiStateController = useUIStateController(props, "checkbox", {
    statePropName: "checked",
    defaultStatePropName: "defaultChecked",
    fallbackState: false,
    getStateFromProp: checked => checked ? value : undefined,
    getPropFromState: Boolean
  });
  const uiState = useUIState(uiStateController);
  const checkbox = renderActionableComponent(props, {
    Basic: InputCheckboxBasic,
    WithAction: InputCheckboxWithAction
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: checkbox
    })
  });
};
const CheckboxStyleCSSVars = {
  "width": "--width",
  "height": "--height",
  "outlineWidth": "--outline-width",
  "borderWidth": "--border-width",
  "backgroundColor": "--background-color",
  "borderColor": "--border-color",
  "accentColor": "--accent-color",
  ":hover": {
    backgroundColor: "--background-color-hover",
    borderColor: "--border-color-hover"
  },
  ":active": {
    borderColor: "--border-color-active"
  },
  ":read-only": {
    backgroundColor: "--background-color-readonly",
    borderColor: "--border-color-readonly"
  },
  ":disabled": {
    backgroundColor: "--background-color-disabled",
    borderColor: "--border-color-disabled"
  }
};
const CheckboxToggleStyleCSSVars = {
  ...CheckboxStyleCSSVars,
  width: "--toggle-width",
  height: "--toggle-height",
  borderRadius: "--border-radius"
};
const CheckboxButtonStyleCSSVars = {
  ...CheckboxStyleCSSVars,
  paddingTop: "--padding-top",
  paddingRight: "--padding-right",
  paddingBottom: "--padding-bottom",
  paddingLeft: "--padding-left",
  paddingX: "--padding-x",
  paddingY: "--padding-y",
  padding: "--padding"
};
const CheckboxPseudoClasses = [":hover", ":active", ":focus", ":focus-visible", ":read-only", ":disabled", ":checked", ":-navi-loading"];
const CheckboxPseudoElements = ["::-navi-loader", "::-navi-checkmark"];
const InputCheckboxBasic = props => {
  const contextFieldName = useContext(FieldNameContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextRequired = useContext(RequiredContext);
  const contextLoading = useContext(LoadingContext);
  const loadingElement = useContext(LoadingElementContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const reportDisabledOnLabel = useContext(ReportDisabledOnLabelContext);
  const {
    /* eslint-disable no-unused-vars */
    type,
    defaultChecked,
    /* eslint-enable no-unused-vars */

    id,
    name,
    readOnly,
    disabled,
    required,
    loading,
    autoFocus,
    onClick,
    onInput,
    accentColor,
    icon,
    appearance = icon ? "icon" : "checkbox",
    // "checkbox", "toggle", "icon", "button"
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const innerName = name || contextFieldName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading = loading || contextLoading && loadingElement === ref.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  reportReadOnlyOnLabel?.(innerReadOnly);
  reportDisabledOnLabel?.(innerDisabled);
  useAutoFocus(ref, autoFocus);
  const remainingProps = useConstraints(ref, rest);
  const checked = Boolean(uiState);
  const innerOnClick = useStableCallback(e => {
    if (innerReadOnly) {
      e.preventDefault();
    }
    onClick?.(e);
  });
  const innerOnInput = useStableCallback(e => {
    const checkbox = e.target;
    const checkboxIsChecked = checkbox.checked;
    uiStateController.setUIState(checkboxIsChecked, e);
    onInput?.(e);
  });
  const renderCheckbox = checkboxProps => jsx(Box, {
    ...checkboxProps,
    id: id,
    as: "input",
    ref: ref,
    type: "checkbox",
    name: innerName,
    checked: checked,
    required: innerRequired,
    baseClassName: "navi_native_field",
    "data-callout-arrow-x": "center",
    onClick: innerOnClick,
    onInput: innerOnInput,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    },
    onsetuistate: e => {
      uiStateController.setUIState(e.detail.value, e);
    }
  });
  const renderCheckboxMemoized = useCallback(renderCheckbox, [id, innerName, checked, innerRequired]);
  const boxRef = useRef();
  useLayoutEffect(() => {
    const naviCheckbox = boxRef.current;
    const lightColor = "var(--checkmark-color-light)";
    const darkColor = "var(--checkmark-color-dark)";
    const colorPicked = pickLightOrDark("var(--accent-color)", lightColor, darkColor, naviCheckbox);
    if (colorPicked === lightColor) {
      naviCheckbox.removeAttribute("data-dark");
    } else {
      naviCheckbox.setAttribute("data-dark", "");
    }
  }, [accentColor]);
  return jsxs(Box, {
    as: "span",
    ...remainingProps,
    ref: boxRef,
    "data-appearance": appearance,
    baseClassName: "navi_checkbox",
    pseudoStateSelector: ".navi_native_field",
    styleCSSVars: appearance === "toggle" ? CheckboxToggleStyleCSSVars : appearance === "button" ? CheckboxButtonStyleCSSVars : CheckboxStyleCSSVars,
    pseudoClasses: CheckboxPseudoClasses,
    pseudoElements: CheckboxPseudoElements,
    basePseudoState: {
      ":read-only": innerReadOnly,
      ":disabled": innerDisabled,
      ":-navi-loading": innerLoading
    },
    accentColor: accentColor,
    hasChildFunction: true,
    preventInitialTransition: true,
    children: [jsx(LoaderBackground, {
      loading: innerLoading,
      inset: -1,
      color: "var(--loader-color)",
      targetSelector: ".navi_checkbox_field"
    }), renderCheckboxMemoized, jsx("div", {
      className: "navi_checkbox_field",
      children: icon ? jsx("div", {
        className: "navi_checkbox_icon",
        "aria-hidden": "true",
        children: Array.isArray(icon) ? icon[checked ? 1 : 0] : icon
      }) : appearance === "toggle" ? jsx(Box, {
        className: "navi_checkbox_toggle",
        as: "svg",
        viewBox: "0 0 12 12",
        "aria-hidden": "true",
        preventInitialTransition: true,
        children: jsx("circle", {
          cx: "6",
          cy: "6",
          r: "5"
        })
      }) : jsx(Box, {
        className: "navi_checkbox_marker",
        as: "svg",
        viewBox: "0 0 12 12",
        "aria-hidden": "true",
        preventInitialTransition: true,
        children: jsx("path", {
          d: "M10.5 2L4.5 9L1.5 5.5",
          fill: "none",
          strokeWidth: "2"
        })
      })
    })]
  });
};
const InputCheckboxWithAction = props => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    onCancel,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    loading,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const [actionBoundToUIState] = useActionBoundToOneParam(action, uiState);
  const actionStatus = useActionStatus(actionBoundToUIState);
  const {
    loading: actionLoading
  } = actionStatus;
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect
  });

  // In this situation updating the ui state === calling associated action
  // so cance/abort/error have to revert the ui state to the one before user interaction
  // to show back the real state of the checkbox (not the one user tried to set)
  useActionEvents(ref, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      uiStateController.resetUIState(e);
      onCancel?.(e, reason);
    },
    onRequested: e => forwardActionRequested(e, actionBoundToUIState),
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onAbort: e => {
      uiStateController.resetUIState(e);
      onActionAbort?.(e);
    },
    onError: e => {
      uiStateController.resetUIState(e);
      onActionError?.(e);
    },
    onEnd: e => {
      onActionEnd?.(e);
    }
  });
  return jsx(InputCheckboxBasic, {
    "data-action": actionBoundToUIState.name,
    ...rest,
    ref: ref,
    loading: loading || actionLoading
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_checkbox_list {
      display: flex;
      flex-direction: column;
    }
  }
`;
const CheckboxList = forwardRef((props, ref) => {
  const uiStateController = useUIGroupStateController(props, "checkbox_list", {
    childComponentType: "checkbox",
    aggregateChildStates: childUIStateControllers => {
      const values = [];
      for (const childUIStateController of childUIStateControllers) {
        if (childUIStateController.uiState) {
          values.push(childUIStateController.uiState);
        }
      }
      return values.length === 0 ? undefined : values;
    }
  });
  const uiState = useUIState(uiStateController);
  const checkboxList = renderActionableComponent(props, ref);
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: checkboxList
    })
  });
});
const Checkbox = InputCheckbox;
const CheckboxListBasic = forwardRef((props, ref) => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const uiStateController = useContext(UIStateControllerContext);
  const {
    name,
    readOnly,
    disabled,
    required,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const innerLoading = loading || contextLoading;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  return jsx("div", {
    ...rest,
    ref: innerRef,
    name: name,
    className: "navi_checkbox_list",
    "data-checkbox-list": true
    // eslint-disable-next-line react/no-unknown-property
    ,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    },
    children: jsx(ParentUIStateControllerContext.Provider, {
      value: uiStateController,
      children: jsx(FieldNameContext.Provider, {
        value: name,
        children: jsx(ReadOnlyContext.Provider, {
          value: innerReadOnly,
          children: jsx(DisabledContext.Provider, {
            value: innerDisabled,
            children: jsx(RequiredContext.Provider, {
              value: required,
              children: jsx(LoadingContext.Provider, {
                value: innerLoading,
                children: children
              })
            })
          })
        })
      })
    })
  });
});
forwardRef((props, ref) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    actionErrorEffect,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [boundAction] = useActionBoundToOneArrayParam(action, uiState);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  const [actionRequester, setActionRequester] = useState(null);
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      uiStateController.resetUIState(e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: actionEvent => {
      setActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: e => {
      uiStateController.resetUIState(e);
      onActionAbort?.(e);
    },
    onError: e => {
      uiStateController.resetUIState(e);
      onActionError?.(e);
    },
    onEnd: e => {
      onActionEnd?.(e);
    }
  });
  return jsx(CheckboxListBasic, {
    "data-action": boundAction.name,
    ...rest,
    ref: innerRef,
    onChange: event => {
      const checkboxList = innerRef.current;
      const checkbox = event.target;
      requestAction(checkboxList, boundAction, {
        event,
        requester: checkbox
      });
    },
    loading: loading || actionLoading,
    children: jsx(LoadingElementContext.Provider, {
      value: actionRequester,
      children: children
    })
  });
});

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_radio {
      --margin: 3px 3px 0 5px;
      --outline-offset: 1px;
      --outline-width: 2px;
      --width: 0.815em;
      --height: 0.815em;

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: light-dark(#4476ff, #3b82f6);
      --radiomark-color: var(--accent-color);
      --border-color-checked: var(--accent-color);
      --cursor: pointer;

      --color-mix-light: black;
      --color-mix-dark: white;
      --color-mix: var(--color-mix-light);

      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 60%, black);
      --border-color-hover-checked: color-mix(
        in srgb,
        var(--border-color-checked) 80%,
        var(--color-mix)
      );
      --radiomark-color-hover: color-mix(
        in srgb,
        var(--radiomark-color) 80%,
        var(--color-mix)
      );
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --background-color-readonly: var(--background-color);
      --radiomark-color-readonly: color-mix(
        in srgb,
        var(--radiomark-color) 30%,
        grey
      );
      --border-color-readonly-checked: color-mix(
        in srgb,
        var(--radiomark-color) 30%,
        transparent
      );
      --background-color-readonly-checked: var(--border-color-readonly-checked);
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: rgba(248, 248, 248, 0.7);
      --radiomark-color-disabled: #d3d3d3;
      --border-color-checked-disabled: #d3d3d3;
      --background-color-disabled-checked: var(--background-color);

      /* Button specific */
      --button-border-width: 1px;
      --button-border-color: transparent;
      --button-background-color: transparent;
      --button-border-color-hover: color-mix(
        in srgb,
        var(--button-border-color) 70%,
        black
      );
      --button-background-color-hover: color-mix(
        in srgb,
        var(--button-border-color) 95%,
        black
      );
      --button-border-color-checked: var(--accent-color);
      --button-background-color-checked: transparent;
      --button-border-color-readonly: #eeeeee;
      --button-background-color-readonly: #d3d3d3;
      --button-border-color-disabled: var(--border-color-readonly);
      --button-background-color-disabled: var(--background-color-readonly);
    }

    &[data-dark] {
      --color-mix: var(--color-mix-dark);
    }
  }

  .navi_radio {
    --x-outline-offset: var(--outline-offset);
    --x-outline-width: var(--outline-width);
    --x-border-width: var(--border-width);
    --x-width: var(--width);
    --x-height: var(--height);
    --x-outline-color: var(--outline-color);
    --x-background-color: var(--background-color);
    --x-border-color: var(--border-color);
    --x-radiomark-color: var(--radiomark-color);
    --x-cursor: var(--cursor);

    position: relative;
    display: inline-flex;
    box-sizing: content-box;
    margin: var(--margin);

    .navi_native_field {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 0;
      border: none;
      border-radius: inherit;
      opacity: 0;
      appearance: none; /* This allows border-radius to have an effect */
      cursor: var(--x-cursor);
    }

    /* Focus */
    &[data-focus-visible] {
      z-index: 1;
      .navi_radio_field {
        outline-style: solid;
      }
    }
    /* Hover */
    &[data-hover] {
      --x-border-color: var(--border-color-hover);
      --x-radiomark-color: var(--radiomark-color-hover);
    }
    /* Checked */
    &[data-checked] {
      --x-border-color: var(--border-color-checked);

      &[data-hover] {
        --x-border-color: var(--border-color-hover-checked);
      }
    }
    /* Readonly */
    &[data-readonly] {
      --x-cursor: default;
      --x-background-color: var(--background-color-readonly);
      --x-border-color: var(--border-color-readonly);
      --x-radiomark-color: var(--radiomark-color-readonly);

      .navi_radio_dashed_border {
        display: none;
      }

      &[data-checked] {
        --x-background-color: var(--background-color-readonly-checked);
        --x-border-color: var(--border-color-readonly-checked);
        --x-radiomark-color: var(--radiomark-color-readonly);
      }
    }
    /* Disabled */
    &[data-disabled] {
      --x-cursor: default;
      --x-background-color: var(--background-color-disabled);
      --x-border-color: var(--border-color-disabled);
      --x-radiomark-color: var(--radiomark-color-disabled);

      &[data-checked] {
        --x-border-color: var(--border-color-disabled);
        --x-radiomark-color: var(--radiomark-color-disabled);
      }
    }

    .navi_radio_field {
      box-sizing: border-box;
      width: var(--x-width);
      height: var(--x-height);
      outline-width: var(--x-outline-width);
      outline-style: none;
      outline-color: var(--x-outline-color);
      outline-offset: var(--x-outline-offset);
      pointer-events: none;
    }

    /* Radio appearance */
    &[data-appearance="radio"] {
      .navi_radio_field {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;

        svg {
          overflow: visible;
        }

        .navi_radio_border {
          fill: var(--x-background-color);
          stroke: var(--x-border-color);
        }
        .navi_radio_dashed_border {
          display: none;
        }
        .navi_radio_marker {
          width: 100%;
          height: 100%;
          opacity: 0;
          fill: var(--x-radiomark-color);
          transform: scale(0.3);
          transform-origin: center;
          pointer-events: none;
        }
      }

      &[data-transition] {
        .navi_radio_border {
          transition: all 0.15s ease;
        }
        .navi_radio_dashed_border {
          transition: all 0.15s ease;
        }
        .navi_radio_marker {
          transition: all 0.15s ease;
        }
      }

      &[data-checked] {
        .navi_radio_marker {
          opacity: 1;
          transform: scale(1);
        }
      }
    }

    /* Icon appearance */
    &[data-appearance="icon"] {
      --width: auto;
      --height: auto;
      --outline-offset: 2px;
      --outline-width: 2px;
    }

    /* Button appearance */
    &[data-appearance="button"] {
      --margin: 0;
      --outline-offset: 0px;
      --width: auto;
      --height: auto;
      --padding: 2px;
      --border-color: var(--button-border-color);
      --border-color-hover: var(--button-border-color-hover);
      --background-color: var(--button-background-color);
      --background-color-hover: var(--button-background-color-hover);
      --background-color-readonly: var(--button-background-color-readonly);
      --background-color-disabled: var(--button-background-color-disabled);
      --border-color-checked: var(--button-border-color);
      --background-color-checked: var(--button-background-color);

      .navi_radio_field {
        display: inline-flex;
        box-sizing: border-box;
        padding-top: var(--padding-top, var(--padding-y, var(--padding)));
        padding-right: var(--padding-right, var(--padding-x, var(--padding)));
        padding-bottom: var(--padding-bottom, var(--padding-y, var(--padding)));
        padding-left: var(--padding-left, var(--padding-x, var(--padding)));
        align-items: center;
        justify-content: center;
        background-color: var(--x-background-color);
        border-width: var(--button-border-width);
        border-style: solid;
        border-color: var(--x-border-color);
        border-radius: var(--button-border-radius);

        .navi_icon,
        img {
          border-radius: inherit;
        }
      }

      &[data-hover] {
        --x-background-color: var(--button-background-color-hover);
        --x-border-color: var(--button-border-color-hover);
      }
      &[data-checked] {
        --x-border-color: var(--button-border-color-checked);
        --x-background-color: var(--button-background-color-checked);

        .navi_radio_field {
          box-shadow:
            inset 0 2px 4px rgba(0, 0, 0, 0.15),
            inset 0 0 0 1px var(--button-border-color-checked);
        }
      }
      &[data-disabled] {
        --x-border-color: var(--button-border-color-disabled);
        --x-background-color: var(--button-background-color-disabled);
      }
    }
  }
`;
const InputRadio = props => {
  const {
    value = "on"
  } = props;
  const uiStateController = useUIStateController(props, "radio", {
    statePropName: "checked",
    fallbackState: false,
    getStateFromProp: checked => checked ? value : undefined,
    getPropFromState: Boolean,
    getStateFromParent: parentUIStateController => {
      if (parentUIStateController.componentType === "radio_list") {
        return parentUIStateController.value === props.value;
      }
      return undefined;
    }
  });
  const uiState = useUIState(uiStateController);
  const radio = renderActionableComponent(props, {
    Basic: InputRadioBasic,
    WithAction: InputRadioWithAction
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: radio
    })
  });
};
const RadioStyleCSSVars = {
  "width": "--width",
  "height": "--height",
  "borderRadius": "--border-radius",
  "outlineWidth": "--outline-width",
  "borderWidth": "--border-width",
  "backgroundColor": "--background-color",
  "borderColor": "--border-color",
  "accentColor": "--accent-color",
  ":hover": {
    backgroundColor: "--background-color-hover",
    borderColor: "--border-color-hover"
  },
  ":active": {
    borderColor: "--border-color-active"
  },
  ":read-only": {
    backgroundColor: "--background-color-readonly",
    borderColor: "--border-color-readonly"
  },
  ":disabled": {
    backgroundColor: "--background-color-disabled",
    borderColor: "--border-color-disabled"
  }
};
const RadioButtonStyleCSSVars = {
  ...RadioStyleCSSVars,
  "padding": "--padding",
  "borderRadius": "--button-border-radius",
  "borderWidth": "--button-border-width",
  "borderColor": "--button-border-color",
  "backgroundColor": "--button-background-color",
  ":hover": {
    backgroundColor: "--button-background-color-hover",
    borderColor: "--button-border-color-hover"
  },
  ":read-only": {
    backgroundColor: "--button-background-color-readonly",
    borderColor: "--button-border-color-readonly"
  },
  ":disabled": {
    backgroundColor: "--button-background-color-disabled",
    borderColor: "--button-border-color-disabled"
  }
};
const RadioPseudoClasses = [":hover", ":active", ":focus", ":focus-visible", ":read-only", ":disabled", ":checked", ":-navi-loading"];
const RadioPseudoElements = ["::-navi-loader", "::-navi-radiomark"];
const InputRadioBasic = props => {
  const contextName = useContext(FieldNameContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextRequired = useContext(RequiredContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const reportDisabledOnLabel = useContext(ReportDisabledOnLabelContext);
  const {
    /* eslint-disable no-unused-vars */
    type,
    /* eslint-enable no-unused-vars */

    name,
    readOnly,
    disabled,
    required,
    loading,
    autoFocus,
    onClick,
    onInput,
    icon,
    appearance = icon ? "icon" : "radio",
    color,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const innerName = name || contextName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading = loading || contextLoading && contextLoadingElement === ref.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  reportReadOnlyOnLabel?.(innerReadOnly);
  reportDisabledOnLabel?.(innerDisabled);
  useAutoFocus(ref, autoFocus);
  const remainingProps = useConstraints(ref, rest);
  const checked = Boolean(uiState);
  // we must first dispatch an event to inform all other radios they where unchecked
  // this way each other radio uiStateController knows thery are unchecked
  // we do this on "input"
  // but also when we are becoming checked from outside (hence the useLayoutEffect)
  const updateOtherRadiosInGroup = () => {
    const thisRadio = ref.current;
    const radioList = thisRadio.closest("[data-radio-list]");
    if (!radioList) {
      return;
    }
    const radioInputs = radioList.querySelectorAll(`input[type="radio"][name="${thisRadio.name}"]`);
    for (const radioInput of radioInputs) {
      if (radioInput === thisRadio) {
        continue;
      }
      radioInput.dispatchEvent(new CustomEvent("setuistate", {
        detail: false
      }));
    }
  };
  useLayoutEffect(() => {
    if (checked) {
      updateOtherRadiosInGroup();
    }
  }, [checked]);
  const innerOnInput = useStableCallback(e => {
    const radio = e.target;
    const radioIsChecked = radio.checked;
    if (radioIsChecked) {
      updateOtherRadiosInGroup();
    }
    uiStateController.setUIState(radioIsChecked, e);
    onInput?.(e);
  });
  const innerOnClick = useStableCallback(e => {
    if (innerReadOnly) {
      e.preventDefault();
    }
    onClick?.(e);
  });
  const renderRadio = radioProps => jsx(Box, {
    ...radioProps,
    as: "input",
    ref: ref,
    type: "radio",
    name: innerName,
    checked: checked,
    disabled: innerDisabled,
    required: innerRequired,
    baseClassName: "navi_native_field",
    "data-callout-arrow-x": "center",
    onClick: innerOnClick,
    onInput: innerOnInput,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    },
    onsetuistate: e => {
      uiStateController.setUIState(e.detail.value, e);
    }
  });
  const renderRadioMemoized = useCallback(renderRadio, [innerName, checked, innerRequired]);
  const boxRef = useRef();
  useLayoutEffect(() => {
    const naviRadio = boxRef.current;
    const luminance = resolveColorLuminance("var(--accent-color)", naviRadio);
    if (luminance < 0.3) {
      naviRadio.setAttribute("data-dark", "");
    } else {
      naviRadio.removeAttribute("data-dark");
    }
  }, [color]);
  return jsxs(Box, {
    as: "span",
    ...remainingProps,
    ref: boxRef,
    "data-appearance": appearance,
    baseClassName: "navi_radio",
    pseudoStateSelector: ".navi_native_field",
    styleCSSVars: appearance === "button" ? RadioButtonStyleCSSVars : RadioStyleCSSVars,
    pseudoClasses: RadioPseudoClasses,
    pseudoElements: RadioPseudoElements,
    basePseudoState: {
      ":read-only": innerReadOnly,
      ":disabled": innerDisabled,
      ":-navi-loading": innerLoading
    },
    color: color,
    hasChildFunction: true,
    children: [jsx(LoaderBackground, {
      loading: innerLoading,
      inset: -1,
      targetSelector: ".navi_radio_field",
      color: "var(--loader-color)"
    }), renderRadioMemoized, jsx("span", {
      className: "navi_radio_field",
      children: appearance === "radio" ? jsxs("svg", {
        viewBox: "0 0 12 12",
        "aria-hidden": "true",
        preserveAspectRatio: "xMidYMid meet",
        children: [jsx("circle", {
          className: "navi_radio_border",
          cx: "6",
          cy: "6",
          r: "5.5",
          strokeWidth: "1"
        }), jsx("circle", {
          className: "navi_radio_dashed_border",
          cx: "6",
          cy: "6",
          r: "5.5",
          strokeWidth: "1",
          strokeDasharray: "2.16 2.16",
          strokeDashoffset: "0"
        }), jsx("circle", {
          className: "navi_radio_marker",
          cx: "6",
          cy: "6",
          r: "3.5"
        })]
      }) : icon
    })]
  });
};
const InputRadioWithAction = () => {
  throw new Error(`<Input type="radio" /> with an action make no sense. Use <RadioList action={something} /> instead`);
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_input_range {
      --border-radius: 6px;
      --outline-width: 2px;
      --height: 8px;
      --thumb-size: 16px;
      --thumb-width: var(--thumb-size);
      --thumb-height: var(--thumb-size);
      --thumb-border-radius: 100%;
      --thumb-cursor: pointer;

      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --accent-color: rgb(24, 117, 255);

      --border-color: rgb(150, 150, 150);
      --track-border-color: color-mix(
        in srgb,
        var(--border-color) 35%,
        transparent
      );
      --background-color: #efefef;
      --fill-color: var(--accent-color);
      --thumb-color: var(--accent-color);
      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 75%, black);
      --track-border-color-hover: color-mix(
        in srgb,
        var(--track-border-color) 75%,
        black
      );
      --track-color-hover: color-mix(in srgb, var(--fill-color) 95%, black);
      --fill-color-hover: color-mix(in srgb, var(--fill-color) 80%, black);
      --thumb-color-hover: color-mix(in srgb, var(--thumb-color) 80%, black);
      /* Active */
      --border-color-active: color-mix(
        in srgb,
        var(--border-color) 50%,
        transparent
      );
      --track-border-color-active: var(--border-color-active);
      --background-color-active: color-mix(
        in srgb,
        var(--background-color) 75%,
        white
      );
      --fill-color-active: color-mix(in srgb, var(--fill-color) 75%, white);
      --thumb-color-active: color-mix(in srgb, var(--thumb-color) 75%, white);
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --track-border-color-readonly: var(--border-color);
      --background-color-readonly: var(--background-color);
      --fill-color-readonly: color-mix(in srgb, var(--fill-color) 30%, grey);
      --thumb-color-readonly: var(--fill-color-readonly);
      /* Disabled */
      --background-color-disabled: color-mix(
        in srgb,
        var(--background-color) 60%,
        transparent
      );
      --border-color-disabled: #b1b1b1;
      --track-border-color-disabled: var(--border-color-disabled);
      --fill-color-disabled: #cbcbcb;
      --thumb-color-disabled: #cbcbcb;
    }
  }

  .navi_input_range {
    --x-fill-ratio: 0;
    --x-border-color: var(--border-color);
    --x-track-border-color: var(--track-border-color);
    --x-background-color: var(--background-color);
    --x-fill-color: var(--fill-color);
    --x-thumb-color: var(--thumb-color);
    --x-thumb-border: none;
    --x-thumb-cursor: var(--thumb-cursor);

    position: relative;
    box-sizing: border-box;
    width: 100%;
    height: var(--height);
    margin: 2px;
    flex-direction: inherit;
    align-items: center;
    border-radius: 2px;
    outline-width: var(--outline-width);
    outline-style: none;
    outline-color: var(--outline-color);
    outline-offset: 2px;

    .navi_native_input {
      position: absolute;
      inset: 0;
      margin: 0;
      opacity: 0;
      --webkit-appearance: none;
      font-size: inherit;
      appearance: none;

      &::-webkit-slider-thumb {
        width: var(--thumb-width);
        height: var(--thumb-height);
        border-radius: var(--thumb-border-radius);
        -webkit-appearance: none;
        cursor: var(--x-thumb-cursor);
      }
    }

    .navi_input_range_background {
      position: absolute;
      width: 100%;
      height: var(--height);
      background: var(--x-background-color);
      border-width: 1px;
      border-style: solid;
      border-color: var(--x-border-color);
      border-radius: var(--border-radius);
    }
    .navi_input_range_track {
      position: absolute;
      box-sizing: border-box;
      width: 100%;
      height: var(--height);
      border-width: 1px;
      border-style: solid;
      border-color: var(--x-track-border-color);
      border-radius: var(--border-radius);
    }
    .navi_input_range_fill {
      position: absolute;
      width: 100%;
      height: var(--height);
      background: var(--x-fill-color);
      background-clip: content-box;
      border-radius: var(--border-radius);
      clip-path: inset(0 calc((1 - var(--x-fill-ratio)) * 100%) 0 0);
    }
    .navi_input_range_thumb {
      position: absolute;
      left: calc(
        var(--x-fill-ratio) * (100% - var(--thumb-size)) + var(--thumb-size) / 2
      );
      width: var(--thumb-width);
      height: var(--thumb-height);
      background: var(--x-thumb-color);
      border: var(--x-thumb-border);
      border-radius: var(--thumb-border-radius);
      transform: translateX(-50%);
      cursor: var(--x-thumb-cursor);
    }
    .navi_input_range_focus_proxy {
      position: absolute;
      inset: 0;
      opacity: 0;
    }

    /* Hover */
    &[data-hover] {
      --x-border-color: var(--border-color-hover);
      --x-track-border-color: var(--track-border-color-hover);
      --x-fill-color: var(--fill-color-hover);
      --x-thumb-color: var(--thumb-color-hover);
    }
    /* Active */
    &[data-active] {
      --x-border-color: var(--border-color-active);
      --x-track-border-color: var(--track-border-color-active);
      --x-background-color: var(--background-color-active);
      --x-fill-color: var(--fill-color-active);
      --x-thumb-color: var(--thumb-color-active);
    }
    /* Focus */
    &[data-focus-visible] {
      outline-style: solid;
    }
    /* Readonly */
    &[data-readonly] {
      --x-background-color: var(--background-color-readonly);
      --x-track-border-color: var(--track-border-color-readonly);
      --x-border-color: var(--border-color-readonly);
      --x-fill-color: var(--fill-color-readonly);
      --x-thumb-color: var(--thumb-color-readonly);
      --x-thumb-cursor: default;
    }
    /* Disabled */
    &[data-disabled] {
      --x-background-color: var(--background-color-disabled);
      --x-border-color: var(--border-color-disabled);
      --x-track-border-color: var(--track-border-color-disabled);
      --x-fill-color: var(--fill-color-disabled);
      --x-thumb-color: var(--thumb-color-disabled);
      --x-thumb-cursor: default;
    }
  }

  /* Disabled */
  .navi_input_range[data-disabled] {
    --x-background-color: var(--background-color-disabled);
    --x-accent-color: var(--accent-color-disabled);
  }
  /* Callout (info, warning, error) */
  .navi_input_range[data-callout] {
    /* What can we do? */
  }
`;
const InputRange = props => {
  const uiStateController = useUIStateController(props, "input");
  const uiState = useUIState(uiStateController);
  const input = renderActionableComponent(props, {
    Basic: InputRangeBasic,
    WithAction: InputRangeWithAction
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: input
    })
  });
};
const InputStyleCSSVars$1 = {
  "outlineWidth": "--outline-width",
  "borderRadius": "--border-radius",
  "borderColor": "--border-color",
  "backgroundColor": "--background-color",
  "accentColor": "--accent-color",
  ":hover": {
    borderColor: "--border-color-hover",
    backgroundColor: "--background-color-hover",
    fillColor: "--fill-color-hover",
    thumbColor: "--thumb-color-hover"
  },
  ":active": {
    borderColor: "--border-color-hover",
    backgroundColor: "--background-color-hover",
    fillColor: "--fill-color-active",
    thumbColor: "--thumb-color-active"
  },
  ":read-only": {
    borderColor: "--border-color-readonly",
    backgroundColor: "--background-color-readonly",
    fillColor: "--fill-color-readonly",
    thumbColor: "--thumb-color-readonly"
  },
  ":disabled": {
    borderColor: "--border-color-disabled",
    backgroundColor: "--background-color-disabled",
    fillColor: "--fill-color-disabled",
    thumbColor: "--thumb-color-disabled"
  }
};
const InputPseudoClasses$1 = [":hover", ":active", ":focus", ":focus-visible", ":read-only", ":disabled", ":-navi-loading"];
const InputPseudoElements$1 = ["::-navi-loader"];
const InputRangeBasic = props => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    onInput,
    readOnly,
    disabled,
    loading,
    autoFocus,
    autoFocusVisible,
    autoSelect,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const innerValue = uiState;
  const innerLoading = loading || contextLoading && contextLoadingElement === ref.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <label> parent of our readOnly state
  reportReadOnlyOnLabel?.(innerReadOnly);
  useAutoFocus(ref, autoFocus, {
    autoFocusVisible,
    autoSelect
  });
  const remainingProps = useConstraints(ref, rest);
  const innerOnInput = useStableCallback(onInput);
  const focusProxyId = `input_range_focus_proxy_${useId()}`;
  const inertButFocusable = innerReadOnly && !innerDisabled;
  const renderInput = inputProps => {
    const updateFillRatio = () => {
      const input = ref.current;
      if (!input) {
        return;
      }
      const inputValue = input.value;
      const ratio = (inputValue - input.min) / (input.max - input.min);
      input.parentNode.style.setProperty("--x-fill-ratio", ratio);
    };
    useLayoutEffect(() => {
      updateFillRatio();
    }, []);

    // we must disable the input when readOnly to prevent drag and keyboard interactions effectively
    // for some reason we have to do this here instead of just giving the disabled attribute
    // via props, as for some reason preact won't set it correctly on the input element in that case
    // this means however that the input is no longer focusable
    // we have to put an other focusable element somewhere
    useLayoutEffect(() => {
      const input = ref.current;
      if (!input) {
        return;
      }
      const focusProxy = document.querySelector(`#${focusProxyId}`);
      if (innerReadOnly) {
        if (document.activeElement === input) {
          focusProxy.focus({
            preventScroll: true
          });
        }
        input.setAttribute("focus-proxy", focusProxyId);
        input.disabled = innerReadOnly;
      } else {
        if (document.activeElement === focusProxy) {
          input.focus({
            preventScroll: true
          });
        }
        if (!innerDisabled) {
          input.disabled = false;
        }
        input.removeAttribute("focus-proxy");
      }
    }, [innerReadOnly, innerDisabled]);
    return jsx(Box, {
      ...inputProps,
      as: "input",
      type: "range",
      ref: ref,
      "data-value": uiState,
      value: innerValue,
      onInput: e => {
        const inputValue = e.target.valueAsNumber;
        uiStateController.setUIState(inputValue, e);
        innerOnInput?.(e);
        updateFillRatio();
      },
      onresetuistate: e => {
        uiStateController.resetUIState(e);
      },
      onsetuistate: e => {
        uiStateController.setUIState(e.detail.value, e);
        updateFillRatio();
      }
      // style management
      ,
      baseClassName: "navi_native_input"
    });
  };
  const renderInputMemoized = useCallback(renderInput, [uiState, innerValue, innerOnInput, innerDisabled, innerReadOnly]);
  return jsxs(Box, {
    as: "span",
    box: true,
    baseClassName: "navi_input_range",
    styleCSSVars: InputStyleCSSVars$1,
    pseudoStateSelector: ".navi_native_input",
    visualSelector: ".navi_native_input",
    basePseudoState: {
      ":read-only": innerReadOnly,
      ":disabled": innerDisabled,
      ":-navi-loading": innerLoading
    },
    pseudoClasses: InputPseudoClasses$1,
    pseudoElements: InputPseudoElements$1,
    hasChildFunction: true,
    ...remainingProps,
    ref: undefined,
    children: [jsx(LoaderBackground, {
      loading: innerLoading,
      color: "var(--loader-color)",
      inset: -1
    }), jsx("div", {
      className: "navi_input_range_background"
    }), jsx("div", {
      className: "navi_input_range_fill"
    }), jsx("div", {
      className: "navi_input_range_track"
    }), jsx("div", {
      className: "navi_input_range_thumb"
    }), jsx("div", {
      id: focusProxyId,
      className: "navi_input_range_focus_proxy",
      tabIndex: inertButFocusable ? "0" : "-1"
    }), renderInputMemoized]
  });
};
const InputRangeWithAction = props => {
  const uiState = useContext(UIStateContext);
  const {
    action,
    loading,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    cancelOnBlurInvalid,
    cancelOnEscape,
    actionErrorEffect,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect
  });
  // here updating the input won't call the associated action
  // (user have to blur or press enter for this to happen)
  // so we can keep the ui state on cancel/abort/error and let user decide
  // to update ui state or retry via blur/enter as is
  useActionEvents(ref, {
    onCancel: (e, reason) => {
      if (reason.startsWith("blur_invalid")) {
        if (!cancelOnBlurInvalid) {
          return;
        }
        if (
        // error prevent cancellation until the user closes it (or something closes it)
        e.detail.failedConstraintInfo.level === "error" && e.detail.failedConstraintInfo.reportStatus !== "closed") {
          return;
        }
      }
      if (reason === "escape_key") {
        if (!cancelOnEscape) {
          return;
        }
      }
      onCancel?.(e, reason);
    },
    onRequested: e => {
      forwardActionRequested(e, boundAction);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd
  });
  return jsx(InputRangeBasic, {
    "data-action": boundAction.name,
    ...rest,
    ref: ref,
    loading: loading || actionLoading
  });
};

const SearchSvg = () => jsx("svg", {
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  children: jsx("path", {
    d: "M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z",
    fill: "currentColor"
  })
});

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_input {
      --border-radius: 2px;
      --border-width: 1px;
      --outline-width: 1px;
      --outer-width: calc(var(--border-width) + var(--outline-width));

      /* Default */
      --outline-color: var(--navi-focus-outline-color);
      --loader-color: var(--navi-loader-color);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --color: currentColor;
      --color-dimmed: color-mix(in srgb, currentColor 60%, transparent);
      --placeholder-color: var(--color-dimmed);
      /* Hover */
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
      --color-hover: var(--color);
      /* Active */
      --border-color-active: color-mix(in srgb, var(--border-color) 90%, black);
      /* Readonly */
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 45%,
        transparent
      );
      --background-color-readonly: var(--background-color);
      --color-readonly: var(--color-dimmed);
      /* Disabled */
      --border-color-disabled: var(--border-color-readonly);
      --background-color-disabled: color-mix(
        in srgb,
        var(--background-color) 95%,
        grey
      );
      --color-disabled: color-mix(in srgb, var(--color) 95%, grey);
    }
  }

  .navi_input {
    position: relative;
    box-sizing: border-box;
    width: fit-content;
    height: fit-content;
    flex-direction: inherit;
    border-radius: inherit;
    cursor: inherit;

    --x-outline-width: var(--outline-width);
    --x-border-radius: var(--border-radius);
    --x-border-width: var(--border-width);
    --x-outer-width: calc(var(--x-border-width) + var(--x-outline-width));
    --x-outline-color: var(--outline-color);
    --x-border-color: var(--border-color);
    --x-background-color: var(--background-color);
    --x-color: var(--color);
    --x-placeholder-color: var(--placeholder-color);

    .navi_native_input {
      box-sizing: border-box;
      padding-top: var(--padding-top, var(--padding-y, var(--padding, 1px)));
      padding-right: var(
        --padding-right,
        var(--padding-x, var(--padding, 2px))
      );
      padding-bottom: var(
        --padding-bottom,
        var(--padding-y, var(--padding, 1px))
      );
      padding-left: var(--padding-left, var(--padding-x, var(--padding, 2px)));
      color: var(--x-color);
      background-color: var(--x-background-color);
      border-width: var(--x-outer-width);
      border-width: var(--x-outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--x-border-radius);
      outline-width: var(--x-border-width);
      outline-style: solid;
      outline-color: var(--x-border-color);
      outline-offset: calc(-1 * (var(--x-border-width)));

      &[type="search"] {
        -webkit-appearance: textfield;

        &::-webkit-search-cancel-button {
          display: none;
        }
      }
    }

    .navi_start_icon_label {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0.25em;
    }
    .navi_end_icon_label {
      position: absolute;
      top: 0;
      right: 0.25em;
      bottom: 0;
      opacity: 0;
      pointer-events: none;
    }
    &[data-has-value] {
      .navi_end_icon_label {
        opacity: 1;
        pointer-events: auto;
      }
    }

    &[data-start-icon] {
      .navi_native_input {
        padding-left: 20px;
      }
    }
    &[data-end-icon] {
      .navi_native_input {
        padding-right: 20px;
      }
    }
  }

  .navi_input .navi_native_input::placeholder {
    color: var(--x-placeholder-color);
  }
  .navi_input .navi_native_input:-internal-autofill-selected {
    /* Webkit is putting some nasty styles after automplete that look as follow */
    /* input:-internal-autofill-selected { color: FieldText !important; } */
    /* Fortunately we can override it as follow */
    -webkit-text-fill-color: var(--x-color) !important;
  }
  /* Readonly */
  .navi_input[data-readonly] {
    --x-border-color: var(--border-color-readonly);
    --x-background-color: var(--background-color-readonly);
    --x-color: var(--color-readonly);
  }
  /* Focus */
  .navi_input[data-focus] .navi_native_input,
  .navi_input[data-focus-visible] .navi_native_input {
    outline-width: var(--x-outer-width);
    outline-offset: calc(-1 * var(--x-outer-width));
    --x-border-color: var(--x-outline-color);
  }
  /* Disabled */
  .navi_input[data-disabled] {
    --x-border-color: var(--border-color-disabled);
    --x-background-color: var(--background-color-disabled);
    --x-color: var(--color-disabled);
  }
  /* Callout (info, warning, error) */
  .navi_input[data-callout] {
    --x-border-color: var(--callout-color);
  }
`;
const InputTextual = props => {
  const uiStateController = useUIStateController(props, "input");
  const uiState = useUIState(uiStateController);
  const input = renderActionableComponent(props, {
    Basic: InputTextualBasic,
    WithAction: InputTextualWithAction
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: input
    })
  });
};
const InputStyleCSSVars = {
  "outlineWidth": "--outline-width",
  "borderWidth": "--border-width",
  "borderRadius": "--border-radius",
  "paddingTop": "--padding-top",
  "paddingRight": "--padding-right",
  "paddingBottom": "--padding-bottom",
  "paddingLeft": "--padding-left",
  "backgroundColor": "--background-color",
  "borderColor": "--border-color",
  "color": "--color",
  ":hover": {
    backgroundColor: "--background-color-hover",
    borderColor: "--border-color-hover",
    color: "--color-hover"
  },
  ":active": {
    borderColor: "--border-color-active"
  },
  ":read-only": {
    backgroundColor: "--background-color-readonly",
    borderColor: "--border-color-readonly",
    color: "--color-readonly"
  },
  ":disabled": {
    backgroundColor: "--background-color-disabled",
    borderColor: "--border-color-disabled",
    color: "--color-disabled"
  }
};
const InputPseudoClasses = [":hover", ":active", ":focus", ":focus-visible", ":read-only", ":disabled", ":-navi-loading", ":navi-has-value"];
Object.assign(PSEUDO_CLASSES, {
  ":navi-has-value": {
    attribute: "data-has-value",
    setup: (el, callback) => {
      const onValueChange = () => {
        callback();
      };

      // Standard user input (typing)
      el.addEventListener("input", onValueChange);
      // Autocomplete, programmatic changes, form restoration
      el.addEventListener("change", onValueChange);
      // Form reset - need to check the form
      const form = el.form;
      const onFormReset = () => {
        // Form reset happens asynchronously, check value after reset completes
        setTimeout(onValueChange, 0);
      };
      if (form) {
        form.addEventListener("reset", onFormReset);
      }

      // Paste events (some browsers need special handling)
      el.addEventListener("paste", onValueChange);
      // Focus events to catch programmatic changes that don't fire other events
      // (like when value is set before user interaction)
      el.addEventListener("focus", onValueChange);
      return () => {
        el.removeEventListener("input", onValueChange);
        el.removeEventListener("change", onValueChange);
        el.removeEventListener("paste", onValueChange);
        el.removeEventListener("focus", onValueChange);
        if (form) {
          form.removeEventListener("reset", onFormReset);
        }
      };
    },
    test: el => {
      if (el.value === "") {
        return false;
      }
      return true;
    }
  }
});
const InputPseudoElements = ["::-navi-loader"];
const InputTextualBasic = props => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const reportReadOnlyOnLabel = useContext(ReportReadOnlyOnLabelContext);
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    type,
    onInput,
    readOnly,
    disabled,
    loading,
    autoFocus,
    autoFocusVisible,
    autoSelect,
    icon,
    cancelButton = type === "search",
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = rest.ref || defaultRef;
  const innerValue = type === "datetime-local" ? convertToLocalTimezone(uiState) : uiState;
  const innerLoading = loading || contextLoading && contextLoadingElement === ref.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <label> parent of our readOnly state
  reportReadOnlyOnLabel?.(innerReadOnly);
  useAutoFocus(ref, autoFocus, {
    autoFocusVisible,
    autoSelect
  });
  const remainingProps = useConstraints(ref, rest);
  const innerOnInput = useStableCallback(onInput);
  const autoId = useId();
  const innerId = rest.id || autoId;
  const renderInput = inputProps => {
    return jsx(Box, {
      ...inputProps,
      as: "input",
      id: innerId,
      ref: ref,
      type: type,
      "data-value": uiState,
      value: innerValue,
      onInput: e => {
        let inputValue;
        if (type === "number") {
          inputValue = e.target.valueAsNumber;
          if (isNaN(inputValue)) {
            inputValue = e.target.value;
          }
        } else if (type === "datetime-local") {
          inputValue = convertToUTCTimezone(e.target.value);
        } else {
          inputValue = e.target.value;
        }
        uiStateController.setUIState(inputValue, e);
        innerOnInput?.(e);
      },
      onresetuistate: e => {
        uiStateController.resetUIState(e);
      },
      onsetuistate: e => {
        uiStateController.setUIState(e.detail.value, e);
      }
      // style management
      ,
      baseClassName: "navi_native_input"
    });
  };
  const renderInputMemoized = useCallback(renderInput, [type, uiState, innerValue, innerOnInput, innerId]);
  let innerIcon;
  if (icon === undefined) {
    if (type === "search") {
      innerIcon = jsx(SearchSvg, {});
    } else if (type === "email") {
      innerIcon = jsx(EmailSvg, {});
    } else if (type === "tel") {
      innerIcon = jsx(PhoneSvg, {});
    }
  } else {
    innerIcon = icon;
  }
  return jsxs(Box, {
    as: "span",
    box: true,
    baseClassName: "navi_input",
    styleCSSVars: InputStyleCSSVars,
    pseudoStateSelector: ".navi_native_input",
    visualSelector: ".navi_native_input",
    basePseudoState: {
      ":read-only": innerReadOnly,
      ":disabled": innerDisabled,
      ":-navi-loading": innerLoading
    },
    pseudoClasses: InputPseudoClasses,
    pseudoElements: InputPseudoElements,
    hasChildFunction: true,
    "data-start-icon": innerIcon ? "" : undefined,
    "data-end-icon": cancelButton ? "" : undefined,
    ...remainingProps,
    ref: undefined,
    children: [jsx(LoaderBackground, {
      loading: innerLoading,
      color: "var(--loader-color)",
      inset: -1
    }), innerIcon && jsx(Icon, {
      as: "label",
      htmlFor: innerId,
      className: "navi_start_icon_label",
      alignY: "center",
      color: "rgba(28, 43, 52, 0.5)",
      children: innerIcon
    }), renderInputMemoized, cancelButton && jsx(Icon, {
      as: "label",
      htmlFor: innerId,
      className: "navi_end_icon_label",
      alignY: "center",
      color: "rgba(28, 43, 52, 0.5)",
      onMousedown: e => {
        e.preventDefault(); // keep focus on the button
      },
      onClick: () => {
        uiStateController.setUIState("", {
          trigger: "cancel_button"
        });
      },
      children: jsx(CloseSvg, {})
    })]
  });
};
const InputTextualWithAction = props => {
  const uiState = useContext(UIStateContext);
  const {
    action,
    loading,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    cancelOnBlurInvalid,
    cancelOnEscape,
    actionErrorEffect,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect
  });
  // here updating the input won't call the associated action
  // (user have to blur or press enter for this to happen)
  // so we can keep the ui state on cancel/abort/error and let user decide
  // to update ui state or retry via blur/enter as is
  useActionEvents(ref, {
    onCancel: (e, reason) => {
      if (reason.startsWith("blur_invalid")) {
        if (!cancelOnBlurInvalid) {
          return;
        }
        if (
        // error prevent cancellation until the user closes it (or something closes it)
        e.detail.failedConstraintInfo.level === "error" && e.detail.failedConstraintInfo.reportStatus !== "closed") {
          return;
        }
      }
      if (reason === "escape_key") {
        if (!cancelOnEscape) {
          return;
        }
      }
      onCancel?.(e, reason);
    },
    onRequested: e => {
      forwardActionRequested(e, boundAction);
    },
    onPrevented: onActionPrevented,
    onAction: executeAction,
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd
  });
  return jsx(InputTextualBasic, {
    "data-action": boundAction.name,
    ...rest,
    ref: ref,
    loading: loading || actionLoading
  });
};

// As explained in https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local#setting_timezones
// datetime-local does not support timezones
const convertToLocalTimezone = dateTimeString => {
  const date = new Date(dateTimeString);
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return dateTimeString;
  }

  // Format to YYYY-MM-DDThh:mm:ss
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};
/**
 * Converts a datetime string without timezone (local time) to UTC format with 'Z' notation
 *
 * @param {string} localDateTimeString - Local datetime string without timezone (e.g., "2023-07-15T14:30:00")
 * @returns {string} Datetime string in UTC with 'Z' notation (e.g., "2023-07-15T12:30:00Z")
 */
const convertToUTCTimezone = localDateTimeString => {
  if (!localDateTimeString) {
    return localDateTimeString;
  }
  try {
    // Create a Date object using the local time string
    // The browser will interpret this as local timezone
    const localDate = new Date(localDateTimeString);

    // Check if the date is valid
    if (isNaN(localDate.getTime())) {
      return localDateTimeString;
    }

    // Convert to UTC ISO string
    const utcString = localDate.toISOString();

    // Return the UTC string (which includes the 'Z' notation)
    return utcString;
  } catch (error) {
    console.error("Error converting local datetime to UTC:", error);
    return localDateTimeString;
  }
};

const Input = props => {
  const {
    type
  } = props;
  if (type === "radio") {
    return jsx(InputRadio, {
      ...props
    });
  }
  if (type === "checkbox") {
    return jsx(InputCheckbox, {
      ...props
    });
  }
  if (type === "range") {
    return jsx(InputRange, {
      ...props
    });
  }
  return jsx(InputTextual, {
    ...props
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_editable_wrapper {
    position: absolute;
    inset: 0;
  }
`;
const useEditionController = () => {
  const [editing, editingSetter] = useState(null);
  const startEditing = useCallback(event => {
    editingSetter(current => {
      return current || {
        event
      };
    });
  }, []);
  const stopEditing = useCallback(() => {
    editingSetter(null);
  }, []);
  const prevEditingRef = useRef(editing);
  const editionJustEnded = prevEditingRef.current && !editing;
  prevEditingRef.current = editing;
  return {
    editing,
    startEditing,
    stopEditing,
    editionJustEnded
  };
};
const Editable = forwardRef((props, ref) => {
  let {
    children,
    action,
    editing,
    name,
    value,
    valueSignal,
    onEditEnd,
    constraints,
    type,
    required,
    readOnly,
    min,
    max,
    step,
    minLength,
    maxLength,
    pattern,
    wrapperProps,
    autoSelect = true,
    width,
    height,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  if (valueSignal) {
    value = valueSignal.value;
  }
  const editingPreviousRef = useRef(editing);
  const valueWhenEditStartRef = useRef(editing ? value : undefined);
  if (editingPreviousRef.current !== editing) {
    if (editing) {
      valueWhenEditStartRef.current = value; // Always store the external value
    }
    editingPreviousRef.current = editing;
  }

  // Simulate typing the initial value when editing starts with a custom value
  useLayoutEffect(() => {
    if (!editing) {
      return;
    }
    const editingEvent = editing.event;
    if (!editingEvent) {
      return;
    }
    const editingEventInitialValue = editingEvent.detail?.initialValue;
    if (editingEventInitialValue === undefined) {
      return;
    }
    const input = innerRef.current;
    input.value = editingEventInitialValue;
    input.dispatchEvent(new CustomEvent("input", {
      bubbles: false
    }));
  }, [editing]);
  const input = jsx(Input, {
    ref: innerRef,
    ...rest,
    type: type,
    name: name,
    value: value,
    valueSignal: valueSignal,
    autoFocus: true,
    autoFocusVisible: true,
    autoSelect: autoSelect,
    cancelOnEscape: true,
    cancelOnBlurInvalid: true,
    constraints: constraints,
    required: required,
    readOnly: readOnly,
    min: min,
    max: max,
    step: step,
    minLength: minLength,
    maxLength: maxLength,
    pattern: pattern,
    width: width,
    height: height,
    onCancel: e => {
      if (valueSignal) {
        valueSignal.value = valueWhenEditStartRef.current;
      }
      onEditEnd({
        cancelled: true,
        event: e
      });
    },
    onBlur: e => {
      const value = type === "number" ? e.target.valueAsNumber : e.target.value;
      const valueWhenEditStart = valueWhenEditStartRef.current;
      if (value === valueWhenEditStart) {
        onEditEnd({
          cancelled: true,
          event: e
        });
        return;
      }
    },
    action: action || (() => {}),
    onActionEnd: e => {
      onEditEnd({
        success: true,
        event: e
      });
    }
  });
  return jsxs(Fragment, {
    children: [children || jsx("span", {
      children: value
    }), editing && jsx("div", {
      ...wrapperProps,
      className: ["navi_editable_wrapper", ...(wrapperProps?.className || "").split(" ")].join(" "),
      children: input
    })]
  });
});

const collectFormElementValues = (element) => {
  let formElements;
  if (element.tagName === "FORM") {
    formElements = element.elements;
  } else {
    // fieldset or anything else
    formElements = element.querySelectorAll(
      "input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button[name]:not([disabled])",
    );
  }

  const values = {};
  const checkboxArrayNameSet = new Set();
  for (const formElement of formElements) {
    if (formElement.type === "checkbox" && formElement.name) {
      const name = formElement.name;
      const endsWithBrackets = name.endsWith("[]");
      if (endsWithBrackets) {
        checkboxArrayNameSet.add(name);
        values[name] = [];
        continue;
      }
      const closestDataCheckboxList = formElement.closest(
        "[data-checkbox-list]",
      );
      if (closestDataCheckboxList) {
        checkboxArrayNameSet.add(name);
        values[name] = [];
      }
    }
  }

  for (const formElement of formElements) {
    const name = formElement.name;
    if (!name) {
      continue;
    }
    const value = getFormElementValue(formElement);
    if (value === undefined) {
      continue; // Skip unchecked checkboxes/radios
    }
    if (formElement.type === "checkbox" && checkboxArrayNameSet.has(name)) {
      values[name].push(value);
    } else {
      values[name] = value;
    }
  }
  return values;
};

const getFormElementValue = (formElement) => {
  const { type, tagName } = formElement;

  if (tagName === "SELECT") {
    if (formElement.multiple) {
      return Array.from(formElement.selectedOptions, (option) =>
        getValue(option),
      );
    }
    return formElement.value;
  }

  if (type === "checkbox" || type === "radio") {
    return formElement.checked ? getValue(formElement) : undefined;
  }

  if (type === "file") {
    return formElement.files; // Return FileList for special handling
  }

  return getValue(formElement);
};

const getValue = (formElement) => {
  const hasDataValueAttribute = formElement.hasAttribute("data-value");
  if (hasDataValueAttribute) {
    // happens for "datetime-local" inputs to keep the timezone
    // consistent when sending to the server
    return formElement.getAttribute("data-value");
  }
  return formElement.value;
};

/**
 *
 * Here we want the same behaviour as web standards:
 *
 * 1. When submitting the form URL does not change
 * 2. When form submission id done user is redirected (by default the current one)
 *    (we can configure this using target)
 *    So for example user might be reidrect to a page with the resource he just created
 *    I could create an example where we would put a link on the page to let user see what he created
 *    but by default user stays on the form allowing to create multiple resources at once
 *    And an other where he is redirected to the resource he created
 * 3. If form submission fails ideally we should display this somewhere on the UI
 *    right now it's just logged to the console I need to see how we can achieve this
 */

const Form = props => {
  const uiStateController = useUIGroupStateController(props, "form", {
    childComponentType: "*",
    aggregateChildStates: childUIStateControllers => {
      const formValues = {};
      for (const childUIStateController of childUIStateControllers) {
        const {
          name,
          uiState
        } = childUIStateController;
        if (!name) {
          console.warn("A form child component is missing a name property, its state won't be included in the form state", childUIStateController);
          continue;
        }
        formValues[name] = uiState;
      }
      return formValues;
    }
  });
  const uiState = useUIState(uiStateController);
  const form = renderActionableComponent(props, {
    Basic: FormBasic,
    WithAction: FormWithAction
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: form
    })
  });
};
const FormBasic = props => {
  const uiStateController = useContext(UIStateControllerContext);
  const {
    readOnly,
    loading,
    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;

  // instantiate validation via useConstraints hook:
  // - receive "actionrequested" custom event ensure submit is prevented
  // (and also execute action without validation if form.submit() is ever called)
  const remainingProps = useConstraints(ref, rest);
  const innerReadOnly = readOnly || loading;
  const formContextValue = useMemo(() => {
    return {
      loading
    };
  }, [loading]);
  return jsx(Box, {
    ...remainingProps,
    as: "form",
    ref: ref,
    onReset: e => {
      // browser would empty all fields to their default values (likely empty/unchecked)
      // we want to reset to the last known external state instead
      e.preventDefault();
      uiStateController.resetUIState(e);
    },
    children: jsx(ParentUIStateControllerContext.Provider, {
      value: uiStateController,
      children: jsx(ReadOnlyContext.Provider, {
        value: innerReadOnly,
        children: jsx(LoadingContext.Provider, {
          value: loading,
          children: jsx(FormContext.Provider, {
            value: formContextValue,
            children: children
          })
        })
      })
    })
  });
};
const FormWithAction = props => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    method,
    actionErrorEffect = "show_validation_message",
    // "show_validation_message" or "throw"
    errorMapping,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    loading,
    children,
    ...rest
  } = props;
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  const [actionBoundToUIState] = useActionBoundToOneParam(action, uiState);
  const executeAction = useExecuteAction(ref, {
    errorEffect: actionErrorEffect,
    errorMapping
  });
  const {
    actionPending,
    actionRequester: formActionRequester
  } = useRequestedActionStatus(ref);
  useActionEvents(ref, {
    onPrevented: onActionPrevented,
    onRequested: e => {
      forwardActionRequested(e, actionBoundToUIState);
    },
    onAction: e => {
      const form = ref.current;
      const formElementValues = collectFormElementValues(form);
      uiStateController.setUIState(formElementValues, e);
      executeAction(e);
    },
    onStart: onActionStart,
    onAbort: e => {
      // user might want to re-submit as is
      // or change the ui state before re-submitting
      // we can't decide for him
      onActionAbort?.(e);
    },
    onError: e => {
      // user might want to re-submit as is
      // or change the ui state before re-submitting
      // we can't decide for him
      onActionError?.(e);
    },
    onEnd: e => {
      // form side effect is a success
      // we can get rid of the nav state
      // that was keeping the ui state in case user navigates away without submission
      uiStateController.actionEnd(e);
      onActionEnd?.(e);
    }
  });
  const innerLoading = loading || actionPending;
  return jsx(FormBasic, {
    "data-action": actionBoundToUIState.name,
    "data-method": action.meta?.httpVerb || method || "GET",
    ...rest,
    ref: ref,
    loading: innerLoading,
    children: jsx(FormActionContext.Provider, {
      value: actionBoundToUIState,
      children: jsx(LoadingElementContext.Provider, {
        value: formActionRequester,
        children: children
      })
    })
  });
};

// const dispatchCustomEventOnFormAndFormElements = (type, options) => {
//   const form = innerRef.current;
//   const customEvent = new CustomEvent(type, options);
//   // https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/elements
//   for (const element of form.elements) {
//     element.dispatchEvent(customEvent);
//   }
//   form.dispatchEvent(customEvent);
// };

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_group {
    --border-width: 1px;

    > *:hover,
    > *[data-hover] {
      position: relative;
      z-index: 1;
    }
    > *:focus-visible,
    > *[data-focus-visible] {
      position: relative;
      z-index: 1;
    }

    /* Horizontal (default): Cumulative margin for border overlap */
    &:not([data-vertical]) {
      > *:not(:first-child) {
        margin-left: calc(var(--border-width) * -1);
      }
      > *:first-child:not(:only-child) {
        border-top-right-radius: 0 !important;
        border-bottom-right-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-top-right-radius: 0 !important;
          border-bottom-right-radius: 0 !important;
        }
      }

      > *:last-child:not(:only-child) {
        border-top-left-radius: 0 !important;
        border-bottom-left-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-top-left-radius: 0 !important;
          border-bottom-left-radius: 0 !important;
        }
      }

      > *:not(:first-child):not(:last-child) {
        border-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-radius: 0 !important;
        }
      }
    }

    /* Vertical: Cumulative margin for border overlap */
    &[data-vertical] {
      > *:not(:first-child) {
        margin-top: calc(var(--border-width) * -1);
      }
      > *:first-child:not(:only-child) {
        border-bottom-right-radius: 0 !important;
        border-bottom-left-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-bottom-right-radius: 0 !important;
          border-bottom-left-radius: 0 !important;
        }
      }

      > *:last-child:not(:only-child) {
        border-top-left-radius: 0 !important;
        border-top-right-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-top-left-radius: 0 !important;
          border-top-right-radius: 0 !important;
        }
      }

      > *:not(:first-child):not(:last-child) {
        border-radius: 0 !important;

        .navi_button_content,
        .navi_native_input {
          border-radius: 0 !important;
        }
      }
    }
  }
`;
const Group = ({
  children,
  borderWidth = 1,
  row,
  vertical = row,
  ...props
}) => {
  if (typeof borderWidth === "string") {
    borderWidth = parseFloat(borderWidth);
  }
  const borderWidthCssValue = typeof borderWidth === "number" ? `${borderWidth}px` : borderWidth;
  return jsx(Box, {
    baseClassName: "navi_group",
    "data-vertical": vertical ? "" : undefined,
    row: row,
    ...props,
    style: {
      "--border-width": borderWidthCssValue,
      ...props.style
    },
    children: children
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */``;
const RadioList = props => {
  const uiStateController = useUIGroupStateController(props, "radio_list", {
    childComponentType: "radio",
    aggregateChildStates: childUIStateControllers => {
      let activeValue;
      for (const childUIStateController of childUIStateControllers) {
        if (childUIStateController.uiState) {
          activeValue = childUIStateController.uiState;
          break;
        }
      }
      return activeValue;
    }
  });
  const uiState = useUIState(uiStateController);
  const radioList = renderActionableComponent(props, {
    Basic: RadioListBasic,
    WithAction: RadioListWithAction
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: radioList
    })
  });
};
const Radio = InputRadio;
const RadioListBasic = props => {
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const contextLoading = useContext(LoadingContext);
  const uiStateController = useContext(UIStateControllerContext);
  const {
    name,
    loading,
    disabled,
    readOnly,
    children,
    required,
    ...rest
  } = props;
  const innerLoading = loading || contextLoading;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  return jsx(Box, {
    "data-action": rest["data-action"],
    row: true,
    ...rest,
    baseClassName: "navi_radio_list",
    "data-radio-list": true,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    },
    children: jsx(ParentUIStateControllerContext.Provider, {
      value: uiStateController,
      children: jsx(FieldNameContext.Provider, {
        value: name,
        children: jsx(ReadOnlyContext.Provider, {
          value: innerReadOnly,
          children: jsx(DisabledContext.Provider, {
            value: innerDisabled,
            children: jsx(RequiredContext.Provider, {
              value: required,
              children: jsx(LoadingContext.Provider, {
                value: innerLoading,
                children: children
              })
            })
          })
        })
      })
    })
  });
};
const RadioListWithAction = props => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    loading,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  const [actionRequester, setActionRequester] = useState(null);
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      uiStateController.resetUIState(e);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: actionEvent => {
      setActionRequester(actionEvent.detail.requester);
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: e => {
      uiStateController.resetUIState(e);
      onActionAbort?.(e);
    },
    onError: e => {
      uiStateController.resetUIState(e);
      onActionError?.(e);
    },
    onEnd: e => {
      onActionEnd?.(e);
    }
  });
  return jsx(RadioListBasic, {
    "data-action": boundAction,
    ...rest,
    ref: innerRef,
    onChange: e => {
      const radio = e.target;
      const radioListContainer = innerRef.current;
      requestAction(radioListContainer, boundAction, {
        event: e,
        requester: radio,
        actionOrigin: "action_prop"
      });
    },
    loading: loading || actionLoading,
    children: jsx(LoadingElementContext.Provider, {
      value: actionRequester,
      children: children
    })
  });
};

const useRefArray = (items, keyFromItem) => {
  const refMapRef = useRef(new Map());
  const previousKeySetRef = useRef(new Set());

  return useMemo(() => {
    const refMap = refMapRef.current;
    const previousKeySet = previousKeySetRef.current;
    const currentKeySet = new Set();
    const refArray = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const key = keyFromItem(item);
      currentKeySet.add(key);

      const refForKey = refMap.get(key);
      if (refForKey) {
        refArray[i] = refForKey;
      } else {
        const newRef = createRef();
        refMap.set(key, newRef);
        refArray[i] = newRef;
      }
    }

    for (const key of previousKeySet) {
      if (!currentKeySet.has(key)) {
        refMap.delete(key);
      }
    }
    previousKeySetRef.current = currentKeySet;

    return refArray;
  }, [items]);
};

installImportMetaCss(import.meta);const useNavState = () => {};
import.meta.css = /* css */`
  .navi_select[data-readonly] {
    pointer-events: none;
  }
`;
const Select = forwardRef((props, ref) => {
  const select = renderActionableComponent(props, ref);
  return select;
});
const SelectControlled = forwardRef((props, ref) => {
  const {
    name,
    value,
    loading,
    disabled,
    readOnly,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const selectElement = jsx("select", {
    className: "navi_select",
    ref: innerRef,
    "data-readonly": readOnly && !disabled ? "" : undefined,
    onKeyDown: e => {
      if (readOnly) {
        e.preventDefault();
      }
    },
    ...rest,
    children: children.map(child => {
      const {
        label,
        readOnly: childReadOnly,
        disabled: childDisabled,
        loading: childLoading,
        value: childValue,
        ...childRest
      } = child;
      return jsx("option", {
        name: name,
        value: childValue,
        selected: childValue === value,
        readOnly: readOnly || childReadOnly,
        disabled: disabled || childDisabled,
        loading: loading || childLoading,
        ...childRest,
        children: label
      }, childValue);
    })
  });
  return jsx(LoaderBackground, {
    loading: loading,
    color: "light-dark(#355fcc, #3b82f6)",
    inset: -1,
    children: selectElement
  });
});
forwardRef((props, ref) => {
  const {
    value: initialValue,
    id,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState();
  const valueAtStart = navState === undefined ? initialValue : navState;
  const [value, setValue] = useState(valueAtStart);
  useEffect(() => {
    setNavState(value);
  }, [value]);
  return jsx(SelectControlled, {
    ref: innerRef,
    value: value,
    onChange: event => {
      const select = event.target;
      const selectedValue = select.value;
      setValue(selectedValue);
    },
    ...rest,
    children: children
  });
});
forwardRef((props, ref) => {
  const {
    id,
    name,
    value: externalValue,
    valueSignal,
    action,
    children,
    onCancel,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    actionErrorEffect,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState, resetNavState] = useNavState();
  const [boundAction, value, setValue, initialValue] = useActionBoundToOneParam(action, name);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  useEffect(() => {
    setNavState(value);
  }, [value]);
  const actionRequesterRef = useRef(null);
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      resetNavState();
      setValue(initialValue);
      onCancel?.(e, reason);
    },
    onPrevented: onActionPrevented,
    onAction: actionEvent => {
      actionRequesterRef.current = actionEvent.detail.requester;
      executeAction(actionEvent);
    },
    onStart: onActionStart,
    onAbort: e => {
      setValue(initialValue);
      onActionAbort?.(e);
    },
    onError: error => {
      setValue(initialValue);
      onActionError?.(error);
    },
    onEnd: () => {
      resetNavState();
      onActionEnd?.();
    }
  });
  const childRefArray = useRefArray(children, child => child.value);
  return jsx(SelectControlled, {
    ref: innerRef,
    name: name,
    value: value,
    "data-action": boundAction,
    onChange: event => {
      const select = event.target;
      const selectedValue = select.value;
      setValue(selectedValue);
      const radioListContainer = innerRef.current;
      const optionSelected = select.querySelector(`option[value="${selectedValue}"]`);
      requestAction(radioListContainer, boundAction, {
        event,
        requester: optionSelected
      });
    },
    ...rest,
    children: children.map((child, i) => {
      const childRef = childRefArray[i];
      return {
        ...child,
        ref: childRef,
        loading: child.loading || actionLoading && actionRequesterRef.current === childRef.current,
        readOnly: child.readOnly || actionLoading
      };
    })
  });
});

const TableSelectionContext = createContext();
const useTableSelectionContextValue = (
  selection,
  selectionController,
) => {
  const selectionContextValue = useMemo(() => {
    const selectedColumnIds = [];
    const selectedRowIds = [];
    const columnIdWithSomeSelectedCellSet = new Set();
    const rowIdWithSomeSelectedCellSet = new Set();
    for (const item of selection) {
      const selectionValueInfo = parseTableSelectionValue(item);
      if (selectionValueInfo.type === "row") {
        const { rowId } = selectionValueInfo;
        selectedRowIds.push(rowId);
        continue;
      }
      if (selectionValueInfo.type === "column") {
        const { columnId } = selectionValueInfo;
        selectedColumnIds.push(columnId);
        continue;
      }
      if (selectionValueInfo.type === "cell") {
        const { cellId, columnId, rowId } = selectionValueInfo;
        columnIdWithSomeSelectedCellSet.add(columnId);
        rowIdWithSomeSelectedCellSet.add(rowId);
        continue;
      }
    }
    return {
      selection,
      selectionController,
      selectedColumnIds,
      selectedRowIds,
      columnIdWithSomeSelectedCellSet,
      rowIdWithSomeSelectedCellSet,
    };
  }, [selection]);

  return selectionContextValue;
};

const parseTableSelectionValue = (selectionValue) => {
  if (selectionValue.startsWith("column:")) {
    const columnId = selectionValue.slice("column:".length);
    return { type: "column", columnId };
  }
  if (selectionValue.startsWith("row:")) {
    const rowId = selectionValue.slice("row:".length);
    return { type: "row", rowId };
  }
  const cellId = selectionValue.slice("cell:".length);
  const [columnId, rowId] = cellId.split("-");
  return { type: "cell", cellId, columnId, rowId };
};
const stringifyTableSelectionValue = (type, value) => {
  if (type === "cell") {
    const { columnId, rowId } = value;
    return `cell:${columnId}-${rowId}`;
  }
  if (type === "column") {
    return `column:${value}`;
  }
  if (type === "row") {
    return `row:${value}`;
  }
  return "";
};

/**
 * Check if a specific cell is selected
 * @param {Array} selection - The selection set or array
 * @param {{rowIndex: number, columnIndex: number}} cellPosition - Cell coordinates
 * @returns {boolean} True if the cell is selected
 */
const isCellSelected = (selection, cellId) => {
  const cellSelectionValue = stringifyTableSelectionValue("cell", cellId);
  return selection.includes(cellSelectionValue);
};

/**
 * Check if a specific row is selected
 * @param {Array} selection - The selection set or array
 * @param {number} rowIndex - Row index
 * @returns {boolean} True if the row is selected
 */
const isRowSelected = (selection, rowId) => {
  const rowSelectionValue = stringifyTableSelectionValue("row", rowId);
  return selection.includes(rowSelectionValue);
};

/**
 * Check if a specific column is selected
 * @param {Array} selection - The selection set or array
 * @param {number} columnIndex - Column index
 * @returns {boolean} True if the column is selected
 */
const isColumnSelected = (selection, columnId) => {
  const columnSelectionValue = stringifyTableSelectionValue("column", columnId);
  return selection.has(columnSelectionValue);
};

// https://github.com/reach/reach-ui/tree/b3d94d22811db6b5c0f272b9a7e2e3c1bb4699ae/packages/descendants
// https://github.com/pacocoursey/use-descendants/tree/master

const createIsolatedItemTracker = () => {
  // Producer contexts (ref-based, no re-renders)
  const ProducerTrackerContext = createContext();
  const ProducerItemCountRefContext = createContext();
  const ProducerListRenderIdContext = createContext();

  // Consumer contexts (state-based, re-renders)
  const ConsumerItemsContext = createContext();
  const useIsolatedItemTrackerProvider = () => {
    const itemsRef = useRef([]);
    const items = itemsRef.current;
    const itemCountRef = useRef();
    const pendingFlushRef = useRef(false);
    const producerIsRenderingRef = useRef(false);
    const itemTracker = useMemo(() => {
      const registerItem = (index, value) => {
        const hasValue = index in items;
        if (hasValue) {
          const currentValue = items[index];
          if (compareTwoJsValues(currentValue, value)) {
            return;
          }
        }
        items[index] = value;
        if (producerIsRenderingRef.current) {
          // Consumer will sync after producer render completes
          return;
        }
        pendingFlushRef.current = true;
      };
      const getProducerItem = itemIndex => {
        return items[itemIndex];
      };
      const ItemProducerProvider = ({
        children
      }) => {
        items.length = 0;
        itemCountRef.current = 0;
        pendingFlushRef.current = false;
        producerIsRenderingRef.current = true;
        const listRenderId = {};
        useLayoutEffect(() => {
          producerIsRenderingRef.current = false;
        });

        // CRITICAL: Sync consumer state on subsequent renders
        const renderedOnce = useRef(false);
        useLayoutEffect(() => {
          if (!renderedOnce.current) {
            renderedOnce.current = true;
            return;
          }
          pendingFlushRef.current = true;
          itemTracker.flushToConsumers();
        }, [listRenderId]);
        return jsx(ProducerItemCountRefContext.Provider, {
          value: itemCountRef,
          children: jsx(ProducerListRenderIdContext.Provider, {
            value: listRenderId,
            children: jsx(ProducerTrackerContext.Provider, {
              value: itemTracker,
              children: children
            })
          })
        });
      };
      const ItemConsumerProvider = ({
        children
      }) => {
        const [consumerItems, setConsumerItems] = useState(items);
        const flushToConsumers = () => {
          if (!pendingFlushRef.current) {
            return;
          }
          const itemsCopy = [...items];
          pendingFlushRef.current = false;
          setConsumerItems(itemsCopy);
        };
        itemTracker.flushToConsumers = flushToConsumers;
        useLayoutEffect(() => {
          flushToConsumers();
        });
        return jsx(ConsumerItemsContext.Provider, {
          value: consumerItems,
          children: children
        });
      };
      return {
        pendingFlushRef,
        registerItem,
        getProducerItem,
        ItemProducerProvider,
        ItemConsumerProvider
      };
    }, []);
    const {
      ItemProducerProvider,
      ItemConsumerProvider
    } = itemTracker;
    return [ItemProducerProvider, ItemConsumerProvider, items];
  };

  // Hook for producers to register items (ref-based, no re-renders)
  const useTrackIsolatedItem = data => {
    const listRenderId = useContext(ProducerListRenderIdContext);
    const itemCountRef = useContext(ProducerItemCountRefContext);
    const itemTracker = useContext(ProducerTrackerContext);
    const listRenderIdRef = useRef();
    const itemIndexRef = useRef();
    const dataRef = useRef();
    const prevListRenderId = listRenderIdRef.current;
    useLayoutEffect(() => {
      if (itemTracker.pendingFlushRef.current) {
        itemTracker.flushToConsumers();
      }
    });
    if (prevListRenderId === listRenderId) {
      const itemIndex = itemIndexRef.current;
      itemTracker.registerItem(itemIndex, data);
      dataRef.current = data;
      return itemIndex;
    }
    listRenderIdRef.current = listRenderId;
    const itemCount = itemCountRef.current;
    const itemIndex = itemCount;
    itemCountRef.current = itemIndex + 1;
    itemIndexRef.current = itemIndex;
    dataRef.current = data;
    itemTracker.registerItem(itemIndex, data);
    return itemIndex;
  };
  const useTrackedIsolatedItem = itemIndex => {
    const items = useTrackedIsolatedItems();
    const item = items[itemIndex];
    return item;
  };

  // Hooks for consumers to read items (state-based, re-renders)
  const useTrackedIsolatedItems = () => {
    const consumerItems = useContext(ConsumerItemsContext);
    if (!consumerItems) {
      throw new Error("useTrackedIsolatedItems must be used within <ItemConsumerProvider />");
    }
    return consumerItems;
  };
  return [useIsolatedItemTrackerProvider, useTrackIsolatedItem, useTrackedIsolatedItem, useTrackedIsolatedItems];
};

const createItemTracker = () => {
  const ItemTrackerContext = createContext();
  const useItemTrackerProvider = () => {
    const itemsRef = useRef([]);
    const items = itemsRef.current;
    const itemCountRef = useRef(0);
    const tracker = useMemo(() => {
      const ItemTrackerProvider = ({
        children
      }) => {
        // Reset on each render to start fresh
        tracker.reset();
        return jsx(ItemTrackerContext.Provider, {
          value: tracker,
          children: children
        });
      };
      ItemTrackerProvider.items = items;
      return {
        ItemTrackerProvider,
        items,
        registerItem: data => {
          const index = itemCountRef.current++;
          items[index] = data;
          return index;
        },
        getItem: index => {
          return items[index];
        },
        getAllItems: () => {
          return items;
        },
        reset: () => {
          items.length = 0;
          itemCountRef.current = 0;
        }
      };
    }, []);
    return tracker.ItemTrackerProvider;
  };
  const useTrackItem = data => {
    const tracker = useContext(ItemTrackerContext);
    if (!tracker) {
      throw new Error("useTrackItem must be used within SimpleItemTrackerProvider");
    }
    return tracker.registerItem(data);
  };
  const useTrackedItem = index => {
    const trackedItems = useTrackedItems();
    const item = trackedItems[index];
    return item;
  };
  const useTrackedItems = () => {
    const tracker = useContext(ItemTrackerContext);
    if (!tracker) {
      throw new Error("useTrackedItems must be used within SimpleItemTrackerProvider");
    }
    return tracker.items;
  };
  return [useItemTrackerProvider, useTrackItem, useTrackedItem, useTrackedItems];
};

const useFocusGroup = (
  elementRef,
  { enabled = true, direction, skipTab, loop, name } = {},
) => {
  useLayoutEffect(() => {
    if (!enabled) {
      return null;
    }
    const focusGroup = initFocusGroup(elementRef.current, {
      direction,
      skipTab,
      loop,
      name,
    });
    return focusGroup.cleanup;
  }, [direction, skipTab, loop, name]);
};

const Z_INDEX_EDITING = 1; /* To go above neighbours, but should not be too big to stay under the sticky cells */

/* needed because cell uses position:relative, sticky must win even if before in DOM order */
const Z_INDEX_STICKY_COLUMN = Z_INDEX_EDITING + 1;
const Z_INDEX_STICKY_ROW = Z_INDEX_STICKY_COLUMN + 1;
const Z_INDEX_STICKY_CORNER = Z_INDEX_STICKY_ROW + 1;

const Z_INDEX_STICKY_FRONTIER_BACKDROP = Z_INDEX_STICKY_CORNER + 1;
const Z_INDEX_STICKY_FRONTIER_PREVIEW =
  Z_INDEX_STICKY_FRONTIER_BACKDROP + 1;
const Z_INDEX_STICKY_FRONTIER_GHOST =
  Z_INDEX_STICKY_FRONTIER_PREVIEW + 1;
const Z_INDEX_RESIZER_BACKDROP = Z_INDEX_STICKY_CORNER + 1; // above sticky cells

const Z_INDEX_CELL_FOREGROUND = 1;
const Z_INDEX_STICKY_FRONTIER_HANDLE = 2; // above the cell placeholder to keep the sticky frontier visible
const Z_INDEX_RESIZER_HANDLE = Z_INDEX_STICKY_FRONTIER_HANDLE + 1;
const Z_INDEX_DROP_PREVIEW = Z_INDEX_STICKY_CORNER + 1;

const Z_INDEX_TABLE_UI = Z_INDEX_STICKY_CORNER + 1;

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_table_drag_clone_container {
    position: absolute;
    top: var(--table-visual-top);
    left: var(--table-visual-left);
    width: var(--table-visual-width);
    height: var(--table-visual-height);
    /* background: rgba(0, 0, 0, 0.5); */
  }

  .navi_table_cell[data-grabbed]::before,
  .navi_table_cell[data-grabbed]::after {
    box-shadow: none !important;
  }

  /* We preprend ".navi_table_container" to ensure it propertly overrides */
  .navi_table_drag_clone_container .navi_table_cell {
    opacity: ${0};
  }

  .navi_table_drag_clone_container .navi_table_cell[data-grabbed] {
    opacity: 0.7;
  }

  .navi_table_drag_clone_container .navi_table_cell_sticky_frontier {
    opacity: 0;
  }

  .navi_table_drag_clone_container .navi_table_cell[data-sticky-left],
  .navi_table_drag_clone_container .navi_table_cell[data-sticky-top] {
    position: relative;
  }

  .navi_table_cell_foreground {
    position: absolute;
    inset: 0;
    z-index: ${Z_INDEX_CELL_FOREGROUND};
    background: lightgrey;
    opacity: 0;
    pointer-events: none;
  }
  .navi_table_cell[data-first-row] .navi_table_cell_foreground {
    background-color: grey;
  }
  .navi_table_cell_foreground[data-visible] {
    opacity: 1;
  }

  .navi_table_drag_clone_container .navi_table_cell_foreground {
    background-color: rgba(255, 255, 255, 0.2);
    opacity: 1;
    backdrop-filter: blur(10px);
  }
  .navi_table_drag_clone_container
    .navi_table_cell[data-first-row][data-grabbed] {
    opacity: 1;
  }
  .navi_table_drag_clone_container
    .navi_table_cell[data-first-row]
    .navi_table_cell_foreground {
    opacity: 0;
  }

  .navi_table_column_drop_preview {
    position: absolute;
    top: var(--column-top);
    left: var(--column-left);
    z-index: ${Z_INDEX_DROP_PREVIEW};
    width: var(--column-width);
    height: var(--column-height);
    /* Invisible container - just for positioning */
    background: transparent;
    border: none;
    pointer-events: none;
  }

  .navi_table_column_drop_preview_line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0; /* Default: left edge for dropping before */
    width: 4px;
    background: rgba(0, 0, 255, 0.5);
    opacity: 0;
    transform: translateX(-50%);
  }
  .navi_table_column_drop_preview[data-after]
    .navi_table_column_drop_preview_line {
    left: 100%; /* Right edge for dropping after */
  }
  .navi_table_column_drop_preview[data-visible]
    .navi_table_column_drop_preview_line {
    opacity: 1;
  }

  .navi_table_column_drop_preview .arrow_positioner {
    position: absolute;
    left: 0; /* Default: left edge for dropping before */
    display: flex;
    color: rgba(0, 0, 255, 0.5);
    opacity: 0;
    transform: translateX(-50%);
  }
  .navi_table_column_drop_preview[data-after] .arrow_positioner {
    left: 100%; /* Right edge for dropping after */
  }
  .navi_table_column_drop_preview[data-visible] .arrow_positioner {
    opacity: 1;
  }
  .navi_table_column_drop_preview .arrow_positioner[data-top] {
    top: -10px;
  }
  .navi_table_column_drop_preview .arrow_positioner[data-bottom] {
    bottom: -10px;
  }
  .arrow_positioner svg {
    width: 10px;
    height: 10px;
  }
`;
const TableDragContext = createContext();
const useTableDragContextValue = ({
  tableDragCloneContainerRef,
  tableColumnDropPreviewRef,
  columns,
  setColumnOrder,
  canChangeColumnOrder
}) => {
  setColumnOrder = useStableCallback(setColumnOrder);
  const [grabTarget, setGrabTarget] = useState(null);
  const grabColumn = columnIndex => {
    setGrabTarget(`column:${columnIndex}`);
  };
  const releaseColumn = (columnIndex, newColumnIndex) => {
    setGrabTarget(null);
    if (columnIndex === newColumnIndex) {
      return;
    }
    const columnIds = columns.map(col => col.id);
    const columnIdsWithNewOrder = moveItem(columnIds, columnIndex, newColumnIndex);
    setColumnOrder(columnIdsWithNewOrder);
  };
  return useMemo(() => {
    return {
      tableDragCloneContainerRef,
      tableColumnDropPreviewRef,
      grabTarget,
      grabColumn,
      releaseColumn,
      setColumnOrder,
      canChangeColumnOrder
    };
  }, [grabTarget, canChangeColumnOrder]);
};
const moveItem = (array, indexA, indexB) => {
  const newArray = [];
  const movedItem = array[indexA];
  const movingRight = indexA < indexB;
  for (let i = 0; i < array.length; i++) {
    if (movingRight) {
      // Moving right: add target first, then moved item after
      if (i !== indexA) {
        newArray.push(array[i]);
      }
      if (i === indexB) {
        newArray.push(movedItem);
      }
    } else {
      // Moving left: add moved item first, then target after
      if (i === indexB) {
        newArray.push(movedItem);
      }
      if (i !== indexA) {
        newArray.push(array[i]);
      }
    }
  }
  return newArray;
};
const TableDragCloneContainer = forwardRef((props, ref) => {
  const {
    tableId
  } = props;
  return jsx("div", {
    ref: ref,
    className: "navi_table_drag_clone_container",
    "data-overlay-for": tableId
  });
});
const TableColumnDropPreview = forwardRef((props, ref) => {
  return jsxs("div", {
    ref: ref,
    className: "navi_table_column_drop_preview",
    children: [jsx("div", {
      className: "arrow_positioner",
      "data-top": "",
      children: jsx("svg", {
        fill: "currentColor",
        viewBox: "0 0 30.727 30.727",
        children: jsx("path", {
          d: "M29.994,10.183L15.363,24.812L0.733,10.184c-0.977-0.978-0.977-2.561,0-3.536c0.977-0.977,2.559-0.976,3.536,0 l11.095,11.093L26.461,6.647c0.977-0.976,2.559-0.976,3.535,0C30.971,7.624,30.971,9.206,29.994,10.183z"
        })
      })
    }), jsx("div", {
      className: "navi_table_column_drop_preview_line"
    }), jsx("div", {
      className: "arrow_positioner",
      "data-bottom": "",
      children: jsx("svg", {
        fill: "currentColor",
        viewBox: "0 0 30.727 30.727",
        children: jsx("path", {
          d: "M29.994,20.544L15.363,5.915L0.733,20.543c-0.977,0.978-0.977,2.561,0,3.536c0.977,0.977,2.559,0.976,3.536,0 l11.095-11.093L26.461,24.08c0.977,0.976,2.559,0.976,3.535,0C30.971,23.103,30.971,21.521,29.994,20.544z"
        })
      })
    })]
  });
});
const initDragTableColumnViaPointer = (pointerdownEvent, {
  tableDragCloneContainer,
  dropPreview,
  onGrab,
  onDrag,
  onRelease
}) => {
  dragAfterThreshold(pointerdownEvent, () => {
    const [teardown, addTeardown] = createPubSub();
    const tableCell = pointerdownEvent.target.closest(".navi_table_cell");
    const table = tableCell.closest(".navi_table");
    const columnIndex = Array.from(tableCell.parentNode.children).indexOf(tableCell);

    // Track the drop target column index (starts as current column)
    let dropColumnIndex = columnIndex;
    const tableClone = table.cloneNode(true);
    // ensure [data-drag-obstacle] inside the table clone are ignored
    tableClone.setAttribute("data-drag-ignore", "");

    // Scale down the table clone and set transform origin to mouse grab point
    // const tableRect = table.getBoundingClientRect();
    // const mouseX = mousedownEvent.clientX - tableRect.left;
    // const mouseY = mousedownEvent.clientY - tableRect.top;
    // tableClone.style.transform = "scale(1.2)";
    // tableClone.style.transformOrigin = `${mouseX}px ${mouseY}px`;

    {
      // In the table clone we need to convert sticky elements to position: relative
      // with calculated offsets that match their appearance in the original context
      const scrollContainer = getScrollContainer(table);

      // important: only on cells, not on <col> nor <tr>
      const originalStickyCells = table.querySelectorAll(".navi_table_cell[data-sticky-left], .navi_table_cell[data-sticky-top]");
      const cloneStickyCells = tableClone.querySelectorAll(".navi_table_cell[data-sticky-left], .navi_table_cell[data-sticky-top]");
      originalStickyCells.forEach((originalCell, index) => {
        const cloneCell = cloneStickyCells[index];
        const relativePosition = stickyAsRelativeCoords(originalCell,
        // Our clone is absolutely positioned on top of <table />
        // So we need the sticky position relative to <table />
        table, {
          scrollContainer
        });
        if (relativePosition) {
          const [relativeLeft, relativeTop] = relativePosition;
          cloneCell.style.position = "relative";
          if (relativeLeft !== undefined) {
            cloneCell.style.left = `${relativeLeft}px`;
          }
          if (relativeTop !== undefined) {
            cloneCell.style.top = `${relativeTop}px`;
          }
        }
      });
    }
    {
      // ensure [data-grabbed] are present in the table clone
      // we could retry on "sync_attributes" but we want to be sure it's done asap to prevent table from being displayed at all
      // I fear without this we might have an intermediate step where the table column clone is not visible
      // as [data-grabbed] are not set
      // Would not be a problem but this ensure we see exactly the table clone right away preventing any possibility
      // of visual glitches
      const tableCloneCells = tableClone.querySelectorAll(".navi_table_cell");
      tableCloneCells.forEach(cellClone => {
        const cellColumnIndex = Array.from(cellClone.parentNode.children).indexOf(cellClone);
        if (cellColumnIndex === columnIndex) {
          cellClone.setAttribute("data-grabbed", "");
        }
      });
    }
    {
      tableDragCloneContainer.appendChild(tableClone);
      addTeardown(() => {
        tableClone.remove();
      });
    }
    {
      // Sync attribute changes from original table to clone
      // This is used to:
      // - handle table cells being selected as result of mousedown on the <th />
      // - nothing else is supposed to change in the original <table /> during the drag gesture
      const syncTableAttributes = createTableAttributeSync(table, tableClone);
      addTeardown(() => {
        syncTableAttributes.disconnect();
      });
    }
    const colgroup = table.querySelector(".navi_colgroup");
    const colElements = Array.from(colgroup.children);
    const col = colElements[columnIndex];
    const colgroupClone = tableClone.querySelector(".navi_colgroup");
    const colClone = colgroupClone.children[columnIndex];
    const dragToMoveGestureController = createDragToMoveGestureController({
      name: "move-column",
      direction: {
        x: true
      },
      threshold: 0,
      onGrab,
      onDrag: gestureInfo => {
      },
      resetPositionAfterRelease: true,
      onRelease: gestureInfo => {
        {
          teardown();
        }
        onRelease?.(gestureInfo, dropColumnIndex);
      }
    });
    const dragToMoveGesture = dragToMoveGestureController.grabViaPointer(pointerdownEvent, {
      element: colClone,
      referenceElement: col,
      elementToMove: tableClone
    });
    {
      // Get all column elements for drop target detection
      const dropCandidateElements = colElements.filter(col => !(col.getAttribute("data-drag-obstacle") || "").includes("move-column"));
      const updateDropTarget = dropTargetInfo => {
        const targetColumn = dropTargetInfo.element;
        const targetColumnIndex = colElements.indexOf(targetColumn);
        dropColumnIndex = targetColumnIndex;
        if (dropColumnIndex === columnIndex) {
          dropPreview.removeAttribute("data-visible");
          return;
        }
        // Position the invisible container to match the target column
        const {
          left,
          top,
          width,
          height
        } = targetColumn.getBoundingClientRect();
        dropPreview.style.setProperty("--column-left", `${left}px`);
        dropPreview.style.setProperty("--column-top", `${top}px`);
        dropPreview.style.setProperty("--column-width", `${width}px`);
        dropPreview.style.setProperty("--column-height", `${height}px`);
        // Set data-after attribute to control line position via CSS
        if (dropColumnIndex > columnIndex) {
          // Dropping after: CSS will position line at right edge (100%)
          dropPreview.setAttribute("data-after", "");
        } else {
          // Dropping before: CSS will position line at left edge (0%)
          dropPreview.removeAttribute("data-after");
        }
        dropPreview.setAttribute("data-drop-column-index", dropColumnIndex);
        dropPreview.setAttribute("data-visible", "");
      };
      dragToMoveGesture.addDragCallback(gestureInfo => {
        const dropTargetInfo = getDropTargetInfo(gestureInfo, dropCandidateElements);
        if (!dropTargetInfo) {
          dropPreview.removeAttribute("data-visible");
          return;
        }
        updateDropTarget(dropTargetInfo);
      });
      dragToMoveGesture.addReleaseCallback(() => {
        dropPreview.removeAttribute("data-visible");
      });
    }
    return dragToMoveGesture;
  });
};

/**
 * Creates a MutationObserver that syncs attribute changes from original table to clone
 * @param {HTMLElement} table - The original table element
 * @param {HTMLElement} cloneTable - The cloned table element
 * @returns {MutationObserver} The observer instance with disconnect method
 */
const createTableAttributeSync = (table, tableClone) => {
  // Create a map to quickly find corresponding elements in the clone
  const createElementMap = () => {
    const map = new Map();
    const cells = table.querySelectorAll(".navi_table_cell");
    const cellClones = tableClone.querySelectorAll(".navi_table_cell");
    for (let i = 0; i < cells.length; i++) {
      if (cellClones[i]) {
        map.set(cells[i], cellClones[i]);
      }
    }
    return map;
  };
  const elementMap = createElementMap();
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.type === "attributes") {
        const originalElement = mutation.target;
        const cloneElement = elementMap.get(originalElement);
        if (cloneElement) {
          const attributeName = mutation.attributeName;
          if (attributeName === "style") {
            return;
          }

          // Sync the attribute change to the clone
          if (originalElement.hasAttribute(attributeName)) {
            const attributeValue = originalElement.getAttribute(attributeName);
            cloneElement.setAttribute(attributeName, attributeValue);
          } else {
            cloneElement.removeAttribute(attributeName);
          }
        }
      }
    });
  });

  // Observe attribute changes on all table cells
  const cellsToObserve = table.querySelectorAll(".navi_table_cell");
  cellsToObserve.forEach(cell => {
    observer.observe(cell, {
      attributes: true,
      attributeOldValue: false,
      subtree: false
    });
  });
  return observer;
};

const TableSizeContext = createContext();

const useTableSizeContextValue = ({
  onColumnSizeChange,
  onRowSizeChange,
  columns,
  rows,
  columnResizerRef,
  rowResizerRef,
}) => {
  onColumnSizeChange = useStableCallback(onColumnSizeChange);
  onRowSizeChange = useStableCallback(onRowSizeChange);

  const tableSizeContextValue = useMemo(() => {
    const onColumnSizeChangeWithColumn = onColumnSizeChange
      ? (width, columnIndex) => {
          const column = columns[columnIndex];
          return onColumnSizeChange(width, columnIndex, column);
        }
      : onColumnSizeChange;

    const onRowSizeChangeWithRow = onRowSizeChange
      ? (height, rowIndex) => {
          const row = rows[rowIndex];
          return onRowSizeChange(height, rowIndex, row);
        }
      : onRowSizeChange;

    return {
      onColumnSizeChange: onColumnSizeChangeWithColumn,
      onRowSizeChange: onRowSizeChangeWithRow,
      columnResizerRef,
      rowResizerRef,
    };
  }, []);

  return tableSizeContextValue;
};

installImportMetaCss(import.meta);const ROW_MIN_HEIGHT = 30;
const ROW_MAX_HEIGHT = 100;
const COLUMN_MIN_WIDTH = 50;
const COLUMN_MAX_WIDTH = 500;
import.meta.css = /* css */`
  @layer navi {
    .navi_table {
      --table-resizer-handle-color: #063b7c;
      --table-resizer-color: #387ec9;
    }
  }

  .navi_table_cell {
    /* ensure table cell padding does not count when we say column = 50px we want a column of 50px, not 50px + paddings */
    box-sizing: border-box;
  }

  .navi_table_cell_resize_handle {
    position: absolute;
    /* background: orange; */
    /* opacity: 0.5; */
    z-index: ${Z_INDEX_RESIZER_HANDLE};
  }
  .navi_table_cell_resize_handle[data-left],
  .navi_table_cell_resize_handle[data-right] {
    top: 0;
    bottom: 0;
    width: 8px;
    cursor: ew-resize;
  }
  .navi_table_cell_resize_handle[data-left] {
    left: 0;
  }
  .navi_table_cell_resize_handle[data-right] {
    right: 0;
  }

  .navi_table_cell_resize_handle[data-top],
  .navi_table_cell_resize_handle[data-bottom] {
    right: 0;
    left: 0;
    height: 8px;
    cursor: ns-resize;
  }
  .navi_table_cell_resize_handle[data-top] {
    top: 0;
  }
  .navi_table_cell_resize_handle[data-bottom] {
    bottom: 0;
  }

  .navi_table_column_resizer {
    position: absolute;
    top: var(--table-visual-top);
    left: var(--table-column-resizer-left);
    width: 10px;
    height: var(--table-visual-height);
    opacity: 0;
    pointer-events: none;
  }
  .navi_table_column_resize_handle {
    position: absolute;
    top: 50%;
    /* opacity: 0.5; */
    width: 5px;
    height: 100%;
    height: 26px;
    max-height: 80%;
    background: var(--table-resizer-handle-color);
    border-radius: 15px;
    transform: translateY(-50%);
  }
  .navi_table_column_resize_handle[data-left] {
    left: 2px;
  }
  .navi_table_column_resize_handle[data-right] {
    right: 3px;
  }
  .navi_table_column_resize_handle_container {
    position: absolute;
    top: 0;
    right: 0;
    left: -10px;
    height: var(--table-cell-height);
  }
  .navi_table_column_resizer_line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: -3px;
    width: 5px;
    background: var(--table-resizer-color);
    opacity: 0;
    transition: opacity 0.1s ease;
  }
  .navi_table_column_resizer[data-hover],
  .navi_table_column_resizer[data-grabbed] {
    opacity: 1;
  }
  .navi_table_column_resizer[data-hover] {
    transition-delay: 150ms; /* Delay before showing hover effect */
  }
  .navi_table_column_resizer[data-grabbed] .navi_table_column_resizer_line {
    opacity: 1;
  }

  .navi_table_row_resizer {
    position: absolute;
    top: var(--table-row-resizer-top);
    left: var(--table-visual-left);
    width: var(--table-visual-width);
    height: 10px;
    opacity: 0;
    pointer-events: none;
  }
  .navi_table_row_resize_handle {
    position: absolute;
    left: 50%;
    width: 100%;
    /* opacity: 0.5; */
    width: 26px;
    max-width: 80%;
    height: 5px;
    background: var(--table-resizer-handle-color);
    border-radius: 15px;
    transform: translateX(-50%);
  }
  .navi_table_row_resize_handle[data-top] {
    top: 2px;
  }
  .navi_table_row_resize_handle[data-bottom] {
    bottom: 3px;
  }
  .navi_table_row_resize_handle_container {
    position: absolute;
    top: -10px;
    bottom: 0;
    left: 0;
    width: var(--table-cell-width);
  }
  .navi_table_row_resizer_line {
    position: absolute;
    top: -3px;
    right: 0;
    left: 0;
    height: 5px;
    background: var(--table-resizer-color);
    opacity: 0;
    transition: opacity 0.1s ease;
  }
  .navi_table_row_resizer[data-hover],
  .navi_table_row_resizer[data-grabbed] {
    opacity: 1;
  }
  .navi_table_row_resizer[data-hover] {
    transition-delay: 150ms; /* Delay before showing hover effect */
  }
  .navi_table_row_resizer[data-grabbed] .navi_table_row_resizer_line {
    opacity: 1;
  }
`;

// Column resize components
const TableColumnResizer = forwardRef((props, ref) => {
  return jsxs("div", {
    ref: ref,
    className: "navi_table_column_resizer",
    children: [jsxs("div", {
      className: "navi_table_column_resize_handle_container",
      children: [jsx("div", {
        className: "navi_table_column_resize_handle",
        "data-left": ""
      }), jsx("div", {
        className: "navi_table_column_resize_handle",
        "data-right": ""
      })]
    }), jsx("div", {
      className: "navi_table_column_resizer_line"
    })]
  });
});
const TableCellColumnResizeHandles = ({
  columnIndex,
  columnMinWidth,
  columnMaxWidth
}) => {
  const {
    onColumnSizeChange
  } = useContext(TableSizeContext);
  const canResize = Boolean(onColumnSizeChange);
  return jsxs(Fragment, {
    children: [canResize && columnIndex > 0 && jsx(TableColumnLeftResizeHandle, {
      onRelease: width => onColumnSizeChange(width, columnIndex - 1),
      columnMinWidth: columnMinWidth,
      columnMaxWidth: columnMaxWidth
    }), canResize && jsx(TableColumnRightResizeHandle, {
      onRelease: width => onColumnSizeChange(width, columnIndex),
      columnMinWidth: columnMinWidth,
      columnMaxWidth: columnMaxWidth
    })]
  });
};
const TableColumnLeftResizeHandle = ({
  columnMinWidth,
  columnMaxWidth,
  onGrab,
  onDrag,
  onRelease
}) => {
  const {
    columnResizerRef
  } = useContext(TableSizeContext);
  return jsx("div", {
    className: "navi_table_cell_resize_handle",
    "data-left": "",
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag column or drag sticky frontier
      initResizeTableColumnViaPointer(e, {
        columnResizer: columnResizerRef.current,
        columnMinWidth,
        columnMaxWidth,
        onGrab,
        onDrag,
        onRelease,
        isLeft: true
      });
    },
    onMouseEnter: e => {
      onMouseEnterLeftResizeHandle(e, columnResizerRef.current);
    },
    onMouseLeave: e => {
      onMouseLeaveLeftResizeHandle(e, columnResizerRef.current);
    }
  });
};
const TableColumnRightResizeHandle = ({
  columnMinWidth,
  columnMaxWidth,
  onGrab,
  onDrag,
  onRelease
}) => {
  const {
    columnResizerRef
  } = useContext(TableSizeContext);
  return jsx("div", {
    className: "navi_table_cell_resize_handle",
    "data-right": "",
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag column or drag sticky frontier
      initResizeTableColumnViaPointer(e, {
        columnResizer: columnResizerRef.current,
        columnMinWidth,
        columnMaxWidth,
        onGrab,
        onDrag,
        onRelease
      });
    },
    onMouseEnter: e => {
      onMouseEnterRightResizeHandle(e, columnResizerRef.current);
    },
    onMouseLeave: e => {
      onMouseLeaveRightResizeHandle(e, columnResizerRef.current);
    }
  });
};
const updateTableColumnResizerPosition = (columnCell, columnResizer) => {
  if (columnResizer.hasAttribute("data-grabbed")) {
    // ensure mouseenter/mouseleave while resizing cannot interfere
    // while resizing (would move the resizer on other columns)
    return;
  }
  const columnCellRect = columnCell.getBoundingClientRect();
  const columnRight = columnCellRect.right;
  const cellHeight = columnCellRect.height;
  columnResizer.style.setProperty("--table-column-resizer-left", `${columnRight}px`);
  columnResizer.style.setProperty("--table-cell-height", `${cellHeight}px`);
  columnResizer.setAttribute("data-hover", "");
};
// Row resize helper functions
const updateTableRowResizerPosition = (rowCell, rowResizer) => {
  if (rowResizer.hasAttribute("data-grabbed")) {
    // ensure mouseenter/mouseleave while resizing cannot interfere
    // while resizing (would move the resizer on other rows)
    return;
  }
  const rowCellRect = rowCell.getBoundingClientRect();
  const rowBottom = rowCellRect.bottom;
  const cellWidth = rowCellRect.width;
  rowResizer.style.setProperty("--table-row-resizer-top", `${rowBottom}px`);
  rowResizer.style.setProperty("--table-cell-width", `${cellWidth}px`);
  rowResizer.setAttribute("data-hover", "");
};
const onMouseEnterLeftResizeHandle = (e, columnResizer) => {
  const previousCell = e.target.closest(".navi_table_cell").previousElementSibling;
  updateTableColumnResizerPosition(previousCell, columnResizer);
};
const onMouseEnterRightResizeHandle = (e, columnResizer) => {
  const cell = e.target.closest(".navi_table_cell");
  updateTableColumnResizerPosition(cell, columnResizer);
};
const onMouseLeaveLeftResizeHandle = (e, columnResizer) => {
  columnResizer.removeAttribute("data-hover");
};
const onMouseLeaveRightResizeHandle = (e, columnResizer) => {
  columnResizer.removeAttribute("data-hover");
};
// Generic function to handle table cell resize for both axes
const initResizeViaPointer = (pointerdownEvent, {
  tableCell,
  resizer,
  minSize,
  maxSize,
  onGrab,
  onDrag,
  onRelease,
  // Axis-specific configuration
  axis // 'x' or 'y'
}) => {
  const updateResizerPosition = axis === "x" ? updateTableColumnResizerPosition : updateTableRowResizerPosition;
  const tableCellRect = tableCell.getBoundingClientRect();
  // Calculate size and position based on axis
  const currentSize = axis === "x" ? tableCellRect.width : tableCellRect.height;

  // Convert constraint bounds to scroll container coordinates
  // (Same as boundingClientRect + document scrolls but within the scroll container)
  const areaConstraint = (() => {
    const defaultMinSize = axis === "x" ? COLUMN_MIN_WIDTH : ROW_MIN_HEIGHT;
    const defaultMaxSize = axis === "x" ? COLUMN_MAX_WIDTH : ROW_MAX_HEIGHT;
    const minCellSize = typeof minSize === "number" && minSize > defaultMinSize ? minSize : defaultMinSize;
    const maxCellSize = typeof maxSize === "number" && maxSize < defaultMaxSize ? maxSize : defaultMaxSize;
    const isSticky = axis === "x" ? tableCell.hasAttribute("data-sticky-left") : tableCell.hasAttribute("data-sticky-top");
    if (axis === "x") {
      return {
        left: ({
          leftAtGrab,
          scrollport
        }) => {
          // to get the cell position at grab we need to remove cell size because
          // we place the resizer at the right of the cell
          const cellLeftAtGrab = leftAtGrab - currentSize;
          const minLeft = cellLeftAtGrab + minCellSize;
          if (isSticky && minLeft < scrollport.left) {
            return scrollport.left;
          }
          return minLeft;
        },
        right: ({
          leftAtGrab,
          scrollport
        }) => {
          const cellLeftAtGrab = leftAtGrab - currentSize;
          const maxRight = cellLeftAtGrab + maxCellSize;
          if (isSticky && maxRight > scrollport.right) {
            return scrollport.right;
          }
          return maxRight;
        }
      };
    }
    return {
      top: ({
        topAtGrab,
        scrollport
      }) => {
        const cellTopAtGrab = topAtGrab - currentSize;
        const minTop = cellTopAtGrab + minCellSize;
        if (isSticky && minTop < scrollport.top) {
          return scrollport.top;
        }
        return minTop;
      },
      bottom: ({
        topAtGrab,
        scrollport
      }) => {
        const cellTopAtGrab = topAtGrab - currentSize;
        const maxBottom = cellTopAtGrab + maxCellSize;
        if (isSticky && maxBottom > scrollport.bottom) {
          return scrollport.bottom;
        }
        return maxBottom;
      }
    };
  })();

  // Build drag gesture configuration based on axis
  const gestureName = axis === "x" ? "resize-column" : "resize-row";
  const direction = axis === "x" ? {
    x: true
  } : {
    y: true
  };
  updateResizerPosition(tableCell, resizer);
  const dragToMoveGestureController = createDragToMoveGestureController({
    name: gestureName,
    direction,
    backdropZIndex: Z_INDEX_RESIZER_BACKDROP,
    areaConstraint,
    autoScrollAreaPadding: 20,
    onGrab: () => {
      onGrab?.();
    },
    onDrag,
    resetPositionAfterRelease: true,
    onRelease: gestureInfo => {
      const sizeChange = axis === "x" ? gestureInfo.layout.xDelta : gestureInfo.layout.yDelta;
      const newSize = currentSize + sizeChange;
      onRelease(newSize, currentSize);
      resizer.removeAttribute("data-hover");
    }
  });
  dragToMoveGestureController.grabViaPointer(pointerdownEvent, {
    element: resizer,
    referenceElement: tableCell
  });
};
const initResizeTableColumnViaPointer = (pointerdownEvent, {
  columnResizer,
  columnMinWidth,
  columnMaxWidth,
  onGrab,
  onDrag,
  onRelease,
  isLeft
}) => {
  let tableCell = pointerdownEvent.target.closest(".navi_table_cell");
  if (isLeft) {
    tableCell = tableCell.previousElementSibling;
  }
  initResizeViaPointer(pointerdownEvent, {
    tableCell,
    resizer: columnResizer,
    minSize: columnMinWidth,
    maxSize: columnMaxWidth,
    onGrab,
    onDrag,
    onRelease,
    axis: "x"
  });
};
const initResizeTableRowViaPointer = (pointerdownEvent, {
  rowResizer,
  rowMinHeight,
  rowMaxHeight,
  onGrab,
  onDrag,
  onRelease,
  isTop
}) => {
  let tableCell = pointerdownEvent.target.closest(".navi_table_cell");
  if (isTop) {
    const tableRow = tableCell.closest(".navi_tr");
    const previousTr = findPreviousTableRow(tableRow);
    if (!previousTr) {
      return;
    }
    // Select the same table cell (same column index) in previous row
    const columnIndex = Array.from(tableRow.children).indexOf(tableCell);
    tableCell = previousTr.children[columnIndex];
  }
  initResizeViaPointer(pointerdownEvent, {
    tableCell,
    resizer: rowResizer,
    minSize: rowMinHeight,
    maxSize: rowMaxHeight,
    onGrab,
    onDrag,
    onRelease,
    axis: "y"
  });
};

// Row resize components
const TableRowResizer = forwardRef((props, ref) => {
  return jsxs("div", {
    ref: ref,
    className: "navi_table_row_resizer",
    children: [jsxs("div", {
      className: "navi_table_row_resize_handle_container",
      children: [jsx("div", {
        className: "navi_table_row_resize_handle",
        "data-top": ""
      }), jsx("div", {
        className: "navi_table_row_resize_handle",
        "data-bottom": ""
      })]
    }), jsx("div", {
      className: "navi_table_row_resizer_line"
    })]
  });
});
const TableCellRowResizeHandles = ({
  rowIndex,
  rowMinHeight,
  rowMaxHeight
}) => {
  const {
    onRowSizeChange
  } = useContext(TableSizeContext);
  const canResize = Boolean(onRowSizeChange);
  return jsxs(Fragment, {
    children: [canResize && rowIndex > 0 && jsx(TableRowTopResizeHandle, {
      onRelease: width => onRowSizeChange(width, rowIndex - 1),
      rowMinHeight: rowMinHeight,
      rowMaxHeight: rowMaxHeight
    }), canResize && jsx(TableRowBottomResizeHandle, {
      onRelease: width => onRowSizeChange(width, rowIndex),
      rowMinHeight: rowMinHeight,
      rowMaxHeight: rowMaxHeight
    })]
  });
};
const TableRowTopResizeHandle = ({
  rowMinHeight,
  rowMaxHeight,
  onGrab,
  onDrag,
  onRelease
}) => {
  const {
    rowResizerRef
  } = useContext(TableSizeContext);
  return jsx("div", {
    className: "navi_table_cell_resize_handle",
    "data-top": "",
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag row
      initResizeTableRowViaPointer(e, {
        rowResizer: rowResizerRef.current,
        rowMinHeight,
        rowMaxHeight,
        onGrab,
        onDrag,
        onRelease,
        isTop: true
      });
    },
    onMouseEnter: e => {
      onMouseEnterTopResizeHandle(e, rowResizerRef.current);
    },
    onMouseLeave: e => {
      onMouseLeaveTopResizeHandle(e, rowResizerRef.current);
    }
  });
};
const TableRowBottomResizeHandle = ({
  rowMinHeight,
  rowMaxHeight,
  onGrab,
  onDrag,
  onRelease
}) => {
  const {
    rowResizerRef
  } = useContext(TableSizeContext);
  return jsx("div", {
    className: "navi_table_cell_resize_handle",
    "data-bottom": "",
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag row
      initResizeTableRowViaPointer(e, {
        rowResizer: rowResizerRef.current,
        rowMinHeight,
        rowMaxHeight,
        onGrab,
        onDrag,
        onRelease
      });
    },
    onMouseEnter: e => {
      onMouseEnterBottomResizeHandle(e, rowResizerRef.current);
    },
    onMouseLeave: e => {
      onMouseLeaveBottomResizeHandle(e, rowResizerRef.current);
    }
  });
};
const onMouseEnterTopResizeHandle = (e, rowResize) => {
  const currentRow = e.target.closest(".navi_tr");
  const previousRow = findPreviousTableRow(currentRow);
  if (previousRow) {
    updateTableRowResizerPosition(previousRow.querySelector(".navi_table_cell"), rowResize);
  }
};
const onMouseEnterBottomResizeHandle = (e, rowResizer) => {
  const rowCell = e.target.closest(".navi_table_cell");
  updateTableRowResizerPosition(rowCell, rowResizer);
};
const onMouseLeaveTopResizeHandle = (e, rowResizer) => {
  rowResizer.removeAttribute("data-hover");
};
const onMouseLeaveBottomResizeHandle = (e, rowResizer) => {
  rowResizer.removeAttribute("data-hover");
};
const findPreviousTableRow = currentRow => {
  // First, try to find previous sibling within the same table section
  const previousSibling = currentRow.previousElementSibling;
  if (previousSibling) {
    return previousSibling;
  }

  // Otherwise, get all rows in the table and find the previous one
  const table = currentRow.closest(".navi_table");
  const allRows = Array.from(table.querySelectorAll(".navi_tr"));
  const currentIndex = allRows.indexOf(currentRow);
  return currentIndex > 0 ? allRows[currentIndex - 1] : null;
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_table {
      --selection-border-color: var(--navi-selection-border-color, #0078d4);
      --selection-background-color: var(
        --navi-selection-background-color,
        #eaf1fd
      );
    }
  }

  .navi_table_cell[aria-selected="true"] {
    background-color: var(--selection-background-color);
  }

  /* One border */
  .navi_table_cell[data-selection-border-top]::after {
    box-shadow: inset 0 1px 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-right]::after {
    box-shadow: inset -1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-bottom]::after {
    box-shadow: inset 0 -1px 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-left]::after {
    box-shadow: inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Two border combinations */
  .navi_table_cell[data-selection-border-top][data-selection-border-right]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-top][data-selection-border-bottom]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-top][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-right][data-selection-border-bottom]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-right][data-selection-border-left]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Three border combinations */
  .navi_table_cell[data-selection-border-top][data-selection-border-right][data-selection-border-bottom]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-top][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-top][data-selection-border-right][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
  .navi_table_cell[data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }

  /* Four border combinations (full selection) */
  .navi_table_cell[data-selection-border-top][data-selection-border-right][data-selection-border-bottom][data-selection-border-left]::after {
    box-shadow:
      inset 0 1px 0 0 var(--selection-border-color),
      inset -1px 0 0 0 var(--selection-border-color),
      inset 0 -1px 0 0 var(--selection-border-color),
      inset 1px 0 0 0 var(--selection-border-color);
  }
`;
const useTableSelectionController = ({
  tableRef,
  selection,
  onSelectionChange,
  selectionColor
}) => {
  const selectionController = useSelectionController({
    elementRef: tableRef,
    layout: "grid",
    value: selection,
    onChange: onSelectionChange,
    selectAllName: "cell"
  });
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    updateSelectionBorders(table, selectionController);
  }, [selectionController.value]);
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) {
      return;
    }
    if (selectionColor) {
      table.style.setProperty("--selection-border-color", selectionColor);
    } else {
      table.style.removeProperty("--selection-border-color");
    }
  }, [selectionColor]);
  return selectionController;
};
const updateSelectionBorders = (tableElement, selectionController) => {
  // Find all selected cells
  const cells = Array.from(tableElement.querySelectorAll(".navi_table_cell"));
  const selectedCells = [];
  for (const cell of cells) {
    if (selectionController.isElementSelected(cell)) {
      selectedCells.push(cell);
    }
  }

  // Clear all existing selection border attributes
  tableElement.querySelectorAll("[data-selection-border-top], [data-selection-border-right], [data-selection-border-bottom], [data-selection-border-left]").forEach(cell => {
    cell.removeAttribute("data-selection-border-top");
    cell.removeAttribute("data-selection-border-right");
    cell.removeAttribute("data-selection-border-bottom");
    cell.removeAttribute("data-selection-border-left");
  });
  if (selectedCells.length === 0) {
    return;
  }

  // Convert NodeList to array and get cell positions

  const cellPositions = selectedCells.map(cell => {
    const row = cell.parentElement;
    const allRows = Array.from(tableElement.querySelectorAll(".navi_tr"));
    return {
      element: cell,
      rowIndex: allRows.indexOf(row),
      columnIndex: Array.from(row.children).indexOf(cell)
    };
  });

  // Create a set for fast lookup of selected cell positions
  const selectedPositions = new Set(cellPositions.map(pos => `${pos.rowIndex},${pos.columnIndex}`));

  // Apply selection borders based on actual neighbors (for proper L-shaped selection support)
  cellPositions.forEach(({
    element,
    rowIndex,
    columnIndex
  }) => {
    // Top border: if cell above is NOT selected or doesn't exist
    const cellAbove = `${rowIndex - 1},${columnIndex}`;
    if (!selectedPositions.has(cellAbove)) {
      element.setAttribute("data-selection-border-top", "");
    }

    // Bottom border: if cell below is NOT selected or doesn't exist
    const cellBelow = `${rowIndex + 1},${columnIndex}`;
    if (!selectedPositions.has(cellBelow)) {
      element.setAttribute("data-selection-border-bottom", "");
    }

    // Left border: if cell to the left is NOT selected or doesn't exist
    const cellLeft = `${rowIndex},${columnIndex - 1}`;
    if (!selectedPositions.has(cellLeft)) {
      element.setAttribute("data-selection-border-left", "");
    }

    // Right border: if cell to the right is NOT selected or doesn't exist
    const cellRight = `${rowIndex},${columnIndex + 1}`;
    if (!selectedPositions.has(cellRight)) {
      element.setAttribute("data-selection-border-right", "");
    }
  });
};

// TODO: move this to @jsenv/dom (the initStickyGroup part, not the useLayoutEffect)


// React hook version for easy integration
const useStickyGroup = (
  elementRef,
  { elementReceivingCumulativeStickyPositionRef, elementSelector } = {},
) => {
  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return undefined;
    }
    return initStickyGroup(element, {
      elementSelector,
      elementReceivingCumulativeStickyPosition:
        elementReceivingCumulativeStickyPositionRef.current,
    });
  }, [elementSelector]);
};

const ITEM_LEFT_VAR = "--sticky-group-item-left";
const ITEM_TOP_VAR = "--sticky-group-item-top";
const FRONTIER_LEFT_VAR = "--sticky-group-left";
const FRONTIER_TOP_VAR = "--sticky-group-top";
// const FRONTIER_LEFT_VIEWPORT_VAR = "--sticky-group-left-viewport";
// const FRONTIER_TOP_VIEWPORT_VAR = "--sticky-group-top-viewport";

/**
 * Creates a sticky group that manages positioning for multiple sticky elements
 * that need to be aware of each other's dimensions.
 * Always uses CSS variables for positioning.
 *
 * @param {HTMLElement} container The container element
 * @returns {Function} Cleanup function
 */
const initStickyGroup = (
  container,
  { elementSelector, elementReceivingCumulativeStickyPosition } = {},
) => {
  if (!container) {
    throw new Error("initStickyGroup: container is required");
  }

  const [teardown, addTeardown] = createPubSub();
  const [cleanup, addCleanup, clearCleanup] = createPubSub();
  addTeardown(cleanup);

  const element = elementSelector
    ? container.querySelector(elementSelector)
    : container;
  const isGrid =
    element.tagName === "TABLE" || element.classList.contains("navi_table");
  const updatePositions = () => {
    // Clear all previous CSS variable cleanups before setting new ones
    cleanup();
    clearCleanup();

    if (isGrid) {
      updateGridPositions();
    } else {
      updateLinearPositions();
    }
  };

  const updateGridPositions = () => {
    // Handle table grid - update both horizontal and vertical sticky elements
    updateTableColumns();
    updateTableRows();
  };
  const updateTableColumns = () => {
    // Find all sticky columns by checking all rows to identify which columns have sticky cells
    const allStickyColumnCells = element.querySelectorAll(
      ".navi_table_cell[data-sticky-left]",
    );
    if (allStickyColumnCells.length === 0) {
      return;
    }

    // Get the first row to determine column indices (use any row that exists)
    const firstRow = element.querySelector(".navi_tr");
    if (!firstRow) {
      return;
    }

    // Group sticky cells by column index
    const stickyColumnsByIndex = new Map();
    allStickyColumnCells.forEach((cell) => {
      const row = cell.closest(".navi_tr");
      const columnIndex = Array.from(row.children).indexOf(cell);
      if (!stickyColumnsByIndex.has(columnIndex)) {
        stickyColumnsByIndex.set(columnIndex, []);
      }
      stickyColumnsByIndex.get(columnIndex).push(cell);
    });

    // Sort columns by index and process them
    const sortedColumnIndices = Array.from(stickyColumnsByIndex.keys()).sort(
      (a, b) => a - b,
    );
    let cumulativeWidth = 0;

    sortedColumnIndices.forEach((columnIndex, stickyIndex) => {
      const cellsInColumn = stickyColumnsByIndex.get(columnIndex);
      const leftPosition = stickyIndex === 0 ? 0 : cumulativeWidth;

      // Set CSS variable on all sticky cells in this column using setStyles for proper cleanup
      cellsInColumn.forEach((cell) => {
        const restoreStyles = setStyles(cell, {
          [ITEM_LEFT_VAR]: `${leftPosition}px`,
        });
        addCleanup(restoreStyles);
      });

      // Also set CSS variable on corresponding <col> element if it exists
      const colgroup = element.querySelector(".navi_colgroup");
      if (colgroup) {
        const colElements = Array.from(colgroup.querySelectorAll(".navi_col"));
        const correspondingCol = colElements[columnIndex];
        if (correspondingCol) {
          const restoreStyles = setStyles(correspondingCol, {
            [ITEM_LEFT_VAR]: `${leftPosition}px`,
          });
          addCleanup(restoreStyles);
        }
      }

      // Update cumulative width for next column using the first cell in this column as reference
      const referenceCell = cellsInColumn[0];
      const columnWidth = referenceCell.getBoundingClientRect().width;
      if (stickyIndex === 0) {
        cumulativeWidth = columnWidth;
      } else {
        cumulativeWidth += columnWidth;
      }
    });

    // Set frontier variables with proper cleanup tracking
    const restoreContainerStyles = setStyles(container, {
      [FRONTIER_LEFT_VAR]: `${cumulativeWidth}px`,
    });
    addCleanup(restoreContainerStyles);

    if (elementReceivingCumulativeStickyPosition) {
      const restoreCumulativeStyles = setStyles(
        elementReceivingCumulativeStickyPosition,
        {
          [FRONTIER_LEFT_VAR]: `${cumulativeWidth}px`,
        },
      );
      addCleanup(restoreCumulativeStyles);
    }
  };
  const updateTableRows = () => {
    // Handle sticky rows by finding cells with data-sticky-top and grouping by row
    const stickyCells = element.querySelectorAll(
      ".navi_table_cell[data-sticky-top]",
    );
    if (stickyCells.length === 0) {
      return;
    }

    // Group cells by their parent row
    const rowsWithStickyCells = new Map();
    stickyCells.forEach((cell) => {
      const row = cell.parentElement;
      if (!rowsWithStickyCells.has(row)) {
        rowsWithStickyCells.set(row, []);
      }
      rowsWithStickyCells.get(row).push(cell);
    });

    // Convert to array and sort by row position in DOM
    const allRows = Array.from(element.querySelectorAll(".navi_tr"));
    const stickyRows = Array.from(rowsWithStickyCells.keys()).sort((a, b) => {
      const aIndex = allRows.indexOf(a);
      const bIndex = allRows.indexOf(b);
      return aIndex - bIndex;
    });

    let cumulativeHeight = 0;
    stickyRows.forEach((row, index) => {
      const rowCells = rowsWithStickyCells.get(row);
      const topPosition = index === 0 ? 0 : cumulativeHeight;

      // Set CSS variable on all sticky cells in this row using setStyles for proper cleanup
      rowCells.forEach((cell) => {
        const restoreStyles = setStyles(cell, {
          [ITEM_TOP_VAR]: `${topPosition}px`,
        });
        addCleanup(restoreStyles);
      });

      // Also set CSS variable on the <tr> element itself
      const restoreRowStyles = setStyles(row, {
        [ITEM_TOP_VAR]: `${topPosition}px`,
      });
      addCleanup(restoreRowStyles);

      // Update cumulative height for next row
      const rowHeight = row.getBoundingClientRect().height;
      if (index === 0) {
        cumulativeHeight = rowHeight;
      } else {
        cumulativeHeight += rowHeight;
      }
    });

    // Set frontier variables with proper cleanup tracking
    const restoreContainerStyles = setStyles(container, {
      [FRONTIER_TOP_VAR]: `${cumulativeHeight}px`,
    });
    addCleanup(restoreContainerStyles);

    if (elementReceivingCumulativeStickyPosition) {
      const restoreCumulativeStyles = setStyles(
        elementReceivingCumulativeStickyPosition,
        {
          [FRONTIER_TOP_VAR]: `${cumulativeHeight}px`,
        },
      );
      addCleanup(restoreCumulativeStyles);
    }
  };

  const updateLinearPositions = () => {
    // Handle linear container - detect direction from first sticky element
    const stickyElements = element.querySelectorAll(
      "[data-sticky-left], [data-sticky-top]",
    );
    if (stickyElements.length <= 1) return;

    const firstElement = stickyElements[0];
    const isHorizontal = firstElement.hasAttribute("data-sticky-left");
    const dimensionProperty = isHorizontal ? "width" : "height";
    const cssVariableName = isHorizontal ? ITEM_LEFT_VAR : ITEM_TOP_VAR;

    let cumulativeSize = 0;
    stickyElements.forEach((element, index) => {
      if (index === 0) {
        // First element stays at position 0
        const restoreStyles = setStyles(element, {
          [cssVariableName]: "0px",
        });
        addCleanup(restoreStyles);
        cumulativeSize = element.getBoundingClientRect()[dimensionProperty];
      } else {
        // Subsequent elements use cumulative positioning
        const position = cumulativeSize;
        const restoreStyles = setStyles(element, {
          [cssVariableName]: `${position}px`,
        });
        addCleanup(restoreStyles);
        cumulativeSize += element.getBoundingClientRect()[dimensionProperty];
      }
    });

    // Set frontier variables with proper cleanup tracking
    const frontierVar = isHorizontal ? FRONTIER_LEFT_VAR : FRONTIER_TOP_VAR;
    const restoreContainerStyles = setStyles(container, {
      [frontierVar]: `${cumulativeSize}px`,
    });
    addCleanup(restoreContainerStyles);

    if (elementReceivingCumulativeStickyPosition) {
      const restoreCumulativeStyles = setStyles(
        elementReceivingCumulativeStickyPosition,
        {
          [frontierVar]: `${cumulativeSize}px`,
        },
      );
      addCleanup(restoreCumulativeStyles);
    }
  };

  // Initial positioning
  updatePositions();

  // Set up ResizeObserver to handle size changes
  const resizeObserver = new ResizeObserver(() => {
    updatePositions();
  });

  // Set up MutationObserver to handle DOM changes
  const mutationObserver = new MutationObserver((mutations) => {
    let shouldUpdate = false;

    mutations.forEach((mutation) => {
      // Check if sticky elements were added/removed or attributes changed
      if (mutation.type === "childList") {
        shouldUpdate = true;
      }
      if (mutation.type === "attributes") {
        // Check if the mutation affects sticky attributes
        if (
          mutation.attributeName === "data-sticky-left" ||
          mutation.attributeName === "data-sticky-top"
        ) {
          shouldUpdate = true;
        }
      }
    });

    if (shouldUpdate) {
      updatePositions();
    }
  });

  // Start observing
  resizeObserver.observe(element);
  addTeardown(() => {
    resizeObserver.disconnect();
  });

  mutationObserver.observe(element, {
    attributes: true,
    childList: true,
    subtree: true,
    attributeFilter: ["data-sticky-left", "data-sticky-top"],
  });
  addTeardown(() => {
    mutationObserver.disconnect();
  });

  // Return cleanup function
  return () => {
    teardown();
  };
};

// const visualPositionEffect = (element, callback) => {
//   const updatePosition = () => {
//     const { left, top } = getVisualRect(element, document.body, {
//       isStickyLeft: false,
//       isStickyTop: false,
//     });
//     callback({ left, top });
//   };
//   updatePosition();

//   window.addEventListener("scroll", updatePosition, { passive: true });
//   window.addEventListener("resize", updatePosition);
//   window.addEventListener("touchmove", updatePosition);

//   return () => {
//     window.removeEventListener("scroll", updatePosition, {
//       passive: true,
//     });
//     window.removeEventListener("resize", updatePosition);
//     window.removeEventListener("touchmove", updatePosition);
//   };
// };

const TableStickyContext = createContext();

const useTableStickyContextValue = ({
  stickyLeftFrontierColumnIndex,
  stickyTopFrontierRowIndex,
  onStickyLeftFrontierChange,
  onStickyTopFrontierChange,
}) => {
  onStickyLeftFrontierChange = useStableCallback(onStickyLeftFrontierChange);
  onStickyTopFrontierChange = useStableCallback(onStickyTopFrontierChange);

  return useMemo(() => {
    return {
      stickyLeftFrontierColumnIndex,
      stickyTopFrontierRowIndex,
      onStickyLeftFrontierChange,
      onStickyTopFrontierChange,
    };
  }, [stickyLeftFrontierColumnIndex, stickyTopFrontierRowIndex]);
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_table {
      --sticky-frontier-color: #c0c0c0;
      --sticky-frontier-size: 12px;
      --sticky-frontier-ghost-size: 8px;
    }
  }

  .navi_table_cell[data-sticky-top] {
    position: sticky;
    top: var(--sticky-group-item-top, 0);
    z-index: ${Z_INDEX_STICKY_ROW};
  }
  .navi_table_cell[data-sticky-left] {
    position: sticky;
    left: var(--sticky-group-item-left, 0);
    z-index: ${Z_INDEX_STICKY_COLUMN};
  }
  .navi_table_cell[data-sticky-left][data-sticky-top] {
    position: sticky;
    top: var(--sticky-group-item-top, 0);
    left: var(--sticky-group-item-left, 0);
    z-index: ${Z_INDEX_STICKY_CORNER};
  }

  /* Useful because drag gesture will read this value to detect <col>, <tr> virtual position */
  .navi_col {
    left: var(--sticky-group-item-left, 0);
  }
  .navi_tr {
    top: var(--sticky-group-item-top, 0);
  }

  .navi_table_sticky_frontier {
    position: absolute;
    cursor: grab;
    pointer-events: auto;
  }

  .navi_table_sticky_frontier[data-left] {
    top: calc(var(--table-visual-top) + var(--sticky-group-top));
    left: calc(var(--table-visual-left) + var(--sticky-group-left));
    width: var(--sticky-frontier-size);
    height: calc(var(--table-visual-height) - var(--sticky-group-top));
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .navi_table_sticky_frontier[data-top] {
    top: calc(var(--table-visual-top) + var(--sticky-group-top));
    left: calc(var(--table-visual-left) + var(--sticky-group-left));
    width: calc(var(--table-visual-width) - var(--sticky-group-left));
    height: var(--sticky-frontier-size);
    background: linear-gradient(
      to bottom,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .navi_table_sticky_frontier_ghost,
  .navi_table_sticky_frontier_preview {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }
  .navi_table_sticky_frontier_ghost {
    z-index: ${Z_INDEX_STICKY_FRONTIER_GHOST};
    background: rgba(68, 71, 70, 0.5);
  }
  .navi_table_sticky_frontier_preview {
    z-index: ${Z_INDEX_STICKY_FRONTIER_PREVIEW};
    background: rgba(56, 121, 200, 0.5);
  }
  .navi_table_sticky_frontier_ghost[data-visible],
  .navi_table_sticky_frontier_preview[data-visible] {
    opacity: 1;
  }
  .navi_table_sticky_frontier_ghost[data-left],
  .navi_table_sticky_frontier_preview[data-left] {
    top: 0;
    width: var(--sticky-frontier-ghost-size);
    height: var(--table-height, 100%);
  }
  .navi_table_sticky_frontier_ghost[data-left] {
    left: var(--sticky-frontier-ghost-position, 0px);
  }
  .navi_table_sticky_frontier_preview[data-left] {
    left: var(--sticky-frontier-preview-position, 0px);
  }

  .navi_table_sticky_frontier_ghost[data-top],
  .navi_table_sticky_frontier_preview[data-top] {
    left: 0;
    width: var(--table-width, 100%);
    height: var(--sticky-frontier-ghost-size);
  }

  .navi_table_sticky_frontier_ghost[data-top] {
    top: var(--sticky-frontier-ghost-position, 0px);
  }
  .navi_table_sticky_frontier_preview[data-top] {
    top: var(--sticky-frontier-preview-position, 0px);
  }

  /* Positioning adjustments for ::after pseudo-elements on cells adjacent to sticky frontiers */
  /* These ensure selection and focus borders align with the ::before borders */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-left-frontier]::after {
    left: 0;
  }

  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-top-frontier]::after {
    top: 0;
  }

  /* Base borders for sticky cells (will be overridden by frontier rules) */
  .navi_table[data-border-collapse] .navi_table_cell[data-sticky-left]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse] .navi_table_cell[data-sticky-top]::before {
    box-shadow:
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header row sticky cells need top border */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-sticky-left]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-sticky-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column sticky cells need left border */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-column][data-sticky-left]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-column][data-sticky-top]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header first column sticky cells get all four regular borders */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-first-column][data-sticky-left]::before,
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-first-column][data-sticky-top]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Borders for cells immediately after sticky frontiers */

  /* Left border for the column after sticky-x-frontier */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-left-frontier]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells after sticky-x-frontier also need top border (for border-collapse) */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-after-sticky-left-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Top border for the row after sticky-y-frontier */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Header cells after sticky-y-frontier also need left border (for border-collapse) */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-row][data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* First column cells after sticky-y-frontier need all four borders (for border-collapse) */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-first-column][data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 0 1px 0 0 var(--border-color),
      inset 1px 0 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }

  /* Corner case: cell after both sticky frontiers */
  .navi_table[data-border-collapse]
    .navi_table_cell[data-after-sticky-left-frontier][data-after-sticky-top-frontier]::before {
    box-shadow:
      inset 1px 0 0 0 var(--border-color),
      inset 0 1px 0 0 var(--border-color),
      inset -1px 0 0 0 var(--border-color),
      inset 0 -1px 0 0 var(--border-color);
  }
`;
const TableStickyFrontier = ({
  tableRef
}) => {
  const stickyLeftFrontierGhostRef = useRef();
  const stickyLeftFrontierPreviewRef = useRef();
  const stickyTopFrontierGhostRef = useRef();
  const stickyTopFrontierPreviewRef = useRef();
  return jsxs(Fragment, {
    children: [jsx(TableStickyLeftFrontier, {
      tableRef: tableRef,
      stickyLeftFrontierGhostRef: stickyLeftFrontierGhostRef,
      stickyLeftFrontierPreviewRef: stickyLeftFrontierPreviewRef
    }), jsx(TableStickyTopFrontier, {
      tableRef: tableRef,
      stickyTopFrontierGhostRef: stickyTopFrontierGhostRef,
      stickyTopFrontierPreviewRef: stickyTopFrontierPreviewRef
    }), jsx("div", {
      ref: stickyLeftFrontierGhostRef,
      className: "navi_table_sticky_frontier_ghost",
      "data-left": ""
    }), jsx("div", {
      ref: stickyLeftFrontierPreviewRef,
      className: "navi_table_sticky_frontier_preview",
      "data-left": ""
    }), jsx("div", {
      ref: stickyTopFrontierGhostRef,
      className: "navi_table_sticky_frontier_ghost",
      "data-top": ""
    }), jsx("div", {
      ref: stickyTopFrontierPreviewRef,
      className: "navi_table_sticky_frontier_preview",
      "data-top": ""
    })]
  });
};
const TableStickyLeftFrontier = ({
  tableRef,
  stickyLeftFrontierGhostRef,
  stickyLeftFrontierPreviewRef
}) => {
  const {
    stickyLeftFrontierColumnIndex,
    onStickyLeftFrontierChange
  } = useContext(TableStickyContext);
  const canMoveFrontier = Boolean(onStickyLeftFrontierChange);
  return jsx("div", {
    className: "navi_table_sticky_frontier",
    "data-left": "",
    inert: !canMoveFrontier,
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag column

      const table = tableRef.current;
      const stickyLeftFrontierGhost = stickyLeftFrontierGhostRef.current;
      const stickyLeftFrontierPreview = stickyLeftFrontierPreviewRef.current;
      const colgroup = table.querySelector("colgroup");
      const colElements = Array.from(colgroup.children);
      initMoveStickyFrontierViaPointer(e, {
        table,
        frontierGhost: stickyLeftFrontierGhost,
        frontierPreview: stickyLeftFrontierPreview,
        elements: colElements,
        frontierIndex: stickyLeftFrontierColumnIndex,
        axis: "x",
        onRelease: (_, index) => {
          if (index !== stickyLeftFrontierColumnIndex) {
            onStickyLeftFrontierChange(index);
          }
        }
      });
    }
  });
};
const TableStickyTopFrontier = ({
  tableRef,
  stickyTopFrontierGhostRef,
  stickyTopFrontierPreviewRef
}) => {
  const {
    stickyTopFrontierRowIndex,
    onStickyTopFrontierChange
  } = useContext(TableStickyContext);
  const canMoveFrontier = Boolean(onStickyTopFrontierChange);
  return jsx("div", {
    className: "navi_table_sticky_frontier",
    "data-top": "",
    inert: !canMoveFrontier,
    onPointerDown: e => {
      if (e.button !== 0) {
        return;
      }
      e.preventDefault(); // prevent text selection
      e.stopPropagation(); // prevent drag column

      const table = tableRef.current;
      const rowElements = Array.from(table.querySelectorAll("tr"));
      initMoveStickyFrontierViaPointer(e, {
        table,
        frontierGhost: stickyTopFrontierGhostRef.current,
        frontierPreview: stickyTopFrontierPreviewRef.current,
        elements: rowElements,
        frontierIndex: stickyTopFrontierRowIndex,
        axis: "y",
        onRelease: (_, index) => {
          if (index !== stickyTopFrontierRowIndex) {
            onStickyTopFrontierChange(index);
          }
        }
      });
    }
  });
};

// Generic function to handle sticky frontier movement for both axes
const initMoveStickyFrontierViaPointer = (pointerdownEvent, {
  table,
  frontierGhost,
  frontierPreview,
  frontierIndex,
  onGrab,
  onDrag,
  onRelease,
  // Axis-specific configuration
  axis,
  // 'x' or 'y'
  elements // array of colElements or rowElements
}) => {
  // Get elements based on axis
  const gestureName = axis === "x" ? "move-sticky-left-frontier" : "move-sticky-top-frontier";
  const scrollProperty = axis === "x" ? "scrollLeft" : "scrollTop";
  const ghostVariableName = "--sticky-frontier-ghost-position";
  const previewVariableName = "--sticky-frontier-preview-position";
  const ghostElement = frontierGhost;
  const previewElement = frontierPreview;
  const scrollContainer = getScrollContainer(table);
  // Reset scroll to prevent starting drag in obstacle position
  scrollContainer[scrollProperty] = 0;

  // Setup table dimensions for ghost/preview
  const ghostOffsetParent = ghostElement.offsetParent;
  const ghostOffsetParentRect = ghostOffsetParent.getBoundingClientRect();
  const getPosition = elementRect => {
    if (axis === "x") {
      const elementLeftRelative = elementRect.left - ghostOffsetParentRect.left;
      return elementLeftRelative + elementRect.width;
    }
    const elementTopRelative = elementRect.top - ghostOffsetParentRect.top;
    return elementTopRelative + elementRect.height;
  };

  // Setup initial ghost position
  if (frontierIndex === -1) {
    ghostElement.style.setProperty(ghostVariableName, "0px");
  } else {
    const element = elements[frontierIndex];
    const elementRect = element.getBoundingClientRect();
    const position = getPosition(elementRect);
    ghostElement.style.setProperty(ghostVariableName, `${position}px`);
  }
  ghostElement.setAttribute("data-visible", "");
  let futureFrontierIndex = frontierIndex;
  const onFutureFrontierIndexChange = index => {
    futureFrontierIndex = index;

    // We maintain a visible preview of the frontier
    // to tell user "hey if you grab here, the frontier will be there"
    // At this stage user can see 3 frontiers. Where it is, the one he grab, the future one if he releases.
    if (index === frontierIndex) {
      previewElement.removeAttribute("data-visible");
      return;
    }
    let previewPosition;
    if (index === -1) {
      previewPosition = 0;
    } else {
      const element = elements[index];
      const elementRect = element.getBoundingClientRect();
      previewPosition = getPosition(elementRect);
    }
    previewElement.style.setProperty(previewVariableName, `${previewPosition}px`);
    previewElement.setAttribute("data-visible", "");
  };
  const moveFrontierGestureController = createDragToMoveGestureController({
    name: gestureName,
    direction: {
      [axis]: true
    },
    backdropZIndex: Z_INDEX_STICKY_FRONTIER_BACKDROP,
    areaConstraint: "visible",
    areaConstraintElement: table.closest(".navi_table_root"),
    onGrab,
    onDrag: gestureInfo => {
      const dropTargetInfo = getDropTargetInfo(gestureInfo, elements);
      if (dropTargetInfo) {
        const dropColumnIndex = dropTargetInfo.index;
        const dropFrontierIndex = dropTargetInfo.elementSide[axis] === "start" ? dropColumnIndex - 1 : dropColumnIndex;
        if (dropFrontierIndex !== futureFrontierIndex) {
          onFutureFrontierIndexChange(dropFrontierIndex);
        }
      }
      onDrag?.(gestureInfo, futureFrontierIndex);
    },
    onRelease: gesture => {
      previewElement.removeAttribute("data-visible");
      previewElement.style.removeProperty(previewVariableName);
      ghostElement.removeAttribute("data-visible");
      ghostElement.style.removeProperty(ghostVariableName);
      ghostElement.style[axis === "x" ? "left" : "top"] = ""; // reset position set by drag

      onRelease?.(gesture, futureFrontierIndex);
    }
  });
  moveFrontierGestureController.grabViaPointer(pointerdownEvent, {
    element: ghostElement
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_table_ui {
    position: fixed;
    inset: 0;
    z-index: ${Z_INDEX_TABLE_UI};
    pointer-events: none; /* UI elements must use pointer-events: auto if they need to be interactive */
    overflow: hidden; /* Ensure UI elements cannot impact scrollbars of the document  */
    /* background: rgba(0, 255, 0, 0.2); */
  }
`;
const TableUI = forwardRef((props, ref) => {
  const {
    tableRef,
    tableId,
    children
  } = props;

  // ui positioning
  useLayoutEffect(() => {
    const ui = ref.current;
    const table = tableRef.current;
    if (!ui || !table) {
      return null;
    }

    // TODO: external code should be able to call tableVisibleRectEffect.check();
    // (for the drag operation when we scroll)
    // -> actually not that important because browser will dispatch "scroll" events
    // cause by programmatic scrolls before re-painting
    // -> no intermediate state visible to the user where overlay is not in sync
    const tableVisibleRectEffect = visibleRectEffect(table, visibleRect => {
      ui.style.setProperty("--table-visual-left", `${visibleRect.left}px`);
      ui.style.setProperty("--table-visual-width", `${visibleRect.width}px`);
      ui.style.setProperty("--table-visual-top", `${visibleRect.top}px`);
      ui.style.setProperty("--table-visual-height", `${visibleRect.height}px`);
    });
    return tableVisibleRectEffect.disconnect;
  });
  return createPortal(jsx("div", {
    ref: ref,
    className: "navi_table_ui",
    "data-overlay-for": tableId,
    children: children
  }), document.body);
});

/**
 * Table Component with Custom Border and Selection System
 *
 * PROBLEM: We want to draw selected table cells with a clear visual perimeter
 *
 * ATTEMPTED SOLUTIONS & THEIR ISSUES:
 *
 * 1. Drawing selection outside the table:
 *    - z-index issues: Hard to ensure selection appears above all table elements
 *    - Performance issues: Constant recalculation during resizing, scrolling, etc.
 *    - Positioning complexity: Managing absolute positioning relative to table cells
 *
 * 2. Using native CSS table cell borders:
 *    - Border rendering artifacts: CSS borders are not rendered as straight lines,
 *      making selection perimeter imperfect (especially with thick borders)
 *    - Border-collapse compatibility: Native border-collapse causes sticky elements
 *      to lose borders while scrolling in some browsers
 *    - Dimension changes: Custom border-collapse (manually disabling adjacent borders)
 *      changes cell dimensions, making selection outline visible and inconsistent
 *
 * SOLUTION: Custom border system using box-shadow
 *
 * KEY PRINCIPLES:
 * - Use inset box-shadow to ensure borders appear above table cell backgrounds
 * - Use ::before pseudo-elements with position: absolute for flexible positioning
 * - Each cell draws its own borders independently (no border-collapse by default)
 * - Selection borders override table borders using higher CSS specificity
 * - Sticky borders use thicker box-shadows in accent color (yellow)
 *
 * TECHNICAL IMPLEMENTATION:
 * - All borders use inset box-shadow with specific directional mapping:
 *   * Top: inset 0 1px 0 0
 *   * Right: inset -1px 0 0 0
 *   * Bottom: inset 0 -1px 0 0
 *   * Left: inset 1px 0 0 0
 * - Selection borders (blue) override table borders (red) in same pseudo-element
 * - Sticky borders replace regular borders with thicker colored variants
 * - Border-collapse mode available as optional feature for future use
 *
 * Note how border disappear for sticky elements when using border-collapse (https://bugzilla.mozilla.org/show_bug.cgi?id=1727594)
 *
 * Next steps:
 *
 * - Mettre le sticky again dans les tables cells (mais les suivantes pour avoir l'effet d'ombre)
 *
 * - Can add a column (+ button at the end of table headers)
 * - Can add a row (+ button at the end of the row number column )
 * - Delete a row (how?)
 * - Delete a column (how?)
 * - Update table column info (I guess a down arrow icon which opens a meny when clicked for instance)
 */

const [useColumnTrackerProviders, useRegisterColumn, useColumnByIndex] = createIsolatedItemTracker();
const [useRowTrackerProvider, useRegisterRow, useRowByIndex] = createItemTracker();
const ColumnProducerProviderContext = createContext();
const ColumnConsumerProviderContext = createContext();
const ColumnContext = createContext();
const RowContext = createContext();
const ColumnIndexContext = createContext();
const RowIndexContext = createContext();
const TableSectionContext = createContext();
const useIsInTableHead = () => useContext(TableSectionContext) === "head";
const Table = forwardRef((props, ref) => {
  const tableDefaultId = `table-${useId()}`;
  const {
    id = tableDefaultId,
    selection = [],
    selectionColor,
    onSelectionChange,
    onColumnSizeChange,
    onRowSizeChange,
    borderCollapse = true,
    stickyLeftFrontierColumnIndex = -1,
    onStickyLeftFrontierChange,
    stickyTopFrontierRowIndex = -1,
    onStickyTopFrontierChange,
    onColumnOrderChange,
    maxWidth,
    maxHeight,
    overflow,
    children
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const tableContainerRef = useRef();
  const tableUIRef = useRef();
  const [ColumnProducerProvider, ColumnConsumerProvider, columns] = useColumnTrackerProviders();
  const RowTrackerProvider = useRowTrackerProvider();
  const rows = RowTrackerProvider.items;

  // selection
  const selectionController = useTableSelectionController({
    tableRef: innerRef,
    selection,
    onSelectionChange,
    selectionColor
  });
  const selectionContextValue = useTableSelectionContextValue(selection, selectionController);
  useFocusGroup(innerRef);

  // sticky
  useStickyGroup(tableContainerRef, {
    elementSelector: ".navi_table",
    elementReceivingCumulativeStickyPositionRef: tableUIRef
  });
  const stickyContextValue = useTableStickyContextValue({
    stickyLeftFrontierColumnIndex,
    stickyTopFrontierRowIndex,
    onStickyLeftFrontierChange,
    onStickyTopFrontierChange
  });

  // drag columns
  const tableRootRef = useRef();
  const setColumnOrder = columnIdsNewOrder => {
    // the code below ensures we re-render the selection when column are re-ordered
    // forcing each previously selected <td> to unselect and newly selected <td> to be selected
    // (because the corresponding DOM node is now different)
    onSelectionChange?.([...selection]);
    onColumnOrderChange?.(columnIdsNewOrder);
  };
  const tableDragCloneContainerRef = useRef();
  const tableColumnDropPreviewRef = useRef();
  const dragContextValue = useTableDragContextValue({
    tableDragCloneContainerRef,
    tableColumnDropPreviewRef,
    setColumnOrder,
    columns,
    canChangeColumnOrder: Boolean(onColumnOrderChange)
  });
  useKeyboardShortcuts(innerRef, [...createSelectionKeyboardShortcuts(selectionController, {
    toggleEnabled: true,
    enabled: () => dragContextValue.grabTarget === null
  }), {
    key: "enter",
    description: "Edit table cell content",
    enabled: () => dragContextValue.grabTarget === null,
    handler: () => {
      // Find the currently focused cell
      const activeCell = document.activeElement.closest("td");
      if (!activeCell) {
        return false;
      }
      activeCell.dispatchEvent(new CustomEvent("editrequested", {
        bubbles: false
      }));
      return true;
    }
  }, {
    key: "a-z",
    description: "Start editing table cell content",
    enabled: () => dragContextValue.grabTarget === null,
    handler: e => {
      const activeCell = document.activeElement.closest("td");
      if (!activeCell) {
        return false;
      }
      activeCell.dispatchEvent(new CustomEvent("editrequested", {
        bubbles: false,
        detail: {
          initialValue: e.key
        }
      }));
      return true;
    }
  }]);

  // resizing
  const columnResizerRef = useRef();
  const rowResizerRef = useRef();
  const tableSizeContextValue = useTableSizeContextValue({
    onColumnSizeChange,
    onRowSizeChange,
    columns,
    rows,
    columnResizerRef,
    rowResizerRef
  });
  return jsx("div", {
    ref: tableRootRef,
    className: "navi_table_root",
    style: {
      overflow,
      "--table-max-width": maxWidth ? `${maxWidth}px` : undefined,
      "--table-max-height": maxHeight ? `${maxHeight}px` : undefined
    },
    children: jsxs("div", {
      ref: tableContainerRef,
      className: "navi_table_container",
      children: [jsx("table", {
        ref: innerRef,
        id: id,
        className: "navi_table",
        "aria-multiselectable": "true",
        "data-multiselection": selection.length > 1 ? "" : undefined,
        "data-border-collapse": borderCollapse ? "" : undefined,
        "data-droppable": "",
        children: jsx(TableSizeContext.Provider, {
          value: tableSizeContextValue,
          children: jsx(TableSelectionContext.Provider, {
            value: selectionContextValue,
            children: jsx(TableDragContext.Provider, {
              value: dragContextValue,
              children: jsx(TableStickyContext.Provider, {
                value: stickyContextValue,
                children: jsx(ColumnProducerProviderContext.Provider, {
                  value: ColumnProducerProvider,
                  children: jsx(ColumnConsumerProviderContext.Provider, {
                    value: ColumnConsumerProvider,
                    children: jsx(RowTrackerProvider, {
                      children: children
                    })
                  })
                })
              })
            })
          })
        })
      }), jsxs(TableUI, {
        ref: tableUIRef,
        tableRef: innerRef,
        tableId: id,
        children: [jsx(TableStickyContext.Provider, {
          value: stickyContextValue,
          children: jsx(TableStickyFrontier, {
            tableRef: innerRef
          })
        }), jsx(TableColumnResizer, {
          ref: columnResizerRef
        }), jsx(TableRowResizer, {
          ref: rowResizerRef
        }), jsx(TableDragCloneContainer, {
          ref: tableDragCloneContainerRef,
          tableId: id
        }), jsx(TableColumnDropPreview, {
          ref: tableColumnDropPreviewRef
        })]
      })]
    })
  });
});
const Colgroup = ({
  children
}) => {
  const ColumnProducerProvider = useContext(ColumnProducerProviderContext);
  return jsx("colgroup", {
    className: "navi_colgroup",
    children: jsx(ColumnProducerProvider, {
      children: children
    })
  });
};
const Col = ({
  id,
  width,
  immovable,
  backgroundColor
}) => {
  const columnIndex = useRegisterColumn({
    id,
    width,
    immovable,
    backgroundColor
  });
  const {
    stickyLeftFrontierColumnIndex
  } = useContext(TableStickyContext);
  const isStickyLeft = columnIndex <= stickyLeftFrontierColumnIndex;
  return jsx("col", {
    className: "navi_col",
    id: id,
    "data-sticky-left": isStickyLeft ? "" : undefined,
    "data-drag-sticky-left-frontier": isStickyLeft ? "" : undefined,
    "data-drag-obstacle": immovable ? "move-column" : undefined,
    style: {
      minWidth: width ? `${width}px` : undefined,
      maxWidth: width ? `${width}px` : undefined
    }
  });
};
const Thead = ({
  children
}) => {
  return jsx("thead", {
    children: jsx(TableSectionContext.Provider, {
      value: "head",
      children: children
    })
  });
};
const Tbody = ({
  children
}) => {
  return jsx("tbody", {
    children: jsx(TableSectionContext.Provider, {
      value: "body",
      children: children
    })
  });
};
const Tr = ({
  id,
  height,
  children
}) => {
  if (!id) {
    console.warn("<Tr /> must have an id prop to enable selection");
  }
  id = String(id); // we need strings as this value is going to be used in data attributes
  // and when generating cell ids

  const {
    selectedRowIds
  } = useContext(TableSelectionContext);
  const {
    stickyTopFrontierRowIndex
  } = useContext(TableStickyContext);
  const rowIndex = useRegisterRow({
    id,
    height
  });
  const row = useRowByIndex(rowIndex);
  const ColumnConsumerProvider = useContext(ColumnConsumerProviderContext);
  const isStickyTop = rowIndex <= stickyTopFrontierRowIndex;
  const isStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex;
  const isRowSelected = selectedRowIds.includes(id);
  children = toChildArray(children);

  /* We use <TableRowCells> to be able to provide <ColumnConsumerProvider />  
  that is needed by useColumnByIndex */

  return jsx("tr", {
    className: "navi_tr",
    "data-row-id": id ? id : undefined,
    "aria-selected": isRowSelected,
    "data-sticky-top": isStickyTop ? "" : undefined,
    "data-drag-sticky-top-frontier": isStickyTopFrontier ? "" : undefined,
    style: {
      height: height ? `${height}px` : undefined,
      maxHeight: height ? `${height}px` : undefined
    },
    children: jsx(ColumnConsumerProvider, {
      children: jsx(TableRowCells, {
        rowIndex: rowIndex,
        row: row,
        children: children
      })
    })
  });
};
const TableRowCells = ({
  children,
  rowIndex,
  row
}) => {
  return children.map((child, columnIndex) => {
    const column = useColumnByIndex(columnIndex);
    const columnId = column.id;
    return jsx(RowContext.Provider, {
      value: row,
      children: jsx(RowIndexContext.Provider, {
        value: rowIndex,
        children: jsx(ColumnIndexContext.Provider, {
          value: columnIndex,
          children: jsx(ColumnContext.Provider, {
            value: column,
            children: child
          })
        })
      })
    }, columnId);
  });
};
const TableCell = forwardRef((props, ref) => {
  const column = useContext(ColumnContext);
  const row = useContext(RowContext);
  const columnIndex = useContext(ColumnIndexContext);
  const rowIndex = useContext(RowIndexContext);
  const {
    className = "",
    canSelectAll,
    canDragColumn,
    canResizeWidth,
    canResizeHeight,
    selectionImpact,
    onClick,
    action,
    name,
    valueSignal,
    // appeareance
    style,
    cursor,
    bold,
    selfAlignX = column.selfAlignX,
    selfAlignY = column.selfAlignY,
    backgroundColor = column.backgroundColor || row.backgroundColor,
    children
  } = props;
  const cellRef = useRef();
  const isFirstRow = rowIndex === 0;
  const isFirstColumn = columnIndex === 0;

  // editing
  const editable = Boolean(action);
  const {
    editing,
    startEditing,
    stopEditing
  } = useEditionController();
  useImperativeHandle(ref, () => ({
    startEditing,
    stopEditing,
    element: cellRef.current
  }));

  // stickyness
  const {
    stickyLeftFrontierColumnIndex,
    stickyTopFrontierRowIndex
  } = useContext(TableStickyContext);
  const stickyLeft = columnIndex <= stickyLeftFrontierColumnIndex;
  const stickyTop = rowIndex <= stickyTopFrontierRowIndex;
  const isStickyLeftFrontier = columnIndex === stickyLeftFrontierColumnIndex;
  const isAfterStickyLeftFrontier = columnIndex === stickyLeftFrontierColumnIndex + 1;
  const isStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex;
  const isAfterStickyTopFrontier = rowIndex === stickyTopFrontierRowIndex + 1;

  // selection
  const rowId = row.id;
  const columnId = column.id;
  const selectionValue = stringifyTableSelectionValue("cell", {
    rowId,
    columnId
  });
  const {
    selection,
    selectionController,
    columnIdWithSomeSelectedCellSet,
    rowIdWithSomeSelectedCellSet
  } = useContext(TableSelectionContext);
  const innerSelectionImpact = selectionImpact === undefined ? isFirstRow && isFirstColumn && canSelectAll ? allValues => {
    const cells = allValues.filter(v => parseTableSelectionValue(v).type === "cell");
    return cells;
  } : isFirstRow ? allValues => {
    const columnCells = allValues.filter(v => {
      const selectionValueInfo = parseTableSelectionValue(v);
      return selectionValueInfo.type === "cell" && selectionValueInfo.columnId === columnId;
    });
    return columnCells;
  } : isFirstColumn ? allValues => {
    const rowCells = allValues.filter(v => {
      const selectionValueInfo = parseTableSelectionValue(v);
      return selectionValueInfo.type === "cell" && selectionValueInfo.rowId === rowId;
    });
    return rowCells;
  } : undefined : selectionImpact;
  const {
    selected
  } = useSelectableElement(cellRef, {
    selection,
    selectionController,
    selectionImpact: innerSelectionImpact
    // value: selectionId,
  });

  // moving column
  const {
    tableDragCloneContainerRef,
    tableColumnDropPreviewRef,
    grabTarget,
    grabColumn,
    releaseColumn,
    canChangeColumnOrder
  } = useContext(TableDragContext);
  const columnGrabbed = grabTarget === `column:${columnIndex}`;

  // resizing
  const innerCanDragColumn = canDragColumn === undefined ? rowIndex === 0 && !column.immovable && Boolean(canChangeColumnOrder) : canDragColumn;
  const innerCanResizeWidth = canResizeWidth === undefined ? rowIndex === 0 : canResizeWidth;
  const innerCanResizeHeight = canResizeHeight === undefined ? columnIndex === 0 : canResizeHeight;

  // display
  const isInTableHead = useIsInTableHead();
  const innerStyle = {
    ...style
  };
  const columnContainsSelectedCell = columnIdWithSomeSelectedCellSet.has(columnId);
  const rowContainsSelectedCell = rowIdWithSomeSelectedCellSet.has(rowId);
  const containSelectedCell = isFirstRow && columnContainsSelectedCell || isFirstColumn && rowContainsSelectedCell;

  // appeareance
  const innerBackgroundColor = backgroundColor || containSelectedCell ? "var(--selection-background-color)" : isFirstColumn ? "#F8F8F8" : isFirstRow ? "#d3e7ff" : "white";
  {
    innerStyle["--background-color"] = innerBackgroundColor;
  }
  if (cursor) {
    innerStyle.cursor = cursor;
  }
  const columnWidth = column.width;
  if (columnWidth !== undefined) {
    innerStyle.minWidth = `${columnWidth}px`;
    innerStyle.width = `${columnWidth}px`;
    innerStyle.maxWidth = `${columnWidth}px`;
  }
  const rowHeight = row.height;
  if (rowHeight !== undefined) {
    innerStyle.maxHeight = `${rowHeight}px`;
  }
  const innerAlignX = selfAlignX || isFirstRow ? "center" : "start";
  const innerAlignY = selfAlignY || isFirstColumn ? "center" : "start";
  const innerBold = bold || containSelectedCell;
  if (innerBold) {
    innerStyle.fontWeight = "bold";
  }
  const activeElement = useActiveElement();
  const TagName = isInTableHead ? "th" : "td";
  return jsxs(TagName, {
    className: ["navi_table_cell", ...className.split(" ")].join(" "),
    ref: cellRef,
    style: innerStyle,
    "data-align-x": innerAlignX,
    "data-align-y": innerAlignY
    // we use [data-focus] so that the attribute can be copied
    // to the dragged cell copies
    ,
    "data-focus": activeElement === cellRef.current ? "" : undefined,
    "data-first-row": isFirstRow ? "" : undefined,
    "data-first-column": isFirstColumn ? "" : undefined,
    "data-sticky-left": stickyLeft ? "" : undefined,
    "data-sticky-top": stickyTop ? "" : undefined,
    "data-sticky-left-frontier": stickyLeft && isStickyLeftFrontier ? "" : undefined,
    "data-sticky-top-frontier": stickyTop && isStickyTopFrontier ? "" : undefined,
    "data-after-sticky-left-frontier": isAfterStickyLeftFrontier ? "" : undefined,
    "data-after-sticky-top-frontier": isAfterStickyTopFrontier ? "" : undefined,
    tabIndex: -1,
    "data-height-xxs": rowHeight !== undefined && rowHeight < 42 ? "" : undefined,
    "data-width-xxs": columnWidth !== undefined && columnWidth < 42 ? "" : undefined,
    "data-selection-name": isInTableHead ? "column" : "cell",
    "data-selection-keyboard-toggle": true,
    "aria-selected": selected,
    "data-value": selectionValue,
    "data-editing": editing ? "" : undefined,
    "data-grabbed": columnGrabbed ? "" : undefined,
    onClick: onClick,
    onPointerDown: e => {
      if (!innerCanDragColumn) {
        return;
      }
      if (e.button !== 0) {
        return;
      }
      initDragTableColumnViaPointer(e, {
        tableDragCloneContainer: tableDragCloneContainerRef.current,
        dropPreview: tableColumnDropPreviewRef.current,
        onGrab: () => grabColumn(columnIndex),
        onDrag: () => {},
        onRelease: (_, newColumnIndex) => releaseColumn(columnIndex, newColumnIndex)
      });
    },
    onDoubleClick: e => {
      if (!editable) {
        return;
      }
      startEditing(e);
    },
    oneditrequested: e => {
      if (!editable) {
        return;
      }
      startEditing(e);
    },
    children: [editable ? jsx(Editable, {
      editing: editing,
      onEditEnd: stopEditing,
      value: children,
      action: action,
      name: name,
      valueSignal: valueSignal,
      height: "100%",
      width: "100%",
      children: children
    }) : children, innerCanResizeWidth && jsx(TableCellColumnResizeHandles, {
      columnIndex: columnIndex,
      columnMinWidth: column.minWidth,
      columnMaxWidth: column.maxWidth
    }), innerCanResizeHeight && jsx(TableCellRowResizeHandles, {
      rowIndex: rowIndex,
      rowMinHeight: row.minHeight,
      rowMaxHeight: row.maxHeight
    }), isInTableHead && jsx("span", {
      className: "navi_table_cell_content_bold_clone",
      "aria-hidden": "true",
      children: children
    }), jsx("div", {
      className: "navi_table_cell_foreground",
      "data-visible": columnGrabbed ? "" : undefined
    })]
  });
});
const RowNumberCol = ({
  width = 50,
  // minWidth = 30,
  // maxWidth = 100,
  immovable = true,
  ...rest
}) => {
  return jsx(Col, {
    id: "row_number",
    width: width
    // minWidth={minWidth}
    // maxWidth={maxWidth}
    ,
    immovable: immovable,
    ...rest
  });
};
const RowNumberTableCell = props => {
  const columnIndex = useContext(ColumnIndexContext);
  const rowIndex = useContext(RowIndexContext);
  const isTopLeftCell = columnIndex === 0 && rowIndex === 0;
  return jsx(TableCell, {
    canSelectAll: isTopLeftCell,
    selfAlignX: "left",
    ...props,
    children: isTopLeftCell ? "" : rowIndex
  });
};

const useCellsAndColumns = (cells, columns) => {
  const [columnIds, idToColumnMap] = useMemo(() => {
    const columnIds = [];
    const idToColumnMap = new Map();
    for (const column of columns) {
      const columnId = column.id;
      columnIds.push(columnId);
      idToColumnMap.set(columnId, column);
    }
    return [columnIds, idToColumnMap];
  }, [columns]);
  const [orderedAllColumnIds, setOrderedAllColumnIds] = useState(columnIds);
  const orderedColumnIds = [];
  for (const columnId of orderedAllColumnIds) {
    if (!columnIds.includes(columnId)) {
      // generated column (like the row column)
      continue;
    }
    orderedColumnIds.push(columnId);
  }
  const orderedColumns = [];
  for (const columnId of orderedColumnIds) {
    const column = idToColumnMap.get(columnId);
    orderedColumns.push(column);
  }

  // Base cell values in original column order (2D array: rows x columns)
  const [baseCells, setBaseCells] = useState(cells);

  // Memoized index mapping for performance - maps display index to original index
  const columnOrderedIndexMap = useMemo(() => {
    const indexMap = new Map();
    for (let columnIndex = 0; columnIndex < columnIds.length; columnIndex++) {
      const columnIdAtThisIndex = orderedColumnIds[columnIndex];
      const originalIndex = columnIds.indexOf(columnIdAtThisIndex);
      indexMap.set(columnIndex, originalIndex);
    }
    return indexMap;
  }, [columnIds, orderedColumnIds]);

  // Derived state: reorder cell values according to column display order
  const orderedCells = useMemo(() => {
    const reorderedCells = [];
    for (let y = 0; y < baseCells.length; y++) {
      const originalRow = baseCells[y];
      const reorderedRow = [];
      for (let x = 0; x < orderedColumnIds.length; x++) {
        const columnOrderedIndex = columnOrderedIndexMap.get(x);
        const cellValue = originalRow[columnOrderedIndex];
        reorderedRow.push(cellValue);
      }
      reorderedCells.push(reorderedRow);
    }
    return reorderedCells;
  }, [baseCells, columnOrderedIndexMap, orderedColumnIds.length]);

  const setCellValue = ({ columnIndex, rowIndex }, value) => {
    const originalColumnIndex = columnOrderedIndexMap.get(columnIndex);
    if (originalColumnIndex === undefined) {
      console.warn(`Invalid column index: ${columnIndex}`);
      return;
    }
    setBaseCells((previousCells) => {
      const newCells = [];
      for (let y = 0; y < previousCells.length; y++) {
        const currentRow = previousCells[y];
        if (y !== rowIndex) {
          newCells.push(currentRow);
          continue;
        }
        const newRow = [];
        for (let x = 0; x < currentRow.length; x++) {
          const cellValue = x === originalColumnIndex ? value : currentRow[x];
          newRow.push(cellValue);
        }
        newCells.push(newRow);
      }
      return newCells;
    });
  };

  return {
    cells: orderedCells,
    setCellValue,
    columns: orderedColumns,
    setColumnOrder: setOrderedAllColumnIds,
  };
};

// http://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-keyshortcuts
const generateAriaKeyShortcuts = (key) => {
  let actualCombination;

  // Handle platform-specific combination objects
  if (typeof key === "object" && key !== null) {
    actualCombination = isMac ? key.mac : key.other;
  } else {
    actualCombination = key;
  }

  if (actualCombination) {
    return normalizeKeyCombination(actualCombination);
  }

  return "";
};

const normalizeKeyCombination = (combination) => {
  const lowerCaseCombination = combination.toLowerCase();
  const keys = lowerCaseCombination.split("+");

  // First normalize keys to their canonical form, then apply ARIA mapping
  for (let i = 0; i < keys.length; i++) {
    let key = normalizeKey(keys[i]);

    // Then apply ARIA-specific mappings if they exist
    if (keyToAriaKeyMapping[key]) {
      key = keyToAriaKeyMapping[key];
    }

    keys[i] = key;
  }

  return keys.join("+");
};
const keyToAriaKeyMapping = {
  // Platform-specific ARIA names
  command: "meta",
  option: "altgraph", // Mac option key uses "altgraph" in ARIA spec

  // Regular keys - platform-specific normalization
  delete: isMac ? "backspace" : "delete", // Mac delete key is backspace semantically
  backspace: isMac ? "backspace" : "delete",
};
const normalizeKey = (key) => {
  key = key.toLowerCase();

  // Find the canonical form for this key
  for (const [canonicalKey, config] of Object.entries(keyMapping)) {
    const allKeys = [canonicalKey, ...config.alias];
    if (allKeys.includes(key)) {
      return canonicalKey;
    }
  }

  return key;
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_shortcut_container[data-visually-hidden] {
    /* Visually hidden container - doesn't affect layout */
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;

    /* Ensure it's not interactable */
    opacity: 0;
    pointer-events: none;
  }

  .navi_shortcut_button[data-visually-hidden] {
    /* Visually hidden but accessible to screen readers */
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;

    /* Ensure it's not focusable via tab navigation */
    opacity: 0;
    pointer-events: none;
  }
`;
const ActiveKeyboardShortcuts = ({
  visible
}) => {
  const activeShortcuts = activeShortcutsSignal.value;
  return jsx("div", {
    className: "navi_shortcut_container",
    "data-visually-hidden": visible ? undefined : "",
    children: activeShortcuts.map(shortcut => {
      return jsx(KeyboardShortcutAriaElement, {
        visible: visible,
        keyCombination: shortcut.key,
        description: shortcut.description,
        enabled: shortcut.enabled,
        "data-action": shortcut.action ? shortcut.action.name : undefined,
        "data-confirm-message": shortcut.confirmMessage
      }, shortcut.key);
    })
  });
};
const KeyboardShortcutAriaElement = ({
  visible,
  keyCombination,
  description,
  enabled,
  ...props
}) => {
  if (typeof keyCombination === "function") {
    return null;
  }
  const ariaKeyshortcuts = generateAriaKeyShortcuts(keyCombination);
  return jsx("button", {
    className: "navi_shortcut_button",
    "data-visually-hidden": visible ? undefined : "",
    "aria-keyshortcuts": ariaKeyshortcuts,
    tabIndex: "-1",
    disabled: !enabled,
    ...props,
    children: description
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_clipboard_container {
      --height: 1.5em;
      --notif-spacing: 0.5em;
    }
  }

  .navi_clipboard_container {
    position: relative;
    display: inline-flex;
    height: var(--height);
    align-items: center;

    .navi_copied_notif {
      position: absolute;
      top: calc(-1 * var(--notif-spacing));
      right: 0;
      padding: 0.2em 0.5em;
      color: white;
      font-size: 80%;
      white-space: nowrap;
      background: black;
      border-radius: 3px;
      transform: translateY(-100%);
    }
  }
`;
const ButtonCopyToClipboard = ({
  children,
  ...props
}) => {
  const [copied, setCopied] = useState(false);
  const renderedRef = useRef();
  useEffect(() => {
    renderedRef.current = true;
    return () => {
      renderedRef.current = false;
    };
  }, []);
  return jsxs(Box, {
    class: "navi_clipboard_container",
    ...props,
    children: [jsx(Box, {
      className: "navi_copied_notif",
      "aria-hidden": copied ? "false" : "true",
      opacity: copied ? 1 : 0,
      children: "Copi\xE9 !"
    }), jsx(Button, {
      className: "navi_copy_button",
      row: true,
      icon: true,
      revealOnInteraction: true,
      square: true,
      alignY: "center",
      expandY: true,
      borderRadius: "xs",
      action: async () => {
        await addToClipboard(children);
        setTimeout(() => {
          if (!renderedRef.current) {
            // do not call setState on unmounted component
            return;
          }
          setCopied(false);
        }, 1500);
        setCopied(true);
      },
      children: copied ? jsx(Icon, {
        color: "green",
        children: jsx(CopiedIcon, {})
      }) : jsx(Icon, {
        children: jsx(CopyIcon, {})
      })
    })]
  });
};
const addToClipboard = async text => {
  const type = "text/plain";
  const clipboardItemData = {
    [type]: text
  };
  const clipboardItem = new ClipboardItem(clipboardItemData);
  await window.navigator.clipboard.write([clipboardItem]);
};
const CopyIcon = () => jsxs("svg", {
  viewBox: "0 0 16 16",
  children: [jsx("path", {
    d: "M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"
  }), jsx("path", {
    d: "M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"
  })]
});
const CopiedIcon = () => jsx("svg", {
  viewBox: "0 0 16 16",
  children: jsx("path", {
    fill: "currentColor",
    d: "M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
  })
});

const Address = ({
  children,
  ...props
}) => {
  return jsx(Text, {
    as: "address",
    ...props,
    children: children
  });
};

const LoadingDots = ({
  color = "FF156D"
}) => {
  return jsxs("svg", {
    viewBox: "0 0 200 200",
    width: "100%",
    height: "100%",
    xmlns: "http://www.w3.org/2000/svg",
    children: [jsx("rect", {
      fill: color,
      stroke: color,
      "stroke-width": "15",
      width: "30",
      height: "30",
      x: "25",
      y: "85",
      children: jsx("animate", {
        attributeName: "opacity",
        calcMode: "spline",
        dur: "2",
        values: "1;0;1;",
        keySplines: ".5 0 .5 1;.5 0 .5 1",
        repeatCount: "indefinite",
        begin: "-.4"
      })
    }), jsx("rect", {
      fill: color,
      stroke: color,
      "stroke-width": "15",
      width: "30",
      height: "30",
      x: "85",
      y: "85",
      children: jsx("animate", {
        attributeName: "opacity",
        calcMode: "spline",
        dur: "2",
        values: "1;0;1;",
        keySplines: ".5 0 .5 1;.5 0 .5 1",
        repeatCount: "indefinite",
        begin: "-.2"
      })
    }), jsx("rect", {
      fill: color,
      stroke: color,
      "stroke-width": "15",
      width: "30",
      height: "30",
      x: "145",
      y: "85",
      children: jsx("animate", {
        attributeName: "opacity",
        calcMode: "spline",
        dur: "2",
        values: "1;0;1;",
        keySplines: ".5 0 .5 1;.5 0 .5 1",
        repeatCount: "indefinite",
        begin: "0"
      })
    })]
  });
};

const CSS_VAR_NAME = "--x-color-contrasting";

const useContrastingColor = (ref, backgroundElementSelector) => {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    let elementToCheck = el;
    {
      elementToCheck = el.querySelector(backgroundElementSelector);
      if (!elementToCheck) {
        return;
      }
    }
    const lightColor = "var(--navi-color-light)";
    const darkColor = "var(--navi-color-dark)";
    const backgroundColor = getComputedStyle(elementToCheck).backgroundColor;
    if (!backgroundColor) {
      el.style.removeProperty(CSS_VAR_NAME);
      return;
    }
    const colorPicked = pickLightOrDark(
      backgroundColor,
      lightColor,
      darkColor,
      el,
    );
    el.style.setProperty(CSS_VAR_NAME, colorPicked);
  }, []);
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
  }
  .navi_badge_count {
    --x-size: 1.5em;
    --x-border-radius: var(--border-radius);
    --x-number-font-size: var(--font-size);
    position: relative;
    display: inline-block;

    color: var(--color, var(--x-color-contrasting));
    font-size: var(--font-size);
    vertical-align: middle;
    border-radius: var(--x-border-radius);
  }
  .navi_count_badge_overflow {
    position: relative;
    top: -0.1em;
  }
  /* Ellipse */
  .navi_badge_count[data-ellipse] {
    padding-right: 0.4em;
    padding-left: 0.4em;
    background: var(--background);
    background-color: var(--background-color, var(--background));
    border-radius: 1em;
  }
  /* Circle */
  .navi_badge_count[data-circle] {
    width: var(--x-size);
    height: var(--x-size);
  }
  .navi_badge_count_frame {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 100%;
    background: var(--background);
    background-color: var(--background-color, var(--background));
    border-radius: inherit;
    transform: translateY(-50%);
  }
  .navi_badge_count_text {
    position: absolute;
    top: 50%;
    left: 50%;
    font-size: var(--x-number-font-size, inherit);
    transform: translate(-50%, -50%);
  }
  .navi_badge_count[data-single-char] {
    --x-border-radius: 100%;
    --x-number-font-size: unset;
  }
  .navi_badge_count[data-two-chars] {
    --x-border-radius: 100%;
    --x-number-font-size: 0.8em;
  }
  .navi_badge_count[data-three-chars] {
    --x-border-radius: 100%;
    --x-number-font-size: 0.6em;
  }
`;
const BadgeStyleCSSVars = {
  borderWidth: "--border-width",
  borderRadius: "--border-radius",
  paddingRight: "--padding-right",
  paddingLeft: "--padding-left",
  backgroundColor: "--background-color",
  background: "--background",
  borderColor: "--border-color",
  color: "--color",
  fontSize: "--font-size"
};
const BadgeCountOverflow = () => jsx("span", {
  className: "navi_count_badge_overflow",
  children: "+"
});
const MAX_CHAR_AS_CIRCLE = 3;
const BadgeCount = ({
  children,
  max = 99,
  maxElement = jsx(BadgeCountOverflow, {}),
  // When you use max="none" (or max > 99) it might be a good idea to force ellipse
  // so that visually the interface do not suddently switch from circle to ellipse depending on the count
  ellipse,
  ...props
}) => {
  const defaultRef = useRef();
  const ref = props.ref || defaultRef;
  useContrastingColor(ref, ".navi_badge_count_visual");
  const valueRequested = typeof children === "string" ? parseInt(children, 10) : children;
  const valueDisplayed = applyMaxToValue(max, valueRequested);
  const hasOverflow = valueDisplayed !== valueRequested;
  const valueCharCount = String(valueDisplayed).length;
  const charCount = valueCharCount + (hasOverflow ? 1 : 0);
  if (charCount > MAX_CHAR_AS_CIRCLE) {
    ellipse = true;
  }
  if (ellipse) {
    return jsxs(BadgeCountEllipse, {
      ...props,
      ref: ref,
      hasOverflow: hasOverflow,
      children: [valueDisplayed, hasOverflow && maxElement]
    });
  }
  return jsxs(BadgeCountCircle, {
    ...props,
    ref: ref,
    hasOverflow: hasOverflow,
    charCount: charCount,
    children: [valueDisplayed, hasOverflow && maxElement]
  });
};
const applyMaxToValue = (max, value) => {
  if (isNaN(value)) {
    return value;
  }
  if (max === undefined || max === Infinity || max === false || max === "false" || max === "Infinity" || max === "none") {
    return value;
  }
  const numericMax = typeof max === "string" ? parseInt(max, 10) : max;
  if (isNaN(numericMax)) {
    return value;
  }
  if (value > numericMax) {
    return numericMax;
  }
  return value;
};
const BadgeCountCircle = ({
  ref,
  charCount,
  hasOverflow,
  loading,
  children,
  ...props
}) => {
  return jsx(Text, {
    ref: ref,
    className: "navi_badge_count",
    "data-circle": "",
    bold: true,
    "data-single-char": charCount === 1 ? "" : undefined,
    "data-two-chars": charCount === 2 ? "" : undefined,
    "data-three-chars": charCount === 3 ? "" : undefined,
    "data-value-overflow": hasOverflow ? "" : undefined,
    ...props,
    styleCSSVars: BadgeStyleCSSVars,
    spacing: "pre",
    children: loading ? jsx(LoadingDots, {}) : jsxs(Fragment, {
      children: [jsx("span", {
        style: "user-select: none",
        children: "\u200B"
      }), jsx("span", {
        className: "navi_badge_count_frame"
      }), jsx("span", {
        className: "navi_badge_count_text",
        children: children
      }), jsx("span", {
        style: "user-select: none",
        children: "\u200B"
      })]
    })
  });
};
const BadgeCountEllipse = ({
  ref,
  children,
  hasOverflow,
  ...props
}) => {
  return jsxs(Text, {
    ref: ref,
    className: "navi_badge_count",
    bold: true,
    "data-ellipse": "",
    "data-value-overflow": hasOverflow ? "" : undefined,
    ...props,
    styleCSSVars: BadgeStyleCSSVars,
    spacing: "pre",
    children: [jsx("span", {
      style: "user-select: none",
      children: "\u200B"
    }), children, jsx("span", {
      style: "user-select: none",
      children: "\u200B"
    })]
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_caption {
      --color: #6b7280;
    }

    @media (prefers-color-scheme: dark) {
      .navi_caption {
        --color: rgb(129, 134, 140);
      }
    }
  }

  .navi_caption {
    color: var(--color);
  }
`;
const CaptionStyleCSSVars = {
  color: "--color"
};
const Caption = ({
  className,
  ...rest
}) => {
  return jsx(Text, {
    as: "small",
    size: "0.8em" // We use em to be relative to the parent (we want to be smaller than the surrounding text)
    ,
    className: withPropsClassName("navi_caption", className),
    ...rest,
    styleCSSVars: CaptionStyleCSSVars
  });
};

/**
 * Example of how you'd use this:
 * <code-block data-language="HTML" data-escaped="true">
 *   <h1>Your HTML here. Any HTML should be escaped</h1>
 * </code-block>
 *
 * https://github.com/TheWebTech/hs-code-block-web-component/tree/main
 */

const CodeBlock = ({
  language,
  escaped = false,
  children,
  ...props
}) => {
  return jsx("code-block", {
    "data-language": language,
    "data-escaped": escaped ? "" : null,
    ...props,
    children: children
  });
};
(() => {
  const css = /* css */`
    *[aria-hidden="true"] {
      display: none;
    }

    .clipboard_container {
      display: flex;
      padding: 8px;
      align-items: center;
      gap: 5px;
    }

    #copied_notif {
      padding: 0.2em 0.5em;
      color: white;
      font-size: 80%;
      background: black;
      border-radius: 3px;
    }

    button {
      width: 32px;
      height: 32px;
      background: none;
      background-color: rgb(246, 248, 250);
      border: none;
      border-width: 1px;
      border-style: solid;
      border-color: rgb(209, 217, 224);
      border-radius: 6px;
      cursor: pointer;
    }

    button:hover {
      background-color: rgb(239, 242, 245);
    }
  `;
  const html = /* html */`<style>
      ${css}
    </style>
    <div class="clipboard_container">
      <div id="copied_notif" aria-hidden="true">Copied !</div>
      <button id="copy_button">
        <svg
          id="copy_icon"
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="16"
          height="16"
        >
          <path
            d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"
          ></path>
          <path
            d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"
          ></path>
        </svg>
        <svg
          id="copied_icon"
          aria-hidden="true"
          viewBox="0 0 16 16"
          width="16"
          height="16"
        >
          <path
            d="M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z"
          ></path>
        </svg>
      </button>
    </div>`;
  class ClipboardCopy extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({
        mode: "open"
      });
      root.innerHTML = html;
    }
    connectedCallback() {
      const valueToCopy = this.getAttribute("value");
      const shadowRoot = this.shadowRoot;
      const button = shadowRoot.querySelector("button");
      const copyIcon = shadowRoot.querySelector("#copy_icon");
      const copiedIcon = shadowRoot.querySelector("#copied_icon");
      const copiedNotif = shadowRoot.querySelector("#copied_notif");
      copyIcon.removeAttribute("aria-hidden");
      const copy = async () => {
        await addToClipboard(valueToCopy);
        copiedNotif.removeAttribute("aria-hidden");
        copyIcon.setAttribute("aria-hidden", "true");
        copiedIcon.setAttribute("aria-hidden", "false");
        setTimeout(() => {
          copiedNotif.setAttribute("aria-hidden", "true");
          copyIcon.setAttribute("aria-hidden", "false");
          copiedIcon.setAttribute("aria-hidden", "true");
        }, 1500);
      };
      button.onclick = () => {
        copy();
      };
    }
  }
  customElements.define("clipboard-copy", ClipboardCopy);
  const addToClipboard = async text => {
    const type = "text/plain";
    const clipboardItemData = {
      [type]: text
    };
    const clipboardItem = new ClipboardItem(clipboardItemData);
    await window.navigator.clipboard.write([clipboardItem]);
  };
})();
(() => {
  /*
  :host {
      display: block;
  }
  :host code[class*="language-"], :host pre[class*="language-"]{
      margin-top: 0;
  }
  */

  const css = /* css */`
    #code_block {
      position: relative;
    }

    #pre {
      margin-top: 16px;
      margin-right: 0;
      margin-bottom: 16px;
      margin-left: 0;
      padding: 16px;
      font-size: 86%;
      background: #333;
    }
  `;
  const html = /* html */`<style>
      ${css}
    </style>
    <div id="code_block">
      <pre id="pre"><code></code></pre>
      <div
        id="clipboard_copy_container"
        style="position: absolute; right: 0; top: 0"
      >
        <clipboard-copy></clipboard-copy>
      </div>
    </div>
`;
  let loadPromise;
  const loadPrism = () => {
    if (loadPromise) {
      return loadPromise;
    }
    // https://prismjs.com/#basic-usage
    const scriptLoadPromise = new Promise((resolve, reject) => {
      window.Prism = window.Prism || {};
      window.Prism.manual = true;
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/prismjs";
      script.onload = () => {
        resolve(window.Prism);
      };
      script.onerror = error => {
        reject(error);
      };
      document.head.appendChild(script);
    });
    const cssInjectionPromise = (async () => {
      const prismCssUrl = "https://cdn.jsdelivr.net/npm/prismjs/themes/prism-tomorrow.css?inline";
      const response = await window.fetch(prismCssUrl, {
        method: "GET"
      });
      const cssText = await response.text();
      const cssStylesheet = new CSSStyleSheet({
        baseUrl: prismCssUrl
      });
      cssStylesheet.replaceSync(cssText);
      return cssStylesheet;
    })();
    loadPromise = Promise.all([scriptLoadPromise, cssInjectionPromise]);
    return loadPromise;
  };
  class CodeBlock extends HTMLElement {
    constructor() {
      super();
      const root = this.attachShadow({
        mode: "open"
      });
      root.innerHTML = html;
      loadPrism();
    }
    async connectedCallback() {
      const shadowRoot = this.shadowRoot;
      const language = this.getAttribute("lang").toLowerCase();
      const isEscaped = this.hasAttribute("data-escaped");
      const addCopyButton = this.hasAttribute("data-copy-button");
      let code = this.innerHTML.trimStart();
      this.innerHTML = "";
      const codeNode = shadowRoot.querySelector("code");
      codeNode.className = `language-${language}`;
      codeNode.textContent = isEscaped ? unescapeHTML(code) : code;
      if (addCopyButton) {
        const clipboardCopy = shadowRoot.querySelector("clipboard-copy");
        clipboardCopy.setAttribute("value", isEscaped ? unescapeHTML(code) : code);
      }
      const [Prism, prismCssStyleSheet] = await loadPrism();
      shadowRoot.adoptedStyleSheets.push(prismCssStyleSheet);
      Prism.highlightAllUnder(shadowRoot);
    }
  }
  customElements.define("code-block", CodeBlock);
  const escape = document.createElement("textarea");
  function unescapeHTML(html) {
    escape.innerHTML = html;
    return escape.textContent;
  }
})();

const Code = props => {
  if (props.language) {
    return jsx(CodeBlock, {
      ...props
    });
  }
  if (props.box) {
    return jsx(CodeBox, {
      ...props
    });
  }
  return jsx(Text, {
    as: "code",
    ...props
  });
};
const CodeBox = ({
  children,
  ...props
}) => {
  return jsx(Text, {
    as: "pre",
    ...props,
    children: jsx(Text, {
      as: "code",
      children: children
    })
  });
};

const Paragraph = props => {
  return jsx(Text, {
    marginTop: "md",
    ...props,
    as: "p",
    ...props
  });
};

const Image = props => {
  return jsx(Box, {
    ...props,
    as: "img"
  });
};

const Svg = props => {
  return jsx(Box, {
    ...props,
    as: "svg"
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .svg_mask_content * {
    color: black !important;
    opacity: 1 !important;
    fill: black !important;
    fill-opacity: 1 !important;
    stroke: black !important;
    stroke-opacity: 1 !important;
  }
`;
const SVGMaskOverlay = ({
  viewBox,
  children
}) => {
  if (!Array.isArray(children)) {
    return children;
  }
  if (children.length === 1) {
    return children[0];
  }
  if (!viewBox) {
    console.error("SVGComposition requires an explicit viewBox");
    return null;
  }

  // First SVG is the base, all others are overlays
  const [baseSvg, ...overlaySvgs] = children;

  // Generate unique ID for this instance
  const instanceId = `svgmo-${Math.random().toString(36).slice(2, 9)}`;

  // Create nested masked elements
  let maskedElement = baseSvg;

  // Apply each mask in sequence
  overlaySvgs.forEach((overlaySvg, index) => {
    const maskId = `mask-${instanceId}-${index}`;
    maskedElement = jsx("g", {
      mask: `url(#${maskId})`,
      children: maskedElement
    });
  });
  return jsxs("svg", {
    viewBox: viewBox,
    width: "100%",
    height: "100%",
    children: [jsx("defs", {
      children: overlaySvgs.map((overlaySvg, index) => {
        const maskId = `mask-${instanceId}-${index}`;

        // IMPORTANT: clone the overlay SVG exactly as is, just add the mask class
        return jsxs("mask", {
          id: maskId,
          children: [jsx("rect", {
            width: "100%",
            height: "100%",
            fill: "white"
          }), cloneElement(overlaySvg, {
            className: "svg_mask_content" // Apply styling to make it black
          })]
        }, maskId);
      })
    }), maskedElement, overlaySvgs]
  });
};

installImportMetaCss(import.meta);const rightArrowPath = "M680-480L360-160l-80-80 240-240-240-240 80-80 320 320z";
const downArrowPath = "M480-280L160-600l80-80 240 240 240-240 80 80-320 320z";
import.meta.css = /* css */`
  .summary_marker {
    width: 1em;
    height: 1em;
    line-height: 1em;
  }
  .summary_marker_svg .arrow {
    animation-duration: 0.3s;
    animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
    animation-fill-mode: forwards;
  }
  .summary_marker_svg .arrow[data-animation-target="down"] {
    animation-name: morph-to-down;
  }
  @keyframes morph-to-down {
    from {
      d: path("${rightArrowPath}");
    }
    to {
      d: path("${downArrowPath}");
    }
  }
  .summary_marker_svg .arrow[data-animation-target="right"] {
    animation-name: morph-to-right;
  }
  @keyframes morph-to-right {
    from {
      d: path("${downArrowPath}");
    }
    to {
      d: path("${rightArrowPath}");
    }
  }

  .summary_marker_svg .foreground_circle {
    stroke-dasharray: 503 1507; /* ~25% of circle perimeter */
    stroke-dashoffset: 0;
    animation: progress-around-circle 1.5s linear infinite;
  }
  @keyframes progress-around-circle {
    0% {
      stroke-dashoffset: 0;
    }
    100% {
      stroke-dashoffset: -2010;
    }
  }

  /* fading and scaling */
  .summary_marker_svg .arrow {
    opacity: 1;
    transition: opacity 0.3s ease-in-out;
  }
  .summary_marker_svg .loading_container {
    transform: scale(0.3);
    transition: transform 0.3s linear;
  }
  .summary_marker_svg .background_circle,
  .summary_marker_svg .foreground_circle {
    opacity: 0;
    transition: opacity 0.3s ease-in-out;
  }
  .summary_marker_svg[data-loading] .arrow {
    opacity: 0;
  }
  .summary_marker_svg[data-loading] .loading_container {
    transform: scale(1);
  }
  .summary_marker_svg[data-loading] .background_circle {
    opacity: 0.2;
  }
  .summary_marker_svg[data-loading] .foreground_circle {
    opacity: 1;
  }
`;
const SummaryMarker = ({
  open,
  loading
}) => {
  const showLoading = useDebounceTrue(loading, 300);
  const mountedRef = useRef(false);
  const prevOpenRef = useRef(open);
  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const shouldAnimate = mountedRef.current && prevOpenRef.current !== open;
  prevOpenRef.current = open;
  return jsx("span", {
    className: "summary_marker",
    children: jsxs("svg", {
      className: "summary_marker_svg",
      viewBox: "0 -960 960 960",
      xmlns: "http://www.w3.org/2000/svg",
      "data-loading": open ? showLoading || undefined : undefined,
      children: [jsxs("g", {
        className: "loading_container",
        "transform-origin": "480px -480px",
        children: [jsx("circle", {
          className: "background_circle",
          cx: "480",
          cy: "-480",
          r: "320",
          stroke: "currentColor",
          fill: "none",
          strokeWidth: "60",
          opacity: "0.2"
        }), jsx("circle", {
          className: "foreground_circle",
          cx: "480",
          cy: "-480",
          r: "320",
          stroke: "currentColor",
          fill: "none",
          strokeWidth: "60",
          strokeLinecap: "round",
          strokeDasharray: "503 1507"
        })]
      }), jsx("g", {
        className: "arrow_container",
        "transform-origin": "480px -480px",
        children: jsx("path", {
          className: "arrow",
          fill: "currentColor",
          "data-animation-target": shouldAnimate ? open ? "down" : "right" : undefined,
          d: open ? downArrowPath : rightArrowPath
        })
      })]
    })
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_details {
    position: relative;
    z-index: 1;
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
  }

  .navi_details > summary {
    display: flex;
    flex-shrink: 0;
    flex-direction: column;
    cursor: pointer;
    user-select: none;
  }
  .summary_body {
    display: flex;
    width: 100%;
    flex-direction: row;
    align-items: center;
    gap: 0.2em;
  }
  .summary_label {
    display: flex;
    padding-right: 10px;
    flex: 1;
    align-items: center;
    gap: 0.2em;
  }

  .navi_details > summary:focus {
    z-index: 1;
  }
`;
const Details = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref);
});
const DetailsBasic = forwardRef((props, ref) => {
  const {
    id,
    label = "Summary",
    open,
    loading,
    className,
    focusGroup,
    focusGroupDirection,
    arrowKeyShortcuts = true,
    openKeyShortcut = "ArrowRight",
    closeKeyShortcut = "ArrowLeft",
    onToggle,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState$1(id);
  const [innerOpen, innerOpenSetter] = useState(open || navState);
  useFocusGroup(innerRef, {
    enabled: focusGroup,
    name: typeof focusGroup === "string" ? focusGroup : undefined,
    direction: focusGroupDirection
  });

  /**
   * Browser will dispatch "toggle" event even if we set open={true}
   * When rendering the component for the first time
   * We have to ensure the initial "toggle" event is ignored.
   *
   * If we don't do that code will think the details has changed and run logic accordingly
   * For example it will try to navigate to the current url while we are already there
   *
   * See:
   * - https://techblog.thescore.com/2024/10/08/why-we-decided-to-change-how-the-details-element-works/
   * - https://github.com/whatwg/html/issues/4500
   * - https://stackoverflow.com/questions/58942600/react-html-details-toggles-uncontrollably-when-starts-open
   *
   */

  const summaryRef = useRef(null);
  useKeyboardShortcuts(innerRef, [{
    key: openKeyShortcut,
    enabled: arrowKeyShortcuts,
    when: e => document.activeElement === summaryRef.current &&
    // avoid handling openKeyShortcut twice when keydown occurs inside nested details
    !e.defaultPrevented,
    action: e => {
      const details = innerRef.current;
      if (!details.open) {
        e.preventDefault();
        details.open = true;
        return;
      }
      const summary = summaryRef.current;
      const firstFocusableElementInDetails = findAfter(summary, elementIsFocusable, {
        root: details
      });
      if (!firstFocusableElementInDetails) {
        return;
      }
      e.preventDefault();
      firstFocusableElementInDetails.focus();
    }
  }, {
    key: closeKeyShortcut,
    enabled: arrowKeyShortcuts,
    when: () => {
      const details = innerRef.current;
      return details.open;
    },
    action: e => {
      const details = innerRef.current;
      const summary = summaryRef.current;
      if (document.activeElement === summary) {
        e.preventDefault();
        summary.focus();
        details.open = false;
      } else {
        e.preventDefault();
        summary.focus();
      }
    }
  }]);
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
  }, []);
  return jsxs("details", {
    ...rest,
    ref: innerRef,
    id: id,
    className: ["navi_details", ...(className ? className.split(" ") : [])].join(" "),
    onToggle: e => {
      const isOpen = e.newState === "open";
      if (mountedRef.current) {
        if (isOpen) {
          innerOpenSetter(true);
          setNavState(true);
        } else {
          innerOpenSetter(false);
          setNavState(undefined);
        }
      }
      onToggle?.(e);
    },
    open: innerOpen,
    children: [jsx("summary", {
      ref: summaryRef,
      children: jsxs("div", {
        className: "summary_body",
        children: [jsx(SummaryMarker, {
          open: innerOpen,
          loading: loading
        }), jsx("div", {
          className: "summary_label",
          children: label
        })]
      })
    }), children]
  });
});
forwardRef((props, ref) => {
  const {
    action,
    loading,
    onToggle,
    onActionPrevented,
    onActionStart,
    onActionError,
    onActionEnd,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const effectiveAction = useAction(action);
  const {
    loading: actionLoading
  } = useActionStatus(effectiveAction);
  const executeAction = useExecuteAction(innerRef, {
    // the error will be displayed by actionRenderer inside <details>
    errorEffect: "none"
  });
  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onAction: e => {
      executeAction(e);
    },
    onStart: onActionStart,
    onError: onActionError,
    onEnd: onActionEnd
  });
  return jsx(DetailsBasic, {
    ...rest,
    ref: innerRef,
    loading: loading || actionLoading,
    onToggle: toggleEvent => {
      const isOpen = toggleEvent.newState === "open";
      if (isOpen) {
        requestAction(toggleEvent.target, effectiveAction, {
          event: toggleEvent,
          method: "run"
        });
      } else {
        effectiveAction.abort();
      }
      onToggle?.(toggleEvent);
    },
    children: jsx(ActionRenderer, {
      action: effectiveAction,
      children: children
    })
  });
});

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_dialog_layout {
      --layout-margin: 30px;
      --layout-padding: 20px;
      --layout-background: white;
      --layout-border-width: 2px;
      --layout-border-color: lightgrey;
      --layout-border-radius: 10px;
      --layout-min-width: 300px;
      --layout-min-height: auto;
    }
  }
  .navi_dialog_layout {
    padding-top: var(
      --layout-margin-top,
      var(--layout-margin-y, var(--layout-margin))
    );
    padding-right: var(
      --layout-margin-right,
      var(--layout-margin-x, var(--layout-margin))
    );
    padding-bottom: var(
      --layout-margin-bottom,
      var(--layout-margin-y, var(--layout-margin))
    );
    padding-left: var(
      --layout-margin-left,
      var(--layout-margin-x, var(--layout-margin))
    );
  }

  .navi_dialog_content {
    min-width: var(--layout-min-width);
    min-height: var(--layout-min-height);
    padding-top: var(
      --layout-padding-top,
      var(--layout-padding-y, var(--layout-padding))
    );
    padding-right: var(
      --layout-padding-right,
      var(--layout-padding-x, var(--layout-padding))
    );
    padding-bottom: var(
      --layout-padding-bottom,
      var(--layout-padding-y, var(--layout-padding))
    );
    padding-left: var(
      --layout-padding-left,
      var(--layout-padding-x, var(--layout-padding))
    );
    background: var(--layout-background);
    background-color: var(--layout-background-color, var(--layout-background));
    border-width: var(--layout-border-width);
    border-style: solid;
    border-color: var(--layout-border-color);
    border-radius: var(--layout-border-radius);
  }
`;
const DialogLayoutStyleCSSVars = {
  margin: "--layout-margin",
  marginTop: "--layout-margin-top",
  marginBottom: "--layout-margin-bottom",
  marginLeft: "--layout-margin-left",
  marginRight: "--layout-margin-right",
  borderRadius: "--layout-border-radius",
  borderWidth: "--layout-border-width",
  borderColor: "--layout-border-color",
  background: "--layout-background",
  backgroundColor: "--layout-background-color",
  padding: "--layout-padding",
  paddingTop: "--layout-padding-top",
  paddingBottom: "--layout-padding-bottom",
  paddingLeft: "--layout-padding-left",
  paddingRight: "--layout-padding-right",
  minWidth: "--layout-min-width",
  minHeight: "--layout-min-height"
};
const DialogLayout = ({
  children,
  alignX = "center",
  alignY = "center",
  ...props
}) => {
  return jsx(Box, {
    baseClassName: "navi_dialog_layout",
    styleCSSVars: DialogLayoutStyleCSSVars,
    visualSelector: ".navi_dialog_content",
    ...props,
    children: jsx(Box, {
      row: true,
      className: "navi_dialog_content",
      alignX: alignX,
      alignY: alignY,
      children: children
    })
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_separator {
      --size: 1px;
      --color: #e4e4e7;
      --spacing: 0.5em;
      --spacing-start: 0.5em;
      --spacing-end: 0.5em;
    }
  }

  .navi_separator {
    width: 100%;
    height: var(--size);
    margin-top: var(--spacing-start, var(--spacing));
    margin-bottom: var(--spacing-end, var(--spacing));
    flex-shrink: 0;
    background: var(--color);
    border: none;

    &[data-vertical] {
      display: inline-block;

      width: var(--size);
      height: 1lh;
      margin-top: 0;
      margin-right: var(--spacing-end, var(--spacing));
      margin-bottom: 0;
      margin-left: var(--spacing-start, var(--spacing));
      vertical-align: bottom;
    }
  }
`;
const SeparatorStyleCSSVars = {
  color: "--color"
};
const Separator = ({
  vertical,
  ...props
}) => {
  return jsx(Box, {
    as: vertical ? "span" : "hr",
    ...props,
    "data-vertical": vertical ? "" : undefined,
    baseClassName: "navi_separator",
    styleCSSVars: SeparatorStyleCSSVars
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_viewport_layout {
      --layout-padding: 40px;
      --layout-background: white;
    }
  }

  .navi_viewport_layout {
    padding-top: var(
      --layout-padding-top,
      var(--layout-padding-y, var(--layout-padding))
    );
    padding-right: var(
      --layout-padding-right,
      var(--layout-padding-x, var(--layout-padding))
    );
    padding-bottom: var(
      --layout-padding-bottom,
      var(--layout-padding-y, var(--layout-padding))
    );
    padding-left: var(
      --layout-padding-left,
      var(--layout-padding-x, var(--layout-padding))
    );
    background: var(--layout-background);
  }
`;
const ViewportLayoutStyleCSSVars = {
  padding: "--layout-padding",
  paddingTop: "--layout-padding-top",
  paddingBottom: "--layout-padding-bottom",
  paddingLeft: "--layout-padding-left",
  paddingRight: "--layout-padding-right",
  background: "--layout-background"
};
const ViewportLayout = props => {
  return jsx(Box, {
    row: true,
    width: "100%",
    height: "100%",
    ...props,
    className: "navi_viewport_layout",
    styleCSSVars: ViewportLayoutStyleCSSVars
  });
};

/*
 * - Usage
 * useEffect(() => {
 *   // here you want to know what has changed, causing useEffect to be called
 * }, [name, value])
 *
 * const diff = useDependenciesDiff({ name, value })
 * useEffect(() => {
 *   console.log('useEffect called because', diff)
 * }, [name, value])
 */


const useDependenciesDiff = (inputs) => {
  const oldInputsRef = useRef(inputs);
  const inputValuesArray = Object.values(inputs);
  const inputKeysArray = Object.keys(inputs);
  const diffRef = useRef();
  useMemo(() => {
    const oldInputs = oldInputsRef.current;
    const diff = {};
    for (const key of inputKeysArray) {
      const previous = oldInputs[key];
      const current = inputs[key];
      if (previous !== current) {
        diff[key] = { previous, current };
      }
    }
    diffRef.current = diff;
    oldInputsRef.current = inputs;
  }, inputValuesArray);

  return diffRef.current;
};

const CheckSvg = () => jsx("svg", {
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  children: jsx("path", {
    d: "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z",
    fill: "currentColor"
  })
});

const ConstructionSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 15 15",
    children: jsx("path", {
      d: "M13.5,12h-1.8L8.2,1.5C8,0.8,7,0.8,6.8,1.5L3.3,12H1.5C1.2,12,1,12.2,1,12.5v1C1,13.8,1.2,14,1.5,14h12 c0.3,0,0.5-0.2,0.5-0.5v-1C14,12.2,13.8,12,13.5,12z M7,4H8l0.7,2H6.4L7,4z M5.7,8h3.6l0.7,2H5L5.7,8z"
    })
  });
};

const ExclamationSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 125 300",
    xmlns: "http://www.w3.org/2000/svg",
    children: jsx("path", {
      fill: "currentColor",
      d: "m25,1 8,196h59l8-196zm37,224a37,37 0 1,0 2,0z"
    })
  });
};

const EyeClosedSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 24 24",
    xmlns: "http://www.w3.org/2000/svg",
    children: jsx("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M22.2954 6.31083C22.6761 6.474 22.8524 6.91491 22.6893 7.29563L21.9999 7.00019C22.6893 7.29563 22.6894 7.29546 22.6893 7.29563L22.6886 7.29731L22.6875 7.2998L22.6843 7.30716L22.6736 7.33123C22.6646 7.35137 22.6518 7.37958 22.6352 7.41527C22.6019 7.48662 22.5533 7.58794 22.4888 7.71435C22.3599 7.967 22.1675 8.32087 21.9084 8.73666C21.4828 9.4197 20.8724 10.2778 20.0619 11.1304L21.0303 12.0987C21.3231 12.3916 21.3231 12.8665 21.0303 13.1594C20.7374 13.4523 20.2625 13.4523 19.9696 13.1594L18.969 12.1588C18.3093 12.7115 17.5528 13.2302 16.695 13.6564L17.6286 15.0912C17.8545 15.4383 17.7562 15.9029 17.409 16.1288C17.0618 16.3547 16.5972 16.2564 16.3713 15.9092L15.2821 14.2353C14.5028 14.4898 13.659 14.6628 12.7499 14.7248V16.5002C12.7499 16.9144 12.4141 17.2502 11.9999 17.2502C11.5857 17.2502 11.2499 16.9144 11.2499 16.5002V14.7248C10.3689 14.6647 9.54909 14.5004 8.78982 14.2586L7.71575 15.9093C7.48984 16.2565 7.02526 16.3548 6.67807 16.1289C6.33089 15.903 6.23257 15.4384 6.45847 15.0912L7.37089 13.689C6.5065 13.2668 5.74381 12.7504 5.07842 12.1984L4.11744 13.1594C3.82455 13.4523 3.34968 13.4523 3.05678 13.1594C2.76389 12.8665 2.76389 12.3917 3.05678 12.0988L3.98055 11.175C3.15599 10.3153 2.53525 9.44675 2.10277 8.75486C1.83984 8.33423 1.6446 7.97584 1.51388 7.71988C1.44848 7.59182 1.3991 7.48914 1.36537 7.41683C1.3485 7.38067 1.33553 7.35207 1.32641 7.33167L1.31562 7.30729L1.31238 7.29984L1.31129 7.29733L1.31088 7.29638C1.31081 7.2962 1.31056 7.29563 1.99992 7.00019L1.31088 7.29638C1.14772 6.91565 1.32376 6.474 1.70448 6.31083C2.08489 6.1478 2.52539 6.32374 2.68888 6.70381C2.68882 6.70368 2.68894 6.70394 2.68888 6.70381L2.68983 6.706L2.69591 6.71972C2.7018 6.73291 2.7114 6.7541 2.72472 6.78267C2.75139 6.83983 2.79296 6.92644 2.84976 7.03767C2.96345 7.26029 3.13762 7.58046 3.37472 7.95979C3.85033 8.72067 4.57157 9.70728 5.55561 10.6218C6.42151 11.4265 7.48259 12.1678 8.75165 12.656C9.70614 13.0232 10.7854 13.2502 11.9999 13.2502C13.2416 13.2502 14.342 13.013 15.3124 12.631C16.5738 12.1345 17.6277 11.3884 18.4866 10.5822C19.4562 9.67216 20.1668 8.69535 20.6354 7.9434C20.869 7.5685 21.0405 7.25246 21.1525 7.03286C21.2085 6.92315 21.2494 6.83776 21.2757 6.78144C21.2888 6.75328 21.2983 6.73242 21.3041 6.71943L21.31 6.70595L21.3106 6.70475C21.3105 6.70485 21.3106 6.70466 21.3106 6.70475M22.2954 6.31083C21.9147 6.14771 21.4738 6.32423 21.3106 6.70475L22.2954 6.31083ZM2.68888 6.70381C2.68882 6.70368 2.68894 6.70394 2.68888 6.70381V6.70381Z",
      fill: "currentColor"
    })
  });
};

const EyeSvg = () => {
  return jsxs("svg", {
    viewBox: "0 0 24 24",
    children: [jsx("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M12 8.25C9.92893 8.25 8.25 9.92893 8.25 12C8.25 14.0711 9.92893 15.75 12 15.75C14.0711 15.75 15.75 14.0711 15.75 12C15.75 9.92893 14.0711 8.25 12 8.25ZM9.75 12C9.75 10.7574 10.7574 9.75 12 9.75C13.2426 9.75 14.25 10.7574 14.25 12C14.25 13.2426 13.2426 14.25 12 14.25C10.7574 14.25 9.75 13.2426 9.75 12Z",
      fill: "currentColor"
    }), jsx("path", {
      "fill-rule": "evenodd",
      "clip-rule": "evenodd",
      d: "M12 3.25C7.48587 3.25 4.44529 5.9542 2.68057 8.24686L2.64874 8.2882C2.24964 8.80653 1.88206 9.28392 1.63269 9.8484C1.36564 10.4529 1.25 11.1117 1.25 12C1.25 12.8883 1.36564 13.5471 1.63269 14.1516C1.88206 14.7161 2.24964 15.1935 2.64875 15.7118L2.68057 15.7531C4.44529 18.0458 7.48587 20.75 12 20.75C16.5141 20.75 19.5547 18.0458 21.3194 15.7531L21.3512 15.7118C21.7504 15.1935 22.1179 14.7161 22.3673 14.1516C22.6344 13.5471 22.75 12.8883 22.75 12C22.75 11.1117 22.6344 10.4529 22.3673 9.8484C22.1179 9.28391 21.7504 8.80652 21.3512 8.28818L21.3194 8.24686C19.5547 5.9542 16.5141 3.25 12 3.25ZM3.86922 9.1618C5.49864 7.04492 8.15036 4.75 12 4.75C15.8496 4.75 18.5014 7.04492 20.1308 9.1618C20.5694 9.73159 20.8263 10.0721 20.9952 10.4545C21.1532 10.812 21.25 11.2489 21.25 12C21.25 12.7511 21.1532 13.188 20.9952 13.5455C20.8263 13.9279 20.5694 14.2684 20.1308 14.8382C18.5014 16.9551 15.8496 19.25 12 19.25C8.15036 19.25 5.49864 16.9551 3.86922 14.8382C3.43064 14.2684 3.17374 13.9279 3.00476 13.5455C2.84684 13.188 2.75 12.7511 2.75 12C2.75 11.2489 2.84684 10.812 3.00476 10.4545C3.17374 10.0721 3.43063 9.73159 3.86922 9.1618Z",
      fill: "currentColor"
    })]
  });
};

const HeartSvg = () => jsx("svg", {
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  children: jsx("path", {
    d: "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z",
    fill: "currentColor"
  })
});

const HomeSvg = () => jsx("svg", {
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  children: jsx("path", {
    d: "M12 3l8 6v11h-5v-6h-6v6H4V9l8-6z",
    fill: "currentColor"
  })
});

const SettingsSvg = () => jsx("svg", {
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  children: jsx("path", {
    d: "M12 15.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zM19.43 12.98c.04-.32.07-.64.07-.98 0-.34-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11.02c-.04.32-.07.64-.07.98 0 .34.03.66.07.98L2.46 14.63c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65z",
    fill: "currentColor"
  })
});

const StarSvg = () => jsx("svg", {
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  children: jsx("path", {
    d: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    fill: "currentColor"
  })
});

const UserSvg = () => jsx("svg", {
  viewBox: "0 0 24 24",
  xmlns: "http://www.w3.org/2000/svg",
  children: jsx("path", {
    d: "M12 2C9.8 2 8 3.8 8 6s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zm0 12c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4z",
    fill: "currentColor"
  })
});

export { ActionRenderer, ActiveKeyboardShortcuts, Address, BadgeCount, Box, Button, ButtonCopyToClipboard, Caption, CheckSvg, Checkbox, CheckboxList, Code, Col, Colgroup, ConstructionSvg, Details, DialogLayout, Editable, ErrorBoundaryContext, ExclamationSvg, EyeClosedSvg, EyeSvg, Form, Group, HeartSvg, HomeSvg, Icon, Image, Input, Label, Link, LinkAnchorSvg, LinkBlankTargetSvg, MessageBox, Paragraph, Radio, RadioList, Route, RouteLink, Routes, RowNumberCol, RowNumberTableCell, SINGLE_SPACE_CONSTRAINT, SVGMaskOverlay, SearchSvg, Select, SelectionContext, Separator, SettingsSvg, StarSvg, SummaryMarker, Svg, Tab, TabList, Table, TableCell, Tbody, Text, Thead, Title, Tr, UITransition, UserSvg, ViewportLayout, actionIntegratedVia, addCustomMessage, clearAllRoutes, compareTwoJsValues, createAction, createAvailableConstraint, createRequestCanceller, createSelectionKeyboardShortcuts, enableDebugActions, enableDebugOnDocumentLoading, forwardActionRequested, installCustomConstraintValidation, isCellSelected, isColumnSelected, isRowSelected, localStorageSignal, navBack, navForward, navTo, openCallout, rawUrlPart, reload, removeCustomMessage, requestAction, rerunActions, resource, setBaseUrl, setupRoutes, stateSignal, stopLoad, stringifyTableSelectionValue, updateActions, useActionData, useActionStatus, useArraySignalMembership, useCalloutClose, useCellsAndColumns, useConstraintValidityState, useDependenciesDiff, useDocumentResource, useDocumentState, useDocumentUrl, useEditionController, useFocusGroup, useKeyboardShortcuts, useMatchingRouteInfo, useNavState$1 as useNavState, useRouteStatus, useRunOnMount, useSelectableElement, useSelectionController, useSignalSync, useStateArray, useTitleLevel, useUrlSearchParam, valueInLocalStorage };
//# sourceMappingURL=jsenv_navi.js.map

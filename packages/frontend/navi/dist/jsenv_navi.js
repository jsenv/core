import { createIterableWeakSet, createPubSub, createValueEffect, createStyleController, getVisuallyVisibleInfo, getFirstVisuallyVisibleAncestor, allowWheelThrough, visibleRectEffect, pickPositionRelativeTo, getBorderSizes, getPaddingSizes, activeElementSignal, canInterceptKeys, initFocusGroup, findAfter, elementIsFocusable, resolveCSSSize, mergeStyles, pickLightOrDark, findBefore, initUITransition, dragAfterThreshold, getScrollContainer, stickyAsRelativeCoords, createDragToMoveGestureController, getDropTargetInfo, setStyles, useActiveElement } from "@jsenv/dom";
import { prefixFirstAndIndentRemainingLines } from "@jsenv/humanize";
import { effect, signal, computed, batch, useSignal } from "@preact/signals";
import { useEffect, useRef, useCallback, useContext, useState, useLayoutEffect, useErrorBoundary, useImperativeHandle, useMemo, useId } from "preact/hooks";
import { createContext, createRef, toChildArray, cloneElement } from "preact";
import { jsxs, jsx, Fragment } from "preact/jsx-runtime";
import { forwardRef, createPortal } from "preact/compat";

const installImportMetaCss = (importMeta) => {
  const stylesheet = new CSSStyleSheet({ baseUrl: importMeta.url });

  let called = false;
  // eslint-disable-next-line accessor-pairs
  Object.defineProperty(importMeta, "css", {
    configurable: true,
    set(value) {
      if (called) {
        throw new Error("import.meta.css setter can only be called once");
      }
      called = true;
      stylesheet.replaceSync(value);
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        stylesheet,
      ];
    },
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */ `
  @layer navi {
    :root {
      --navi-background-color-readonly: #d3d3d3;
      --navi-color-readonly: grey;
      --navi-background-color-disabled: #d3d3d3;
      --navi-color-disabled: #eeeeee;

      --navi-info-color: #2196f3;
      --navi-warning-color: #ff9800;
      --navi-error-color: #f44336;
    }
  }
`;

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

const SYMBOL_OBJECT_SIGNAL = Symbol.for("navi_object_signal");

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
 * @param {Set} seenSet - Internal cycle detection set (automatically managed)
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

const compareTwoJsValues = (a, b, seenSet = new Set()) => {
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
    let i = 0;
    while (i < a.length) {
      const aValue = a[i];
      const bValue = b[i];
      if (!compareTwoJsValues(aValue, bValue, seenSet)) {
        return false;
      }
      i++;
    }
    return true;
  }
  // compare objects
  const aIdentity = a[SYMBOL_IDENTITY];
  const bIdentity = b[SYMBOL_IDENTITY];
  if (aIdentity === bIdentity && SYMBOL_IDENTITY in a && SYMBOL_IDENTITY in b) {
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
    if (!compareTwoJsValues(aValue, bValue, seenSet)) {
      return false;
    }
  }
  return true;
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

let DEBUG$2 = false;
const enableDebugActions = () => {
  DEBUG$2 = true;
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
      if (DEBUG$2) {
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
        if (DEBUG$2) {
          console.debug(
            `"${action}": prerun protection expired after ${PROTECTION_DURATION}ms`,
          );
        }
      }, PROTECTION_DURATION);

      protectedActionMap.set(action, { timeoutId, timestamp });

      if (DEBUG$2) {
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

  if (DEBUG$2) {
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
  if (DEBUG$2) {
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
  if (DEBUG$2) {
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

const NO_PARAMS$1 = {};
const initialParamsDefault = NO_PARAMS$1;

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
      if (DEBUG$2) {
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
          if (DEBUG$2) {
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
          if (DEBUG$2) {
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
          if (DEBUG$2) {
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
        if (DEBUG$2) {
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

    if (params === NO_PARAMS$1) {
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
  if (params === NO_PARAMS$1) {
    return `${name}({})`;
  }
  // Use stringifyForDisplay with asFunctionArgs option for the entire args array
  const argsString = stringifyForDisplay([params], 3, 0, {
    asFunctionArgs: true,
  });
  return `${name}${argsString}`;
};

const useRunOnMount = (action, Component) => {
  useEffect(() => {
    action.run({
      reason: `<${Component.name} /> mounted`,
    });
  }, []);
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

/**
 * Shows a callout attached to the specified element
 * @param {string} message - HTML content for the callout
 * @param {Object} options - Configuration options
 * @param {HTMLElement} [options.anchorElement] - Element the callout should follow. If not provided or too big, callout will be centered in viewport
 * @param {string} [options.level="warning"] - Callout level: "info" | "warning" | "error"
 * @param {Function} [options.onClose] - Callback when callout is closed
 * @param {boolean} [options.closeOnClickOutside] - Whether to close on outside clicks (defaults to true for "info" level)
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
    // Level determines visual styling and behavior:
    // "info" - polite announcement (e.g., "This element cannot be modified")
    // "warning" - expected failure requiring user action (e.g., "Field is required")
    // "error" - unexpected failure, may not be actionable (e.g., "Server error")
    level = "warning",
    onClose,
    closeOnClickOutside = level === "info",
    showErrorStack,
    debug = false,
  } = {},
) => {
  const callout = {
    opened: true,
    close: null,
    level: undefined,

    update: null,
    updatePosition: null,

    element: null,
  };

  if (debug) {
    console.debug("open callout", {
      anchorElement,
      message,
      level,
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

  const [updateLevel, addLevelEffect, cleanupLevelEffects] =
    createValueEffect(undefined);
  addTeardown(cleanupLevelEffects);

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
    if (options.level && options.level !== callout.level) {
      callout.level = level;
      updateLevel(level);
    }

    if (options.closeOnClickOutside) {
      closeOnClickOutside = options.closeOnClickOutside;
    }

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
  Object.assign(callout, {
    element: calloutElement,
    update,
    close,
  });
  addLevelEffect(() => {
    calloutElement.setAttribute("data-level", level);
    if (level === "info") {
      calloutElement.setAttribute("role", "status");
    } else {
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

    addLevelEffect(() => {
      anchorElement.style.setProperty(
        "--callout-color",
        `var(--navi-${level}-color)`,
      );
      return () => {
        anchorElement.style.removeProperty("--callout-color");
      };
    });
    addLevelEffect((level) => {
      if (level === "info") {
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
        if (level === "error") {
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

  update(message, { level });

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

import.meta.css = /* css */ `
  @layer navi {
    :root {
      --navi-callout-background-color: white;
      --navi-callout-padding: 8px;
    }

    .navi_callout {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      display: block;
      height: auto;
      opacity: 0;
      /* will be positioned with transform: translate */
      transition: opacity 0.2s ease-in-out;
      overflow: visible;
    }

    .navi_callout_frame {
      position: absolute;
      filter: drop-shadow(4px 4px 3px rgba(0, 0, 0, 0.2));
      pointer-events: none;
    }
    .navi_callout[data-level="info"] .navi_callout_border {
      fill: var(--navi-info-color);
    }
    .navi_callout[data-level="warning"] .navi_callout_border {
      fill: var(--navi-warning-color);
    }
    .navi_callout[data-level="error"] .navi_callout_border {
      fill: var(--navi-error-color);
    }
    .navi_callout_frame svg {
      position: absolute;
      inset: 0;
      overflow: visible;
    }
    .navi_callout_background {
      fill: var(--navi-callout-background-color);
    }

    .navi_callout_box {
      position: relative;
      border-style: solid;
      border-color: transparent;
    }
    .navi_callout_body {
      position: relative;
      display: flex;
      max-width: 47vw;
      padding: var(--navi-callout-padding);
      flex-direction: row;
      gap: 10px;
    }
    .navi_callout_icon {
      display: flex;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      align-items: center;
      align-self: flex-start;
      justify-content: center;
      border-radius: 2px;
    }
    .navi_callout_icon_svg {
      width: 16px;
      height: 12px;
      color: white;
    }
    .navi_callout[data-level="info"] .navi_callout_icon {
      background-color: var(--navi-info-color);
    }
    .navi_callout[data-level="warning"] .navi_callout_icon {
      background-color: var(--navi-warning-color);
    }
    .navi_callout[data-level="error"] .navi_callout_icon {
      background-color: var(--navi-error-color);
    }
    .navi_callout_message {
      min-width: 0;
      align-self: center;
      word-break: break-word;
      overflow-wrap: anywhere;
    }
    .navi_callout_message iframe {
      display: block;
      margin: 0;
    }
    .navi_callout_close_button_column {
      display: flex;
      height: 22px;
    }
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
    }
    .navi_callout_close_button:hover {
      background: rgba(0, 0, 0, 0.1);
    }
    .navi_callout_close_button_svg {
      width: 100%;
      height: 100%;
    }
    .navi_callout_error_stack {
      max-height: 200px;
      overflow: auto;
    }
  }
`;

// HTML template for the callout
const calloutTemplate = /* html */ `
  <div class="navi_callout">
    <div class="navi_callout_box">
      <div class="navi_callout_frame"></div>
      <div class="navi_callout_body">
        <div class="navi_callout_icon">
          <svg
            class="navi_callout_icon_svg"
            viewBox="0 0 125 300"
            xmlns="http://www.w3.org/2000/svg"
          >
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
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation
 */

// this constraint is not really a native constraint and browser just not let this happen at all
// in our case it's just here in case some code is wrongly calling "requestAction" or "checkValidity" on a disabled element
const DISABLED_CONSTRAINT = {
  name: "disabled",
  check: (element) => {
    if (element.disabled) {
      return `Ce champ est désactivé.`;
    }
    return null;
  },
};

const REQUIRED_CONSTRAINT = {
  name: "required",
  check: (element, { registerChange }) => {
    if (!element.required) {
      return null;
    }
    const requiredMessage = element.getAttribute("data-required-message");

    if (element.type === "checkbox") {
      if (!element.checked) {
        return requiredMessage || `Veuillez cocher cette case.`;
      }
      return null;
    }
    if (element.type === "radio") {
      // For radio buttons, check if any radio with the same name is selected
      const name = element.name;
      if (!name) {
        // If no name, check just this radio
        if (!element.checked) {
          return requiredMessage || `Veuillez sélectionner une option.`;
        }
        return null;
      }

      const closestFieldset = element.closest("fieldset");
      const fieldsetRequiredMessage = closestFieldset
        ? closestFieldset.getAttribute("data-required-message")
        : null;

      // Find the container (form or closest fieldset)
      const container = element.form || closestFieldset || document;
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
        message:
          requiredMessage ||
          fieldsetRequiredMessage ||
          `Veuillez sélectionner une option.`,
        target: closestFieldset
          ? closestFieldset.querySelector("legend")
          : undefined,
      };
    }
    if (element.value) {
      return null;
    }
    if (requiredMessage) {
      return requiredMessage;
    }
    if (element.type === "password") {
      return element.hasAttribute("data-same-as")
        ? `Veuillez confirmer le mot de passe.`
        : `Veuillez saisir un mot de passe.`;
    }
    if (element.type === "email") {
      return element.hasAttribute("data-same-as")
        ? `Veuillez confirmer l'adresse e-mail`
        : `Veuillez saisir une adresse e-mail.`;
    }
    return element.hasAttribute("data-same-as")
      ? `Veuillez confirmer le champ précédent`
      : `Veuillez remplir ce champ.`;
  },
};
const PATTERN_CONSTRAINT = {
  name: "pattern",
  check: (input) => {
    const pattern = input.pattern;
    if (!pattern) {
      return null;
    }
    const value = input.value;
    if (!value) {
      return null;
    }
    const regex = new RegExp(pattern);
    if (regex.test(value)) {
      return null;
    }
    const patternMessage = input.getAttribute("data-pattern-message");
    if (patternMessage) {
      return patternMessage;
    }
    let message = `Veuillez respecter le format requis.`;
    const title = input.title;
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
  check: (input) => {
    if (input.type !== "email") {
      return null;
    }
    const value = input.value;
    if (!value) {
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
  check: (element) => {
    if (element.tagName === "INPUT") {
      if (!INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET.has(element.type)) {
        return null;
      }
    } else if (element.tagName !== "TEXTAREA") {
      return null;
    }

    const minLength = element.minLength;
    if (minLength === -1) {
      return null;
    }

    const value = element.value;
    const valueLength = value.length;
    if (valueLength === 0) {
      return null;
    }
    if (valueLength < minLength) {
      const thisField = generateThisFieldText(element);
      if (valueLength === 1) {
        return `${thisField} doit contenir au moins ${minLength} caractère (il contient actuellement un seul caractère).`;
      }
      return `${thisField} doit contenir au moins ${minLength} caractères (il contient actuellement ${valueLength} caractères).`;
    }
    return null;
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

const generateThisFieldText = (field) => {
  return field.type === "password"
    ? "Ce mot de passe"
    : field.type === "email"
      ? "Cette adresse e-mail"
      : "Ce champ";
};

const MAX_LENGTH_CONSTRAINT = {
  name: "max_length",
  check: (element) => {
    if (element.tagName === "INPUT") {
      if (!INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET.has(element.type)) {
        return null;
      }
    } else if (element.tagName !== "TEXTAREA") {
      return null;
    }

    const maxLength = element.maxLength;
    if (maxLength === -1) {
      return null;
    }

    const value = element.value;
    const valueLength = value.length;
    if (valueLength > maxLength) {
      const thisField = generateThisFieldText(element);
      return `${thisField} doit contenir au maximum ${maxLength} caractères (il contient actuellement ${valueLength} caractères).`;
    }
    return null;
  },
};
const INPUT_TYPE_SUPPORTING_MAX_LENGTH_SET = new Set(
  INPUT_TYPE_SUPPORTING_MIN_LENGTH_SET,
);

const TYPE_NUMBER_CONSTRAINT = {
  name: "type_number",
  check: (element) => {
    if (element.tagName !== "INPUT") {
      return null;
    }
    if (element.type !== "number") {
      return null;
    }
    if (element.value === "") {
      return null;
    }
    const value = element.valueAsNumber;
    if (isNaN(value)) {
      return `Doit être un nombre.`;
    }
    return null;
  },
};

const MIN_CONSTRAINT = {
  name: "min",
  check: (element) => {
    if (element.tagName !== "INPUT") {
      return null;
    }
    if (element.type === "number") {
      const minString = element.min;
      if (minString === "") {
        return null;
      }
      const minNumber = parseFloat(minString);
      if (isNaN(minNumber)) {
        return null;
      }
      const valueAsNumber = element.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber < minNumber) {
        const minMessage = element.getAttribute("data-min-message");
        return (
          minMessage ||
          `Doit être supérieur ou égal à <strong>${minString}</strong>.`
        );
      }
      return null;
    }
    if (element.type === "time") {
      const min = element.min;
      if (min === undefined) {
        return null;
      }
      const [minHours, minMinutes] = min.split(":").map(Number);
      const value = element.value;
      const [hours, minutes] = value.split(":").map(Number);
      if (hours < minHours) {
        return `Doit être <strong>${min}</strong> ou plus.`;
      }
      if (hours === minHours && minMinutes < minutes) {
        return `Doit être <strong>${min}</strong> ou plus.`;
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
  check: (element) => {
    if (element.tagName !== "INPUT") {
      return null;
    }
    if (element.type === "number") {
      const maxString = element.max;
      if (maxString === "") {
        return null;
      }
      const maxNumber = parseFloat(maxString);
      if (isNaN(maxNumber)) {
        return null;
      }
      const valueAsNumber = element.valueAsNumber;
      if (isNaN(valueAsNumber)) {
        return null;
      }
      if (valueAsNumber > maxNumber) {
        const maxMessage = element.getAttribute("data-max-message");
        return maxMessage || `Doit être <strong>${maxString}</strong> ou plus.`;
      }
      return null;
    }
    if (element.type === "time") {
      const max = element.min;
      if (max === undefined) {
        return null;
      }
      const [maxHours, maxMinutes] = max.split(":").map(Number);
      const value = element.value;
      const [hours, minutes] = value.split(":").map(Number);
      if (hours > maxHours) {
        return `Doit être <strong>${max}</strong> ou moins.`;
      }
      if (hours === maxHours && maxMinutes > minutes) {
        return `Doit être <strong>${max}</strong> ou moins.`;
      }
      return null;
    }
    return null;
  },
};

const READONLY_CONSTRAINT = {
  name: "readonly",
  check: (element, { skipReadonly }) => {
    if (skipReadonly) {
      return null;
    }
    if (!element.readonly && !element.hasAttribute("data-readonly")) {
      return null;
    }
    if (element.type === "hidden") {
      return null;
    }
    const readonlySilent = element.hasAttribute("data-readonly-silent");
    if (readonlySilent) {
      return { silent: true };
    }
    const readonlyMessage = element.getAttribute("data-readonly-message");
    if (readonlyMessage) {
      return {
        message: readonlyMessage,
        level: "info",
      };
    }
    const isBusy = element.getAttribute("aria-busy") === "true";
    if (isBusy) {
      return {
        target: element,
        message: `Cette action est en cours. Veuillez patienter.`,
        level: "info",
      };
    }
    return {
      target: element,
      message:
        element.tagName === "BUTTON"
          ? `Cet action n'est pas disponible pour l'instant.`
          : `Cet élément est en lecture seule et ne peut pas être modifié.`,
      level: "info",
    };
  },
};

const SAME_AS_CONSTRAINT = {
  name: "same_as",
  check: (element) => {
    const sameAs = element.getAttribute("data-same-as");
    if (!sameAs) {
      return null;
    }

    const otherElement = document.querySelector(sameAs);
    if (!otherElement) {
      console.warn(
        `Same as constraint: could not find element for selector ${sameAs}`,
      );
      return null;
    }

    const value = element.value;
    const otherValue = otherElement.value;
    if (value === "" || otherValue === "") {
      // don't validate if one of the two values is empty
      return null;
    }

    if (value === otherValue) {
      return null;
    }

    const message = element.getAttribute("data-same-as-message");
    if (message) {
      return message;
    }

    const type = element.type;
    if (type === "password") {
      return `Ce mot de passe doit être identique au précédent.`;
    }
    if (type === "email") {
      return `Cette adresse e-mail doit être identique a la précédente.`;
    }
    return `Ce champ doit être identique au précédent.`;
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
 */


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

  const constraintSet = new Set();
  constraintSet.add(DISABLED_CONSTRAINT);
  constraintSet.add(REQUIRED_CONSTRAINT);
  constraintSet.add(PATTERN_CONSTRAINT);
  constraintSet.add(TYPE_EMAIL_CONSTRAINT);
  constraintSet.add(TYPE_NUMBER_CONSTRAINT);
  constraintSet.add(MIN_LENGTH_CONSTRAINT);
  constraintSet.add(MAX_LENGTH_CONSTRAINT);
  constraintSet.add(MIN_CONSTRAINT);
  constraintSet.add(MAX_CONSTRAINT);
  constraintSet.add(READONLY_CONSTRAINT);
  constraintSet.add(SAME_AS_CONSTRAINT);
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
        continue;
      }
      const constraintValidityInfo =
        typeof checkResult === "string"
          ? { message: checkResult }
          : checkResult;

      failedConstraintInfo = {
        name: constraint.name,
        constraint,
        ...constraintValidityInfo,
        cleanup,
        reportStatus: "not_reported",
      };
      validityInfoMap.set(constraint, failedConstraintInfo);
    }

    if (failedConstraintInfo) {
      if (!hasTitleAttribute) {
        // when a constraint is failing browser displays that constraint message if the element has no title attribute.
        // We want to do the same with our message (overriding the browser in the process to get better messages)
        element.setAttribute("title", failedConstraintInfo.message);
      }
    } else {
      if (!hasTitleAttribute) {
        element.removeAttribute("title");
      }
      closeElementValidationMessage("becomes_valid");
    }

    return !failedConstraintInfo;
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
      const { message, level, closeOnClickOutside } = failedConstraintInfo;
      validationInterface.validationMessage.update(message, {
        level,
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
        level: failedConstraintInfo.level,
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
        for (const [, { message, level }] of customMessageMap) {
          return { message, level };
        }
        return null;
      },
    });
    const addCustomMessage = (
      key,
      message,
      { level = "error", removeOnRequestAction = false } = {},
    ) => {
      customMessageMap.set(key, { message, level, removeOnRequestAction });
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
      if (element.hasAttribute("data-action")) {
        if (wouldKeydownSubmitForm(keydownEvent)) {
          keydownEvent.preventDefault();
        }
        dispatchActionRequestedCustomEvent(element, {
          event: keydownEvent,
          requester: element,
        });
        return;
      }
      const { form } = element;
      if (!form) {
        return;
      }
      keydownEvent.preventDefault();
      dispatchActionRequestedCustomEvent(form, {
        event: keydownEvent,
        requester: getFirstButtonSubmittingForm(form) || element,
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
      if (element.hasAttribute("data-action")) {
        if (wouldClickSubmitForm(clickEvent)) {
          clickEvent.preventDefault();
        }
        dispatchActionRequestedCustomEvent(element, {
          event: clickEvent,
          requester: element,
        });
        return;
      }
      const { form } = element;
      if (!form) {
        return;
      }
      if (wouldClickSubmitForm(clickEvent)) {
        clickEvent.preventDefault();
      }
      dispatchActionRequestedCustomEvent(form, {
        event: clickEvent,
        requester: element,
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
      if (element.hasAttribute("data-action")) {
        dispatchActionRequestedCustomEvent(element, {
          event: e,
          requester: element,
        });
        return;
      }
    });
    addTeardown(() => {
      stop();
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

const wouldClickSubmitForm = (clickEvent) => {
  if (clickEvent.defaultPrevented) {
    return false;
  }
  const clickTarget = clickEvent.target;
  const { form } = clickTarget;
  if (!form) {
    return false;
  }
  const button = clickTarget.closest("button");
  if (!button) {
    return false;
  }
  const wouldSubmitFormByType =
    button.type === "submit" || button.type === "image";
  if (wouldSubmitFormByType) {
    return true;
  }
  if (button.type) {
    return false;
  }
  if (getFirstButtonSubmittingForm(form)) {
    // an other button is explicitly submitting the form, this one would not submit it
    return false;
  }
  // this is the only button inside the form without type attribute, so it defaults to type="submit"
  return true;
};
const getFirstButtonSubmittingForm = (form) => {
  return form.querySelector(
    `button[type="submit"], input[type="submit"], input[type="image"]`,
  );
};

const wouldKeydownSubmitForm = (keydownEvent) => {
  if (keydownEvent.defaultPrevented) {
    return false;
  }
  const keydownTarget = keydownEvent.target;
  const { form } = keydownTarget;
  if (!form) {
    return false;
  }
  if (keydownEvent.key !== "Enter") {
    return false;
  }
  const isTextInput =
    keydownTarget.tagName === "INPUT" || keydownTarget.tagName === "TEXTAREA";
  if (!isTextInput) {
    return false;
  }
  return true;
};

const dispatchActionRequestedCustomEvent = (
  fieldOrForm,
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
  fieldOrForm.dispatchEvent(actionRequestedCustomEvent);
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

const ErrorBoundaryContext = createContext(null);

const useResetErrorBoundary = () => {
  const resetErrorBoundary = useContext(ErrorBoundaryContext);
  return resetErrorBoundary;
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

const useActionData = (action) => {
  if (!action) {
    return undefined;
  }
  const { computedDataSignal } = getActionPrivateProperties(action);
  const data = computedDataSignal.value;
  return data;
};

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

const UNSET = {};
const useInitialValue = (compute) => {
  const initialValueRef = useRef(UNSET);
  let initialValue = initialValueRef.current;
  if (initialValue !== UNSET) {
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

const valueInLocalStorage = (key, options = {}) => {
  const { type = "string" } = options;
  const converter = typeConverters[type];
  if (converter === undefined) {
    console.warn(
      `Invalid type "${type}" for "${key}" in local storage, expected one of ${Object.keys(
        typeConverters,
      ).join(", ")}`,
    );
  }
  const getValidityMessage = (
    valueToCheck,
    valueInLocalStorage = valueToCheck,
  ) => {
    if (!converter) {
      return "";
    }
    if (!converter.checkValidity) {
      return "";
    }
    const checkValidityResult = converter.checkValidity(valueToCheck);
    if (checkValidityResult === false) {
      return `${valueInLocalStorage}`;
    }
    if (!checkValidityResult) {
      return "";
    }
    return `${checkValidityResult}, got "${valueInLocalStorage}"`;
  };

  const get = () => {
    let valueInLocalStorage = window.localStorage.getItem(key);
    if (valueInLocalStorage === null) {
      return Object.hasOwn(options, "default") ? options.default : undefined;
    }
    if (converter && converter.decode) {
      const valueDecoded = converter.decode(valueInLocalStorage);
      const validityMessage = getValidityMessage(
        valueDecoded,
        valueInLocalStorage,
      );
      if (validityMessage) {
        console.warn(
          `The value found in localStorage "${key}" is invalid: ${validityMessage}`,
        );
        return undefined;
      }
      return valueDecoded;
    }
    const validityMessage = getValidityMessage(valueInLocalStorage);
    if (validityMessage) {
      console.warn(
        `The value found in localStorage "${key}" is invalid: ${validityMessage}`,
      );
      return undefined;
    }
    return valueInLocalStorage;
  };
  const set = (value) => {
    if (value === undefined) {
      window.localStorage.removeItem(key);
      return;
    }
    const validityMessage = getValidityMessage(value);
    if (validityMessage) {
      console.warn(
        `The value to set in localStorage "${key}" is invalid: ${validityMessage}`,
      );
    }
    if (converter && converter.encode) {
      const valueEncoded = converter.encode(value);
      window.localStorage.setItem(key, valueEncoded);
      return;
    }
    window.localStorage.setItem(key, value);
  };
  const remove = () => {
    window.localStorage.removeItem(key);
  };

  return [get, set, remove];
};

const typeConverters = {
  boolean: {
    checkValidity: (value) => {
      if (typeof value !== "boolean") {
        return `must be a boolean`;
      }
      return "";
    },
    decode: (value) => {
      return value === "true";
    },
  },
  string: {
    checkValidity: (value) => {
      if (typeof value !== "string") {
        return `must be a string`;
      }
      return "";
    },
  },
  number: {
    decode: (value) => {
      const valueParsed = parseFloat(value);
      return valueParsed;
    },
    checkValidity: (value) => {
      if (typeof value !== "number") {
        return `must be a number`;
      }
      if (!Number.isFinite(value)) {
        return `must be finite`;
      }
      return "";
    },
  },
  positive_number: {
    decode: (value) => {
      const valueParsed = parseFloat(value);
      return valueParsed;
    },
    checkValidity: (value) => {
      if (typeof value !== "number") {
        return `must be a number`;
      }
      if (value < 0) {
        return `must be positive`;
      }
      return "";
    },
  },
  positive_integer: {
    decode: (value) => {
      const valueParsed = parseInt(value, 10);
      return valueParsed;
    },
    checkValidity: (value) => {
      if (typeof value !== "number") {
        return `must be a number`;
      }
      if (!Number.isInteger(value)) {
        return `must be an integer`;
      }
      if (value < 0) {
        return `must be positive`;
      }
      return "";
    },
  },
  percentage: {
    checkValidity: (value) => {
      if (typeof value !== "string") {
        return `must be a percentage`;
      }
      if (!value.endsWith("%")) {
        return `must end with %`;
      }
      const percentageString = value.slice(0, -1);
      const percentageFloat = parseFloat(percentageString);
      if (typeof percentageFloat !== "number") {
        return `must be a percentage`;
      }
      if (percentageFloat < 0 || percentageFloat > 100) {
        return `must be between 0 and 100`;
      }
      return "";
    },
  },
  object: {
    decode: (value) => {
      const valueParsed = JSON.parse(value);
      return valueParsed;
    },
    encode: (value) => {
      const valueStringified = JSON.stringify(value);
      return valueStringified;
    },
    checkValidity: (value) => {
      if (value === null || typeof value !== "object") {
        return `must be an object`;
      }
      return "";
    },
  },
};

let baseUrl = window.location.origin;

const setBaseUrl = (value) => {
  baseUrl = new URL(value, window.location).href;
};

const rawUrlPartSymbol = Symbol("raw_url_part");
const rawUrlPart = (value) => {
  return {
    [rawUrlPartSymbol]: true,
    value,
  };
};
const NO_PARAMS = { [SYMBOL_IDENTITY]: Symbol("no_params") };
// Controls what happens to actions when their route becomes inactive:
// 'abort' - Cancel the action immediately when route deactivates
// 'keep-loading' - Allow action to continue running after route deactivation
//
// The 'keep-loading' strategy could act like preloading, keeping data ready for potential return.
// However, since route reactivation triggers action reload anyway, the old data won't be used
// so it's better to abort the action to avoid unnecessary resource usage.
const ROUTE_DEACTIVATION_STRATEGY = "abort"; // 'abort', 'keep-loading'

const routeSet = new Set();
// Store previous route states to detect changes
const routePreviousStateMap = new WeakMap();
// Store abort controllers per action to control their lifecycle based on route state
const actionAbortControllerWeakMap = new WeakMap();
const updateRoutes = (
  url,
  {
    // state
    replace,
    isVisited,
  },
) => {
  const routeMatchInfoSet = new Set();
  for (const route of routeSet) {
    const routePrivateProperties = getRoutePrivateProperties(route);
    const { urlPattern } = routePrivateProperties;

    // Get previous state
    const previousState = routePreviousStateMap.get(route) || {
      active: false,
      params: NO_PARAMS,
    };
    const oldActive = previousState.active;
    const oldParams = previousState.params;
    // Check if the URL matches the route pattern
    const match = urlPattern.exec(url);
    const newActive = Boolean(match);
    let newParams;
    if (match) {
      const { optionalParamKeySet } = routePrivateProperties;
      const extractedParams = extractParams(
        urlPattern,
        url,
        optionalParamKeySet,
      );
      if (compareTwoJsValues(oldParams, extractedParams)) {
        // No change in parameters, keep the old params
        newParams = oldParams;
      } else {
        newParams = extractedParams;
      }
    } else {
      newParams = NO_PARAMS;
    }

    const routeMatchInfo = {
      route,
      routePrivateProperties,
      oldActive,
      newActive,
      oldParams,
      newParams,
    };
    routeMatchInfoSet.add(routeMatchInfo);
    // Store current state for next comparison
    routePreviousStateMap.set(route, {
      active: newActive,
      params: newParams,
    });
  }

  // Apply all signal updates in a batch
  const activeRouteSet = new Set();
  batch(() => {
    for (const {
      route,
      routePrivateProperties,
      newActive,
      newParams,
    } of routeMatchInfoSet) {
      const { activeSignal, paramsSignal, visitedSignal } =
        routePrivateProperties;
      const visited = isVisited(route.url);
      activeSignal.value = newActive;
      paramsSignal.value = newParams;
      visitedSignal.value = visited;
      route.active = newActive;
      route.params = newParams;
      route.visited = visited;
      if (newActive) {
        activeRouteSet.add(route);
      }
    }
  });

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
      if (replace || currentAction.aborted || currentAction.error) {
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
    newActive,
    oldActive,
    newParams,
    oldParams,
  } of routeMatchInfoSet) {
    const routeAction = route.action;
    if (!routeAction) {
      continue;
    }

    const becomesActive = newActive && !oldActive;
    const becomesInactive = !newActive && oldActive;
    const paramsChangedWhileActive =
      newActive && oldActive && newParams !== oldParams;

    // Handle actions for routes that become active
    if (becomesActive) {
      shouldLoad(route);
      continue;
    }

    // Handle actions for routes that become inactive - abort them
    if (becomesInactive && ROUTE_DEACTIVATION_STRATEGY === "abort") {
      shouldAbort(route);
      continue;
    }

    // Handle parameter changes while route stays active
    if (paramsChangedWhileActive) {
      shouldReload(route);
    }
  }

  return {
    loadSet: toLoadSet,
    reloadSet: toReloadSet,
    abortSignalMap,
    routeLoadRequestedMap,
    activeRouteSet,
  };
};
const extractParams = (urlPattern, url, ignoreSet = new Set()) => {
  const match = urlPattern.exec(url);
  if (!match) {
    return NO_PARAMS;
  }
  const params = {};

  // Collect all parameters from URLPattern groups, handling both named and numbered groups
  let wildcardOffset = 0;
  for (const property of URL_PATTERN_PROPERTIES_WITH_GROUP_SET) {
    const urlPartMatch = match[property];
    if (urlPartMatch && urlPartMatch.groups) {
      let localWildcardCount = 0;
      for (const key of Object.keys(urlPartMatch.groups)) {
        const value = urlPartMatch.groups[key];
        const keyAsNumber = parseInt(key, 10);
        if (!isNaN(keyAsNumber)) {
          if (value) {
            // Only include non-empty values and non-ignored wildcard indices
            const wildcardKey = String(wildcardOffset + keyAsNumber);
            if (!ignoreSet.has(wildcardKey)) {
              params[wildcardKey] = decodeURIComponent(value);
            }
            localWildcardCount++;
          }
        } else if (!ignoreSet.has(key)) {
          // Named group (:param or {param}) - only include if not ignored
          params[key] = decodeURIComponent(value);
        }
      }
      // Update wildcard offset for next URL part
      wildcardOffset += localWildcardCount;
    }
  }
  return params;
};
const URL_PATTERN_PROPERTIES_WITH_GROUP_SET = new Set([
  "protocol",
  "username",
  "password",
  "hostname",
  "pathname",
  "search",
  "hash",
]);

const routePrivatePropertiesMap = new Map();
const getRoutePrivateProperties = (route) => {
  return routePrivatePropertiesMap.get(route);
};
const createRoute = (urlPatternInput) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const cleanupCallback of cleanupCallbackSet) {
      cleanupCallback();
    }
    cleanupCallbackSet.clear();
  };

  const route = {
    urlPattern: urlPatternInput,
    isRoute: true,
    active: false,
    params: NO_PARAMS,
    buildUrl: null,
    bindAction: null,
    relativeUrl: null,
    url: null,
    action: null,
    cleanup,
    toString: () => {
      return `route "${urlPatternInput}"`;
    },
    replaceParams: undefined,
  };
  routeSet.add(route);

  const routePrivateProperties = {
    urlPattern: undefined,
    activeSignal: null,
    paramsSignal: null,
    visitedSignal: null,
    relativeUrlSignal: null,
    urlSignal: null,
    optionalParamKeySet: null,
  };
  routePrivatePropertiesMap.set(route, routePrivateProperties);

  const buildRelativeUrl = (params = {}) => {
    let relativeUrl = urlPatternInput;
    let hasRawUrlPartWithInvalidChars = false;

    const encode = (value) => {
      if (value && value[rawUrlPartSymbol]) {
        const rawValue = value.value;
        // Check if raw value contains invalid URL characters
        if (/[\s<>{}|\\^`]/.test(rawValue)) {
          hasRawUrlPartWithInvalidChars = true;
        }
        return rawValue;
      }
      return encodeURIComponent(value);
    };

    // Replace named parameters (:param and {param})
    for (const key of Object.keys(params)) {
      const value = params[key];
      const encodedValue = encode(value);
      relativeUrl = relativeUrl.replace(`:${key}`, encodedValue);
      relativeUrl = relativeUrl.replace(`{${key}}`, encodedValue);
    }

    // Handle wildcards: if the pattern ends with /*? (optional wildcard)
    // always remove the wildcard part for URL building since it's optional
    if (relativeUrl.endsWith("/*?")) {
      // Always remove the optional wildcard part for URL building
      relativeUrl = relativeUrl.replace(/\/\*\?$/, "");
    } else {
      // For required wildcards (/*) or other patterns, replace normally
      let wildcardIndex = 0;
      relativeUrl = relativeUrl.replace(/\*/g, () => {
        const paramKey = wildcardIndex.toString();
        const paramValue = params[paramKey];
        const replacement = paramValue ? encode(paramValue) : "*";
        wildcardIndex++;
        return replacement;
      });
    }

    return {
      relativeUrl,
      hasRawUrlPartWithInvalidChars,
    };
  };
  const buildUrl = (params = {}) => {
    const { relativeUrl, hasRawUrlPartWithInvalidChars } =
      buildRelativeUrl(params);
    let processedRelativeUrl = relativeUrl;
    if (processedRelativeUrl[0] === "/") {
      processedRelativeUrl = processedRelativeUrl.slice(1);
    }
    if (hasRawUrlPartWithInvalidChars) {
      return `${baseUrl}/${processedRelativeUrl}`;
    }
    const url = new URL(processedRelativeUrl, baseUrl).href;
    return url;
  };
  route.buildUrl = buildUrl;

  const activeSignal = signal(false);
  const paramsSignal = signal(NO_PARAMS);
  const visitedSignal = signal(false);
  const relativeUrlSignal = computed(() => {
    const params = paramsSignal.value;
    const { relativeUrl } = buildRelativeUrl(params);
    return relativeUrl;
  });
  const disposeRelativeUrlEffect = effect(() => {
    route.relativeUrl = relativeUrlSignal.value;
  });
  cleanupCallbackSet.add(disposeRelativeUrlEffect);

  const urlSignal = computed(() => {
    const relativeUrl = relativeUrlSignal.value;
    const url = new URL(relativeUrl, baseUrl).href;
    return url;
  });
  const disposeUrlEffect = effect(() => {
    route.url = urlSignal.value;
  });
  cleanupCallbackSet.add(disposeUrlEffect);

  const replaceParams = (newParams) => {
    const currentParams = paramsSignal.peek();
    const updatedParams = { ...currentParams, ...newParams };
    const updatedUrl = route.buildUrl(updatedParams);
    if (route.action) {
      route.action.replaceParams(updatedParams);
    }
    browserIntegration$1.goTo(updatedUrl, { replace: true });
  };
  route.replaceParams = replaceParams;

  const bindAction = (action) => {
    /*
     *
     * here I need to check the store for that action (if any)
     * and listen store changes to do this:
     *
     * When we detect changes we want to update the route params
     * so we'll need to use goTo(buildUrl(params), { replace: true })
     *
     * reinserted is useful because the item id might have changed
     * but not the mutable key
     *
     */

    const { store } = action.meta;
    if (store) {
      const { mutableIdKeys } = store;
      if (mutableIdKeys.length) {
        const mutableIdKey = mutableIdKeys[0];
        const mutableIdValueSignal = computed(() => {
          const params = paramsSignal.value;
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

    /*
    store.registerPropertyLifecycle(activeItemSignal, key, {
    changed: (value) => {
      route.replaceParams({
        [key]: value,
      });
    },
    dropped: () => {
      route.reload();
    },
    reinserted: () => {
      // this will reload all routes which works but
      // - most of the time only "route" is impacted, any other route could stay as is
      // - we already have the data, reloading the route will refetch the backend which is unnecessary
      // we could just remove routing error (which is cause by 404 likely)
      // to actually let the data be displayed
      // because they are available, but in reality the route has no data
      // because the fetch failed
      // so conceptually reloading is fine,
      // the only thing that bothers me a little is that it reloads all routes
      route.reload();
    },
  });
    */

    const actionBoundToThisRoute = action.bindParams(paramsSignal);
    route.action = actionBoundToThisRoute;
    return actionBoundToThisRoute;
  };
  route.bindAction = bindAction;

  {
    // Remove leading slash from urlPattern to make it relative to baseUrl
    const normalizedUrlPattern = urlPatternInput.startsWith("/")
      ? urlPatternInput.slice(1)
      : urlPatternInput;
    const urlPattern = new URLPattern(normalizedUrlPattern, baseUrl, {
      ignoreCase: true,
    });
    routePrivateProperties.urlPattern = urlPattern;
    routePrivateProperties.activeSignal = activeSignal;
    routePrivateProperties.paramsSignal = paramsSignal;
    routePrivateProperties.visitedSignal = visitedSignal;
    routePrivateProperties.relativeUrlSignal = relativeUrlSignal;
    routePrivateProperties.urlSignal = urlSignal;
    routePrivateProperties.cleanupCallbackSet = cleanupCallbackSet;

    // Analyze pattern once to detect optional params (named and wildcard indices)
    // Note: Wildcard indices are stored as strings ("0", "1", ...) to match keys from extractParams
    const optionalParamKeySet = new Set();
    normalizedUrlPattern.replace(/:([A-Za-z0-9_]+)\?/g, (_m, name) => {
      optionalParamKeySet.add(name);
      return "";
    });
    let wildcardIndex = 0;
    normalizedUrlPattern.replace(/\*(\?)?/g, (_m, opt) => {
      if (opt === "?") {
        optionalParamKeySet.add(String(wildcardIndex));
      }
      wildcardIndex++;
      return "";
    });
    routePrivateProperties.optionalParamKeySet = optionalParamKeySet;
  }

  return route;
};
const useRouteStatus = (route) => {
  const routePrivateProperties = getRoutePrivateProperties(route);
  if (!routePrivateProperties) {
    throw new Error(`Cannot find route private properties for ${route}`);
  }

  const { urlSignal, activeSignal, paramsSignal, visitedSignal } =
    routePrivateProperties;

  const url = urlSignal.value;
  const active = activeSignal.value;
  const params = paramsSignal.value;
  const visited = visitedSignal.value;

  return {
    url,
    active,
    params,
    visited,
  };
};

let browserIntegration$1;
const setBrowserIntegration = (integration) => {
  browserIntegration$1 = integration;
};

let onRouteDefined = () => {};
const setOnRouteDefined = (v) => {
  onRouteDefined = v;
};
/**
 * Define all routes for the application.
 *
 * ⚠️ HOT RELOAD WARNING: When destructuring the returned routes, use 'let' instead of 'const'
 * to allow hot reload to update the route references:
 *
 * ❌ const [ROLE_ROUTE, DATABASE_ROUTE] = defineRoutes({...})
 * ✅ let [ROLE_ROUTE, DATABASE_ROUTE] = defineRoutes({...})
 *
 * @param {Object} routeDefinition - Object mapping URL patterns to actions
 * @returns {Array} Array of route objects in the same order as the keys
 */
// All routes MUST be created at once because any url can be accessed
// at any given time (url can be shared, reloaded, etc..)
// Later I'll consider adding ability to have dynamic import into the mix
// (An async function returning an action)
const defineRoutes = (routeDefinition) => {
  // Clean up existing routes
  for (const route of routeSet) {
    route.cleanup();
  }
  routeSet.clear();

  const routeArray = [];
  for (const key of Object.keys(routeDefinition)) {
    const value = routeDefinition[key];
    const route = createRoute(key);
    if (value && value.isAction) {
      route.bindAction(value);
    } else if (typeof value === "function") {
      const actionFromFunction = createAction(value);
      route.bindAction(actionFromFunction);
    } else if (value) {
      route.bindAction(value);
    }
    routeArray.push(route);
  }
  onRouteDefined();

  return routeArray;
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

const documentStateSignal = signal(null);
const useDocumentState = () => {
  return documentStateSignal.value;
};
const updateDocumentState = (value) => {
  documentStateSignal.value = value;
};

const documentUrlSignal = signal(window.location.href);
const useDocumentUrl = () => {
  return documentUrlSignal.value;
};
const updateDocumentUrl = (value) => {
  documentUrlSignal.value = value;
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
    window.history.replaceState(newState, null, url);
    handleRoutingTask(url, {
      replace: true,
      state: newState,
      reason,
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

    // Increment signal to notify subscribers that visited URLs changed
    visitedUrlsSignal.value++;

    const historyState = getDocumentState() || {};
    const hsitoryStateWithVisitedUrls = {
      ...historyState,
      jsenv_visited_urls: Array.from(visitedUrlSet),
    };
    window.history.replaceState(
      hsitoryStateWithVisitedUrls,
      null,
      window.location.href,
    );
    updateDocumentState(hsitoryStateWithVisitedUrls);
  };

  let abortController = null;
  const handleRoutingTask = (url, { state, replace, reason }) => {
    markUrlAsVisited(url);
    updateDocumentUrl(url);
    updateDocumentState(state);
    if (abortController) {
      abortController.abort(`navigating to ${url}`);
    }
    abortController = new AbortController();

    const { allResult, requestedResult } = applyRouting(url, {
      globalAbortSignal: globalAbortController.signal,
      abortSignal: abortController.signal,
      state,
      replace,
      isVisited,
      reason,
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
      const linkElement = e.target.closest("a");
      if (!linkElement) {
        return;
      }
      const href = linkElement.href;
      if (!href || !href.startsWith(window.location.origin)) {
        return;
      }
      if (linkElement.hasAttribute("data-readonly")) {
        return;
      }
      // Ignore anchor navigation (same page, different hash)
      const currentUrl = new URL(window.location.href);
      const targetUrl = new URL(href);
      if (
        currentUrl.pathname === targetUrl.pathname &&
        currentUrl.search === targetUrl.search &&
        targetUrl.hash !== ""
      ) {
        return;
      }
      e.preventDefault();
      const state = null;
      history.pushState(state, null, href);
      handleRoutingTask(href, {
        state,
        reason: `"click" on a[href="${href}"]`,
      });
    },
    { capture: true },
  );

  window.addEventListener(
    "submit",
    () => {
      // TODO: Handle form submissions
    },
    { capture: true },
  );

  window.addEventListener("popstate", (popstateEvent) => {
    const url = window.location.href;
    const state = popstateEvent.state;
    handleRoutingTask(url, {
      state,
      reason: `"popstate" event for ${url}`,
    });
  });

  const goTo = async (url, { state = null, replace } = {}) => {
    const currentUrl = documentUrlSignal.peek();
    if (url === currentUrl) {
      return;
    }
    if (replace) {
      window.history.replaceState(state, null, url);
    } else {
      window.history.pushState(state, null, url);
    }
    handleRoutingTask(url, {
      state,
      replace,
      reason: `goTo called with "${url}"`,
    });
  };

  const stop = (reason = "stop called") => {
    triggerGlobalAbort(reason);
  };

  const reload = () => {
    const url = window.location.href;
    const state = history.state;
    handleRoutingTask(url, {
      state,
    });
  };

  const goBack = () => {
    window.history.back();
  };

  const goForward = () => {
    window.history.forward();
  };

  const init = () => {
    const url = window.location.href;
    const state = history.state;
    history.replaceState(state, null, url);
    handleRoutingTask(url, {
      state,
      replace: true,
      reason: "routing initialization",
    });
  };

  return {
    integration: "browser_history_api",
    init,
    goTo,
    stop,
    reload,
    goBack,
    goForward,
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
    replace,
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
    replace,
    // state,
    isVisited,
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
setBrowserIntegration(browserIntegration);

const actionIntegratedVia = browserIntegration.integration;
const goTo = browserIntegration.goTo;
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
const goBack = browserIntegration.goBack;
const goForward = browserIntegration.goForward;
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

const useNavState = useNavStateBasic;

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .action_error {
    padding: 20px;
    background: #fdd;
    border: 1px solid red;
    margin-top: 0;
    margin-bottom: 20px;
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

const FormContext = createContext();

const FormActionContext = createContext();

const renderActionableComponent = (props, ref, {
  Basic,
  WithAction,
  InsideForm,
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
        formContext: formContext,
        ref: ref,
        ...props
      });
    }
    return jsx(WithAction, {
      ref: ref,
      ...props
    });
  }
  if (considerInsideForm && InsideForm) {
    return jsx(InsideForm, {
      formContext: formContext,
      ref: ref,
      ...props
    });
  }
  return jsx(Basic, {
    ref: ref,
    ...props
  });
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
    animation-fill-mode: forwards;
    animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
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
    transition: opacity 0.3s ease-in-out;
    opacity: 1;
  }
  .summary_marker_svg .loading_container {
    transition: transform 0.3s linear;
    transform: scale(0.3);
  }
  .summary_marker_svg .background_circle,
  .summary_marker_svg .foreground_circle {
    transition: opacity 0.3s ease-in-out;
    opacity: 0;
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
  return renderActionableComponent(props, ref, {
    Basic: DetailsBasic,
    WithAction: DetailsWithAction
  });
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
  const [navState, setNavState] = useNavState(id);
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
const DetailsWithAction = forwardRef((props, ref) => {
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
    {
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

const useConstraints = (elementRef, constraints, targetSelector) => {
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
};

const FlexDirectionContext = createContext();

/**
 * Layout Style Hook
 *
 * This hook processes layout-related props and converts them into CSS styles.
 * It handles spacing (margin/padding), alignment (alignX/alignY), and expansion behavior.
 * The hook is context-aware and adapts behavior based on flex direction.
 *
 * Key features:
 * - Spacing: margin/padding with X/Y shortcuts and directional variants
 * - Alignment: alignX/alignY using align-self and auto margins
 * - Expansion: expand prop for taking remaining space (flexGrow or width: 100%)
 * - Context-aware: behavior changes based on FlexDirectionContext (row/column/none)
 */


/**
 * Converts layout props into CSS styles
 * @param {Object} props - Component props containing layout properties
 * @param {string|number} [props.margin] - All-sides margin
 * @param {string|number} [props.marginX] - Horizontal margin (left + right)
 * @param {string|number} [props.marginY] - Vertical margin (top + bottom)
 * @param {string|number} [props.marginLeft] - Left margin
 * @param {string|number} [props.marginRight] - Right margin
 * @param {string|number} [props.marginTop] - Top margin
 * @param {string|number} [props.marginBottom] - Bottom margin
 * @param {string|number} [props.padding] - All-sides padding
 * @param {string|number} [props.paddingX] - Horizontal padding (left + right)
 * @param {string|number} [props.paddingY] - Vertical padding (top + bottom)
 * @param {string|number} [props.paddingLeft] - Left padding
 * @param {string|number} [props.paddingRight] - Right padding
 * @param {string|number} [props.paddingTop] - Top padding
 * @param {string|number} [props.paddingBottom] - Bottom padding
 * @param {"start"|"center"|"end"|"stretch"} [props.alignX] - Horizontal alignment
 * @param {"start"|"center"|"end"|"stretch"} [props.alignY] - Vertical alignment
 * @param {boolean} [props.expandX] - Whether element should expand horizontally to fill available space
 * @param {boolean} [props.expandY] - Whether element should expand vertically to fill available space
 * @returns {Object} Object with categorized styles: { margin, padding, alignment, expansion, all }
 */
const useLayoutStyle = (props) => {
  const flexDirection = useContext(FlexDirectionContext);

  const marginStyle = {};
  const paddingStyle = {};
  const alignmentStyle = {};
  const expansionStyle = {};

  {
    {
      const margin = props.margin;
      const marginX = props.marginX;
      const marginY = props.marginY;
      const marginLeft = props.marginLeft;
      const marginRight = props.marginRight;
      const marginTop = props.marginTop;
      const marginBottom = props.marginBottom;
      delete props.margin;
      delete props.marginX;
      delete props.marginY;
      delete props.marginLeft;
      delete props.marginRight;
      delete props.marginTop;
      delete props.marginBottom;

      if (margin !== undefined) {
        marginStyle.margin = margin;
      }
      if (marginLeft !== undefined) {
        marginStyle.marginLeft = marginLeft;
      } else if (marginX !== undefined) {
        marginStyle.marginLeft = marginX;
      }
      if (marginRight !== undefined) {
        marginStyle.marginRight = marginRight;
      } else if (marginX !== undefined) {
        marginStyle.marginRight = marginX;
      }
      if (marginTop !== undefined) {
        marginStyle.marginTop = marginTop;
      } else if (marginY !== undefined) {
        marginStyle.marginTop = marginY;
      }
      if (marginBottom !== undefined) {
        marginStyle.marginBottom = marginBottom;
      } else if (marginY !== undefined) {
        marginStyle.marginBottom = marginY;
      }
    }
    {
      const padding = props.padding;
      const paddingX = props.paddingX;
      const paddingY = props.paddingY;
      const paddingLeft = props.paddingLeft;
      const paddingRight = props.paddingRight;
      const paddingTop = props.paddingTop;
      const paddingBottom = props.paddingBottom;
      delete props.padding;
      delete props.paddingX;
      delete props.paddingY;
      delete props.paddingLeft;
      delete props.paddingRight;
      delete props.paddingTop;
      delete props.paddingBottom;

      if (padding !== undefined) {
        paddingStyle.padding = padding;
      }
      if (paddingLeft !== undefined) {
        paddingStyle.paddingLeft = paddingLeft;
      } else if (paddingX !== undefined) {
        paddingStyle.paddingLeft = paddingX;
      }
      if (paddingRight !== undefined) {
        paddingStyle.paddingRight = paddingRight;
      } else if (paddingX !== undefined) {
        paddingStyle.paddingRight = paddingX;
      }
      if (paddingTop !== undefined) {
        paddingStyle.paddingTop = paddingTop;
      } else if (paddingY !== undefined) {
        paddingStyle.paddingTop = paddingY;
      }
      if (paddingBottom !== undefined) {
        paddingStyle.paddingBottom = paddingBottom;
      } else if (paddingY !== undefined) {
        paddingStyle.paddingBottom = paddingY;
      }
    }
  }

  {
    const alignX = props.alignX;
    const alignY = props.alignY;
    delete props.alignX;
    delete props.alignY;

    // flex
    if (flexDirection === "row") {
      // In row direction: alignX controls justify-content, alignY controls align-self
      if (alignY !== undefined && alignY !== "start") {
        alignmentStyle.alignSelf = alignY;
      }
      // For row, alignX uses auto margins for positioning
      // NOTE: Auto margins only work effectively for positioning individual items.
      // When multiple adjacent items have the same auto margin alignment (e.g., alignX="end"),
      // only the first item will be positioned as expected because subsequent items
      // will be positioned relative to the previous item's margins, not the container edge.
      if (alignX !== undefined) {
        if (alignX === "start") {
          alignmentStyle.marginRight = "auto";
        } else if (alignX === "end") {
          alignmentStyle.marginLeft = "auto";
        } else if (alignX === "center") {
          alignmentStyle.marginLeft = "auto";
          alignmentStyle.marginRight = "auto";
        }
      }
    } else if (flexDirection === "column") {
      // In column direction: alignX controls align-self, alignY uses auto margins
      if (alignX !== undefined && alignX !== "start") {
        alignmentStyle.alignSelf = alignX;
      }
      // For column, alignY uses auto margins for positioning
      // NOTE: Same auto margin limitation applies - multiple adjacent items with
      // the same alignY won't all position relative to container edges.
      if (alignY !== undefined) {
        if (alignY === "start") {
          alignmentStyle.marginBottom = "auto";
        } else if (alignY === "end") {
          alignmentStyle.marginTop = "auto";
        } else if (alignY === "center") {
          alignmentStyle.marginTop = "auto";
          alignmentStyle.marginBottom = "auto";
        }
      }
    }
    // non flex
    else {
      if (alignX === "start") {
        alignmentStyle.marginRight = "auto";
      } else if (alignX === "center") {
        alignmentStyle.marginLeft = "auto";
        alignmentStyle.marginRight = "auto";
      } else if (alignX === "end") {
        alignmentStyle.marginLeft = "auto";
      }

      if (alignY === "start") {
        alignmentStyle.marginBottom = "auto";
      } else if (alignY === "center") {
        alignmentStyle.marginTop = "auto";
        alignmentStyle.marginBottom = "auto";
      } else if (alignY === "end") {
        alignmentStyle.marginTop = "auto";
      }
    }
  }

  {
    const expand = props.expand;
    delete props.expand;

    {
      const expandX = props.expandX || expand;
      delete props.expandX;
      if (expandX) {
        if (flexDirection === "row") {
          expansionStyle.flexGrow = 1; // Grow horizontally in row
        } else if (flexDirection === "column") {
          expansionStyle.width = "100%"; // Take full width in column
        } else {
          expansionStyle.width = "100%"; // Take full width outside flex
        }
      }
    }

    {
      const expandY = props.expandY || expand;
      delete props.expandY;
      if (expandY) {
        if (flexDirection === "row") {
          expansionStyle.height = "100%"; // Take full height in row
        } else if (flexDirection === "column") {
          expansionStyle.flexGrow = 1; // Grow vertically in column
        } else {
          expansionStyle.height = "100%"; // Take full height outside flex
        }
      }
    }
  }

  // Merge all styles for convenience
  const allStyles = {
    ...marginStyle,
    ...paddingStyle,
    ...alignmentStyle,
    ...expansionStyle,
  };

  return {
    margin: marginStyle,
    padding: paddingStyle,
    alignment: alignmentStyle,
    expansion: expansionStyle,
    all: allStyles,
  };
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
    width: 100%;
    height: 100%;
    opacity: 0;
    display: block;
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

  // ✅ Check if this should be a circle
  const maxPossibleRadius = Math.min(drawableWidth, drawableHeight) / 2;
  const actualRadius = Math.min(radius || Math.min(drawableWidth, drawableHeight) * 0.05, maxPossibleRadius // ✅ Limité au radius maximum possible
  );

  // ✅ Determine if we're dealing with a circle
  const isCircle = actualRadius >= maxPossibleRadius * 0.95; // 95% = virtually a circle

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
  .navi_inline_wrapper {
    position: relative;
    width: fit-content;
    display: inline-flex;
    height: fit-content;
    border-radius: inherit;
    cursor: inherit;
  }

  .navi_loading_rectangle_wrapper {
    pointer-events: none;
    position: absolute;
    z-index: 1;
    opacity: 0;
    top: var(--rectangle-top, 0);
    left: var(--rectangle-left, 0);
    bottom: var(--rectangle-bottom, 0);
    right: var(--rectangle-right, 0);
  }
  .navi_loading_rectangle_wrapper[data-visible] {
    opacity: 1;
  }
`;
const LoadableInlineElement = forwardRef((props, ref) => {
  const {
    // background props
    loading,
    containerRef,
    targetSelector,
    color,
    inset,
    spacingTop,
    spacingLeft,
    spacingBottom,
    spacingRight,
    // other props
    width,
    height,
    children,
    ...rest
  } = props;
  return jsxs("span", {
    ...rest,
    ref: ref,
    className: "navi_inline_wrapper",
    style: {
      ...rest.style,
      ...(width ? {
        width
      } : {}),
      ...(height ? {
        height
      } : {})
    },
    children: [jsx(LoaderBackground, {
      loading,
      containerRef,
      targetSelector,
      color,
      inset,
      spacingTop,
      spacingLeft,
      spacingBottom,
      spacingRight
    }), children]
  });
});
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

/**
 * Merges a component's base style with style received from props.
 * Automatically normalizes style values (e.g., adds "px" units where needed).
 *
 * ```jsx
 * const MyButton = ({ style, children }) => (
 *   <button style={withPropsStyle({ padding: 10 }, style)}>
 *     {children}
 *   </button>
 * );
 *
 * // Usage:
 * <MyButton style={{ color: 'red', fontSize: 14 }} />
 * <MyButton style="color: blue; margin: 5px;" />
 * <MyButton /> // Just base styles
 * ```
 *
 * @param {string|object} baseStyle - The component's base style (string or object)
 * @param {string|object} [styleFromProps] - Additional style from props (optional)
 * @returns {object} The merged and normalized style object
 */
const withPropsStyle = (baseStyle, styleFromProps) => {
  return mergeStyles(baseStyle, styleFromProps, "css");
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

const initCustomField = (customField, field) => {
  const [teardown, addTeardown] = createPubSub();

  const addEventListener = (element, eventType, listener) => {
    element.addEventListener(eventType, listener);
    return addTeardown(() => {
      element.removeEventListener(eventType, listener);
    });
  };
  const updateBooleanAttribute = (attributeName, isPresent) => {
    if (isPresent) {
      customField.setAttribute(attributeName, "");
    } else {
      customField.removeAttribute(attributeName);
    }
  };
  const checkPseudoClasses = () => {
    const hover = field.matches(":hover");
    const active = field.matches(":active");
    const checked = field.matches(":checked");
    const focus = field.matches(":focus");
    const focusVisible = field.matches(":focus-visible");
    const valid = field.matches(":valid");
    const invalid = field.matches(":invalid");
    updateBooleanAttribute(`data-hover`, hover);
    updateBooleanAttribute(`data-active`, active);
    updateBooleanAttribute(`data-checked`, checked);
    updateBooleanAttribute(`data-focus`, focus);
    updateBooleanAttribute(`data-focus-visible`, focusVisible);
    updateBooleanAttribute(`data-valid`, valid);
    updateBooleanAttribute(`data-invalid`, invalid);
  };

  // :hover
  addEventListener(field, "mouseenter", checkPseudoClasses);
  addEventListener(field, "mouseleave", checkPseudoClasses);
  // :active
  addEventListener(field, "mousedown", checkPseudoClasses);
  addEventListener(document, "mouseup", checkPseudoClasses);
  // :focus
  addEventListener(field, "focusin", checkPseudoClasses);
  addEventListener(field, "focusout", checkPseudoClasses);
  // :focus-visible
  addEventListener(document, "keydown", checkPseudoClasses);
  addEventListener(document, "keyup", checkPseudoClasses);
  // :checked
  if (field.type === "checkbox") {
    // Listen to user interactions
    addEventListener(field, "input", checkPseudoClasses);

    // Intercept programmatic changes to .checked property
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "checked",
    );
    Object.defineProperty(field, "checked", {
      get: originalDescriptor.get,
      set(value) {
        originalDescriptor.set.call(this, value);
        checkPseudoClasses();
      },
      configurable: true,
    });
    addTeardown(() => {
      // Restore original property descriptor
      Object.defineProperty(field, "checked", originalDescriptor);
    });
  } else if (field.type === "radio") {
    // Listen to changes on the radio group
    const radioSet =
      field.closest("[data-radio-list], fieldset, form") || document;
    addEventListener(radioSet, "input", checkPseudoClasses);

    // Intercept programmatic changes to .checked property
    const originalDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "checked",
    );
    Object.defineProperty(field, "checked", {
      get: originalDescriptor.get,
      set(value) {
        originalDescriptor.set.call(this, value);
        checkPseudoClasses();
      },
      configurable: true,
    });
    addTeardown(() => {
      // Restore original property descriptor
      Object.defineProperty(field, "checked", originalDescriptor);
    });
  } else if (field.tagName === "INPUT") {
    addEventListener(field, "input", checkPseudoClasses);
  }

  // just in case + catch use forcing them in chrome devtools
  const interval = setInterval(() => {
    checkPseudoClasses();
  }, 150);
  addTeardown(() => {
    clearInterval(interval);
  });

  return teardown;
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
const Label = forwardRef((props, ref) => {
  const {
    readOnly,
    disabled,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [inputReadOnly, setInputReadOnly] = useState(false);
  const innerReadOnly = readOnly || inputReadOnly;
  const [inputDisabled, setInputDisabled] = useState(false);
  const innerDisabled = disabled || inputDisabled;
  return jsx("label", {
    ref: innerRef,
    "data-readonly": innerReadOnly ? "" : undefined,
    "data-disabled": innerDisabled ? "" : undefined,
    ...rest,
    children: jsx(ReportReadOnlyOnLabelContext.Provider, {
      value: setInputReadOnly,
      children: jsx(ReportDisabledOnLabelContext.Provider, {
        value: setInputDisabled,
        children: children
      })
    })
  });
});

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
  } = {},
) => {
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const formContext = useContext(FormContext);
  const { id, name, onUIStateChange, action } = props;
  const uncontrolled = !formContext && !action;
  const [navState, setNavState] = useNavState(id);

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
        if (state !== currentState) {
          uiStateController.state = state;
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
  const { onUIStateChange, name } = props;
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
    :root {
      --navi-checkmark-color-light: white;
      --navi-checkmark-color-dark: rgb(55, 55, 55);
      --navi-checkmark-color: var(--navi-checkmark-light-color);
    }

    .navi_checkbox {
      position: relative;
      display: inline-flex;
      box-sizing: content-box;

      --outline-offset: 1px;
      --outline-width: 2px;
      --border-width: 1px;
      --border-radius: 2px;
      --width: 13px;
      --height: 13px;

      --outline-color: light-dark(#4476ff, #3b82f6);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: light-dark(#4476ff, #3b82f6);
      /* --color: currentColor; */
      --checkmark-color: var(--navi-checkmark-color);

      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-disabled: var(--border-color-readonly);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-checked-readonly: #d3d3d3;
      --border-color-checked-disabled: #d3d3d3;
      --background-color-checked-readonly: var(
        --navi-background-color-readonly
      );
      --background-color-checked-disabled: var(
        --navi-background-color-disabled
      );
      --checkmark-color-readonly: var(--navi-color-readonly);
      --checkmark-color-disabled: var(--navi-color-disabled);
    }
    .navi_checkbox input {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 0;
      border: none;
      opacity: 0;
      cursor: inherit;
    }
    .navi_checkbox_field {
      display: inline-flex;
      box-sizing: border-box;
      width: var(--width);
      height: var(--height);
      margin: 3px 3px 3px 4px;
      background-color: var(--background-color);
      border-width: var(--border-width);
      border-style: solid;
      border-color: var(--border-color);
      border-radius: var(--border-radius);
      outline-width: var(--outline-width);

      outline-style: none;

      outline-color: var(--outline-color);
      outline-offset: var(--outline-offset);
      /* color: var(--color); */
    }
    .navi_checkbox_marker {
      width: 100%;
      height: 100%;
      opacity: 0;
      transform: scale(0.5);
      transition: all 0.15s ease;
      pointer-events: none;
    }

    /* Focus */
    .navi_checkbox[data-focus-visible] .navi_checkbox_field {
      outline-style: solid;
    }
    /* Hover */
    .navi_checkbox[data-hover] .navi_checkbox_field {
      --border-color: var(--border-color-hover);
    }
    /* Checked */
    .navi_checkbox[data-checked] .navi_checkbox_field {
      --background-color: var(--accent-color);
      --border-color: var(--accent-color);
    }
    .navi_checkbox[data-checked] .navi_checkbox_marker {
      opacity: 1;
      stroke: var(--checkmark-color);
      transform: scale(1);
    }
    /* Readonly */
    .navi_checkbox[data-readonly] .navi_checkbox_field,
    .navi_checkbox[data-readonly][data-hover] .navi_checkbox_field {
      --border-color: var(--border-color-readonly);
      --background-color: var(--background-color-readonly);
    }
    .navi_checkbox[data-checked][data-readonly] .navi_checkbox_field {
      --background-color: var(--background-color-checked-readonly);
      --border-color: var(--border-color-checked-readonly);
    }
    .navi_checkbox[data-checked][data-readonly] .navi_checkbox_marker {
      stroke: var(--checkmark-color-readonly);
    }
    /* Disabled */
    .navi_checkbox[data-disabled] .navi_checkbox_field {
      --background-color: var(--background-color-disabled);
      --border-color: var(--border-color-disabled);
    }
    .navi_checkbox[data-checked][data-disabled] .navi_checkbox_field {
      --border-color: var(--border-color-checked-disabled);
      --background-color: var(--background-color-checked-disabled);
    }

    .navi_checkbox[data-checked][data-disabled] .navi_checkbox_marker {
      stroke: var(--checkmark-color-disabled);
    }
  }
`;
const InputCheckbox = forwardRef((props, ref) => {
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
  const checkbox = renderActionableComponent(props, ref, {
    Basic: InputCheckboxBasic,
    WithAction: InputCheckboxWithAction,
    InsideForm: InputCheckboxInsideForm
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: checkbox
    })
  });
});
const InputCheckboxBasic = forwardRef((props, ref) => {
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
    name,
    readOnly,
    disabled,
    required,
    loading,
    autoFocus,
    constraints = [],
    appeareance = "navi",
    // "navi" or "default"
    accentColor,
    onClick,
    onInput,
    style,
    ...rest
  } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const innerName = name || contextFieldName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading = loading || contextLoading && loadingElement === innerRef.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  reportReadOnlyOnLabel?.(innerReadOnly);
  reportDisabledOnLabel?.(innerDisabled);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const checked = Boolean(uiState);
  const actionName = rest["data-action"];
  if (actionName) {
    delete rest["data-action"];
  }
  const inputCheckbox = jsx("input", {
    ...rest,
    ref: innerRef,
    type: "checkbox",
    style: appeareance === "default" ? style : undefined,
    name: innerName,
    checked: checked,
    readOnly: innerReadOnly,
    disabled: innerDisabled,
    required: innerRequired,
    "data-callout-arrow-x": "center",
    onClick: e => {
      if (innerReadOnly) {
        e.preventDefault();
      }
      onClick?.(e);
    },
    onInput: e => {
      const checkbox = e.target;
      const checkboxIsChecked = checkbox.checked;
      uiStateController.setUIState(checkboxIsChecked, e);
      onInput?.(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onsetuistate: e => {
      uiStateController.setUIState(e.detail.value, e);
    }
  });
  const loaderProps = {
    loading: innerLoading,
    inset: -1,
    style: {
      "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)"
    },
    color: "var(--accent-color)"
  };
  if (appeareance === "navi") {
    return jsx(NaviCheckbox, {
      "data-action": actionName,
      inputRef: innerRef,
      accentColor: accentColor,
      readOnly: readOnly,
      disabled: innerDisabled,
      style: style,
      children: jsx(LoaderBackground, {
        ...loaderProps,
        targetSelector: ".navi_checkbox_field",
        children: inputCheckbox
      })
    });
  }
  return jsx(LoadableInlineElement, {
    ...loaderProps,
    "data-action": actionName,
    children: inputCheckbox
  });
});
const NaviCheckbox = ({
  accentColor,
  readOnly,
  disabled,
  inputRef,
  style,
  children,
  ...rest
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    const naviCheckbox = ref.current;
    const colorPicked = pickLightOrDark(naviCheckbox, "var(--accent-color)", "var(--navi-checkmark-color-light)", "var(--navi-checkmark-color-dark)");
    naviCheckbox.style.setProperty("--checkmark-color", colorPicked);
  }, [accentColor]);
  useLayoutEffect(() => {
    return initCustomField(ref.current, inputRef.current);
  }, []);
  const {
    all
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle({
    ...all,
    ...(accentColor ? {
      "--accent-color": accentColor
    } : {})
  }, style);
  return jsxs("div", {
    ...rest,
    ref: ref,
    className: "navi_checkbox",
    style: innerStyle,
    "data-readonly": readOnly ? "" : undefined,
    "data-disabled": disabled ? "" : undefined,
    children: [children, jsx("div", {
      className: "navi_checkbox_field",
      children: jsx("svg", {
        viewBox: "0 0 12 12",
        "aria-hidden": "true",
        className: "navi_checkbox_marker",
        children: jsx("path", {
          d: "M10.5 2L4.5 9L1.5 5.5",
          fill: "none",
          strokeWidth: "2"
        })
      })
    })]
  });
};
const InputCheckboxWithAction = forwardRef((props, ref) => {
  const uiStateController = useContext(UIStateControllerContext);
  const uiState = useContext(UIStateContext);
  const {
    action,
    onCancel,
    onChange,
    actionErrorEffect,
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd,
    loading,
    ...rest
  } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const [actionBoundToUIState] = useActionBoundToOneParam(action, uiState);
  const {
    loading: actionLoading
  } = useActionStatus(actionBoundToUIState);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });

  // In this situation updating the ui state === calling associated action
  // so cance/abort/error have to revert the ui state to the one before user interaction
  // to show back the real state of the checkbox (not the one user tried to set)
  useActionEvents(innerRef, {
    onCancel: (e, reason) => {
      if (reason === "blur_invalid") {
        return;
      }
      uiStateController.resetUIState(e);
      onCancel?.(e, reason);
    },
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
    ref: innerRef,
    loading: loading || actionLoading,
    onChange: e => {
      requestAction(e.target, actionBoundToUIState, {
        event: e
      });
      onChange?.(e);
    }
  });
});
const InputCheckboxInsideForm = InputCheckboxBasic;

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    :root {
      --navi-radiomark-color: light-dark(#4476ff, #3b82f6);
    }

    .navi_radio {
      position: relative;
      display: inline-flex;
      box-sizing: content-box;

      --outline-offset: 1px;
      --outline-width: 2px;
      --width: 13px;
      --height: 13px;

      --outline-color: light-dark(#4476ff, #3b82f6);
      --border-color: light-dark(#767676, #8e8e93);
      --background-color: white;
      --accent-color: var(--navi-radiomark-color);
      --mark-color: var(--accent-color);

      /* light-dark(rgba(239, 239, 239, 0.3), rgba(59, 59, 59, 0.3)); */
      --accent-color-checked: color-mix(
        in srgb,
        var(--accent-color) 70%,
        black
      );

      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-disabled: var(--border-color-readonly);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-checked: var(--accent-color);
      --border-color-checked-hover: var(--accent-color-checked);
      --border-color-checked-readonly: #d3d3d3;
      --border-color-checked-disabled: #d3d3d3;
      --background-color-readonly: var(--background-color);
      --background-color-disabled: var(--background-color);
      --background-color-checked-readonly: #d3d3d3;
      --background-color-checked-disabled: var(--background-color);
      --mark-color-hover: var(--accent-color-checked);
      --mark-color-readonly: grey;
      --mark-color-disabled: #eeeeee;
    }
    .navi_radio input {
      position: absolute;
      inset: 0;
      margin: 0;
      padding: 0;
      opacity: 0;
      cursor: inherit;
    }
    .navi_radio_field {
      display: inline-flex;
      width: var(--width);
      height: var(--height);
      margin-top: 3px;
      margin-right: 3px;
      margin-left: 5px;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      outline-width: var(--outline-width);

      outline-style: none;

      outline-color: var(--outline-color);

      outline-offset: var(--outline-offset);
    }
    .navi_radio_field svg {
      overflow: visible;
    }
    .navi_radio_border {
      fill: var(--background-color);
      stroke: var(--border-color);
    }
    .navi_radio_marker {
      width: 100%;
      height: 100%;
      opacity: 0;
      fill: var(--mark-color);
      transform: scale(0.3);
      transform-origin: center;
      pointer-events: none;
    }
    .navi_radio_dashed_border {
      display: none;
    }
    .navi_radio[data-transition] .navi_radio_marker {
      transition: all 0.15s ease;
    }
    .navi_radio[data-transition] .navi_radio_dashed_border {
      transition: all 0.15s ease;
    }
    .navi_radio[data-transition] .navi_radio_border {
      transition: all 0.15s ease;
    }

    /* Focus */
    .navi_radio[data-focus-visible] .navi_radio_field {
      outline-style: solid;
    }
    /* Hover */
    .navi_radio[data-hover] .navi_radio_border {
      stroke: var(--border-color-hover);
    }
    .navi_radio[data-hover] .navi_radio_marker {
      fill: var(--mark-color-hover);
    }
    /* Checked */
    .navi_radio[data-checked] .navi_radio_border {
      stroke: var(--border-color-checked);
    }
    .navi_radio[data-checked] .navi_radio_marker {
      opacity: 1;
      transform: scale(1);
    }
    .navi_radio[data-hover][data-checked] .navi_radio_border {
      stroke: var(--border-color-checked-hover);
    }
    /* Readonly */
    .navi_radio[data-readonly] .navi_radio_border {
      fill: var(--background-color-readonly);
      stroke: var(--border-color-readonly);
    }
    .navi_radio[data-readonly] .navi_radio_marker {
      fill: var(--mark-color-readonly);
    }
    .navi_radio[data-readonly] .navi_radio_dashed_border {
      display: none;
    }
    .navi_radio[data-checked][data-readonly] .navi_radio_border {
      fill: var(--background-color-checked-readonly);
      stroke: var(--border-color-checked-readonly);
    }
    .navi_radio[data-checked][data-readonly] .navi_radio_marker {
      fill: var(--mark-color-readonly);
    }
    /* Disabled */
    .navi_radio[data-disabled] .navi_radio_border {
      fill: var(--background-color-disabled);
      stroke: var(--border-color-disabled);
    }
    .navi_radio[data-disabled] .navi_radio_marker {
      fill: var(--mark-color-disabled);
    }
    .navi_radio[data-hover][data-checked][data-disabled] .navi_radio_border {
      stroke: var(--border-color-disabled);
    }
    .navi_radio[data-checked][data-disabled] .navi_radio_marker {
      fill: var(--mark-color-disabled);
    }
  }
`;
const InputRadio = forwardRef((props, ref) => {
  const {
    value = "on"
  } = props;
  const uiStateController = useUIStateController(props, "radio", {
    statePropName: "checked",
    fallbackState: false,
    getStateFromProp: checked => checked ? value : undefined,
    getPropFromState: Boolean
  });
  const uiState = useUIState(uiStateController);
  const radio = renderActionableComponent(props, ref, {
    Basic: InputRadioBasic,
    WithAction: InputRadioWithAction,
    InsideForm: InputRadioInsideForm
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: radio
    })
  });
});
const InputRadioBasic = forwardRef((props, ref) => {
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
    name,
    readOnly,
    disabled,
    required,
    loading,
    autoFocus,
    constraints = [],
    appeareance = "navi",
    // "navi" or "default"
    accentColor,
    onClick,
    onInput,
    style,
    ...rest
  } = props;
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const innerName = name || contextName;
  const innerDisabled = disabled || contextDisabled;
  const innerRequired = required || contextRequired;
  const innerLoading = loading || contextLoading && contextLoadingElement === innerRef.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  reportReadOnlyOnLabel?.(innerReadOnly);
  reportDisabledOnLabel?.(innerDisabled);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const checked = Boolean(uiState);
  // we must first dispatch an event to inform all other radios they where unchecked
  // this way each other radio uiStateController knows thery are unchecked
  // we do this on "input"
  // but also when we are becoming checked from outside (hence the useLayoutEffect)
  const updateOtherRadiosInGroup = () => {
    const thisRadio = innerRef.current;
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
  const actionName = rest["data-action"];
  if (actionName) {
    delete rest["data-action"];
  }
  const inputRadio = jsx("input", {
    ...rest,
    ref: innerRef,
    type: "radio",
    style: appeareance === "default" ? style : undefined,
    name: innerName,
    checked: checked,
    disabled: innerDisabled,
    required: innerRequired,
    "data-callout-arrow-x": "center",
    onClick: e => {
      if (innerReadOnly) {
        e.preventDefault();
      }
      onClick?.(e);
    },
    onInput: e => {
      const radio = e.target;
      const radioIsChecked = radio.checked;
      if (radioIsChecked) {
        updateOtherRadiosInGroup();
      }
      uiStateController.setUIState(radioIsChecked, e);
      onInput?.(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onsetuistate: e => {
      uiStateController.setUIState(e.detail.value, e);
    }
  });
  const loaderProps = {
    loading: innerLoading,
    inset: -1,
    style: {
      "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)"
    },
    color: "var(--accent-color)"
  };
  if (appeareance === "navi") {
    return jsx(NaviRadio, {
      "data-action": actionName,
      inputRef: innerRef,
      accentColor: accentColor,
      readOnly: innerReadOnly,
      disabled: innerDisabled,
      style: style,
      children: jsx(LoaderBackground, {
        ...loaderProps,
        targetSelector: ".navi_radio_field",
        children: inputRadio
      })
    });
  }
  return jsx(LoadableInlineElement, {
    ...loaderProps,
    "data-action": actionName,
    children: inputRadio
  });
});
const NaviRadio = ({
  inputRef,
  accentColor,
  readOnly,
  disabled,
  style,
  children,
  ...rest
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    return initCustomField(ref.current, inputRef.current);
  }, []);
  const {
    all
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle({
    ...all,
    ...(accentColor ? {
      "--accent-color": accentColor
    } : {})
  }, style);
  return jsxs("span", {
    ...rest,
    ref: ref,
    className: "navi_radio",
    style: innerStyle,
    "data-readonly": readOnly ? "" : undefined,
    "data-disabled": disabled ? "" : undefined,
    children: [children, jsx("span", {
      className: "navi_radio_field",
      children: jsxs("svg", {
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
      })
    })]
  });
};
const InputRadioWithAction = () => {
  throw new Error(`<Input type="radio" /> with an action make no sense. Use <RadioList action={something} /> instead`);
};
const InputRadioInsideForm = InputRadio;

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

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_input {
      --border-width: 1px;
      --outline-width: 1px;
      --outer-width: calc(var(--border-width) + var(--outline-width));
      --padding-x: 6px;
      --padding-y: 1px;

      --outline-color: light-dark(#4476ff, #3b82f6);

      --border-radius: 2px;
      --border-color: light-dark(#767676, #8e8e93);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-active: color-mix(in srgb, var(--border-color) 90%, black);
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 45%,
        transparent
      );
      --border-color-disabled: var(--border-color-readonly);

      --background-color: white;
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
      --background-color-readonly: var(--background-color);
      --background-color-disabled: color-mix(
        in srgb,
        var(--background-color) 60%,
        transparent
      );

      --color: currentColor;
      --color-readonly: color-mix(in srgb, currentColor 60%, transparent);
      --color-disabled: var(--color-readonly);

      width: 100%;
      color: var(--color);

      background-color: var(--background-color);
      border-width: var(--outer-width);
      border-width: var(--outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--border-radius);
      outline-width: var(--border-width);
      outline-style: solid;
      outline-color: var(--border-color);
      outline-offset: calc(-1 * (var(--border-width)));
    }
    /* Focus */
    .navi_input[data-focus] {
      border-color: var(--outline-color);
      outline-width: var(--outer-width);
      outline-color: var(--outline-color);
      outline-offset: calc(-1 * var(--outer-width));
    }
    /* Readonly */
    .navi_input[data-readonly] {
      color: var(--color-readonly);
      background-color: var(--background-color-readonly);
      outline-color: var(--border-color-readonly);
    }
    .navi_input[data-readonly]::placeholder {
      color: var(--color-readonly);
    }
    /* Disabled */
    .navi_input[data-disabled] {
      color: var(--color-disabled);
      background-color: var(--background-color-disabled);
      outline-color: var(--border-color-disabled);
    }
    /* Callout (info, warning, error) */
    .navi_input[data-callout] {
      border-color: var(--callout-color);
    }
  }
`;
const InputTextual = forwardRef((props, ref) => {
  const uiStateController = useUIStateController(props, "input");
  const uiState = useUIState(uiStateController);
  const input = renderActionableComponent(props, ref, {
    Basic: InputTextualBasic,
    WithAction: InputTextualWithAction,
    InsideForm: InputTextualInsideForm
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: input
    })
  });
});
const InputTextualBasic = forwardRef((props, ref) => {
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
    constraints = [],
    loading,
    autoFocus,
    autoFocusVisible,
    autoSelect,
    // visual
    appearance = "navi",
    accentColor,
    className,
    style,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const innerValue = type === "datetime-local" ? convertToLocalTimezone(uiState) : uiState;
  const innerLoading = loading || contextLoading && contextLoadingElement === innerRef.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  // infom any <label> parent of our readOnly state
  reportReadOnlyOnLabel?.(innerReadOnly);
  useAutoFocus(innerRef, autoFocus, {
    autoFocusVisible,
    autoSelect
  });
  useConstraints(innerRef, constraints);
  const innerClassName = withPropsClassName(appearance === "navi" ? "navi_input" : undefined, className);
  const {
    margin,
    padding,
    alignment,
    expansion
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle(padding, style);
  const inputTextual = jsx("input", {
    ...rest,
    ref: innerRef,
    className: innerClassName,
    style: innerStyle,
    type: type,
    "data-value": uiState,
    value: innerValue,
    readOnly: innerReadOnly,
    disabled: innerDisabled,
    "data-readOnly": innerReadOnly ? "" : undefined,
    "data-disabled": innerDisabled ? "" : undefined,
    onInput: e => {
      let inputValue;
      if (type === "number") {
        inputValue = e.target.valueAsNumber;
      } else if (type === "datetime-local") {
        inputValue = convertToUTCTimezone(e.target.value);
      } else {
        inputValue = e.target.value;
      }
      uiStateController.setUIState(inputValue, e);
      onInput?.(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onresetuistate: e => {
      uiStateController.resetUIState(e);
    }
    // eslint-disable-next-line react/no-unknown-property
    ,
    onsetuistate: e => {
      uiStateController.setUIState(e.detail.value, e);
    }
  });
  useLayoutEffect(() => {
    return initCustomField(innerRef.current, innerRef.current);
  }, []);
  if (type === "hidden") {
    return inputTextual;
  }
  return jsx(LoadableInlineElement, {
    loading: innerLoading,
    style: {
      ...margin,
      ...alignment,
      ...expansion,
      "--accent-color": accentColor || "light-dark(#355fcc, #4476ff)"
    },
    color: "var(--accent-color)",
    inset: -1,
    children: inputTextual
  });
});
const InputTextualWithAction = forwardRef((props, ref) => {
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
  const innerRef = useRef(null);
  useImperativeHandle(ref, () => innerRef.current);
  const [boundAction] = useActionBoundToOneParam(action, uiState);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  // here updating the input won't call the associated action
  // (user have to blur or press enter for this to happen)
  // so we can keep the ui state on cancel/abort/error and let user decide
  // to update ui state or retry via blur/enter as is
  useActionEvents(innerRef, {
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
    ref: innerRef,
    loading: loading || actionLoading
  });
});
const InputTextualInsideForm = forwardRef((props, ref) => {
  const {
    // We destructure formContext to avoid passing it to the underlying input element
    // eslint-disable-next-line no-unused-vars
    formContext,
    ...rest
  } = props;
  return jsx(InputTextualBasic, {
    ...rest,
    ref: ref
  });
});

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

const Input = forwardRef((props, ref) => {
  const {
    type
  } = props;
  if (type === "radio") {
    return jsx(InputRadio, {
      ...props,
      ref: ref
    });
  }
  if (type === "checkbox") {
    return jsx(InputCheckbox, {
      ...props,
      ref: ref
    });
  }
  return jsx(InputTextual, {
    ...props,
    ref: ref
  });
});

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

installImportMetaCss(import.meta);import.meta.css = /* css */`
  @layer navi {
    .navi_button {
      position: relative;
      display: inline-flex;
      width: fit-content;
      height: fit-content;
      padding: 0;
      background: none;
      border: none;
      border-radius: inherit;
      outline: none;
      cursor: pointer;

      --border-width: 1px;
      --outline-width: 1px;
      --outer-width: calc(var(--border-width) + var(--outline-width));
      --padding-x: 6px;
      --padding-y: 1px;

      --outline-color: light-dark(#4476ff, #3b82f6);

      --border-radius: 2px;
      --border-color: light-dark(#767676, #8e8e93);
      --border-color-hover: color-mix(in srgb, var(--border-color) 70%, black);
      --border-color-active: color-mix(in srgb, var(--border-color) 90%, black);
      --border-color-readonly: color-mix(
        in srgb,
        var(--border-color) 30%,
        white
      );
      --border-color-disabled: var(--border-color-readonly);

      --background-color: light-dark(#f3f4f6, #2d3748);
      --background-color-hover: color-mix(
        in srgb,
        var(--background-color) 95%,
        black
      );
      --background-color-readonly: var(--background-color);
      --background-color-disabled: var(--background-color);

      --color: currentColor;
      --color-readonly: color-mix(in srgb, currentColor 30%, transparent);
      --color-disabled: var(--color-readonly);
    }
    .navi_button_content {
      position: relative;
      display: inline-flex;
      width: 100%;
      padding-top: var(--padding-y);
      padding-right: var(--padding-x);
      padding-bottom: var(--padding-y);
      padding-left: var(--padding-x);
      color: var(--color);
      background-color: var(--background-color);
      border-width: var(--outer-width);
      border-style: solid;
      border-color: transparent;
      border-radius: var(--border-radius);
      outline-width: var(--border-width);
      outline-style: solid;
      outline-color: var(--border-color);
      outline-offset: calc(-1 * (var(--border-width)));
      transition-property: transform;
      transition-duration: 0.15s;
      transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    }
    .navi_button_shadow {
      position: absolute;
      inset: calc(-1 * var(--outer-width));
      border-radius: inherit;
      pointer-events: none;
    }
    /* Focus */
    .navi_button[data-focus-visible] .navi_button_content {
      --border-color: var(--outline-color);
      outline-width: var(--outer-width);
      outline-offset: calc(-1 * var(--outer-width));
    }
    /* Hover */
    .navi_button[data-hover] .navi_button_content {
      --border-color: var(--border-color-hover);
      --background-color: var(--background-color-hover);
    }
    /* Active */
    .navi_button[data-active] .navi_button_content {
      --outline-color: var(--border-color-active);
      transform: scale(0.9);
    }
    .navi_button[data-active] .navi_button_shadow {
      box-shadow:
        inset 0 3px 6px rgba(0, 0, 0, 0.2),
        inset 0 1px 2px rgba(0, 0, 0, 0.3),
        inset 0 0 0 1px rgba(0, 0, 0, 0.1),
        inset 2px 0 4px rgba(0, 0, 0, 0.1),
        inset -2px 0 4px rgba(0, 0, 0, 0.1);
    }
    /* Readonly */
    .navi_button[data-readonly] .navi_button_content {
      --border-color: var(--border-color-disabled);
      --outline-color: var(--border-color-readonly);
      --background-color: var(--background-color-readonly);
      --color: var(--color-readonly);
    }
    /* Disabled */
    .navi_button[data-disabled] {
      cursor: default;
    }
    .navi_button[data-disabled] .navi_button_content {
      --border-color: var(--border-color-disabled);
      --background-color: var(--background-color-disabled);
      --color: var(--color-disabled);
      transform: none; /* no active effect */
    }
    .navi_button[data-disabled] .navi_button_shadow {
      box-shadow: none;
    }
    /* Callout (info, warning, error) */
    .navi_button[data-callout] .navi_button_content {
      --border-color: var(--callout-color);
    }

    /* Discrete variant */
    .navi_button[data-discrete] .navi_button_content {
      --background-color: transparent;
      --border-color: transparent;
    }
    .navi_button[data-discrete][data-hover] .navi_button_content {
      --border-color: var(--border-color-hover);
    }
    .navi_button[data-discrete][data-readonly] .navi_button_content {
      --border-color: transparent;
    }
    .navi_button[data-discrete][data-disabled] .navi_button_content {
      --border-color: transparent;
    }
    button[data-discrete] {
      background-color: transparent;
      border-color: transparent;
    }
    button[data-discrete]:hover {
      border-color: revert;
    }
    button[data-discrete][data-readonly],
    button[data-discrete][data-disabled] {
      border-color: transparent;
    }
  }
`;
const Button = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: ButtonBasic,
    WithAction: ButtonWithAction,
    InsideForm: ButtonInsideForm,
    WithActionInsideForm: ButtonWithActionInsideForm
  });
});
const ButtonBasic = forwardRef((props, ref) => {
  const contextLoading = useContext(LoadingContext);
  const contextLoadingElement = useContext(LoadingElementContext);
  const contextReadOnly = useContext(ReadOnlyContext);
  const contextDisabled = useContext(DisabledContext);
  const {
    readOnly,
    disabled,
    loading,
    constraints = [],
    autoFocus,
    // visual
    appearance = "navi",
    discrete,
    className,
    style,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const innerLoading = loading || contextLoading && contextLoadingElement === innerRef.current;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading;
  const innerDisabled = disabled || contextDisabled;
  let buttonChildren;
  if (appearance === "navi") {
    buttonChildren = jsx(NaviButton, {
      buttonRef: innerRef,
      children: children
    });
  } else {
    buttonChildren = children;
  }
  const innerClassName = withPropsClassName(appearance === "navi" ? "navi_button" : undefined, className);
  const {
    all
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle(all, style);
  return jsx("button", {
    ...rest,
    ref: innerRef,
    className: innerClassName,
    style: innerStyle,
    disabled: innerDisabled,
    "data-discrete": discrete ? "" : undefined,
    "data-readonly": innerReadOnly ? "" : undefined,
    "data-readonly-silent": innerLoading ? "" : undefined,
    "data-disabled": innerDisabled ? "" : undefined,
    "data-callout-arrow-x": "center",
    "aria-busy": innerLoading,
    children: jsx(LoaderBackground, {
      loading: innerLoading,
      inset: -1,
      color: "light-dark(#355fcc, #3b82f6)",
      children: buttonChildren
    })
  });
});
const NaviButton = ({
  buttonRef,
  children
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    return initCustomField(buttonRef.current, buttonRef.current);
  }, []);
  return jsxs("span", {
    ref: ref,
    className: "navi_button_content",
    children: [children, jsx("span", {
      className: "navi_button_shadow"
    })]
  });
};
const ButtonWithAction = forwardRef((props, ref) => {
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
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const boundAction = useAction(action);
  const {
    loading: actionLoading
  } = useActionStatus(boundAction);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect
  });
  const innerLoading = loading || actionLoading;
  useActionEvents(innerRef, {
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
    ref: innerRef,
    loading: innerLoading,
    children: children
  });
});
const ButtonInsideForm = forwardRef((props, ref) => {
  const {
    // eslint-disable-next-line no-unused-vars
    formContext,
    type,
    children,
    loading,
    readOnly,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const innerLoading = loading;
  const innerReadOnly = readOnly;
  return jsx(ButtonBasic, {
    ...rest,
    ref: innerRef,
    type: type,
    loading: innerLoading,
    readOnly: innerReadOnly,
    children: children
  });
});
const ButtonWithActionInsideForm = forwardRef((props, ref) => {
  const formAction = useContext(FormActionContext);
  const {
    // eslint-disable-next-line no-unused-vars
    formContext,
    // to avoid passing it to the button element
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
  const formParamsSignal = getActionPrivateProperties(formAction).paramsSignal;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const actionBoundToFormParams = useAction(action, formParamsSignal);
  const {
    loading: actionLoading
  } = useActionStatus(actionBoundToFormParams);
  const innerLoading = loading || actionLoading;
  useFormEvents(innerRef, {
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
    ref: innerRef,
    type: type,
    loading: innerLoading,
    onactionrequested: e => {
      forwardActionRequested(e, actionBoundToFormParams, e.target.form);
    },
    children: children
  });
});

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
  const checkboxList = renderActionableComponent(props, ref, {
    Basic: CheckboxListBasic,
    WithAction: CheckboxListWithAction,
    InsideForm: CheckboxListInsideForm
  });
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
const CheckboxListWithAction = forwardRef((props, ref) => {
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
const CheckboxListInsideForm = CheckboxListBasic;

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

const Form = forwardRef((props, ref) => {
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
  const form = renderActionableComponent(props, ref, {
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
});
const FormBasic = forwardRef((props, ref) => {
  const uiStateController = useContext(UIStateControllerContext);
  const {
    readOnly,
    loading,
    style,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);

  // instantiation validation to:
  // - receive "requestsubmit" custom event ensure submit is prevented
  // (and also execute action without validation if form.submit() is ever called)
  useConstraints(innerRef, []);
  const innerReadOnly = readOnly || loading;
  const formContextValue = useMemo(() => {
    return {
      loading
    };
  }, [loading]);
  const {
    all
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle(all, style);
  return jsx("form", {
    ...rest,
    ref: innerRef,
    style: innerStyle,
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
});
const FormWithAction = forwardRef((props, ref) => {
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
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [actionBoundToUIState] = useActionBoundToOneParam(action, uiState);
  const executeAction = useExecuteAction(innerRef, {
    errorEffect: actionErrorEffect,
    errorMapping
  });
  const {
    actionPending,
    actionRequester: formActionRequester
  } = useRequestedActionStatus(innerRef);
  useActionEvents(innerRef, {
    onPrevented: onActionPrevented,
    onRequested: e => {
      forwardActionRequested(e, actionBoundToUIState);
    },
    onAction: e => {
      const form = innerRef.current;
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
    ref: innerRef,
    loading: innerLoading,
    children: jsx(FormActionContext.Provider, {
      value: actionBoundToUIState,
      children: jsx(LoadingElementContext.Provider, {
        value: formActionRequester,
        children: children
      })
    })
  });
});

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
  @layer navi {
    .navi_radio_list {
      display: flex;
      flex-direction: column;
    }
  }
`;
const RadioList = forwardRef((props, ref) => {
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
  const radioList = renderActionableComponent(props, ref, {
    Basic: RadioListBasic,
    WithAction: RadioListWithAction,
    InsideForm: RadioListInsideForm
  });
  return jsx(UIStateControllerContext.Provider, {
    value: uiStateController,
    children: jsx(UIStateContext.Provider, {
      value: uiState,
      children: radioList
    })
  });
});
const Radio = InputRadio;
const RadioListBasic = forwardRef((props, ref) => {
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
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const innerLoading = loading || contextLoading;
  const innerReadOnly = readOnly || contextReadOnly || innerLoading || uiStateController.readOnly;
  const innerDisabled = disabled || contextDisabled;
  return jsx("div", {
    "data-action": rest["data-action"],
    ...rest,
    ref: innerRef,
    className: "navi_radio_list",
    "data-radio-list": true
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
const RadioListWithAction = forwardRef((props, ref) => {
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
  useImperativeHandle(ref, () => innerRef.current);
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
        requester: radio
      });
    },
    loading: loading || actionLoading,
    children: jsx(LoadingElementContext.Provider, {
      value: actionRequester,
      children: children
    })
  });
});
const RadioListInsideForm = RadioListBasic;

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

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_select[data-readonly] {
    pointer-events: none;
  }
`;
const Select = forwardRef((props, ref) => {
  const select = renderActionableComponent(props, ref, {
    Basic: SelectBasic,
    WithAction: SelectWithAction,
    InsideForm: SelectInsideForm
  });
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
const SelectBasic = forwardRef((props, ref) => {
  const {
    value: initialValue,
    id,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
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
const SelectWithAction = forwardRef((props, ref) => {
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
  const [navState, setNavState, resetNavState] = useNavState(id);
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
const SelectInsideForm = forwardRef((props, ref) => {
  const {
    id,
    name,
    value: externalValue,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const [navState, setNavState] = useNavState(id);
  const [value, setValue, initialValue] = [name, externalValue, navState];
  useEffect(() => {
    setNavState(value);
  }, [value]);
  useFormEvents(innerRef, {
    onFormReset: () => {
      setValue(undefined);
    },
    onFormActionAbort: () => {
      setValue(initialValue);
    },
    onFormActionError: () => {
      setValue(initialValue);
    }
  });
  return jsx(SelectControlled, {
    ref: innerRef,
    name: name,
    value: value,
    onChange: event => {
      const select = event.target;
      const selectedValue = select.checked;
      setValue(selectedValue);
    },
    ...rest,
    children: children
  });
});

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
    padding: 0;
    margin: -1px;
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
    padding: 0;
    margin: -1px;
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

installImportMetaCss(import.meta);import.meta.css = /* css */`
  :root {
    --navi-icon-align-y: center;
  }

  .navi_text {
    display: inline-flex;
    align-items: baseline;
    gap: 0.1em;
  }

  .navi_icon {
    --align-y: var(--navi-icon-align-y, center);

    display: inline-flex;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    align-self: var(--align-y);
    line-height: 1em;
  }
`;
const useTypographyStyle = props => {
  const color = props.color;
  const bold = props.bold;
  const italic = props.italic;
  const underline = props.underline;
  const size = props.size;
  delete props.color;
  delete props.bold;
  delete props.italic;
  delete props.underline;
  delete props.size;
  return {
    color,
    fontWeight: bold ? "bold" : bold === undefined ? undefined : "normal",
    fontStyle: italic ? "italic" : italic === undefined ? undefined : "normal",
    fontSize: size,
    textDecoration: underline ? "underline" : underline === undefined ? undefined : "none"
  };
};
const Text = ({
  style,
  children,
  ...rest
}) => {
  const {
    all
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle({
    ...all,
    ...useTypographyStyle(rest)
  }, style);
  return jsx("span", {
    ...rest,
    className: "navi_text",
    style: innerStyle,
    children: children
  });
};
const Icon = ({
  style,
  children,
  ...rest
}) => {
  const {
    all
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle({
    ...all,
    ...useTypographyStyle(rest)
  }, style);
  return jsx("span", {
    ...rest,
    className: "navi_icon",
    style: innerStyle,
    children: children
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_link {
    border-radius: 2px;
  }
  /* Focus */
  .navi_link:focus {
    position: relative;
    z-index: 1; /* Ensure focus outline is above other elements */
  }
  /* Visited */
  .navi_link[data-visited] {
    color: light-dark(#6a1b9a, #ab47bc);
  }
  /* Selected */
  .navi_link[aria-selected] {
    position: relative;
  }
  .navi_link[aria-selected="true"] {
    background-color: light-dark(#bbdefb, #2563eb);
  }
  .navi_link[aria-selected] input[type="checkbox"] {
    position: absolute;
    opacity: 0;
  }
  /* Active */
  .navi_link[data-active] {
    font-weight: bold;
  }
  /* Readonly */
  .navi_link[data-readonly] > * {
    opacity: 0.5;
  }
  /* Disabled */
  .navi_link[inert] {
    pointer-events: none;
  }
  .navi_link[inert] > * {
    opacity: 0.5;
  }
`;
const Link = forwardRef((props, ref) => {
  return renderActionableComponent(props, ref, {
    Basic: LinkBasic,
    WithAction: LinkWithAction
  });
});
const LinkBasic = forwardRef((props, ref) => {
  const selectionContext = useContext(SelectionContext);
  if (selectionContext) {
    return jsx(LinkWithSelection, {
      ref: ref,
      ...props
    });
  }
  return jsx(LinkPlain, {
    ref: ref,
    ...props
  });
});
const LinkPlain = forwardRef((props, ref) => {
  const {
    loading,
    readOnly,
    disabled,
    children,
    autoFocus,
    active,
    visited,
    spaceToClick = true,
    constraints = [],
    onClick,
    onKeyDown,
    href,
    // visual
    className,
    style,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const isVisited = useIsVisited(href);
  useAutoFocus(innerRef, autoFocus);
  useConstraints(innerRef, constraints);
  const shouldDimColor = readOnly || disabled;
  useDimColorWhen(innerRef, shouldDimColor);
  const innerClassName = withPropsClassName("navi_link", className);
  const {
    all
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle({
    ...all,
    ...useTypographyStyle(rest)
  }, style);
  return jsx(LoadableInlineElement, {
    loading: loading,
    color: "light-dark(#355fcc, #3b82f6)",
    children: jsx("a", {
      ...rest,
      ref: innerRef,
      href: href,
      className: innerClassName,
      style: innerStyle,
      "aria-busy": loading,
      inert: disabled,
      "data-disabled": disabled ? "" : undefined,
      "data-readonly": readOnly ? "" : undefined,
      "data-active": active ? "" : undefined,
      "data-visited": visited || isVisited ? "" : undefined,
      onClick: e => {
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
      children: children
    })
  });
});
const LinkWithSelection = forwardRef((props, ref) => {
  const {
    selection,
    selectionController
  } = useContext(SelectionContext);
  const {
    value = props.href,
    children,
    ...rest
  } = props;
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const {
    selected
  } = useSelectableElement(innerRef, {
    selection,
    selectionController
  });
  return jsx(LinkPlain, {
    ...rest,
    ref: innerRef,
    "data-value": value,
    "aria-selected": selected,
    children: children
  });
});

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
const LinkWithAction = forwardRef((props, ref) => {
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
  const innerRef = useRef();
  useImperativeHandle(ref, () => innerRef.current);
  const {
    actionPending
  } = useRequestedActionStatus(innerRef);
  const innerLoading = Boolean(loading || actionPending);
  useKeyboardShortcuts(innerRef, shortcuts, {
    onActionPrevented,
    onActionStart,
    onActionAbort,
    onActionError,
    onActionEnd
  });
  return jsx(LinkBasic, {
    ...rest,
    ref: innerRef,
    loading: innerLoading,
    readOnly: readOnly || actionPending,
    "data-readonly-silent": actionPending && !readOnly ? "" : undefined
    /* When we have keyboard shortcuts the link outline is visible on focus (not solely on focus-visible) */,
    "data-focus-visible": "",
    children: children
  });
});

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
 * - Set a unique `data-content-key` on your rendered content to identify each content variant
 * - Use `data-content-phase` to mark loading/error states for phase transitions
 * - Configure transition types and durations for both content and phase changes
 *
 * Example:
 *
 *   <UITransition
 *     transitionType="slide-left"
 *     transitionDuration={400}
 *     phaseTransitionType="cross-fade"
 *     phaseTransitionDuration={300}
 *   >
 *     {isLoading
 *       ? <Spinner data-content-key={userId} data-content-phase />
 *       : <UserProfile user={user} data-content-key={userId} />}
 *   </UITransition>
 *
 * When `data-content-key` changes, UITransition animates content transitions.
 * When `data-content-phase` changes for the same key, it animates phase transitions.
 */

const ContentKeyContext = createContext();
const UITransition = ({
  children,
  contentKey,
  sizeTransition,
  sizeTransitionDuration,
  transitionType,
  transitionDuration,
  phaseTransitionType,
  phaseTransitionDuration,
  debugTransition,
  ...props
}) => {
  const [contentKeyFromContext, setContentKeyFromContext] = useState();
  const effectiveContentKey = contentKey || contentKeyFromContext;
  const ref = useRef();
  useLayoutEffect(() => {
    const uiTransition = initUITransition(ref.current);
    return () => {
      uiTransition.cleanup();
    };
  }, []);
  return jsx(ContentKeyContext.Provider, {
    value: setContentKeyFromContext,
    children: jsxs("div", {
      ref: ref,
      ...props,
      className: "ui_transition_container",
      "data-size-transition": sizeTransition ? "" : undefined,
      "data-size-transition-duration": sizeTransitionDuration ? sizeTransitionDuration : undefined,
      "data-content-transition": transitionType ? transitionType : undefined,
      "data-content-transition-duration": transitionDuration ? transitionDuration : undefined,
      "data-phase-transition": phaseTransitionType ? phaseTransitionType : undefined,
      "data-phase-transition-duration": phaseTransitionDuration ? phaseTransitionDuration : undefined,
      "data-debug-transition": debugTransition ? "" : undefined,
      children: [jsx("div", {
        className: "ui_transition_outer_wrapper",
        children: jsxs("div", {
          className: "ui_transition_measure_wrapper",
          children: [jsx("div", {
            className: "ui_transition_slot",
            "data-content-key": effectiveContentKey ? effectiveContentKey : undefined,
            children: children
          }), jsx("div", {
            className: "ui_transition_phase_overlay"
          })]
        })
      }), jsx("div", {
        className: "ui_transition_content_overlay"
      })]
    })
  });
};
const useContentKey = (key, enabled) => {
  const setKey = useContext(ContentKeyContext);
  if (setKey && enabled) {
    setKey(key);
  }
  useLayoutEffect(() => {
    if (!setKey || !enabled) {
      return null;
    }
    return () => {
      setKey(v => {
        if (v !== key) {
          // the current key is different from the one we set
          // it means another component set it in the meantime
          // we should not clear it
          return v;
        }
        return undefined;
      });
    };
  }, [enabled]);
};

const Route = ({
  route,
  children
}) => {
  if (!route.action) {
    throw new Error("Route component requires a route with an action to render.");
  }
  const {
    active,
    url
  } = useRouteStatus(route);
  useContentKey(url, active);
  return jsx(ActionRenderer, {
    disabled: !active,
    action: route.action,
    children: children
  });
};

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
    left: var(--table-visual-left);
    top: var(--table-visual-top);
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
    pointer-events: none;
    position: absolute;
    inset: 0;
    background: lightgrey;
    opacity: 0;
    z-index: ${Z_INDEX_CELL_FOREGROUND};
  }
  .navi_table_cell[data-first-row] .navi_table_cell_foreground {
    background-color: grey;
  }
  .navi_table_cell_foreground[data-visible] {
    opacity: 1;
  }

  .navi_table_drag_clone_container .navi_table_cell_foreground {
    opacity: 1;
    background-color: rgba(255, 255, 255, 0.2);
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
    left: var(--column-left);
    top: var(--column-top);
    width: var(--column-width);
    height: var(--column-height);
    pointer-events: none;
    z-index: ${Z_INDEX_DROP_PREVIEW};
    /* Invisible container - just for positioning */
    background: transparent;
    border: none;
  }

  .navi_table_column_drop_preview_line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 4px;
    background: rgba(0, 0, 255, 0.5);
    opacity: 0;
    left: 0; /* Default: left edge for dropping before */
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
    opacity: 0;
    transform: translateX(-50%);
    color: rgba(0, 0, 255, 0.5);
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
  body {
    --table-resizer-handle-color: #063b7c;
    --table-resizer-color: #387ec9;
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
    cursor: ew-resize;
    top: 0;
    bottom: 0;
    width: 8px;
  }
  .navi_table_cell_resize_handle[data-left] {
    left: 0;
  }
  .navi_table_cell_resize_handle[data-right] {
    right: 0;
  }

  .navi_table_cell_resize_handle[data-top],
  .navi_table_cell_resize_handle[data-bottom] {
    cursor: ns-resize;
    left: 0;
    right: 0;
    height: 8px;
  }
  .navi_table_cell_resize_handle[data-top] {
    top: 0;
  }
  .navi_table_cell_resize_handle[data-bottom] {
    bottom: 0;
  }

  .navi_table_column_resizer {
    pointer-events: none;
    position: absolute;
    left: var(--table-column-resizer-left);
    width: 10px;
    top: var(--table-visual-top);
    height: var(--table-visual-height);
    opacity: 0;
  }
  .navi_table_column_resize_handle {
    position: absolute;
    height: 100%;
    top: 50%;
    transform: translateY(-50%);
    border-radius: 15px;
    background: var(--table-resizer-handle-color);
    /* opacity: 0.5; */
    width: 5px;
    height: 26px;
    max-height: 80%;
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
    left: -10px;
    right: 0;
    height: var(--table-cell-height);
  }
  .navi_table_column_resizer_line {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 5px;
    left: -3px;
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
    pointer-events: none;
    position: absolute;
    left: var(--table-visual-left);
    width: var(--table-visual-width);
    top: var(--table-row-resizer-top);
    height: 10px;
    opacity: 0;
  }
  .navi_table_row_resize_handle {
    position: absolute;
    width: 100%;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 15px;
    background: var(--table-resizer-handle-color);
    /* opacity: 0.5; */
    width: 26px;
    height: 5px;
    max-width: 80%;
  }
  .navi_table_row_resize_handle[data-top] {
    top: 2px;
  }
  .navi_table_row_resize_handle[data-bottom] {
    bottom: 3px;
  }
  .navi_table_row_resize_handle_container {
    position: absolute;
    left: 0;
    top: -10px;
    bottom: 0;
    width: var(--table-cell-width);
  }
  .navi_table_row_resizer_line {
    position: absolute;
    left: 0;
    right: 0;
    height: 5px;
    top: -3px;
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
  body {
    --selection-border-color: #0078d4;
    --selection-background-color: #eaf1fd;
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
  body {
    --sticky-frontier-color: #c0c0c0;
    --sticky-frontier-size: 12px;
    --sticky-frontier-ghost-size: 8px;
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
    left: calc(var(--table-visual-left) + var(--sticky-group-left));
    width: var(--sticky-frontier-size);
    top: calc(var(--table-visual-top) + var(--sticky-group-top));
    height: calc(var(--table-visual-height) - var(--sticky-group-top));
    background: linear-gradient(
      to right,
      rgba(0, 0, 0, 0.1) 0%,
      rgba(0, 0, 0, 0) 100%
    );
  }

  .navi_table_sticky_frontier[data-top] {
    left: calc(var(--table-visual-left) + var(--sticky-group-left));
    width: calc(var(--table-visual-width) - var(--sticky-group-left));
    top: calc(var(--table-visual-top) + var(--sticky-group-top));
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
    pointer-events: none;
    opacity: 0;
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
    z-index: ${Z_INDEX_TABLE_UI};
    overflow: hidden; /* Ensure UI elements cannot impact scrollbars of the document  */
    inset: 0;
    pointer-events: none; /* UI elements must use pointer-events: auto if they need to be interactive */
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
    alignX = column.alignX,
    alignY = column.alignY,
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
  const innerAlignX = alignX || isFirstRow ? "center" : "start";
  const innerAlignY = alignY || isFirstColumn ? "center" : "start";
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
  minWidth = 30,
  maxWidth = 100,
  immovable = true,
  ...rest
}) => {
  return jsx(Col, {
    id: "row_number",
    width: width,
    minWidth: minWidth,
    maxWidth: maxWidth,
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
    alignX: "left",
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

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_tablist {
    display: flex;
    overflow-x: auto;
    overflow-y: hidden;
    justify-content: space-between;
  }

  .navi_tablist > ul {
    align-items: center;
    display: flex;
    gap: 0.5rem;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .navi_tablist > ul > li {
    display: inline-flex;
    position: relative;
  }

  .navi_tab {
    white-space: nowrap;
    display: flex;
    flex-direction: column;
  }

  .navi_tab_content {
    transition: background 0.12s ease-out;
    border-radius: 6px;
    text-decoration: none;
    line-height: 30px;
    display: flex;
    padding: 0 0.5rem;
  }

  .navi_tab:hover .navi_tab_content {
    background: #dae0e7;
    color: #010409;
  }

  .navi_tab .active_marker {
    display: flex;
    background: transparent;
    border-radius: 0.1px;
    width: 100%;
    z-index: 1;
    height: 2px;
    margin-top: 5px;
  }

  /* Hidden bold clone to reserve space for bold width without affecting height */
  .navi_tab_content_bold_clone {
    font-weight: 600; /* force bold to compute max width */
    visibility: hidden; /* not visible */
    display: block; /* in-flow so it contributes to width */
    height: 0; /* zero height so it doesn't change layout height */
    overflow: hidden; /* avoid any accidental height */
    pointer-events: none; /* inert */
  }

  .navi_tab[aria-selected="true"] .active_marker {
    background: rgb(205, 52, 37);
  }

  .navi_tab[aria-selected="true"] .navi_tab_content {
    font-weight: 600;
  }
`;
const TabList = ({
  children,
  ...props
}) => {
  return jsx("nav", {
    className: "navi_tablist",
    role: "tablist",
    ...props,
    children: jsx("ul", {
      children: children.map(child => {
        return jsx("li", {
          children: child
        }, child.props.key);
      })
    })
  });
};
const Tab = ({
  children,
  selected,
  ...props
}) => {
  return jsxs("div", {
    className: "navi_tab",
    role: "tab",
    "aria-selected": selected ? "true" : "false",
    ...props,
    children: [jsx("div", {
      className: "navi_tab_content",
      children: children
    }), jsx("div", {
      className: "navi_tab_content_bold_clone",
      "aria-hidden": "true",
      children: children
    }), jsx("span", {
      className: "active_marker"
    })]
  });
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

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_font_sized_svg {
    display: flex;
    width: 1em;
    height: 1em;
    flex-shrink: 0;
    align-items: center;
    justify-self: center;
    line-height: 1em;
  }
`;
const FontSizedSvg = ({
  width = "1em",
  height = "1em",
  style,
  children,
  ...props
}) => {
  return jsx("span", {
    ...props,
    className: "navi_font_sized_svg",
    style: withPropsStyle({
      width: width === "1em" ? undefined : width,
      height: height === "1em" ? undefined : height
    }, style),
    children: children
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .link_with_icon {
    white-space: nowrap;
    align-items: center;
    gap: 0.3em;
    min-width: 0;
    display: inline-flex;
    flex-grow: 1;
  }
`;
const LinkWithIcon = ({
  icon,
  isCurrent,
  children,
  className = "",
  ...rest
}) => {
  return jsxs(Link, {
    className: ["link_with_icon", ...className.split(" ")].join(" "),
    ...rest,
    children: [jsx(FontSizedSvg, {
      children: icon
    }), isCurrent && jsx(FontSizedSvg, {
      children: jsx(CurrentSvg, {})
    }), children]
  });
};
const CurrentSvg = () => {
  return jsx("svg", {
    viewBox: "0 0 16 16",
    width: "100%",
    height: "100%",
    xmlns: "http://www.w3.org/2000/svg",
    children: jsx("path", {
      d: "m 8 0 c -3.3125 0 -6 2.6875 -6 6 c 0.007812 0.710938 0.136719 1.414062 0.386719 2.078125 l -0.015625 -0.003906 c 0.636718 1.988281 3.78125 5.082031 5.625 6.929687 h 0.003906 v -0.003906 c 1.507812 -1.507812 3.878906 -3.925781 5.046875 -5.753906 c 0.261719 -0.414063 0.46875 -0.808594 0.585937 -1.171875 l -0.019531 0.003906 c 0.25 -0.664063 0.382813 -1.367187 0.386719 -2.078125 c 0 -3.3125 -2.683594 -6 -6 -6 z m 0 3.691406 c 1.273438 0 2.308594 1.035156 2.308594 2.308594 s -1.035156 2.308594 -2.308594 2.308594 c -1.273438 -0.003906 -2.304688 -1.035156 -2.304688 -2.308594 c -0.003906 -1.273438 1.03125 -2.304688 2.304688 -2.308594 z m 0 0",
      fill: "#2e3436"
    })
  });
};

const IconAndText = ({
  icon,
  children,
  ...rest
}) => {
  if (typeof icon === "function") icon = icon({});
  return jsxs("span", {
    className: "icon_and_text",
    ...rest,
    style: {
      display: "flex",
      alignItems: "center",
      gap: "0.1em",
      ...rest.style
    },
    children: [jsx(FontSizedSvg, {
      className: "icon",
      children: icon
    }), jsx("span", {
      className: "text",
      children: children
    })]
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .svg_mask_content * {
    fill: black !important;
    stroke: black !important;
    fill-opacity: 1 !important;
    stroke-opacity: 1 !important;
    color: black !important;
    opacity: 1 !important;
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

const Overflow = ({
  className,
  children,
  afterContent
}) => {
  return jsx("div", {
    className: className,
    style: "display: flex; flex-wrap: wrap; overflow: hidden; width: 100%; box-sizing: border-box; white-space: nowrap; text-overflow: ellipsis;",
    children: jsxs("div", {
      style: "display: flex; flex-grow: 1; width: 0; gap: 0.3em",
      children: [jsx("div", {
        style: "overflow: hidden; max-width: 100%; text-overflow: ellipsis;",
        children: children
      }), afterContent]
    })
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .text_and_count {
    display: flex;
    align-items: center;
    gap: 3px;
    flex: 1;
    white-space: nowrap;
  }

  .count {
    position: relative;
    top: -1px;
    color: rgba(28, 43, 52, 0.4);
  }
`;
const TextAndCount = ({
  text,
  count
}) => {
  return jsx(Overflow, {
    className: "text_and_count",
    afterContent: count > 0 && jsxs("span", {
      className: "count",
      children: ["(", count, ")"]
    }),
    children: jsx("span", {
      className: "label",
      children: text
    })
  });
};

installImportMetaCss(import.meta);import.meta.css = /* css */`
  .navi_flex_row {
    display: flex;
    flex-direction: row;
    gap: 0;
  }

  .navi_flex_column {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .navi_flex_item {
    flex-shrink: 0;
  }
`;
const FlexRow = ({
  alignX,
  alignY,
  gap,
  style,
  children,
  ...rest
}) => {
  const {
    all
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle({
    ...all,
    // Only set justifyContent if it's not the default "start"
    justifyContent: alignX !== "start" ? alignX : undefined,
    // Only set alignItems if it's not the default "stretch"
    alignItems: alignY !== "stretch" ? alignY : undefined,
    gap
  }, style);
  return jsx("div", {
    ...rest,
    className: "navi_flex_row",
    style: innerStyle,
    children: jsx(FlexDirectionContext.Provider, {
      value: "row",
      children: children
    })
  });
};
const FlexColumn = ({
  alignX,
  alignY,
  gap,
  style,
  children,
  ...rest
}) => {
  const {
    all
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle({
    ...all,
    // Only set alignItems if it's not the default "stretch"
    alignItems: alignX !== "stretch" ? alignX : undefined,
    // Only set justifyContent if it's not the default "start"
    justifyContent: alignY !== "start" ? alignY : undefined,
    gap
  }, style);
  return jsx("div", {
    ...rest,
    className: "navi_flex_column",
    style: innerStyle,
    children: jsx(FlexDirectionContext.Provider, {
      value: "column",
      children: children
    })
  });
};
const FlexItem = ({
  shrink,
  className,
  expand,
  style,
  children,
  ...rest
}) => {
  const flexDirection = useContext(FlexDirectionContext);
  if (!flexDirection) {
    console.warn("FlexItem must be used within a FlexRow or FlexColumn component.");
  }
  const innerClassName = withPropsClassName("navi_flex_item", className);
  const {
    all
  } = useLayoutStyle(rest);
  const innerStyle = withPropsStyle({
    ...all,
    flexGrow: expand ? 1 : undefined,
    flexShrink: shrink ? 1 : undefined
  }, style);
  return jsx("div", {
    ...rest,
    className: innerClassName,
    style: innerStyle,
    children: children
  });
};

const Spacing = ({
  style,
  children,
  ...rest
}) => {
  const {
    padding,
    margin
  } = useLayoutStyle(rest);
  return jsx("div", {
    ...rest,
    style: withPropsStyle({
      ...margin,
      ...padding
    }, style),
    children: children
  });
};

const createUniqueValueConstraint = (
  // the set might be incomplete (the front usually don't have the full copy of all the items from the backend)
  // but this is already nice to help user with what we know
  // it's also possible that front is unsync with backend, preventing user to choose a value
  // that is actually free.
  // But this is unlikely to happen and user could reload the page to be able to choose that name
  // that suddenly became available
  existingValueSet,
  message = `"{value}" already exists. Please choose another value.`,
) => {
  return {
    name: "unique_value",
    check: (input) => {
      const inputValue = input.value;
      const hasConflict = existingValueSet.has(inputValue);
      // console.log({
      //   inputValue,
      //   names: Array.from(otherNameSet.values()),
      //   hasConflict,
      // });
      if (hasConflict) {
        return message.replace("{value}", inputValue);
      }
      return "";
    },
  };
};

const SINGLE_SPACE_CONSTRAINT = {
  name: "single_space",
  check: (input) => {
    const inputValue = input.value;
    const hasLeadingSpace = inputValue.startsWith(" ");
    const hasTrailingSpace = inputValue.endsWith(" ");
    const hasDoubleSpace = inputValue.includes("  ");
    if (hasLeadingSpace || hasDoubleSpace || hasTrailingSpace) {
      return "Spaces at the beginning, end, or consecutive spaces are not allowed";
    }
    return "";
  },
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

export { ActionRenderer, ActiveKeyboardShortcuts, Button, Checkbox, CheckboxList, Col, Colgroup, Details, Editable, ErrorBoundaryContext, FlexColumn, FlexItem, FlexRow, FontSizedSvg, Form, Icon, IconAndText, Input, Label, Link, LinkWithIcon, Overflow, Radio, RadioList, Route, RowNumberCol, RowNumberTableCell, SINGLE_SPACE_CONSTRAINT, SVGMaskOverlay, Select, SelectionContext, Spacing, SummaryMarker, Tab, TabList, Table, TableCell, Tbody, Text, TextAndCount, Thead, Tr, UITransition, actionIntegratedVia, addCustomMessage, createAction, createSelectionKeyboardShortcuts, createUniqueValueConstraint, defineRoutes, enableDebugActions, enableDebugOnDocumentLoading, forwardActionRequested, goBack, goForward, goTo, installCustomConstraintValidation, isCellSelected, isColumnSelected, isRowSelected, openCallout, rawUrlPart, reload, removeCustomMessage, rerunActions, resource, setBaseUrl, stopLoad, stringifyTableSelectionValue, updateActions, useActionData, useActionStatus, useCellsAndColumns, useDependenciesDiff, useDocumentState, useDocumentUrl, useEditionController, useFocusGroup, useKeyboardShortcuts, useNavState, useRouteStatus, useRunOnMount, useSelectableElement, useSelectionController, useSignalSync, useStateArray, valueInLocalStorage };
//# sourceMappingURL=jsenv_navi.js.map

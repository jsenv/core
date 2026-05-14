/**
 * Creates a callback that works uniformly when used as a `uiAction`, `onClick`, or `action` prop.
 *
 * ---
 *
 * **Single-function form** — the function receives `(event)` in all cases:
 * ```js
 * const onClose = createUICallback((event) => { ... });
 * <Button onClick={onClose} />   // ✓ fn(event)
 * <Button uiAction={onClose} />  // ✓ fn(event)  — value is ignored
 * <Button action={onClose} />    // ✓ fn(event)  — value is ignored
 * ```
 *
 * **Object form** — provide specific handlers per call site:
 * ```js
 * const onClose = createUICallback({
 *   event:    (event) => { ... },           // called from onClick
 *   uiAction: (value, event) => { ... },    // called from uiAction
 *   action:   (value, { event }) => { ... } // called from action
 * });
 * ```
 *
 * Omitting a handler emits a warning when that call site is used:
 * - No `event` handler  → warn + no-op on `onClick`
 * - No `uiAction` handler → warn on `uiAction`, falls back to `action` handler with `(value, event)`
 * - No `action` handler  → warn on `action`, falls back to `uiAction` handler with `(value, event)`
 *
 * @param {function|{ event?: function, uiAction?: function, action?: function }} callbackOrHandlers
 * @returns {function}
 */
export const createUICallback = (callbackOrHandlers) => {
  if (typeof callbackOrHandlers === "function") {
    const fn = callbackOrHandlers;
    return (...args) => {
      const event = resolveEvent(args);
      return fn(event);
    };
  }

  const {
    event: onEvent,
    uiAction: onUIAction,
    action: onAction,
  } = callbackOrHandlers;

  return (...args) => {
    const callSite = detectCallSite(args);

    if (callSite === "event") {
      if (!onEvent) {
        console.warn(
          "createUICallback: called from onClick but no `event` handler was provided.",
        );
        return false;
      }
      return onEvent(args[0]);
    }

    if (callSite === "uiAction") {
      const [value, event] = args;
      if (onUIAction) {
        return onUIAction(value, event);
      }
      if (onAction) {
        console.warn(
          "createUICallback: called from uiAction but no `uiAction` handler was provided — falling back to `action` handler.",
        );
        return onAction(value, { event });
      }
      console.warn(
        "createUICallback: called from uiAction but no `uiAction` or `action` handler was provided.",
      );
      return false;
    }

    if (callSite === "action") {
      const [value, secondArg] = args;
      const event = secondArg && secondArg.event;
      if (onAction) {
        return onAction(value, secondArg);
      }
      if (onUIAction) {
        console.warn(
          "createUICallback: called from action but no `action` handler was provided — falling back to `uiAction` handler.",
        );
        return onUIAction(value, event);
      }
      console.warn(
        "createUICallback: called from action but no `action` or `uiAction` handler was provided.",
      );
      return false;
    }

    console.warn(
      "createUICallback: called without arguments. This is likely a mistake.",
    );
    return false;
  };
};

const detectCallSite = (args) => {
  if (args.length === 0) {
    return "unknown";
  }
  const [firstArg, secondArg] = args;
  // onClick={fn} → fn(event)
  if (firstArg && firstArg.currentTarget) {
    return "event";
  }
  // uiAction={fn} → fn(value, event)
  if (secondArg && secondArg.currentTarget) {
    return "uiAction";
  }
  // action={fn} → fn(value, { event, ... })
  return "action";
};

const resolveEvent = (args) => {
  const callSite = detectCallSite(args);
  if (callSite === "event") {
    return args[0];
  }
  if (callSite === "uiAction") {
    return args[1];
  }
  // action
  return args[1] && args[1].event;
};

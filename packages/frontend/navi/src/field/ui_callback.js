/**
 * Creates a universal callback from an object describing how it should behave
 * depending on how it is called (`onClick`, `uiAction`).
 *
 * ---
 *
 * **`{ event }`** — handler receives `(event)`; works from `onClick`, `uiAction`, and `action`
 *   but warns when called from `uiAction` (value is available but ignored):
 * ```js
 * const cb = createUICallback({ event: (event) => { ... } });
 * <Button onClick={cb} />   // ✓ event(event)
 * <Button uiAction={cb} />  // ⚠ warns (value ignored), then event(event)
 * ```
 *
 * **`{ uiAction }`** — handler receives `(value, event)`; warns and no-ops when
 *   called from `onClick` (no value available):
 * ```js
 * const cb = createUICallback({ uiAction: (value, event) => { ... } });
 * <Button uiAction={cb} />  // ✓ uiAction(value, event)
 * <Button onClick={cb} />   // ✗ warns, no-op
 * ```
 *
 * **`{ event, uiAction }`** — each call site uses its dedicated handler:
 * ```js
 * const cb = createUICallback({
 *   event:    (event) => { ... },
 *   uiAction: (value, event) => { ... },
 * });
 * <Button onClick={cb} />   // ✓ event(event)
 * <Button uiAction={cb} />  // ✓ uiAction(value, event)
 * ```
 *
 * @param {{ event?: function(event: Event): any, uiAction?: function(value: any, event: Event): any }} handlers
 * @returns {function}
 */
export const createUICallback = ({ event, uiAction }) => {
  if (event && uiAction) {
    return (...args) => {
      return routeArgs(args, {
        event,
        uiAction,
        action: () => {
          console.warn("");
        },
        other: () => {},
      });
    };
  }
  if (uiAction) {
    return (...args) => {
      return routeArgs(args, {
        event: () => {
          console.warn(
            "Unexpected call from event, must be called by uiAction",
          );
          return false;
        },
        uiAction,
      });
    };
  }
  // onEventOnly (no use case yet but why not some day)
  return (...args) => {
    return routeArgs(args, {
      event,
      uiAction: (value, e) => {
        console.warn(
          "Unexpected call from uiAction, must be called by regular event",
        );
        return event(e);
      },
    });
  };
};

/**
 * Detects the shape of the arguments and dispatches to the matching handler.
 * - DOM event handler (onClick):  fn(event)          → calls handlers.event(event)
 * - uiAction prop:                fn(value, event)   → calls handlers.uiAction(value, event)
 *
 * @param {any[]} args
 * @param {{ event: function, uiAction: function }} handlers
 */
const routeArgs = (args, { event, uiAction }) => {
  const [firstArg, secondArg] = args;
  // onClick={fn} → fn(event): first arg is a DOM event
  if (firstArg && firstArg.currentTarget) {
    return event(firstArg);
  }
  // uiAction={fn} → fn(value, event): second arg is a DOM event
  return uiAction(firstArg, secondArg);
};

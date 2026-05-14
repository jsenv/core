/**
 * Creates a universal callback from an object declaring how it should behave
 * depending on how it is called.
 *
 * The shape of the handlers object defines the **intended usage**.
 * Navi warns at runtime when the callback is placed on the wrong prop.
 *
 * Supported call sites:
 * - **DOM event props** (`onClick`, `onInput`, ...): called as `fn(event)`
 * - **`uiAction` prop**: called as `fn(value, event)` — carries a value from the UI element
 *
 * ---
 *
 * **`{ event }`** — intended for DOM event props:
 * ```js
 * const cb = createUICallback({ event: (event) => { ... } });
 * <Button onClick={cb} />   // ✓
 * <Button onInput={cb} />   // ✓
 * <Button uiAction={cb} />  // ⚠ warns, still calls event(event) — value ignored
 * ```
 *
 * **`{ uiAction }`** — intended for the `uiAction` prop only:
 * ```js
 * const cb = createUICallback({ uiAction: (value, event) => { ... } });
 * <Button uiAction={cb} />  // ✓
 * <Button onClick={cb} />   // ✗ warns, no-op — no value available from DOM event
 * ```
 *
 * **`{ event, uiAction }`** — works from both; each call site gets its own handler:
 * ```js
 * const cb = createUICallback({
 *   event:    (event) => { ... },
 *   uiAction: (value, event) => { ... },
 * });
 * <Button onClick={cb} />   // ✓ → event(event)
 * <Button uiAction={cb} />  // ✓ → uiAction(value, event)
 * ```
 *
 * @param {{ event?: function(event: Event): any, uiAction?: function(value: any, event: Event): any }} handlers
 * @returns {function}
 */
export const createUICallback = ({ name = "ui callback", event, uiAction }) => {
  if (event && uiAction) {
    return (...args) => {
      return routeArgs(args, {
        event: (e) => {
          return event(e);
        },
        uiAction: (value, e) => {
          return uiAction(value, e);
        },
        action: (value, actionSecondArg) => {
          console.info(
            `${name} got called by action. It works but is designed to be called by uiAction`,
          );
          return uiAction(value, actionSecondArg.event);
        },
        other: () => {
          console.warn(
            `${name} unsupported call attempt. It is designed to be called by uiAction.`,
          );
          return false;
        },
      });
    };
  }
  if (uiAction) {
    return (...args) => {
      return routeArgs(args, {
        event: () => {
          console.warn(
            `${name} unsupported call attempt (by DOM event). It is designed to be called by uiAction.`,
          );
          return false;
        },
        uiAction: (value, e) => {
          return uiAction(value, e);
        },
        action: (value, actionSecondArg) => {
          console.info(
            `${name} got called by action. It works but is designed to be called by uiAction`,
          );
          return uiAction(value, actionSecondArg.event);
        },
        other: () => {
          console.warn(
            `${name} unsupported call attempt. It is designed to be called by uiAction.`,
          );
          return false;
        },
      });
    };
  }
  // event only
  return (...args) => {
    return routeArgs(args, {
      event: (e) => {
        return event(e);
      },
      uiAction: (value, e) => {
        console.info(
          `${name} got called by uiAction. It works but is designed to be called by DOM`,
        );
        return event(e);
      },
      action: (value, secondArg) => {
        console.info(
          `${name} got called by action. It works but is designed to be called by DOM`,
        );
        return event(secondArg.event);
      },
      other: () => {
        console.warn(
          `${name} unsupported call attempt. It is designed to be called by DOM.`,
        );
        return false;
      },
    });
  };
};

/**
 * Detects the shape of the arguments and dispatches to the matching handler.
 * - DOM event prop (onClick, onInput, ...): fn(event)            → first arg has .currentTarget
 * - uiAction prop:                          fn(value, event)     → second arg has .currentTarget
 * - action prop:                            fn(value, { event }) → second arg is a plain object with .event
 * - other:                                  unknown shape
 *
 * @param {any[]} args
 * @param {{ event: function, uiAction: function, action: function, other: function }} handlers
 */
const routeArgs = (args, { event, uiAction, action, other }) => {
  const [firstArg, secondArg] = args;
  if (firstArg && firstArg.currentTarget) {
    return event(...args);
  }
  if (secondArg && secondArg.currentTarget) {
    return uiAction(...args);
  }
  if (secondArg && secondArg.event) {
    return action(...args);
  }
  return other(...args);
};

/**
 * Creates a universal callback from an object describing how it should behave
 * depending on how it is called.
 *
 * The handlers object declares the **intended usage** of the callback.
 * Navi will warn when the callback is placed on the wrong prop.
 *
 * ---
 *
 * **`{ event }`** — intended for DOM event props (`onClick`, `onInput`, etc.);
 *   also accepts `uiAction` with a warning (value is ignored):
 * ```js
 * const cb = createUICallback({ event: (event) => { ... } });
 * <Button onClick={cb} />   // ✓
 * <Button onInput={cb} />   // ✓
 * <Button uiAction={cb} />  // ⚠ warns — use a DOM event prop instead
 * ```
 *
 * **`{ uiAction }`** — intended for `uiAction` only; warns and no-ops on DOM
 *   event props because no value is available from a plain DOM event:
 * ```js
 * const cb = createUICallback({ uiAction: (value, event) => { ... } });
 * <Button uiAction={cb} />  // ✓
 * <Button onClick={cb} />   // ✗ warns — use uiAction instead
 * ```
 *
 * **`{ event, uiAction }`** — works from both; each call site uses its handler:
 * ```js
 * const cb = createUICallback({
 *   event:    (event) => { ... },
 *   uiAction: (value, event) => { ... },
 * });
 * <Button onClick={cb} />   // ✓
 * <Button uiAction={cb} />  // ✓
 * ```
 *
 * @param {{ event?: function(event: Event): any, uiAction?: function(value: any, event: Event): any }} handlers
 * @returns {function}
 */
export const createUICallback = ({ event, uiAction }) => {
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
            `${uiAction.name} got called by action. It works but is designed to be called by uiAction`,
          );
          return uiAction(value, actionSecondArg.event);
        },
        other: () => {
          console.warn(
            `${uiAction.name} unsupported call attempt. It is designed to be called by uiAction.`,
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
            `${uiAction.name} unsupported call attempt (by DOM event). It is designed to be called by uiAction.`,
          );
          return false;
        },
        uiAction: (value, e) => {
          return uiAction(value, e);
        },
        action: (value, actionSecondArg) => {
          console.info(
            `${uiAction.name} got called by action. It works but is designed to be called by uiAction`,
          );
          return uiAction(value, actionSecondArg.event);
        },
        other: () => {
          console.warn(
            `${uiAction.name} unsupported call attempt. It is designed to be called by uiAction.`,
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
          `${event.name} got called by uiAction. It works but is designed to be called by DOM`,
        );
        return event(e);
      },
      action: (value, secondArg) => {
        console.info(
          `${event.name} got called by action. It works but is designed to be called by DOM`,
        );
        return event(secondArg.event);
      },
      other: () => {
        console.warn(
          `${event.name} unsupported call attempt. It is designed to be called by DOM.`,
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

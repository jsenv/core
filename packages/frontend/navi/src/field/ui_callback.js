/**
 * Creates a universal callback from an object describing how it should behave
 * depending on how it is called (`onClick`, `uiAction`).
 *
 * ---
 *
 * **`{ event }`** — only usable from `onClick`:
 * ```js
 * const cb = createUICallback({ event: (event) => { ... } });
 * <Button onClick={cb} />   // ✓ calls event(event)
 * <Button uiAction={cb} />  // ✗ warns, no-op
 * ```
 *
 * **`{ uiAction }`** — only usable from `uiAction`:
 * ```js
 * const cb = createUICallback({ uiAction: (value, event) => { ... } });
 * <Button uiAction={cb} />  // ✓ calls uiAction(value, event)
 * <Button onClick={cb} />   // ✗ warns, no-op
 * ```
 *
 * **`{ event, uiAction }`** — works from both:
 * ```js
 * const cb = createUICallback({
 *   event:    (event) => { ... },
 *   uiAction: (value, event) => { ... },
 * });
 * <Button onClick={cb} />   // ✓ calls event(event)
 * <Button uiAction={cb} />  // ✓ calls uiAction(value, event)
 * ```
 *
 * @param {{ event?: function(event: Event): any, uiAction?: function(value: any, event: Event): any }} handlers
 * @returns {function}
 */
export const createUICallback = ({ event, uiAction }) => {
  if (event && uiAction) {
    return (...args) => {
      if (isCalledByEvent(args)) {
        return event(args[0]);
      }
      if (isCalledByUIAction(args)) {
        return uiAction(args[0], args[1]);
      }
      if (isCalledByAction(args)) {
        console.warn(
          "createUICallback: called from action but no `action` handler was provided. Falling back to `uiAction` handler.",
        );
        return uiAction(args[0], args[1]);
      }
      console.warn();
      return false;
    };
  }
  if (event) {
    return (...args) => {
      if (isCalledByEvent(args)) {
        return event(args[0]);
      }
      if (isCalledByUIAction(args)) {
        return event(args[1]);
      }
      if (isCalledByAction(args)) {
        return event(args[1].event);
      }
      console.warn(
        "createUICallback: called from uiAction or action but no `uiAction` or `action` handler was provided. Falling back to `event` handler.",
      );
      return false;
    };
  }

  return (...args) => {
    if (isCalledByEvent(args)) {
      console.warn(
        "createUICallback: called from dom event, it needs to be passed to uiAction",
      );
      return false;
    }
    if (isCalledByUIAction(args)) {
      return uiAction(args[0], args[1]);
    }
    if (isCalledByAction(args)) {
      console.warn(
        "createUICallback: called from action, it needs to be passed to uiAction",
      );
      return uiAction(args[0], args[1].event);
    }
    return false;
  };
};

const isCalledByEvent = (args) => {
  // onClick={fn} calls fn(event) — first arg is a DOM event
  const [firstArg] = args;
  return Boolean(firstArg && firstArg.currentTarget);
};

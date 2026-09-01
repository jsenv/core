import { computed } from "@preact/signals";

import { stringifyForDisplay } from "../utils/stringify_for_display.js";
import { createAction } from "./actions.js";
import { runUnwatched } from "./run_unwatched.js";

/**
 * Reactively runs an action whenever the params derived from signals change.
 *
 * @param {object} action - The action to run.
 * @param {Function} deriveActionParamsFromSignals - A function that reads signals and returns
 *   the params to pass to the action. It is re-evaluated automatically whenever a signal it
 *   read changes. Return `false`/`null`/`undefined` to skip running the action.
 * @param {object} [options]
 * @param {number} [options.debounce] - When set, the action is only run once the derived params
 *   have been stable for this many milliseconds. Useful to avoid firing a backend call on every
 *   keystroke: set `debounce: 500` and the request is sent only after the user stops interacting
 *   with the filters for 500 ms. During that delay the action still holds the previous answer;
 *   `action.paramsSettlingSignal` is what says a newer one is coming, and
 *   `useAsyncData(action, { loading: true })` reads it.
 *
 *   Example — auto-refresh a result list while the user tweaks filters:
 *   ```js
 *   actionRunEffect(searchAction, () => ({
 *     query: querySignal.value,
 *     page: pageSignal.value,
 *   }), { debounce: 500 });
 *   ```
 *   The action will not fire while the user is actively changing filters; it fires once
 *   they pause for half a second.
 */
// The run is not awaited here, and a rejection nobody waits for is an unhandled
// one — in dev, an error overlay thrown over a page that is already saying what
// went wrong. Nothing is lost by dropping it: the failure is held by the action
// itself, and whoever reads it (useAsyncData, <Button action>) is what shows it.
export const actionRunEffect = (
  action,
  deriveActionParamsFromSignals,
  { debounce, ...options } = {},
) => {
  if (typeof action === "function") {
    action = createAction(action);
  }
  const actionParamsSignal = computed(() => {
    const params = deriveActionParamsFromSignals();
    action.debug(
      `Derived params for action "${action}": ${stringifyForDisplay(params)}`,
    );
    if (!params) {
      // normalize falsy values to undefined so that any falsy value ends up in the same state of "don't run the action"
      return undefined;
    }
    if (params && typeof params.then === "function") {
      {
        console.warn(
          `actionRunEffect second arg is returning a promise. This is not supported, the function should be sync and return params to give to the action`,
        );
      }
    }
    return params;
  });
  const actionRunnedByThisEffect = action.bindParams(actionParamsSignal, {
    debounce,
    onChange: (actionTarget, actionTargetPrevious, { explicitRunIntent }) => {
      if (explicitRunIntent) {
        // The caller already issued an explicit run/rerun/prerun/reset/abort —
        // don't attempt to also auto-run from the params change to avoid double-runs.
        action.debug(
          `"${actionTarget}": explicit run intent detected -> skipping auto-run from params change`,
        );
        return;
      }
      if (!actionTargetPrevious && actionTarget) {
        // first run
        if (!actionTarget.params) {
          // falsy params, don't run
          return;
        }
        runUnwatched(() =>
          actionTarget.run({ reason: "truthy params first run" }),
        );
        return;
      }

      if (
        actionTargetPrevious &&
        !actionTargetPrevious.isPrerun &&
        actionTarget
      ) {
        // params changed
        if (!actionTarget.params) {
          // falsy params, don't run
          actionTargetPrevious.abort("abortOnFalsyParams");
          return;
        }
        if (!actionTargetPrevious.params) {
          // coming from falsy-params state: action may already be cached, avoid unnecessary rerun
          runUnwatched(() =>
            actionTarget.run({ reason: "params restored from falsy state" }),
          );
        } else {
          runUnwatched(() => actionTarget.rerun({ reason: "params modified" }));
        }
      }
    },
    ...options,
  });
  if (actionParamsSignal.peek()) {
    runUnwatched(() =>
      actionRunnedByThisEffect.run({ reason: "initial truthy params" }),
    );
  }
  return actionRunnedByThisEffect;
};

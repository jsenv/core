import { computed } from "@preact/signals";

import { debounceSignal } from "../state/debounce_signal.js";
import { stringifyForDisplay } from "../utils/stringify_for_display.js";

const RUN_SYMBOL = Symbol("run");
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
 *   with the filters for 500 ms.
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
export const actionRunEffect = (
  action,
  deriveActionParamsFromSignals,
  { debounce } = {},
) => {
  let actionParamsSignal = computed(() => {
    const params = deriveActionParamsFromSignals();
    action.debug(
      `Derived params for action "${action}": ${stringifyForDisplay(params)}`,
    );
    if (params === true) {
      // when we receive true, we need to convert to params to be sure we run it
      // if people want to rerun action all the time without cache even if params are the same
      // they must return something like t=Date.now() into the params
      // if the function return {} as a signal to run the action it won't work
      // as it will be compared to NO_PARAMS which is also {}
      // (we could ensure this works but for now it's good enough)
      return { t: RUN_SYMBOL };
    }
    return params;
  });
  if (debounce) {
    actionParamsSignal = debounceSignal(actionParamsSignal, {
      delay: debounce,
    });
  }

  const actionRunnedByThisEffect = action.bindParams(actionParamsSignal, {
    syncParams: debounce ? actionParamsSignal.flush : undefined,
    onChange: (actionTarget, actionTargetPrevious, { explicitRunIntent }) => {
      if (explicitRunIntent) {
        // The caller already issued an explicit run/rerun/prerun/reset/abort —
        // don't attempt to also auto-run from the params change to avoid double-runs.
        return;
      }
      if (!actionTargetPrevious && actionTarget) {
        // first run
        if (!actionTarget.params) {
          // falsy params, don't run
          return;
        }
        action.debug(`"${actionTarget}": params are truthy -> running action`);
        actionTarget.run({ reason: "truthy params first run" });
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
        action.debug(`"${actionTarget}": params modified -> rerunning action`);
        actionTarget.rerun({ reason: "params modified" });
      }
    },
  });
  return actionRunnedByThisEffect;
};

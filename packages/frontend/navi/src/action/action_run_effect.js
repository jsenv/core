import { computed } from "@preact/signals";

import { stringifyForDisplay } from "../utils/stringify_for_display.js";

const RUN_SYMBOL = Symbol("run");
export const actionRunEffect = (action, deriveActionParamsFromSignals) => {
  const actionParamsSignal = computed(() => {
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
  const actionRunnedByThisEffect = action.bindParams(actionParamsSignal, {
    runOnce: true,
    rerunOnChange: true,
    abortOnFalsyParams: true,
  });
  return actionRunnedByThisEffect;
};

import { getActionDispatcher } from "../../action/actions.js";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

// This handles ALL resource lifecycle logic (rerun/reset) across all resources
export const createResourceLifecycleManager = () => {
  const registeredResources = new Map(); // Map<resourceInstance, lifecycleConfig>
  const resourceDependencies = new Map(); // Map<resourceInstance, Set<dependentResources>>

  const registerResource = (resourceScope, config) => {
    const {
      rerunOn,
      paramScope = null,
      dependencies = [],
      mutableIdKeys = [],
    } = config;

    registeredResources.set(resourceScope, {
      rerunOn,
      paramScope,
      mutableIdKeys,
      restActionSet: new Set(),
      restActionContextMap: new Map(), // Map<restAction, { resourceInstance, paramScope }>
    });

    // Register dependencies
    if (dependencies.length > 0) {
      for (const dependency of dependencies) {
        if (!resourceDependencies.has(dependency)) {
          resourceDependencies.set(dependency, new Set());
        }
        resourceDependencies.get(dependency).add(resourceScope);
      }
    }
  };

  const registerAction = (resourceScope, restAction, restActionContext) => {
    const config = registeredResources.get(resourceScope);
    if (config) {
      config.restActionSet.add(restAction);
      config.restActionContextMap.set(restAction, restActionContext);
    }
  };

  const shouldRerunAfter = (rerunConfig, verb) => {
    if (rerunConfig === false) {
      return false;
    }
    if (rerunConfig === "*") {
      return true;
    }
    if (Array.isArray(rerunConfig)) {
      const methodSet = new Set(rerunConfig.map((v) => v.toUpperCase()));
      if (methodSet.has("*")) {
        return true;
      }
      return methodSet.has(verb.toUpperCase());
    }
    return false;
  };

  const isParamSubset = (parentParams, childParams) => {
    if (!parentParams || !childParams) {
      return false;
    }
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

  // Determines which actions to rerun/reset when an action completes.
  const findEffectOnActions = (triggeringAction, triggeringActionContext) => {
    const actionsToRerun = new Set();
    const actionsToReset = new Set();
    const reasonSet = new Set();

    const triggerVerb = triggeringAction.meta.verb;
    const triggerIsMany = triggeringAction.meta.isMany;
    const triggerResourceScope = triggeringActionContext.resourceScope;

    for (const [resourceScope, config] of registeredResources) {
      const shouldRerunGetMany = shouldRerunAfter(
        config.rerunOn.GET_MANY,
        triggerVerb,
      );
      const shouldRerunGet = shouldRerunAfter(config.rerunOn.GET, triggerVerb);

      // Skip if no rerun or reset rules apply
      const hasMutableIdAutorerun =
        (triggerVerb === "POST" ||
          triggerVerb === "PUT" ||
          triggerVerb === "PATCH") &&
        config.mutableIdKeys.length > 0;

      if (
        !shouldRerunGetMany &&
        !shouldRerunGet &&
        triggerVerb !== "DELETE" &&
        !hasMutableIdAutorerun
      ) {
        continue;
      }

      // Parameter scope predicate for config-driven rules
      // Same scope ID or no scope = compatible, subset check for different scopes
      const paramScopePredicate = (candidateAction) => {
        const candidateContext =
          config.restActionContextMap.get(candidateAction);
        if (!candidateContext) {
          return false;
        }
        const paramScope = config.paramScope;
        const candidateParamScope = candidateContext.paramScope;
        if (candidateParamScope.id === paramScope.id) {
          return true;
        }
        const params = paramScope.params;
        const candidateParams = candidateParamScope.params;
        return isParamSubset(candidateParams, params);
      };

      for (const restAction of config.restActionSet) {
        // Find all instances of this action
        const actionCandidateArray = restAction.matchAllSelfOrDescendant(
          (action) =>
            !action.isPrerun && action.completed && action !== triggeringAction,
        );

        for (const actionCandidate of actionCandidateArray) {
          const candidateVerb = actionCandidate.meta.verb;
          if (triggerVerb === candidateVerb) {
            continue;
          }
          const candidateIsPlural = actionCandidate.meta.isMany;
          const isSameResource = triggerResourceScope === resourceScope;

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
            const { valueSignal } = triggeringAction;
            const deleteIdSet = triggerIsMany
              ? new Set(valueSignal.peek())
              : new Set([valueSignal.peek()]);

            const candidateId = actionCandidate.value;
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
          mutable_id_effect: {
            if (
              hasMutableIdAutorerun &&
              candidateVerb === "GET" &&
              !candidateIsPlural &&
              isSameResource
            ) {
              const { valueSignal } = triggeringAction;
              const modifiedValue = valueSignal.peek();

              if (modifiedValue && typeof modifiedValue === "object") {
                for (const mutableIdKey of config.mutableIdKeys) {
                  const modifiedMutableId = modifiedValue[mutableIdKey];
                  const candidateParams = actionCandidate.params;

                  if (
                    modifiedMutableId !== undefined &&
                    candidateParams &&
                    typeof candidateParams === "object" &&
                    candidateParams[mutableIdKey] === modifiedMutableId
                  ) {
                    actionsToRerun.add(actionCandidate);
                    reasonSet.add(
                      `${triggeringAction.meta.verb}-mutableId autorerun`,
                    );
                    break;
                  }
                }
              }
            }
          }

          // Cross-resource dependency effects: rerun dependent GET_MANY
          dependency_effect: {
            if (
              triggerResourceScope &&
              resourceDependencies
                .get(triggerResourceScope)
                ?.has(resourceScope) &&
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

  const onActionComplete = (restActionWhoJustCompleted, restActionContext) => {
    const { actionsToRerun, actionsToReset, reasons } = findEffectOnActions(
      restActionWhoJustCompleted,
      restActionContext,
    );
    if (actionsToRerun.size > 0 || actionsToReset.size > 0) {
      const reason = `${restActionWhoJustCompleted} triggered ${reasons.join(" and ")}`;
      const dispatchActions = getActionDispatcher();
      dispatchActions({
        rerunSet: actionsToRerun,
        resetSet: actionsToReset,
        reason,
      });
    }
  };

  return {
    registerResource,
    registerAction,
    onActionComplete,
  };
};

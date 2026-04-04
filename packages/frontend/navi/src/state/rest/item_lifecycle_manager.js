import { getActionDispatcher } from "../../action/actions.js";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

/*
 * Default autorerun behavior explanation:
 *  GET: false (RECOMMENDED)
 *  What happens:
 *  - GET actions are reset by DELETE operations (not rerun)
 *  - DELETE operation on the displayed item would display nothing in the UI (action is in IDLE state)
 *  - PUT/PATCH operations update UI via signals, no rerun needed
 *  - This approach minimizes unnecessary API calls
 *
 *  How to handle:
 *  - Applications can provide custom UI for deleted items (e.g., "Item not found")
 *  - Or redirect users to appropriate pages (e.g., back to list view)
 *
 *  Alternative (NOT RECOMMENDED):
 *  - Use GET: ["DELETE"] to rerun and display 404 error received from backend
 *  - Poor UX: users expect immediate feedback, not loading + error state
 *
 *  GET_MANY: ["POST"]
 *  - POST: New items may or may not appear in lists (depends on filters, pagination, etc.)
 *    Backend determines visibility better than client-side logic
 *  - DELETE: Excluded by default because:
 *    • UI handles deletions via store signals (selectAll filters out deleted items)
 *    • DELETE operations rarely change list content beyond item removal
 *    • Avoids unnecessary API calls (can be overridden if needed)
 */
const defaultRerunOn = {
  GET: false,
  GET_MANY: [
    "POST",
    // "DELETE"
  ],
};

// This handles ALL resource lifecycle logic (rerun/reset) across all resources
export const createResourceLifecycleManager = () => {
  const registeredResources = new Map(); // Map<resourceInstance, lifecycleConfig>
  const resourceDependencies = new Map(); // Map<resourceInstance, Set<dependentResources>> — user-configured
  const scopedManyParents = new Map(); // Map<childResource, Set<parentResource>> — auto from scopedMany

  const registerResource = (resourceScope, config) => {
    const {
      rerunOn = defaultRerunOn,
      paramScope = null,
      dependencies = [],
      uniqueKeys = [],
    } = config;

    registeredResources.set(resourceScope, {
      rerunOn,
      paramScope,
      uniqueKeys,
      restActionSet: new Set(),
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
  const registerAction = (resourceScope, restAction) => {
    const config = registeredResources.get(resourceScope);
    if (config) {
      config.restActionSet.add(restAction);
    }
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
      const paramScope = config.paramScope;

      // Skip if no rerun or reset rules apply
      const hasUniqueKeyAutorerun =
        (triggerVerb === "POST" ||
          triggerVerb === "PUT" ||
          triggerVerb === "PATCH") &&
        config.uniqueKeys.length > 0;

      if (
        !shouldRerunGetMany &&
        !shouldRerunGet &&
        triggerVerb !== "DELETE" &&
        !hasUniqueKeyAutorerun
      ) {
        continue;
      }

      // Parameter scope predicate for config-driven rules
      // Same scope ID or no scope = compatible, subset check for different scopes
      const paramScopePredicate = (candidateAction) => {
        const candidateParamScope = candidateAction.meta.paramScope;
        if (candidateParamScope.id === paramScope.id) {
          return true;
        }
        return isParamSubset(candidateParamScope.params, paramScope.params);
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

          // Unique key effects: rerun GET when matching resource created/updated
          unique_key_effect: {
            if (
              hasUniqueKeyAutorerun &&
              candidateVerb === "GET" &&
              !candidateIsPlural &&
              isSameResource
            ) {
              const { valueSignal } = triggeringAction;
              const modifiedValue = valueSignal.peek();

              if (modifiedValue && typeof modifiedValue === "object") {
                for (const uniqueKey of config.uniqueKeys) {
                  const modifiedUniqueId = modifiedValue[uniqueKey];
                  const candidateParams = actionCandidate.params;

                  if (
                    modifiedUniqueId !== undefined &&
                    candidateParams &&
                    typeof candidateParams === "object" &&
                    candidateParams[uniqueKey] === modifiedUniqueId
                  ) {
                    actionsToRerun.add(actionCandidate);
                    reasonSet.add(
                      `${triggeringAction.meta.verb}-uniqueKey autorerun`,
                    );
                    break;
                  }
                }
              }
            }
          }

          // Cross-resource dependency effects: rerun dependent GET / GET_MANY
          // Only on POST — same rationale as defaultRerunOn.GET_MANY: ["POST"]
          dependency_effect: {
            if (
              triggerResourceScope &&
              resourceDependencies
                .get(triggerResourceScope)
                ?.has(resourceScope) &&
              triggerVerb === "POST" &&
              candidateVerb === "GET"
            ) {
              actionsToRerun.add(actionCandidate);
              reasonSet.add("dependency autorerun");
              continue;
            }
          }

          // scopedMany auto-dependency: only rerun parent singular GET on child POST.
          // GET_MANY is excluded — a list of parents is not stale just because one
          // child item was added to one of them.
          scoped_many_effect: {
            if (
              triggerResourceScope &&
              scopedManyParents.get(triggerResourceScope)?.has(resourceScope) &&
              triggerVerb === "POST" &&
              candidateVerb === "GET" &&
              !candidateIsPlural
            ) {
              actionsToRerun.add(actionCandidate);
              reasonSet.add("scopedMany parent autorerun");
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
    // Registers: when `triggerResource` fires, rerun `dependentResource`'s actions.
    // Used by scopedMany to make the parent GET rerun when a child mutation completes.
    addDependency: (triggerResource, dependentResource) => {
      if (!scopedManyParents.has(triggerResource)) {
        scopedManyParents.set(triggerResource, new Set());
      }
      scopedManyParents.get(triggerResource).add(dependentResource);
    },
  };
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
    if (!(key in childParams) || !compareTwoJsValues(childParams[key], value)) {
      return false;
    }
  }
  return true;
};

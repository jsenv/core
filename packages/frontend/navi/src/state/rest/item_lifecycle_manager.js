import { RUNNING } from "../../action/action_run_states.js";
import { getActionDispatcher } from "../../action/actions.js";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

// WeakMap<action, Set<string>> — tracks which top-level properties were present in
// the GET response for a given action instance. Used by scoped_many_effect to check
// whether the parent GET embedded the child sub-resource.
const actionResultPropertiesMap = new WeakMap();
export const recordGetResultProperties = (action, resultKeys) => {
  actionResultPropertiesMap.set(action, new Set(resultKeys));
};
const getActionResultProperties = (action) => {
  return actionResultPropertiesMap.get(action);
};

// Rationale in full, plus when to override: docs/list_refresh.md
const defaultRerunOn = {
  // PUT/PATCH results update the UI through the store, and DELETE resets the
  // GET rather than rerunning it, so a GET rerun would only ever cost a request.
  GET: false,
  // A POST is the one case the client cannot decide alone: whether a new item
  // belongs to a list depends on filters/pagination the backend owns.
  GET_MANY: ["POST"],
  // DELETE is in there, unlike for GET_MANY: an action holds ids and the store
  // drops the deleted one out of every list holding it, while a list reading
  // by slices holds places — the row that left takes the ones after it one
  // rank up, and only the collection knows who fills the last one.
  GET_RANGE: ["POST", "DELETE"],
};
// A key a `rerunOn` leaves out keeps the value it would have had without it:
// the default for a resource, the value of the resource it is declared on for
// a withParams() scope or a relation.
export const resolveRerunOn = (rerunOn, inheritedRerunOn = defaultRerunOn) => {
  if (!rerunOn) {
    return inheritedRerunOn;
  }
  assertRerunOnCanFire(rerunOn);
  return {
    GET: rerunOn.GET ?? inheritedRerunOn.GET,
    GET_MANY: rerunOn.GET_MANY ?? inheritedRerunOn.GET_MANY,
    GET_RANGE: rerunOn.GET_RANGE ?? inheritedRerunOn.GET_RANGE,
  };
};
// What can never fire throws, as a dependency name does (see
// resolveDependency): a rerun that never happens leaves a read on its old
// value with nothing to say so.
const RERUN_READS = ["GET", "GET_MANY", "GET_RANGE"];
const RERUN_VERBS = ["POST", "PUT", "PATCH", "DELETE", "*"];
const assertRerunOnCanFire = (rerunOn) => {
  for (const read of Object.keys(rerunOn)) {
    if (!RERUN_READS.includes(read)) {
      throw new Error(
        `rerunOn: "${read}" is not a read that reruns — rerunOn takes GET, GET_MANY and GET_RANGE`,
      );
    }
    const verbs = rerunOn[read];
    if (
      verbs === undefined ||
      verbs === null ||
      verbs === false ||
      verbs === "*"
    ) {
      continue;
    }
    if (!Array.isArray(verbs)) {
      throw new Error(
        `rerunOn.${read}: ${JSON.stringify(verbs)} never fires — it takes false, "*" or a list of verbs`,
      );
    }
    for (const verb of verbs) {
      if (
        typeof verb !== "string" ||
        !RERUN_VERBS.includes(verb.toUpperCase())
      ) {
        throw new Error(
          `rerunOn.${read}: ${JSON.stringify(verb)} never fires — rerunOn names verbs (POST, PUT, PATCH, DELETE or "*"): POST covers POST_MANY`,
        );
      }
    }
  }
};

// What a `dependencies` entry names are callbacks, not verbs (`rerunOn` names
// verbs, where `PATCH` covers `PATCH_MANY`): one callback of a resource can be
// the write that creates (a move into a new item) while its sibling only edits.
const WRITE_CALLBACK_NAMES = [
  "POST",
  "POST_MANY",
  "PUT",
  "PUT_MANY",
  "PATCH",
  "PATCH_MANY",
  "DELETE",
  "DELETE_MANY",
];

// This handles ALL resource lifecycle logic (rerun/reset) across all resources
export const createResourceLifecycleManager = () => {
  const registeredResources = new Map(); // Map<resourceInstance, lifecycleConfig>
  const resourceDependencies = new Map(); // Map<resourceInstance, Map<dependentResource, Set<writeCallbackName>>> — user-configured
  const scopedManyParents = new Map(); // Map<childResource, Set<{resource, propertyName}>> — auto from scopedMany

  const registerResource = (resourceScope, config) => {
    const {
      rerunOn,
      paramScope = null,
      dependencies = [],
      uniqueKeys = [],
    } = config;

    registeredResources.set(resourceScope, {
      rerunOn,
      paramScope,
      uniqueKeys,
      restActionSet: new Set(),
      rangeReaderSet: new Set(),
    });

    for (const dependency of dependencies) {
      const [dependencyScope, writeNames] = resolveDependency(
        dependency,
        resourceScope,
      );
      let dependentMap = resourceDependencies.get(dependencyScope);
      if (!dependentMap) {
        dependentMap = new Map();
        resourceDependencies.set(dependencyScope, dependentMap);
      }
      let writeNameSet = dependentMap.get(resourceScope);
      if (!writeNameSet) {
        writeNameSet = new Set();
        dependentMap.set(resourceScope, writeNameSet);
      }
      for (const writeName of writeNames) {
        writeNameSet.add(writeName);
      }
    }
  };
  // Whether `resourceScope` listed the facade that wrote, with this write
  // among the ones that count.
  const isWriteHeardBy = (resourceScope, triggeringAction, triggerScope) => {
    const writeNameSet = resourceDependencies
      .get(triggerScope)
      ?.get(resourceScope);
    if (!writeNameSet) {
      return false;
    }
    const { verb, isMany } = triggeringAction.meta;
    return writeNameSet.has(isMany ? `${verb}_MANY` : verb);
  };
  const isScopedManyOwner = (resourceScope, childScope) => {
    const parentEntries = scopedManyParents.get(childScope);
    if (!parentEntries) {
      return false;
    }
    for (const { resource } of parentEntries) {
      if (resource === resourceScope) {
        return true;
      }
    }
    return false;
  };
  // Only the reader the resource exposes is registered; the ones `bindParams`
  // makes share its signal (see resource_range_reader.js).
  const registerRangeReader = (resourceScope, rangeReader) => {
    const config = registeredResources.get(resourceScope);
    if (config) {
      config.rangeReaderSet.add(rangeReader);
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

      const isHeardDependency = isWriteHeardBy(
        resourceScope,
        triggeringAction,
        triggerResourceScope,
      );
      // Read by no rerunOn rule: the owner's GET_MANY/GET settings say
      // nothing about the child collection its GET embeds.
      const ownsPostedScopedMany =
        triggerVerb === "POST" &&
        isScopedManyOwner(resourceScope, triggerResourceScope);

      if (
        !shouldRerunGetMany &&
        !shouldRerunGet &&
        triggerVerb !== "DELETE" &&
        !hasUniqueKeyAutorerun &&
        !isHeardDependency &&
        !ownsPostedScopedMany
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
        // A read still out left before this write landed: its answer is as
        // stale as a completed one, and replaces what the write put in the
        // store. A rerun aborts it and asks again.
        const actionCandidateArray = restAction.matchAllSelfOrDescendant(
          (action) =>
            !action.isPrerun &&
            (action.completed || action.runningState === RUNNING) &&
            action !== triggeringAction,
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
          // after a write the dependency counts — every write for a resource
          // listed bare, the callbacks named in `on` otherwise.
          dependency_effect: {
            if (isHeardDependency && candidateVerb === "GET") {
              actionsToRerun.add(actionCandidate);
              reasonSet.add("dependency autorerun");
              continue;
            }
          }

          // scopedMany auto-dependency: only rerun parent singular GET on child POST,
          // only the GET of the owner the child was posted to, and only when that
          // GET previously returned the sub-resource embedded inside its response
          // (recordGetResultProperties) — a GET still on its first load is taken
          // at what scopedMany declares, an owner embedding its children.
          // GET_MANY is excluded — a list of parents is not stale just because one
          // child item was added to one of them.
          scoped_many_effect: {
            if (
              triggerResourceScope &&
              triggerVerb === "POST" &&
              candidateVerb === "GET" &&
              !candidateIsPlural
            ) {
              const parentEntries = scopedManyParents.get(triggerResourceScope);
              if (!parentEntries) {
                break scoped_many_effect;
              }
              for (const {
                resource: parentResource,
                propertyName,
              } of parentEntries) {
                if (parentResource !== resourceScope) {
                  continue;
                }
                if (
                  !isOwnerReadBy(
                    triggerResourceScope,
                    triggeringAction,
                    resourceScope,
                    actionCandidate,
                  )
                ) {
                  break scoped_many_effect;
                }
                const resultProperties =
                  getActionResultProperties(actionCandidate);
                if (resultProperties && !resultProperties.has(propertyName)) {
                  break scoped_many_effect;
                }
                actionsToRerun.add(actionCandidate);
                reasonSet.add("scopedMany parent autorerun");
                continue;
              }
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

  // Which readers hold slices of a collection the mutation just changed: the
  // one of the resource itself, and the ones of the resources that said they
  // depend on it.
  const invalidateRangeReaders = (
    triggeringAction,
    triggeringActionContext,
  ) => {
    const triggerVerb = triggeringAction.meta.verb;
    const triggerResourceScope = triggeringActionContext.resourceScope;
    for (const [resourceScope, config] of registeredResources) {
      if (config.rangeReaderSet.size === 0) {
        continue;
      }
      const isSameResource = resourceScope === triggerResourceScope;
      const isDependent = isWriteHeardBy(
        resourceScope,
        triggeringAction,
        triggerResourceScope,
      );
      if (!isSameResource && !isDependent) {
        continue;
      }
      if (!shouldRerunAfter(config.rerunOn.GET_RANGE, triggerVerb)) {
        continue;
      }
      for (const rangeReader of config.rangeReaderSet) {
        rangeReader.invalidate();
      }
    }
  };

  const onActionComplete = (restActionWhoJustCompleted, restActionContext) => {
    invalidateRangeReaders(restActionWhoJustCompleted, restActionContext);
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
    registerRangeReader,
    onActionComplete,
    // Registers: when `triggerResource` fires, rerun `dependentResource`'s actions.
    // Used by scopedMany to make the parent GET rerun when a child mutation completes.
    addDependency: (triggerResource, dependentResource, propertyName) => {
      if (!scopedManyParents.has(triggerResource)) {
        scopedManyParents.set(triggerResource, new Set());
      }
      scopedManyParents
        .get(triggerResource)
        .add({ resource: dependentResource, propertyName });
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
// A `dependencies` entry: a resource (every write counts), or
// `{ resource, on }` naming the write callbacks that do. A name that cannot
// fire throws here: a dependency that never fires leaves a read on its old
// value with nothing to say so.
const resolveDependency = (dependency, dependentScope) => {
  if (!Object.hasOwn(dependency, "resource")) {
    return [dependency, WRITE_CALLBACK_NAMES];
  }
  const { resource: dependencyScope, on } = dependency;
  const where = `resource(${dependentScope.name}) dependency on ${dependencyScope.name}`;
  if (!Array.isArray(on) || on.length === 0) {
    throw new Error(
      `${where}: "on" lists the writes that count, e.g. on: ["POST", "DELETE"] — list the resource itself for every write`,
    );
  }
  for (const writeName of on) {
    if (!WRITE_CALLBACK_NAMES.includes(writeName)) {
      throw new Error(
        `${where}: "${writeName}" is not a write, "on" takes ${WRITE_CALLBACK_NAMES.join(", ")}`,
      );
    }
    if (!dependencyScope[writeName]) {
      throw new Error(
        `${where}: ${dependencyScope.name} has no ${writeName}, so it would never rerun ${dependentScope.name}`,
      );
    }
  }
  return [dependencyScope, on];
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

// Whether a GET of the owner read the item a scoped child's action was answered
// for. The child's value names its owner first ([ownerKey, …], see scopedMany);
// the GET's value is the id of the item it read. The key may be a unique key
// rather than that id: both lead to the owner's one store of children. Values
// are read off the signals: the child's action is still completing, and its
// `value` property is only written once that batch ends.
const isOwnerReadBy = (
  childResource,
  childAction,
  ownerResource,
  ownerGetAction,
) => {
  const childValue = childAction.valueSignal.peek();
  if (!Array.isArray(childValue)) {
    return false;
  }
  const [ownerKey] = childValue;
  const ownerId = ownerGetAction.valueSignal.peek();
  // A first load the store has no row to draw for holds no id yet: the keys
  // its params name are all it says of the owner.
  const ownerKeysRead =
    ownerId === undefined
      ? ownerKeysNamedBy(ownerResource, ownerGetAction.params)
      : [ownerId];
  const { getChildStore } = childResource;
  const childStore = getChildStore ? getChildStore(ownerKey) : undefined;
  for (const ownerKeyRead of ownerKeysRead) {
    if (ownerKeyRead === ownerKey) {
      return true;
    }
    if (
      childStore !== undefined &&
      getChildStore(ownerKeyRead) === childStore
    ) {
      return true;
    }
  }
  return false;
};
// The keys a GET's params name its item by: the params themselves when they
// are the id, otherwise the value under idKey (an id or a unique key) and the
// ones under each unique key.
const ownerKeysNamedBy = (ownerResource, params) => {
  if (params === null || typeof params !== "object") {
    return [params];
  }
  const keys = [];
  for (const key of [ownerResource.idKey, ...ownerResource.uniqueKeys]) {
    const value = params[key];
    if (value !== undefined) {
      keys.push(value);
    }
  }
  return keys;
};

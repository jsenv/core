import { createIterableWeakSet } from "@jsenv/dom";
import { computed, signal } from "@preact/signals";

import { createAction, getActionDispatcher } from "../../action/actions.js";
import { SYMBOL_OBJECT_SIGNAL } from "../../action/symbol_object_signal.js";
import {
  SYMBOL_IDENTITY,
  compareTwoJsValues,
} from "../../utils/compare_two_js_values.js";
import { getCallerInfo } from "../../utils/get_caller_info.js";
import { arraySignalStore, primitiveCanBeId } from "./array_signal_store.js";

let DEBUG = true;

export const resource = (
  name,
  {
    GET,
    GET_MANY,
    POST,
    POST_MANY,
    PUT,
    PUT_MANY,
    PATCH,
    PATCH_MANY,
    DELETE,
    DELETE_MANY,

    // configuration options
    idKey,
    mutableIdKeys = [],
    rerunOn,

    // used internally when creating
    // - resource with relationship to other resources (.one/.many)
    // - parameterized resource (.withParams)
    restHandler,
  } = {},
) => {
  if (idKey === undefined) {
    idKey = mutableIdKeys.length === 0 ? "id" : mutableIdKeys[0];
  }
  const restCallbacks = {
    GET,
    GET_MANY,
    POST,
    POST_MANY,
    PUT,
    PUT_MANY,
    PATCH,
    PATCH_MANY,
    DELETE,
    DELETE_MANY,
  };
  const resourceInstance = {
    isResource: true,
    name,
    idKey,
    restCallbacks, // Store the action callback definitions for withParams to use later
    restHandler,
    addItemSetup: undefined,
    store: undefined,
    useArray: undefined,
    useById: undefined,
  };

  if (!restHandler) {
    const setupCallbackSet = new Set();
    const addItemSetup = (callback) => {
      setupCallbackSet.add(callback);
    };
    resourceInstance.addItemSetup = addItemSetup;

    const itemPrototype = {
      [Symbol.toStringTag]: name,
      toString() {
        let string = `${name}`;
        if (mutableIdKeys.length) {
          for (const mutableIdKey of mutableIdKeys) {
            const mutableId = this[mutableIdKey];
            if (mutableId !== undefined) {
              string += `[${mutableIdKey}=${mutableId}]`;
              return string;
            }
          }
        }
        const id = this[idKey];
        if (id) {
          string += `[${idKey}=${id}]`;
        }
        return string;
      },
    };

    const store = arraySignalStore([], idKey, {
      mutableIdKeys,
      name: `${name} store`,
      createItem: (props) => {
        const item = Object.create(itemPrototype);
        Object.assign(item, props);
        Object.defineProperty(item, SYMBOL_IDENTITY, {
          value: item[idKey],
          writable: false,
          enumerable: false,
          configurable: false,
        });
        for (const setupCallback of setupCallbackSet) {
          setupCallback(item);
        }
        return item;
      },
    });
    const useArray = () => {
      return store.arraySignal.value;
    };
    const useById = (id) => {
      return store.select(idKey, id);
    };

    Object.assign(resourceInstance, {
      useArray,
      useById,
      store,
    });

    restHandler = createRestHandlerForRoot(name, {
      idKey,
      store,
      rerunOn,
      resourceInstance,
      mutableIdKeys,
    });
  }
  resourceInstance.restHandler = restHandler;

  // Create rest actions
  for (const [restCallbackKey, restCallback] of Object.entries(restCallbacks)) {
    const restCallbackHandler = restHandler[restCallbackKey];
    if (!restCallbackHandler) {
      continue;
    }
    const action = restCallbackHandler(restCallback);
    resourceInstance[restCallbackKey] = action;
  }

  resourceInstance.one = (propertyName, childResource, options) => {
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    resourceInstance.addItemSetup((item) => {
      const childItemIdSignal = signal();
      const updateChildItemId = (value) => {
        const currentChildItemId = childItemIdSignal.peek();
        if (isProps(value)) {
          const childItem = childResource.store.upsert(value);
          const childItemId = childItem[childIdKey];
          if (currentChildItemId === childItemId) {
            return false;
          }
          childItemIdSignal.value = childItemId;
          return true;
        }
        if (primitiveCanBeId(value)) {
          const childItemProps = { [childIdKey]: value };
          const childItem = childResource.store.upsert(childItemProps);
          const childItemId = childItem[childIdKey];
          if (currentChildItemId === childItemId) {
            return false;
          }
          childItemIdSignal.value = childItemId;
          return true;
        }
        if (currentChildItemId === undefined) {
          return false;
        }
        childItemIdSignal.value = undefined;
        return true;
      };
      updateChildItemId(item[propertyName]);

      const childItemSignal = computed(() => {
        const childItemId = childItemIdSignal.value;
        const childItem = childResource.store.select(childItemId);
        return childItem;
      });
      const childItemFacadeSignal = computed(() => {
        const childItem = childItemSignal.value;
        if (childItem) {
          const childItemCopy = Object.create(
            Object.getPrototypeOf(childItem),
            Object.getOwnPropertyDescriptors(childItem),
          );
          Object.defineProperty(childItemCopy, SYMBOL_OBJECT_SIGNAL, {
            value: childItemSignal,
            writable: false,
            enumerable: false,
            configurable: false,
          });
          return childItemCopy;
        }
        const nullItem = {
          [SYMBOL_OBJECT_SIGNAL]: childItemSignal,
          valueOf: () => null,
        };
        return nullItem;
      });

      if (DEBUG) {
        console.debug(
          `setup ${item}.${propertyName} is one "${childResource.name}" (current value: ${childItemSignal.peek()})`,
        );
      }

      Object.defineProperty(item, propertyName, {
        get: () => {
          const childItemFacade = childItemFacadeSignal.value;
          return childItemFacade;
        },
        set: (value) => {
          if (!updateChildItemId(value)) {
            return;
          }
          if (DEBUG) {
            console.debug(
              `${item}.${propertyName} updated to ${childItemSignal.peek()}`,
            );
          }
        },
      });
    });
    const restHandlerForRelationshipToOne =
      createRestHandlerForRelationshipToOne(childName, {
        idKey,
        store: resourceInstance.store,
        propertyName,
        childIdKey,
        childStore: childResource.store,
        resourceInstance,
        resourceLifecycleManager,
      });
    return resource(childName, {
      idKey: childIdKey,
      restHandler: restHandlerForRelationshipToOne,
      ...options,
    });
  };
  resourceInstance.many = (propertyName, childResource, options) => {
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    resourceInstance.addItemSetup((item) => {
      const childItemIdArraySignal = signal([]);
      const updateChildItemIdArray = (valueArray) => {
        const currentIdArray = childItemIdArraySignal.peek();

        if (!Array.isArray(valueArray)) {
          if (currentIdArray.length === 0) {
            return;
          }
          childItemIdArraySignal.value = [];
          return;
        }

        let i = 0;
        const idArray = [];
        let modified = false;
        while (i < valueArray.length) {
          const value = valueArray[i];
          const currentIdAtIndex = currentIdArray[idArray.length];
          i++;
          if (isProps(value)) {
            const childItem = childResource.store.upsert(value);
            const childItemId = childItem[childIdKey];
            if (currentIdAtIndex !== childItemId) {
              modified = true;
            }
            idArray.push(childItemId);
            continue;
          }
          if (primitiveCanBeId(value)) {
            const childItemProps = { [childIdKey]: value };
            const childItem = childResource.store.upsert(childItemProps);
            const childItemId = childItem[childIdKey];
            if (currentIdAtIndex !== childItemId) {
              modified = true;
            }
            idArray.push(childItemId);
            continue;
          }
        }
        if (modified || currentIdArray.length !== idArray.length) {
          childItemIdArraySignal.value = idArray;
        }
      };
      updateChildItemIdArray(item[propertyName]);
      childResource.store.observeProperties((mutations) => {
        const idArray = childItemIdArraySignal.peek();
        if (idArray.length === 0) {
          return;
        }
        const idSet = new Set(idArray);
        const idMutationMap = new Map();
        for (const mutation of mutations) {
          const idKeyMutation = mutation[childIdKey];
          if (!idKeyMutation) {
            continue;
          }
          const { oldValue, newValue } = idKeyMutation;
          if (!idSet.has(oldValue)) {
            continue;
          }
          idMutationMap.set(oldValue, newValue);
        }
        if (idMutationMap.size === 0) {
          return;
        }
        const idUpdatedArray = [];
        for (const id of idArray) {
          idUpdatedArray.push(idMutationMap.get(id) ?? id);
        }
        childItemIdArraySignal.value = idUpdatedArray;
      });

      const childItemArraySignal = computed(() => {
        const childItemIdArray = childItemIdArraySignal.value;
        const childItemArray = childResource.store.selectAll(childItemIdArray);
        Object.defineProperty(childItemArray, SYMBOL_OBJECT_SIGNAL, {
          value: childItemArraySignal,
          writable: false,
          enumerable: false,
          configurable: false,
        });
        return childItemArray;
      });

      if (DEBUG) {
        const childItemArray = childItemArraySignal.peek();
        console.debug(
          `setup ${item}.${propertyName} is many "${childResource.name}" (current value: ${childItemArray.length ? childItemArray.join(",") : "[]"})`,
        );
      }

      Object.defineProperty(item, propertyName, {
        get: () => {
          const childItemArray = childItemArraySignal.value;
          if (DEBUG) {
            console.debug(
              `return ${childItemArray.length ? childItemArray.join(",") : "[]"} for ${item}.${propertyName}`,
            );
          }
          return childItemArray;
        },
        set: (value) => {
          updateChildItemIdArray(value);
          if (DEBUG) {
            console.debug(
              `${item}.${propertyName} updated to ${childItemIdArraySignal.peek()}`,
            );
          }
        },
      });
    });
    const restHandlerForRelationshipToMany =
      createRestHandlerForRelationshipToMany(childName, {
        idKey,
        store: resourceInstance.store,
        propertyName,
        childIdKey,
        childStore: childResource.store,
        resourceInstance,
        resourceLifecycleManager,
      });
    return resource(childName, {
      idKey: childIdKey,
      restHandler: restHandlerForRelationshipToMany,
      ...options,
    });
  };

  // .ownMany() is for resources that own a list of sub-objects which can be mutated
  // directly via dedicated endpoints, without re-sending the whole parent.
  //
  // Example: a TABLE has COLUMNS. You receive them when you GET the table, and you
  // have dedicated endpoints to rename, reorder, or delete individual columns.
  // The columns have no identity outside of their table — two tables can have a
  // column named "id" and they are completely independent objects.
  //
  // Each owner item gets its own private arraySignalStore (no shared global store,
  // no id clashes across owners). All callbacks must return [ownerId, ...rest] so
  // the right per-owner store is updated.
  resourceInstance.ownMany = (
    propertyName,
    {
      GET,
      GET_MANY,
      POST,
      POST_MANY,
      PUT,
      PUT_MANY,
      PATCH,
      PATCH_MANY,
      DELETE,
      DELETE_MANY,

      idKey: childIdKey = "id",
    } = {},
  ) => {
    const childName = `${name}.${propertyName}`;
    const restCallbacks = {
      GET,
      GET_MANY,
      POST,
      POST_MANY,
      PUT,
      PUT_MANY,
      PATCH,
      PATCH_MANY,
      DELETE,
      DELETE_MANY,
    };
    const ownerStoreMap = new Map(); // ownerId → childStore
    const ownerIdArraySignalMap = new Map(); // ownerId → childItemIdArraySignal

    resourceInstance.addItemSetup((item) => {
      const ownerId = item[idKey];
      const childStore = arraySignalStore([], childIdKey, {
        name: `${name}#${ownerId}.${propertyName} store`,
      });
      ownerStoreMap.set(ownerId, childStore);

      const childItemIdArraySignal = signal([]);
      ownerIdArraySignalMap.set(ownerId, childItemIdArraySignal);

      const updateChildItemIdArray = (valueArray) => {
        const currentIdArray = childItemIdArraySignal.peek();
        if (!Array.isArray(valueArray)) {
          if (currentIdArray.length === 0) return;
          childItemIdArraySignal.value = [];
          return;
        }
        let i = 0;
        const idArray = [];
        let modified = false;
        while (i < valueArray.length) {
          const value = valueArray[i];
          const currentIdAtIndex = currentIdArray[idArray.length];
          i++;
          if (isProps(value)) {
            const childItem = childStore.upsert(value);
            const childItemId = childItem[childIdKey];
            if (currentIdAtIndex !== childItemId) modified = true;
            idArray.push(childItemId);
            continue;
          }
          if (primitiveCanBeId(value)) {
            const childItemProps = { [childIdKey]: value };
            const childItem = childStore.upsert(childItemProps);
            const childItemId = childItem[childIdKey];
            if (currentIdAtIndex !== childItemId) modified = true;
            idArray.push(childItemId);
            continue;
          }
        }
        if (modified || currentIdArray.length !== idArray.length) {
          childItemIdArraySignal.value = idArray;
        }
      };

      updateChildItemIdArray(item[propertyName]);

      // When an id is renamed (PUT/PATCH changes the idKey), patch the id array.
      childStore.observeProperties((mutations) => {
        const idArray = childItemIdArraySignal.peek();
        if (idArray.length === 0) return;
        const idSet = new Set(idArray);
        const idMutationMap = new Map();
        for (const mutation of mutations) {
          const idKeyMutation = mutation[childIdKey];
          if (!idKeyMutation) continue;
          const { oldValue, newValue } = idKeyMutation;
          if (!idSet.has(oldValue)) continue;
          idMutationMap.set(oldValue, newValue);
        }
        if (idMutationMap.size === 0) return;
        const idUpdatedArray = [];
        for (const id of idArray) {
          idUpdatedArray.push(idMutationMap.get(id) ?? id);
        }
        childItemIdArraySignal.value = idUpdatedArray;
      });

      const childItemArraySignal = computed(() => {
        const childItemIdArray = childItemIdArraySignal.value;
        const childItemArray = childStore.selectAll(childItemIdArray);
        Object.defineProperty(childItemArray, SYMBOL_OBJECT_SIGNAL, {
          value: childItemArraySignal,
          writable: false,
          enumerable: false,
          configurable: false,
        });
        return childItemArray;
      });

      Object.defineProperty(item, propertyName, {
        get: () => childItemArraySignal.value,
        set: (value) => {
          updateChildItemIdArray(value);
        },
      });
    });

    const collectionInstance = { name: childName, idKey: childIdKey };
    for (const [restCallbackKey, restCallback] of Object.entries(
      restCallbacks,
    )) {
      const restMethod = restCallbackKey.replace("_MANY", "");
      const restIsMany = restCallbackKey.endsWith("_MANY");
      const childActionName = `${childName}.${restCallbackKey}`;
      const action = createAction(restCallback, {
        name: childActionName,
        meta: { restMethod, restIsMany },
        resultToValue: (result) => {
          if (!Array.isArray(result) || result.length < 2) {
            throw new TypeError(
              `${childActionName} callback must return [ownerId, ...] array, received ${result}`,
            );
          }
          const [ownerId, ...rest] = result;
          const childStore = ownerStoreMap.get(ownerId);
          if (!childStore) {
            throw new Error(
              `${childActionName}: no store found for owner id "${ownerId}"`,
            );
          }
          const childItemIdArraySignal = ownerIdArraySignalMap.get(ownerId);

          if (restMethod === "DELETE") {
            if (restIsMany) {
              const idArray = childStore.drop(rest[0]);
              const toRemoveSet = new Set(idArray);
              childItemIdArraySignal.value = childItemIdArraySignal
                .peek()
                .filter((id) => !toRemoveSet.has(id));
              return [ownerId, idArray];
            }
            const childId = childStore.drop(rest[0]);
            childItemIdArraySignal.value = childItemIdArraySignal
              .peek()
              .filter((id) => id !== childId);
            return [ownerId, childId];
          }

          if (restIsMany) {
            // GET_MANY, POST_MANY, PUT_MANY etc: rest[0] is the array of items
            const itemArray = childStore.upsert(rest[0]);
            const idArray = itemArray.map((i) => i[childIdKey]);
            childItemIdArraySignal.value = idArray;
            return [ownerId, idArray];
          }

          // PUT, PATCH, POST: rest may be [props] or ["idKey", oldId, props] for renames
          const childItem =
            rest.length > 1
              ? childStore.upsert(...rest)
              : childStore.upsert(rest[0]);
          return [ownerId, childItem[childIdKey]];
        },
      });

      collectionInstance[restCallbackKey] = action;
    }

    return collectionInstance;
  };

  // .ownOne() is for a single sub-object owned exclusively by the parent resource.
  // Unlike .collection(), there is no array — each owner has exactly one child object.
  //
  // Example: a TABLE has a single SETTINGS object (theme, page size, etc.).
  // You can PUT/PATCH it directly without re-sending the whole table.
  // The settings have no identity outside their table.
  //
  // Each owner item gets its own private signal. Callbacks must return [ownerId, props]
  // so the right per-owner signal is updated.
  resourceInstance.ownOne = (
    propertyName,
    { GET, POST, PUT, PATCH, DELETE } = {},
  ) => {
    const restCallbacks = { GET, POST, PUT, PATCH, DELETE };
    const childName = `${name}.${propertyName}`;
    const ownerSignalMap = new Map(); // ownerId → signal(childProps)

    resourceInstance.addItemSetup((item) => {
      const ownerId = item[idKey];
      const childSignal = signal(item[propertyName] ?? null);
      ownerSignalMap.set(ownerId, childSignal);

      Object.defineProperty(item, propertyName, {
        get: () => childSignal.value,
        set: (value) => {
          childSignal.value = value ?? null;
        },
      });
    });

    const itemInstance = { name: childName };
    for (const [restCallbackKey, restCallback] of Object.entries(
      restCallbacks,
    )) {
      const restMethod = restCallbackKey;
      const childActionName = `${childName}.${restMethod}`;
      const action = createAction(restCallback, {
        name: childActionName,
        meta: { restMethod, restIsMany: false },
        resultToValue: (result) => {
          if (!Array.isArray(result) || result.length !== 2) {
            throw new TypeError(
              `${childActionName} callback must return [ownerId, props], received ${result}`,
            );
          }
          const [ownerId, props] = result;
          const childSignal = ownerSignalMap.get(ownerId);
          if (!childSignal) {
            throw new Error(
              `${childActionName}: no signal found for owner id "${ownerId}"`,
            );
          }
          childSignal.value = props;
          return [ownerId, props];
        },
      });
      itemInstance[restCallbackKey] = action;
    }

    return itemInstance;
  };

  /**
   * Creates a parameterized version of the resource with isolated resource lifecycle behavior.
   *
   * Actions from parameterized resources only trigger rerun/reset for other actions with
   * identical parameters, preventing cross-contamination between different parameter sets.
   *
   * @param {Object} params - Parameters to bind to all actions of this resource (required)
   * @param {Object} options - Additional options for the parameterized resource
   * @param {Array} options.dependencies - Array of resources that should trigger autorerun when modified
   * @param {Object} options.rerunOn - Configuration for when to rerun GET/GET_MANY actions
   * @param {false|Array|string} options.rerunOn.GET - HTTP verbs that trigger GET rerun (false = reset on DELETE)
   * @param {false|Array|string} options.rerunOn.GET_MANY - HTTP verbs that trigger GET_MANY rerun (false = reset on DELETE)
   * @returns {Object} A new resource instance with parameter-bound actions and isolated lifecycle
   * @see {@link ./docs/resource_with_params.md} for detailed documentation and examples
   *
   * @example
   * const ROLE = resource("role", { GET: (params) => fetchRole(params) });
   * const adminRoles = ROLE.withParams({ canlogin: true });
   * const guestRoles = ROLE.withParams({ canlogin: false });
   * // adminRoles and guestRoles have isolated autorerun behavior
   *
   * @example
   * // Cross-resource dependencies
   * const role = resource("role");
   * const database = resource("database");
   * const tables = resource("tables");
   * const ROLE_WITH_OWNERSHIP = role.withParams({ owners: true }, {
   *   dependencies: [role, database, tables],
   * });
   * // ROLE_WITH_OWNERSHIP.GET_MANY will autorerun when any table/database/role is POST/DELETE
   */
  const withParams = (params, options = {}) => {
    // Require parameters
    if (!params || Object.keys(params).length === 0) {
      throw new Error(`resource(${name}).withParams() requires parameters`);
    }
    const { dependencies = [], rerunOn: customRerunOn } = options;

    // Generate unique param scope for these parameters
    const paramScopeObject = getParamScope(params);
    // Use custom rerunOn settings if provided, otherwise use resource defaults
    const finalRerunOn = customRerunOn || rerunOn;

    // Create a new handler with the param scope for isolated autorerun
    const parameterizedRestHandler = createRestHandlerForRoot(name, {
      idKey,
      store: resourceInstance.store,
      rerunOn: finalRerunOn,
      paramScope: paramScopeObject,
      dependencies,
      resourceInstance,
      mutableIdKeys,
    });

    // Create parameterized resource
    const parameterizedResource = {
      isResource: true,
      name,
      idKey,
      useArray: resourceInstance.useArray,
      useById: resourceInstance.useById,
      store: resourceInstance.store,
      addItemSetup: resourceInstance.addItemSetup,
      one: resourceInstance.one,
      many: resourceInstance.many,

      restHandler: parameterizedRestHandler,
      restCallbacks: resourceInstance.restCallbacks,

      dependencies, // Store dependencies for debugging/inspection
    };

    // Create actions from the parameterized handler and bind parameters
    for (const [restCallbackKey, restCallback] of Object.entries(
      resourceInstance.restCallbacks,
    )) {
      const restCallbackHandler = parameterizedRestHandler[restCallbackKey];
      if (!restCallbackHandler) {
        continue;
      }
      const action = restCallbackHandler(restCallback);
      // Bind the parameters to get a parameterized action instance
      const actionWithParams = action.bindParams(params);
      parameterizedResource[restCallbackKey] = actionWithParams;
    }

    // Add withParams method to the parameterized resource for chaining
    parameterizedResource.withParams = (newParams, newOptions = {}) => {
      if (!newParams || Object.keys(newParams).length === 0) {
        throw new Error(`resource(${name}).withParams() requires parameters`);
      }
      // Merge current params with new ones for chaining
      const mergedParams = { ...params, ...newParams };
      // Merge options, with new options taking precedence
      const mergedOptions = {
        dependencies,
        rerunOn: finalRerunOn,
        ...newOptions,
      };
      return withParams(mergedParams, mergedOptions);
    };

    return parameterizedResource;
  };
  resourceInstance.withParams = withParams;

  return resourceInstance;
};

// Resource Lifecycle Manager
// This handles ALL resource lifecycle logic (rerun/reset) across all resources
const createResourceLifecycleManager = () => {
  const registeredResources = new Map(); // Map<resourceInstance, lifecycleConfig>
  const resourceDependencies = new Map(); // Map<resourceInstance, Set<dependentResources>>

  const registerResource = (resourceInstance, config) => {
    const {
      rerunOn,
      paramScope = null,
      dependencies = [],
      mutableIdKeys = [],
    } = config;

    registeredResources.set(resourceInstance, {
      rerunOn,
      paramScope,
      mutableIdKeys,
      restActionSet: new Set(),
    });

    // Register dependencies
    if (dependencies.length > 0) {
      for (const dependency of dependencies) {
        if (!resourceDependencies.has(dependency)) {
          resourceDependencies.set(dependency, new Set());
        }
        resourceDependencies.get(dependency).add(resourceInstance);
      }
    }
  };

  const registerAction = (resourceInstance, restAction) => {
    const config = registeredResources.get(resourceInstance);
    if (config) {
      config.restActionSet.add(restAction);
    }
  };

  const shouldRerunAfter = (rerunConfig, restMethod) => {
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
      return methodSet.has(restMethod.toUpperCase());
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

  const findEffectOnActions = (triggeringAction) => {
    // Determines which actions to rerun/reset when an action completes.

    const actionsToRerun = new Set();
    const actionsToReset = new Set();
    const reasonSet = new Set();

    for (const [resourceInstance, config] of registeredResources) {
      const shouldRerunGetMany = shouldRerunAfter(
        config.rerunOn.GET_MANY,
        triggeringAction.meta.restMethod,
      );
      const shouldRerunGet = shouldRerunAfter(
        config.rerunOn.GET,
        triggeringAction.meta.restMethod,
      );

      // Skip if no rerun or reset rules apply
      const hasMutableIdAutorerun =
        (triggeringAction.meta.restMethod === "POST" ||
          triggeringAction.meta.restMethod === "PUT" ||
          triggeringAction.meta.restMethod === "PATCH") &&
        config.mutableIdKeys.length > 0;

      if (
        !shouldRerunGetMany &&
        !shouldRerunGet &&
        triggeringAction.meta.restMethod !== "DELETE" &&
        !hasMutableIdAutorerun
      ) {
        continue;
      }

      // Parameter scope predicate for config-driven rules
      // Same scope ID or no scope = compatible, subset check for different scopes
      const paramScopePredicate = config.paramScope
        ? (candidateAction) => {
            if (candidateAction.meta.paramScope?.id === config.paramScope.id) {
              return true;
            }
            if (!candidateAction.meta.paramScope) {
              return true;
            }
            const candidateParams = candidateAction.meta.paramScope.params;
            const currentParams = config.paramScope.params;
            return isParamSubset(candidateParams, currentParams);
          }
        : (candidateAction) => !candidateAction.meta.paramScope;

      for (const restAction of config.restActionSet) {
        // Find all instances of this action
        const actionCandidateArray = restAction.matchAllSelfOrDescendant(
          (action) =>
            !action.isPrerun && action.completed && action !== triggeringAction,
        );

        for (const actionCandidate of actionCandidateArray) {
          const triggerRestMethod = triggeringAction.meta.restMethod;
          const candidateRestMethod = actionCandidate.meta.restMethod;

          if (triggerRestMethod === candidateRestMethod) {
            continue;
          }

          const candidateIsPlural = actionCandidate.meta.restIsMany;
          const triggeringResource = getResourceForAction(triggeringAction);
          const isSameResource = triggeringResource === resourceInstance;

          // Config-driven same-resource effects (respects param scope)
          config_effect: {
            if (
              !isSameResource ||
              triggerRestMethod === "GET" ||
              candidateRestMethod !== "GET"
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
            if (!isSameResource || triggerRestMethod !== "DELETE") {
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
            const deleteIdSet = triggeringAction.meta.restIsMany
              ? new Set(valueSignal.peek())
              : new Set([valueSignal.peek()]);

            const candidateId = actionCandidate.value;
            const isAffected = deleteIdSet.has(candidateId);
            if (!isAffected) {
              break delete_effect;
            }
            if (candidateRestMethod === "GET" && shouldRerunGet) {
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
              candidateRestMethod === "GET" &&
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
                      `${triggeringAction.meta.restMethod}-mutableId autorerun`,
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
              triggeringResource &&
              resourceDependencies
                .get(triggeringResource)
                ?.has(resourceInstance) &&
              triggerRestMethod !== "GET" &&
              candidateRestMethod === "GET" &&
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

  const onActionComplete = (restAction) => {
    const { actionsToRerun, actionsToReset, reasons } =
      findEffectOnActions(restAction);

    if (actionsToRerun.size > 0 || actionsToReset.size > 0) {
      const reason = `${restAction} triggered ${reasons.join(" and ")}`;
      const dispatchActions = getActionDispatcher();
      dispatchActions({
        rerunSet: actionsToRerun,
        resetSet: actionsToReset,
        reason,
      });
    }
  };

  // Helper to find which resource an action belongs to
  const getResourceForAction = (action) => {
    return action.meta.resourceInstance;
  };

  return {
    registerResource,
    registerAction,
    onActionComplete,
  };
};

// Global resource lifecycle manager instance
const resourceLifecycleManager = createResourceLifecycleManager();

// Cache for parameter scope identifiers
const paramScopeWeakSet = createIterableWeakSet();
let paramScopeIdCounter = 0;
const getParamScope = (params) => {
  for (const existingParamScope of paramScopeWeakSet) {
    if (compareTwoJsValues(existingParamScope.params, params)) {
      return existingParamScope;
    }
  }
  const id = Symbol(`paramScope-${++paramScopeIdCounter}`);
  const newParamScope = {
    params,
    id,
  };
  paramScopeWeakSet.add(newParamScope);
  return newParamScope;
};

const createRestHandlerForRoot = (
  name,
  {
    idKey,
    store, // see array_signal_store.js
    /*
    Default autorerun behavior explanation:

    GET: false (RECOMMENDED)
    What happens:
    - GET actions are reset by DELETE operations (not rerun)
    - DELETE operation on the displayed item would display nothing in the UI (action is in IDLE state)
    - PUT/PATCH operations update UI via signals, no rerun needed
    - This approach minimizes unnecessary API calls

    How to handle:
    - Applications can provide custom UI for deleted items (e.g., "Item not found")
    - Or redirect users to appropriate pages (e.g., back to list view)

    Alternative (NOT RECOMMENDED):
    - Use GET: ["DELETE"] to rerun and display 404 error received from backend
    - Poor UX: users expect immediate feedback, not loading + error state

    GET_MANY: ["POST"]
    - POST: New items may or may not appear in lists (depends on filters, pagination, etc.)
      Backend determines visibility better than client-side logic
    - DELETE: Excluded by default because:
      • UI handles deletions via store signals (selectAll filters out deleted items)
      • DELETE operations rarely change list content beyond item removal
      • Avoids unnecessary API calls (can be overridden if needed)
    */
    rerunOn = {
      GET: false,
      GET_MANY: [
        "POST",
        // "DELETE"
      ],
    },
    paramScope,
    dependencies = [],
    resourceInstance,
    mutableIdKeys = [],
  },
) => {
  // Register this resource with the resource lifecycle manager
  resourceLifecycleManager.registerResource(resourceInstance, {
    rerunOn,
    paramScope,
    dependencies,
    idKey,
    mutableIdKeys,
  });

  const createActionAffectingOneItem = (
    restMethod,
    { callback, ...options },
  ) => {
    const applyResultToValue =
      restMethod === "DELETE"
        ? (itemIdOrItemProps) => {
            const itemId = store.drop(itemIdOrItemProps);
            return itemId;
          }
        : (result) => {
            let item;
            if (Array.isArray(result)) {
              // the callback is returning something like [property, value, props]
              // this is to support a case like:
              // store.upsert("name", "currentName", { name: "newName" })
              // where we want to update the idKey of an item
              item = store.upsert(...result);
            } else {
              item = store.upsert(result);
            }
            const itemId = item[idKey];
            return itemId;
          };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${restMethod}`;
    const actionAffectingOneItem = createAction(callback, {
      name: `${name}.${restMethod}`,
      meta: {
        restMethod,
        restIsMany: false,
        paramScope,
        resourceInstance,
        store,
      },
      resultToValue: (result, action) => {
        const actionLabel = action.name;

        if (restMethod === "DELETE") {
          if (!isProps(result) && !primitiveCanBeId(result)) {
            throw new TypeError(
              `${actionLabel} must return an object (that will be used to drop "${name}" resource), received ${result}.
${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyResultToValue(result);
        }
        if (!isProps(result)) {
          throw new TypeError(
            `${actionLabel} must return an object (that will be used to upsert "${name}" resource), received ${result}.
${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyResultToValue(result);
      },
      valueToData: (itemId) => store.select(itemId),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      actionAffectingOneItem,
    );
    return actionAffectingOneItem;
  };
  const GET = (callback, options) =>
    createActionAffectingOneItem("GET", {
      callback,
      resultToValue: (result) => {
        const item = store.upsert(result);
        const itemId = item[idKey];
        return itemId;
      },
      valueToData: (itemId) => store.select(itemId),
      ...options,
    });
  const POST = (callback, options) =>
    createActionAffectingOneItem("POST", {
      callback,
      resultToValue: (result) => {
        const item = store.upsert(result);
        const itemId = item[idKey];
        return itemId;
      },
      valueToData: (itemId) => store.select(itemId),
      ...options,
    });
  const PUT = (callback, options) =>
    createActionAffectingOneItem("PUT", {
      callback,
      ...options,
    });
  const PATCH = (callback, options) =>
    createActionAffectingOneItem("PATCH", {
      callback,
      ...options,
    });
  const DELETE = (callback, options) =>
    createActionAffectingOneItem("DELETE", {
      callback,
      ...options,
    });

  const createActionAffectingManyItems = (
    restMethod,
    { callback, ...options },
  ) => {
    const applyResultToValue =
      restMethod === "DELETE"
        ? (idOrMutableIdArray) => {
            const idArray = store.drop(idOrMutableIdArray);
            return idArray;
          }
        : (dataArray) => {
            const itemArray = store.upsert(dataArray);
            const idArray = itemArray.map((item) => item[idKey]);
            return idArray;
          };

    const actionAffectingManyItems = createAction(callback, {
      meta: {
        restMethod,
        restIsMany: true,
        paramScope,
        resourceInstance,
        store,
      },
      name: `${name}.${restMethod}_MANY`,
      dataDefault: [],
      resultToValue: applyResultToValue,
      valueToData: (idArray) => {
        const items = store.selectAll(idArray);
        return items;
      },
      completeSideEffect: (actionCompleted) => {
        resourceLifecycleManager.onActionComplete(actionCompleted);
        if (
          restMethod === "DELETE" ||
          actionCompleted.valueSignal.peek().length === 0
        ) {
          return null;
        }
        // When an id is renamed (PUT/PATCH changes the idKey), the store fires observeProperties
        // with a mutation containing oldValue/newValue for that key. We patch this action's
        // valueSignal (the id array) so that selectAll keeps returning the right items.
        // The returned unsubscribe function is called by completeSideEffectCleanup on reset.
        return store.observeProperties((mutations) => {
          const idArray = actionCompleted.valueSignal.peek();
          if (idArray.length === 0) {
            return;
          }
          const idSet = new Set(idArray);
          const idMutationMap = new Map();
          for (const mutation of mutations) {
            const idKeyMutation = mutation[idKey];
            if (!idKeyMutation) {
              continue;
            }
            const { oldValue, newValue } = idKeyMutation;
            if (!idSet.has(oldValue)) {
              continue;
            }
            idMutationMap.set(oldValue, newValue);
          }
          if (idMutationMap.size === 0) {
            return;
          }
          const idUpdatedArray = [];
          for (const id of idArray) {
            if (idMutationMap.has(id)) {
              idUpdatedArray.push(idMutationMap.get(id));
            } else {
              idUpdatedArray.push(id);
            }
          }
          actionCompleted.valueSignal.value = idUpdatedArray;
        });
      },
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      actionAffectingManyItems,
    );
    return actionAffectingManyItems;
  };
  const GET_MANY = (callback, options) =>
    createActionAffectingManyItems("GET", { callback, ...options });
  const POST_MANY = (callback, options) =>
    createActionAffectingManyItems("POST", { callback, ...options });
  const PUT_MANY = (callback, options) =>
    createActionAffectingManyItems("PUT", { callback, ...options });
  const PATCH_MANY = (callback, options) =>
    createActionAffectingManyItems("PATCH", { callback, ...options });
  const DELETE_MANY = (callback, options) =>
    createActionAffectingManyItems("DELETE", { callback, ...options });

  return {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    GET_MANY,
    POST_MANY,
    PUT_MANY,
    PATCH_MANY,
    DELETE_MANY,
  };
};
const createRestHandlerForRelationshipToOne = (
  name,
  {
    idKey,
    store,
    propertyName,
    childIdKey,
    childStore,
    resourceInstance,
    resourceLifecycleManager,
  },
) => {
  const createActionAffectingOneItem = (
    restMethod,
    { callback, ...options },
  ) => {
    const applyResultToValue =
      restMethod === "DELETE"
        ? (itemId) => {
            const item = store.select(itemId);
            const childItemId = item[propertyName][childIdKey];
            store.upsert({
              [idKey]: itemId,
              [propertyName]: null,
            });
            return childItemId;
          }
        : // callback must return object with the following format:
          // {
          //   [idKey]: 123,
          //   [propertyName]: {
          //     [childIdKey]: 456, ...childProps
          //   }
          // }
          // the following could happen too if there is no relationship
          // {
          //   [idKey]: 123,
          //   [propertyName]: null
          // }
          (result) => {
            const item = store.upsert(result);
            const childItem = item[propertyName];
            const childItemId = childItem ? childItem[childIdKey] : undefined;
            return childItemId;
          };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${restMethod}`;

    const actionAffectingOneItem = createAction(callback, {
      meta: {
        restMethod,
        restIsMany: false,
        resourceInstance,
        store,
      },
      name: `${name}.${restMethod}`,
      resultToValue: (result, action) => {
        const actionLabel = action.name;

        if (restMethod === "DELETE") {
          if (!isProps(result) && !primitiveCanBeId(result)) {
            throw new TypeError(
              `${actionLabel} must return an object (that will be used to drop "${name}" resource), received ${result}.
${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyResultToValue(result);
        }
        if (!isProps(result)) {
          throw new TypeError(
            `${actionLabel} must return an object (that will be used to upsert "${name}" resource), received ${result}.
   ${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyResultToValue(result);
      },
      valueToData: (childItemId) => childStore.select(childItemId),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      actionAffectingOneItem,
    );
    return actionAffectingOneItem;
  };

  const GET = (callback, options) =>
    createActionAffectingOneItem("GET", {
      callback,
      ...options,
    });
  const PUT = (callback, options) =>
    createActionAffectingOneItem("PUT", {
      callback,
      ...options,
    });
  const DELETE = (callback, options) =>
    createActionAffectingOneItem("DELETE", {
      callback,
      ...options,
    });

  // il n'y a pas de many puisque on cible une seule resource
  // genre table.owner -> c'est un seul owner qu'on peut
  // GET -> recup les infos de l'objet
  // PUT -> mettre a jour l'owner de la table
  // DELETE -> supprimer l'owner de la table

  return { GET, PUT, DELETE };
};
const createRestHandlerForRelationshipToMany = (
  name,
  {
    idKey,
    store,
    propertyName,
    childIdKey,
    childStore,
    resourceInstance,
    resourceLifecycleManager,
  } = {},
) => {
  // idéalement s'il y a un GET sur le store originel on voudrait ptet le reload
  // parce que le store originel peut retourner cette liste ou etre impacté
  // pour l'instant on ignore

  // one item AND many child items
  const createActionAffectingOneItem = (
    restMethod,
    { callback, ...options },
  ) => {
    const applyResultToValue =
      restMethod === "DELETE"
        ? ([itemId, childItemId]) => {
            const item = store.select(itemId);
            const childItemArray = item[propertyName];
            const childItemArrayWithoutThisOne = [];
            let found = false;
            for (const childItemCandidate of childItemArray) {
              const childItemCandidateId = childItemCandidate[childIdKey];
              if (childItemCandidateId === childItemId) {
                found = true;
              } else {
                childItemArrayWithoutThisOne.push(childItemCandidate);
              }
            }
            if (found) {
              store.upsert({
                [idKey]: itemId,
                [propertyName]: childItemArrayWithoutThisOne,
              });
            }
            return childItemId;
          }
        : (childData) => {
            const childItem = Array.isArray(childData)
              ? childStore.upsert(...childData)
              : childStore.upsert(childData);
            const childItemId = childItem[childIdKey];
            return childItemId;
          };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${restMethod}`;

    const actionAffectingOneItem = createAction(callback, {
      meta: {
        restMethod,
        restIsMany: false,
        resourceInstance,
        store: childStore,
      },
      name: `${name}.${restMethod}`,
      resultToValue: (result, action) => {
        const actionLabel = action.name;

        if (restMethod === "DELETE") {
          // For DELETE in many relationship, we expect [itemId, childItemId] array
          if (!Array.isArray(result) || result.length !== 2) {
            throw new TypeError(
              `${actionLabel} must return an array [itemId, childItemId] (that will be used to remove relationship), received ${result}.
${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyResultToValue(result);
        }
        if (!isProps(result)) {
          throw new TypeError(
            `${actionLabel} must return an object (that will be used to upsert child item), received ${result}.
${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyResultToValue(result);
      },
      valueToData: (childItemId) => childStore.select(childItemId),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      actionAffectingOneItem,
    );
    return actionAffectingOneItem;
  };
  const GET = (callback, options) =>
    createActionAffectingOneItem("GET", {
      callback,
      ...options,
    });
  // le souci que je vois ici c'est que je n'ai pas la moindre idée d'ou
  // inserer le childItem (ni meme s'il doit etre visible)
  // je pense que la bonne chose a faire est de reload
  // l'objet user.tables s'il en existe un
  // TODO: find any GET action on "user" and reload it
  const POST = (callback, options) =>
    createActionAffectingOneItem("POST", {
      callback,
      ...options,
    });
  const PUT = (callback, options) =>
    createActionAffectingOneItem("PUT", {
      callback,
      ...options,
    });
  const PATCH = (callback, options) =>
    createActionAffectingOneItem("PATCH", {
      callback,
      ...options,
    });
  const DELETE = (callback, options) =>
    createActionAffectingOneItem("DELETE", {
      callback,
      ...options,
    });

  const createActionAffectingManyItems = (
    restMethod,
    { callback, ...options },
  ) => {
    const applyResultToValue =
      restMethod === "GET"
        ? (result) => {
            // callback must return object with the following format:
            // {
            //   [idKey]: 123,
            //   [propertyName]: [
            //      { [childIdKey]: 456, ...childProps },
            //      { [childIdKey]: 789, ...childProps },
            //      ...
            //   ]
            // }
            // the array can be empty
            const item = store.upsert(result);
            const childItemArray = item[propertyName];
            const childItemIdArray = childItemArray.map(
              (childItem) => childItem[childIdKey],
            );
            return childItemIdArray;
          }
        : restMethod === "DELETE"
          ? ([itemIdOrMutableId, childItemIdOrMutableIdArray]) => {
              const item = store.select(itemIdOrMutableId);
              const childItemArray = item[propertyName];
              const deletedChildItemIdArray = [];
              const childItemArrayWithoutThoose = [];
              let someFound = false;
              const deletedChildItemArray = childStore.select(
                childItemIdOrMutableIdArray,
              );
              for (const childItemCandidate of childItemArray) {
                if (deletedChildItemArray.includes(childItemCandidate)) {
                  someFound = true;
                  deletedChildItemIdArray.push(childItemCandidate[childIdKey]);
                } else {
                  childItemArrayWithoutThoose.push(childItemCandidate);
                }
              }
              if (someFound) {
                store.upsert({
                  [idKey]: item[idKey],
                  [propertyName]: childItemArrayWithoutThoose,
                });
              }
              return deletedChildItemIdArray;
            }
          : (childDataArray) => {
              // hum ici aussi on voudra reload "user" pour POST
              // les autres les signals se charge de reload si visible
              const childItemArray = childStore.upsert(childDataArray);
              const childItemIdArray = childItemArray.map(
                (childItem) => childItem[childIdKey],
              );
              return childItemIdArray;
            };

    const callerInfo = getCallerInfo(null, 2);
    // Provide more fallback options for better debugging
    const locationInfo =
      callerInfo.file && callerInfo.line && callerInfo.column
        ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
        : callerInfo.raw || "unknown location";
    const originalActionName = `${name}.${restMethod}[many]`;

    const actionAffectingManyItem = createAction(callback, {
      meta: {
        restMethod,
        restIsMany: true,
        resourceInstance,
        store: childStore,
      },
      name: `${name}.${restMethod}[many]`,
      dataDefault: [],
      resultToValue: (result, action) => {
        const actionLabel = action.name;

        if (restMethod === "GET") {
          if (!isProps(result)) {
            throw new TypeError(
              `${actionLabel} must return an object (that will be used to upsert "${name}" resource with many relationships), received ${result}.
${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyResultToValue(result);
        }
        if (restMethod === "DELETE") {
          // For DELETE_MANY in many relationship, we expect [itemId, childItemIdArray] array
          if (
            !Array.isArray(result) ||
            result.length !== 2 ||
            !Array.isArray(result[1])
          ) {
            throw new TypeError(
              `${actionLabel} must return an array [itemId, childItemIdArray] (that will be used to remove relationships), received ${result}.
${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyResultToValue(result);
        }
        // For POST, PUT, PATCH - expect array of objects
        if (!Array.isArray(result)) {
          throw new TypeError(
            `${actionLabel} must return an array of objects (that will be used to upsert child items), received ${result}.
${originalActionName} source location: ${locationInfo}`,
          );
        }
        return applyResultToValue(result);
      },
      valueToData: (childItemIdArray) => childStore.selectAll(childItemIdArray),
      completeSideEffect: (actionCompleted) =>
        resourceLifecycleManager.onActionComplete(actionCompleted),
      ...options,
    });
    resourceLifecycleManager.registerAction(
      resourceInstance,
      actionAffectingManyItem,
    );
    return actionAffectingManyItem;
  };

  const GET_MANY = (callback, options) =>
    createActionAffectingManyItems("GET", { callback, ...options });
  const POST_MANY = (callback, options) =>
    createActionAffectingManyItems("POST", { callback, ...options });
  const PUT_MANY = (callback, options) =>
    createActionAffectingManyItems("PUT", { callback, ...options });
  const PATCH_MANY = (callback, options) =>
    createActionAffectingManyItems("PATCH", { callback, ...options });
  const DELETE_MANY = (callback, options) =>
    createActionAffectingManyItems("DELETE", { callback, ...options });

  return {
    GET,
    POST,
    PUT,
    PATCH,
    DELETE,
    GET_MANY,
    POST_MANY,
    PUT_MANY,
    PATCH_MANY,
    DELETE_MANY,
  };
};

const isProps = (value) => {
  return value !== null && typeof value === "object";
};

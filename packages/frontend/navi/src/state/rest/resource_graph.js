import { computed, signal } from "@preact/signals";

import { createAction } from "../../action/actions.js";
import { SYMBOL_OBJECT_SIGNAL } from "../../action/symbol_object_signal.js";
import { SYMBOL_IDENTITY } from "../../utils/compare_two_js_values.js";
import { getCallerInfo } from "../../utils/get_caller_info.js";
import { arraySignalStore, primitiveCanBeId } from "./array_signal_store.js";
import { createResourceLifecycleManager } from "./item_lifecycle_manager.js";
import { getParamScope } from "./param_scope.js";

const resourceLifecycleManager = createResourceLifecycleManager();

/**
 * Naming conventions used throughout this file:
 * - verb:            one of GET / POST / PUT / PATCH / DELETE
 * - restCallbackKey: one of GET / GET_MANY / POST / POST_MANY / PUT / PUT_MANY / PATCH / PATCH_MANY / DELETE / DELETE_MANY
 * - restCallback:    the user-provided callback function associated with a restCallbackKey
 * - restCallbacks:   object mapping { [restCallbackKey]: restCallback }
 * - isMany:          true when the action operates on a collection (restCallbackKey ends with _MANY)
 *
 * # resource(name, restCallbacks)
 *
 * Creates a reactive REST resource backed by a shared signal store.
 * Returns a `stateFacade` with REST actions and relationship methods.
 *
 * Each REST callback receives the params passed to the action call and must return
 * the data that will be upserted into the store:
 *   - GET / POST / PUT / PATCH → return the full item object  e.g. { id, name }
 *   - DELETE                   → return the id or { id } of the removed item
 *   - GET_MANY / POST_MANY … → return an array of item objects
 *
 * uniqueKeys allows the store to find an item by an alternate key (e.g. "username"),
 * and the callback can return a different `id` to rename the item's primary key.
 *
 * # .withParams(params)
 *
 * Returns a new resource instance where every action automatically merges `params`
 * into its call params. All `withParams` instances share the same underlying store,
 * so items loaded by one instance are visible to all others.
 *
 *   const ADMIN_USER = USER.withParams({ role: "admin" });
 *   await ADMIN_USER.GET_MANY.run();   // callback receives { role: "admin" }
 *   await ADMIN_USER.POST({ name: "Charlie" }); // callback receives { role: "admin", name: "Charlie" }
 *
 * # .one(propertyName, childResource, { GET, PUT, DELETE })
 *
 * Links a property on each item to a single item in an independent child store.
 * The property is reactive: updating the child item anywhere propagates immediately.
 * The child resource exists independently — it is not owned by or deleted with the parent.
 *
 * Callback format: return the parent object with the relationship nested inside:
 *   GET: async ({ id }) => ({ id, session: { id: 10, token: "abc" } })
 *
 * The backend may also embed the child inline in a parent GET/POST response —
 * the setter on the property will upsert the nested object into the child store.
 *
 * Chainable: USER_SESSION.one("device", DEVICE) adds a reactive .device property
 * to each session object.
 *
 * # .many(propertyName, childResource, restCallbacks)
 *
 * Links a property on each item to an array of items in an independent child store.
 * Items in the array are full entries in the shared child store — if the same item
 * is referenced by multiple parents, a single update propagates to all of them.
 *
 * GET_MANY callback format: return the parent object with the array nested inside:
 *   GET_MANY: async ({ id }) => ({ id, friends: [{ id: 2 }, { id: 3 }] })
 *
 * DELETE callback: return [parentId, childId] to remove the relationship.
 * DELETE_MANY callback: return [parentId, [childId, childId, ...]] to remove multiple.
 *
 * # .scopedOne(propertyName, { idKey, GET, POST, PUT, PATCH, DELETE })
 *
 * Attaches a single private sub-object to each item. Unlike .one(), the child has
 * no identity outside its owner and is not shared across items. Each owner gets its
 * own private signal.
 *
 * All callbacks must return [ownerId, props | null]:
 *   GET:   async ({ id }) => [id, { bio: "Hello", avatar: "alice.png" }]
 *   PATCH: async ({ id, bio }) => [id, { bio, avatar: "alice.png" }]
 *   DELETE: async ({ id }) => [id, null]
 *
 * The property is `null` until a callback provides data. Setting it to `null` clears it.
 * Chainable: USER_PROFILE.one("theme", THEME) adds a reactive .theme property on each profile.
 *
 * # .scopedMany(propertyName, { idKey, GET, GET_MANY, POST, PUT, PATCH, DELETE, ... })
 *
 * Attaches a private ordered collection of sub-objects to each item. The child objects
 * have no identity outside their owner — two owners can have items with the same id
 * that are completely independent. Each owner gets its own private arraySignalStore.
 *
 * All callbacks must return [ownerId, ...rest]:
 *   GET_MANY: async ({ id }) => [id, [{ name: "id", type: "int" }, ...]]
 *   POST:     async ({ id, name, type }) => [id, { name, type }]
 *   PUT:      async ({ id, oldName, name, type }) => [id, oldName, { name, type }]  ← id rename
 *   DELETE:   async ({ id, name }) => [id, name]
 *
 * Chainable: TABLE_COLUMNS.one("dataType", DATA_TYPE) adds a reactive .dataType
 * property on each column item.
 */

let DEBUG = false;
const debug = (args) => {
  if (!DEBUG) {
    return;
  }
  console.debug(...args);
};

export const resource = (
  name,
  {
    // configuration options
    idKey,
    uniqueKeys = [],
    rerunOn,
    dependencies,

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
  } = {},
) => {
  if (idKey === undefined) {
    idKey = uniqueKeys.length === 0 ? "id" : uniqueKeys[0];
  }
  const setupCallbackSet = new Set();
  const addItemSetup = (callback) => {
    setupCallbackSet.add(callback);
  };
  const itemPrototype = {
    [Symbol.toStringTag]: name,
    toString() {
      let string = `${name}`;
      if (uniqueKeys.length) {
        for (const uniqueKey of uniqueKeys) {
          const uniqueId = this[uniqueKey];
          if (uniqueId !== undefined) {
            string += `[${uniqueKey}=${uniqueId}]`;
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
    uniqueKeys,
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
  const createRestActionForRoot = createRestActionFactoryForRoot(name, {
    idKey,
    store,
  });
  return createResource(name, {
    idKey,
    uniqueKeys,
    restCallbacks: {
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
    },
    store,
    addItemSetup,
    createRestAction: createRestActionForRoot,
    paramScope: getParamScope(undefined),
    rerunOn,
    dependencies,
  });
};

const createResource = (
  name,
  {
    idKey,
    uniqueKeys = [],
    restCallbacks,
    store,
    addItemSetup,
    createRestAction,
    paramScope,
    rerunOn,
    dependencies,
  } = {},
) => {
  if (idKey === undefined) {
    idKey = uniqueKeys.length === 0 ? "id" : uniqueKeys[0];
  }
  const params = paramScope.params;
  const stateFacade = {
    // public
    name,
    idKey,
    uniqueKeys,

    useArray: () => store.arraySignal.value,
    useById: (id) => store.select(idKey, id),

    withParams: undefined,
    one: undefined,
    many: undefined,
    scopedOne: undefined,
    scopedMany: undefined,

    // private but exposed for convenience
    store,
    addItemSetup,
  };
  const lifecycleCtx = { onComplete: null };

  resourceLifecycleManager.registerResource(stateFacade, {
    rerunOn,
    paramScope,
    dependencies,
    uniqueKeys,
  });
  lifecycleCtx.onComplete = (actionCompleted) => {
    resourceLifecycleManager.onActionComplete(actionCompleted, {
      resourceScope: stateFacade,
    });
  };

  /**
   * Creates a parameterized version of the resource with isolated resource lifecycle behavior.
   *
   * Actions from parameterized resources only trigger rerun/reset for other actions with
   * identical parameters, preventing cross-contamination between different parameter sets.
   *
   * @param {Object} params - Parameters to bind to all actions of this resource (required)
   * @param {Object} options - Additional options for the parameterized resource
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
  const withParams = (
    paramsToInject,
    { dependencies: withParamsDeps, rerunOn: withParamsRerunOn } = {},
  ) => {
    if (!paramsToInject || Object.keys(paramsToInject).length === 0) {
      throw new Error(`resource(${name}).withParams() requires parameters`);
    }
    const resolvedParams = params
      ? { ...params, ...paramsToInject }
      : paramsToInject;
    const resolvedParamScope = getParamScope(resolvedParams);
    const createRestActionWithParams = createRestActionFactoryForRoot(name, {
      idKey,
      store,
    });
    return createResource(name, {
      idKey,
      uniqueKeys,
      restCallbacks,
      store,
      addItemSetup,
      createRestAction: createRestActionWithParams,
      paramScope: resolvedParamScope,
      rerunOn: withParamsRerunOn ?? rerunOn,
      dependencies: withParamsDeps ?? dependencies,
    });
  };
  stateFacade.withParams = withParams;

  stateFacade.one = (
    propertyName,
    childResource,
    {
      rerunOn: oneRerunOn,
      dependencies: oneDependencies,

      GET,
      PUT,
      DELETE,
    } = {},
  ) => {
    const childName = `${name}.${propertyName}`;
    addItemSetup((item) => {
      const childIdKeyForSetup = childResource.idKey;
      const childItemIdSignal = signal();
      const updateChildItemId = (value) => {
        const currentChildItemId = childItemIdSignal.peek();
        if (isProps(value)) {
          const childItem = childResource.store.upsert(value);
          const childItemId = childItem[childIdKeyForSetup];
          if (currentChildItemId === childItemId) {
            return false;
          }
          childItemIdSignal.value = childItemId;
          return true;
        }
        if (primitiveCanBeId(value)) {
          const childItemProps = { [childIdKeyForSetup]: value };
          const childItem = childResource.store.upsert(childItemProps);
          const childItemId = childItem[childIdKeyForSetup];
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
      const childItemSignal = computed(() =>
        childResource.store.select(childItemIdSignal.value),
      );
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
        return {
          [SYMBOL_OBJECT_SIGNAL]: childItemSignal,
          valueOf: () => null,
        };
      });
      Object.defineProperty(item, propertyName, {
        get: () => childItemFacadeSignal.value,
        set: updateChildItemId,
      });
      debug(
        `setup ${item}.${propertyName} is one "${childResource.name}" (current value: ${childItemSignal.peek()})`,
      );
    });

    const childIdKey = childResource.idKey;
    const childStore = childResource.store;
    const createRestActionForOne = (verb, callback, { lifecycleCtx }) => {
      const applyResultToValue =
        verb === "DELETE"
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
      const locationInfo =
        callerInfo.file && callerInfo.line && callerInfo.column
          ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
          : callerInfo.raw || "unknown location";
      const originalActionName = `${name}.${verb}`;

      const actionAffectingOneItem = createAction(callback, {
        meta: {
          verb,
          isMany: false,
          paramScope,
        },
        name: `${name}.${verb}`,
        resultToValue: (result, action) => {
          const actionLabel = action.name;

          if (verb === "DELETE") {
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
        completeSideEffect: (actionCompleted) => {
          lifecycleCtx.onComplete(actionCompleted);
        },
      });
      return actionAffectingOneItem;
    };

    return createResource(childName, {
      idKey: childResource.idKey,
      restCallbacks: {
        GET,
        PUT,
        DELETE,
      },
      store,
      addItemSetup,
      createRestAction: createRestActionForOne,
      paramScope,
      rerunOn: oneRerunOn ?? rerunOn,
      dependencies: oneDependencies ?? dependencies,
    });
  };

  stateFacade.many = (
    propertyName,
    childResource,
    {
      rerunOn: manyRerunOn,
      dependencies: manyDependencies,

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
    } = {},
  ) => {
    const childStore = childResource.store;
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    addItemSetup((item) => {
      const childItemIdArraySignal = signal([]);
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
            const childItem = childResource.store.upsert(value);
            const childItemId = childItem[childIdKey];
            if (currentIdAtIndex !== childItemId) modified = true;
            idArray.push(childItemId);
            continue;
          }
          if (primitiveCanBeId(value)) {
            const childItemProps = { [childIdKey]: value };
            const childItem = childResource.store.upsert(childItemProps);
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
      const childItemArraySignal = computed(() => {
        const idArray = childItemIdArraySignal.value;
        const arr = childResource.store.selectAll(idArray);
        Object.defineProperty(arr, SYMBOL_OBJECT_SIGNAL, {
          value: childItemArraySignal,
          writable: false,
          enumerable: false,
          configurable: false,
        });
        return arr;
      });
      Object.defineProperty(item, propertyName, {
        get: () => childItemArraySignal.value,
        set: updateChildItemIdArray,
      });
      syncIdArrayOnRename(
        childResource.store,
        childIdKey,
        childItemIdArraySignal,
      );
      if (DEBUG) {
        const childItemArray = childItemArraySignal.peek();
        debug(
          `setup ${item}.${propertyName} is many "${childResource.name}" (current value: ${childItemArray.length ? childItemArray.join(",") : "[]"})`,
        );
      }
    });
    const createRestActionForMany = (
      verb,
      callback,
      { isMany, lifecycleCtx },
    ) => {
      if (!isMany) {
        return createRestActionAffectingOneItem(verb, callback, lifecycleCtx);
      }
      return createRestActionAffectingManyItems(verb, callback, lifecycleCtx);
    };
    const createRestActionAffectingOneItem = (verb, callback, lifecycleCtx) => {
      const applyResultToValue =
        verb === "DELETE"
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
      const locationInfo =
        callerInfo.file && callerInfo.line && callerInfo.column
          ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
          : callerInfo.raw || "unknown location";
      const originalActionName = `${name}.${verb}`;

      const actionAffectingOneItem = createAction(callback, {
        meta: { verb, isMany: false, paramScope },
        name: `${name}.${verb}`,
        resultToValue: (result, action) => {
          const actionLabel = action.name;

          if (verb === "DELETE") {
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
        completeSideEffect: (actionCompleted) => {
          lifecycleCtx.onComplete(actionCompleted);
        },
      });
      return actionAffectingOneItem;
    };
    const createRestActionAffectingManyItems = (
      verb,
      callback,
      lifecycleCtx,
    ) => {
      const applyResultToValue =
        verb === "GET"
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
          : verb === "DELETE"
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
                    deletedChildItemIdArray.push(
                      childItemCandidate[childIdKey],
                    );
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
                const childItemArray = childStore.upsert(childDataArray);
                const childItemIdArray = childItemArray.map(
                  (childItem) => childItem[childIdKey],
                );
                return childItemIdArray;
              };

      const callerInfo = getCallerInfo(null, 2);
      const locationInfo =
        callerInfo.file && callerInfo.line && callerInfo.column
          ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
          : callerInfo.raw || "unknown location";
      const originalActionName = `${name}.${verb}[many]`;

      const actionAffectingManyItem = createAction(callback, {
        meta: { verb, isMany: true, paramScope },
        name: `${name}.${verb}[many]`,
        dataDefault: [],
        resultToValue: (result, action) => {
          const actionLabel = action.name;

          if (verb === "GET") {
            if (!isProps(result)) {
              throw new TypeError(
                `${actionLabel} must return an object (that will be used to upsert "${name}" resource with many relationships), received ${result}.
${originalActionName} source location: ${locationInfo}`,
              );
            }
            return applyResultToValue(result);
          }
          if (verb === "DELETE") {
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
          if (!Array.isArray(result)) {
            throw new TypeError(
              `${actionLabel} must return an array of objects (that will be used to upsert child items), received ${result}.
${originalActionName} source location: ${locationInfo}`,
            );
          }
          return applyResultToValue(result);
        },
        valueToData: (childItemIdArray) =>
          childStore.selectAll(childItemIdArray),
        completeSideEffect: (actionCompleted) => {
          lifecycleCtx.onComplete(actionCompleted);
        },
      });
      return actionAffectingManyItem;
    };

    return createResource(childName, {
      idKey: childIdKey,
      restCallbacks: {
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
      },
      store,
      addItemSetup,
      createRestAction: createRestActionForMany,
      paramScope,
      rerunOn: manyRerunOn ?? rerunOn,
      dependencies: manyDependencies ?? dependencies,
    });
  };

  stateFacade.scopedOne = (
    propertyName,
    {
      idKey: childIdKey = "id",
      rerunOn: scopedOneRerunOn,
      dependencies: scopedOneDependencies,

      GET,
      POST,
      PUT,
      PATCH,
      DELETE,
    } = {},
  ) => {
    const childName = `${name}.${propertyName}`;

    // setupCallbackSet: callbacks added by chained .one()/.many()
    // Applied to each per-scope child item object when it is first created.
    const childItemSetupCallbackSet = new Set();
    const childAddItemSetup = (callback) =>
      childItemSetupCallbackSet.add(callback);
    const scopedItemMap = new Map(); // ownerId → stable child item object
    const scopedSignalMap = new Map(); // ownerId → signal<childItem | null>
    addItemSetup((ownerItem) => {
      const ownerId = ownerItem[idKey];
      // Create a stable child item — mutated in place via applyProps.
      // Reactive getters/setters from chained .one() etc. are defined on this object now
      // so they survive across multiple prop updates.
      const childItem = {};
      for (const childSetup of childItemSetupCallbackSet) {
        childSetup(childItem);
      }
      scopedItemMap.set(ownerId, childItem);
      const childSignal = signal(null);
      scopedSignalMap.set(ownerId, childSignal);

      const applyProps = (props) => {
        if (!props) {
          childSignal.value = null;
          return;
        }
        // Assign each prop in place. Reactive setters (from chained .one() etc.) will fire.
        for (const [key, value] of Object.entries(props)) {
          childItem[key] = value;
        }
        if (childSignal.peek() !== childItem) {
          childSignal.value = childItem; // first activation: null → childItem
        }
      };

      applyProps(ownerItem[propertyName]);

      Object.defineProperty(ownerItem, propertyName, {
        get: () => childSignal.value,
        set: applyProps,
      });
    });
    const createRestActionForScopedOne = (verb, callback, { lifecycleCtx }) => {
      const childActionName = `${childName}.${verb}`;
      const restAction = createAction(callback, {
        name: childActionName,
        meta: { verb, isMany: false, paramScope },
        resultToValue: (result) => {
          if (!Array.isArray(result) || result.length !== 2) {
            throw new TypeError(
              `${childActionName} callback must return [ownerId, props], received ${result}`,
            );
          }
          const [rawOwnerId, props] = result;
          const ownerId = resolveOwnerId(
            rawOwnerId,
            store,
            idKey,
            uniqueKeys,
            childActionName,
          );
          const childItem = scopedItemMap.get(ownerId);
          if (!childItem) {
            throw new Error(
              `${childActionName}: no item found for scope id "${ownerId}"`,
            );
          }
          const childSignal = scopedSignalMap.get(ownerId);
          if (props) {
            for (const [key, value] of Object.entries(props)) {
              childItem[key] = value;
            }
            if (childSignal.peek() !== childItem) {
              childSignal.value = childItem;
            }
          } else {
            childSignal.value = null;
          }
          return [ownerId, props];
        },
        completeSideEffect: (actionCompleted) => {
          lifecycleCtx.onComplete(actionCompleted);
        },
      });
      return restAction;
    };

    const childResource = createResource(childName, {
      idKey: childIdKey,
      restCallbacks: {
        GET,
        POST,
        PUT,
        PATCH,
        DELETE,
      },
      store,
      addItemSetup: childAddItemSetup,
      createRestAction: createRestActionForScopedOne,
      paramScope,
      rerunOn: scopedOneRerunOn ?? rerunOn,
      dependencies: scopedOneDependencies ?? dependencies,
    });
    return childResource;
  };

  stateFacade.scopedMany = (
    propertyName,
    {
      idKey: childIdKey = "id",
      rerunOn: scopedManyRerunOn,
      dependencies: scopedManyDependencies,

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
    } = {},
  ) => {
    const childName = `${name}.${propertyName}`;

    // setupCallbackSet: callbacks added by chained .one()/.many()
    // Applied to each child item when it is created in a per-scope store.
    const childSetupCallbackSet = new Set();
    const childAddItemSetup = (callback) => childSetupCallbackSet.add(callback);
    const scopedStoreMap = new Map(); // ownerId → childStore
    const scopedIdArraySignalMap = new Map(); // ownerId → childItemIdArraySignal
    addItemSetup((item) => {
      const ownerId = item[idKey];

      // Reuse an existing scoped store if one was already created via a uniqueKey
      // (e.g. rows were fetched by tablename before the full table was loaded).
      let childStore = scopedStoreMap.get(ownerId);
      let childItemIdArraySignal = scopedIdArraySignalMap.get(ownerId);
      if (!childStore) {
        for (const uniqueKey of uniqueKeys) {
          const uniqueKeyValue = item[uniqueKey];
          if (uniqueKeyValue !== undefined) {
            const existing = scopedStoreMap.get(uniqueKeyValue);
            if (existing) {
              childStore = existing;
              childItemIdArraySignal =
                scopedIdArraySignalMap.get(uniqueKeyValue);
              break;
            }
          }
        }
      }
      if (!childStore) {
        childStore = arraySignalStore([], childIdKey, {
          name: `${childName}#${ownerId} store`,
          createItem: (props) => {
            const childItem = {};
            Object.assign(childItem, props);
            for (const childSetup of childSetupCallbackSet) {
              childSetup(childItem);
            }
            return childItem;
          },
        });
        childItemIdArraySignal = signal([]);
      }
      scopedStoreMap.set(ownerId, childStore);
      // Also register by each uniqueKey value so that resolveOwnerId works
      // when a callback returns { [uniqueKey]: value } before the full item is loaded.
      for (const uniqueKey of uniqueKeys) {
        const uniqueKeyValue = item[uniqueKey];
        if (uniqueKeyValue !== undefined) {
          scopedStoreMap.set(uniqueKeyValue, childStore);
        }
      }

      scopedIdArraySignalMap.set(ownerId, childItemIdArraySignal);
      for (const uniqueKey of uniqueKeys) {
        const uniqueKeyValue = item[uniqueKey];
        if (uniqueKeyValue !== undefined) {
          scopedIdArraySignalMap.set(uniqueKeyValue, childItemIdArraySignal);
        }
      }

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
      syncIdArrayOnRename(childStore, childIdKey, childItemIdArraySignal);

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
        set: updateChildItemIdArray,
      });
    });
    const createRestActionForScopedMany = (
      verb,
      callback,
      { isMany, lifecycleCtx },
    ) => {
      if (!callback) {
        return undefined;
      }
      const childActionName = `${childName}.${verb}`;
      const childAction = createAction(callback, {
        name: childActionName,
        meta: { verb, isMany, paramScope },
        resultToValue: (result) => {
          if (!Array.isArray(result) || result.length < 2) {
            throw new TypeError(
              `${childActionName} callback must return [ownerId, ...] array, received ${result}`,
            );
          }
          const [rawOwnerId, ...rest] = result;
          const ownerId = resolveOwnerId(
            rawOwnerId,
            store,
            idKey,
            uniqueKeys,
            childActionName,
          );
          let childStore = scopedStoreMap.get(ownerId);
          if (!childStore) {
            // Owner not yet in store — lazily create scoped store so actions can run
            // before the parent item has been fully loaded (e.g. rows fetched before table).
            childStore = arraySignalStore([], childIdKey, {
              name: `${childName}#${ownerId} store`,
              createItem: (props) => {
                const childItem = {};
                Object.assign(childItem, props);
                for (const childSetup of childSetupCallbackSet) {
                  childSetup(childItem);
                }
                return childItem;
              },
            });
            scopedStoreMap.set(ownerId, childStore);
            const newIdArraySignal = signal([]);
            scopedIdArraySignalMap.set(ownerId, newIdArraySignal);
          }
          const childItemIdArraySignal = scopedIdArraySignalMap.get(ownerId);

          if (verb === "DELETE") {
            if (isMany) {
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

          if (isMany) {
            // GET_MANY, POST_MANY, PUT_MANY etc: rest[0] is the array of items
            const itemArray = childStore.upsert(rest[0]);
            const idArray = itemArray.map((i) => i[childIdKey]);
            childItemIdArraySignal.value = idArray;
            return [ownerId, idArray];
          }

          // GET, POST, PUT, PATCH: rest may be [props] or [oldId, props] for renames
          const childItem =
            rest.length > 1
              ? childStore.upsert(...rest)
              : childStore.upsert(rest[0]);
          return [ownerId, childItem[childIdKey]];
        },
        valueToData: (value) => {
          if (!value) return isMany ? [] : undefined;
          const [ownerId, idOrIdArray] = value;
          const childStore = scopedStoreMap.get(ownerId);
          if (!childStore) return isMany ? [] : undefined;
          if (isMany) return childStore.selectAll(idOrIdArray);
          return childStore.select(idOrIdArray);
        },
        completeSideEffect: (actionCompleted) => {
          lifecycleCtx.onComplete(actionCompleted);
        },
      });
      return childAction;
    };

    // When a child (scopedMany) item is mutated via POST, the parent GET must
    // re-fetch because the parent embeds the child array and we cannot know the
    // new ordering without asking the backend again.
    // (scopedOne does NOT need this: the mutation result contains the updated
    // item directly, so no parent re-fetch is necessary.)
    const childResource = createResource(childName, {
      idKey: childIdKey,
      restCallbacks: {
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
      },
      store,
      addItemSetup: childAddItemSetup,
      createRestAction: createRestActionForScopedMany,
      paramScope,
      rerunOn: scopedManyRerunOn ?? rerunOn,
      dependencies: scopedManyDependencies ?? dependencies,
    });
    // Register: when childResource fires, rerun parent (stateFacade) GETs.
    resourceLifecycleManager.addDependency(childResource, stateFacade);
    return childResource;
  };

  // expose rest actions on the stateFacade
  for (const [restCallbackKey, restCallback] of Object.entries(restCallbacks)) {
    if (restCallback === undefined) {
      continue;
    }
    const isMany = restCallbackKey.endsWith("_MANY");
    const verb = isMany
      ? restCallbackKey.replace("_MANY", "")
      : restCallbackKey;
    const restAction = createRestAction(verb, restCallback, {
      isMany,
      lifecycleCtx,
      paramScope,
    });
    if (!restAction) {
      console.error("no action returned (here to see when it happens)");
      continue;
    }
    let actionToRegister;
    if (params) {
      const restActionBound = restAction.bindParams(params);
      stateFacade[restCallbackKey] = restActionBound;
      actionToRegister = restActionBound;
    } else {
      stateFacade[restCallbackKey] = restAction;
      actionToRegister = restAction;
    }
    resourceLifecycleManager.registerAction(stateFacade, actionToRegister);
  }

  return stateFacade;
};

const createRestActionFactoryForRoot = (
  name,
  {
    idKey,
    store, // see array_signal_store.js
  },
) => {
  const createActionForRoot = (
    verb,
    restCallback,
    { isMany, lifecycleCtx, paramScope },
  ) => {
    if (!isMany) {
      return createActionAffectingOneItem(verb, restCallback, {
        lifecycleCtx,
        paramScope,
      });
    }
    return createActionAffectingManyItems(verb, restCallback, {
      lifecycleCtx,
      paramScope,
    });
  };
  const createActionAffectingOneItem = (
    verb,
    callback,
    { lifecycleCtx, paramScope },
  ) => {
    const applyResultToValue =
      verb === "DELETE"
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
    const originalActionName = `${name}.${verb}`;
    const actionAffectingOneItem = createAction(callback, {
      name: `${name}.${verb}`,
      meta: { verb, isMany: false, paramScope },
      resultToValue: (result, action) => {
        const actionLabel = action.name;

        if (verb === "DELETE") {
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
      completeSideEffect: (actionCompleted) => {
        lifecycleCtx.onComplete(actionCompleted);
      },
    });
    return actionAffectingOneItem;
  };
  const createActionAffectingManyItems = (
    verb,
    callback,
    { lifecycleCtx, paramScope },
  ) => {
    const applyResultToValue =
      verb === "DELETE"
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
      meta: { verb, isMany: true, paramScope },
      name: `${name}.${verb}_MANY`,
      dataDefault: [],
      resultToValue: applyResultToValue,
      valueToData: (idArray) => {
        const items = store.selectAll(idArray);
        return items;
      },
      completeSideEffect: (actionCompleted) => {
        lifecycleCtx.onComplete(actionCompleted);
        if (
          verb === "DELETE" ||
          actionCompleted.valueSignal.peek().length === 0
        ) {
          return null;
        }
        // When an id is renamed (PUT/PATCH changes the idKey), the store fires observeProperties
        // with a mutation containing oldValue/newValue for that key. We patch this action's
        // valueSignal (the id array) so that selectAll keeps returning the right items.
        // The returned unsubscribe function is called by completeSideEffectCleanup on reset.
        return syncIdArrayOnRename(store, idKey, actionCompleted.valueSignal);
      },
    });
    return actionAffectingManyItems;
  };

  return createActionForRoot;
};

const syncIdArrayOnRename = (store, idKey, idArraySignal) => {
  return store.observeProperties((mutations) => {
    const idArray = idArraySignal.peek();
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
      idUpdatedArray.push(idMutationMap.get(id) ?? id);
    }
    idArraySignal.value = idUpdatedArray;
  });
};

const isProps = (value) => {
  return value !== null && typeof value === "object";
};

const resolveOwnerId = (rawOwnerId, store, idKey, uniqueKeys, actionName) => {
  if (!isProps(rawOwnerId)) {
    // Already a primitive — use as-is.
    return rawOwnerId;
  }

  const keys = Object.keys(rawOwnerId);

  if (keys.length === 1) {
    const [propName] = keys;
    const propValue = rawOwnerId[propName];

    if (propName === idKey) {
      return propValue;
    }
    if (uniqueKeys.includes(propName)) {
      const item = store.select(propName, propValue);
      if (!item) {
        // Owner not yet in store — the scoped maps may still be keyed by uniqueKey value
        // (registered during addItemSetup). Return the propValue as the owner key directly.
        return propValue;
      }
      return item[idKey];
    }
    throw new TypeError(
      `${actionName}: the first element of the returned array is { ${propName}: "${propValue}" } but "${propName}" is neither the idKey ("${idKey}") nor a declared uniqueKey (${uniqueKeys.length ? uniqueKeys.join(", ") : "none"}). 
Return a primitive id or a single-property object whose key is the idKey or a uniqueKey.`,
    );
  }

  // More than one property — try to recover via idKey, warn if successful.
  if (idKey in rawOwnerId) {
    const resolvedId = rawOwnerId[idKey];
    console.warn(
      `${actionName}: the first element of the returned array is an object with multiple properties. 
Only "${idKey}" is needed. Consider returning a primitive id or { ${idKey}: value } instead.`,
    );
    return resolvedId;
  }

  throw new TypeError(
    `${actionName}: the first element of the returned array must be a primitive id or a single-property object equal to { [idKey]: value } or { [uniqueKey]: value }.
Received an object with keys: ${keys.join(", ")}.`,
  );
};

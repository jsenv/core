import { computed, signal } from "@preact/signals";

import { createAction } from "../../action/actions.js";
import { SYMBOL_OBJECT_SIGNAL } from "../../action/symbol_object_signal.js";
import { SYMBOL_IDENTITY } from "../../utils/compare_two_js_values.js";
import { getCallerInfo } from "../../utils/get_caller_info.js";
import { arraySignalStore, primitiveCanBeId } from "./array_signal_store.js";

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
 * mutableIdKeys allows the store to find an item by an alternate key (e.g. "username"),
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
    mutableIdKeys = [],

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
    idKey = mutableIdKeys.length === 0 ? "id" : mutableIdKeys[0];
  }
  const setupCallbackSet = new Set();
  const addItemSetup = (callback) => {
    setupCallbackSet.add(callback);
  };
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
  const createRestActionForRoot = createRestActionFactoryForRoot(name, {
    idKey,
    store,
  });
  return createResource(name, {
    idKey,
    mutableIdKeys,
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
    params: undefined,
  });
};

const createResource = (
  name,
  {
    idKey,
    mutableIdKeys = [],
    restCallbacks,
    store,
    addItemSetup,
    createRestAction,
    params,
  } = {},
) => {
  if (idKey === undefined) {
    idKey = mutableIdKeys.length === 0 ? "id" : mutableIdKeys[0];
  }
  const stateFacade = {
    // public
    name,
    idKey,

    useArray: () => store.arraySignal.value,
    useById: (id) => store.select(idKey, id),

    withParams: undefined,
    external: undefined,
    externalMany: undefined,
    internal: undefined,
    internalMany: undefined,

    // private but exposed for convenience
    store,
    addItemSetup,
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
    const restAction = createRestAction(verb, restCallback, { isMany });
    if (!restAction) {
      console.error("no action returned (here to see when it happens)");
      continue;
    }
    if (params) {
      const restActionBound = restAction.bindParams(params);
      stateFacade[restCallbackKey] = restActionBound;
    } else {
      stateFacade[restCallbackKey] = restAction;
    }
  }

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
  const withParams = (paramsToInject) => {
    if (!paramsToInject || Object.keys(paramsToInject).length === 0) {
      throw new Error(
        `resource(${paramsToInject}).withParams() requires parameters`,
      );
    }
    let resolvedParams;
    if (params) {
      resolvedParams = { ...params, ...paramsToInject };
    } else {
      resolvedParams = paramsToInject;
    }
    const createRestActionWithParams = createRestActionFactoryForRoot(name, {
      idKey,
      store,
    });
    return createResource(name, {
      idKey,
      mutableIdKeys,
      restCallbacks,
      store,
      addItemSetup,
      createRestAction: createRestActionWithParams,
      params: resolvedParams,
    });
  };
  stateFacade.withParams = withParams;

  stateFacade.one = (
    propertyName,
    childResource,
    { GET, PUT, DELETE } = {},
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
        configurable: true,
      });
      debug(
        `setup ${item}.${propertyName} is one "${childResource.name}" (current value: ${childItemSignal.peek()})`,
      );
    });

    const childIdKey = childResource.idKey;
    const childStore = childResource.store;
    const createRestActionForOne = (verb, callback) => {
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
      // Provide more fallback options for better debugging
      const locationInfo =
        callerInfo.file && callerInfo.line && callerInfo.column
          ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
          : callerInfo.raw || "unknown location";
      const originalActionName = `${name}.${verb}`;

      const actionAffectingOneItem = createAction(callback, {
        meta: {
          verb,
          isMany: false,
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
        // completeSideEffect: (actionCompleted) => resourceLifecycleManager.onActionComplete(actionCompleted),
      });
      // resourceLifecycleManager.registerAction(
      //   resourceInstance,
      //   actionAffectingOneItem,
      // );
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
      params,
    });
  };
  stateFacade.many = (
    propertyName,
    childResource,
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
        configurable: true,
      });
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
      if (DEBUG) {
        const childItemArray = childItemArraySignal.peek();
        debug(
          `setup ${item}.${propertyName} is many "${childResource.name}" (current value: ${childItemArray.length ? childItemArray.join(",") : "[]"})`,
        );
      }
    });
    const createRestActionForMany = (verb, callback, { isMany }) => {
      if (!isMany) {
        return createRestActionAffectingOneItem(verb, callback);
      }
      return createRestActionAffectingManyItems(verb, callback);
    };
    const createRestActionAffectingOneItem = (verb, callback) => {
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
      // Provide more fallback options for better debugging
      const locationInfo =
        callerInfo.file && callerInfo.line && callerInfo.column
          ? `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`
          : callerInfo.raw || "unknown location";
      const originalActionName = `${name}.${verb}`;

      const actionAffectingOneItem = createAction(callback, {
        meta: { verb, isMany: false },
        name: `${name}.${verb}`,
        resultToValue: (result, action) => {
          const actionLabel = action.name;

          if (verb === "DELETE") {
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
        // completeSideEffect: (actionCompleted) => resourceLifecycleManager.onActionComplete(actionCompleted),
      });
      // resourceLifecycleManager.registerAction(
      //   resourceInstance,
      //   actionAffectingOneItem,
      // );
      return actionAffectingOneItem;
    };
    const createRestActionAffectingManyItems = (verb, callback) => {
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
      const originalActionName = `${name}.${verb}[many]`;

      const actionAffectingManyItem = createAction(callback, {
        meta: { verb, isMany: true },
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
        valueToData: (childItemIdArray) =>
          childStore.selectAll(childItemIdArray),
        // completeSideEffect: (actionCompleted) => resourceLifecycleManager.onActionComplete(actionCompleted),
      });
      // resourceLifecycleManager.registerAction(
      //   resourceInstance,
      //   actionAffectingManyItem,
      // );
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
      params,
    });
  };

  stateFacade.scopedOne = (
    propertyName,
    {
      idKey: childIdKey = "id",

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
    const createRestActionForScopedOne = (verb, callback) => {
      const childActionName = `${childName}.${verb}`;
      const restAction = createAction(callback, {
        name: childActionName,
        meta: { verb, isMany: false },
        resultToValue: (result) => {
          if (!Array.isArray(result) || result.length !== 2) {
            throw new TypeError(
              `${childActionName} callback must return [ownerId, props], received ${result}`,
            );
          }
          const [ownerId, props] = result;
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
      params,
    });
    return childResource;
  };
  stateFacade.scopedMany = (
    propertyName,
    {
      idKey: childIdKey = "id",

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
      const childStore = arraySignalStore([], childIdKey, {
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

      const childItemIdArraySignal = signal([]);
      scopedIdArraySignalMap.set(ownerId, childItemIdArraySignal);

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
        set: updateChildItemIdArray,
      });
    });
    const createRestActionForScopedMany = (verb, callback, { isMany }) => {
      if (!callback) {
        return undefined;
      }
      const childActionName = `${childName}.${verb}`;
      const childAction = createAction(callback, {
        name: childActionName,
        meta: { verb, isMany },
        resultToValue: (result) => {
          if (!Array.isArray(result) || result.length < 2) {
            throw new TypeError(
              `${childActionName} callback must return [ownerId, ...] array, received ${result}`,
            );
          }
          const [ownerId, ...rest] = result;
          const childStore = scopedStoreMap.get(ownerId);
          if (!childStore) {
            throw new Error(
              `${childActionName}: no store found for scope id "${ownerId}"`,
            );
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
      });
      return childAction;
    };

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
      params,
    });
    return childResource;
  };

  return stateFacade;
};

const createRestActionFactoryForRoot = (
  name,
  {
    idKey,
    store, // see array_signal_store.js
  },
) => {
  const createActionForRoot = (verb, restCallback, { isMany }) => {
    if (!isMany) {
      return createActionAffectingOneItem(verb, restCallback);
    }
    return createActionAffectingManyItems(verb, restCallback);
  };
  const createActionAffectingOneItem = (verb, callback) => {
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
      meta: { verb, isMany: false },
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
      // todo: restore completeSideEffect to notify lifecycle manager
      // completeSideEffect: (actionCompleted) => {},
    });
    return actionAffectingOneItem;
  };
  const createActionAffectingManyItems = (verb, callback) => {
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
      meta: { verb, isMany: true },
      name: `${name}.${verb}_MANY`,
      dataDefault: [],
      resultToValue: applyResultToValue,
      valueToData: (idArray) => {
        const items = store.selectAll(idArray);
        return items;
      },
      completeSideEffect: (actionCompleted) => {
        // resourceLifecycleManager.onActionComplete(actionCompleted);
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
    });
    // resourceLifecycleManager.registerAction(
    //   resourceInstance,
    //   actionAffectingManyItems,
    // );
    return actionAffectingManyItems;
  };

  return createActionForRoot;
};

const isProps = (value) => {
  return value !== null && typeof value === "object";
};

import { computed, signal } from "@preact/signals";

import { createAction } from "../../action/actions.js";
import { SYMBOL_OBJECT_SIGNAL } from "../../action/symbol_object_signal.js";
import { SYMBOL_IDENTITY } from "../../utils/compare_two_js_values.js";
import { getCallerInfo } from "../../utils/get_caller_info.js";
import { arraySignalStore, primitiveCanBeId } from "./array_signal_store.js";

// Naming conventions used throughout this file:
// - verb:             one of GET / POST / PUT / PATCH / DELETE
// - restCallbackKey:  one of GET / GET_MANY / POST / POST_MANY / PUT / PUT_MANY / PATCH / PATCH_MANY / DELETE / DELETE_MANY
// - restCallback:     the user-provided callback function associated with a restCallbackKey
// - restCallbacks:    object mapping { [restCallbackKey]: restCallback }
// - isMany:           true when the action operates on a collection (restCallbackKey ends with _MANY)

let DEBUG = false;

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
  const restHandler = createRestHandlerForRoot(name, {
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
    restHandler,

    params: undefined,
    store,
    addItemSetup,
  });
};

const createResource = (
  name,
  {
    idKey,
    mutableIdKeys = [],
    restCallbacks,
    restHandler,

    params,
    store,
    addItemSetup,
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
    one: undefined,
    many: undefined,
    ownOne: undefined,
    ownMany: undefined,

    // private but exposed for convenience
    store,
    addItemSetup,
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
    const paramsRestHandler = createRestHandlerForRoot(name, {
      idKey,
      store,
    });
    return createResource(name, {
      idKey,
      mutableIdKeys,
      restCallbacks,
      restHandler: paramsRestHandler,

      params: resolvedParams,
      store,
      addItemSetup,
    });
  };
  stateFacade.withParams = withParams;

  for (const [restCallbackKey, restCallback] of Object.entries(restCallbacks)) {
    if (restCallback === undefined) {
      continue;
    }
    const isMany = restCallbackKey.endsWith("_MANY");
    const verb = isMany
      ? restCallbackKey.replace("_MANY", "")
      : restCallbackKey;
    const action = restHandler(verb, restCallback, { isMany });
    if (!action) {
      console.error("no action returned (here to see when it happens)");
      continue;
    }
    if (params) {
      const actionBound = action.bindParams(params);
      stateFacade[restCallbackKey] = actionBound;
    } else {
      stateFacade[restCallbackKey] = action;
    }
  }

  // .one() links a property on this resource's items to an independent resource.
  // The property holds a reference (id or nested props) to an item in the child store.
  // When that item is updated anywhere, all signals reading the property update reactively.
  // The child resource exists independently — deleting the parent does not delete the child.
  //
  // @example — A user has one active session
  //
  //   HTTP endpoints involved:
  //     GET    /users/:id/session   → returns { id, token, ... }
  //     DELETE /users/:id/session   → logs out
  //
  //   Frontend:
  //     const SESSION = resource("session");
  //     const USER = resource("user", { GET: fetchUser });
  //     const USER_SESSION = USER.one("session", SESSION, {
  //       GET: async ({ id }) => {
  //         const session = await fetch(`/users/${id}/session`).json();
  //         return session;
  //       },
  //       DELETE: async ({ id }) => {
  //         await fetch(`/users/${id}/session`, { method: "DELETE" })
  //       },
  //     });
  //     // user.session → reactive Session object from SESSION store
  //     // USER_SESSION.GET({ id: 1 }) loads the session reactively
  //
  //   Chaining — session itself has a device (an independent resource):
  //     HTTP: GET /devices/:deviceId
  //     const DEVICE = resource("device", { GET: fetchDevice });
  //     USER_SESSION.one("device", DEVICE);
  //     // user.session.device → reactive Device object;
  //
  // The only methods available here are GET/PUT/DELETE
  // (there is no many as we deal with a single object)
  stateFacade.one = (
    propertyName,
    childResource,
    { GET, PUT, DELETE } = {},
  ) => {
    const childName = `${name}.${propertyName}`;
    const restHandlerForRelationshipToOne =
      createRestHandlerForRelationshipToOne(childName, {
        idKey,
        store,
        addItemSetup,
        propertyName,
        childResource,
      });
    return createResource(childName, {
      idKey: childResource.idKey,
      restCallbacks: {
        GET,
        PUT,
        DELETE,
      },
      restHandler: restHandlerForRelationshipToOne,
      params,
      store,
      addItemSetup,
    });
  };

  // .many() links a property on this resource's items to an array of independent resource items.
  // Each entry in the array is a full item in the child store, shared globally.
  // The child resource exists independently — items can be referenced by multiple parents.
  //
  // @example — A user has many friends (other users)
  //
  //   HTTP endpoints involved:
  //     GET  /users/:id/friends → returns [{ id, name, ... }, ...]
  //     POST /users/:id/friends → { friendId } → adds a friendship
  //
  //   Frontend:
  //     const USER = resource("user", { GET: fetchUser });
  //     const USER_FRIENDS = USER.many("friends", USER, {
  //       GET_MANY: async ({ id }) => {
  //         const friends = await fetch(`/users/${id}/friends`).json();
  //         return friends;
  //       },
  //       POST: async ({ id, friendId }) => {
  //          await fetch(`/users/${id}/friends/${friendId}`, { method: 'POST' });
  //          return [id, friendId];
  //       }
  //     });
  //     // user.friends → reactive array of User objects from the shared USER store
  //     // USER_FRIENDS.GET_MANY({ id: 1 }) loads the friend list reactively
  //
  //   Chaining — each friend (being a full USER) already has all USER relationships;
  //   if USER.ownOne("settings") is defined, user.friends[0].settings works with no extra setup:
  //     HTTP: PATCH /users/:id/settings
  //     USER.ownOne("settings", { PATCH: async ({ id, data }) => patchSettings(id, data) });
  //     // user.friends[0].settings.theme is reactive automatically
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
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;

    const restHandlerForRelationshipToMany =
      createRestHandlerForRelationshipToMany(childName, {
        idKey,
        store,
        addItemSetup,
        propertyName,
        childResource,
      });
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
      restHandler: restHandlerForRelationshipToMany,
      params,
      store,
      addItemSetup,
    });
  };

  // .ownOne() is for a resource that owns a single sub-object exclusively.
  // Unlike .one(), the child has no identity outside its owner and is not shared across items.
  // Each owner item gets its own private signal. Callbacks must return [ownerId, props|null].
  //
  // Chainable: the returned instance supports .one() and .many()
  // to describe relationships on the owned object pointing to independent resources.
  //
  // @example — A user has one profile (owned, not shared across users)
  //
  //   HTTP endpoints involved:
  //     GET   /users/:id/profile → returns { bio, avatar_url, theme_id }
  //     PATCH /users/:id/profile → { bio?, avatar_url? } → returns updated profile
  //
  //   Frontend:
  //     const USER = resource("user", { GET: fetchUser });
  //     USER.ownOne("profile", {
  //       GET:   async ({ id })       => [id, await fetchUserProfile(id)],
  //       PATCH: async ({ id, data }) => [id, await patchUserProfile(id, data)],
  //     });
  //     // user.profile → reactive profile object (null until loaded)
  //     // USER_PROFILE.GET({ id: 1 })
  //     // USER_PROFILE.PATCH({ id: 1, data: { bio: "hi" } })
  //
  //   Chaining — profile references an independent Theme resource:
  //     HTTP: GET /themes/:themeId
  //     const THEME = resource("theme", { GET: fetchTheme });
  //     USER_PROFILE.one("theme", THEME);
  //     // user.profile.theme → reactive Theme object from THEME store
  //     // When profile arrives with { theme_id: 5, bio: "..." }, user.profile.theme resolves to Theme#5
  stateFacade.ownOne = (
    propertyName,
    { idKey: childIdKey = "id", GET, POST, PUT, PATCH, DELETE } = {},
  ) => {
    const childName = `${name}.${propertyName}`;
    const ownOneRestHandler = createRestHandlerForOwnOne(childName, {
      idKey,
      propertyName,
      addItemSetup,
    });
    const childResource = createResource(childName, {
      idKey: childIdKey,
      restCallbacks: {
        GET,
        POST,
        PUT,
        PATCH,
        DELETE,
      },
      restHandler: ownOneRestHandler,
      params,
      store,
      addItemSetup: ownOneRestHandler.addItemSetup,
    });
    return childResource;
  };

  // .ownMany() is for resources that own a collection of sub-objects which can be mutated
  // directly via dedicated endpoints, without re-sending the whole parent.
  // The child objects have no identity outside their owner — two owners can have items
  // with the same id that are completely independent.
  //
  // Each owner item gets its own private arraySignalStore (no shared global store,
  // no id clashes across owners). All callbacks must return [ownerId, ...rest] so
  // the right per-owner store is updated.
  //
  // Chainable: the returned instance supports .one() and .many() to describe
  // relationships on the owned child items pointing to independent resources.
  //
  // @example — A table has columns (owned, no identity outside the table)
  //
  //   HTTP endpoints involved:
  //     GET    /tables/:id                      → returns { id, name, columns: [{ name, type_id }, ...] }
  //     POST   /tables/:id/columns              → { name, type_id } → returns added column
  //     PATCH  /tables/:id/columns/:name        → { name?, type_id? } → returns updated column
  //     DELETE /tables/:id/columns/:name        → removes column
  //
  //   Frontend:
  //     const TABLE = resource("table", { GET: fetchTable });
  //     const TABLE_COLUMNS = TABLE.ownMany("columns", {
  //       idKey: "name",
  //       POST:   async ({ id, name, typeId }) => [id, await addColumn(id, { name, typeId })],
  //       PATCH:  async ({ id, name, data })   => [id, name, await patchColumn(id, name, data)],
  //       DELETE: async ({ id, name })         => [id, name],
  //     });
  //     // table.columns → reactive array of column objects (private to each table)
  //     // TABLE_COLUMNS.POST({ id: 1, name: "email", typeId: 3 }) sends POST
  //     // TABLE_COLUMNS.DELETE({ id: 1, name: "email" }) sends DELETE
  //
  //   Chaining — each column references an independent DataType resource:
  //     HTTP: GET /data-types/:typeId
  //     const DATA_TYPE = resource("dataType", { GET: fetchDataType });
  //     TABLE_COLUMNS.one("dataType", DATA_TYPE);
  //     // column.dataType → reactive DataType object from DATA_TYPE store
  //     // When table.columns = [{ name: "email", type_id: 3 }], column.dataType resolves to DataType#3
  stateFacade.ownMany = (
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
    const ownManyRestHandler = createRestHandlerForOwnMany(childName, {
      idKey,
      addItemSetup,
      propertyName,
      childIdKey,
    });
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
      restHandler: ownManyRestHandler,
      params,
      store,
      addItemSetup: ownManyRestHandler.addItemSetup,
    });
    // .one()/.many() on owned child items cannot use the default implementations
    // (those target the parent shared store). Override them to register setup
    // callbacks on the per-owner child items instead.
    childResource.one = (nestedPropertyName, nestedChildResource) => {
      ownManyRestHandler.addItemSetup((childItem) => {
        setupToOneRelationship(
          childItem,
          nestedPropertyName,
          nestedChildResource,
        );
      });
      return nestedChildResource;
    };
    childResource.many = (nestedPropertyName, nestedChildResource) => {
      ownManyRestHandler.addItemSetup((childItem) => {
        setupToManyRelationship(
          childItem,
          nestedPropertyName,
          nestedChildResource,
        );
      });
      return nestedChildResource;
    };
    return childResource;
  };

  return stateFacade;
};

const createRestHandlerForRoot = (
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

  return {
    createAction: createActionForRoot,
  };
};
const createRestHandlerForRelationshipToOne = (
  name,
  { idKey, store, addItemSetup, propertyName, childResource },
) => {
  const childIdKey = childResource.idKey;
  addItemSetup((item) => {
    const { updateChildItemId, childItemSignal } = setupToOneRelationship(
      item,
      propertyName,
      childResource,
    );

    if (DEBUG) {
      console.debug(
        `setup ${item}.${propertyName} is one "${childResource.name}" (current value: ${childItemSignal.peek()})`,
      );
      const desc = Object.getOwnPropertyDescriptor(item, propertyName);
      Object.defineProperty(item, propertyName, {
        get: desc.get,
        set: (value) => {
          if (!updateChildItemId(value)) {
            return;
          }
          console.debug(
            `${item}.${propertyName} updated to ${childItemSignal.peek()}`,
          );
        },
        configurable: true,
      });
    }
  });

  const childStore = childResource.store;
  const createRelationshipToOneRestAction = (verb, callback) => {
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

  return {
    createRestAction: createRelationshipToOneRestAction,
  };
};
const createRestHandlerForRelationshipToMany = (
  name,
  { idKey, store, addItemSetup, propertyName, childResource } = {},
) => {
  const childIdKey = childResource.idKey;
  const childStore = childResource.store;
  addItemSetup((item) => {
    const {
      updateChildItemIdArray,
      childItemIdArraySignal,
      childItemArraySignal,
    } = setupToManyRelationship(item, propertyName, childResource);

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
      console.debug(
        `setup ${item}.${propertyName} is many "${childResource.name}" (current value: ${childItemArray.length ? childItemArray.join(",") : "[]"})`,
      );
      Object.defineProperty(item, propertyName, {
        get: () => {
          const childItemArray = childItemArraySignal.value;
          console.debug(
            `return ${childItemArray.length ? childItemArray.join(",") : "[]"} for ${item}.${propertyName}`,
          );
          return childItemArray;
        },
        set: (value) => {
          updateChildItemIdArray(value);
          console.debug(
            `${item}.${propertyName} updated to ${childItemIdArraySignal.peek()}`,
          );
        },
        configurable: true,
      });
    }
  });

  const createRelationshipToManyRestAction = (
    restCallbackKey,
    restCallback,
  ) => {
    if (!restCallback) {
      return undefined;
    }
    const isMany = restCallbackKey.endsWith("_MANY");
    if (!isMany) {
      return createManyRestActionAffectingOneItem(
        restCallbackKey,
        restCallback,
      );
    }
    const verb = restCallbackKey.replace("_MANY", "");
    return createManyRestActionAffectingManyItems(verb, restCallback);
  };
  const createManyRestActionAffectingOneItem = (verb, callback) => {
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
  const createManyRestActionAffectingManyItems = (verb, callback) => {
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
      valueToData: (childItemIdArray) => childStore.selectAll(childItemIdArray),
      // completeSideEffect: (actionCompleted) => resourceLifecycleManager.onActionComplete(actionCompleted),
    });
    // resourceLifecycleManager.registerAction(
    //   resourceInstance,
    //   actionAffectingManyItem,
    // );
    return actionAffectingManyItem;
  };

  return {
    createRestAction: createRelationshipToManyRestAction,
  };
};
const createRestHandlerForOwnOne = (
  childName,
  { idKey, addItemSetup, propertyName },
) => {
  // setupCallbackSet: callbacks added by chained .one()/.many()
  // Applied to each per-owner child item object when it is first created.
  const childItemSetupCallbackSet = new Set();
  const childAddItemSetup = (callback) =>
    childItemSetupCallbackSet.add(callback);
  const ownerChildItemMap = new Map(); // ownerId → stable child item object
  const ownerChildSignalMap = new Map(); // ownerId → signal<childItem | null>
  addItemSetup((ownerItem) => {
    const ownerId = ownerItem[idKey];
    // Create a stable child item — mutated in place via applyProps.
    // Reactive getters/setters from chained .one() etc. are defined on this object now
    // so they survive across multiple prop updates.
    const childItem = {};
    for (const childSetup of childItemSetupCallbackSet) {
      childSetup(childItem);
    }
    ownerChildItemMap.set(ownerId, childItem);
    const childSignal = signal(null);
    ownerChildSignalMap.set(ownerId, childSignal);

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

  const createOwnOneRestAction = (verb, callback) => {
    const childActionName = `${childName}.${verb}`;
    return createAction(callback, {
      name: childActionName,
      meta: { verb, isMany: false },
      resultToValue: (result) => {
        if (!Array.isArray(result) || result.length !== 2) {
          throw new TypeError(
            `${childActionName} callback must return [ownerId, props], received ${result}`,
          );
        }
        const [ownerId, props] = result;
        const childItem = ownerChildItemMap.get(ownerId);
        if (!childItem) {
          throw new Error(
            `${childActionName}: no item found for owner id "${ownerId}"`,
          );
        }
        const childSignal = ownerChildSignalMap.get(ownerId);
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
  };

  return {
    createOwnOneRestAction,
    addItemSetup: childAddItemSetup,
  };
};
const createRestHandlerForOwnMany = (
  childName,
  { idKey, addItemSetup, propertyName, childIdKey },
) => {
  // setupCallbackSet: callbacks added by chained .one()/.many()
  // Applied to each child item when it is created in a per-owner store.
  const childSetupCallbackSet = new Set();
  const childAddItemSetup = (callback) => childSetupCallbackSet.add(callback);
  const ownerStoreMap = new Map(); // ownerId → childStore
  const ownerIdArraySignalMap = new Map(); // ownerId → childItemIdArraySignal
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
      set: updateChildItemIdArray,
    });
  });

  const createOwnManyRestAction = (restCallbackKey, restCallback) => {
    if (!restCallback) {
      return undefined;
    }
    const verb = restCallbackKey.replace("_MANY", "");
    const isMany = restCallbackKey.endsWith("_MANY");
    const childActionName = `${childName}.${restCallbackKey}`;
    return createAction(restCallback, {
      name: childActionName,
      meta: { verb, isMany },
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
  };

  return {
    createOwnManyRestAction,
    addItemSetup: childAddItemSetup,
  };
};

// Installs a reactive getter/setter on `item[propertyName]` that tracks one item
// from `childResource.store`. The property value is a facade of the child item
// (or a null-like object if the child is not found).
// Used by both resourceInstance.one() and ownOneInstance.one().
const setupToOneRelationship = (item, propertyName, childResource) => {
  const childIdKey = childResource.idKey;
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
  return { updateChildItemId, childItemSignal };
};

// Installs a reactive getter/setter on `item[propertyName]` that tracks an array of items
// from `childResource.store`. The property value is the live array (possibly empty).
// Used by resourceInstance.many(), ownOneInstance.many(), and ownManyInstance.many().
// resourceInstance.many() additionally layers observeProperties (for id renames) and DEBUG logs.
const setupToManyRelationship = (item, propertyName, childResource) => {
  const childIdKey = childResource.idKey;
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
  return {
    updateChildItemIdArray,
    childItemIdArraySignal,
    childItemArraySignal,
  };
};

const isProps = (value) => {
  return value !== null && typeof value === "object";
};

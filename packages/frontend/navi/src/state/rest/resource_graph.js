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

// Naming conventions used throughout this file:
// - verb:             one of GET / POST / PUT / PATCH / DELETE
// - restCallbackKey:  one of GET / GET_MANY / POST / POST_MANY / PUT / PUT_MANY / PATCH / PATCH_MANY / DELETE / DELETE_MANY
// - restCallback:     the user-provided callback function associated with a restCallbackKey
// - restCallbacks:    object mapping { [restCallbackKey]: restCallback }
// - isMany:           true when the action operates on a collection (restCallbackKey ends with _MANY)

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
  //       GET:    async ({ id }) => fetchUserSession(id),   // GET /users/:id/session
  //       DELETE: async ({ id }) => deleteUserSession(id),  // DELETE /users/:id/session
  //     });
  //     // user.session → reactive Session object from SESSION store
  //     // USER_SESSION.GET({ id: 1 }) loads the session reactively
  //
  //   Chaining — session itself has a device (an independent resource):
  //     HTTP: GET /devices/:deviceId
  //     const DEVICE = resource("device", { GET: fetchDevice });
  //     USER_SESSION.one("device", DEVICE);
  //     // user.session.device → reactive Device object; resolves via session.device_id automatically
  resourceInstance.one = (propertyName, childResource, options) => {
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    resourceInstance.addItemSetup((item) => {
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

  // .many() links a property on this resource's items to an array of independent resource items.
  // Each entry in the array is a full item in the child store, shared globally.
  // The child resource exists independently — items can be referenced by multiple parents.
  //
  // @example — A user has many friends (other users)
  //
  //   HTTP endpoints involved:
  //     GET  /users/:id/friends          → returns [{ id, name, ... }, ...]
  //     POST /users/:id/friends          → { friendId } → adds a friendship
  //
  //   Frontend:
  //     const USER = resource("user", { GET: fetchUser });
  //     const USER_FRIENDS = USER.many("friends", USER, {
  //       GET_MANY: async ({ id }) => fetchUserFriends(id),  // GET /users/:id/friends
  //       POST:     async ({ id, friendId }) => addFriend(id, friendId), // POST /users/:id/friends
  //     });
  //     // user.friends → reactive array of User objects from the shared USER store
  //     // USER_FRIENDS.GET_MANY({ id: 1 }) loads the friend list reactively
  //
  //   Chaining — each friend (being a full USER) already has all USER relationships;
  //   if USER.ownOne("settings") is defined, user.friends[0].settings works with no extra setup:
  //     HTTP: PATCH /users/:id/settings
  //     USER.ownOne("settings", { PATCH: async ({ id, data }) => patchSettings(id, data) });
  //     // user.friends[0].settings.theme is reactive automatically
  resourceInstance.many = (propertyName, childResource, options) => {
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    resourceInstance.addItemSetup((item) => {
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
  //     GET   /users/:id/profile              → returns { bio, avatar_url, theme_id }
  //     PATCH /users/:id/profile              → { bio?, avatar_url? } → returns updated profile
  //
  //   Frontend:
  //     const USER = resource("user", { GET: fetchUser });
  //     USER.ownOne("profile", {
  //       GET:   async ({ id })       => [id, await fetchUserProfile(id)],
  //       PATCH: async ({ id, data }) => [id, await patchUserProfile(id, data)],
  //     });
  //     // user.profile → reactive profile object (null until loaded)
  //     // USER_PROFILE.GET({ id: 1 }) fetches GET /users/1/profile
  //     // USER_PROFILE.PATCH({ id: 1, data: { bio: "hi" } }) sends PATCH
  //
  //   Chaining — profile references an independent Theme resource:
  //     HTTP: GET /themes/:themeId
  //     const THEME = resource("theme", { GET: fetchTheme });
  //     USER_PROFILE.one("theme", THEME);
  //     // user.profile.theme → reactive Theme object from THEME store
  //     // When profile arrives with { theme_id: 5, bio: "..." }, user.profile.theme resolves to Theme#5
  resourceInstance.ownOne = (
    propertyName,
    { GET, POST, PUT, PATCH, DELETE } = {},
  ) => {
    const restCallbacks = { GET, POST, PUT, PATCH, DELETE };
    const childName = `${name}.${propertyName}`;
    // setupCallbackSet: callbacks added by chained .one()/.many()/.ownOne()/.ownMany()
    // They are applied to each per-owner child item object when it is first created.
    const setupCallbackSet = new Set();
    const addItemSetup = (callback) => setupCallbackSet.add(callback);
    const ownerChildItemMap = new Map(); // ownerId → stable child item object
    const ownerChildSignalMap = new Map(); // ownerId → signal<childItem | null>

    resourceInstance.addItemSetup((ownerItem) => {
      const ownerId = ownerItem[idKey];
      // Create a stable child item — it will be mutated in place via applyProps.
      // Reactive getters/setters from chained .one() etc. are defined on this object now
      // so they survive across multiple prop updates.
      const childItem = {};
      for (const setup of setupCallbackSet) {
        setup(childItem);
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

    const ownOneInstance = { name: childName, addItemSetup };

    // .one() adds a reactive getter/setter on the owned child item pointing into an independent store.
    // Returns the independent resource for further chaining if needed.
    ownOneInstance.one = (nestedPropertyName, childResource) => {
      addItemSetup((childItem) => {
        setupToOneRelationship(childItem, nestedPropertyName, childResource);
      });
      return childResource;
    };

    // .many() adds a reactive array getter on the owned child item backed by an independent store.
    // Returns the independent resource for further chaining if needed.
    ownOneInstance.many = (nestedPropertyName, childResource) => {
      addItemSetup((childItem) => {
        setupToManyRelationship(childItem, nestedPropertyName, childResource);
      });
      return childResource;
    };

    // TODO: ownOneInstance.ownOne() and ownOneInstance.ownMany() for triple nesting
    // (e.g. user.profile.pinnedColumns). Requires propagating per-owner identity down
    // to create per-(owner, child) stores. Not yet implemented.

    for (const [restCallbackKey, restCallback] of Object.entries(
      restCallbacks,
    )) {
      if (!restCallback) continue;
      const verb = restCallbackKey;
      const childActionName = `${childName}.${verb}`;
      const action = createAction(restCallback, {
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
      ownOneInstance[restCallbackKey] = action;
    }

    return ownOneInstance;
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
    // setupCallbackSet: callbacks added by chained .one()/.many() etc.
    // Applied to each child item when it is created in a per-owner store.
    const setupCallbackSet = new Set();
    const addItemSetup = (callback) => setupCallbackSet.add(callback);
    const ownerStoreMap = new Map(); // ownerId → childStore
    const ownerIdArraySignalMap = new Map(); // ownerId → childItemIdArraySignal

    resourceInstance.addItemSetup((item) => {
      const ownerId = item[idKey];
      const childStore = arraySignalStore([], childIdKey, {
        name: `${name}#${ownerId}.${propertyName} store`,
        createItem: (props) => {
          const childItem = {};
          Object.assign(childItem, props);
          for (const setup of setupCallbackSet) {
            setup(childItem);
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
        set: (value) => {
          updateChildItemIdArray(value);
        },
      });
    });

    const ownManyInstance = {
      name: childName,
      idKey: childIdKey,
      addItemSetup,
    };

    // .one() adds a reactive getter/setter on each owned child item pointing into an independent store.
    // Returns the independent resource for further chaining if needed.
    ownManyInstance.one = (nestedPropertyName, childResource) => {
      const nestedIdKey = childResource.idKey;
      addItemSetup((childItem) => {
        const childItemIdSignal = signal();
        const updateChildItemId = (value) => {
          const currentId = childItemIdSignal.peek();
          if (isProps(value)) {
            const item = childResource.store.upsert(value);
            const itemId = item[nestedIdKey];
            if (currentId === itemId) return false;
            childItemIdSignal.value = itemId;
            return true;
          }
          if (primitiveCanBeId(value)) {
            childResource.store.upsert({ [nestedIdKey]: value });
            if (currentId === value) return false;
            childItemIdSignal.value = value;
            return true;
          }
          if (currentId === undefined) return false;
          childItemIdSignal.value = undefined;
          return true;
        };
        updateChildItemId(childItem[nestedPropertyName]);
        const nestedItemSignal = computed(() =>
          childResource.store.select(childItemIdSignal.value),
        );
        const nestedItemFacadeSignal = computed(() => {
          const nestedItem = nestedItemSignal.value;
          if (nestedItem) {
            const copy = Object.create(
              Object.getPrototypeOf(nestedItem),
              Object.getOwnPropertyDescriptors(nestedItem),
            );
            Object.defineProperty(copy, SYMBOL_OBJECT_SIGNAL, {
              value: nestedItemSignal,
              writable: false,
              enumerable: false,
              configurable: false,
            });
            return copy;
          }
          return {
            [SYMBOL_OBJECT_SIGNAL]: nestedItemSignal,
            valueOf: () => null,
          };
        });
        Object.defineProperty(childItem, nestedPropertyName, {
          get: () => nestedItemFacadeSignal.value,
          set: updateChildItemId,
        });
      });
      return childResource;
    };

    // .many() adds a reactive array getter on owned child items backed by an independent store.
    // Returns the independent resource for further chaining if needed.
    ownManyInstance.many = (nestedPropertyName, childResource) => {
      addItemSetup((childItem) => {
        setupToManyRelationship(childItem, nestedPropertyName, childResource);
      });
      return childResource;
    };

    // TODO: ownManyInstance.ownOne() and ownManyInstance.ownMany() for triple nesting
    // (e.g. table.columns[n].constraints). Requires propagating per-(owner, child) identity
    // down to create nested stores. Not yet implemented.

    for (const [restCallbackKey, restCallback] of Object.entries(
      restCallbacks,
    )) {
      if (!restCallback) continue;
      const verb = restCallbackKey.replace("_MANY", "");
      const isMany = restCallbackKey.endsWith("_MANY");
      const childActionName = `${childName}.${restCallbackKey}`;
      const action = createAction(restCallback, {
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

          // PUT, PATCH, POST: rest may be [props] or ["idKey", oldId, props] for renames
          const childItem =
            rest.length > 1
              ? childStore.upsert(...rest)
              : childStore.upsert(rest[0]);
          return [ownerId, childItem[childIdKey]];
        },
      });

      ownManyInstance[restCallbackKey] = action;
    }

    return ownManyInstance;
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
   * @param {false|Array|string} options.rerunOn.GET - REST verbs that trigger GET rerun (false = reset on DELETE)
   * @param {false|Array|string} options.rerunOn.GET_MANY - REST verbs that trigger GET_MANY rerun (false = reset on DELETE)
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

  const findEffectOnActions = (triggeringAction) => {
    // Determines which actions to rerun/reset when an action completes.

    const actionsToRerun = new Set();
    const actionsToReset = new Set();
    const reasonSet = new Set();

    for (const [resourceInstance, config] of registeredResources) {
      const shouldRerunGetMany = shouldRerunAfter(
        config.rerunOn.GET_MANY,
        triggeringAction.meta.verb,
      );
      const shouldRerunGet = shouldRerunAfter(
        config.rerunOn.GET,
        triggeringAction.meta.verb,
      );

      // Skip if no rerun or reset rules apply
      const hasMutableIdAutorerun =
        (triggeringAction.meta.verb === "POST" ||
          triggeringAction.meta.verb === "PUT" ||
          triggeringAction.meta.verb === "PATCH") &&
        config.mutableIdKeys.length > 0;

      if (
        !shouldRerunGetMany &&
        !shouldRerunGet &&
        triggeringAction.meta.verb !== "DELETE" &&
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
          const triggerVerb = triggeringAction.meta.verb;
          const candidateVerb = actionCandidate.meta.verb;

          if (triggerVerb === candidateVerb) {
            continue;
          }

          const candidateIsPlural = actionCandidate.meta.isMany;
          const triggeringResource = getResourceForAction(triggeringAction);
          const isSameResource = triggeringResource === resourceInstance;

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
            const deleteIdSet = triggeringAction.meta.isMany
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
              triggeringResource &&
              resourceDependencies
                .get(triggeringResource)
                ?.has(resourceInstance) &&
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

  const createActionAffectingOneItem = (verb, { callback, ...options }) => {
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
      meta: {
        verb,
        isMany: false,
        paramScope,
        resourceInstance,
        store,
      },
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

  const createActionAffectingManyItems = (verb, { callback, ...options }) => {
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
      meta: {
        verb,
        isMany: true,
        paramScope,
        resourceInstance,
        store,
      },
      name: `${name}.${verb}_MANY`,
      dataDefault: [],
      resultToValue: applyResultToValue,
      valueToData: (idArray) => {
        const items = store.selectAll(idArray);
        return items;
      },
      completeSideEffect: (actionCompleted) => {
        resourceLifecycleManager.onActionComplete(actionCompleted);
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
  const createActionAffectingOneItem = (verb, { callback, ...options }) => {
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
        resourceInstance,
        store,
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
  const createActionAffectingOneItem = (verb, { callback, ...options }) => {
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
      meta: {
        verb,
        isMany: false,
        resourceInstance,
        store: childStore,
      },
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

  const createActionAffectingManyItems = (verb, { callback, ...options }) => {
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
      meta: {
        verb,
        isMany: true,
        resourceInstance,
        store: childStore,
      },
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

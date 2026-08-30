import { computed, effect, signal, untracked } from "@preact/signals";

import { createAction } from "../../action/actions.js";
import {
  OfflineError,
  peekNetworkPolicyReason,
} from "../../action/network_policy.js";
import { SYMBOL_OBJECT_SIGNAL } from "../../action/symbol_object_signal.js";
import { SYMBOL_IDENTITY } from "../../utils/compare_two_js_values.js";
import { getCallerInfo } from "../../utils/get_caller_info.js";
import {
  arraySignalStore,
  primitiveCanBeId,
  syncStoreToSignals,
} from "./array_signal_store.js";
import {
  createResourceLifecycleManager,
  recordGetResultProperties,
} from "./item_lifecycle_manager.js";
import { getParamScope } from "./param_scope.js";
import { createRangeReader } from "./resource_range_reader.js";

const resourceLifecycleManager = createResourceLifecycleManager();

/*
 * REST resources backed by signal stores: `resource()` creates one, and the
 * relationship methods on it (.one/.many/.scopedOne/.scopedMany) model
 * parent/child relations. Each method carries its own JSDoc — read those, and
 * docs/resource.md for how to choose between them.
 *
 * How the file is organized:
 * - `resource()` sets up the shared store then delegates to `createResource`.
 * - `createResource` builds the "stateFacade" (the object users interact
 *   with): one action per REST callback plus the relationship methods. Each
 *   relationship method calls `createResource` again for the child, injecting
 *   its own `createRestAction` — the strategy deciding how an action result is
 *   applied to the store(s). This recursion is what makes relationship
 *   resources chainable (`USER.one(...).one(...)`).
 * - Relationships make item properties reactive: `addItemSetup` registers a
 *   callback that defines a getter/setter on each item. The setter upserts
 *   plain values into the child store, the getter reads a computed signal, so
 *   `item.child = {...}` and `item.child` always go through the store.
 *
 * Naming conventions used throughout this file:
 * - verb:            one of GET / POST / PUT / PATCH / DELETE
 * - restCallbackKey: one of GET / GET_MANY / GET_RANGE / POST / POST_MANY / PUT / PUT_MANY / PATCH / PATCH_MANY / DELETE / DELETE_MANY
 *                    (GET_RANGE is the odd one out: a reader, not an action — see resource_range_reader.js)
 * - restCallback:    the user-provided callback function associated with a restCallbackKey
 * - restCallbacks:   object mapping { [restCallbackKey]: restCallback }
 * - isMany:          true when the action operates on a collection (restCallbackKey ends with _MANY)
 * - declarationSite: "file:line:column" of the user code that declared the
 *                    callbacks, shown in invalid-result errors
 */

let DEBUG = false;
const debug = (...args) => {
  if (!DEBUG) {
    return;
  }
  console.debug(...args);
};

/**
 * Creates a reactive REST resource backed by a shared signal store.
 * Returns a `stateFacade` exposing one action per REST callback provided
 * (`USER.GET`, `USER.GET_MANY`, `USER.POST`, …) plus `.withParams()` and the
 * relationship methods `.one()`, `.many()`, `.scopedOne()`, `.scopedMany()`.
 *
 * Each REST callback receives the params passed to the action call and must return
 * the data that will be upserted into the store:
 * - GET / POST / PUT / PATCH → the full item object, e.g. `{ id, name }`
 * - DELETE                   → the id or `{ id }` of the removed item
 * - GET_MANY / POST_MANY / … → an array of item objects
 * - GET_RANGE                 → `{ items, start, count }`, one slice of the collection
 *
 * `GET_RANGE` is a reader rather than an action: it keeps no value and has nothing to
 * rerun, so a `<List.Items>` can feed on it slice by slice
 * (`itemsAction={USER.GET_RANGE.bindParams({ team })}`). A mutation listed in
 * `rerunOn.GET_RANGE` (`["POST", "DELETE"]` by default) tells it the collection moved,
 * and whoever holds slices reads them again.
 *
 * A sub-resource of the backend (`/games/:id/candidates`) must be modelled with a
 * relationship method, never as an `op`/`type` discriminator dispatched inside one
 * verb's callback.
 *
 * @param {string} name - resource name, used in action names and error messages
 * @param {Object} restCallbacks - `{ idKey, uniqueKeys, rerunOn, dependencies, GET, GET_MANY, GET_RANGE, POST, POST_MANY, PUT, PUT_MANY, PATCH, PATCH_MANY, DELETE, DELETE_MANY }`
 * @param {string} [restCallbacks.idKey] - primary key property, defaults to `"id"`
 * @param {string[]} [restCallbacks.uniqueKeys] - alternate keys the store can find an item by (e.g. `"username"`); a callback may return a different `id` to rename the item's primary key
 * @see docs/resource.md — relationships, callback return contracts, decision table
 *
 * @example
 * const USER = resource("user", {
 *   GET: ({ id }) => fetchJson(`/users/${id}`),
 *   GET_MANY: () => fetchJson(`/users`),
 *   POST: (user) => fetchJson(`/users`, { method: "POST", body: user }),
 *   DELETE: ({ id }) => fetchJson(`/users/${id}`, { method: "DELETE" }),
 * });
 */
export const resource = (
  name,
  {
    // configuration options
    idKey = "id",
    uniqueKeys = [],
    rerunOn,
    dependencies,

    GET,
    GET_MANY,
    GET_RANGE,
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
  const declarationSite = getDeclarationSite();
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
    declarationSite,
  });
  // The row a GET designates, when the store already holds it — by its params:
  // the value under idKey may be the id or any unique key (a route opening a
  // user by id or by slug names both `id`), and a unique key may be given under
  // its own name; or, when the params name no row (a GET without params, or
  // whose params carry no key), the row the action last completed with.
  // Answers a GET under a network policy (see applyNetworkPolicy).
  const selectByAnyKey = (value) => {
    const item = store.select(value);
    if (item) {
      return item;
    }
    for (const uniqueKey of uniqueKeys) {
      const itemByUniqueKey = store.select(uniqueKey, value);
      if (itemByUniqueKey) {
        return itemByUniqueKey;
      }
    }
    return null;
  };
  const findItemByParams = (params) => {
    if (primitiveCanBeId(params)) {
      return selectByAnyKey(params);
    }
    if (!isProps(params)) {
      return null;
    }
    const idParam = params[idKey];
    if (idParam !== undefined) {
      const item = selectByAnyKey(idParam);
      if (item) {
        return item;
      }
    }
    for (const uniqueKey of uniqueKeys) {
      const uniqueKeyParam = params[uniqueKey];
      if (uniqueKeyParam !== undefined) {
        const item = store.select(uniqueKey, uniqueKeyParam);
        if (item) {
          return item;
        }
      }
    }
    return null;
  };
  const findItemInStore = (params, action) => {
    return untracked(() => {
      const itemByParams = findItemByParams(params);
      if (itemByParams) {
        return itemByParams;
      }
      const lastItemId = getLastGetItemId(action);
      if (lastItemId === undefined) {
        return null;
      }
      return store.select(lastItemId) || null;
    });
  };
  return createResource(name, {
    idKey,
    uniqueKeys,
    findItemInStore,
    restCallbacks: {
      GET,
      GET_MANY,
      GET_RANGE,
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
    findItemInStore,
    restCallbacks,
    store,
    addItemSetup,
    createRestAction,
    paramScope,
    rerunOn,
    dependencies,
  },
) => {
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

  resourceLifecycleManager.registerResource(stateFacade, {
    rerunOn,
    paramScope,
    dependencies,
    uniqueKeys,
  });
  const onActionComplete = (actionCompleted) => {
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
   * @see docs/resource_with_params.md for detailed documentation and examples
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
    const declarationSite = getDeclarationSite();
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
      declarationSite,
    });
    return createResource(name, {
      idKey,
      uniqueKeys,
      findItemInStore,
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

  /**
   * Links a property on each item to a single item in an independent child store.
   * The property is reactive: updating the child item anywhere propagates immediately.
   * The child resource exists independently — it is not owned by, nor deleted with, the parent.
   *
   * Use it when the child is a first-class entity with its own store, shared across
   * parents (a user referenced by many games). When the child only exists inside its
   * owner, use `.scopedOne()` instead.
   *
   * Callback return contracts:
   * - GET / PUT → the parent object with the relationship nested inside:
   *   `async ({ id }) => ({ id, session: { id: 10, token: "abc" } })`; `null` for no relationship
   * - DELETE → the parent id (or `{ id }`); the property is set to `null`
   *
   * The backend may also embed the child inline in a parent GET/POST response — the
   * setter on the property upserts the nested object into the child store.
   *
   * Returns the child relationship resource, itself chainable:
   * `USER_SESSION.one("device", DEVICE)` adds a reactive `.device` property to each session.
   *
   * @param {string} propertyName - property holding the child on each parent item
   * @param {Object} childResource - the independent resource created by `resource()`
   * @param {Object} [restCallbacks] - `{ rerunOn, dependencies, GET, PUT, DELETE }`
   * @see docs/resource.md
   */
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
    const declarationSite = getDeclarationSite();
    const childName = `${name}.${propertyName}`;
    const childIdKey = childResource.idKey;
    const childStore = childResource.store;
    addItemSetup((item) => {
      const childItemIdSignal = signal();
      const updateChildItemId = (value) => {
        const currentChildItemId = childItemIdSignal.peek();
        let childItemProps;
        if (isProps(value)) {
          childItemProps = value;
        } else if (primitiveCanBeId(value)) {
          childItemProps = { [childIdKey]: value };
        } else {
          if (currentChildItemId === undefined) {
            return false;
          }
          childItemIdSignal.value = undefined;
          return true;
        }
        const childItem = childStore.upsert(childItemProps);
        const childItemId = childItem[childIdKey];
        if (currentChildItemId === childItemId) {
          return false;
        }
        childItemIdSignal.value = childItemId;
        return true;
      };
      updateChildItemId(item[propertyName]);
      const childItemSignal = computed(() =>
        childStore.select(childItemIdSignal.value),
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

    const createRestActionForOne = (verb, callback, { onActionComplete }) => {
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
          : // GET/PUT contract (see .one() JSDoc): the parent object with the
            // relationship nested inside, or null for no relationship.
            (result) => {
              const item = store.upsert(result);
              const childItem = item[propertyName];
              return childItem ? childItem[childIdKey] : undefined;
            };
      const throwInvalidResult = createInvalidResultThrower(
        `${name}.${verb}`,
        declarationSite,
      );
      return createAction(callback, {
        meta: {
          verb,
          isMany: false,
          paramScope,
        },
        name: `${name}.${verb}`,
        resultToValue: (result, action) => {
          if (verb === "DELETE") {
            if (!isProps(result) && !primitiveCanBeId(result)) {
              throwInvalidResult(
                action.name,
                `an object (that will be used to drop "${name}" resource)`,
                result,
              );
            }
          } else if (!isProps(result)) {
            throwInvalidResult(
              action.name,
              `an object (that will be used to upsert "${name}" resource)`,
              result,
            );
          }
          return applyResultToValue(result);
        },
        valueToData: (childItemId) => childStore.select(childItemId),
        completeSideEffect: onActionComplete,
      });
    };

    return createResource(childName, {
      idKey: childIdKey,
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

  /**
   * Links a property on each item to an array of items in an independent child store.
   * Items in the array are full entries in the shared child store — if the same item is
   * referenced by several parents, a single update propagates to all of them.
   *
   * Use it when children are first-class entities shared across parents (a game's players,
   * who are users). When the children only exist inside their owner, or when the relation
   * itself carries fields (`seen_at`, `slot`), use `.scopedMany()` instead.
   *
   * Callback return contracts:
   * - GET_MANY → the parent object with the array nested inside:
   *   `async ({ id }) => ({ id, friends: [{ id: 2 }, { id: 3 }] })` — a full-parent
   *   response is absorbed as-is; the array replaces the relationship
   * - GET / POST / PUT / PATCH → the child object; it is upserted into the child store
   *   but does NOT join the parent's array, which only a GET_MANY refresh changes
   * - DELETE → `[parentId, childId]`
   * - DELETE_MANY → `[parentId, [childId, childId, …]]`
   *
   * @param {string} propertyName - property holding the child array on each parent item
   * @param {Object} childResource - the independent resource created by `resource()`
   * @param {Object} [restCallbacks] - `{ rerunOn, dependencies, GET, GET_MANY, POST, POST_MANY, PUT, PUT_MANY, PATCH, PATCH_MANY, DELETE, DELETE_MANY }`
   * @see docs/resource.md
   */
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
    const declarationSite = getDeclarationSite();
    const childStore = childResource.store;
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    addItemSetup((item) => {
      const childItemIdArraySignal = signal([]);
      const updateChildItemIdArray = createChildIdArrayUpdater(
        childStore,
        childIdKey,
        childItemIdArraySignal,
      );
      updateChildItemIdArray(item[propertyName]);
      const childItemArraySignal = computed(() => {
        const idArray = childItemIdArraySignal.value;
        const arr = childStore.selectAll(idArray);
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
      syncIdArrayOnRename(childStore, childIdKey, childItemIdArraySignal);
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
      { isMany, onActionComplete },
    ) => {
      if (!isMany) {
        return createRestActionAffectingOneItem(verb, callback, {
          onActionComplete,
        });
      }
      return createRestActionAffectingManyItems(verb, callback, {
        onActionComplete,
      });
    };
    const createRestActionAffectingOneItem = (
      verb,
      callback,
      { onActionComplete },
    ) => {
      const applyResultToValue =
        verb === "DELETE"
          ? ([itemId, childItemId]) => {
              const item = store.select(itemId);
              const childItemArray = item[propertyName];
              const childItemArrayWithoutThisOne = [];
              let found = false;
              for (const childItemCandidate of childItemArray) {
                if (childItemCandidate[childIdKey] === childItemId) {
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
              // an array is [property, value, props], used to rename the child id
              const childItem = Array.isArray(childData)
                ? childStore.upsert(...childData)
                : childStore.upsert(childData);
              return childItem[childIdKey];
            };
      const throwInvalidResult = createInvalidResultThrower(
        `${name}.${verb}`,
        declarationSite,
      );
      return createAction(callback, {
        meta: { verb, isMany: false, paramScope },
        name: `${name}.${verb}`,
        resultToValue: (result, action) => {
          if (verb === "DELETE") {
            if (!Array.isArray(result) || result.length !== 2) {
              throwInvalidResult(
                action.name,
                `an array [itemId, childItemId] (that will be used to remove relationship)`,
                result,
              );
            }
          } else if (!isProps(result)) {
            throwInvalidResult(
              action.name,
              `an object (that will be used to upsert child item)`,
              result,
            );
          }
          return applyResultToValue(result);
        },
        valueToData: (childItemId) => childStore.select(childItemId),
        completeSideEffect: onActionComplete,
      });
    };
    const createRestActionAffectingManyItems = (
      verb,
      callback,
      { onActionComplete },
    ) => {
      const applyResultToValue =
        verb === "GET"
          ? (result) => {
              // GET_MANY contract (see .many() JSDoc): the parent object with
              // the child array nested inside; the array replaces the relationship.
              const item = store.upsert(result);
              const childItemArray = item[propertyName];
              return childItemArray.map((childItem) => childItem[childIdKey]);
            }
          : verb === "DELETE"
            ? ([itemIdOrMutableId, childItemIdOrMutableIdArray]) => {
                const item = store.select(itemIdOrMutableId);
                const childItemArray = item[propertyName];
                const deletedChildItemSet = new Set(
                  childStore.selectAll(childItemIdOrMutableIdArray),
                );
                const deletedChildItemIdArray = [];
                const childItemArrayWithoutThose = [];
                for (const childItemCandidate of childItemArray) {
                  if (deletedChildItemSet.has(childItemCandidate)) {
                    deletedChildItemIdArray.push(
                      childItemCandidate[childIdKey],
                    );
                  } else {
                    childItemArrayWithoutThose.push(childItemCandidate);
                  }
                }
                if (deletedChildItemIdArray.length > 0) {
                  store.upsert({
                    [idKey]: item[idKey],
                    [propertyName]: childItemArrayWithoutThose,
                  });
                }
                return deletedChildItemIdArray;
              }
            : (childDataArray) => {
                const childItemArray = childStore.upsert(childDataArray);
                return childItemArray.map((childItem) => childItem[childIdKey]);
              };
      const throwInvalidResult = createInvalidResultThrower(
        `${name}.${verb}[many]`,
        declarationSite,
      );
      return createAction(callback, {
        meta: { verb, isMany: true, paramScope },
        name: `${name}.${verb}[many]`,
        dataDefault: [],
        resultToValue: (result, action) => {
          if (verb === "GET") {
            if (!isProps(result)) {
              throwInvalidResult(
                action.name,
                `an object (that will be used to upsert "${name}" resource with many relationships)`,
                result,
              );
            }
          } else if (verb === "DELETE") {
            if (
              !Array.isArray(result) ||
              result.length !== 2 ||
              !Array.isArray(result[1])
            ) {
              throwInvalidResult(
                action.name,
                `an array [itemId, childItemIdArray] (that will be used to remove relationships)`,
                result,
              );
            }
          } else if (!Array.isArray(result)) {
            throwInvalidResult(
              action.name,
              `an array of objects (that will be used to upsert child items)`,
              result,
            );
          }
          return applyResultToValue(result);
        },
        valueToData: (childItemIdArray) =>
          childStore.selectAll(childItemIdArray),
        completeSideEffect: onActionComplete,
      });
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

  /**
   * Attaches a single private sub-object to each item. The child has no identity outside
   * its owner and is not shared across items; each owner gets its own private signal.
   *
   * Use it for a sub-resource the backend exposes under the parent (`/users/:id/profile`)
   * whose content is meaningless without that parent.
   *
   * All callbacks must return `[ownerId, props | null]`:
   * - `GET:    async ({ id }) => [id, { bio: "Hello", avatar: "alice.png" }]`
   * - `PATCH:  async ({ id, bio }) => [id, { bio, avatar: "alice.png" }]`
   * - `DELETE: async ({ id }) => [id, null]`
   *
   * `ownerId` may also be `{ [uniqueKey]: value }` when the owner is known by an alternate key.
   * The property is `null` until a callback provides data; setting it to `null` clears it.
   * Mutations apply directly to the owner's signal, so the parent GET is never rerun.
   *
   * Returns the child relationship resource, itself chainable:
   * `USER_PROFILE.one("theme", THEME)` adds a reactive `.theme` property on each profile.
   *
   * @param {string} propertyName - property holding the sub-object on each owner item
   * @param {Object} [restCallbacks] - `{ idKey, rerunOn, dependencies, GET, POST, PUT, PATCH, DELETE }`
   * @see docs/resource.md
   */
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

    // Callbacks added by chained .one()/.many() on the child resource,
    // applied to each per-owner child object when it is first created.
    const childSetupCallbackSet = new Set();
    const childAddItemSetup = (callback) => childSetupCallbackSet.add(callback);
    const applyPropsMap = new Map(); // ownerId → applyProps(props | null)
    addItemSetup((ownerItem) => {
      const ownerId = ownerItem[idKey];
      // A stable child object, mutated in place: reactive getters/setters from
      // chained .one() etc. are defined on it once and survive prop updates.
      const childItem = {};
      for (const childSetup of childSetupCallbackSet) {
        childSetup(childItem);
      }
      const childSignal = signal(null);
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
      applyPropsMap.set(ownerId, applyProps);

      applyProps(ownerItem[propertyName]);

      Object.defineProperty(ownerItem, propertyName, {
        get: () => childSignal.value,
        set: applyProps,
      });
    });
    const createRestActionForScopedOne = (
      verb,
      callback,
      { onActionComplete },
    ) => {
      const childActionName = `${childName}.${verb}`;
      return createAction(callback, {
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
          const applyProps = applyPropsMap.get(ownerId);
          if (!applyProps) {
            throw new Error(
              `${childActionName}: no item found for scope id "${ownerId}"`,
            );
          }
          applyProps(props);
          return [ownerId, props];
        },
        completeSideEffect: onActionComplete,
      });
    };

    return createResource(childName, {
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
  };

  /**
   * Attaches a private ordered collection of sub-objects to each item. The child objects
   * have no identity outside their owner — two owners can hold items with the same id that
   * are completely independent. Each owner gets its own private arraySignalStore.
   *
   * This is the shape for a backend sub-route (`/games/:id/candidates`,
   * `…/candidates/:userId/accept`) and for a relation carrying its own fields
   * (`candidate_since`, `seen_at`): those fields belong to the pair, not to a shared child
   * store where they would corrupt the entity for every other reader.
   *
   * All callbacks must return `[ownerId, ...rest]`:
   * - `GET_MANY: async ({ id }) => [id, [{ name: "id", type: "int" }, …]]` — replaces the collection
   * - `POST:     async ({ id, name, type }) => [id, { name, type }]`
   * - `PUT:      async ({ id, oldName, name, type }) => [id, oldName, { name, type }]` (id rename)
   * - `DELETE:   async ({ id, name }) => [id, name]`
   * - `*_MANY:   [ownerId, itemArray]` — any plural verb replaces the whole collection,
   *   which is how a backend answering a sub-route with the refreshed parent is absorbed
   *
   * `ownerId` may also be `{ [uniqueKey]: value }` when the owner is known by an alternate key.
   * A singular POST upserts the child but does not append it to the collection; ordering is
   * the backend's, so the owner's GET is rerun instead (only when its last response embedded
   * `propertyName`), and the child's own GET_MANY reruns per its `rerunOn`.
   *
   * Returns the child relationship resource, itself chainable:
   * `TABLE_COLUMNS.one("dataType", DATA_TYPE)` adds a reactive `.dataType` property on each column.
   *
   * @param {string} propertyName - property holding the collection on each owner item
   * @param {Object} [restCallbacks] - `{ idKey, rerunOn, dependencies, GET, GET_MANY, POST, POST_MANY, PUT, PUT_MANY, PATCH, PATCH_MANY, DELETE, DELETE_MANY }`
   * @see docs/resource.md
   */
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

    // Callbacks added by chained .one()/.many() on the child resource,
    // applied to each child item created in a per-owner store.
    const childSetupCallbackSet = new Set();
    const childAddItemSetup = (callback) => childSetupCallbackSet.add(callback);
    // ownerKey (id or any uniqueKey value) → { childStore, idArraySignal }
    // One owner can be registered under several keys, all pointing to the same scope.
    const scopeMap = new Map();
    const createScope = (ownerKey) => {
      const childStore = arraySignalStore([], childIdKey, {
        name: `${childName}#${ownerKey} store`,
        createItem: (props) => {
          const childItem = {};
          Object.assign(childItem, props);
          for (const childSetup of childSetupCallbackSet) {
            childSetup(childItem);
          }
          return childItem;
        },
      });
      const scope = { childStore, idArraySignal: signal([]) };
      scopeMap.set(ownerKey, scope);
      return scope;
    };
    addItemSetup((item) => {
      const ownerId = item[idKey];

      // Reuse an existing scope if one was already created under a uniqueKey
      // value (e.g. rows were fetched by tablename before the full table was loaded).
      let scope = scopeMap.get(ownerId);
      if (!scope) {
        for (const uniqueKey of uniqueKeys) {
          const uniqueKeyValue = item[uniqueKey];
          if (uniqueKeyValue !== undefined && scopeMap.has(uniqueKeyValue)) {
            scope = scopeMap.get(uniqueKeyValue);
            break;
          }
        }
      }
      if (!scope) {
        scope = createScope(ownerId);
      }
      // Register the scope under the id and every uniqueKey value so that
      // resolveOwnerId can address it whichever key a callback returns.
      scopeMap.set(ownerId, scope);
      for (const uniqueKey of uniqueKeys) {
        const uniqueKeyValue = item[uniqueKey];
        if (uniqueKeyValue !== undefined) {
          scopeMap.set(uniqueKeyValue, scope);
        }
      }

      const { childStore, idArraySignal } = scope;
      const updateChildItemIdArray = createChildIdArrayUpdater(
        childStore,
        childIdKey,
        idArraySignal,
      );
      // The parent may not carry the property at all (e.g. created by a POST
      // that does not embed it): leave the collection of a reused scope
      // untouched — children may have been fetched by uniqueKey before the
      // parent was loaded. Only an explicit value replaces the collection.
      if (item[propertyName] !== undefined) {
        updateChildItemIdArray(item[propertyName]);
      }

      // When an id is renamed (PUT/PATCH changes the idKey), patch the id array.
      syncIdArrayOnRename(childStore, childIdKey, idArraySignal);

      const childItemArraySignal = computed(() => {
        const childItemArray = childStore.selectAll(idArraySignal.value);
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
      { isMany, onActionComplete },
    ) => {
      const childActionName = `${childName}.${verb}`;
      return createAction(callback, {
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
          // Owner not in store yet: create the scope so actions can run before
          // the parent item has been loaded (e.g. rows fetched before their table).
          const scope = scopeMap.get(ownerId) || createScope(ownerId);
          const { childStore, idArraySignal } = scope;

          if (verb === "DELETE") {
            if (isMany) {
              const idArray = childStore.drop(rest[0]);
              const toRemoveSet = new Set(idArray);
              idArraySignal.value = idArraySignal
                .peek()
                .filter((id) => !toRemoveSet.has(id));
              return [ownerId, idArray];
            }
            const childId = childStore.drop(rest[0]);
            idArraySignal.value = idArraySignal
              .peek()
              .filter((id) => id !== childId);
            return [ownerId, childId];
          }

          if (isMany) {
            // GET_MANY, POST_MANY, PUT_MANY etc: rest[0] is the array of items,
            // and it replaces the whole collection.
            const itemArray = childStore.upsert(rest[0]);
            const idArray = itemArray.map((childItem) => childItem[childIdKey]);
            idArraySignal.value = idArray;
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
          if (!value) {
            return isMany ? [] : undefined;
          }
          const [ownerId, idOrIdArray] = value;
          const scope = scopeMap.get(ownerId);
          if (!scope) {
            return isMany ? [] : undefined;
          }
          if (isMany) {
            return scope.childStore.selectAll(idOrIdArray);
          }
          return scope.childStore.select(idOrIdArray);
        },
        completeSideEffect: onActionComplete,
      });
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
      paramScope,
      rerunOn: scopedManyRerunOn ?? rerunOn,
      dependencies: scopedManyDependencies ?? dependencies,
    });
    // When a scoped child collection is mutated (POST etc.), the parent GET must
    // re-fetch: the parent embeds the child array and only the backend knows the
    // new ordering. (scopedOne does not need this: the mutation result contains
    // the updated object directly.)
    resourceLifecycleManager.addDependency(
      childResource,
      stateFacade,
      propertyName,
    );
    childResource.getChildStore = (ownerKey) =>
      scopeMap.get(ownerKey)?.childStore;
    return childResource;
  };

  // expose one action (or range reader) per provided rest callback
  for (const [restCallbackKey, restCallback] of Object.entries(restCallbacks)) {
    if (!restCallback) {
      continue;
    }
    if (restCallbackKey === "GET_RANGE") {
      // A range is read, never kept: no action, nothing to rerun — only a
      // signal saying the slices anyone holds are out of date
      // (see resource_range_reader.js).
      stateFacade.GET_RANGE = createRangeReader(
        `${name}.GET_RANGE`,
        applyNetworkPolicy(restCallback, { verb: "GET", isMany: true }),
        { store, params },
      );
      resourceLifecycleManager.registerRangeReader(
        stateFacade,
        stateFacade.GET_RANGE,
      );
      continue;
    }
    const isMany = restCallbackKey.endsWith("_MANY");
    const verb = isMany
      ? restCallbackKey.replace("_MANY", "")
      : restCallbackKey;
    const restCallbackUnderPolicy = applyNetworkPolicy(restCallback, {
      verb,
      isMany,
      findItemInStore,
    });
    let restAction = createRestAction(verb, restCallbackUnderPolicy, {
      isMany,
      onActionComplete,
      paramScope,
    });
    if (params) {
      restAction = restAction.bindParams(params);
    }
    stateFacade[restCallbackKey] = restAction;
    resourceLifecycleManager.registerAction(stateFacade, restAction);
  }

  return stateFacade;
};

const createRestActionFactoryForRoot = (
  name,
  {
    idKey,
    store, // see array_signal_store.js
    declarationSite,
  },
) => {
  const createActionForRoot = (
    verb,
    restCallback,
    { isMany, onActionComplete, paramScope },
  ) => {
    if (!isMany) {
      return createActionAffectingOneItem(verb, restCallback, {
        onActionComplete,
        paramScope,
      });
    }
    return createActionAffectingManyItems(verb, restCallback, {
      onActionComplete,
      paramScope,
    });
  };
  const createActionAffectingOneItem = (
    verb,
    callback,
    { onActionComplete, paramScope },
  ) => {
    const applyResultToValue =
      verb === "DELETE"
        ? (itemIdOrItemProps) => store.drop(itemIdOrItemProps)
        : (result) => {
            // An array result is [property, value, props] — used to rename the
            // idKey of an item: store.upsert("name", "currentName", { name: "newName" })
            const item = Array.isArray(result)
              ? store.upsert(...result)
              : store.upsert(result);
            return item[idKey];
          };
    const throwInvalidResult = createInvalidResultThrower(
      `${name}.${verb}`,
      declarationSite,
    );
    return createAction(callback, {
      name: `${name}.${verb}`,
      meta: { verb, isMany: false, paramScope },
      resultToValue: (result, action) => {
        if (verb === "DELETE") {
          if (!isProps(result) && !primitiveCanBeId(result)) {
            throwInvalidResult(
              action.name,
              `an object (that will be used to drop "${name}" resource)`,
              result,
            );
          }
          return applyResultToValue(result);
        }
        if (!isProps(result)) {
          throwInvalidResult(
            action.name,
            `an object (that will be used to upsert "${name}" resource)`,
            result,
          );
        }
        // Track which top-level properties the GET response contained so that
        // lifecycle rules can detect whether sub-resources were embedded.
        if (verb === "GET") {
          recordGetResultProperties(action, Object.keys(result));
          const itemId = applyResultToValue(result);
          lastGetItemIdWeakMap.set(action, itemId);
          return itemId;
        }
        return applyResultToValue(result);
      },
      valueToData: (itemId) => store.select(itemId),
      completeSideEffect: onActionComplete,
    });
  };
  const createActionAffectingManyItems = (
    verb,
    callback,
    { onActionComplete, paramScope },
  ) => {
    const applyResultToValue =
      verb === "DELETE"
        ? (idOrMutableIdArray) => store.drop(idOrMutableIdArray)
        : (dataArray) => {
            const itemArray = store.upsert(dataArray);
            return itemArray.map((item) => item[idKey]);
          };

    return createAction(callback, {
      meta: { verb, isMany: true, paramScope },
      name: `${name}.${verb}_MANY`,
      dataDefault: [],
      resultToValue: applyResultToValue,
      valueToData: (idArray) => store.selectAll(idArray),
      completeSideEffect: (actionCompleted) => {
        onActionComplete(actionCompleted);
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
  };

  return createActionForRoot;
};

// Under a network policy no callback is called (see network_policy.js). A GET
// of a root resource answers with the row the store holds for it (see
// findItemInStore) — handing the item back is an upsert without effect, so the
// action completes with what it had and nothing is asked. A relationship GET
// has no row of its own to answer with, and a write has nothing to answer:
// both settle with an OfflineError carrying the policy's reason. A completed
// GET asked to rerun never gets here (actions.js holds it).
const applyNetworkPolicy = (
  restCallback,
  { verb, isMany, findItemInStore },
) => {
  return (params, context) => {
    const reason = peekNetworkPolicyReason();
    if (reason === null) {
      return restCallback(params, context);
    }
    if (verb === "GET" && !isMany && findItemInStore) {
      const item = findItemInStore(params, context.action);
      if (item) {
        return item;
      }
    }
    throw new OfflineError(reason);
  };
};

// WeakMap<action, itemId> — the row each GET action last completed with. A
// reset clears the action's value; this survives it, so a GET run again after
// a reset can still be answered from the store under a network policy.
const lastGetItemIdWeakMap = new WeakMap();
const getLastGetItemId = (action) => {
  return lastGetItemIdWeakMap.get(action);
};

// Captures the "file:line:column" of the user code that invoked the public
// function (resource(), .one(), .many(), withParams, …), so invalid-result
// errors can point at where the callbacks were declared, not at this file.
// Must be called directly from the public function: the stack offset accounts
// for exactly two frames (getCallerInfo → getDeclarationSite → public fn → user code).
const getDeclarationSite = () => {
  const callerInfo = getCallerInfo(null, 1);
  if (callerInfo.file && callerInfo.line && callerInfo.column) {
    return `${callerInfo.file}:${callerInfo.line}:${callerInfo.column}`;
  }
  return callerInfo.raw || "unknown location";
};

const createInvalidResultThrower = (originalActionName, declarationSite) => {
  return (actionLabel, expected, result) => {
    throw new TypeError(
      `${actionLabel} must return ${expected}, received ${result}.
${originalActionName} source location: ${declarationSite}`,
    );
  };
};

// Shared by .many() and .scopedMany(): converts a raw relationship value (an
// array of child props/ids, or anything else meaning "empty") into an array of
// child ids, upserting each entry into the child store. The id array signal is
// only touched when the resulting ids actually differ.
const createChildIdArrayUpdater = (childStore, childIdKey, idArraySignal) => {
  return (valueArray) => {
    const currentIdArray = idArraySignal.peek();
    if (!Array.isArray(valueArray)) {
      if (currentIdArray.length > 0) {
        idArraySignal.value = [];
      }
      return;
    }
    const idArray = [];
    let modified = false;
    for (const value of valueArray) {
      let childItemProps;
      if (isProps(value)) {
        childItemProps = value;
      } else if (primitiveCanBeId(value)) {
        childItemProps = { [childIdKey]: value };
      } else {
        continue;
      }
      const childItem = childStore.upsert(childItemProps);
      const childItemId = childItem[childIdKey];
      if (currentIdArray[idArray.length] !== childItemId) {
        modified = true;
      }
      idArray.push(childItemId);
    }
    if (modified || currentIdArray.length !== idArray.length) {
      idArraySignal.value = idArray;
    }
  };
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

/**
 * Keeps external signals in sync with properties of the resource's store items:
 * when a tracked property changes on an item, the corresponding signal is
 * updated automatically.
 *
 * Since signals are typically connected to route parameters via the route template
 * syntax, this keeps the URL in sync when a store item's mutable key is renamed.
 *
 * @example
 * const usernameSignal = stateSignal();
 * const USER_ROUTE = route(`/users/:username=${usernameSignal}/`);
 *
 * const USER = resource("user", {
 *   idKey: "id",
 *   uniqueKeys: ["username"],
 *   PUT: async ({ id, username }) => ({ id, username }),
 * });
 *
 * syncResourceToSignals(USER, { username: usernameSignal });
 * // Now when a user item's username is updated via USER.PUT,
 * // usernameSignal.value is set to the new username,
 * // which in turn triggers the route Signal->URL sync and updates the browser URL.
 */
export const syncResourceToSignals = (resource, propertyToSignalMap) => {
  if (resource.getChildStore) {
    throw new Error(
      `syncResourceToSignals: "${resource.name}" is a scoped resource (scopedMany/scopedOne). Use syncOwnedResourceToSignals instead.`,
    );
  }
  syncStoreToSignals(resource.store, propertyToSignalMap);
};

export const syncOwnedResourceToSignals = (
  resource,
  ownerSignal,
  propertyToSignalMap,
) => {
  if (!resource.getChildStore) {
    throw new Error(
      `syncOwnedResourceToSignals: "${resource.name}" is not a scoped resource (scopedMany/scopedOne). Use syncResourceToSignals instead.`,
    );
  }
  effect(() => {
    // Always subscribe to the parent store so the effect re-runs when a new
    // owner item is added (which creates the child store).
    // eslint-disable-next-line no-unused-expressions
    resource.store.arraySignal.value;
    const ownerKey = ownerSignal.value;
    if (ownerKey === null || ownerKey === undefined) {
      return null;
    }
    const childStore = resource.getChildStore(ownerKey);
    if (!childStore) {
      return null;
    }
    const cleanup = syncStoreToSignals(childStore, propertyToSignalMap);
    return cleanup;
  });
};

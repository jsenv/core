import { computed, effect, signal, untracked } from "@preact/signals";

import {
  createAction,
  setActionDependenciesRegistrar,
} from "../../action/actions.js";
import {
  NetworkPolicyError,
  peekNetworkPolicy,
} from "../../action/network_policy.js";
import { SYMBOL_OBJECT_SIGNAL } from "../../action/symbol_object_signal.js";
import { SYMBOL_IDENTITY } from "../../utils/compare_two_js_values.js";
import { getCallerInfo } from "../../utils/get_caller_info.js";
import { warnUnknownOptions } from "../../utils/warn_unknown_options.js";
import {
  arraySignalStore,
  primitiveCanBeId,
  syncStoreToSignals,
} from "./array_signal_store.js";
import {
  createResourceLifecycleManager,
  recordGetResultProperties,
  resolveRerunOn,
} from "./item_lifecycle_manager.js";
import {
  getKeptReadKey,
  isKeepableRead,
  markKeepableRead,
  takeKeptRead,
  upsertKeptItem,
} from "./kept_reads.js";
import { getParamScope } from "./param_scope.js";
import { createResourcePersistence } from "./resource_persist.js";
import { createRangeReader } from "./resource_range_reader.js";

const resourceLifecycleManager = createResourceLifecycleManager();
// A plain action following writes (createAction's `dependencies`) is followed
// by the same manager the resources are.
setActionDependenciesRegistrar(
  resourceLifecycleManager.registerActionDependencies,
);

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
 *   resources chainable: a relation declared on one attaches to its items.
 *   Those of a `.one()`/`.many()` resource are the child resource's own, so it
 *   is handed the child's store and `addItemSetup`; a scoped child is handed
 *   an `addItemSetup` applied to each per-owner child item. A scoped child has
 *   no single store of its items (its `store` is the owner's), and its item
 *   ids are unique only inside their owner, so a relation chained on it is
 *   refused the callbacks whose result names the parent item — that result
 *   cannot say which owner holds the item (see
 *   refuseCallbacksNamingScopedItem) — and a scoped relation on it keeps one
 *   scope per item rather than per id. `withParams()` recurses with the
 *   resource's own `createRestAction`: a scope of a relation writes as that
 *   relation does.
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

const RESOURCE_OPTIONS = new Set([
  "idKey",
  "uniqueKeys",
  "rerunOn",
  "dependencies",
  "persist",
  "writes",
  "GET",
  "GET_MANY",
  "GET_RANGE",
  "POST",
  "POST_MANY",
  "PUT",
  "PUT_MANY",
  "PATCH",
  "PATCH_MANY",
  "DELETE",
  "DELETE_MANY",
]);
const SCOPED_ONE_OPTIONS = new Set([
  "idKey",
  "rerunOn",
  "dependencies",
  "writes",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);
const SCOPED_MANY_OPTIONS = new Set([
  "idKey",
  "rerunOn",
  "dependencies",
  "writes",
  "GET",
  "GET_MANY",
  "POST",
  "POST_MANY",
  "PUT",
  "PUT_MANY",
  "PATCH",
  "PATCH_MANY",
  "DELETE",
  "DELETE_MANY",
]);
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
 * An action's `data` is `undefined` until its callback has answered once, plural verbs
 * included; `[]` is what an empty answer looks like (see docs/data_states.md).
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
 * @param {Object} restCallbacks - `{ idKey, uniqueKeys, rerunOn, dependencies, persist, writes, GET, GET_MANY, GET_RANGE, POST, POST_MANY, PUT, PUT_MANY, PATCH, PATCH_MANY, DELETE, DELETE_MANY }`
 * @param {string} [restCallbacks.idKey] - primary key property, defaults to `"id"`
 * @param {string[]} [restCallbacks.uniqueKeys] - alternate keys the store can find an item by (e.g. `"username"`)
 * @param {Array<Object | { resource: Object, on?: string[], reads?: Array<"GET" | "GET_MANY" | "GET_RANGE"> }> | (() => Array<Object | { resource: Object, on?: string[], reads?: Array<"GET" | "GET_MANY" | "GET_RANGE"> }>)} [restCallbacks.dependencies] -
 *   resources whose writes rerun this one's reads: one listed bare counts every
 *   write, `{ resource, on: ["PATCH_MANY", "DELETE"] }` only the callbacks it
 *   names (`PATCH` is not `PATCH_MANY`), a write named in its `writes`
 *   included. A heard write reruns every completed `GET` and `GET_MANY` and
 *   invalidates the `GET_RANGE` readers; `reads: ["GET_RANGE"]` narrows that to
 *   the reads it names (with no `on`, after every write). A function returning
 *   that list names resources declared after this one (two resources depending
 *   on each other): it is called once, before the first request of any
 *   resource leaves
 * @param {Record<string, { verb: "POST" | "PUT" | "PATCH" | "DELETE", callback: Function, rerunOn?: { GET?: boolean, GET_MANY?: boolean, GET_RANGE?: boolean } }>} [restCallbacks.writes] -
 *   the writes on an item that are not its sub-objects — cancel, archive, mark
 *   as seen — one action each, exposed under its name (`ORDER.cancel`) beside
 *   the verbs. Each answers as its `verb` does (a `PATCH` returns the item and
 *   it is upserted, a `DELETE` its id and it is dropped), is held by the network
 *   policy as that verb, and is a write of its own for a dependent:
 *   `{ resource: ORDER, on: ["cancel"] }`. Its `rerunOn` says which reads of
 *   this resource it reruns (`{ GET_RANGE: true }`); a read it leaves out
 *   follows `rerunOn` for its verb. A name a verb takes, or one the resource
 *   already exposes (`withParams`, `store`…), throws. A `.scopedOne()` or
 *   `.scopedMany()` takes `writes` too, `.scopedMany()` with the plural verbs.
 * @param {{ signal: import("@preact/signals").Signal, when?: () => boolean }} [restCallbacks.persist] -
 *   mirrors the rows `GET` lands with into `signal` — a `stateSignal` with
 *   `persists: true` and `type: "object"` keeps them across a reload, whose
 *   first `GET` run then draws the last known row while the request is out (a
 *   refresh, not a first load — see docs/data_states.md); the request goes out
 *   as usual and its answer replaces the row. The copy follows the store: a
 *   `PUT`, a list upserting a child, a relation changing rewrite it. Put
 *   whatever makes a stored copy unusable in the signal's `id` (the deployed
 *   version, say): a new id starts clean. `when` is read whenever the copy is
 *   about to be read or written: `false` neither reads it nor writes it, and
 *   empties the signal. Writing `undefined` into the signal (sign-out) forgets
 *   the copy until a `GET` lands again. One row is kept per params the GET was
 *   asked with, so it is meant for a singleton or a handful of rows, not for a
 *   resource whose GET is asked for every id.
 * @see docs/resource.md — relationships, callback return contracts, decision table
 *
 * @example
 * const USER = resource("user", {
 *   GET: ({ id }) => fetchJson(`/users/${id}`),
 *   GET_MANY: () => fetchJson(`/users`),
 *   POST: (user) => fetchJson(`/users`, { method: "POST", body: user }),
 *   DELETE: ({ id }) => fetchJson(`/users/${id}`, { method: "DELETE" }),
 * });
 *
 * @example
 * const ORDER = resource("order", {
 *   GET,
 *   writes: {
 *     cancel: { verb: "PATCH", callback: ({ id }) => post(`/orders/${id}/cancel`) },
 *     archive: { verb: "PATCH", callback: archiveOrder, rerunOn: { GET_RANGE: true } },
 *   },
 * });
 * <Button action={ORDER.cancel.bindParams({ id })}>Cancel</Button>
 */
export const resource = (name, restCallbacks = {}) => {
  const {
    // configuration options
    idKey = "id",
    uniqueKeys = [],
    rerunOn,
    dependencies,
    persist,
    writes,

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
  } = restCallbacks;
  if (import.meta.dev) {
    warnUnknownOptions(`resource(${name})`, restCallbacks, RESOURCE_OPTIONS);
  }
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
  const persistence = persist
    ? createResourcePersistence(store, { idKey, name, ...persist })
    : null;
  // The row a GET designates, when the store already holds it — by its params:
  // the value under idKey may be the id or any unique key (a route opening a
  // user by id or by slug names both `id`), and a unique key may be given under
  // its own name, or, on a persisted resource, as the row kept for these
  // params (a GET without params has one row). findItemForGet is what a GET
  // draws while its request is in flight (the action's provisionalValue).
  // findItemInStore adds, when the params name no row (a GET without params,
  // or whose params carry no key), the row the action last completed with:
  // that fallback answers a GET under a network policy (see
  // applyNetworkPolicy) and only there — a GET of a row the store lacks must
  // draw its skeleton, never the row read just before.
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
  const findItemForGet = (params) => {
    const itemByParams = findItemByParams(params);
    if (itemByParams) {
      return itemByParams;
    }
    if (persistence) {
      return persistence.findItem(params);
    }
    return null;
  };
  const findItemInStore = (params, action) => {
    return untracked(() => {
      const itemForGet = findItemForGet(params);
      if (itemForGet) {
        return itemForGet;
      }
      const lastItemId = getLastGetItemId(action);
      if (lastItemId === undefined) {
        return null;
      }
      return store.select(lastItemId) || null;
    });
  };
  const createRestActionForRoot = createRestActionFactoryForRoot(name, {
    idKey,
    store,
    findItemForGet,
    persistence,
    declarationSite,
  });
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
    rerunOn: resolveRerunOn(rerunOn),
    dependencies,
    writes,
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
    // The writes named in `writes`: a root resource, a scoped relation and
    // their withParams() scopes have them, a `.one()`/`.many()` does not.
    writes,
    namedWriteVerbs = NAMED_WRITE_VERBS,
    // Set on a scoped child: the resource owning each of its items, which
    // live in one store per owner (`store` is the owner's).
    ownerName,
    // Set on a scopedMany child: its per-owner store looked up by owner key,
    // and the owner whose GET embeds the collection. Options rather than
    // properties added afterwards, so every facade of the relation — the one
    // scopedMany returns and each withParams() of it — carries both.
    getChildStore,
    ownerDependency,
  },
) => {
  const params = paramScope.params;
  const stateFacade = {
    // public
    name,
    idKey,
    uniqueKeys,

    // Reactive reads, not hooks: nothing hook-shaped inside, so a loop or a
    // condition is fine. Each subscribes the render that calls it to what it
    // returns: the rows asked for, each through a computed of that row (see
    // itemSignalForId in array_signal_store.js), or the whole store for
    // `useArray` — a card reading its own row stays still while the page next
    // to it loads rows of its own. `useAllByIds` skips the ids the store does
    // not hold.
    useArray: () => store.arraySignal.value,
    useById: (id) => store.itemSignalForId(id).value,
    useAllByIds: (idArray) => {
      const items = [];
      for (const idOrProps of idArray) {
        let id = idOrProps;
        if (isProps(idOrProps) && !Object.hasOwn(idOrProps, idKey)) {
          // Named by a unique key: which row that is can only be read off
          // the whole store.
          const item = store.select(idOrProps);
          id = item ? item[idKey] : undefined;
        } else if (isProps(idOrProps)) {
          id = idOrProps[idKey];
        }
        const item = store.itemSignalForId(id).value;
        if (item) {
          items.push(item);
        }
      }
      return items;
    },

    withParams: undefined,
    one: undefined,
    many: undefined,
    scopedOne: undefined,
    scopedMany: undefined,

    // private but exposed for convenience
    store,
    addItemSetup,
    ownerName,
    getChildStore,
  };

  resourceLifecycleManager.registerResource(stateFacade, {
    rerunOn,
    paramScope,
    dependencies,
    uniqueKeys,
  });
  if (ownerDependency) {
    // A child collection mutated (POST etc.) makes the owner GET re-fetch:
    // the owner embeds the child array and only the backend knows the new
    // ordering. Registered per facade, since the rerun is looked up by the
    // facade whose action completed.
    resourceLifecycleManager.addDependency(
      stateFacade,
      ownerDependency.owner,
      ownerDependency.propertyName,
    );
  }
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
   * The actions are the resource's own kind: on a relation they keep its callback return
   * contract and write where it writes (`TABLE_COLUMNS.withParams(…).GET_MANY` returns
   * `[ownerId, items]` and replaces that owner's collection).
   *
   * @param {Object} params - Parameters to bind to all actions of this resource (required)
   * @param {{ rerunOn?: Object, dependencies?: Object[] }} [options] - reruns of that scope; a `rerunOn` key left out keeps the resource's value, and `dependencies` left out are the resource's
   * @returns {Object} A new resource instance with parameter-bound actions and isolated lifecycle
   * @see docs/resource.md — what a scope isolates, and `dependencies`
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
   * // ROLE_WITH_OWNERSHIP.GET_MANY reruns after any write (POST/PUT/PATCH/DELETE) on a role, a database or a table
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
    return createResource(name, {
      idKey,
      uniqueKeys,
      findItemInStore,
      restCallbacks,
      store,
      addItemSetup,
      // The actions of this resource's kind: a relation applies its results to
      // its relation (a scoped child to the per-owner stores), never as root
      // items of `store`.
      createRestAction,
      paramScope: resolvedParamScope,
      rerunOn: resolveRerunOn(withParamsRerunOn, rerunOn),
      dependencies: withParamsDeps ?? dependencies,
      writes,
      namedWriteVerbs,
      ownerName,
      getChildStore,
      ownerDependency,
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
   * - DELETE → the parent id, or `{ id }`; the property is set to `null`
   *
   * The backend may also embed the child inline in a parent GET/POST response — the
   * setter on the property upserts the nested object into the child store.
   *
   * Returns the relationship resource, itself chainable. Its items are the child
   * resource's own, shared by every parent: `USER_SESSION.one("device", DEVICE)`
   * adds a reactive `.device` property to every session, as
   * `SESSION.one("device", DEVICE)` would.
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
    if (ownerName) {
      refuseCallbacksNamingScopedItem(
        `${name}.one("${propertyName}")`,
        { GET, PUT, DELETE },
        { name, ownerName, propertyName, declarationSite },
      );
    }
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

    const createRestActionForOne = (
      verb,
      callback,
      { onActionComplete, paramScope },
    ) => {
      const applyResultToValue =
        verb === "DELETE"
          ? (itemIdOrItemProps) => {
              const item = store.select(itemIdOrItemProps);
              const childItemId = item[propertyName][childIdKey];
              store.upsert({
                [idKey]: item[idKey],
                [propertyName]: null,
              });
              return childItemId;
            }
          : // GET/PUT contract (see .one() JSDoc): the parent object with the
            // relationship nested inside, or null for no relationship.
            (result) => {
              const item = store.upsertAnswer(result);
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
                `the "${name}" id, or { ${idKey} } (the item whose "${propertyName}" becomes null)`,
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
      store: childStore,
      addItemSetup: childResource.addItemSetup,
      createRestAction: createRestActionForOne,
      paramScope,
      rerunOn: resolveRerunOn(oneRerunOn, rerunOn),
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
   *   but does NOT join the parent's array
   * - POST → also `[parentId, child]`: the child is upserted AND appended to the
   *   parent's array, once (putting someone in a group). A POST creates, so an array
   *   never renames there, as it does for GET / PUT / PATCH (`[oldId, props]`)
   * - POST_MANY / PUT_MANY / PATCH_MANY → an array of child objects, upserted only; or
   *   `[parentId, [child, …]]`, which also replaces the parent's array, as GET_MANY's
   *   parent does (a route answering the whole membership). A child is an object, never
   *   an array, so the two cannot be confused
   * - DELETE → `[parentId, childId]`
   * - DELETE_MANY → `[parentId, [childId, childId, …]]`
   *
   * A parent the store does not hold is left alone: its array comes with its next read.
   * Declared on a scoped child, the forms naming the parent throw: a scoped item's id
   * does not say which owner holds it.
   *
   * Returns the relationship resource, itself chainable; its items are the child
   * resource's own, as for `.one()`.
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
    if (ownerName) {
      refuseCallbacksNamingScopedItem(
        `${name}.many("${propertyName}")`,
        { GET_MANY, DELETE, DELETE_MANY },
        { name, ownerName, propertyName, declarationSite },
      );
    }
    const childStore = childResource.store;
    const childIdKey = childResource.idKey;
    const childName = `${name}.${propertyName}`;
    // Declared on a scoped child, the answers naming the parent cannot say
    // which owner holds it (see refuseCallbacksNamingScopedItem); which form
    // a callback answers is only known once it has.
    const throwJoinOnScopedItem = (actionName) => {
      throw new TypeError(
        `${actionName} returned [itemId, …]: a "${name}" item exists only inside its "${ownerName}", and its id does not say which "${ownerName}" holds it.
Return the child alone, and "${propertyName}" embedded in what the "${name}" callbacks return.
${name}.many("${propertyName}") source location: ${declarationSite}`,
      );
    };
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
      { isMany, onActionComplete, paramScope },
    ) => {
      if (!isMany) {
        return createRestActionAffectingOneItem(verb, callback, {
          onActionComplete,
          paramScope,
        });
      }
      return createRestActionAffectingManyItems(verb, callback, {
        onActionComplete,
        paramScope,
      });
    };
    const createRestActionAffectingOneItem = (
      verb,
      callback,
      { onActionComplete, paramScope },
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
          : verb === "POST"
            ? (childData) => {
                if (!Array.isArray(childData)) {
                  return childStore.upsertAnswer(childData)[childIdKey];
                }
                const [itemId, childProps] = childData;
                const childItem = childStore.upsertAnswer(childProps);
                joinParentArray(itemId, childItem);
                return childItem[childIdKey];
              }
            : (childData) => {
                // an array is [property, value, props] or [oldId, props], used to rename the child id
                const childItem = Array.isArray(childData)
                  ? childStore.upsertAnswer(...childData)
                  : childStore.upsertAnswer(childData);
                return childItem[childIdKey];
              };
      const joinParentArray = (itemId, childItem) => {
        const item = store.select(itemId);
        if (!item) {
          return;
        }
        const childItemArray = item[propertyName];
        const childItemId = childItem[childIdKey];
        for (const childItemCandidate of childItemArray) {
          if (childItemCandidate[childIdKey] === childItemId) {
            return;
          }
        }
        store.upsert({
          [idKey]: item[idKey],
          [propertyName]: [...childItemArray, childItem],
        });
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
          } else if (verb === "POST" && Array.isArray(result)) {
            if (
              result.length !== 2 ||
              !isProps(result[1]) ||
              Array.isArray(result[1])
            ) {
              throwInvalidResult(
                action.name,
                `the child object, or an array [itemId, child] (the child joining the "${propertyName}" of that item)`,
                result,
              );
            }
            if (ownerName) {
              throwJoinOnScopedItem(action.name);
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
      { onActionComplete, paramScope },
    ) => {
      const applyResultToValue =
        verb === "GET"
          ? (result) => {
              // GET_MANY contract (see .many() JSDoc): the parent object with
              // the child array nested inside; the array replaces the relationship.
              const item = store.upsertAnswer(result);
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
            : (result) => {
                if (!isParentAnswer(result)) {
                  const childItemArray = childStore.upsertAnswer(result);
                  return childItemArray.map(
                    (childItem) => childItem[childIdKey],
                  );
                }
                const [itemId, childDataArray] = result;
                const childItemArray = childStore.upsertAnswer(childDataArray);
                const item = store.select(itemId);
                if (item) {
                  store.upsert({
                    [idKey]: item[idKey],
                    [propertyName]: childItemArray,
                  });
                }
                return childItemArray.map((childItem) => childItem[childIdKey]);
              };
      const throwInvalidResult = createInvalidResultThrower(
        `${name}.${verb}[many]`,
        declarationSite,
      );
      return createAction(callback, {
        meta: { verb, isMany: true, paramScope },
        name: `${name}.${verb}[many]`,
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
              `an array of objects (that will be used to upsert child items), or [itemId, childArray] (replacing the "${propertyName}" of that item)`,
              result,
            );
          } else if (ownerName && isParentAnswer(result)) {
            throwJoinOnScopedItem(action.name);
          }
          return applyResultToValue(result);
        },
        // Before the first answer there is no id array; the data is then
        // undefined so a screen can tell "not asked yet" from "answered: none".
        valueToData: (childItemIdArray) =>
          childItemIdArray === undefined
            ? undefined
            : childStore.selectAll(childItemIdArray),
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
      store: childStore,
      addItemSetup: childResource.addItemSetup,
      createRestAction: createRestActionForMany,
      paramScope,
      rerunOn: resolveRerunOn(manyRerunOn, rerunOn),
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
   * Mutations apply directly to the owner's signal, so the parent GET is never rerun; an
   * owner the store does not hold yet is left alone, its child comes with its next read.
   *
   * Returns the child relationship resource, itself chainable:
   * `USER_PROFILE.one("theme", THEME)` adds a reactive `.theme` property on each profile,
   * fed by what this resource's callbacks embed (`[id, { bio, theme: { id: 3 } }]`). A
   * profile exists only inside its user, so the chained relation declares none of the
   * callbacks whose result names a profile (`.one()` GET/PUT/DELETE, `.many()`
   * GET_MANY/DELETE/DELETE_MANY, any `.scopedOne()`/`.scopedMany()` callback): such a
   * result cannot say which user holds it, and the declaration throws.
   *
   * Writes named in `writes` take the root's rules (see `resource()`): one action each
   * under its name, answering `[ownerId, props | null]` as its `verb` does.
   *
   * @param {string} propertyName - property holding the sub-object on each owner item
   * @param {Object} [restCallbacks] - `{ idKey, rerunOn, dependencies, writes, GET, POST, PUT, PATCH, DELETE }`
   * @see docs/resource.md
   */
  stateFacade.scopedOne = (propertyName, scopedOneOptions = {}) => {
    const relationLabel = `${name}.scopedOne("${propertyName}")`;
    if (import.meta.dev) {
      warnUnknownOptions(relationLabel, scopedOneOptions, SCOPED_ONE_OPTIONS);
    }
    const {
      idKey: childIdKey = "id",
      rerunOn: scopedOneRerunOn,
      dependencies: scopedOneDependencies,
      writes: scopedOneWrites,

      GET,
      POST,
      PUT,
      PATCH,
      DELETE,
    } = scopedOneOptions;
    const declarationSite = getDeclarationSite();
    if (ownerName) {
      refuseCallbacksNamingScopedItem(
        relationLabel,
        { GET, POST, PUT, PATCH, DELETE, ...scopedOneWrites },
        { name, ownerName, propertyName, declarationSite },
      );
    }
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
      // The child keeps its identity while its props change, so the owner's
      // getter also reads this version, bumped by each change in place:
      // whichever way the props came in — the owner's row, a write of this
      // relation, `owner[propertyName] = …` — whoever reads the child sees it.
      const childVersionSignal = signal(0);
      // Returns whether the child changed — what the store asks a relation
      // (see assign in array_signal_store.js).
      const applyProps = (props) => {
        if (!props) {
          if (childSignal.peek() === null) {
            return false;
          }
          childSignal.value = null;
          return true;
        }
        let changed = false;
        // Assign each prop in place. Reactive setters (from chained .one()
        // etc.) fire, and say whether their relation changed.
        for (const [key, value] of Object.entries(props)) {
          const descriptor = Object.getOwnPropertyDescriptor(childItem, key);
          if (descriptor && descriptor.set) {
            if (descriptor.set.call(childItem, value)) {
              changed = true;
            }
          } else if (childItem[key] !== value) {
            childItem[key] = value;
            changed = true;
          }
        }
        if (childSignal.peek() !== childItem) {
          childSignal.value = childItem; // first activation: null → childItem
          return true;
        }
        if (changed) {
          childVersionSignal.value = childVersionSignal.peek() + 1;
        }
        return changed;
      };
      if (!ownerName) {
        // Declared on a scoped child, an owner id is only unique inside its
        // own owner and no callback addresses it (see
        // refuseCallbacksNamingScopedItem): nothing is looked up by it.
        applyPropsMap.set(ownerId, applyProps);
      }

      applyProps(ownerItem[propertyName]);

      Object.defineProperty(ownerItem, propertyName, {
        get: () => {
          // eslint-disable-next-line no-unused-expressions
          childVersionSignal.value;
          return childSignal.value;
        },
        set: applyProps,
      });
    });
    const createRestActionForScopedOne = (
      verb,
      callback,
      { onActionComplete, paramScope, writeName, writeRerunOn },
    ) => {
      const childActionName = `${childName}.${writeName || verb}`;
      return createAction(callback, {
        name: childActionName,
        meta: writeName
          ? { verb, isMany: false, paramScope, writeName, writeRerunOn }
          : { verb, isMany: false, paramScope },
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
          // An owner the store does not hold yet is left alone, as `.many()`
          // leaves a parent: the server wrote, and the owner's next read
          // brings its child.
          const applyProps = applyPropsMap.get(ownerId);
          if (applyProps) {
            applyProps(props);
          }
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
      rerunOn: resolveRerunOn(scopedOneRerunOn, rerunOn),
      dependencies: scopedOneDependencies ?? dependencies,
      writes: scopedOneWrites,
      ownerName: name,
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
   * `propertyName`), and the child's own GET_MANY reruns per its `rerunOn`. A `*_MANY`
   * answer is the collection: the owner's GET is not rerun.
   *
   * What the collection arrives in — a `*_MANY` answer, an owner answer embedding
   * `propertyName` — sets each child to what it received: a field the held child has and
   * the answer lacks becomes `undefined` (a seat changing hands keeps nothing of whoever sat
   * there), a relation chained on the child is left alone. A singular answer
   * (`[ownerId, props]`) merges into the child, as it may carry a part of it.
   *
   * A sub-collection with several writes (add, move, remove a seat) names them in
   * `writes`, with the root's rules (see `resource()`): one action each under its name,
   * answered as its `verb` is — the plural verbs included, so a write whose route answers
   * the whole owner returns `[ownerId, items]` and replaces the collection without
   * rerunning anything:
   * `writes: { add: { verb: "POST_MANY", callback: async (body) => [ownerId, items] } }`.
   *
   * Returns the child relationship resource, itself chainable:
   * `TABLE_COLUMNS.one("dataType", DATA_TYPE)` adds a reactive `.dataType` property on each column,
   * fed by what this resource's callbacks embed (`[id, [{ name, dataType: { id: 2 } }]]`). A
   * column exists only inside its table — two tables can each have an `email` — so the chained
   * relation declares none of the callbacks whose result names a column (`.one()`
   * GET/PUT/DELETE, `.many()` GET_MANY/DELETE/DELETE_MANY, any `.scopedOne()`/`.scopedMany()`
   * callback): such a result cannot say which table holds it, and the declaration throws.
   * A `.scopedMany()` chained on it keeps one collection per column: `users.email` and
   * `admins.email` never share one.
   *
   * @param {string} propertyName - property holding the collection on each owner item
   * @param {Object} [restCallbacks] - `{ idKey, rerunOn, dependencies, writes, GET, GET_MANY, POST, POST_MANY, PUT, PUT_MANY, PATCH, PATCH_MANY, DELETE, DELETE_MANY }`
   * @see docs/resource.md
   */
  stateFacade.scopedMany = (propertyName, scopedManyOptions = {}) => {
    const relationLabel = `${name}.scopedMany("${propertyName}")`;
    if (import.meta.dev) {
      warnUnknownOptions(relationLabel, scopedManyOptions, SCOPED_MANY_OPTIONS);
    }
    const {
      idKey: childIdKey = "id",
      rerunOn: scopedManyRerunOn,
      dependencies: scopedManyDependencies,
      writes: scopedManyWrites,

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
    } = scopedManyOptions;
    const declarationSite = getDeclarationSite();
    if (ownerName) {
      refuseCallbacksNamingScopedItem(
        relationLabel,
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
          ...scopedManyWrites,
        },
        { name, ownerName, propertyName, declarationSite },
      );
    }
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
      return { childStore, idArraySignal: signal([]) };
    };
    addItemSetup((item) => {
      const ownerId = item[idKey];
      let scope;
      if (ownerName) {
        // The owner is itself a scoped child: its id is only unique inside its
        // own owner, so the scope is the item's alone, never looked up by id
        // (no callback addresses it, see refuseCallbacksNamingScopedItem).
        scope = createScope(ownerId);
      } else {
        // Reuse an existing scope if one was already created under a uniqueKey
        // value (e.g. rows were fetched by tablename before the full table was loaded).
        scope = scopeMap.get(ownerId);
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
      }

      const { childStore, idArraySignal } = scope;
      const updateChildItemIdArray = createChildIdArrayUpdater(
        childStore,
        childIdKey,
        idArraySignal,
        { wholeChildren: true },
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
      { isMany, onActionComplete, paramScope, writeName, writeRerunOn },
    ) => {
      const childActionName = `${childName}.${writeName || verb}`;
      return createAction(callback, {
        name: childActionName,
        meta: writeName
          ? { verb, isMany, paramScope, writeName, writeRerunOn }
          : { verb, isMany, paramScope },
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
          let scope = scopeMap.get(ownerId);
          if (!scope) {
            scope = createScope(ownerId);
            scopeMap.set(ownerId, scope);
          }
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
            // and it replaces the whole collection, each child included.
            const itemArray = childStore.upsertAnswer(
              rest[0].map((childProps) =>
                isProps(childProps)
                  ? toWholeScopedChild(childStore, childIdKey, childProps)
                  : childProps,
              ),
            );
            const idArray = itemArray.map((childItem) => childItem[childIdKey]);
            idArraySignal.value = idArray;
            return [ownerId, idArray];
          }

          // GET, POST, PUT, PATCH: rest may be [props] or [oldId, props] for renames
          const childItem =
            rest.length > 1
              ? childStore.upsertAnswer(...rest)
              : childStore.upsertAnswer(rest[0]);
          return [ownerId, childItem[childIdKey]];
        },
        valueToData: (value) => {
          if (!value) {
            return undefined;
          }
          // A value is produced by resultToValue above, which creates the
          // owner's scope when it is missing, and scopes are never dropped.
          const [ownerId, idOrIdArray] = value;
          const { childStore } = scopeMap.get(ownerId);
          if (isMany) {
            return childStore.selectAll(idOrIdArray);
          }
          return childStore.select(idOrIdArray);
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
      rerunOn: resolveRerunOn(scopedManyRerunOn, rerunOn),
      dependencies: scopedManyDependencies ?? dependencies,
      writes: scopedManyWrites,
      namedWriteVerbs: NAMED_WRITE_VERBS_OF_SCOPED_MANY,
      ownerName: name,
      // Declared on a scoped child, the scopes are kept per item and never
      // registered by id (see addItemSetup above): there is no owner key to
      // find one by.
      getChildStore: ownerName
        ? undefined
        : (ownerKey) => scopeMap.get(ownerKey)?.childStore,
      // scopedOne needs no such dependency: its mutation result carries the
      // updated object directly.
      ownerDependency: { owner: stateFacade, propertyName },
    });
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
        readLazyDependenciesFirst(
          applyNetworkPolicy(restCallback, { verb: "GET", isMany: true }),
        ),
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
    const restCallbackUnderPolicy = readLazyDependenciesFirst(
      applyNetworkPolicy(restCallback, {
        verb,
        isMany,
        findItemInStore,
      }),
    );
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

  // expose one action per write named in `writes`
  if (writes) {
    for (const [writeName, write] of Object.entries(writes)) {
      assertWriteCanBeNamed(
        name,
        writeName,
        write,
        stateFacade,
        namedWriteVerbs,
      );
      const { verb: writeVerb, callback, rerunOn: writeRerunOn } = write;
      const isMany = writeVerb.endsWith("_MANY");
      const verb = isMany ? writeVerb.replace("_MANY", "") : writeVerb;
      let writeAction = createRestAction(
        verb,
        readLazyDependenciesFirst(
          applyNetworkPolicy(callback, { verb, isMany }),
        ),
        {
          isMany,
          onActionComplete,
          paramScope,
          writeName,
          writeRerunOn,
        },
      );
      if (params) {
        writeAction = writeAction.bindParams(params);
      }
      stateFacade[writeName] = writeAction;
      resourceLifecycleManager.registerAction(stateFacade, writeAction);
    }
  }

  return stateFacade;
};

const createRestActionFactoryForRoot = (
  name,
  {
    idKey,
    store, // see array_signal_store.js
    findItemForGet,
    persistence,
    declarationSite,
  },
) => {
  const createActionForRoot = (
    verb,
    restCallback,
    { isMany, onActionComplete, paramScope, writeName, writeRerunOn },
  ) => {
    if (!isMany) {
      return createActionAffectingOneItem(verb, restCallback, {
        onActionComplete,
        paramScope,
        writeName,
        writeRerunOn,
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
    { onActionComplete, paramScope, writeName, writeRerunOn },
  ) => {
    // A write named in `writes` answers as its verb does, under its own name.
    const actionName = writeName ? `${name}.${writeName}` : `${name}.${verb}`;
    const applyResultToValue =
      verb === "DELETE"
        ? (itemIdOrItemProps) => store.drop(itemIdOrItemProps)
        : (result) => {
            // An array result is [property, value, props] — used to rename the
            // idKey of an item: store.upsert("name", "currentName", { name: "newName" })
            const item = Array.isArray(result)
              ? store.upsertAnswer(...result)
              : store.upsertAnswer(result);
            return item[idKey];
          };
    const throwInvalidResult = createInvalidResultThrower(
      actionName,
      declarationSite,
    );
    const action = createAction(callback, {
      name: actionName,
      meta: writeName
        ? { verb, isMany: false, paramScope, writeName, writeRerunOn }
        : { verb, isMany: false, paramScope },
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
          if (persistence) {
            persistence.recordGetItem(action.params, itemId);
          }
          return itemId;
        }
        return applyResultToValue(result);
      },
      valueToData: (itemId) => store.select(itemId),
      // While the request is out, the row the store already holds for these
      // params is drawn, or the row the page kept from the previous document
      // (kept_reads.js): the action starts on the "refresh over a known
      // answer" line of data_states.md rather than the first-load one.
      provisionalValue:
        verb === "GET"
          ? (params, action) => {
              const item = untracked(() => {
                const itemForGet = findItemForGet(params);
                if (itemForGet) {
                  return itemForGet;
                }
                const keptItem = takeKeptRead(
                  getKeptReadKey(action.name, params),
                );
                return keptItem ? upsertKeptItem(store, keptItem) : null;
              });
              return item ? item[idKey] : undefined;
            }
          : undefined,
      // Another params' answer is another row.
      inheritData: verb !== "GET",
      completeSideEffect: onActionComplete,
    });
    if (verb === "GET") {
      markKeepableRead(action);
    }
    return action;
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
            const itemArray = store.upsertAnswer(dataArray);
            return itemArray.map((item) => item[idKey]);
          };

    const action = createAction(callback, {
      meta: { verb, isMany: true, paramScope },
      name: `${name}.${verb}_MANY`,
      resultToValue: applyResultToValue,
      // Before the first answer there is no id array; the data is then
      // undefined so a screen can tell "not asked yet" from "answered: none".
      valueToData: (idArray) =>
        idArray === undefined ? undefined : store.selectAll(idArray),
      // The rows the page kept from the previous document (kept_reads.js),
      // drawn while the request is out. A binding moving to new params still
      // hands over the previous answer when there are none: a list standing
      // in for the next one beats a skeleton.
      provisionalValue:
        verb === "GET"
          ? (params, action) =>
              untracked(() => {
                const keptItems = takeKeptRead(
                  getKeptReadKey(action.name, params),
                );
                if (!Array.isArray(keptItems)) {
                  return undefined;
                }
                return keptItems.map(
                  (keptItem) => upsertKeptItem(store, keptItem)[idKey],
                );
              })
          : undefined,
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
    if (verb === "GET") {
      markKeepableRead(action);
    }
    return action;
  };

  return createActionForRoot;
};

// Under a network policy a write callback is never called (see
// network_policy.js): there is nothing to answer it with, so it settles with a
// NetworkPolicyError carrying the policy's reason. A read is called or not depending
// on where the policy answers reads from. Answered from the store, a GET of a
// root resource completes with the row the store holds for it (see
// findItemInStore), and a root GET or GET_MANY holding rows for these params
// (the kept page, drawn while the request is out) with those — handing them
// back is an upsert without effect, so the action completes with what it had
// and nothing is asked. A relationship GET has no row of its own to answer
// with and settles with the same error. A completed GET asked to rerun never
// gets here (actions.js holds it).
const applyNetworkPolicy = (
  restCallback,
  { verb, isMany, findItemInStore },
) => {
  return (params, context) => {
    const policy = peekNetworkPolicy();
    if (policy === null) {
      return restCallback(params, context);
    }
    if (verb === "GET") {
      if (!policy.readsFromStore) {
        return restCallback(params, context);
      }
      if (isKeepableRead(context.action)) {
        const dataHeld = context.action.dataSignal.peek();
        if (dataHeld !== undefined) {
          return dataHeld;
        }
      }
      if (!isMany && findItemInStore) {
        const item = findItemInStore(params, context.action);
        if (item) {
          return item;
        }
      }
    }
    throw new NetworkPolicyError(policy.reason);
  };
};

// A `dependencies` given as a function is read before the first request
// leaves (see item_lifecycle_manager.js).
const readLazyDependenciesFirst = (restCallback) => {
  return (params, context) => {
    resourceLifecycleManager.resolvePendingDependencies();
    return restCallback(params, context);
  };
};

// A write named in `writes` sits on the facade beside the verbs: a name a verb
// takes, or one the facade already holds, would hide what is there. What it
// declares is checked here too, since nothing would ever say a write that
// cannot run or a rerun that cannot fire is wrong. A scopedMany child also
// takes the plural verbs: its answer `[ownerId, items]` is the collection.
const NAMED_WRITE_VERBS = ["POST", "PUT", "PATCH", "DELETE"];
const NAMED_WRITE_VERBS_OF_SCOPED_MANY = [
  ...NAMED_WRITE_VERBS,
  "POST_MANY",
  "PUT_MANY",
  "PATCH_MANY",
  "DELETE_MANY",
];
const VERB_KEYS = [
  "GET",
  "GET_MANY",
  "GET_RANGE",
  "POST",
  "POST_MANY",
  "PUT",
  "PUT_MANY",
  "PATCH",
  "PATCH_MANY",
  "DELETE",
  "DELETE_MANY",
];
const WRITE_RERUN_READS = ["GET", "GET_MANY", "GET_RANGE"];
const assertWriteCanBeNamed = (
  name,
  writeName,
  write,
  stateFacade,
  namedWriteVerbs,
) => {
  const where = `resource(${name}) writes.${writeName}`;
  if (VERB_KEYS.includes(writeName.toUpperCase())) {
    throw new Error(
      `${where}: "${writeName}" is a verb's name — a write named in "writes" takes a name of its own (cancel, archive…)`,
    );
  }
  if (Object.hasOwn(stateFacade, writeName)) {
    throw new Error(
      `${where}: the resource already exposes "${writeName}" — pick another name`,
    );
  }
  if (!write || typeof write !== "object") {
    throw new Error(`${where}: expects { verb, callback }, received ${write}`);
  }
  const { verb, callback, rerunOn } = write;
  if (!namedWriteVerbs.includes(verb)) {
    throw new Error(
      `${where}: "verb" says how its answer is applied, one of ${namedWriteVerbs.join(", ")} — received ${verb}`,
    );
  }
  if (typeof callback !== "function") {
    throw new Error(`${where}: "callback" must be a function`);
  }
  if (rerunOn === undefined) {
    return;
  }
  for (const read of Object.keys(rerunOn)) {
    if (!WRITE_RERUN_READS.includes(read)) {
      throw new Error(
        `${where}: rerunOn.${read} — a write reruns GET, GET_MANY or GET_RANGE`,
      );
    }
    if (typeof rerunOn[read] !== "boolean") {
      throw new Error(
        `${where}: rerunOn.${read} is true or false — the write says whether it reruns that read`,
      );
    }
  }
};

// WeakMap<action, itemId> — the row each GET action last completed with. A
// reset clears the action's value; this survives it, so a GET run again after
// a reset can still be answered from the store under a network policy.
const lastGetItemIdWeakMap = new WeakMap();
const getLastGetItemId = (action) => {
  return lastGetItemIdWeakMap.get(action);
};

// Captures the "file:line:column" of the user code that invoked the public
// function (resource(), .one(), .many(), .scopedOne(), …), so invalid-result
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

// A scoped child's item exists only inside its owner: two owners can each hold
// one with the same id. The callbacks of a relation chained on it whose result
// names that item do so by its id alone — `.one()`/`.many()` as the parent
// object or id, `.scopedOne()`/`.scopedMany()` as the `ownerId` of
// `[ownerId, …]` — so applied they would write the owner's store (`store` of a
// scoped child) or the scope of another owner's item. They are refused rather
// than routed: routing needs the owner in the result, a contract none of them
// has.
const refuseCallbacksNamingScopedItem = (
  relationLabel,
  callbacks,
  { name, ownerName, propertyName, declarationSite },
) => {
  const declaredKeys = [];
  for (const key of Object.keys(callbacks)) {
    if (callbacks[key]) {
      declaredKeys.push(key);
    }
  }
  if (declaredKeys.length === 0) {
    return;
  }
  const declared = declaredKeys.join(", ");
  throw new Error(
    `${relationLabel} cannot declare ${declared}: a "${name}" item exists only inside its "${ownerName}", and the result of ${declared} names it without saying which "${ownerName}" holds it.
Return "${propertyName}" embedded in what the "${name}" callbacks return ([ownerId, { …, ${propertyName} }]): those say which "${ownerName}".
${relationLabel} source location: ${declarationSite}`,
  );
};

// Shared by .many() and .scopedMany(): converts a raw relationship value (an
// array of child props/ids, or anything else meaning "empty") into an array of
// child ids, upserting each entry into the child store. The id array signal is
// only touched when the resulting ids actually differ.
// Returns whether the children the row points to changed — what the store asks
// a relation (see assign in array_signal_store.js).
// `wholeChildren` (.scopedMany()): each child received is the whole child, see
// toWholeScopedChild.
const createChildIdArrayUpdater = (
  childStore,
  childIdKey,
  idArraySignal,
  { wholeChildren = false } = {},
) => {
  return (valueArray) => {
    const currentIdArray = idArraySignal.peek();
    if (!Array.isArray(valueArray)) {
      if (currentIdArray.length > 0) {
        idArraySignal.value = [];
        return true;
      }
      return false;
    }
    const idArray = [];
    let modified = false;
    for (const value of valueArray) {
      let childItemProps;
      if (isProps(value)) {
        childItemProps = wholeChildren
          ? toWholeScopedChild(childStore, childIdKey, value)
          : value;
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
      return true;
    }
    return false;
  };
};

// A scoped child has no identity outside its owner, so nothing else holds a
// part of it: received in its collection it is the whole child, and a field
// the held one has and the props lack is gone (written undefined) — a slot
// changing hands keeps nothing of whoever sat there. The store merges
// otherwise, which is right for a shared entity (a list row and a profile
// carry different parts of one person). A relation on the child (an accessor)
// absent from the props is left alone, as an owner's is: it has reads of its
// own.
const toWholeScopedChild = (childStore, childIdKey, props) => {
  const heldChild = untracked(() => childStore.select(props[childIdKey]));
  if (!heldChild) {
    return props;
  }
  let wholeProps = props;
  for (const key of Object.keys(heldChild)) {
    if (Object.hasOwn(props, key)) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(heldChild, key);
    if (descriptor.get || descriptor.set) {
      continue;
    }
    if (wholeProps === props) {
      wholeProps = { ...props };
    }
    wholeProps[key] = undefined;
  }
  return wholeProps;
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

// A `.many()` plural write answering `[parentId, childArray]` rather than the
// children alone: a child is an object, never an array.
const isParentAnswer = (result) => {
  return result.length === 2 && Array.isArray(result[1]);
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
 * // When a user item's username is updated via USER.PUT,
 * // usernameSignal.value is set to the new username,
 * // which in turn triggers the route Signal->URL sync and updates the browser URL.
 */
export const syncResourceToSignals = (resource, propertyToSignalMap) => {
  if (resource.ownerName) {
    // A scoped child's `store` is its owner's: watching it would sync the
    // owner items' properties, not the child's.
    throw new Error(
      `syncResourceToSignals: "${resource.name}" lives inside each "${resource.ownerName}", so it has no store of its own to watch.${resource.getChildStore ? " Use syncOwnedResourceToSignals instead." : ""}`,
    );
  }
  syncStoreToSignals(resource.store, propertyToSignalMap);
};

/**
 * The same, for a `scopedMany` resource (or a `withParams()` of one): its items
 * live in one store per owner, so the store to watch is the one of the owner
 * `ownerSignal` names (by id or by any unique key), and it is switched when the
 * signal changes. Nothing is synced while `ownerSignal` holds `null`/`undefined`
 * or names an owner nothing has been loaded for yet.
 *
 * A `scopedOne` child has no store (each owner holds its one item), and a
 * `scopedMany` declared on a scoped child is kept per item with no owner key to
 * find it by: both are refused.
 *
 * @param {Object} resource - a resource made by `.scopedMany()`
 * @param {import("@preact/signals").Signal} ownerSignal - the owner whose children are watched
 * @param {Object} propertyToSignalMap - `{ [propertyName]: signal }`, as for `syncResourceToSignals`
 */
export const syncOwnedResourceToSignals = (
  resource,
  ownerSignal,
  propertyToSignalMap,
) => {
  if (!resource.getChildStore) {
    if (!resource.ownerName) {
      throw new Error(
        `syncOwnedResourceToSignals: "${resource.name}" is not a scoped resource. Use syncResourceToSignals instead.`,
      );
    }
    throw new Error(
      `syncOwnedResourceToSignals: "${resource.name}" has no store per "${resource.ownerName}" to watch: a scopedOne child is held by each owner, and a scopedMany declared on a scoped child has no owner key to find its store by.`,
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

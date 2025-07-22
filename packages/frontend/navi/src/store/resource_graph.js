import { computed, signal } from "@preact/signals";
import { createAction, formatActionSet, reloadActions } from "../actions.js";
import { SYMBOL_OBJECT_SIGNAL } from "../symbol_object_signal.js";
import {
  SYMBOL_IDENTITY,
  compareTwoJsValues,
} from "../utils/compare_two_js_values.js";
import { getCallerInfo } from "../utils/get_caller_info.js";
import { createIterableWeakSet } from "../utils/iterable_weak_set.js";
import { arraySignalStore, primitiveCanBeId } from "./array_signal_store.js";

let DEBUG = true;

// Global dependency tracking system
const globalDependencyRegistry = new Map(); // Map<dependencyResource, Set<dependentAutoreload>>
const registerDependency = (dependencyResource, dependentAutoreload) => {
  if (!globalDependencyRegistry.has(dependencyResource)) {
    globalDependencyRegistry.set(dependencyResource, new Set());
  }
  globalDependencyRegistry.get(dependencyResource).add(dependentAutoreload);
};
const notifyDependents = (triggeringResource, httpAction) => {
  const allActionsToReload = new Set();
  const dependents = globalDependencyRegistry.get(triggeringResource);
  if (dependents) {
    for (const dependentAutoreload of dependents) {
      const dependentActions =
        dependentAutoreload.collectDependencyActionsToReload(httpAction);
      for (const action of dependentActions) {
        allActionsToReload.add(action);
      }
    }
  }
  return allActionsToReload;
};

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

// Check if parentParams is a subset of childParams
// Used to determine parent-child relationships in parameter scopes
const isParamSubset = (parentParams, childParams) => {
  if (!parentParams || !childParams) return false;

  for (const [key, value] of Object.entries(parentParams)) {
    if (!(key in childParams) || !compareTwoJsValues(childParams[key], value)) {
      return false;
    }
  }
  return true;
};

const findAliveActionsMatching = (httpActionWeakSet, predicate) => {
  const matchingActionSet = new Set();
  for (const httpAction of httpActionWeakSet) {
    if (!predicate(httpAction)) {
      continue;
    }
    // Find all instances of this action (including bound params versions)
    const allInstances = httpAction.matchAllSelfOrDescendant(
      (action) => action.loadRequested,
    );
    for (const instance of allInstances) {
      matchingActionSet.add(instance);
    }
  }
  return matchingActionSet;
};
const initAutoreload = ({
  autoreloadGetManyAfter,
  autoreloadGetAfter,
  paramScope,
  dependencies = [],
  resourceInstance,
}) => {
  const httpActionWeakSet = createIterableWeakSet();
  const shouldAutoreloadGetMany = createShouldAutoreloadAfter(
    autoreloadGetManyAfter,
  );
  const shouldAutoreloadGet = createShouldAutoreloadAfter(autoreloadGetAfter);

  const onActionCreated = (httpAction) => {
    httpActionWeakSet.add(httpAction);
  };

  // Build the predicate for which actions to reload based on param scope
  const buildParamScopePredicate = () => {
    return paramScope
      ? (httpActionCandidate) => {
          // For parameterized actions, reload:
          // 1. Actions with same paramScope (siblings)
          // 2. Actions with no paramScope (root parent)
          // 3. Actions whose params are a subset of current params (parent scopes)
          if (httpActionCandidate.meta.paramScope?.id === paramScope.id) {
            return true; // Same scope
          }
          if (!httpActionCandidate.meta.paramScope) {
            return true; // Root parent (no params)
          }
          // Check if candidate's params are a subset of current params (parent scope)
          const candidateParams = httpActionCandidate.meta.paramScope.params;
          const currentParams = paramScope.params;
          return isParamSubset(candidateParams, currentParams);
        }
      : (httpActionCandidate) => !httpActionCandidate.meta.paramScope;
  };

  // Build the predicate for which HTTP methods to reload
  const buildHttpMetaPredicate = ({ shouldReloadGetMany, shouldReloadGet }) => {
    if (shouldReloadGetMany && shouldReloadGet) {
      return (httpActionCandidate) =>
        httpActionCandidate.meta.httpVerb === "GET";
    }
    if (shouldReloadGetMany) {
      return (httpActionCandidate) =>
        httpActionCandidate.meta.httpVerb === "GET" &&
        httpActionCandidate.meta.httpMany === true;
    }
    if (shouldReloadGet) {
      return (httpActionCandidate) =>
        httpActionCandidate.meta.httpVerb === "GET" &&
        !httpActionCandidate.meta.httpMany;
    }
    return () => false;
  };

  const onActionDone = (httpAction) => {
    const predicates = [];
    const reasons = [];
    const actionToReloadSet = new Set();

    // Handle same-resource autoreload using configured rules
    const shouldReloadGetMany = shouldAutoreloadGetMany(httpAction);
    const shouldReloadGet = shouldAutoreloadGet(httpAction);

    if (shouldReloadGetMany || shouldReloadGet) {
      const paramScopePredicate = buildParamScopePredicate();
      const httpMetaPredicate = buildHttpMetaPredicate({
        shouldReloadGetMany,
        shouldReloadGet,
      });

      const autoreloadPredicate = (httpActionCandidate) =>
        httpMetaPredicate(httpActionCandidate) &&
        paramScopePredicate(httpActionCandidate);

      predicates.push(autoreloadPredicate);
      reasons.push("same-resource autoreload");
    }

    // Special case: For DELETE actions, also reload any GET actions that reference the deleted resource(s)
    if (httpAction.meta.httpVerb === "DELETE") {
      const deletedIds = httpAction.meta.httpMany
        ? httpAction.data // Array of IDs for DELETE_MANY
        : [httpAction.data]; // Single ID for DELETE
      debugger;

      if (
        deletedIds &&
        deletedIds.length > 0 &&
        deletedIds.every((id) => id !== undefined)
      ) {
        const deletePredicate = (httpActionCandidate) => {
          // Only target GET actions (both single and many can reference deleted resources)
          if (httpActionCandidate.meta.httpVerb !== "GET") {
            return false;
          }

          // For GET_MANY actions, we reload them as they might contain deleted items
          if (httpActionCandidate.meta.httpMany) {
            return true;
          }

          // For single GET actions, check if they reference any of the deleted IDs
          return deletedIds.some((deletedId) => {
            const instances = httpActionCandidate.matchAllSelfOrDescendant(
              (action) => action.loadRequested && action.data === deletedId,
            );
            return instances.length > 0;
          });
        };

        predicates.push(deletePredicate);
        reasons.push("DELETE-affected GET actions");
      }
    }

    // Collect actions to reload from current resource's autoreload rules
    if (predicates.length > 0) {
      const combinedPredicate = (httpActionCandidate) => {
        return predicates.some((predicate) => predicate(httpActionCandidate));
      };

      const localActions = findAliveActionsMatching(
        httpActionWeakSet,
        combinedPredicate,
      );
      for (const action of localActions) {
        actionToReloadSet.add(action);
      }
    }

    // Collect actions to reload from cross-resource dependencies
    if (resourceInstance && httpAction.meta.httpVerb !== "GET") {
      const dependencyActions = notifyDependents(resourceInstance, httpAction);
      for (const action of dependencyActions) {
        actionToReloadSet.add(action);
      }
      if (dependencyActions.size > 0) {
        reasons.push("dependency autoreload");
      }
    }

    // Execute single autoreload if any actions were collected
    if (actionToReloadSet.size > 0) {
      const reason = `${httpAction} triggered ${reasons.join(" and ")}`;
      if (DEBUG) {
        console.debug(
          `Autoreload triggered by ${httpAction.name}: ${formatActionSet("toReload", actionToReloadSet)}`,
        );
      }
      reloadActions(actionToReloadSet, {
        reason,
      });
    }
  };

  // Collect actions to reload for dependency-triggered reloads (without executing)
  const collectDependencyActionsToReload = (httpAction) => {
    if (httpAction.meta.httpVerb === "GET") {
      // Dependencies have specific behavior: only non-GET verbs trigger autoreload,
      // and they only trigger GET_MANY reloads (not individual GET reloads)
      return new Set();
    }

    const paramScopePredicate = buildParamScopePredicate();
    const dependencyPredicate = (httpActionCandidate) => {
      // Dependencies only reload GET_MANY actions
      return (
        httpActionCandidate.meta.httpVerb === "GET" &&
        httpActionCandidate.meta.httpMany === true &&
        paramScopePredicate(httpActionCandidate)
      );
    };

    return findAliveActionsMatching(httpActionWeakSet, dependencyPredicate);
  };

  // Register this autoreload instance as dependent on its dependencies
  if (dependencies.length > 0) {
    for (const dependency of dependencies) {
      registerDependency(dependency, { collectDependencyActionsToReload });
    }
  }

  return { onActionCreated, onActionDone, httpActionWeakSet };
};

const createHttpHandlerForRootResource = (
  name,
  {
    idKey,
    store,
    autoreloadGetManyAfter = ["POST", "DELETE"],
    autoreloadGetAfter = false,
    paramScope,
    dependencies = [],
    resourceInstance,
  },
) => {
  const autoreload = initAutoreload({
    autoreloadGetManyAfter,
    autoreloadGetAfter,
    paramScope,
    dependencies,
    resourceInstance,
  });

  const createActionAffectingOneItem = (httpVerb, { callback, ...options }) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? (itemIdOrItemProps) => {
            const itemId = store.drop(itemIdOrItemProps);
            return itemId;
          }
        : (data) => {
            let item;
            if (Array.isArray(data)) {
              // the callback is returning something like [property, value, props]
              // this is to support a case like:
              // store.upsert("name", "currentName", { name: "newName" })
              // where we want to update the name property of an existing item
              item = store.upsert(...data);
            } else {
              item = store.upsert(data);
            }
            const itemId = item[idKey];
            return itemId;
          };

    const callerInfo = getCallerInfo(createActionAffectingOneItem, 1);
    const actionTrace = `${name}.${httpVerb} (${callerInfo.file}:${callerInfo.line}:${callerInfo.column})`;
    const httpActionAffectingOneItem = createAction(
      mapCallbackMaybeAsyncResult(callback, (data) => {
        if (httpVerb === "DELETE") {
          if (!isProps(data) && !primitiveCanBeId(data)) {
            throw new TypeError(
              `${actionTrace} must return an object (that will be used to drop "${name}" resource), received ${data}.`,
            );
          }
          return applyDataEffect(data);
        }
        if (!isProps(data)) {
          throw new TypeError(
            `${actionTrace} must return an object (that will be used to upsert "${name}" resource), received ${data}.`,
          );
        }
        return applyDataEffect(data);
      }),
      {
        meta: { httpVerb, httpMany: false, paramScope },
        name: `${name}.${httpVerb}`,
        compute: (itemId) => store.select(itemId),
        onLoad: (loadedAction) => autoreload.onActionDone(loadedAction),
        ...options,
      },
    );
    autoreload.onActionCreated(httpActionAffectingOneItem);
    return httpActionAffectingOneItem;
  };
  const GET = (callback, options) =>
    createActionAffectingOneItem("GET", {
      callback,
      applyDataEffect: (data) => {
        const item = store.upsert(data);
        const itemId = item[idKey];
        return itemId;
      },
      compute: (itemId) => store.select(itemId),
      ...options,
    });
  const POST = (callback, options) =>
    createActionAffectingOneItem("POST", {
      callback,
      applyDataEffect: (data) => {
        const item = store.upsert(data);
        const itemId = item[idKey];
        return itemId;
      },
      compute: (itemId) => store.select(itemId),
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
    httpVerb,
    { callback, ...options },
  ) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? (idArray) => {
            store.drop(idArray);
            return idArray;
          }
        : (dataArray) => {
            const itemArray = store.upsert(dataArray);
            const idArray = itemArray.map((item) => item[idKey]);
            return idArray;
          };

    const httpActionAffectingManyItems = createAction(
      mapCallbackMaybeAsyncResult(callback, (dataArray) => {
        return applyDataEffect(dataArray);
      }),
      {
        meta: { httpVerb, httpMany: true, paramScope },
        name: `${name}.${httpVerb}_MANY`,
        data: [],
        compute: (idArray) => store.selectAll(idArray),
        onLoad: (loadedAction) => autoreload.onActionDone(loadedAction),
        ...options,
      },
    );
    autoreload.onActionCreated(httpActionAffectingManyItems);
    return httpActionAffectingManyItems;
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
    autoreload,
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
const createHttpHandlerForRelationshipToOneResource = (
  name,
  { idKey, store, propertyName, childIdKey, childStore },
) => {
  const createActionAffectingOneItem = (httpVerb, { callback, ...options }) => {
    const applyDataEffect =
      httpVerb === "DELETE"
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
          (data) => {
            const item = store.upsert(data);
            const childItem = item[propertyName];
            const childItemId = childItem ? childItem[childIdKey] : undefined;
            return childItemId;
          };

    const httpActionAffectingOneItem = createAction(
      mapCallbackMaybeAsyncResult(callback, (data) => {
        return applyDataEffect(data);
      }),
      {
        meta: { httpVerb, httpMany: false },
        name: `${name}.${httpVerb}`,
        compute: (childItemId) => childStore.select(childItemId),
        ...options,
      },
    );
    return httpActionAffectingOneItem;
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
const createHttpHandlerRelationshipToManyResource = (
  name,
  {
    idKey,
    store,
    propertyName,
    childIdKey,
    childStore,
    autoreloadGetManyAfter = ["POST", "DELETE"],
    autoreloadGetAfter = false,
    paramScope,
    resourceInstance,
  } = {},
) => {
  // idéalement s'il y a un GET sur le store originel on voudrait ptet le reload
  // parce que le store originel peut retourner cette liste ou etre impacté
  // pour l'instant on ignore
  const autoreload = initAutoreload({
    autoreloadGetManyAfter,
    autoreloadGetAfter,
    paramScope,
    resourceInstance,
  });

  // one item AND many child items
  const createActionAffectingOneItem = (httpVerb, { callback, ...options }) => {
    const applyDataEffect =
      httpVerb === "DELETE"
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
            const childItem = childStore.upsert(childData); // if the child item was used it will reload thanks to signals
            const childItemId = childItem[childIdKey];
            return childItemId;
          };

    const httpActionAffectingOneItem = createAction(
      mapCallbackMaybeAsyncResult(callback, (dataArray) => {
        return applyDataEffect(dataArray);
      }),
      {
        meta: { httpVerb, httpMany: false },
        name: `${name}.${httpVerb}`,
        compute: (childItemId) => childStore.select(childItemId),
        onLoad: (loadedAction) => autoreload.onActionDone(loadedAction),
        ...options,
      },
    );
    autoreload.onActionCreated(httpActionAffectingOneItem);
    return httpActionAffectingOneItem;
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
    httpVerb,
    { callback, ...options },
  ) => {
    const applyDataEffect =
      httpVerb === "GET"
        ? (data) => {
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
            const item = store.upsert(data);
            const childItemArray = item[propertyName];
            const childItemIdArray = childItemArray.map(
              (childItem) => childItem[childIdKey],
            );
            return childItemIdArray;
          }
        : httpVerb === "DELETE"
          ? ([itemId, childItemIdArray]) => {
              const item = store.select(itemId);
              const childItemArray = item[propertyName];
              const childItemArrayWithoutThoose = [];
              let someFound = false;
              for (const childItemCandidate of childItemArray) {
                const childItemCandidateId = childItemCandidate[childIdKey];
                if (childItemIdArray.includes(childItemCandidateId)) {
                  someFound = true;
                } else {
                  childItemArrayWithoutThoose.push(childItemCandidate);
                }
              }
              if (someFound) {
                store.upsert({
                  [idKey]: itemId,
                  [propertyName]: childItemArrayWithoutThoose,
                });
              }
              return childItemIdArray;
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

    const httpActionAffectingManyItem = createAction(
      mapCallbackMaybeAsyncResult(callback, (dataArray) => {
        return applyDataEffect(dataArray);
      }),
      {
        meta: { httpVerb, httpMany: true },
        name: `${name}.${httpVerb}[many]`,
        data: [],
        compute: (childItemIdArray) => childStore.selectAll(childItemIdArray),
        onLoad: (loadedAction) => autoreload.onActionDone(loadedAction),
        ...options,
      },
    );
    autoreload.onActionCreated(httpActionAffectingManyItem);
    return httpActionAffectingManyItem;
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

export const resource = (
  name,
  {
    idKey,
    mutableIdKeys = [],
    autoreloadGetManyAfter,
    autoreloadGetAfter,
    httpHandler,
    ...rest
  } = {},
) => {
  if (idKey === undefined) {
    idKey = mutableIdKeys.length === 0 ? "id" : mutableIdKeys[0];
  }
  const resourceInstance = {
    isResource: true,
    name,
    idKey,
    httpActions: {},
    addItemSetup: undefined,
    httpHandler,
  };
  if (!httpHandler) {
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

    httpHandler = createHttpHandlerForRootResource(name, {
      idKey,
      store,
      autoreloadGetManyAfter,
      autoreloadGetAfter,
      resourceInstance,
    });
  }
  resourceInstance.httpHandler = httpHandler;

  // Store the action callback definitions for withParams to use later
  resourceInstance.httpActions = rest;

  // Create HTTP actions
  for (const key of Object.keys(rest)) {
    const method = httpHandler[key];
    if (!method) {
      continue;
    }
    const action = method(rest[key]);
    resourceInstance[key] = action;
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
    const httpHandlerForRelationshipToOneChild =
      createHttpHandlerForRelationshipToOneResource(childName, {
        idKey,
        store: resourceInstance.store,
        propertyName,
        childIdKey,
        childStore: childResource.store,
      });
    return resource(childName, {
      idKey: childIdKey,
      httpHandler: httpHandlerForRelationshipToOneChild,
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
    const httpHandleForChildManyResource =
      createHttpHandlerRelationshipToManyResource(childName, {
        idKey,
        store: resourceInstance.store,
        propertyName,
        childIdKey,
        childStore: childResource.store,
        resourceInstance,
      });
    return resource(childName, {
      idKey: childIdKey,
      httpHandler: httpHandleForChildManyResource,
      ...options,
    });
  };

  /**
   * Creates a parameterized version of the resource with isolated autoreload behavior.
   *
   * Actions from parameterized resources only trigger autoreload for other actions with
   * identical parameters, preventing cross-contamination between different parameter sets.
   *
   * @param {Object} params - Parameters to bind to all actions of this resource (required)
   * @param {Object} options - Additional options for the parameterized resource
   * @param {Array} options.dependencies - Array of resources that should trigger autoreload when modified
   * @param {Array|string} options.autoreloadGetManyAfter - HTTP verbs that trigger GET_MANY autoreload
   * @param {Array|string|boolean} options.autoreloadGetAfter - HTTP verbs that trigger GET autoreload
   * @returns {Object} A new resource instance with parameter-bound actions and isolated autoreload
   * @see {@link ./docs/resource_with_params.md} for detailed documentation and examples
   *
   * @example
   * const ROLE = resource("role", { GET: (params) => fetchRole(params) });
   * const adminRoles = ROLE.withParams({ canlogin: true });
   * const guestRoles = ROLE.withParams({ canlogin: false });
   * // adminRoles and guestRoles have isolated autoreload behavior
   *
   * @example
   * // Cross-resource dependencies
   * const role = resource("role");
   * const database = resource("database");
   * const tables = resource("tables");
   * const ROLE_WITH_OWNERSHIP = role.withParams({ owners: true }, {
   *   dependencies: [role, database, tables],
   * });
   * // ROLE_WITH_OWNERSHIP.GET_MANY will autoreload when any table/database/role is POST/DELETE
   */
  const withParams = (params, options = {}) => {
    // Require parameters
    if (!params || Object.keys(params).length === 0) {
      throw new Error(`resource(${name}).withParams() requires parameters`);
    }

    const {
      dependencies = [],
      autoreloadGetManyAfter: customAutoreloadGetManyAfter,
      autoreloadGetAfter: customAutoreloadGetAfter,
    } = options;

    // Generate unique param scope for these parameters
    const paramScopeObject = getParamScope(params);

    // Use custom autoreload settings if provided, otherwise use resource defaults
    const finalAutoreloadGetManyAfter =
      customAutoreloadGetManyAfter !== undefined
        ? customAutoreloadGetManyAfter
        : autoreloadGetManyAfter;
    const finalAutoreloadGetAfter =
      customAutoreloadGetAfter !== undefined
        ? customAutoreloadGetAfter
        : autoreloadGetAfter;

    // Create a new httpHandler with the param scope for isolated autoreload
    const parameterizedHttpHandler = createHttpHandlerForRootResource(name, {
      idKey,
      store: resourceInstance.store,
      autoreloadGetManyAfter: finalAutoreloadGetManyAfter,
      autoreloadGetAfter: finalAutoreloadGetAfter,
      paramScope: paramScopeObject,
      dependencies,
      resourceInstance,
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
      httpHandler: parameterizedHttpHandler,
      one: resourceInstance.one,
      many: resourceInstance.many,
      dependencies, // Store dependencies for debugging/inspection
      httpActions: resourceInstance.httpActions,
    };

    // Create HTTP actions from the parameterized handler and bind parameters
    for (const key of Object.keys(resourceInstance.httpActions)) {
      const method = parameterizedHttpHandler[key];
      if (method) {
        const action = method(resourceInstance.httpActions[key]);
        // Bind the parameters to get a parameterized action instance
        parameterizedResource[key] = action.bindParams(params);
      }
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
        autoreloadGetManyAfter: finalAutoreloadGetManyAfter,
        autoreloadGetAfter: finalAutoreloadGetAfter,
        ...newOptions,
      };
      return withParams(mergedParams, mergedOptions);
    };

    return parameterizedResource;
  };

  resourceInstance.withParams = withParams;

  return resourceInstance;
};

const isProps = (value) => {
  return value !== null && typeof value === "object";
};

const createHttpVerbPredicate = (httpVerbCondition) => {
  if (httpVerbCondition === "*") {
    return () => true;
  }
  if (Array.isArray(httpVerbCondition)) {
    const httpVerbSet = new Set();
    for (const v of httpVerbCondition) {
      httpVerbSet.add(v.toUpperCase());
      if (v === "*") {
        httpVerbSet.clear();
        return () => true;
      }
    }
    return (httpVerb) => httpVerbSet.has(httpVerb.toUpperCase());
  }
  return () => false;
};
const createShouldAutoreloadAfter = (autoreloadAfter) => {
  const httpVerbPredicate = createHttpVerbPredicate(autoreloadAfter);
  return (action) => {
    const { httpVerb } = action.meta;
    if (httpVerb === "GET") {
      return false;
    }
    return httpVerbPredicate(httpVerb);
  };
};

const mapCallbackMaybeAsyncResult = (callback, effect) => {
  return (...args) => {
    const result = callback(...args);
    if (result && typeof result.then === "function") {
      return result.then(effect);
    }
    return effect(result);
  };
};

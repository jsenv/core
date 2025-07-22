import { computed, signal } from "@preact/signals";
import { getActionPrivateProperties } from "../action_private_properties.js";
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

// Centralized Autoreload Manager
// This handles ALL autoreload logic across all resources
const createAutoreloadManager = () => {
  const registeredResources = new Map(); // Map<resourceInstance, autoreloadConfig>
  const resourceDependencies = new Map(); // Map<resourceInstance, Set<dependentResources>>

  const registerResource = (resourceInstance, config) => {
    const {
      autoreloadGetManyAfter = ["POST", "DELETE"],
      autoreloadGetAfter = false,
      paramScope = null,
      dependencies = [],
    } = config;

    registeredResources.set(resourceInstance, {
      autoreloadGetManyAfter,
      autoreloadGetAfter,
      paramScope,
      httpActions: new Set(),
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

  const registerAction = (resourceInstance, httpAction) => {
    const config = registeredResources.get(resourceInstance);
    if (config) {
      config.httpActions.add(httpAction);
    }
  };

  const shouldAutoreloadAfter = (autoreloadAfter) => {
    if (autoreloadAfter === "*") return () => true;
    if (Array.isArray(autoreloadAfter)) {
      const verbSet = new Set(autoreloadAfter.map((v) => v.toUpperCase()));
      if (verbSet.has("*")) return () => true;
      return (httpVerb) => verbSet.has(httpVerb.toUpperCase());
    }
    return () => false;
  };

  const isParamSubset = (parentParams, childParams) => {
    if (!parentParams || !childParams) return false;
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

  const findActionsToReload = (triggeringAction) => {
    const actionsToReload = new Set();
    const reasonSet = new Set();

    for (const [resourceInstance, config] of registeredResources) {
      const shouldReloadGetMany = shouldAutoreloadAfter(
        config.autoreloadGetManyAfter,
      )(triggeringAction.meta.httpVerb);
      const shouldReloadGet = shouldAutoreloadAfter(config.autoreloadGetAfter)(
        triggeringAction.meta.httpVerb,
      );

      // Skip if no autoreload rules apply
      if (
        !shouldReloadGetMany &&
        !shouldReloadGet &&
        triggeringAction.meta.httpVerb !== "DELETE"
      ) {
        continue;
      }

      // Build parameter scope predicate
      const paramScopePredicate = config.paramScope
        ? (candidateAction) => {
            if (candidateAction.meta.paramScope?.id === config.paramScope.id)
              return true;
            if (!candidateAction.meta.paramScope) return true;
            const candidateParams = candidateAction.meta.paramScope.params;
            const currentParams = config.paramScope.params;
            return isParamSubset(candidateParams, currentParams);
          }
        : (candidateAction) => !candidateAction.meta.paramScope;

      for (const httpAction of config.httpActions) {
        // Find all instances of this action
        const allInstances = httpAction.matchAllSelfOrDescendant(
          (action) => action.loadRequested,
        );

        for (const instance of allInstances) {
          // Check parameter scope compatibility
          if (!paramScopePredicate(instance)) continue;

          // Same-resource autoreload rules
          if (resourceInstance === getResourceForAction(triggeringAction)) {
            if (instance.meta.httpVerb === "GET") {
              const shouldReload = instance.meta.httpMany
                ? shouldReloadGetMany
                : shouldReloadGet;
              if (shouldReload) {
                actionsToReload.add(instance);
                reasonSet.add("same-resource autoreload");
              }
            }
          }

          // Cross-resource dependency autoreload
          const triggeringResource = getResourceForAction(triggeringAction);
          if (
            triggeringResource &&
            resourceDependencies.get(triggeringResource)?.has(resourceInstance)
          ) {
            if (
              triggeringAction.meta.httpVerb !== "GET" &&
              instance.meta.httpVerb === "GET" &&
              instance.meta.httpMany
            ) {
              actionsToReload.add(instance);
              reasonSet.add("dependency autoreload");
            }
          }

          // DELETE-specific autoreload
          if (
            triggeringAction.meta.httpVerb === "DELETE" &&
            instance.meta.httpVerb === "GET"
          ) {
            const { dataSignal } = getActionPrivateProperties(triggeringAction);
            const deletedIds = triggeringAction.meta.httpMany
              ? dataSignal.peek()
              : [dataSignal.peek()];

            if (
              deletedIds &&
              deletedIds.length > 0 &&
              deletedIds.every((id) => id !== undefined)
            ) {
              // Always reload GET_MANY
              if (instance.meta.httpMany) {
                actionsToReload.add(instance);
                reasonSet.add("DELETE-affected GET actions");
              }
              // For single GET, check if data matches deleted IDs
              else if (deletedIds.includes(instance.data)) {
                actionsToReload.add(instance);
                reasonSet.add("DELETE-affected GET actions");
              }
            }
          }
        }
      }
    }

    return { actionsToReload, reasons: Array.from(reasonSet) };
  };

  const onActionComplete = (httpAction) => {
    const { actionsToReload, reasons } = findActionsToReload(httpAction);

    if (actionsToReload.size > 0) {
      const reason = `${httpAction} triggered ${reasons.join(" and ")}`;
      if (DEBUG) {
        console.debug(
          `Autoreload triggered by ${httpAction.name}, will reload: ${formatActionSet(actionsToReload)}`,
        );
      }
      reloadActions(actionsToReload, { reason });
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

// Global autoreload manager instance
const autoreloadManager = createAutoreloadManager();

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
  // Register this resource with the autoreload manager
  autoreloadManager.registerResource(resourceInstance, {
    autoreloadGetManyAfter,
    autoreloadGetAfter,
    paramScope,
    dependencies,
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
    const httpActionAffectingOneItem = createAction(callback, {
      meta: { httpVerb, httpMany: false, paramScope, resourceInstance },
      name: `${name}.${httpVerb}`,
      dataEffect: (data) => {
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
      },
      compute: (itemId) => store.select(itemId),
      onLoad: (loadedAction) =>
        autoreloadManager.onActionComplete(loadedAction),
      ...options,
    });
    autoreloadManager.registerAction(
      resourceInstance,
      httpActionAffectingOneItem,
    );
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

    const httpActionAffectingManyItems = createAction(callback, {
      meta: { httpVerb, httpMany: true, paramScope, resourceInstance },
      name: `${name}.${httpVerb}_MANY`,
      data: [],
      dataEffect: applyDataEffect,
      compute: (idArray) => store.selectAll(idArray),
      onLoad: (loadedAction) =>
        autoreloadManager.onActionComplete(loadedAction),
      ...options,
    });
    autoreloadManager.registerAction(
      resourceInstance,
      httpActionAffectingManyItems,
    );
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
  {
    idKey,
    store,
    propertyName,
    childIdKey,
    childStore,
    resourceInstance,
    autoreloadManager,
  },
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

    const httpActionAffectingOneItem = createAction(callback, {
      meta: { httpVerb, httpMany: false, resourceInstance },
      name: `${name}.${httpVerb}`,
      dataEffect: applyDataEffect,
      compute: (childItemId) => childStore.select(childItemId),
      onLoad: (loadedAction) =>
        autoreloadManager.onActionComplete(loadedAction),
      ...options,
    });
    autoreloadManager.registerAction(
      resourceInstance,
      httpActionAffectingOneItem,
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
    resourceInstance,
    autoreloadManager,
  } = {},
) => {
  // idéalement s'il y a un GET sur le store originel on voudrait ptet le reload
  // parce que le store originel peut retourner cette liste ou etre impacté
  // pour l'instant on ignore

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

    const httpActionAffectingOneItem = createAction(callback, {
      meta: { httpVerb, httpMany: false, resourceInstance },
      name: `${name}.${httpVerb}`,
      dataEffect: applyDataEffect,
      compute: (childItemId) => childStore.select(childItemId),
      onLoad: (loadedAction) =>
        autoreloadManager.onActionComplete(loadedAction),
      ...options,
    });
    autoreloadManager.registerAction(
      resourceInstance,
      httpActionAffectingOneItem,
    );
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

    const httpActionAffectingManyItem = createAction(callback, {
      meta: { httpVerb, httpMany: true, resourceInstance },
      name: `${name}.${httpVerb}[many]`,
      data: [],
      dataEffect: applyDataEffect,
      compute: (childItemIdArray) => childStore.selectAll(childItemIdArray),
      onLoad: (loadedAction) =>
        autoreloadManager.onActionComplete(loadedAction),
      ...options,
    });
    autoreloadManager.registerAction(
      resourceInstance,
      httpActionAffectingManyItem,
    );
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
        resourceInstance,
        autoreloadManager,
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
        autoreloadManager,
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

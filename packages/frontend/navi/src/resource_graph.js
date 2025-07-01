import { computed, signal } from "@preact/signals";
import { createAction, reloadActions } from "./actions.js";
import { arraySignalStore, primitiveCanBeId } from "./array_signal_store.js";
import { SYMBOL_IDENTITY } from "./compare_two_js_values.js";
import { getCallerInfo } from "./get_caller_info.js";
import { createIterableWeakSet } from "./iterable_weak_set.js";
import { SYMBOL_OBJECT_SIGNAL } from "./symbol_object_signal.js";

let debug = false;

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
const initAutoreload = ({ autoreloadGetManyAfter, autoreloadGetAfter }) => {
  const httpActionWeakSet = createIterableWeakSet();
  const shouldAutoreloadGetMany = createShouldAutoreloadAfter(
    autoreloadGetManyAfter,
  );
  const shouldAutoreloadGet = createShouldAutoreloadAfter(autoreloadGetAfter);

  const onActionCreated = (httpAction) => {
    httpActionWeakSet.add(httpAction);
  };

  const onActionDone = (httpAction) => {
    const getManyAutoreload = shouldAutoreloadGetMany(httpAction);
    const getAutoreload = shouldAutoreloadGet(httpAction);
    if (!getManyAutoreload && !getAutoreload) {
      return;
    }

    // if (httpAction.name === "user.friends.POST") {
    //   debugger;
    // }

    const predicate =
      getManyAutoreload && getAutoreload
        ? (httpActionCandidate) => httpActionCandidate.meta.httpVerb === "GET"
        : getManyAutoreload
          ? (httpActionCandidate) =>
              httpActionCandidate.meta.httpVerb === "GET" &&
              httpActionCandidate.meta.httpMany === true
          : (httpActionCandidate) =>
              httpActionCandidate.meta.httpVerb === "GET" &&
              !httpActionCandidate.meta.httpMany;
    const toReloadSet = findAliveActionsMatching(httpActionWeakSet, predicate);
    reloadActions(toReloadSet, {
      reason: `${httpAction} triggered`,
    });
  };

  return { onActionCreated, onActionDone };
};

const createHttpHandlerForRootResource = (
  name,
  {
    idKey,
    store,
    autoreloadGetManyAfter = ["POST", "DELETE"],
    autoreloadGetAfter = false,
  },
) => {
  const autoreload = initAutoreload({
    autoreloadGetManyAfter,
    autoreloadGetAfter,
  });

  const createActionAffectingOneItem = (httpVerb, { callback, ...options }) => {
    const applyDataEffect =
      httpVerb === "DELETE"
        ? (itemId) => {
            store.drop(itemId);
            autoreload.onActionDone(httpActionAffectingOneItem);
            return itemId;
          }
        : (data) => {
            const item = store.upsert(data);
            autoreload.onActionDone(httpActionAffectingOneItem);
            const itemId = item[idKey];
            return itemId;
          };

    const callerInfo = getCallerInfo(createActionAffectingOneItem, 2);
    const actionTrace = `${name}.${httpVerb} (${callerInfo.file}:${callerInfo.line}:${callerInfo.column})`;
    const httpActionAffectingOneItem = createAction(
      mapCallbackMaybeAsyncResult(callback, (data) => {
        if (httpVerb === "DELETE") {
          if (isProps(data)) {
            throw new TypeError(
              `${actionTrace} must return an object (that will be used to drop "${name}" resource), received ${data}.`,
            );
          }
          if (!primitiveCanBeId(data)) {
            throw new TypeError(
              `${actionTrace} must return an id (that will be used to drop "${name}" resource), received ${data}.`,
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
        meta: { httpVerb, httpMany: false },
        name: `${name}.${httpVerb}`,
        compute: (itemId) => store.select(itemId),
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
            autoreload.onActionDone(httpActionAffectingManyItems);
            return idArray;
          }
        : (dataArray) => {
            const itemArray = store.upsert(dataArray);
            autoreload.onActionDone(httpActionAffectingManyItems);
            const idArray = itemArray.map((item) => item[idKey]);
            return idArray;
          };

    const httpActionAffectingManyItems = createAction(
      mapCallbackMaybeAsyncResult(callback, (dataArray) => {
        return applyDataEffect(dataArray);
      }),
      {
        meta: { httpVerb, httpMany: true },
        name: `${name}.${httpVerb}[many]`,
        data: [],
        compute: (idArray) => store.selectAll(idArray),
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
  } = {},
) => {
  // idéalement s'il y a un GET sur le store originel on voudrait ptet le reload
  // parce que le store originel peut retourner cette liste ou etre impacté
  // pour l'instant on ignore
  const autoreload = initAutoreload({
    autoreloadGetManyAfter,
    autoreloadGetAfter,
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
              autoreload.onActionDone(httpActionAffectingOneItem);
            }
            return childItemId;
          }
        : (childData) => {
            const childItem = childStore.upsert(childData); // if the child item was used it will reload thanks to signals
            autoreload.onActionDone(httpActionAffectingOneItem);
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
            autoreload.onActionDone(httpActionAffectingManyItem);
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
                autoreload.onActionDone(httpActionAffectingManyItem);
              }
              return childItemIdArray;
            }
          : (childDataArray) => {
              // hum ici aussi on voudra reload "user" pour POST
              // les autres les signals se charge de reload si visible
              const childItemArray = childStore.upsert(childDataArray);
              autoreload.onActionDone(httpActionAffectingManyItem);
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
    });
  }
  resourceInstance.httpHandler = httpHandler;

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

      if (debug) {
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
          if (debug) {
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

      if (debug) {
        const childItemArray = childItemArraySignal.peek();
        console.debug(
          `setup ${item}.${propertyName} is many "${childResource.name}" (current value: ${childItemArray.length ? childItemArray.join(",") : "[]"})`,
        );
      }

      Object.defineProperty(item, propertyName, {
        get: () => {
          const childItemArray = childItemArraySignal.value;
          if (debug) {
            console.debug(
              `return ${childItemArray.length ? childItemArray.join(",") : "[]"} for ${item}.${propertyName}`,
            );
          }
          return childItemArray;
        },
        set: (value) => {
          updateChildItemIdArray(value);
          if (debug) {
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
      });
    return resource(childName, {
      idKey: childIdKey,
      httpHandler: httpHandleForChildManyResource,
      ...options,
    });
  };

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

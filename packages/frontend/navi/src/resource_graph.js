import { computed, signal } from "@preact/signals";
import { createAction, reloadActions } from "./actions.js";
import { arraySignalStore } from "./array_signal_store.js";
import { SYMBOL_IDENTITY } from "./compare_two_js_values.js";
import { createIterableWeakSet } from "./iterable_weak_set.js";
import { SYMBOL_OBJECT_SIGNAL } from "./symbol_object_signal.js";

let debug = true;

export const resource = (
  name,
  {
    sourceStore,
    store,
    idKey,
    mutableIdKey,
    autoreloadGetManyAfter = ["POST", "DELETE"],
    autoreloadGetAfter = false,
    ...rest
  } = {},
) => {
  if (mutableIdKey && idKey === undefined) {
    idKey = mutableIdKey;
  } else if (idKey === undefined) {
    idKey = "id";
  }

  const resourceInstance = {
    isResource: true,
    name,
    idKey,
  };

  if (!store) {
    const setupCallbackSet = new Set();
    const addItemSetup = (callback) => {
      setupCallbackSet.add(callback);
    };
    resourceInstance.addItemSetup = addItemSetup;

    const itemPrototype = {
      [Symbol.toStringTag]: name,
      toString() {
        let string = `${name}`;
        if (mutableIdKey) {
          const mutableId = this[mutableIdKey];
          if (mutableId !== undefined) {
            string += `[${mutableIdKey}=${mutableId}]`;
            return string;
          }
        }
        const id = this[idKey];
        if (id) {
          string += `[${idKey}=${id}]`;
        }
        return string;
      },
    };

    store = arraySignalStore([], idKey, {
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
    });
    Object.assign(resourceInstance, { store });
  }

  const shouldAutoreloadGetMany = createShouldAutoreloadAfter(
    autoreloadGetManyAfter,
  );
  const shouldAutoreloadGet = createShouldAutoreloadAfter(autoreloadGetAfter);

  const httpActionWeakSet = createIterableWeakSet();
  const findAliveActionsMatching = (predicate) => {
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

  const triggerAfterEffects = (action) => {
    autoreload: {
      const getManyAutoreload = shouldAutoreloadGetMany(action);
      const getAutoreload = shouldAutoreloadGet(action);
      if (!getManyAutoreload && !getAutoreload) {
        break autoreload;
      }
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
      const toReloadSet = findAliveActionsMatching(predicate);
      reloadActions(toReloadSet, {
        reason: `${action} triggered`,
      });
    }
  };

  http_methods: {
    const { idKey, name } = resourceInstance;

    const getCallerInfo = () => {
      const originalPrepareStackTrace = Error.prepareStackTrace;
      try {
        Error.prepareStackTrace = (_, stack) => stack;

        const error = new Error();
        const stack = error.stack;

        if (stack && stack.length > 2) {
          // stack[0] = getCallerInfo function
          // stack[1] = the method calling getCallerInfo (get, post, etc.)
          // stack[2] = actual caller (user code)
          const callerFrame = stack[2];

          return {
            file: callerFrame.getFileName(),
            line: callerFrame.getLineNumber(),
            column: callerFrame.getColumnNumber(),
            function: callerFrame.getFunctionName() || "<anonymous>",
            raw: callerFrame.toString(),
          };
        }

        return { raw: "unknown" };
      } finally {
        // ✅ Always restore original prepareStackTrace
        Error.prepareStackTrace = originalPrepareStackTrace;
      }
    };

    sourceStore = sourceStore || store;
    const targetStore = store;

    const httpMethods = {
      get: (callback, options) => {
        const callerInfo = getCallerInfo();

        const getAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (props) => {
            if (!isProps(props)) {
              if (targetStore !== sourceStore) {
                return null;
              }
              throw new TypeError(
                `${actionTrace} must return an object (that will be used to upsert "${name}" resource), received ${props}.`,
              );
            }
            const item = targetStore.upsert(props);
            const itemId = item[idKey];
            return itemId;
          }),
          {
            meta: { httpVerb: "GET", httpMany: false },
            name: `${name}.get`,
            compute: (itemId) => targetStore.select(itemId),
            ...options,
          },
        );
        const actionTrace = `${getAction} (${callerInfo.file}:${callerInfo.line}:${callerInfo.column})`;
        httpActionWeakSet.add(getAction);

        return getAction;
      },
      post: (callback, options) => {
        const postAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (props) => {
            const item = targetStore.upsert(props);
            triggerAfterEffects(postAction);
            const itemId = item[idKey];
            return itemId;
          }),
          {
            meta: { httpVerb: "POST", httpMany: false },
            name: `${name}.post`,
            compute: (itemId) => targetStore.select(itemId),
            ...options,
          },
        );
        return postAction;
      },
      put: (callback, options) => {
        const putAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (props) => {
            if (!isProps(props)) {
              throw new TypeError(
                `${putAction} must return an object (that will be used to update "${name}" resource), received ${props}.`,
              );
            }
            const item = sourceStore.upsert(props);
            triggerAfterEffects(putAction);
            const itemId = item[idKey];
            return itemId;
          }),
          {
            meta: { httpVerb: "PUT", httpMany: false },
            name: `${name}.put`,
            compute: (itemId) => targetStore.select(itemId),
            ...options,
          },
        );
        return putAction;
      },
      patch: (callback, options) => {
        const patchAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (props) => {
            const item = sourceStore.upsert(props);
            triggerAfterEffects(patchAction);
            const itemId = item[idKey];
            return itemId;
          }),
          {
            meta: { httpVerb: "PATCH", httpMany: false },
            name: `${name}.patch`,
            compute: (itemId) => targetStore.select(itemId),
            ...options,
          },
        );
        return patchAction;
      },
      delete: (callback, options) => {
        const deleteAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (itemId) => {
            targetStore.drop(itemId);
            triggerAfterEffects(deleteAction);
            return itemId;
          }),
          {
            meta: { httpVerb: "DELETE", httpMany: false },
            name: `${name}.delete`,
            compute: (itemId) => targetStore.select(itemId),
            ...options,
          },
        );
        return deleteAction;
      },

      getMany: (callback, options) => {
        const getManyAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (propsArray) => {
            const itemArray = targetStore.upsert(propsArray);
            triggerAfterEffects(getManyAction);
            const idArray = itemArray.map((item) => item[idKey]);
            return idArray;
          }),
          {
            meta: { httpVerb: "GET", httpMany: true },
            name: `${name}.getMany`,
            data: [],
            compute: (idArray) => targetStore.selectAll(idArray),
            ...options,
          },
        );

        httpActionWeakSet.add(getManyAction);

        return getManyAction;
      },
      postMany: (callback, options) => {
        const postManyAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (propsArray) => {
            const itemArray = targetStore.upsert(propsArray);
            triggerAfterEffects(postManyAction);
            const idArray = itemArray.map((item) => item[idKey]);
            return idArray;
          }),
          {
            meta: { httpVerb: "POST", httpMany: true },
            name: `${name}.postMany`,
            data: [],
            compute: (idArray) => targetStore.selectAll(idArray),
            ...options,
          },
        );
        return postManyAction;
      },
      putMany: (callback, options) => {
        const putManyAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (propsArray) => {
            const itemArray = targetStore.upsert(propsArray);
            triggerAfterEffects(putManyAction);
            const idArray = itemArray.map((item) => item[idKey]);
            return idArray;
          }),
          {
            meta: { httpVerb: "PUT", httpMany: true },
            name: `${name}.putMany`,
            data: [],
            compute: (idArray) => targetStore.selectAll(idArray),
            ...options,
          },
        );
        return putManyAction;
      },
      patchMany: (callback, options) => {
        const patchManyAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (propsArray) => {
            const itemArray = targetStore.upsert(propsArray);
            triggerAfterEffects(patchManyAction);
            const idArray = itemArray.map((item) => item[idKey]);
            return idArray;
          }),
          {
            meta: { httpVerb: "PATCH", httpMany: true },
            name: `${name}.patchMany`,
            data: [],
            compute: (idArray) => targetStore.selectAll(idArray),
            ...options,
          },
        );
        return patchManyAction;
      },
      deleteMany: (callback, options) => {
        const deleteManyAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (idArray) => {
            targetStore.drop(idArray);
            triggerAfterEffects(deleteManyAction);
            return idArray;
          }),
          {
            meta: { httpVerb: "DELETE", httpMany: true },
            name: `${name}.deleteMany`,
            data: [],
            compute: (idArray) => targetStore.selectAll(idArray),
            ...options,
          },
        );
        return deleteManyAction;
      },
    };

    for (const key of Object.keys(rest)) {
      const method = httpMethods[key];
      if (!method) {
        continue;
      }
      const action = method(rest[key]);
      resourceInstance[key] = action;
    }
  }

  {
    resourceInstance.one = (propertyName, childResource, options) => {
      const childIdKey = childResource.idKey;
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
      return resource(`${name}.${propertyName}`, {
        sourceStore: store,
        store: childResource.store,
        idKey: childIdKey,
        ...options,
      });
    };
    resourceInstance.many = (propertyName, childResource, options) => {
      const childIdKey = childResource.idKey;

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
          const childItemArray =
            childResource.store.selectAll(childItemIdArray);
          Object.defineProperty(childItemArray, SYMBOL_OBJECT_SIGNAL, {
            value: childItemArraySignal,
            writable: false,
            enumerable: false,
            configurable: false,
          });
          return childItemArray;
        });

        if (debug) {
          console.debug(
            `setup ${item}.${propertyName} is many "${childResource.name}" (current value: ${childItemArraySignal.peek()})`,
          );
        }

        Object.defineProperty(item, propertyName, {
          get: () => {
            const childItemArray = childItemArraySignal.value;
            if (debug) {
              console.debug(
                `return ${childItemArray} for ${item}.${propertyName}`,
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

      // getMany -> retournes la liste des items dans cette collection?
      // get -> retourne un item de cette collection
      // put -> modifie un item a la collec par id
      // patch -> update toutes la liste d'un coup (il faut passer tous les ids)
      // delete -> supprime un item
      // put many -> modified plusieurs item
      // delete many -> supprime plusieurs item
      // post -> ajoute dans la collect
      // postMany -> ajoute plusieurs items dans la collec

      // const addToCollection = (item, childProps) => {
      //   const childItemArray = item[propertyName];
      //   const childIdToAdd = childProps[childResource.idKey];
      //   for (const existingChildItem of childItemArray) {
      //     if (existingChildItem[childResource.idKey] === childIdToAdd) {
      //       return existingChildItem;
      //     }
      //   }
      //   const childItem = childResource.store.upsert(childProps);
      //   const childItemArrayWithNewChild = [...childItemArray, childItem];
      //   store.upsert(item, { [propertyName]: childItemArrayWithNewChild });
      //   return childItem;
      // };
      // const removeFromCollection = (item, childProps) => {
      //   const childItemArray = item[propertyName];
      //   let childItemIndex = -1;
      //   const childItemArrayWithoutThisOne = [];
      //   const idToRemove = childProps[childIdKey];
      //   let i = 0;
      //   for (const childItem of childItemArray) {
      //     if (childItem[childIdKey] === idToRemove) {
      //       childItemIndex = i;
      //     } else {
      //       childItemArrayWithoutThisOne.push(childItem);
      //     }
      //     i++;
      //   }
      //   if (childItemIndex === -1) {
      //     return false;
      //   }
      //   store.upsert(item, { [propertyName]: childItemArrayWithoutThisOne });
      //   return true;
      // };

      return resource(`${name}.${propertyName}`, {
        sourceStore: store,
        store: childResource.store,
        idKey: childIdKey,
        ...options,
      });
    };
  }

  return resourceInstance;
};

const isProps = (value) => {
  return value !== null && typeof value === "object";
};

const primitiveCanBeId = (value) => {
  const type = typeof value;
  if (type === "string" || type === "number" || type === "symbol") {
    return true;
  }
  return false;
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

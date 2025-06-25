import { computed, signal } from "@preact/signals";
import { createAction, reloadActions } from "./actions.js";
import { arraySignalStore } from "./array_signal_store.js";
import { SYMBOL_IDENTITY } from "./compare_two_js_values.js";

let debug = true;

export const resource = (
  name,
  {
    sourceStore,
    store,
    idKey,
    mutableIdKey,
    autoreloadGetManyAfter = ["post", "delete"],
    autoreloadGetAfter = false,
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

  const methodsForStore = createMethodsForStore({
    sourceStore: sourceStore || store,
    targetStore: store,
    resourceInstance,
    autoreloadGetManyAfter,
    autoreloadGetAfter,
  });
  Object.assign(resourceInstance, methodsForStore);

  {
    const describe = (description) => {
      const info = {};
      for (const key of Object.keys(description)) {
        const value = description[key];
        if (!value) {
          continue;
        }
        if (value.isResource) {
          const childResourceSingleton = one(value, key);
          info[key] = childResourceSingleton;
          continue;
        }
        if (Array.isArray(value) && value.length === 1 && value[0].isResource) {
          const childResourceCollection = many(value[0], key);
          info[key] = childResourceCollection;
          continue;
        }
      }
      return info;
    };
    const primitiveCanBeId = (value) => {
      const type = typeof value;
      if (type === "string" || type === "number" || type === "symbol") {
        return true;
      }
      return false;
    };

    const one = (childResource, propertyName) => {
      const childIdKey = childResource.idKey;
      resourceInstance.addItemSetup((item) => {
        const childItemIdSignal = signal();
        let preferItem = false;
        const updateChildItemId = (value) => {
          if (value !== null && typeof value === "object") {
            preferItem = true;
            const childItem = childResource.store.upsert(value);
            const childItemId = childItem[childIdKey];
            childItemIdSignal.value = childItemId;
            return;
          }
          preferItem = false;
          if (primitiveCanBeId(value)) {
            const childItemProps = { [childIdKey]: value };
            const childItem = childResource.store.upsert(childItemProps);
            const childItemId = childItem[childIdKey];
            childItemIdSignal.value = childItemId;
            return;
          }
          childItemIdSignal.value = undefined;
        };
        updateChildItemId(item[propertyName]);

        const childItemSignal = computed(() => {
          const childItemId = childItemIdSignal.value;
          const childItem = childResource.store.select(childItemId);
          return childItem;
        });
        if (debug) {
          console.debug(
            `setup ${item}.${propertyName} one-to-one with "${childResource.name}" (current value: ${childItemSignal.peek()})`,
          );
        }

        Object.defineProperty(item, propertyName, {
          get: () => {
            const childItem = childItemSignal.value;
            if (preferItem) {
              if (debug) {
                console.debug(
                  `return ${childItem} for ${item}.${propertyName}`,
                );
              }
              return childItem;
            }
            const childItemId = childItemIdSignal.peek();
            if (debug) {
              console.debug(
                `return ${childItemId} for ${item}.${propertyName}`,
              );
            }
            return childItemId;
          },
          set: (value) => {
            updateChildItemId(value);
            if (debug) {
              if (preferItem) {
                console.debug(
                  `${item}.${propertyName} updated to ${childItemSignal.peek()}`,
                );
              } else {
                console.debug(
                  `${item}.${propertyName} updated to ${childItemIdSignal.peek()}`,
                );
              }
            }
          },
        });
      });
      // lorsqu'on call get sur ce sous objet
      // il faut qu'on stocke sur celui-ci par contre
      return resource(`${name}.${propertyName}`, {
        sourceStore: store,
        store: childResource.store,
        idKey: childIdKey,
      });
    };
    const many = (childResource, propertyName) => {
      const childIdKey = childResource.idKey;

      const addToCollection = (item, childProps) => {
        const childItemArray = item[propertyName];
        const childIdToAdd = childProps[childResource.idKey];
        for (const existingChildItem of childItemArray) {
          if (existingChildItem[childResource.idKey] === childIdToAdd) {
            return existingChildItem;
          }
        }
        const childItem = childResource.store.upsert(childProps);
        const childItemArrayWithNewChild = [...childItemArray, childItem];
        store.upsert(item, { [propertyName]: childItemArrayWithNewChild });
        return childItem;
      };
      const removeFromCollection = (item, childProps) => {
        const childItemArray = item[propertyName];
        let childItemIndex = -1;
        const childItemArrayWithoutThisOne = [];
        const idToRemove = childProps[childIdKey];
        let i = 0;
        for (const childItem of childItemArray) {
          if (childItem[childIdKey] === idToRemove) {
            childItemIndex = i;
          } else {
            childItemArrayWithoutThisOne.push(childItem);
          }
          i++;
        }
        if (childItemIndex === -1) {
          return false;
        }
        store.upsert(item, { [propertyName]: childItemArrayWithoutThisOne });
        return true;
      };
      const childItemArrayMap = new Map();
      resourceInstance.addItemSetup((item) => {
        const childItemArray = [];
        childItemArray.add = addToCollection.bind(item);
        childItemArray.remove = removeFromCollection.bind(item);
        childItemArrayMap.set(item, childItemArray);
        item[propertyName] = childItemArray;
      });
      store.defineGetSet(propertyName, {
        get: (item) => {
          const childItemArray = childItemArrayMap.get(item);
          const childIdArray = childItemArray.map(
            (childItem) => childItem[childIdKey],
          );
          return childResource.store.selectAll(childIdArray);
        },
        set: (item, childPropsArray) => {
          const childItemArray = childResource.store.upsert(childPropsArray);
          store.upsert(item, { [propertyName]: childItemArray });
          childItemArrayMap.set(item, childItemArray);
          return childItemArray;
        },
      });

      return resource(`${name}.${propertyName}`, {
        ownerResource: resourceInstance,
        modelResource: childResource,
      });
    };
    Object.assign(resourceInstance, {
      describe,
    });
  }

  return resourceInstance;
};

const createMethodsForStore = ({
  sourceStore,
  targetStore = sourceStore,
  resourceInstance,
  autoreloadGetManyAfter,
  autoreloadGetAfter,
}) => {
  const { idKey, name } = resourceInstance;

  const shouldAutoreloadGetMany = autoreloadGetManyAfter
    ? (action) => {
        const { httpVerb } = action.meta;
        if (httpVerb === "GET") {
          return false;
        }
        if (
          autoreloadGetManyAfter === "*" ||
          autoreloadGetManyAfter.includes("*") ||
          autoreloadGetManyAfter.includes(httpVerb)
        ) {
          return true;
        }
        return false;
      }
    : () => false;
  const shouldAutoreloadGet = autoreloadGetAfter
    ? (action) => {
        const { httpVerb } = action.meta;
        if (httpVerb === "GET") {
          return false;
        }
        if (
          autoreloadGetAfter === "*" ||
          autoreloadGetAfter.includes("*") ||
          autoreloadGetAfter.includes(httpVerb)
        ) {
          return true;
        }
        return false;
      }
    : () => false;

  const getManyActionWeakRefSet = new Set();
  const getManyActionRegistry = new FinalizationRegistry(() => {
    for (const weakRef of getManyActionWeakRefSet) {
      if (weakRef.deref() === undefined) {
        getManyActionWeakRefSet.delete(weakRef);
      }
    }
  });
  const findActiveGetManyActionsToReload = () => {
    const toReloadSet = new Set();

    for (const weakRef of getManyActionWeakRefSet) {
      const getManyAction = weakRef.deref();
      if (!getManyAction) {
        getManyActionWeakRefSet.delete(weakRef);
        continue;
      }
      const allInstances = getManyAction.matchAllSelfOrDescendant(
        (action) => action.loadRequested,
      );
      for (const instance of allInstances) {
        toReloadSet.add(instance);
      }
    }
    return toReloadSet;
  };
  const triggerAfterEffects = (action) => {
    if (shouldAutoreloadGetMany(action)) {
      const toReloadSet = findActiveGetManyActionsToReload();
      reloadActions(toReloadSet, {
        reason: `${action} triggered`,
      });
    }
    if (shouldAutoreloadGet(action)) {
      const toReloadSet = findActiveGetActionsToReload();
      reloadActions(toReloadSet, {
        reason: `${action} triggered`,
      });
    }
  };

  return {
    get: (callback, options) => {
      const getAction = createAction(
        mapCallbackMaybeAsyncResult(callback, (props) => {
          const item = targetStore.upsert(props);
          const itemId = item[idKey];
          return itemId;
        }),
        {
          meta: { httpVerb: "GET" },
          name: `${name}.get`,
          compute: (itemId) => targetStore.select(itemId),
          ...options,
        },
      );
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
          meta: { httpVerb: "POST" },
          name: `${name}.post`,
          compute: (idOrIdArray) => targetStore.select(idOrIdArray),
          ...options,
        },
      );
      return postAction;
    },
    put: (callback, options) => {
      const putAction = createAction(
        mapCallbackMaybeAsyncResult(callback, (props) => {
          const item = targetStore.upsert(props);
          triggerAfterEffects(putAction);
          const itemId = item[idKey];
          return itemId;
        }),
        {
          meta: { httpVerb: "PUT" },
          name: `${name}.put`,
          compute: (idOrIdArray) => targetStore.select(idOrIdArray),
          ...options,
        },
      );
      return putAction;
    },
    patch: (callback, options) => {
      const patchAction = createAction(
        mapCallbackMaybeAsyncResult(callback, (props) => {
          const item = targetStore.upsert(props);
          triggerAfterEffects(patchAction);
          const itemId = item[idKey];
          return itemId;
        }),
        {
          meta: { httpVerb: "PATCH" },
          name: `${name}.patch`,
          compute: (idOrIdArray) => targetStore.select(idOrIdArray),
          ...options,
        },
      );
      return patchAction;
    },
    delete: (callback, options) => {
      const deleteAction = createAction(
        mapCallbackMaybeAsyncResult(callback, (id) => {
          targetStore.drop(id);
          triggerAfterEffects(deleteAction);
          return id;
        }),
        {
          meta: { httpVerb: "DELETE" },
          name: `${name}.delete`,
          compute: (id) => targetStore.select(id),
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
          meta: { httpVerb: "GET" },
          name: `${name}.getMany`,
          data: [],
          compute: (idArray) => targetStore.selectAll(idArray),
          ...options,
        },
      );

      const weakRef = new WeakRef(getManyAction);
      getManyActionWeakRefSet.add(weakRef);
      getManyActionRegistry.register(getManyAction);

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
          meta: { httpVerb: "POST" },
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
          meta: { httpVerb: "PUT" },
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
          meta: { httpVerb: "PATCH" },
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
          meta: { httpVerb: "DELETE" },
          name: `${name}.deleteMany`,
          data: [],
          compute: (idArray) => targetStore.selectAll(idArray),
          ...options,
        },
      );
      return deleteManyAction;
    },
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

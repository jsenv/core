import { computed, signal } from "@preact/signals";
import { createAction } from "./actions.js";
import { arraySignalStore } from "./array_signal_store.js";
import { SYMBOL_IDENTITY } from "./compare_two_js_values.js";

let debug = true;

export const resource = (
  name,
  { sourceStore, store, idKey, mutableIdKey } = {},
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
}) => {
  const { idKey, name } = resourceInstance;

  const targetStoreMethodEffects = {
    post: (propsOrPropsArray) => {
      return targetStore.upsert(propsOrPropsArray);
    },
    put: (propsOrPropsArray) => {
      return targetStore.upsert(propsOrPropsArray);
    },
    patch: (propsOrPropsArray) => {
      return targetStore.upsert(propsOrPropsArray);
    },
    delete: (itemIdOrItemIdArray) => {
      return targetStore.drop(itemIdOrItemIdArray);
    },
  };

  return {
    getAll: (callback, options) => {
      const getAllAction = createAction(
        mapCallbackMaybeAsyncResult(callback, (propsArray) => {
          const itemArray = targetStore.upsert(propsArray);
          const idArray = itemArray.map((item) => item[idKey]);
          return idArray;
        }),
        {
          name: `${name}.getAll`,
          data: [],
          compute: (idArray) => {
            const itemArray = targetStore.selectAll(idArray);
            return itemArray;
          },
          ...options,
        },
      );
      return getAllAction;
    },
    get: (callback, options) => {
      if (sourceStore === targetStore) {
        const getAction = createAction(
          mapCallbackMaybeAsyncResult(callback, (props) => {
            const item = targetStore.upsert(props);
            return item;
          }),
          {
            name: `${name}.get`,
            ...options,
          },
        );
        return getAction;
      }
      const getAction = createAction(
        mapCallbackMaybeAsyncResult(callback, (props) => {
          const item = targetStore.upsert(props);
          const id = item[idKey];
          return id;
        }),
        {
          name: `${name}.get`,
          compute: (id) => {
            return targetStore.select(id);
          },
          ...options,
        },
      );
      return getAction;
    },
    post: (callback, options) => {
      const postAction = createAction(
        mapCallbackMaybeAsyncResult(callback, targetStoreMethodEffects.post),
        {
          name: `${name}.post`,
          ...options,
        },
      );
      return postAction;
    },
    put: (callback, options) => {
      const putAction = createAction(
        mapCallbackMaybeAsyncResult(callback, targetStoreMethodEffects.put),
        {
          name: `${name}.put`,
          ...options,
        },
      );
      return putAction;
    },
    patch: (callback, options) => {
      const patchAction = createAction(
        mapCallbackMaybeAsyncResult(callback, targetStoreMethodEffects.patch),
        {
          name: `${name}.patch`,
          ...options,
        },
      );
      return patchAction;
    },
    delete: (callback, options) => {
      const deleteAction = createAction(
        mapCallbackMaybeAsyncResult(callback, targetStoreMethodEffects.delete),
        {
          name: `${name}.delete`,
          ...options,
        },
      );
      return deleteAction;
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

import { computed, signal } from "@preact/signals";
import { createActionTemplate } from "./actions.js";
import { arraySignalStore } from "./array_signal_store.js";
import { SYMBOL_IDENTITY } from "./compare_two_js_values.js";

const itemActionMapSymbol = Symbol("item_action_map");

let debug = true;

export const getItemAction = (item, actionTemplate) => {
  const itemActionMap = item[itemActionMapSymbol];
  if (!itemActionMap) {
    console.error(item);
    throw new Error(`itemActionMap is not defined on item`);
  }
  const action = itemActionMap.get(actionTemplate);
  return action;
};

export const resource = (
  name,
  { sourceStore, store, idKey = "id", mutableIdKey } = {},
) => {
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
        Object.defineProperty(item, itemActionMapSymbol, {
          enumerable: true,
          writable: true,
          value: new Map(),
        });
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
    const one = (childResource, propertyName) => {
      const childIdKey = childResource.idKey;
      resourceInstance.addItemSetup((item) => {
        let childProps = item[propertyName];
        if (debug) {
          console.log(
            `setup ${item[idKey]}.${propertyName} one-to-one with "${childResource[childIdKey]}" item (current value: ${childProps ? childProps[childIdKey] : "null"})`,
          );
        }
        const signal = computed(() => {
          const childItemId = childProps ? childProps[childIdKey] : null;
          const childItem = childResource.store.select(childItemId);
          return childItem;
        });

        Object.defineProperty(item, propertyName, {
          get: () => {
            const childItem = signal.value;
            if (debug) {
              console.log(
                `return ${childItem ? childItem[childIdKey] : "null"} for ${item[idKey]}.${propertyName}`,
              );
            }
            return childItem;
          },
          set: (value) => {
            if (debug) {
              console.log(
                `update ${item[idKey]}.${propertyName} from ${childProps ? childProps[childIdKey] : "null"} to ${value ? value[idKey] : "null"}`,
              );
            }
            childProps = value;
            childResource.store.upsert(childProps);
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

  resourceInstance.useItemSignal = (initialValue) => {
    const idSignal = signal(initialValue);
    const itemSignal = computed(() => {
      const id = idSignal.value;
      if (!id) {
        return null;
      }
      const item = store.upsert({ [idKey]: id });
      return item;
    });
    return [
      itemSignal,
      (value) => {
        const id = value && typeof value === "object" ? value[idKey] : value;
        idSignal.value = id;
      },
    ];
  };

  return resourceInstance;
};

const createMethodsForStore = ({
  sourceStore,
  targetStore = sourceStore,
  resourceInstance,
}) => {
  const { idKey, name } = resourceInstance;

  const idArraySignal = signal([]);
  const targetStoreMethodEffects = {
    getAll: (propsArray) => {
      const itemArray = targetStore.upsert(propsArray);
      const idArray = itemArray.map((item) => item[idKey]);
      idArraySignal.value = idArray;
      return itemArray;
    },
    get: (props) => {
      return targetStore.upsert(props);
    },
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

  const autoAssociateItemAction = (actionTemplate) => {
    resourceInstance.addItemSetup((item) => {
      const itemAction = actionTemplate.bindParams({
        [idKey]: item[idKey],
      });
      item[itemActionMapSymbol].set(actionTemplate, itemAction);
    });
  };

  return {
    getAll: (callback, options) => {
      const getAllActionTemplate = createActionTemplate(
        mapCallbackMaybeAsyncResult(callback, targetStoreMethodEffects.getAll),
        {
          name: `${name}.getAll`,
          data: [],
          computedDataSignal: computed(() => {
            const idArray = idArraySignal.value;
            return targetStore.selectAll(idArray);
          }),
          ...options,
        },
      );
      return getAllActionTemplate;
    },
    get: (callback, options) => {
      const getActionTemplate = createActionTemplate(
        mapCallbackMaybeAsyncResult(callback, targetStoreMethodEffects.get),
        {
          name: `${name}.get`,
          ...options,
        },
      );
      autoAssociateItemAction(getActionTemplate);
      // store.registerPropertyLifecycle(resource.activeItemSignal, key, {
      //   changed: () => {
      //     // updateMatchingActionParams(getActionTemplate, { [key]: value });
      //   },
      //   dropped: (value) => {
      //     reloadActions({ reason: `${value} dropped` });
      //   },
      //   reinserted: (value) => {
      //     // this will reload all actions already matching which works but
      //     // - most of the time only "getAction" is impacted, any other action could stay as is
      //     // - we already have the data, reloading the action will refetch the backend which is unnecessary
      //     // we could just eventual action error (which is cause by 404 likely)
      //     // to actually let the data be displayed
      //     // because they are available, but in reality the action has no data
      //     // because the fetch failed
      //     // so conceptually reloading is fine,
      //     // the only thing that bothers me a little is that it reloads all other actions
      //     //  but thing is it might have impact on other actions so let's keep as is for now
      //     reloadActions({ reason: `${value} reinserted` });
      //   },
      // });
      return getActionTemplate;
    },
    post: (callback, options) => {
      const postActionTemplate = createActionTemplate(
        mapCallbackMaybeAsyncResult(callback, targetStoreMethodEffects.post),
        {
          name: `${name}.post`,
          ...options,
        },
      );
      return postActionTemplate;
    },
    put: (callback, options) => {
      const putActionTemplate = createActionTemplate(
        mapCallbackMaybeAsyncResult(callback, targetStoreMethodEffects.put),
        {
          name: `${name}.put`,
          ...options,
        },
      );
      autoAssociateItemAction(putActionTemplate);
      return putActionTemplate;
    },
    patch: (callback, options) => {
      const patchActionTemplate = createActionTemplate(
        mapCallbackMaybeAsyncResult(callback, targetStoreMethodEffects.patch),
        {
          name: `${name}.patch`,
          ...options,
        },
      );
      autoAssociateItemAction(patchActionTemplate);
      return patchActionTemplate;
    },
    delete: (callback, options) => {
      const deleteActionTemplate = createActionTemplate(
        mapCallbackMaybeAsyncResult(callback, targetStoreMethodEffects.delete),
        {
          name: `${name}.delete`,
          ...options,
        },
      );
      autoAssociateItemAction(deleteActionTemplate);
      return deleteActionTemplate;
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

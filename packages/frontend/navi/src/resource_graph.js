import { computed, signal } from "@preact/signals";
import { createAction, createActionTemplate } from "./actions.js";
import { arraySignalStore } from "./array_signal_store.js";

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
  { sourceStore, store, idKey = "id", activeIdSignal = signal(null) } = {},
) => {
  const resourceInstance = {
    isResource: true,
    name,
    idKey,
  };

  if (!store) {
    store = arraySignalStore([], idKey, { name: `${name} store` });
    const useArray = () => {
      return store.arraySignal.value;
    };
    const useById = (id) => {
      return store.select(idKey, id);
    };
    const activeItemSignal = computed(() => {
      const activeId = activeIdSignal.value;
      return store.select(activeId);
    });
    const useActiveItem = () => {
      const activeItem = activeItemSignal.value;
      return activeItem;
    };

    Object.assign(resourceInstance, {
      activeItemSignal,
      useArray,
      useById,
      useActiveItem,
    });
    store.addSetup((item) => {
      if (debug) {
        console.log(`setup ${item.id}[itemActionMapSymbol]`);
      }
      Object.defineProperty(item, itemActionMapSymbol, {
        enumerable: true,
        writable: true,
        value: new Map(),
      });
    });
    Object.assign(resourceInstance, { store });
  }

  const methodsForStore = createMethodsForStore({
    sourceStore: sourceStore || store,
    targetStore: store,
    resource: resourceInstance,
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
      store.addSetup((item) => {
        let childProps = item[propertyName];
        if (debug) {
          console.log(
            `setup ${item.id}.${propertyName} one-to-one with "${childResource.name}" item (current value: ${childProps ? childProps[childIdKey] : "null"})`,
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
                `return ${childItem ? childItem.id : "null"} for ${item.id}.${propertyName}`,
              );
            }
            return childItem;
          },
          set: (value) => {
            if (debug) {
              console.log(
                `update ${item.id}.${propertyName} from ${childProps ? childProps.id : "null"} to ${value ? value.id : "null"}`,
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
      store.addSetup((item) => {
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
  resource,
}) => {
  const { name } = resource;
  const targetStoreMethodEffects = {
    get: (props) => {
      return targetStore.upsert(props);
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
        (params) => {
          const callbackResult = callback(params);
          if (callbackResult && typeof callbackResult.then === "function") {
            return callbackResult.then((propsArray) => {
              const itemArray = targetStore.upsert(propsArray);
              return itemArray;
            });
          }
          const propsArray = callbackResult;
          const itemArray = targetStore.upsert(propsArray);
          return itemArray;
        },
        {
          name: `getAll ${name}`,
          initialData: [],
          ...options,
        },
      );
      return getAllAction;
    },
    get: (callback, options) => {
      const activeParamsSignal = computed(() => {
        const activeItem = resource.activeItemSignal.value;
        return activeItem;
      });
      const getActionTemplate = createActionTemplate(
        async (params) => {
          const props = await callback(params);
          const item = targetStoreMethodEffects.get(props);
          return item;
        },
        {
          name: `get ${name}`,
          activeParamsSignal,
          ...options,
        },
      );

      sourceStore.addSetup((item) => {
        const itemGetAction = getActionTemplate.withParams(item);
        item[itemActionMapSymbol].set(getActionTemplate, itemGetAction);
      });

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
    put: (callback, options) => {
      const putActionTemplate = createActionTemplate(
        async (params) => {
          const propsOrPropsArray = await callback(params);
          const itemOrItemArray =
            targetStoreMethodEffects.put(propsOrPropsArray);
          return itemOrItemArray;
        },
        {
          name: `put ${name}`,
          ...options,
        },
      );
      sourceStore.addSetup((item) => {
        const itemPutAction = putActionTemplate.withParams(item);
        item[itemActionMapSymbol].set(itemPutAction, putActionTemplate);
      });
      return putActionTemplate;
    },
    patch: (callback, options) => {
      const patchActionTemplate = createActionTemplate(
        async (params) => {
          const propsOrPropsArray = await callback(params);
          return targetStoreMethodEffects.patch(propsOrPropsArray);
        },
        {
          name: `patch ${name}`,
          ...options,
        },
      );
      sourceStore.addSetup((item) => {
        const itemPatchAction = patchActionTemplate.withParams(item);
        item[itemActionMapSymbol].set(itemPatchAction, patchActionTemplate);
      });
      return patchActionTemplate;
    },
    delete: (callback, options) => {
      const deleteActionTemplate = createActionTemplate(
        async (params) => {
          const itemIdOrItemIdArray = await callback(params);
          return targetStoreMethodEffects.delete(itemIdOrItemIdArray);
        },
        {
          name: `delete ${name}`,
          ...options,
        },
      );
      sourceStore.addSetup((item) => {
        const itemDeleteAction = deleteActionTemplate.withParams(item);
        item[itemActionMapSymbol].set(itemDeleteAction, deleteActionTemplate);
      });
      return deleteActionTemplate;
    },
  };
};

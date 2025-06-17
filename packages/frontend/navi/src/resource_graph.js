import { computed, effect, signal } from "@preact/signals";
import {
  registerAction,
  reloadActions,
  updateMatchingActionParams,
} from "./actions.js";
import { arraySignalStore } from "./array_signal_store.js";

export const resource = (name, { idKey = "id" } = {}) => {
  const oneToOnePropertyMap = new Map();
  const oneToManyPropertyMap = new Map();
  const store = arraySignalStore([], idKey);

  const useArray = () => {
    return store.arraySignal.value;
  };
  const useById = (id) => {
    return store.select(idKey, id);
  };

  const activeIdSignal = signal(null);
  const activeItemSignal = computed(() => {
    const activeItemId = activeIdSignal.value;
    return store.select(activeItemId);
  });
  const useActiveItem = () => {
    const activeItem = activeItemSignal.value;
    return activeItem;
  };
  const setActiveItem = (props) => {
    const item = store.upsert(props);
    activeIdSignal.value = item[idKey];
  };

  return {
    name,
    store,

    useArray,
    useById,
    useActiveItem,
    setActiveItem,

    one: (childResource, propertyName) => {
      oneToOnePropertyMap.set(propertyName, childResource);
      const childIdKey = childResource.idKey;
      const childItemInfoMap = new Map();
      const getChildItemInfo = (item) => {
        const existingChildItemInfo = childItemInfoMap.get(item);
        if (existingChildItemInfo) {
          return existingChildItemInfo;
        }
        const childItemSignal = computed(() => {
          const childItem = item[propertyName];
          const childItemId = childItem ? childItem[childIdKey] : null;
          return childResource.store.select(childItemId);
        });
        childItemInfoMap.set(item, {
          value: undefined,
          signal: childItemSignal,
        });
        return childItemSignal;
      };
      store.defineGetSet(propertyName, {
        get: (item) => {
          const childItemInfo = getChildItemInfo(item);
          return childItemInfo.signal.value;
        },
        set: (item, value) => {
          const childItemInfo = getChildItemInfo(item);
          childItemInfo.value = value;
          const childItem = childResource.store.upsert(value);
          return childItem;
        },
      });
    },

    many: (childResource, propertyName) => {
      oneToManyPropertyMap.set(propertyName, childResource);
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
      store.defineObjectCreator(propertyName, (item) => {
        const childItemArray = [];
        childItemArray.add = addToCollection.bind(item);
        childItemArray.remove = removeFromCollection.bind(item);
        childItemArrayMap.set(item, childItemArray);
        return childItemArray;
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

      return resource(`${name}.${propertyName}`);
    },
    getAll: (callback) => {
      const getAllAction = addAction(async (params) => {
        const propsArray = await callback(params);
        const itemArray = store.upsert(propsArray);
        return itemArray;
      }, `getAll ${name}`);
      return getAllAction;
    },
    get: (callback, { key = idKey } = {}) => {
      const getAction = addAction(async (params) => {
        const props = await callback(params);
        const item = store.upsert(props);
        return item;
      }, `get ${name}`);

      effect(() => {
        const isMatching = getAction.isMatchingSignal.value;
        const actionParams = getAction.paramsSignal.value;
        const activeItem = store.select(key, actionParams[key]);
        if (isMatching) {
          const activeItemId = activeItem ? activeItem[idKey] : null;
          activeIdSignal.value = activeItemId;
        } else {
          activeIdSignal.value = null;
        }
      });

      store.registerPropertyLifecycle(activeItemSignal, key, {
        changed: (value) => {
          updateMatchingActionParams(getAction, { [key]: value });
        },
        dropped: (value) => {
          reloadActions([getAction], { reason: `${value} dropped` });
        },
        reinserted: (value) => {
          // this will reload all actions already matching which works but
          // - most of the time only "getAction" is impacted, any other action could stay as is
          // - we already have the data, reloading the action will refetch the backend which is unnecessary
          // we could just eventual action error (which is cause by 404 likely)
          // to actually let the data be displayed
          // because they are available, but in reality the action has no data
          // because the fetch failed
          // so conceptually reloading is fine,
          // the only thing that bothers me a little is that it reloads all other actions
          //  but thing is it might have impact on other actions so let's keep as is for now
          reloadActions({ reason: `${value} reinserted` });
        },
      });

      return getAction;
    },
    put: (callback) => {
      return addAction(async (params) => {
        const propsOrPropsArray = await callback(params);
        const itemOrItemArray = store.upsert(propsOrPropsArray);
        return itemOrItemArray;
      }, `put ${name}`);
    },
    delete: (callback) => {
      return addAction(async (params) => {
        const itemIdOrItemIdArray = await callback(params);
        return store.drop(itemIdOrItemIdArray);
      }, `delete ${name}`);
    },
  };
};

const addAction = (callback, name) => {
  const action = registerAction(callback, { name });
  return action;
};

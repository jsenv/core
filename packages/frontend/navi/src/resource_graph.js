import { computed, signal } from "@preact/signals";
import {
  createAction,
  createActionTemplate,
  reloadActions,
} from "./actions.js";
import { arraySignalStore } from "./array_signal_store.js";

const itemActionMapSymbol = Symbol("item_action_map");

export const getItemAction = (item, actionTemplate) => {
  const itemActionMap = item[itemActionMapSymbol];
  const action = itemActionMap.get(actionTemplate);
  return action;
};

export const resource = (name, { idKey = "id" } = {}) => {
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

  store.addSetup((item) => {
    Object.defineProperty(item, itemActionMapSymbol, {
      enumerable: true,
      writable: true,
      value: new Map(),
    });
  });

  let describe;
  {
    describe = (description) => {
      const info = {};
      for (const key of Object.keys(description)) {
        const value = description[key];
        if (!value) {
          continue;
        }
        if (value.isResource) {
          one(value, key);
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

      return resource(`${name}.${propertyName}`);
    };
  }

  return {
    isResource: true,
    name,
    store,

    useArray,
    useById,
    useActiveItem,
    setActiveItem,

    getAll: (callback, options) => {
      const getAllAction = createAction(
        (params) => {
          const callbackResult = callback(params);
          if (callbackResult && typeof callbackResult.then === "function") {
            return callbackResult.then((propsArray) => {
              const itemArray = store.upsert(propsArray);
              return itemArray;
            });
          }
          const propsArray = callbackResult;
          const itemArray = store.upsert(propsArray);
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
    get: (callback, { key = idKey, ...options } = {}) => {
      const getActionTemplate = createActionTemplate(
        async (params) => {
          const props = await callback(params);
          const item = store.upsert(props);
          return item;
        },
        {
          name: `get ${name}`,
          // WARNING: this should be enabled only if the action is used to display the main content of the page
          // because only then it makes sense to prevent loading something user don't need anymore
          // if this action is used to let's say load an item details
          // and UI displays a list of item with details
          // we could totally want to load many item details in parallel
          oneActiveActionAtATime: true,
          ...options,
        },
      );

      store.addSetup((item) => {
        const itemGetAction = getActionTemplate.withParams(item);
        item[itemActionMapSymbol].set(getActionTemplate, itemGetAction);
      });

      // effect(() => {
      //   const isMatching = getActionTemplate.isMatchingSignal.value;
      //   const actionParams = getActionTemplate.paramsSignal.value;
      //   const activeItem = store.select(key, actionParams[key]);
      //   if (isMatching) {
      //     const activeItemId = activeItem ? activeItem[idKey] : null;
      //     activeIdSignal.value = activeItemId;
      //   } else {
      //     activeIdSignal.value = null;
      //   }
      // });

      store.registerPropertyLifecycle(activeItemSignal, key, {
        changed: () => {
          // updateMatchingActionParams(getActionTemplate, { [key]: value });
        },
        dropped: (value) => {
          reloadActions({ reason: `${value} dropped` });
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
      return getActionTemplate;
    },
    put: (callback, options) => {
      const putActionTemplate = createActionTemplate(
        async (params) => {
          const propsOrPropsArray = await callback(params);
          const itemOrItemArray = store.upsert(propsOrPropsArray);
          return itemOrItemArray;
        },
        {
          name: `put ${name}`,
          ...options,
        },
      );
      store.addSetup((item) => {
        const itemPutAction = putActionTemplate.withParams(item);
        item[itemActionMapSymbol].set(itemPutAction, putActionTemplate);
      });
      return putActionTemplate;
    },
    delete: (callback, options) => {
      const deleteActionTemplate = createActionTemplate(
        async (params) => {
          const itemIdOrItemIdArray = await callback(params);
          return store.drop(itemIdOrItemIdArray);
        },
        {
          name: `delete ${name}`,
          ...options,
        },
      );
      store.addSetup((item) => {
        const itemDeleteAction = deleteActionTemplate.withParams(item);
        item[itemActionMapSymbol].set(itemDeleteAction, deleteActionTemplate);
      });
      return deleteActionTemplate;
    },
    describe,
  };
};

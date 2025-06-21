/*
 * certaines actions ne devrait pas rester dans activationRegistry, je vois pas l'interet
 * genre tout ce qui est PUT/DELETE/POST/PATCH c'est du volatile
 * (quoiqu'on pourrait imaginer une UI qui affiche le résulat d'un POST et le user choisi
 * ce qu'il fait ensuite, dans ce cas action.active doit rester true ainsi que sa data)
 *
 * mais on peut surement obtenir cela puisque si personne ne sinteresse a l'action est est garbage collect
 * donc en fait on est good
 * -> si aucune UI ne se branche sur ces actions elle reste brievement dans la mémoire de l'appli
 * -> si une UI se branche, elle y reste jusqu'à ce que l'utilisateur quitte la page
 *
 *
 * En fait les actions ne devraint pas avoir de notion de "active" je crois...
 * Le truc c'est que si je suis sur la page
 *
 * - users/:userId
 *
 *   pour savoir qui est actif je peux regarder l'url
 *   -> donc c'est bien sur le template qu'on dit qui est actif
 *   je peux faire const currentUserGetAction = userGetActionTemplate.withParams({ userId }) et
 *   la on se moque si on est actif ou pas
 *   lorsqu'on reçoit une action on peut
 *   const currentUserId = currentUserIdSignal.value
 *   const active = currentUserGetAction.params.userId === currentUserId;
 *
 *  le souci du coup c'est le action renderer qui ne marche plus du coup
 *   puisqu'une action n'a plus le concept de "actif"
 *
 *   tout ça c'est parce que je veux pas que les actions getUser puisse etre unload
 *   ou considérer inactif lorsqu'on passe sur une page qui mettons affiche plusieurs users
 *   et la le concept de current user ne s'applique plus mais on veut pouvoir utiliser l'action
 *   getUser qui existe deja
 *
 *   on pourrait avoir un concept d'action active ou non par contre ....
 *
 *   genre on bind un action template a un activeSignal et cette action par contre
 *   la elle a le concept de "active"
 */

import { batch, computed, effect, signal } from "@preact/signals";
import { createWeakCacheMap } from "./weak_cache_map.js";

let debug = true;

export const IDLE = { id: "idle" };
export const LOADING = { id: "loading" };
export const ABORTED = { id: "aborted" };
export const FAILED = { id: "failed" };
export const LOADED = { id: "loaded" };

// intermediate function representing the fact we'll use navigation.navigate update action and get a signal
export const requestActionsUpdates = ({
  preloadSet,
  loadSet,
  unloadSet,
  isReload,
  reason,
}) => {
  const signal = new AbortController().signal;
  return updateActions({
    signal,
    preloadSet,
    loadSet,
    unloadSet,
    isReload,
    reason,
  });
};
export const reloadActions = async (actionSet, { reason } = {}) => {
  return requestActionsUpdates({
    loadSet: actionSet,
    reason,
    isReload: true,
  });
};
export const abortPendingActions = (
  reason = "abortPendingActions was called",
) => {
  const { loadingSet } = activationRegistry.getInfo();
  const unloadSet = loadingSet;
  return requestActionsUpdates({
    unloadSet,
    reason,
  });
};

const actionAbortMap = new Map();
const actionPromiseMap = new Map();
const activationRegistry = (() => {
  const actionToIdMap = new WeakMap();
  const idToActionMap = new Map();
  let nextId = 1;

  return {
    add(action) {
      let id = actionToIdMap.get(action);
      if (id === undefined) {
        id = nextId++;
        actionToIdMap.set(action, id);
      }
      idToActionMap.set(id, new WeakRef(action));
    },

    delete(action) {
      const id = actionToIdMap.get(action);
      if (id !== undefined) {
        idToActionMap.delete(id);
      }
    },

    has(action) {
      const id = actionToIdMap.get(action);
      if (id === undefined) {
        return false;
      }

      const weakRef = idToActionMap.get(id);
      const actionRef = weakRef?.deref();

      if (!actionRef) {
        idToActionMap.delete(id);
        return false;
      }

      return true;
    },

    getInfo() {
      const loadingSet = new Set();
      const loadedSet = new Set();

      for (const [id, weakRef] of idToActionMap) {
        const action = weakRef.deref();
        if (action) {
          if (action.loadingState === LOADING) {
            loadingSet.add(action);
          } else if (action.loadingState === LOADED) {
            loadedSet.add(action);
          } else {
            throw new Error(
              `An action in the activation registry should be LOADING or LOADED, but got "${action.loadingState.id}" for action "${action.name}"`,
            );
          }
        } else {
          idToActionMap.delete(id);
        }
      }
      return {
        loadingSet,
        loadedSet,
      };
    },

    clear() {
      idToActionMap.clear();
    },
  };
})();

export const updateActions = ({
  signal,
  isReload = false,
  isReplace = false,
  reason,
  preloadSet = new Set(),
  loadSet = new Set(),
  unloadSet = new Set(),
} = {}) => {
  if (!signal) {
    const abortController = new AbortController();
    signal = abortController.signal;
  }

  const { loadingSet, loadedSet } = activationRegistry.getInfo();

  if (debug) {
    console.group(`updateActions()`);
    const lines = [
      ...(preloadSet.size
        ? [`- preload requested: ${Array.from(preloadSet).join(", ")}`]
        : []),
      ...(loadSet.size
        ? [`- load requested: ${Array.from(loadSet).join(", ")}`]
        : []),
      ...(unloadSet.size
        ? [`- unload requested: ${Array.from(unloadSet).join(", ")}`]
        : []),
    ];
    console.debug(
      `${lines.join("\n")}
- meta: { reason: ${reason}, isReload: ${isReload}, isReplace ${isReplace} }`,
    );
  }
  const toUnloadSet = new Set();
  const toPreloadSet = new Set();
  const toLoadSet = new Set();
  const toPromoteSet = new Set();
  const staysLoadingSet = new Set();
  const staysLoadedSet = new Set();
  list_to_unload: {
    for (const actionToUnload of unloadSet) {
      if (actionToUnload.loadingState !== IDLE) {
        toUnloadSet.add(actionToUnload);
      }
    }
  }
  list_to_preload_and_to_load: {
    const onActionToLoadOrPreload = (actionToLoadOrPreload, isPreload) => {
      if (
        actionToLoadOrPreload.loadingState === LOADING ||
        actionToLoadOrPreload.loadingState === LOADED
      ) {
        // by default when an action is already loading/loaded
        // requesting to load it does nothing so that:
        // - clicking a link already active in the UI does nothing
        // - requesting to load an action already pending does not abort + reload it
        //   (instead it stays pending)
        //   only trying to load this action with other params
        //   would abort the current one and load an other.
        // in order to load the same action code has to do one of:
        // - unload it first
        // - request unload + load at the same time
        // - use isReload: true when requesting the load of this action
        //   this is default when using action.load()
        if (isReload || toUnloadSet.has(actionToLoadOrPreload)) {
          toUnloadSet.add(actionToLoadOrPreload);
          if (isPreload) {
            toPreloadSet.add(actionToLoadOrPreload);
          } else {
            toLoadSet.add(actionToLoadOrPreload);
          }
        } else {
        }
      } else if (isPreload) {
        toPreloadSet.add(actionToLoadOrPreload);
      } else {
        toLoadSet.add(actionToLoadOrPreload);
      }
    };
    for (const actionToPreload of preloadSet) {
      if (loadSet.has(actionToPreload)) {
        // load wins over preload
        continue;
      }
      onActionToLoadOrPreload(actionToPreload, true);
    }
    for (const actionToLoad of loadSet) {
      if (!actionToLoad.loadRequested && actionToLoad.loadingState !== IDLE) {
        // was preloaded but is not requested to load
        // -> can move to load requested state no matter the loading state
        toPromoteSet.add(actionToLoad);
        continue;
      }
      onActionToLoadOrPreload(actionToLoad, false);
    }
  }
  const thenableArray = [];
  list_stays_loading_and_stays_loaded: {
    for (const actionLoading of loadingSet) {
      if (toUnloadSet.has(actionLoading)) {
        // will be unloaded (aborted), we don't want to wait
      } else if (
        toLoadSet.has(actionLoading) ||
        toPreloadSet.has(actionLoading)
      ) {
        // will be loaded, we'll wait for the new load promise
      } else {
        // an action that was loading and not affected by this update
        const actionPromise = actionPromiseMap.get(actionLoading);
        thenableArray.push(actionPromise);
        staysLoadingSet.add(actionLoading);
      }
    }
    for (const actionLoaded of loadedSet) {
      if (toUnloadSet.has(actionLoaded)) {
        // will be unloaded
      } else {
        staysLoadedSet.add(actionLoaded);
      }
    }
  }
  if (debug) {
    const lines = [
      ...(toUnloadSet.size
        ? [`- to unload: ${Array.from(toUnloadSet).join(", ")}`]
        : []),
      ...(toPreloadSet.size
        ? [`- to preload: ${Array.from(toPreloadSet).join(", ")}`]
        : []),
      ...(toPromoteSet.size
        ? [`- to promote: ${Array.from(toPromoteSet).join(", ")}`]
        : []),
      ...(toLoadSet.size
        ? [`- to load: ${Array.from(toLoadSet).join(", ")}`]
        : []),
      ...(staysLoadingSet.size
        ? [`- stays loading: ${Array.from(staysLoadingSet).join(", ")}`]
        : []),
      ...(staysLoadedSet.size
        ? [`- stays loaded: ${Array.from(staysLoadedSet).join(", ")}`]
        : []),
    ];
    console.debug(`situation before updating actions:
${lines.join("\n")}`);
  }

  peform_unloads: {
    for (const actionToUnload of toUnloadSet) {
      const actionToUnloadPrivateProperties =
        getActionPrivateProperties(actionToUnload);
      actionToUnloadPrivateProperties.performUnload(reason);
      activationRegistry.delete(actionToUnload);
    }
  }
  perform_preloads_and_loads: {
    const onActionToLoadOrPreload = (actionToPreloadOrLoad, isPreload) => {
      const actionToLoadPrivateProperties = getActionPrivateProperties(
        actionToPreloadOrLoad,
      );
      const loadPromise = actionToLoadPrivateProperties.performLoad({
        signal,
        reason,
        isPreload,
      });
      activationRegistry.add(actionToPreloadOrLoad);
      if (
        // sync actions are already done, no need to wait for activate promise
        actionToPreloadOrLoad.loadingState === LOADED
      ) {
      } else {
        actionPromiseMap.set(actionToPreloadOrLoad, loadPromise);
        thenableArray.push(loadPromise);
      }
    };
    for (const actionToPreload of toPreloadSet) {
      onActionToLoadOrPreload(actionToPreload, true);
    }
    for (const actionToLoad of toLoadSet) {
      onActionToLoadOrPreload(actionToLoad, false);
    }
    for (const actionToPromote of toPromoteSet) {
      const actionToPromotePrivateProperties =
        getActionPrivateProperties(actionToPromote);
      actionToPromotePrivateProperties.loadRequestedSignal.value = true;
    }
  }
  if (debug) {
    console.groupEnd();
  }
  if (thenableArray.length) {
    return Promise.all(thenableArray);
  }
  return null;
};

const initialParamsDefault = {};
const actionPrivatePropertiesWeakMap = new WeakMap();
const getActionPrivateProperties = (action) => {
  const actionPrivateProperties = actionPrivatePropertiesWeakMap.get(action);
  if (!actionPrivateProperties) {
    throw new Error(`Cannot find action private properties for "${action}"`);
  }
  return actionPrivateProperties;
};

const itemAsHumanString = (item) => {
  if (!item) {
    return String(item);
  }
  if (Object.hasOwn(item, "toString")) {
    return item.toString();
  }
  if (Object.hasOwn(item, "name")) {
    return item.name;
  }
  if (Object.hasOwn(item, "id")) {
    return item.id;
  }
  const toStringTag = item[Symbol.toStringTag];
  if (toStringTag) {
    return toStringTag;
  }
  return toString(item);
};

const ACTION_ITEM_IDENTITY_SYMBOL = Symbol("action_item_identity");
export const createActionTemplate = (
  callback,
  {
    name = callback.name || "anonymous",
    params: initialParams = initialParamsDefault,
    data: initialData,
    renderLoadedAsync,
    sideEffect = () => {},
    keepOldData = false,
  } = {},
) => {
  const instantiate = (
    item,
    { instanceName = name, instanceParams = initialParams } = {},
  ) => {
    instanceName = generateActionName(instanceName, item, instanceParams);
    const itemSignal = signal(item);
    let params = instanceParams;
    const paramsSignal = signal(params);

    let loadRequested = false;
    const loadRequestedSignal = signal(loadRequested);
    let loadingState = IDLE;
    const loadingStateSignal = signal(loadingState);
    let error;
    const errorSignal = signal(null);
    let data = initialData;
    const dataSignal = signal(initialData);

    const withParams = (newParamsSignal, newParamsMapper) => {
      const boundAction = instantiate(item);
      effect(() => {
        let newParams = newParamsSignal.value;
        newParams = newParamsMapper(newParams);
        const combinedParams =
          instanceParams === initialParamsDefault
            ? newParams
            : { ...instanceParams, ...newParams };
        const boundActionPrivateProperties =
          getActionPrivateProperties(boundAction);
        boundActionPrivateProperties.paramsSignal.value = combinedParams;
        boundAction.reload();
      });
      return boundAction;
    };

    const preload = () => {
      return requestActionsUpdates({
        preloadSet: new Set([action]),
      });
    };
    const load = (options) =>
      requestActionsUpdates({
        loadSet: new Set([action]),
        ...options,
      });
    const reload = (options) => {
      return load({ isReload: true, ...options });
    };
    const unload = () =>
      requestActionsUpdates({
        unloadSet: new Set([action]),
      });

    const action = {
      name: instanceName,
      item,
      params,
      loadingState,
      loadRequested,
      error,
      data,
      preload,
      load,
      reload,
      unload,
      withParams,
      toString: () => name,
    };
    Object.preventExtensions(action);
    effects: {
      const actionWeakRef = new WeakRef(action);
      const actionWeakEffect = (callback) => {
        const dispose = effect(() => {
          const actionRef = actionWeakRef.deref();
          if (actionRef) {
            callback(actionRef);
          } else {
            dispose();
          }
        });
      };
      actionWeakEffect((actionRef) => {
        item = itemSignal.value;
        actionRef.item = item;
      });
      actionWeakEffect((actionRef) => {
        params = paramsSignal.value;
        actionRef.params = params;
      });
      actionWeakEffect((actionRef) => {
        loadRequested = loadRequestedSignal.value;
        actionRef.loadRequested = loadRequested;
      });
      actionWeakEffect((actionRef) => {
        loadingState = loadingStateSignal.value;
        actionRef.loadingState = loadingState;
      });
      actionWeakEffect((actionRef) => {
        error = errorSignal.value;
        actionRef.error = error;
      });
      actionWeakEffect((actionRef) => {
        data = dataSignal.value;
        actionRef.data = data;
      });
    }
    private_properties: {
      const ui = {
        renderLoaded: null,
        renderLoadedAsync,
      };
      let sideEffectCleanup;
      const performLoad = (loadParams) => {
        const {
          signal,
          // reason,
          isPreload,
        } = loadParams;
        const abortController = new AbortController();
        const abortSignal = abortController.signal;
        const abort = (reason) => {
          if (debug) {
            console.log(`"${action}": abort activation.`);
          }
          loadingStateSignal.value = ABORTED;
          abortController.abort(reason);
          actionAbortMap.delete(action);
        };
        const onabort = () => {
          abort(signal.reason);
        };
        signal.addEventListener("abort", onabort);
        actionAbortMap.set(action, abort);

        batch(() => {
          errorSignal.value = null;
          loadingStateSignal.value = LOADING;
          if (!isPreload) {
            loadRequestedSignal.value = true;
          }
        });

        const returnValue = sideEffect(params);
        if (typeof returnValue === "function") {
          sideEffectCleanup = returnValue;
        }

        let loadResult;
        const onLoadEnd = () => {
          dataSignal.value = loadResult;
          loadingStateSignal.value = LOADED;
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
        };
        const onLoadError = (e) => {
          console.error(e);
          signal.removeEventListener("abort", onabort);
          actionAbortMap.delete(action);
          actionPromiseMap.delete(action);
          if (abortSignal.aborted && e === abortSignal.reason) {
            loadingStateSignal.value = ABORTED;
            return;
          }
          batch(() => {
            errorSignal.value = e;
            loadingStateSignal.value = FAILED;
          });
        };

        const secondParam =
          params === initialParamsDefault
            ? loadParams
            : { ...loadParams, ...params };

        try {
          const thenableArray = [];
          const callbackResult = callback(item, secondParam);
          if (callbackResult && typeof callbackResult.then === "function") {
            thenableArray.push(callbackResult);
            callbackResult.then((value) => {
              loadResult = value;
            });
          } else {
            loadResult = callbackResult;
          }
          const renderLoadedAsync = ui.renderLoadedAsync;
          if (renderLoadedAsync) {
            const renderLoadedPromise = renderLoadedAsync(
              item,
              secondParam,
            ).then((renderLoaded) => {
              ui.renderLoaded = () => renderLoaded;
            });
            thenableArray.push(renderLoadedPromise);
          }
          if (thenableArray.length === 0) {
            onLoadEnd();
            return undefined;
          }
          return Promise.all(thenableArray).then(
            () => {
              onLoadEnd();
            },
            (e) => {
              onLoadError(e);
            },
          );
        } catch (e) {
          onLoadError(e);
        }
        return undefined;
      };
      const performUnload = (reason) => {
        const abort = actionAbortMap.get(action);
        if (abort) {
          if (debug) {
            console.log(`"${action}": aborting (reason: ${reason})`);
          }
          abort(reason);
        } else if (debug) {
          console.log(`"${action}": unload route (reason: ${reason})`);
        }
        if (sideEffectCleanup) {
          sideEffectCleanup(reason);
          sideEffectCleanup = undefined;
        }
        actionPromiseMap.delete(action);
        batch(() => {
          errorSignal.value = null;
          if (!keepOldData) {
            dataSignal.value = initialData;
          }
          loadRequestedSignal.value = false;
          loadingStateSignal.value = IDLE;
        });
      };
      const actionPrivateProperties = {
        initialParams: instanceParams,
        initialData,

        itemSignal,
        paramsSignal,
        loadingStateSignal,
        loadRequestedSignal,
        dataSignal,
        errorSignal,

        performLoad,
        performUnload,
        ui,
      };
      actionPrivatePropertiesWeakMap.set(action, actionPrivateProperties);
    }
    return action;
  };

  const generateActionName = (name, item, params) => {
    let actionName = name;
    if (item) {
      actionName += `: ${itemAsHumanString(item)}`;
    }
    if (params !== initialParamsDefault) {
      actionName += generateParamsSuffix(params);
    }
    return actionName;
  };
  const generateParamsSuffix = (params) => {
    if (params === null || typeof params !== "object") {
      return `, ${params}`;
    }
    const keys = Object.keys(params);
    if (keys.length === 0) {
      return "";
    }
    return `, { ${JSON.stringify(params)} }`;
  };

  const actionItemWeakMap = createWeakCacheMap();
  const actionItemIdentityWeakMap = new WeakMap();
  const memoizedInstantiate = (item, options) => {
    const actionForItem = actionItemWeakMap.get(item);
    if (actionForItem) {
      return actionForItem;
    }
    const isObject = item && typeof item === "object";
    if (!isObject) {
      const action = instantiate(item, options);
      actionItemWeakMap.set(item, action);
      return action;
    }
    let itemIdentity;
    if (Object.hasOwn(item, ACTION_ITEM_IDENTITY_SYMBOL)) {
      itemIdentity = item[ACTION_ITEM_IDENTITY_SYMBOL];
      const actionForItemIdentity = actionItemIdentityWeakMap.get(itemIdentity);
      if (actionForItemIdentity) {
        const actionPrivateProperties = getActionPrivateProperties(
          actionForItemIdentity,
        );
        actionPrivateProperties.itemSignal.value = item;
        return actionForItemIdentity;
      }
    } else {
      // we would not need this if we rely on item id
      // but at action are better decouple by not knowing what is newParams
      // and not force the presence of an id on the object
      // instead we prefer to set a symbol that will be forward even when params are modified
      // because array_signal_store.js uses Object.getOwnPropertyDescriptors which copy symbols
      // as a result an item can be recognized and we return the same action for the "same" item
      // an other approach would be to keep the object identity in array_signal_store.js
      // but that means using a Proxy to transform all object properties into signals
      // so that later on preact can detect changes
      // it's simpler and more robust to actually change the object identity when it changes
      // (because I'm not sure what would happen if the preact component was trying to read a non existing property for instance)
      itemIdentity = Symbol(`action_${itemAsHumanString(item)}_identity`);
      Object.defineProperty(item, ACTION_ITEM_IDENTITY_SYMBOL, {
        value: itemIdentity,
        writable: false,
        enumerable: false,
        configurable: false,
      });
    }
    const action = instantiate(item, options);
    actionItemWeakMap.set(item, action);
    actionItemIdentityWeakMap.set(itemIdentity, action);
    return action;
  };

  const actionTemplate = {
    name,
  };
  actionTemplate.instantiate = memoizedInstantiate;

  const actionSignal = (itemSignal, { autoload } = {}) => {
    return computed(() => {
      const item = itemSignal.value;
      const action = memoizedInstantiate(item);
      if (item && autoload) {
        action.load();
      }
      return action;
    });
  };
  actionTemplate.actionSignal = actionSignal;
  actionTemplate.isTemplate = true;

  return actionTemplate;
};

export const createAction = (callback, options) => {
  return createActionTemplate(callback, options).instantiate();
};

export const useActionStatus = (action) => {
  if (action.isTemplate) {
    throw new Error(
      `useActionStatus() cannot be used on an action template, only on an action.`,
    );
  }

  const {
    itemSignal,
    paramsSignal,
    loadingStateSignal,
    loadRequestedSignal,
    errorSignal,
    dataSignal,
  } = getActionPrivateProperties(action);

  const item = itemSignal.value;
  const params = paramsSignal.value;
  const error = errorSignal.value;
  const loadRequested = loadRequestedSignal.value;
  const loadingState = loadingStateSignal.value;
  const idle = loadingState === IDLE;
  const pending = loadingState === LOADING;
  const aborted = loadingState === ABORTED;
  const preloaded = loadingState === LOADED && !loadRequested;
  const data = dataSignal.value;

  return {
    active: true,
    item,
    params,
    idle,
    error,
    aborted,
    pending,
    preloaded,
    data,
  };
};

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    // important sinon les actions ne se mettent pas a jour
    // par example action.ui.load DOIT etre appelé
    // pour que ui.renderLoaded soit la
    if (debug) {
      console.debug("updateActions() on hot reload");
    }
    updateActions({ isReload: true });
  });
}

import { computed } from "@preact/signals";

import { actionRunEffect } from "../action/action_run_effect.js";

export const routeAction = (
  route,
  action,
  paramsEffect = () => route.paramsSignal.value,
) => {
  const actionBoundToRoute = actionRunEffect(action, () => {
    const matching = route.matchingSignal.value;
    const params = paramsEffect();
    if (!matching) {
      return null;
    }
    return params;
  });

  // If the action is related to a store of items
  // we want to keep the url in sync with the item id of the store when it changes
  // This way whenever an item with a mutable id is updated, the url is also updated
  // (renaming a user while being on the user page)
  // In case the route does not use this param, then this code won't have an effect
  // To work the route params MUST use the same name (case sensitive) as the mutable id key
  // so "/users/:id/" with mutableIdKey "id" will work but "/users/:userId/" with mutableIdKey "id" won't work
  sync_url_and_item_id: {
    const { store } = actionBoundToRoute.meta;
    if (!store) {
      break sync_url_and_item_id;
    }
    const { mutableIdKeys } = store;
    const [firstMutableIdKey] = mutableIdKeys;
    if (!firstMutableIdKey) {
      break sync_url_and_item_id;
    }
    const mutableIdValueSignal = computed(() => {
      const params = route.paramsSignal.value;
      const mutableIdValue = params[firstMutableIdKey];
      return mutableIdValue;
    });
    const routeItemSignal = store.signalForMutableIdKey(
      firstMutableIdKey,
      mutableIdValueSignal,
    );
    store.observeItemProperties(routeItemSignal, (propertyMutations) => {
      const mutableIdPropertyMutation = propertyMutations[firstMutableIdKey];
      if (!mutableIdPropertyMutation) {
        return;
      }
      route.replaceParams(
        {
          [firstMutableIdKey]: mutableIdPropertyMutation.newValue,
        },
        {
          callReason: `store item ${firstMutableIdKey} change on ${route}`,
        },
      );
    });
  }

  return actionBoundToRoute;
};

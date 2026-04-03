import { computed } from "@preact/signals";

import { actionRunEffect } from "../action/action_run_effect.js";

export const routeAction = (
  route,
  action,
  paramsEffect = () => route.paramsSignal.value,
  options = {},
) => {
  const actionBoundToRoute = actionRunEffect(
    action,
    () => {
      const matching = route.matchingSignal.value;
      const params = paramsEffect();
      if (!matching) {
        return null;
      }
      return params;
    },
    options,
  );

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
    const { uniqueKeys } = store;
    const [firstUniqueKey] = uniqueKeys;
    if (!firstUniqueKey) {
      break sync_url_and_item_id;
    }
    const uniqueValueSignal = computed(() => {
      const params = route.paramsSignal.value;
      const uniqueKeyValue = params[firstUniqueKey];
      return uniqueKeyValue;
    });
    const routeItemSignal = store.signalForUniqueKey(
      firstUniqueKey,
      uniqueValueSignal,
    );
    store.observeItemProperties(routeItemSignal, (propertyMutations) => {
      const uniquePropertyMutation = propertyMutations[firstUniqueKey];
      if (!uniquePropertyMutation) {
        return;
      }
      route.replaceParams(
        {
          [firstUniqueKey]: uniquePropertyMutation.newValue,
        },
        {
          callReason: `store item ${firstUniqueKey} change on ${route}`,
        },
      );
    });
  }

  return actionBoundToRoute;
};

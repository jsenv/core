import { computed } from "@preact/signals";

export const connectStoreAndRoute = (store, route, { itemKey, paramKey }) => {
  const activeItemSignal = computed(() => {
    const isMatching = route.isMatchingSignal.value;
    const params = route.paramsSignal.value;
    if (!isMatching) {
      return null;
    }
    const activeItem = store.select(itemKey, params[paramKey]);
    return activeItem;
  });

  store.propertyChangeEffect(activeItemSignal, itemKey, (value) => {
    route.replaceParams({
      [paramKey]: value,
    });
  });
  store.deleteEffect(activeItemSignal, () => {
    route.reload();
  });
};

import { computed } from "@preact/signals";

export const connectStoreAndRoute = (store, route, key) => {
  const activeItemSignal = computed(() => {
    const isMatching = route.isMatchingSignal.value;
    const params = route.paramsSignal.value;
    const activeItem = store.select(key, params[key]);
    if (!isMatching) {
      return null;
    }
    return activeItem;
  });

  store.propertyChangeEffect(activeItemSignal, key, (value) => {
    route.replaceParams({
      [key]: value,
    });
  });
  store.deleteEffect(activeItemSignal, () => {
    route.reload();
  });
};

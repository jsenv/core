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

  store.registerPropertyLifecycle(activeItemSignal, key, {
    changed: (value) => {
      route.replaceParams({
        [key]: value,
      });
    },
    dropped: () => {
      route.reload();
    },
    reinserted: () => {
      route.reload();
    },
  });
};

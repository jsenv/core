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
      // this will reload all routes which works but
      // - most of the time only "route" is impacted, any other route could stay as is
      // - we already have the data, reloading the route will refetch the backend which is unnecessary
      // we could just remove routing error (which is cause by 404 likely)
      // to actually let the data be displayed
      // because they are available, but in reality the route has no data
      // because the fetch failed
      // so conceptually reloading is fine,
      // the only thing that bothers me a little is that it reloads all routes
      route.reload();
    },
  });
};

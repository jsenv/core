import { Suspense } from "preact/compat";

import { LoadingContext } from "./use_async_data.js";

export const Loading = ({ children, fallback }) => {
  if (!fallback) {
    // No fallback — children handle loading state via useAsyncData({ loading })
    return (
      <LoadingContext.Provider value={{ hasFallback: false }}>
        {children}
      </LoadingContext.Provider>
    );
  }
  return (
    <LoadingContext.Provider value={{ hasFallback: true }}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </LoadingContext.Provider>
  );
};

import { Suspense } from "preact/compat";

import { useErrorSilenced } from "./error_boundary.jsx";
import { LoadingContext } from "./use_async_data.js";

export const Loading = ({ children, fallback }) => {
  const silenced = useErrorSilenced();
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
      <Suspense fallback={silenced ? null : fallback}>{children}</Suspense>
    </LoadingContext.Provider>
  );
};

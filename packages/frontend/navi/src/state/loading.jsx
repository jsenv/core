import { Suspense } from "preact/compat";

import { useErrorSilenced } from "./error_boundary.jsx";
import { LoadingContext } from "./use_async_data.js";

export const Loading = ({ children, fallback }) => {
  const silenced = useErrorSilenced();
  if (silenced) {
    // Error was dismissed — render nothing until the components starts
    // again to load
    return null;
  }
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

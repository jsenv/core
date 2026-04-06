import { createContext } from "preact";
import { Suspense } from "preact/compat";
import { useContext } from "preact/hooks";

export const LoadingHasFallbackContext = createContext(false);
export const useLoadingHasFallback = () => {
  return useContext(LoadingHasFallbackContext);
};

export const Loading = ({ children, fallback }) => {
  if (!fallback) {
    // No fallback — children handle loading state via useAsyncData({ loading })
    return children;
  }
  return (
    <LoadingHasFallbackContext.Provider value={true}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </LoadingHasFallbackContext.Provider>
  );
};

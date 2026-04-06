import { createContext, h } from "preact";
import { useErrorBoundary } from "preact/hooks";

const ErrorBoundaryContext = createContext();
export const ErrorBoundary = ({ children, fallback }) => {
  const [error, resetError] = useErrorBoundary();
  if (error) {
    if (!fallback) {
      return null;
    }
    error.__handled_by__ = "<ErrorBoundary>"; // prevent jsenv from displaying it
    if (typeof fallback === "function") {
      return h(fallback, { error, resetError });
    }
    return fallback;
  }
  return (
    <ErrorBoundaryContext.Provider value={true}>
      {children}
    </ErrorBoundaryContext.Provider>
  );
};

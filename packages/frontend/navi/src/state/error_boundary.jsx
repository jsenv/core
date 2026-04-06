import { useErrorBoundary } from "preact/hooks";

export const ErrorBoundary = ({ children, fallback }) => {
  const [error, resetError] = useErrorBoundary();
  if (error) {
    if (!fallback) {
      return null;
    }
    error.__handled__ = true; // prevent jsenv from displaying it
    if (typeof fallback === "function") {
      return fallback(error, { resetError });
    }
    return fallback;
  }
  return <>{children}</>;
};

import { useErrorBoundary } from "preact/hooks";

export const ErrorBoundary = ({ children, fallback }) => {
  const [error] = useErrorBoundary();
  if (error) {
    return fallback;
  }
  return <>{children}</>;
};

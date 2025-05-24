import { createContext } from "preact";
import { useContext } from "preact/hooks";

export const ErrorBoundaryContext = createContext(null);

export const useResetErrorBoundary = () => {
  const resetErrorBoundary = useContext(ErrorBoundaryContext);
  return resetErrorBoundary;
};

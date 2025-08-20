import { createContext } from "preact";
import { useContext } from "preact/hooks";

const ContentKeyContext = createContext();

export const ContentKeyProvider = ({ value, children }) => {
  return (
    <ContentKeyContext.Provider value={value}>
      {children}
    </ContentKeyContext.Provider>
  );
};

export const useContentKeyContext = () => {
  const resetErrorBoundary = useContext(ContentKeyContext);
  return resetErrorBoundary;
};

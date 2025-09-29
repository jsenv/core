import { createContext } from "preact";
import { useContext, useRef } from "preact/hooks";

/**
 * Creates a parent-child index tracking system using context and refs.
 * Useful for scenarios where children need stable indices even when they re-render independently.
 *
 * @returns {Object} Object containing the provider component, parent hook, and child hook
 */
export const createChildIndexTracker = () => {
  const GenerationContext = createContext();
  const ChildrenRefContext = createContext();

  /**
   * Hook for parent components to manage child index generation
   * @param {Object} childrenRef - Ref to the children array that will be reset and managed
   * @returns {Object} Object with ChildIndexProvider component and generation number
   */
  const useChildIndexParent = (childrenRef) => {
    const renderCountRef = useRef(0);

    // Reset children array when parent re-renders to ensure sync with child components
    childrenRef.current = [];

    // Increment render count to signal to child components that they should recalculate their index
    renderCountRef.current += 1;

    const ChildIndexTrackerProviderRef = useRef();
    if (!ChildIndexTrackerProviderRef.current) {
      const ChildIndexTrackerProvider = ({ children }) => {
        const generation = renderCountRef.current;
        return (
          <ChildrenRefContext.Provider value={childrenRef}>
            <GenerationContext.Provider value={generation}>
              {children}
            </GenerationContext.Provider>
          </ChildrenRefContext.Provider>
        );
      };
      ChildIndexTrackerProviderRef.current = ChildIndexTrackerProvider;
    }

    return ChildIndexTrackerProviderRef.current;
  };

  /**
   * Hook for child components to get their stable index
   * @returns {number} The child's index in the parent's children array
   */
  const useChildIndex = () => {
    const childrenRef = useContext(ChildrenRefContext);
    const generation = useContext(GenerationContext);
    const generationRef = useRef();
    const prevGeneration = generationRef.current;
    const childIndexRef = useRef();

    let childIndex;
    if (prevGeneration === generation) {
      childIndex = childIndexRef.current;
    } else {
      childIndex = childrenRef.current.length;
      generationRef.current = generation;
      childIndexRef.current = childIndex;
    }

    return childIndex;
  };

  return {
    useChildIndexParent,
    useChildIndex,
  };
};

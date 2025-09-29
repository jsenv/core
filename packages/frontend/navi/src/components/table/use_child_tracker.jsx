import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

const ParentRenderIdContext = createContext();
const ChildIndexCountRefContext = createContext();
const ChildArrayContext = createContext();
export const useChildTrackerProvider = (childArray) => {
  const childIndexCountRef = useRef();
  const renderIdRef = useRef();

  childIndexCountRef.current = 0;
  renderIdRef.current = {};
  const renderId = {};
  renderIdRef.current = renderId;

  return useMemo(() => {
    const ChildTrackerProvider = ({ children }) => (
      <ParentRenderIdContext.Provider value={renderId}>
        <ChildIndexCountRefContext.Provider value={childIndexCountRef}>
          <ChildArrayContext.Provider value={childArray}>
            {children}
          </ChildArrayContext.Provider>
        </ChildIndexCountRefContext.Provider>
      </ParentRenderIdContext.Provider>
    );
    return ChildTrackerProvider;
  }, []);
};

/**
 * Hook for child components to get their stable index
 * @returns {number} The child's index in the parent's children array
 */
export const useTrackChild = (childData) => {
  const childArray = useContext(ChildArrayContext);
  const childIndexCountRef = useContext(ChildIndexCountRefContext);
  const parentRenderId = useContext(ParentRenderIdContext);
  const parentRenderIdRef = useRef();
  const childIndexRef = useRef();
  const prevParentRenderId = parentRenderIdRef.current;

  if (prevParentRenderId === parentRenderId) {
    const childIndex = childIndexRef.current;
    childArray[childIndex] = childData;
    return childIndex;
  }
  const childIndexCount = childIndexCountRef.current;
  const childIndex = childIndexCount;
  childIndexCountRef.current = childIndex + 1;
  parentRenderIdRef.current = parentRenderId;
  childIndexRef.current = childIndex;
  childArray[childIndex] = childData;
  return childIndex;
};

export const useTrackedChild = (childIndex) => {
  const childArrayRef = useContext(ChildArrayContext);
  const childArray = childArrayRef.current;
  return childArray[childIndex];
};

import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

export const useChildrenTracker = () => {
  const childrenRef = useRef([]);
  const children = childrenRef.current;
  children.length = 0;
  return childrenRef;
};
const ChildrenContext = createContext();
export const useChildrenProvider = (childrenRef) => {
  return useMemo(() => {
    const ChildrenProvider = ({ children }) => (
      <ChildrenContext.Provider value={childrenRef}>
        {children}
      </ChildrenContext.Provider>
    );
    return ChildrenProvider;
  }, []);
};

const ParentRenderIdContext = createContext();
const ChildIndexCountRefContext = createContext();
export const useChildTrackerProvider = () => {
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
          {children}
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
  const children = useContext(ChildrenContext);
  const childIndexCountRef = useContext(ChildIndexCountRefContext);
  const parentRenderId = useContext(ParentRenderIdContext);
  const parentRenderIdRef = useRef();
  const childIndexRef = useRef();
  const prevParentRenderId = parentRenderIdRef.current;

  if (prevParentRenderId === parentRenderId) {
    const childIndex = childIndexRef.current;
    children[childIndex] = childData;
    return childIndex;
  }
  const childIndexCount = childIndexCountRef.current;
  const childIndex = childIndexCount;
  childIndexCountRef.current = childIndex + 1;
  parentRenderIdRef.current = parentRenderId;
  childIndexRef.current = childIndex;
  children[childIndex] = childData;
  return childIndex;
};

export const useTrackedChild = (childIndex) => {
  const children = useContext(ChildrenContext);
  const childData = children[childIndex];
  return childData;
};

import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

export const createChildrenTracker = () => {
  const ChildrenContext = createContext();

  const useChildrenTracker = () => {
    const childrenRef = useRef([]);
    return childrenRef.current;
  };
  const useChildren = () => {
    return useContext(ChildrenContext);
  };

  const ParentRenderIdContext = createContext();
  const ChildIndexCountRefContext = createContext();
  const useChildTrackerProvider = () => {
    const children = useContext(ChildrenContext);
    const childIndexCountRef = useRef();
    const renderIdRef = useRef();

    childIndexCountRef.current = 0;
    renderIdRef.current = {};
    const renderId = {};
    renderIdRef.current = renderId;

    children.length = 0;

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

  const useTrackChild = (childData) => {
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

  const useTrackedChild = (childIndex) => {
    const children = useContext(ChildrenContext);
    const childData = children[childIndex];
    return childData;
  };

  return {
    ChildrenContext,
    useChildrenTracker,
    useChildTrackerProvider,
    useTrackChild,
    useTrackedChild,
    useChildren,
  };
};

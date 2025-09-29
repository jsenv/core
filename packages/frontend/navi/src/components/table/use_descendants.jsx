// https://github.com/reach/reach-ui/tree/b3d94d22811db6b5c0f272b9a7e2e3c1bb4699ae/packages/descendants

import { createContext } from "preact";
import { useContext, useMemo, useRef } from "preact/hooks";

import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";

export const createChildTracker = () => {
  const ChildTrackerValuesContext = createContext();
  const ChildTrackerContext = createContext();

  const useChildTrackerProvider = (values, setValues) => {
    const childTracker = useMemo(() => {
      const setValue = (index, value) => {
        setValues((prev) => {
          const newChildren = [...prev];
          newChildren[index] = value;
          return newChildren;
        });
      };

      const reset = () => {
        setValues((prev) => {
          if (prev.length === 0) {
            return prev;
          }
          return [];
        });
      };

      return { setValue, reset };
    }, []);

    const ChildTrackerProvider = useMemo(() => {
      const ChildTrackerProvider = ({ children }) => {
        return (
          <ChildTrackerContext.Provider value={childTracker}>
            {children}
          </ChildTrackerContext.Provider>
        );
      };
      return ChildTrackerProvider;
    }, []);
    ChildTrackerProvider.values = values;

    return ChildTrackerProvider;
  };

  const useValues = () => {
    const values = useContext(ChildTrackerValuesContext);
    return values;
  };

  const ParentRenderIdContext = createContext();
  const ChildCountRefContext = createContext();
  const useTrackChildProvider = () => {
    const childTracker = useContext(ChildTrackerContext);
    const childCountRef = useRef();
    const renderIdRef = useRef();

    childCountRef.current = 0;
    renderIdRef.current = {};
    const renderId = {};
    renderIdRef.current = renderId;

    childTracker.reset();

    return useMemo(() => {
      const TrackChildProvider = ({ children }) => (
        <ParentRenderIdContext.Provider value={renderId}>
          <ChildCountRefContext.Provider value={childCountRef}>
            {children}
          </ChildCountRefContext.Provider>
        </ParentRenderIdContext.Provider>
      );
      return TrackChildProvider;
    }, []);
  };

  const useTrackChild = (childData) => {
    const childTracker = useContext(ChildTrackerContext);
    const childCountRef = useContext(ChildCountRefContext);
    const parentRenderId = useContext(ParentRenderIdContext);
    const parentRenderIdRef = useRef();
    const childIndexRef = useRef();
    const childDataRef = useRef();
    const prevParentRenderId = parentRenderIdRef.current;

    if (prevParentRenderId === parentRenderId) {
      const childIndex = childIndexRef.current;
      if (compareTwoJsValues(childDataRef.current, childData)) {
        return childIndex;
      }
      childTracker.setValue(childIndex, childData);
      childDataRef.current = childData;
      return childIndex;
    }
    const childCount = childCountRef.current;
    const childIndex = childCount;
    childCountRef.current = childIndex + 1;
    parentRenderIdRef.current = parentRenderId;
    childIndexRef.current = childIndex;
    childDataRef.current = childData;
    childTracker.setValue(childIndex, childData);
    return childIndex;
  };

  const useTrackedChild = (childIndex) => {
    const values = useValues();
    const value = values[childIndex];
    return value;
  };

  return {
    ChildTrackerValuesContext,
    useValues,
    useChildTrackerProvider,
    useTrackChildProvider,
    useTrackChild,
    useTrackedChild,
  };
};

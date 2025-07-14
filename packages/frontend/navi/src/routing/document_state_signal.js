import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

export const documentStateSignal = signal(null);
export const useDocumentState = () => {
  return documentStateSignal.value;
};
export const updateDocumentState = (value) => {
  documentStateSignal.value = value;
};

export const createUseElementState = ({
  getDocumentState,
  replaceDocumentState,
}) => {
  const idUsageMap = new Map();
  const useElementStateWithWarnings = (id, initialValue, options) => {
    const idRef = useRef(undefined);
    if (import.meta.dev && idRef.current !== id) {
      const oldId = idRef.current;
      idUsageMap.delete(oldId);
      idRef.current = id;

      const usage = idUsageMap.get(id);
      if (!usage) {
        idUsageMap.set(id, {
          stackTrace: new Error().stack,
        });
      } else {
        console.warn(
          `useElementState ID conflict detected!
ID "${id}" is already in use by another component.
This can cause UI state conflicts and unexpected behavior.
Consider using unique IDs for each component instance.`,
        );
      }
    }

    useEffect(() => {
      return () => {
        idUsageMap.delete(id);
      };
    }, [id]);

    return useElementState(id, initialValue, options);
  };

  const NOT_SET = {};
  const NO_OP = () => {};
  const NO_ID_GIVEN = [undefined, NO_OP, NO_OP];

  const useElementState = (id, initialValue, { debug } = {}) => {
    const elementStateRef = useRef(NOT_SET);
    if (!id) {
      return NO_ID_GIVEN;
    }

    if (elementStateRef.current === NOT_SET) {
      const documentState = getDocumentState();
      const valueInDocumentState = documentState
        ? documentState[id]
        : undefined;
      if (valueInDocumentState === undefined) {
        elementStateRef.current = initialValue;
        if (initialValue !== undefined) {
          console.debug(
            `useElementState(${id}) initial value is ${initialValue} (from initialValue passed in as argument)`,
          );
        }
      } else {
        elementStateRef.current = valueInDocumentState;
        if (debug) {
          console.debug(
            `useElementState(${id}) initial value is ${initialValue} (from nav state)`,
          );
        }
      }
    }

    const set = (value) => {
      const currentValue = elementStateRef.current;
      if (typeof value === "function") {
        value = value(currentValue);
      }
      if (debug) {
        console.debug(
          `useElementState(${id}) set ${value} (previous was ${currentValue})`,
        );
      }

      const currentState = getDocumentState() || {};
      if (value === undefined) {
        delete currentState[id];
      } else {
        currentState[id] = value;
      }
      replaceDocumentState(currentState);
    };

    return [
      elementStateRef.current,
      set,
      () => {
        set(undefined);
      },
    ];
  };

  return import.meta.dev ? useElementStateWithWarnings : useElementState;
};

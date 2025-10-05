import { useContext, useMemo, useRef, useState } from "preact/hooks";

import { FieldGroupOnUIStateChangeContext } from "../field_group_context.js";
import { useInitialValue } from "../use_initial_value.js";
import { useStableCallback } from "../use_stable_callback.js";

export const useValueController = (props, navState) => {
  return useUIStateController(
    props,
    {
      statePropName: "value",
      defaultStatePropName: "defaultValue",
      fallbackState: "",
    },
    navState,
  );
};
export const useUncontrolledValueProps = (props, componentType) => {
  return useUncontrolledUIProps(props, {
    componentType,
    statePropName: "value",
    defaultStatePropName: "defaultValue",
    fallbackState: "",
  });
};

export const useCheckedController = (props, navState) => {
  return useUIStateController(
    props,
    {
      statePropName: "checked",
      defaultStatePropName: "defaultChecked",
      fallbackState: false,
      mapStateValue: Boolean,
    },
    navState,
  );
};
export const useUncontrolledCheckedProps = (props, componentType) => {
  return useUncontrolledUIProps(props, {
    componentType,
    statePropName: "checked",
    defaultStatePropName: "defaultChecked",
    fallbackState: false,
  });
};

const useUIStateController = (
  props,
  { statePropName, defaultStatePropName, fallbackState, mapStateValue },
  navState,
) => {
  let groupOnUIStateChange = useContext(FieldGroupOnUIStateChangeContext);
  const hasUIStateProp = Object.hasOwn(props, statePropName);
  const state = props[statePropName];
  const defaultState = props[defaultStatePropName];
  let { onUIStateChange } = props;
  groupOnUIStateChange = useStableCallback(groupOnUIStateChange);
  onUIStateChange = useStableCallback(onUIStateChange);

  return useMemo(() => {
    const externalStateInitial = useInitialValue(() => {
      if (hasUIStateProp) {
        // controlled by state prop ("value" or "checked")
        return mapStateValue ? mapStateValue(state) : state;
      }
      if (defaultState) {
        // not controlled but want an initial state (a value or being checked)
        return mapStateValue ? mapStateValue(defaultState) : defaultState;
      }
      if (navState) {
        // not controlled but want to use value from nav state
        // (I think this should likely move earlier to win over the hasUIStateProp when it's undefined)
        return mapStateValue ? mapStateValue(navState) : navState;
      }
      return mapStateValue ? mapStateValue(fallbackState) : fallbackState;
    });

    const externalStateRef = useRef(externalStateInitial);
    const [uiState, setUIState] = useState(externalStateInitial);

    const stateRef = useRef(state);
    if (hasUIStateProp && state !== stateRef.current) {
      stateRef.current = state;
      externalStateRef.current = state;
      setUIState(state);
    }
    const externalState = externalStateRef.current;

    const uiStateController = {
      externalState,
      uiState,
      setUIState: (newUIState, e) => {
        groupOnUIStateChange?.(newUIState, e);
        onUIStateChange?.(newUIState, e);
        setUIState(newUIState);
        uiStateController.onChange(newUIState, e);
      },
      resetUIState: () => {
        setUIState(externalState);
      },
      onChange: () => {},
    };
    return uiStateController;
  });
};
const useUncontrolledUIProps = (
  props,
  { componentType, statePropName, defaultStatePropName, fallbackState },
) => {
  const groupOnUIStateChange = useContext(FieldGroupOnUIStateChangeContext);
  const { onUIStateChange } = props;
  const uiStateController = useUIStateController(props, {
    statePropName,
    defaultStatePropName,
    fallbackState,
  });

  const innerOnUIStateChange = onUIStateChange || groupOnUIStateChange;
  /**
   * This check is needed only for basic field because
   * When using action/form we consider the action/form code
   * will have a side effect that will re-render the component with the up-to-date state
   *
   * In practice we set the checked from the backend state
   * We use action to fetch the new state and update the local state
   * The component re-renders so it's the action/form that is considered as responsible
   * to update the state and as a result allowed to have "checked"/"value" prop without "onUIStateChange"
   */
  if (Object.hasOwn(props, statePropName) && !innerOnUIStateChange) {
    if (import.meta.dev) {
      console.warn(
        `"${componentType}" is controlled by "${statePropName}" prop. Replace it by "${defaultStatePropName}" or combine it with "onUIStateChange" to make field interactive.`,
      );
    }
    uiStateController.readOnly = true;
  }
  return {
    uiStateController,
  };
};

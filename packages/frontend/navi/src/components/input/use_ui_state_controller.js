import { useContext, useRef, useState } from "preact/hooks";

import {
  FieldGroupOnUIStateChangeContext,
  FieldGroupUIStateControllerContext,
} from "../field_group_context.js";
import { useInitialValue } from "../use_initial_value.js";

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
  {
    statePropName,
    defaultStatePropName,
    hasGroup,
    groupState,
    fallbackState,
    mapStateValue,
  },
  navState,
) => {
  const hasUIStateProp = Object.hasOwn(props, statePropName);
  const state = props[statePropName];
  const defaultState = props[defaultStatePropName];
  const externalStateInitial = useInitialValue(() => {
    if (hasGroup) {
      return groupState;
    }
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
  const groupstateRef = useRef(groupState);
  if (hasGroup && groupState !== groupstateRef.current) {
    groupstateRef.current = groupState;
    externalStateRef.current = groupState;
    setUIState(groupState);
  }

  const stateRef = useRef(state);
  if (!hasGroup && hasUIStateProp && state !== stateRef.current) {
    stateRef.current = state;
    externalStateRef.current = state;
    setUIState(state);
  }
  const externalState = externalStateRef.current;

  return [uiState, setUIState, externalState];
};
const useUncontrolledUIProps = (
  props,
  { componentType, statePropName, defaultStatePropName, fallbackState },
) => {
  const groupUIStateController = useContext(FieldGroupUIStateControllerContext);
  const groupOnUIStateChange = useContext(FieldGroupOnUIStateChangeContext);
  const hasGroup =
    groupUIStateController && groupUIStateController.type === componentType;
  const groupState = hasGroup
    ? groupUIStateController.getUIState(props)
    : undefined;

  const { onUIStateChange, readOnly } = props;
  const [uiState, setUIState] = useUIStateController(props, {
    statePropName,
    defaultStatePropName,
    hasGroup,
    groupState,
    fallbackState,
  });

  const innerOnUIStateChange =
    onUIStateChange && groupOnUIStateChange
      ? (uiState, e) => {
          onUIStateChange(uiState, e);
          groupOnUIStateChange(uiState, e);
        }
      : onUIStateChange || groupOnUIStateChange;
  let innerReadOnly = readOnly;
  /**
   * This check is needed only for basic input because
   * When using action/form we consider the action/form code
   * will have a side effect that will re-render the component with the up-to-date state
   *
   * In practice we set the checked from the backend state
   * We use action to fetch the new state and update the local state
   * The component re-renders so it's the action/form that is considered as responsible
   * to update the state and as a result allowed to have "checked" prop without "onUIStateChange"
   */
  if (Object.hasOwn(props, statePropName) && !innerOnUIStateChange) {
    innerReadOnly = true;
    if (import.meta.dev) {
      console.warn(
        `"${componentType}" is controlled by "${statePropName}" prop. Replace it by "${defaultStatePropName}" or combine it with "onUIStateChange" to make field interactive.`,
      );
    }
  }

  return {
    [statePropName]: uiState,
    onUIStateChange: (inputValue, e) => {
      setUIState(inputValue);
      innerOnUIStateChange?.(inputValue, e);
    },
    readOnly: innerReadOnly,
  };
};

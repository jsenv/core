import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { FieldGroupUIStateControllerContext } from "../field_group_context.js";
import { useInitialValue } from "../use_initial_value.js";
import { useStableCallback } from "../use_stable_callback.js";

export const useValueController = (props, componentType, navState) => {
  return useUIStateController(
    props,
    {
      componentType,
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

export const useCheckedController = (props, componentType, navState) => {
  const { value = "on" } = props;
  return useUIStateController(
    props,
    {
      componentType,
      statePropName: "checked",
      defaultStatePropName: "defaultChecked",
      fallbackState: false,
      getStateFromProp: (checked) => {
        return checked ? value : undefined;
      },
      getPropFromState: Boolean,
    },
    navState,
  );
};
export const useUncontrolledCheckedProps = (props, componentType) => {
  const { value = "on" } = props;
  return useUncontrolledUIProps(props, {
    componentType,
    statePropName: "checked",
    defaultStatePropName: "defaultChecked",
    fallbackState: false,
    getStateFromProp: (checked) => {
      return checked ? value : undefined;
    },
    getPropFromState: Boolean,
  });
};

const useUncontrolledUIProps = (
  props,
  {
    componentType,
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp,
    getPropFromState,
  },
) => {
  const uiStateController = useUIStateController(props, {
    componentType,
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp,
    getPropFromState,
    uncontrolled: true,
  });

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
  if (uiStateController.readOnly && import.meta.dev) {
    console.warn(
      `"${componentType}" is controlled by "${statePropName}" prop. Replace it by "${defaultStatePropName}" or combine it with "onUIStateChange" to make field interactive.`,
    );
  }
  return {
    uiStateController,
  };
};
const useUIStateController = (
  props,
  {
    componentType,
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp = (prop) => prop,
    getPropFromState = (state) => state,
    uncontrolled,
  },
  navState,
) => {
  const groupUIStateController = useContext(FieldGroupUIStateControllerContext);
  const hasStateProp = Object.hasOwn(props, statePropName);
  const state = props[statePropName];
  const defaultState = props[defaultStatePropName];
  let { onUIStateChange } = props;
  onUIStateChange = useStableCallback(onUIStateChange);
  const stateInitial = useInitialValue(() => {
    if (hasStateProp) {
      // controlled by state prop ("value" or "checked")
      return getStateFromProp(state);
    }
    if (defaultState) {
      // not controlled but want an initial state (a value or being checked)
      return getStateFromProp(defaultState);
    }
    if (navState) {
      // not controlled but want to use value from nav state
      // (I think this should likely move earlier to win over the hasUIStateProp when it's undefined)
      return getStateFromProp(navState);
    }
    return getStateFromProp(fallbackState);
  });
  const stateInitialRef = useRef(stateInitial);
  const [uiState, _setUIState] = useState(stateInitial);
  const stateRef = useRef(state);

  const uiStateControllerRef = useRef();
  useLayoutEffect(() => {
    return () => {
      const uiStateController = uiStateControllerRef.current;
      if (groupUIStateController) {
        groupUIStateController.unregisterChild(uiStateController);
      }
    };
  }, []);

  return useMemo(() => {
    const uiStateController = {
      componentType,
      state: undefined,
      readOnly:
        uncontrolled &&
        hasStateProp &&
        !onUIStateChange &&
        !groupUIStateController,
      uiState,
      setUIState: (prop, e) => {
        const newUIState = getStateFromProp(prop);
        uiStateController.uiState = newUIState;
        _setUIState(newUIState);
        onUIStateChange?.(newUIState, e);
        if (groupUIStateController) {
          groupUIStateController.onChildUIStateChange(
            uiStateController,
            newUIState,
            e,
          );
        }
      },
      resetUIState: () => {
        const prop = getPropFromState(state);
        uiStateController.setUIState(prop);
      },
    };
    uiStateControllerRef.current = uiStateController;
    if (groupUIStateController) {
      groupUIStateController.registerChild(uiStateController);
    }

    if (hasStateProp && state !== stateRef.current) {
      stateRef.current = state;
      stateInitialRef.current = state;
      uiStateController.setUIState(getPropFromState(state));
    }
    uiStateController.state = state;
    return uiStateController;
  }, [hasStateProp, state, groupUIStateController]);
};

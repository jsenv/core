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
/**
 * UI State Controller Hook
 *
 * This hook manages the complex relationship between external state and UI state in form components.
 * It provides a unified interface for handling both controlled and uncontrolled components while
 * allowing the UI state to diverge from the external state when needed.
 *
 * Core Concepts:
 *
 * 1. **External State Tracking**:
 *    - Tracks changes to control props (like "checked" or "value")
 *    - When these props are present, they are considered the "source of truth" (external state)
 *    - This external state controls the component's behavior
 *
 * 2. **UI State Divergence**:
 *    - The UI state can temporarily diverge from the external state
 *    - This allows for immediate UI feedback while waiting for external state updates
 *    - Useful for form interactions where the UI needs to be responsive
 *
 * 3. **UI State Change Notifications**:
 *    - Provides `onUIStateChange` callback to notify about UI state changes
 *    - Most of the time this is irrelevant for the consuming code
 *    - But when needed, it allows external code to track what the user is doing in the UI
 *
 * 4. **State Synchronization**:
 *    - `resetUIState()` method allows syncing UI state back to external state
 *    - Useful for "reset" or "cancel" operations in forms
 *    - Ensures UI can be brought back to match the external state
 *
 * 5. **Component Integration**:
 *    - Returns a state controller object that UI components use to render correctly
 *    - Components use this to determine what state to display and how to handle interactions
 *    - Provides consistent interface for both controlled and uncontrolled scenarios
 *
 * 6. **External Code Integration**:
 *    - External code can use the controller to sync with UI state when needed
 *    - Allows for complex state management patterns where UI and data state can differ
 *    - Supports scenarios like optimistic updates, form validation, etc.
 *
 * Usage Patterns:
 * - **Controlled**: Component receives `checked`/`value` + `onUIStateChange`
 * - **Uncontrolled**: Component receives `defaultChecked`/`defaultValue`
 * - **Mixed**: UI state can diverge from external state until explicit sync
 */
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

  // Handle cleanup
  useLayoutEffect(() => {
    const uiStateController = uiStateControllerRef.current;
    if (groupUIStateController) {
      groupUIStateController.registerChild(uiStateController);
    }
    return () => {
      if (groupUIStateController) {
        groupUIStateController.unregisterChild(uiStateController);
      }
    };
  }, [groupUIStateController]);

  // Handle state prop changes
  useLayoutEffect(() => {
    if (hasStateProp && state !== stateRef.current) {
      stateRef.current = state;
      stateInitialRef.current = state;
      const uiStateController = uiStateControllerRef.current;
      if (uiStateController) {
        uiStateController.setUIState(getPropFromState(state));
      }
    }
  }, [hasStateProp, state, getPropFromState]);

  return useMemo(() => {
    const subscribers = new Set();

    const uiStateController = {
      componentType,
      get state() {
        return hasStateProp ? state : undefined;
      },
      get readOnly() {
        return (
          uncontrolled &&
          hasStateProp &&
          !onUIStateChange &&
          !groupUIStateController
        );
      },
      get uiState() {
        return uiState;
      },
      setUIState: (prop, e) => {
        const newUIState = getStateFromProp(prop);
        _setUIState(newUIState);

        // Notify subscribers
        subscribers.forEach((callback) => callback(newUIState));

        // Call original callback
        onUIStateChange?.(newUIState, e);

        // Notify group controller
        if (groupUIStateController) {
          groupUIStateController.onChildUIStateChange(
            uiStateController,
            newUIState,
            e,
          );
        }
      },
      resetUIState: () => {
        const currentState = hasStateProp ? state : undefined;
        const prop = getPropFromState(currentState);
        uiStateController.setUIState(prop);
      },
      subscribe: (callback) => {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      },
    };
    uiStateControllerRef.current = uiStateController;
    return uiStateController;
  }, [groupUIStateController, componentType]);
};
/**
 * UI Group State Controller Hook
 *
 * This hook manages a group of child UI state controllers and aggregates their states.
 * It provides a unified interface for managing collections of form inputs that work together.
 *
 * Key Features:
 * - Aggregates child UI states into a single group state
 * - Filters children by component type (e.g., only "checkbox" components)
 * - Provides reset functionality that cascades to all children
 * - Maintains subscriber notifications for external state tracking
 * - Handles child registration/unregistration automatically
 *
 * @param {Object} props - Component props containing onUIStateChange callback
 * @param {Object} config - Configuration object
 * @param {string} config.componentType - Type of this group controller (e.g., "checkbox_list")
 * @param {string} [config.childComponentType] - Filter children by this type (e.g., "checkbox")
 * @param {Function} [config.aggregateChildStates] - Custom aggregation function
 * @param {any} [config.emptyState] - State to use when no children have values
 * @returns {Object} UI group state controller
 */
export const useUIGroupStateController = (
  props,
  {
    componentType,
    childComponentType,
    aggregateChildStates = defaultAggregateChildStates,
    emptyState = undefined,
  },
) => {
  let { onUIStateChange } = props;
  onUIStateChange = useStableCallback(onUIStateChange);
  const [uiState, _setUIState] = useState(emptyState);

  const childUIStateControllerArrayRef = useRef([]);
  const childUIStateControllerArray = childUIStateControllerArrayRef.current;
  const uiGroupStateControllerRef = useRef();

  const updateUIState = () => {
    const newUIState = aggregateChildStates(
      childUIStateControllerArray,
      emptyState,
    );
    if (newUIState === uiState) {
      return;
    }
    const uiGroupStateController = uiGroupStateControllerRef.current;
    if (uiGroupStateController) {
      uiGroupStateController.setUIState(newUIState);
    }
  };

  return useMemo(() => {
    const subscribers = new Set();
    childUIStateControllerArray.length = 0;

    const uiGroupStateController = {
      componentType,
      get uiState() {
        return uiState;
      },
      setUIState: (newUIState, e) => {
        _setUIState(newUIState);

        // Notify subscribers
        subscribers.forEach((callback) => callback(newUIState));

        // Call original callback
        onUIStateChange?.(newUIState, e);
      },
      onChildUIStateChange: (childUIStateController) => {
        if (
          childComponentType &&
          childUIStateController.componentType !== childComponentType
        ) {
          return;
        }
        updateUIState();
      },
      registerChild: (childUIStateController) => {
        if (
          childComponentType &&
          childUIStateController.componentType !== childComponentType
        ) {
          return;
        }
        childUIStateControllerArray.push(childUIStateController);
        updateUIState();
      },
      unregisterChild: (childUIStateController) => {
        if (
          childComponentType &&
          childUIStateController.componentType !== childComponentType
        ) {
          return;
        }
        const index = childUIStateControllerArray.indexOf(
          childUIStateController,
        );
        if (index === -1) {
          return;
        }
        childUIStateControllerArray.splice(index, 1);
        updateUIState();
      },
      resetUIState: (e) => {
        for (const childUIStateController of childUIStateControllerArray) {
          childUIStateController.resetUIState(e);
        }
      },
      subscribe: (callback) => {
        subscribers.add(callback);
        return () => subscribers.delete(callback);
      },
    };

    uiGroupStateControllerRef.current = uiGroupStateController;
    return uiGroupStateController;
  }, [componentType, childComponentType, emptyState]);
};

/**
 * Default aggregation function for child states
 * Collects all truthy child UI states into an array
 */
const defaultAggregateChildStates = (childControllers, emptyState) => {
  const values = [];
  for (const childController of childControllers) {
    if (childController.uiState) {
      values.push(childController.uiState);
    }
  }
  return values.length === 0 ? emptyState : values;
};

/**
 * Hook to track UI state from a UI state controller
 *
 * This hook allows external code to react to UI state changes without
 * causing the controller itself to re-create. It returns the current UI state
 * and will cause re-renders when the UI state changes.
 *
 * @param {Object} uiStateController - The UI state controller to track
 * @returns {any} The current UI state
 */
export const useUIState = (uiStateController) => {
  const [trackedUIState, setTrackedUIState] = useState(
    uiStateController.uiState,
  );

  useLayoutEffect(() => {
    // Subscribe to UI state changes
    const unsubscribe = uiStateController.subscribe(setTrackedUIState);

    // Sync with current state in case it changed before subscription
    setTrackedUIState(uiStateController.uiState);

    return unsubscribe;
  }, [uiStateController]);

  return trackedUIState;
};

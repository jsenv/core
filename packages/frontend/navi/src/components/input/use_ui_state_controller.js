import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { useNavState } from "../../browser_integration/browser_integration.js";
import { FormContext } from "../action_execution/form_context.js";
import { FieldGroupUIStateControllerContext } from "../field_group_context.js";
import { createPubSub } from "../pub_sub.js";
import { useInitialValue } from "../use_initial_value.js";
import { useStableCallback } from "../use_stable_callback.js";

const DEBUG = true;
const debug = (message, ...args) => {
  if (DEBUG) {
    console.debug(`[UIStateController] ${message}`, ...args);
  }
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
export const useUIStateController = (
  props,
  componentType,
  {
    statePropName,
    defaultStatePropName,
    fallbackState,
    getStateFromProp = (prop) => prop,
    getPropFromState = (state) => state,
  },
) => {
  const id = props.id;
  const formContext = useContext(FormContext);
  const uncontrolled = !formContext && !props.action;
  const [navState, setNavState] = useNavState(id);

  const groupUIStateController = useContext(FieldGroupUIStateControllerContext);
  const hasStateProp = Object.hasOwn(props, statePropName);
  const state = props[statePropName];
  const defaultState = props[defaultStatePropName];
  const stateInitial = useInitialValue(() => {
    if (hasStateProp) {
      // controlled by state prop ("value" or "checked")
      return getStateFromProp(state);
    }
    if (defaultState) {
      // not controlled but want an initial state (a value or being checked)
      return getStateFromProp(defaultState);
    }
    if (formContext && navState) {
      // not controlled but want to use value from nav state
      // (I think this should likely move earlier to win over the hasUIStateProp when it's undefined)
      return getStateFromProp(navState);
    }
    return getStateFromProp(fallbackState);
  });
  const uiStateControllerRef = useRef();
  const stateInitialRef = useRef(stateInitial);
  const stateRef = useRef(state);
  const uiStateRef = useRef(stateInitial);

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
    const uiStateController = uiStateControllerRef.current;
    if (hasStateProp && state !== stateRef.current) {
      stateInitialRef.current = state;
      stateRef.current = state;
      uiStateController.state = state;
      uiStateController.setUIState(getPropFromState(state));
    }
  }, [hasStateProp, state, getPropFromState]);

  let { onUIStateChange } = props;
  onUIStateChange = useStableCallback(onUIStateChange);
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
  const readOnly =
    uncontrolled && hasStateProp && !onUIStateChange && !groupUIStateController;
  if (readOnly && import.meta.dev) {
    console.warn(
      `"${componentType}" is controlled by "${statePropName}" prop. Replace it by "${defaultStatePropName}" or combine it with "onUIStateChange" to make field interactive.`,
    );
  }

  return useMemo(() => {
    const [publishUIState, subscribeUIState] = createPubSub();

    const uiStateController = {
      componentType,
      readOnly,
      state: stateRef.current,
      uiState: uiStateRef.current,
      setUIState: (prop, e) => {
        if (formContext) {
          setNavState(prop);
        }
        const newUIState = getStateFromProp(prop);
        uiStateRef.current = newUIState;
        uiStateController.uiState = newUIState;

        // Notify subscribers
        publishUIState(newUIState);
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
      actionEnd: () => {
        if (formContext) {
          setNavState(undefined);
        }
      },
      subscribe: subscribeUIState,
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
  componentType,
  { childComponentType, aggregateChildStates, emptyState = undefined },
) => {
  if (typeof aggregateChildStates !== "function") {
    throw new TypeError("aggregateChildStates must be a function");
  }

  debug(
    childComponentType === "*"
      ? `Creating "${componentType}" ui state controller (monitoring all descendants ui state(s))"`
      : `Creating "${componentType}" ui state controller (monitoring "${childComponentType}" ui state(s))`,
  );

  let { onUIStateChange } = props;
  onUIStateChange = useStableCallback(onUIStateChange);
  const uiStateRef = useRef(emptyState);

  const childUIStateControllerArrayRef = useRef([]);
  const childUIStateControllerArray = childUIStateControllerArrayRef.current;
  const uiGroupStateControllerRef = useRef();

  const onChange = () => {
    // TODO: should track if we are rendering ourselves to batch update
    // when parent rendering is done

    const newUIState = aggregateChildStates(
      childUIStateControllerArray,
      emptyState,
    );
    const uiGroupStateController = uiGroupStateControllerRef.current;
    uiGroupStateController.setUIState(newUIState);
  };

  childUIStateControllerArray.length = 0;

  return useMemo(() => {
    const [publishUIState, subscribeUIState] = createPubSub();

    const uiGroupStateController = {
      componentType,
      uiState: uiStateRef.current,
      setUIState: (newUIState, e) => {
        const currentUIState = uiStateRef.current;
        if (newUIState === currentUIState) {
          debug(`"${componentType}" ui state unchanged:`, newUIState);
          return;
        }
        debug(
          `"${componentType}" ui state changed from:`,
          currentUIState,
          "to:",
          newUIState,
        );
        uiGroupStateController.uiState = newUIState;
        uiStateRef.current = newUIState;
        publishUIState(newUIState);
        onUIStateChange?.(newUIState, e);
      },
      registerChild: (childUIStateController) => {
        if (
          childComponentType &&
          childUIStateController.componentType !== childComponentType
        ) {
          return;
        }
        childUIStateControllerArray.push(childUIStateController);
        debug(
          `"${componentType}" registered a "${childUIStateController.componentType}" - total: ${childUIStateControllerArray.length}`,
        );
        onChange(childUIStateController, "mount");
      },
      onChildUIStateChange: (childUIStateController) => {
        if (
          childComponentType &&
          childUIStateController.componentType !== childComponentType
        ) {
          return;
        }
        debug(
          `"${componentType}" notified by "${childUIStateController.componentType}" of ui state change to`,
          childUIStateController.uiState,
        );
        onChange(childUIStateController, "change");
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
          debug(
            `"${componentType}" cannot unregister "${childUIStateController.componentType}" - not found`,
          );
          return;
        }
        childUIStateControllerArray.splice(index, 1);
        debug(
          `"${componentType}" unregistered "${childUIStateController.componentType}" - remaining: ${childUIStateControllerArray.length}`,
        );
        onChange(childUIStateController, "unmount");
      },
      resetUIState: (e) => {
        for (const childUIStateController of childUIStateControllerArray) {
          childUIStateController.resetUIState(e);
        }
      },
      subscribe: subscribeUIState,
    };

    uiGroupStateControllerRef.current = uiGroupStateController;
    return uiGroupStateController;
  }, [componentType, childComponentType, emptyState]);
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

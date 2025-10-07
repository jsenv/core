import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef, useState } from "preact/hooks";

import { useNavState } from "../../browser_integration/browser_integration.js";
import { FormContext } from "../action_execution/form_context.js";
import { createPubSub } from "../pub_sub.js";
import { useInitialValue } from "../use_initial_value.js";
import { useStableCallback } from "../use_stable_callback.js";
import { FieldGroupUIStateControllerContext } from "./field_group_context.js";

export const UIStateControllerContext = createContext();
export const UIStateContext = createContext();

const DEBUG_UI_STATE_CONTROLLER = false;
const DEBUG_UI_GROUP_STATE_CONTROLLER = false;
const debugUIState = (...args) => {
  if (DEBUG_UI_STATE_CONTROLLER) {
    console.debug(...args);
  }
};
const debugUIGroup = (...args) => {
  if (DEBUG_UI_GROUP_STATE_CONTROLLER) {
    console.debug(...args);
  }
};

/**
 * UI State Controller Hook
 *
 * Manages the relationship between external state (props) and UI state (what user sees).
 * Allows UI state to diverge temporarily for responsive interactions, with mechanisms
 * to sync back to external state when needed.
 *
 * Key features:
 * - Immediate UI updates for responsive interactions
 * - State divergence with sync capabilities (resetUIState)
 * - Group integration for coordinated form inputs
 * - External control via custom events (onsetuistate/onresetuistate)
 * - Error recovery and form reset support
 *
 * See README.md for detailed usage examples and patterns.
 */
export const useUIStateController = (
  props,
  componentType,
  {
    statePropName = "value",
    defaultStatePropName = "defaultValue",
    fallbackState = "",
    getStateFromProp = (prop) => prop,
    getPropFromState = (state) => state,
  } = {},
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
  const stateRef = useRef(stateInitial);
  const uiStateRef = useRef(stateInitial);

  // Handle cleanup
  useLayoutEffect(() => {
    const uiStateController = uiStateControllerRef.current;
    if (groupUIStateController) {
      debugUIState(
        `"${componentType}" registering into "${groupUIStateController.componentType}"`,
      );
      groupUIStateController.registerChild(uiStateController);
    }
    return () => {
      if (groupUIStateController) {
        debugUIState(
          `"${componentType}" unregistering from "${groupUIStateController.componentType}"`,
        );
        groupUIStateController.unregisterChild(uiStateController);
      }
    };
  }, []);

  // Handle state prop changes
  getPropFromState = useStableCallback(getPropFromState);
  useLayoutEffect(() => {
    const uiStateController = uiStateControllerRef.current;
    if (!hasStateProp) {
      return;
    }
    const prevState = stateRef.current;
    if (state === prevState) {
      return;
    }
    stateRef.current = state;
    uiStateController.state = state;
    uiStateController.setUIState(
      getPropFromState(state),
      new CustomEvent("state_prop"),
    );
  }, [hasStateProp, state]);

  const { onUIStateChange } = props;
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

  const hasStatePropRef = useRef();
  hasStatePropRef.current = hasStateProp;

  const onUIStateChangeRef = useRef();
  onUIStateChangeRef.current = onUIStateChange;
  const getStateFromPropRef = useRef();
  getStateFromPropRef.current = getStateFromProp;
  const getPropFromStateRef = useRef();
  getPropFromStateRef.current = getPropFromState;

  const existingUIStateController = uiStateControllerRef.current;
  if (existingUIStateController) {
    return existingUIStateController;
  }
  debugUIState(
    `Creating "${componentType}" ui state controller - initial state:`,
    JSON.stringify(stateInitial),
  );
  const [publishUIState, subscribeUIState] = createPubSub();
  const uiStateController = {
    componentType,
    readOnly,
    state: stateRef.current,
    uiState: uiStateRef.current,
    setUIState: (prop, e) => {
      const newUIState = getStateFromPropRef.current(prop);
      if (formContext) {
        setNavState(prop);
      }
      const currentUIState = uiStateRef.current;
      if (newUIState === currentUIState) {
        return;
      }
      debugUIState(
        `${componentType}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> state updated to ${JSON.stringify(newUIState)}`,
      );
      uiStateRef.current = newUIState;
      uiStateController.uiState = newUIState;

      // Notify subscribers
      publishUIState(newUIState);
      // Call original callback
      onUIStateChangeRef.current?.(newUIState, e);
      // Notify group controller
      if (groupUIStateController) {
        debugUIState(
          `"${componentType}" notifying "${groupUIStateController.componentType}" of ui state change`,
        );
        groupUIStateController.onChildUIStateChange(uiStateController, e);
      }
    },
    resetUIState: (e) => {
      const currentState = stateRef.current;
      uiStateController.setUIState(currentState, e);
    },
    actionEnd: () => {
      debugUIState(`"${componentType}" actionEnd called`);
      if (formContext) {
        setNavState(undefined);
      }
    },
    subscribe: subscribeUIState,
  };
  uiStateControllerRef.current = uiStateController;
  return uiStateController;
};

/**
 * UI Group State Controller Hook
 *
 * This hook manages a collection of child UI state controllers and aggregates their states
 * into a unified group state. It provides a way to coordinate multiple form inputs that
 * work together as a logical unit.
 *
 * What it provides:
 *
 * 1. **Child State Aggregation**:
 *    - Collects state from multiple child UI controllers
 *    - Combines them into a single meaningful group state
 *    - Updates group state automatically when any child changes
 *
 * 2. **Child Filtering**:
 *    - Can filter which child controllers to include based on component type
 *    - Useful for mixed content where only specific inputs matter
 *    - Enables type-safe aggregation patterns
 *
 * 3. **Group Operations**:
 *    - Provides `resetUIState()` that cascades to all children
 *    - Enables group-level operations like "clear all" or "reset form section"
 *    - Maintains consistency across related inputs
 *
 * 4. **External State Management**:
 *    - Notifies external code of group state changes via `onUIStateChange`
 *    - Allows external systems to react to group-level state changes
 *    - Supports complex form validation and submission logic
 *
 * Why use it:
 * - When you have multiple related inputs that should be treated as one logical unit
 * - For implementing checkbox lists, radio groups, or form sections
 * - When you need to perform operations on multiple inputs simultaneously
 * - To aggregate input states for validation or submission
 *
 * How it works:
 * - Child controllers automatically register themselves when mounted
 * - Group controller listens for child state changes and re-aggregates
 * - Custom aggregation function determines how child states combine
 * - Group state updates trigger notifications to external code
 *
 * @param {Object} props - Component props containing onUIStateChange callback
 * @param {string} componentType - Type identifier for this group controller
 * @param {Object} config - Configuration object
 * @param {string} [config.childComponentType] - Filter children by this type (e.g., "checkbox")
 * @param {Function} config.aggregateChildStates - Function to aggregate child states
 * @param {any} [config.emptyState] - State to use when no children have values
 * @returns {Object} UI group state controller
 *
 * Usage Examples:
 * - **Checkbox List**: Aggregates multiple checkboxes into array of checked values
 * - **Radio Group**: Manages radio buttons to ensure single selection
 * - **Form Section**: Groups related inputs for validation and reset operations
 * - **Dynamic Lists**: Handles variable number of repeated input groups
 */

export const useUIGroupStateController = (
  props,
  componentType,
  { childComponentType, aggregateChildStates, emptyState = undefined },
) => {
  if (typeof aggregateChildStates !== "function") {
    throw new TypeError("aggregateChildStates must be a function");
  }

  let { onUIStateChange } = props;
  onUIStateChange = useStableCallback(onUIStateChange);
  const uiStateRef = useRef(emptyState);
  const childUIStateControllerArrayRef = useRef([]);
  const childUIStateControllerArray = childUIStateControllerArrayRef.current;
  const uiGroupStateControllerRef = useRef();

  const groupIsRenderingRef = useRef(false);
  const pendingChangeRef = useRef(false);
  groupIsRenderingRef.current = true;
  pendingChangeRef.current = false;

  const onChange = (_, e) => {
    if (groupIsRenderingRef.current) {
      pendingChangeRef.current = true;
      return;
    }
    const newUIState = aggregateChildStates(
      childUIStateControllerArray,
      emptyState,
    );
    const uiGroupStateController = uiGroupStateControllerRef.current;
    uiGroupStateController.setUIState(newUIState, e);
  };

  useLayoutEffect(() => {
    groupIsRenderingRef.current = false;
    if (pendingChangeRef.current) {
      pendingChangeRef.current = false;
      onChange(
        null,
        new CustomEvent(`${componentType}_batched_ui_state_update`),
      );
    }
  });

  const existingUIGroupStateController = uiGroupStateControllerRef.current;
  if (existingUIGroupStateController) {
    return existingUIGroupStateController;
  }
  debugUIGroup(
    childComponentType === "*"
      ? `Creating "${componentType}" ui state controller (monitoring all descendants ui state(s))"`
      : `Creating "${componentType}" ui state controller (monitoring "${childComponentType}" ui state(s))`,
  );

  const [publishUIState, subscribeUIState] = createPubSub();
  const isMonitoringChild = (childUIStateController) => {
    if (childComponentType === "*") {
      return true;
    }
    return childUIStateController.componentType === childComponentType;
  };
  const uiGroupStateController = {
    componentType,
    uiState: uiStateRef.current,
    setUIState: (newUIState, e) => {
      const currentUIState = uiStateRef.current;
      if (newUIState === currentUIState) {
        return;
      }
      uiGroupStateController.uiState = newUIState;
      uiStateRef.current = newUIState;
      debugUIGroup(
        `${componentType}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> updates from ${JSON.stringify(currentUIState)} to ${JSON.stringify(newUIState)}`,
      );
      publishUIState(newUIState);
      onUIStateChange?.(newUIState, e);
    },
    registerChild: (childUIStateController) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      const childComponentType = childUIStateController.componentType;
      childUIStateControllerArray.push(childUIStateController);
      debugUIGroup(
        `${componentType}.registerChild("${componentType}") -> registered (total: ${childUIStateControllerArray.length})`,
      );
      onChange(
        childUIStateController,
        new CustomEvent(`${childComponentType}_mount`),
      );
    },
    onChildUIStateChange: (childUIStateController, e) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      debugUIGroup(
        `${componentType}.onChildUIStateChange("${childUIStateController.componentType}") to ${JSON.stringify(
          childUIStateController.uiState,
        )}`,
      );
      onChange(childUIStateController, e);
    },
    unregisterChild: (childUIStateController) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      const childComponentType = childUIStateController.componentType;
      const index = childUIStateControllerArray.indexOf(childUIStateController);
      if (index === -1) {
        debugUIGroup(
          `${componentType}.unregisterChild("${componentType}") -> not found`,
        );
        return;
      }
      childUIStateControllerArray.splice(index, 1);
      debugUIGroup(
        `${componentType}.unregisterChild("${componentType}") -> unregisteed (remaining: ${childUIStateControllerArray.length})`,
      );
      onChange(
        childUIStateController,
        new CustomEvent(`${childComponentType}_unmount`),
      );
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

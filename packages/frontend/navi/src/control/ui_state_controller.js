import {
  createPubSub,
  dispatchInternalCustomEvent,
  findEvent,
  getElementSignature,
} from "@jsenv/dom";
import { signal } from "@preact/signals";
import { createContext } from "preact";
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { useNavState } from "../nav/browser_integration/browser_integration.js";
import { useInitialValue } from "../state/use_initial_value.js";
import { findControlHost, getControlProxyTarget } from "./control_dom.js";
import { FormContext } from "./form_context.js";
import { PickerElementContext } from "./picker/picker_context.jsx";

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

export const ParentUIStateControllerContext = createContext();

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
 * - External control via DOM events (navi_set_ui_state / navi_request_reset_ui_state)
 * - Error recovery and form reset support
 *
 * State change flow:
 * All state changes (interaction, action result, external reset) go through DOM events:
 * - `navi_set_ui_state` dispatched on the field's DOM element triggers setUIState
 * - `navi_request_reset_ui_state` dispatched on the field's DOM element resets to controller.state
 * This ensures any subscriber (e.g. useUIState) receives every state change regardless of origin.
 *
 * The controller stores `elementRef` so parent group controllers can dispatch DOM events
 * directly on child DOM elements when performing group-level operations like resetUIState.
 */
export const useUIStateController = (
  props,
  componentType,
  {
    statePropName,
    defaultStatePropName,
    fallbackState = "",
    getStateFromProp = (prop) => prop,
    getPropFromState = (state) => state,
    getStateFromParent,
    uiActionInternal,
    persists,
    allowNameless = false,
    debugInteraction,
  } = {},
) => {
  const uiStateControllerRef = useRef();
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const formContext = useContext(FormContext);
  const pickerElementContext = useContext(PickerElementContext);
  const { id, name, uiAction, action } = props;
  const ref = props.ref;
  const isProxy = Boolean(props["navi-control-proxy-for"]);
  const hasStateProp = Object.hasOwn(props, statePropName);
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
  const uncontrolled =
    !uiAction &&
    !action &&
    !formContext &&
    !pickerElementContext &&
    !parentUIStateController &&
    !isProxy;
  const readOnly = uncontrolled && hasStateProp;
  if (readOnly && import.meta.dev) {
    console.warn(
      `"${componentType}" is controlled by "${statePropName}" prop. Replace it by "${defaultStatePropName}" or pass "uiAction"/"action" to make field interactive.`,
    );
    console.log(props);
  }

  if (persists === undefined && formContext) {
    persists = true;
  }
  const [navState, setNavState] = useNavState(id);
  const state = props[statePropName];
  const stateValue = state;
  const defaultState = props[defaultStatePropName];
  const stateInitial = useInitialValue(() => {
    if (hasStateProp) {
      // controlled by state prop ("value" or "checked")
      return getStateFromProp(stateValue);
    }
    if (defaultState) {
      // not controlled but want an initial state (a value or being checked)
      return getStateFromProp(defaultState);
    }
    if (persists && navState) {
      // not controlled but want to use value from nav state
      // (I think this should likely move earlier to win over the hasUIStateProp when it's undefined)
      return getStateFromProp(navState);
    }
    if (parentUIStateController && getStateFromParent) {
      return getStateFromParent(parentUIStateController);
    }
    return getStateFromProp(fallbackState);
  });

  const [
    notifyParentAboutChildMount,
    notifyParentAboutChildUIStateChange,
    notifyParentAboutChildUnmount,
  ] = useParentControllerNotifiers(
    parentUIStateController,
    uiStateControllerRef,
    componentType,
  );
  useLayoutEffect(() => {
    notifyParentAboutChildMount();
    return notifyParentAboutChildUnmount;
  }, []);

  const existingUIStateController = uiStateControllerRef.current;
  if (existingUIStateController) {
    existingUIStateController._checkForUpdates({
      readOnly,
      name,
      getPropFromState,
      getStateFromProp,
      hasStateProp,
      stateInitial,
      state,
    });
    return existingUIStateController;
  }
  debugUIState(
    `Creating "${componentType}" ui state controller - initial state:`,
    JSON.stringify(stateInitial),
  );
  const [publishUIState, subscribeUIState] = createPubSub();
  const uiStateSignal = signal(stateInitial);
  const uiStateController = {
    _checkForUpdates: ({
      readOnly,
      name,
      getPropFromState,
      getStateFromProp,
      hasStateProp,
      stateInitial,
      state,
    }) => {
      uiStateController.readOnly = readOnly;
      uiStateController.name = name;
      uiStateController.getPropFromState = getPropFromState;
      uiStateController.getStateFromProp = getStateFromProp;
      uiStateController.stateInitial = stateInitial;

      if (hasStateProp) {
        uiStateController.hasStateProp = true;
        const currentState = uiStateController.state;
        const stateFromProp = getStateFromProp(state);
        if (stateFromProp !== currentState) {
          uiStateController.state = stateFromProp;
          uiStateController.setUIState(
            uiStateController.getPropFromState(state),
            new CustomEvent("state_prop"),
          );
        }
      } else if (uiStateController.hasStateProp) {
        uiStateController.hasStateProp = false;
        uiStateController.state = uiStateController.stateInitial;
      }
    },

    componentType,
    isProxy,
    allowNameless,
    readOnly,
    name,
    statePropName,
    defaultStatePropName,
    hasStateProp,
    state: stateInitial,
    uiState: stateInitial,
    uiStateSignal,
    elementRef: ref,
    getPropFromState,
    getStateFromProp,
    requestUIAction: (e) => {
      if (uiAction || uiActionInternal) {
        const uiState = getUIStateFromElement(e.currentTarget);
        uiActionInternal?.(uiState, e);
        uiAction?.(uiState, e);
      }
    },
    setUIState: (prop, e) => {
      const newUIState = uiStateController.getStateFromProp(prop);
      if (persists) {
        setNavState(prop);
      }
      const currentUIState = uiStateController.uiState;
      if (newUIState === currentUIState) {
        debugInteraction(
          e,
          `setUIState called with "${newUIState}" but state is unchanged, ignoring`,
        );
        return false;
      }
      const controllerSig = getElementSignature(e.currentTarget || ref.current);
      debugInteraction(
        e,
        `${controllerSig}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> updating to ${JSON.stringify(newUIState)}`,
      );
      const el = ref.current;
      if (el) {
        // set immediatly (don't wait for preact re-render) so ui is in the right state for:
        // - side effect
        // - any "input" event that might be dispatched below
        const propValue = uiStateController.getPropFromState(newUIState);
        debugInteraction(
          e,
          `[${statePropName}] = ${JSON.stringify(propValue)};`,
        );
        el[statePropName] = propValue;
      }
      uiStateController.uiState = newUIState;
      uiStateSignal.value = newUIState;
      // Radio group: when a radio becomes checked, uncheck all siblings.
      // We only update their UIState — no parent notification, no synthetic
      // input event (the browser never fires input on the unchecked radios,
      // and we don't want to trigger their action flow with a stale DOM value).
      if (
        componentType === "radio" &&
        newUIState &&
        !el.hasAttribute("navi-control-proxy-for")
      ) {
        const { name } = el;
        if (name) {
          const radioGroupContainer = el.form || document;
          const radioInputs = radioGroupContainer.querySelectorAll(
            `input[type="radio"][name="${name}"]`,
          );
          for (const radioInput of radioInputs) {
            if (radioInput === el) {
              continue;
            }
            dispatchRequestSetUIState(radioInput, false, {
              event: e,
              suppressParentNotification: true,
              suppressSyntheticInput: true,
            });
          }
        }
      }
      debugInteraction(e, `publishUIState(${JSON.stringify(newUIState)})`);
      publishUIState(newUIState, e);
      if (!e.detail?.suppressParentNotification) {
        notifyParentAboutChildUIStateChange(e);
      }
      // Proxy: forward the state change to the real input
      // The real input will handle its own UIState update + synthetic input.
      if (el) {
        const naviProxyTarget = getControlProxyTarget(el);
        if (naviProxyTarget) {
          debugInteraction(
            e,
            `forwarding set_ui_state "${prop}" to ${getElementSignature(naviProxyTarget)}`,
          );
          dispatchRequestSetUIState(naviProxyTarget, prop, {
            event: e.detail?.event ?? e,
          });
        }
      }
      // Dispatch a synthetic "input" event so external listeners see the new
      // value. Skip when:
      // - suppressSyntheticInput is set (e.g. radio sibling uncheck)
      // - an input event on this element already exists in the event chain
      if (el && !e.detail?.suppressSyntheticInput) {
        const existingInputEvent = findEvent(e, (eInChain) => {
          return eInChain.type === "input" && eInChain.target === el;
        });
        if (!existingInputEvent) {
          if (el.tagName === "INPUT") {
            if (el.type === "radio" || el.type === "checkbox") {
              debugInteraction(
                e,
                "dispatching synthetic input event without data for checkbox/radio",
              );
              el.dispatchEvent(new Event("input", { bubbles: true }));
            } else {
              debugInteraction(
                e,
                `dispatching synthetic input event with data "${newUIState}" for input`,
              );
              el.dispatchEvent(
                new InputEvent("input", {
                  bubbles: true,
                  cancelable: true,
                  inputType: "insertText",
                  data: newUIState,
                }),
              );
            }
          }
          // TODO: select, textarea
        }
      }
      return true;
    },
    resetUIState: (e) => {
      dispatchRequestSetUIState(e.currentTarget, uiStateController.state, {
        event: e,
      });
    },
    actionEnd: () => {
      debugUIState(`"${componentType}" actionEnd called`);
      if (persists) {
        setNavState(undefined);
      }
    },
    subscribe: subscribeUIState,
  };
  uiStateControllerRef.current = uiStateController;
  return uiStateController;
};

const NO_PARENT = [() => {}, () => {}, () => {}];
const useParentControllerNotifiers = (
  parentUIStateController,
  uiStateControllerRef,
  componentType,
) => {
  return useMemo(() => {
    if (!parentUIStateController) {
      return NO_PARENT;
    }

    const parentComponentType = parentUIStateController.componentType;
    const notifyParentAboutChildMount = () => {
      const uiStateController = uiStateControllerRef.current;
      debugUIState(
        `"${componentType}" registering into "${parentComponentType}"`,
      );
      parentUIStateController.registerChild(uiStateController);
    };

    const notifyParentAboutChildUIStateChange = (e) => {
      const uiStateController = uiStateControllerRef.current;
      debugUIState(
        `"${componentType}" notifying "${parentComponentType}" of ui state change`,
      );
      parentUIStateController.onChildUIStateChange(uiStateController, e);
    };

    const notifyParentAboutChildUnmount = () => {
      const uiStateController = uiStateControllerRef.current;
      debugUIState(
        `"${componentType}" unregistering from "${parentComponentType}"`,
      );
      parentUIStateController.unregisterChild(uiStateController);
    };

    return [
      notifyParentAboutChildMount,
      notifyParentAboutChildUIStateChange,
      notifyParentAboutChildUnmount,
    ];
  }, []);
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
 *    - Provides `resetUIState()` that cascades to all monitored children
 *    - Dispatches `navi_request_reset_ui_state` DOM events on each child's DOM element
 *    - Children handle the event independently, allowing nested groups to cascade further
 *    - Enables group-level operations like "clear all" or "reset form section"
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
  {
    childComponentType,
    aggregateChildStates,
    emptyState = undefined,
    debugAction,
  },
) => {
  if (typeof aggregateChildStates !== "function") {
    throw new TypeError("aggregateChildStates must be a function");
  }
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const { name, value } = props;
  const ref = props.ref;
  const childUIStateControllerArrayRef = useRef([]);
  const childUIStateControllerArray = childUIStateControllerArrayRef.current;
  const uiStateControllerRef = useRef();

  const groupIsRenderingRef = useRef(false);
  const pendingChangeRef = useRef(false);
  groupIsRenderingRef.current = true;
  pendingChangeRef.current = false;

  const [
    notifyParentAboutChildMount,
    notifyParentAboutChildUIStateChange,
    notifyParentAboutChildUnmount,
  ] = useParentControllerNotifiers(
    parentUIStateController,
    uiStateControllerRef,
    componentType,
  );
  useLayoutEffect(() => {
    notifyParentAboutChildMount();
    return notifyParentAboutChildUnmount;
  }, []);

  const onChange = (_, e, { notifyExternal = true } = {}) => {
    if (groupIsRenderingRef.current) {
      pendingChangeRef.current = true;
      return;
    }
    const newUIState = aggregateChildStates(
      childUIStateControllerArray,
      emptyState,
    );
    debugAction(
      e,
      `${componentType}.aggregateChildStates -> ${JSON.stringify(newUIState)}`,
    );
    const uiStateController = uiStateControllerRef.current;
    uiStateController.setUIState(newUIState, e, { notifyExternal });
  };

  useLayoutEffect(() => {
    groupIsRenderingRef.current = false;
    if (pendingChangeRef.current) {
      pendingChangeRef.current = false;
      onChange(
        null,
        new CustomEvent(`${componentType}_batched_ui_state_update`),
        { notifyExternal: false },
      );
    }
  });

  const existingUIStateController = uiStateControllerRef.current;
  if (existingUIStateController) {
    existingUIStateController.name = name;
    existingUIStateController.value = value;
    return existingUIStateController;
  }
  debugUIGroup(
    childComponentType === "*"
      ? `Creating "${componentType}" ui state controller (monitoring all descendants ui state(s))"`
      : `Creating "${componentType}" ui state controller (monitoring "${childComponentType}" ui state(s))`,
  );

  const [publishUIState, subscribeUIState] = createPubSub();
  const uiStateSignal = signal(emptyState);
  const isMonitoringChild = (childUIStateController) => {
    if (childUIStateController.isProxy) {
      return false;
    }
    if (childComponentType === "*") {
      return true;
    }
    return childUIStateController.componentType === childComponentType;
  };
  const uiStateController = {
    componentType,
    name,
    value,
    uiState: emptyState,
    uiStateSignal,
    elementRef: ref,
    getPropFromState: (uiState) => uiState,
    setUIState: (newUIState, e, { notifyExternal = true } = {}) => {
      const currentUIState = uiStateController.uiState;
      if (newUIState === currentUIState) {
        return;
      }
      uiStateController.uiState = newUIState;
      uiStateSignal.value = newUIState;
      debugUIGroup(
        `${componentType}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> updates from ${JSON.stringify(currentUIState)} to ${JSON.stringify(newUIState)}`,
      );
      publishUIState(newUIState);
      if (notifyExternal) {
        notifyParentAboutChildUIStateChange(e);
      }
    },
    registerChild: (childUIStateController) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      const childComponentType = childUIStateController.componentType;
      childUIStateControllerArray.push(childUIStateController);
      debugUIGroup(
        `${componentType}.registerChild("${childComponentType}") -> registered (total: ${childUIStateControllerArray.length})`,
      );
      onChange(
        childUIStateController,
        new CustomEvent(`${childComponentType}_mount`),
        { notifyExternal: false },
      );
    },
    onChildUIStateChange: (childUIStateController, e) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      debugUIGroup(
        `${componentType}.onChildUIStateChange("${childComponentType}") to ${JSON.stringify(
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
          `${componentType}.unregisterChild("${childComponentType}") -> not found`,
        );
        return;
      }
      childUIStateControllerArray.splice(index, 1);
      debugUIGroup(
        `${componentType}.unregisterChild("${childComponentType}") -> unregisteed (remaining: ${childUIStateControllerArray.length})`,
      );
      onChange(
        childUIStateController,
        new CustomEvent(`${childComponentType}_unmount`),
        { notifyExternal: false },
      );
    },
    resetUIState: (e) => {
      for (const childUIStateController of childUIStateControllerArray) {
        if (!isMonitoringChild(childUIStateController)) {
          continue;
        }
        const el = childUIStateController.elementRef?.current;
        if (el) {
          dispatchRequestResetUIState(el, e);
        }
      }
    },
    actionEnd: (e) => {
      for (const childUIStateController of childUIStateControllerArray) {
        childUIStateController.actionEnd(e);
      }
    },
    subscribe: subscribeUIState,
  };
  uiStateControllerRef.current = uiStateController;
  return uiStateController;
};

/**
 * Hook to subscribe to the UI state of a field from its DOM element ref.
 *
 * Tracks state from two independent sources:
 * 1. `initialValue` — the external/controlled state coming from props. Passed as the
 *    initial useState value AND synced via a useLayoutEffect whenever it changes.
 *    This ensures the hook stays in sync when the parent re-renders with a new value.
 * 2. `navi_set_ui_state` DOM event — fired on the element whenever a UI interaction
 *    or action result updates the field's state. This handles all internal state changes
 *    that do not cause the parent to re-render with a new prop.
 *
 * The `initialValue` parameter is important: without it the hook starts as `undefined`
 * and misses the initial state. External state changes (e.g. prop update from server)
 * also only reach the hook through `initialValue` since they do not dispatch a DOM event.
 *
 * @param {import('preact').RefObject} ref - Ref pointing to the field's DOM element
 * @param {any} initialValue - The current external/controlled state value
 * @returns {any} The current UI state, updated by both external changes and UI interactions
 */
export const useUIState = (ref, initialValue) => {
  const [uiState, setUIState] = useState(initialValue);
  useLayoutEffect(() => {
    setUIState(initialValue);
  }, [initialValue]);
  useLayoutEffect(() => {
    const inputEl = ref.current;
    if (!inputEl) {
      return undefined;
    }
    const onnavi_set_ui_state = (e) => {
      setUIState(e.detail.value);
    };
    inputEl.addEventListener("navi_set_ui_state", onnavi_set_ui_state);
    return () => {
      inputEl.removeEventListener("navi_set_ui_state", onnavi_set_ui_state);
    };
  }, [ref]);
  return uiState;
};

export const dispatchRequestSetUIState = (element, value, detail) => {
  const controlHost = findControlHost(element) || element;
  return dispatchInternalCustomEvent(controlHost, "navi_set_ui_state", {
    ...detail,
    value,
  });
};
export const dispatchRequestResetUIState = (element, e) => {
  return dispatchInternalCustomEvent(element, "navi_request_reset_ui_state", {
    event: e,
  });
};
export const getUIStateFromElement = (el) => {
  let uiState;
  dispatchInternalCustomEvent(el, "navi_get_ui_state", {
    respondWith: (v) => {
      uiState = v;
    },
  });
  return uiState;
};

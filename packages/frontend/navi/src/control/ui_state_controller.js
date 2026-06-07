import {
  createPubSub,
  dispatchInternalCustomEvent,
  findEvent,
  getElementSignature,
} from "@jsenv/dom";
import { computed, signal } from "@preact/signals";
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
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { findControlHost } from "./control_dom.js";
import { findControlProxy } from "./control_proxy.js";
import { FormContext } from "./form_context.js";

// In-memory registry of all mounted ui state controllers keyed by their id.
// Allows direct controller access without dispatching DOM events — used by external
// callers (e.g. selectable_list) to call setUIState by id instead of via the DOM.
const controllersById = new Map();
const getUIStateControllerById = (id) => controllersById.get(id);

// In-memory registry for radio controllers, keyed by input name.
// Allows radio sibling unchecking without querying the DOM — necessary when
// items are virtualized and their DOM element may not exist at the time.
// Form scoping is reproduced by comparing parentUIStateController references.
const radioControllersByName = new Map();

const registerRadioController = (uiStateController) => {
  const { name } = uiStateController;
  if (!name) {
    return;
  }
  let set = radioControllersByName.get(name);
  if (!set) {
    set = new Set();
    radioControllersByName.set(name, set);
  }
  set.add(uiStateController);
};

const unregisterRadioController = (uiStateController) => {
  const { name } = uiStateController;
  if (!name) {
    return;
  }
  const set = radioControllersByName.get(name);
  if (!set) {
    return;
  }
  set.delete(uiStateController);
  if (set.size === 0) {
    radioControllersByName.delete(name);
  }
};

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
  controlType,
  {
    statePropName,
    defaultStatePropName,
    fallbackState = undefined,
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
    !parentUIStateController &&
    !isProxy;
  const readOnly = uncontrolled && hasStateProp;
  if (readOnly && import.meta.dev) {
    console.warn(
      `"${controlType}" is controlled by "${statePropName}" prop. Replace it by "${defaultStatePropName}" or pass "uiAction"/"action" to make field interactive.`,
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
  const isRadio = controlType === "input" && props.type === "radio";

  const [
    notifyParentAboutChildMount,
    notifyParentAboutChildUIStateChange,
    notifyParentAboutChildUnmount,
  ] = useParentControllerNotifiers(
    parentUIStateController,
    uiStateControllerRef,
    controlType,
  );
  useLayoutEffect(() => {
    const controller = uiStateControllerRef.current;
    if (id) {
      controllersById.set(id, controller);
    }
    notifyParentAboutChildMount();
    if (isRadio) {
      registerRadioController(controller);
    }
    return () => {
      if (id) {
        controllersById.delete(id);
      }
      notifyParentAboutChildUnmount();
      if (isRadio) {
        unregisterRadioController(controller);
      }
    };
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
      props,
    });
    return existingUIStateController;
  }
  debugUIState(
    `Creating "${controlType}" ui state controller - initial state:`,
    JSON.stringify(stateInitial),
  );
  const [publishUIState, subscribeUIState] = createPubSub();
  const ownUIStateSignal = signal(stateInitial);
  const inherit =
    controlType === "button" && !hasStateProp && parentUIStateController;
  const uiStateSignal = inherit
    ? computed(() => {
        const parentUIState = parentUIStateController.uiStateSignal.value;
        const ownUIState = ownUIStateSignal.value;
        return ownUIState || parentUIState;
      })
    : ownUIStateSignal;

  const uiStateController = {
    _checkForUpdates: ({
      readOnly,
      name,
      getPropFromState,
      getStateFromProp,
      hasStateProp,
      stateInitial,
      state,
      props,
    }) => {
      uiStateController.readOnly = readOnly;
      uiStateController.name = name;
      uiStateController.getPropFromState = getPropFromState;
      uiStateController.getStateFromProp = getStateFromProp;
      uiStateController.stateInitial = stateInitial;
      uiStateController.props = props;

      if (hasStateProp) {
        uiStateController.hasStateProp = true;
        const currentState = uiStateController.state;
        const stateFromProp = getStateFromProp(state);
        if (stateFromProp !== currentState) {
          uiStateController.state = stateFromProp;
          uiStateController.setUIState(
            uiStateController.getPropFromState(state),
            new CustomEvent("state_prop", {
              detail: { internalBehavior: true },
            }),
          );
        }
      } else if (uiStateController.hasStateProp) {
        uiStateController.hasStateProp = false;
        uiStateController.state = uiStateController.stateInitial;
      }
    },

    id,
    controlType,
    parentUIStateController,
    isProxy,
    allowNameless,
    readOnly,
    name,
    props,
    statePropName,
    defaultStatePropName,
    hasStateProp,
    state: stateInitial,
    uiState: stateInitial,
    uiStateSignal,
    elementRef: ref,
    getPropFromState,
    getStateFromProp,
    setUIState: (prop, e) => {
      const newUIState = uiStateController.getStateFromProp(prop);
      const controllerSig = getElementSignature(e.currentTarget || ref.current);
      if (persists) {
        setNavState(prop);
      }
      const currentUIState = uiStateController.uiState;
      const stateIsTheSame = compareTwoJsValues(newUIState, currentUIState);
      if (stateIsTheSame) {
        if (controlType === "button") {
          debugInteraction(
            e,
            `${controllerSig}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> trigger button action`,
          );
          uiActionInternal?.(newUIState, e);
          uiAction?.(newUIState, e);
          return true;
        }
        debugInteraction(
          e,
          `${controllerSig}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> state unchanged, no update needed`,
        );
        return false;
      }
      debugInteraction(
        e,
        `${controllerSig}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> updating from ${JSON.stringify(currentUIState)}`,
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
      ownUIStateSignal.value = newUIState;
      // Radio group: when a radio becomes checked, uncheck all siblings.
      // We only update their UIState — no parent notification, no synthetic
      // input event (the browser never fires input on the unchecked radios,
      // and we don't want to trigger their action flow with a stale DOM value).
      // Uses the in-memory registry instead of DOM queries so this works even
      // when sibling items are virtualized (not in the DOM).
      // Form scoping is preserved by comparing parentUIStateController references.
      const controlProxyFor = uiStateController.props["navi-control-proxy-for"];
      if (isRadio && newUIState && uiStateController.name && !controlProxyFor) {
        const siblings = radioControllersByName.get(uiStateController.name);
        if (siblings) {
          const siblingUncheckEvent = new CustomEvent("radio_sibling_uncheck", {
            detail: { event: e, internalBehavior: true },
          });
          for (const siblingController of siblings) {
            if (siblingController === uiStateController) {
              continue;
            }
            if (
              siblingController.parentUIStateController !==
              parentUIStateController
            ) {
              continue;
            }
            siblingController.setUIState(false, siblingUncheckEvent);
          }
        }
      }
      debugInteraction(e, `publishUIState(${JSON.stringify(newUIState)})`);
      publishUIState(newUIState, e);
      // Always notify the element that its UI state changed.
      // Listeners use this to stay in sync (e.g. input_effect.js tracks currentState,
      // useUIState subscribes for reactive updates). Separate from navi_set_ui_state
      // which is the command; navi_ui_state_change is the notification.
      if (el) {
        dispatchInternalCustomEvent(el, "navi_ui_state_change", {
          event: e,
          value: newUIState,
        });
      }
      // When this controller is a real input that has a visible proxy
      // (linked via `navi-control-proxy-for`), mirror the new state to the
      // proxy DOM synchronously. Otherwise the proxy would only catch up
      // later through a React re-render — visible as e.g. two radios
      // appearing checked at once between the real input update and the
      // next render (radio_sibling_uncheck case).
      if (el && !controlProxyFor) {
        const proxyEl = findControlProxy(el);
        if (proxyEl) {
          const propValue = uiStateController.getPropFromState(newUIState);
          proxyEl[statePropName] = propValue;
        }
      }
      const internalBehavior = e.detail?.internalBehavior;
      if (internalBehavior) {
        return true;
      }
      notifyParentAboutChildUIStateChange(e);
      if (controlProxyFor) {
        // Proxy: forward the state change to the real input
        // The real input will handle its own UIState update + synthetic input.
        const targetController = getUIStateControllerById(controlProxyFor);
        if (targetController) {
          debugInteraction(
            e,
            `forwarding set_ui_state "${prop}" to ${getElementSignature(targetController.elementRef.current)}`,
          );
          targetController.setUIState(prop, e);
        }
      }
      if (el) {
        // Dispatch a synthetic "input" event so external listeners see the new
        // value. Skip when an input event on this element already exists in the chain.
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
      uiActionInternal?.(newUIState, e);
      uiAction?.(newUIState, e);
      return true;
    },
    resetUIState: (e) => {
      dispatchRequestSetUIState(e.currentTarget, uiStateController.state, {
        event: e,
      });
    },
    actionEnd: () => {
      debugUIState(`"${controlType}" actionEnd called`);
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
  controlType,
) => {
  return useMemo(() => {
    if (!parentUIStateController) {
      return NO_PARENT;
    }

    const parentControlType = parentUIStateController.controlType;
    const notifyParentAboutChildMount = () => {
      const uiStateController = uiStateControllerRef.current;
      debugUIState(`"${controlType}" registering into "${parentControlType}"`);
      parentUIStateController.registerChild(uiStateController);
    };

    const notifyParentAboutChildUIStateChange = (e) => {
      const uiStateController = uiStateControllerRef.current;
      debugUIState(
        `"${controlType}" notifying "${parentControlType}" of ui state change`,
      );
      parentUIStateController.onChildUIStateChange(uiStateController, e);
    };

    const notifyParentAboutChildUnmount = () => {
      const uiStateController = uiStateControllerRef.current;
      debugUIState(
        `"${controlType}" unregistering from "${parentControlType}"`,
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
 * @param {string} controlType - Type identifier for this group controller
 * @param {Object} config - Configuration object
 * @param {string} [config.childControlType] - Filter children by this type (e.g., "checkbox")
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
  controlType,
  { stateType, childControlFilter, aggregateChildStates, debugAction },
) => {
  if (typeof aggregateChildStates !== "function") {
    throw new TypeError("aggregateChildStates must be a function");
  }
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const { name, value } = props;
  const ref = props.ref;
  const fallbackState =
    stateType === "array"
      ? EMPTY_ARRAY
      : stateType === "object"
        ? EMPTY_OBJECT
        : undefined;
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
    controlType,
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
    const aggChildState = aggregateChildStates(
      childUIStateControllerArray,
      fallbackState,
    );
    const groupUIState =
      aggChildState === undefined ? fallbackState : aggChildState;
    debugAction(
      e,
      `${controlType}.getUIState -> ${JSON.stringify(groupUIState)}`,
    );
    const uiStateController = uiStateControllerRef.current;
    uiStateController.setUIState(groupUIState, e, { notifyExternal });
  };

  useLayoutEffect(() => {
    groupIsRenderingRef.current = false;
    if (pendingChangeRef.current) {
      pendingChangeRef.current = false;
      onChange(
        null,
        new CustomEvent(`${controlType}_batched_ui_state_update`),
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
    `Creating "${controlType}" ui state controller (monitoring some descendants ui state(s))"`,
  );

  const [publishUIState, subscribeUIState] = createPubSub();
  const uiStateSignal = signal(fallbackState);
  const isMonitoringChild = (childUIStateController) => {
    if (childUIStateController.isProxy) {
      return false;
    }
    if (childControlFilter && !childControlFilter(childUIStateController)) {
      return false;
    }
    return true;
  };
  const uiStateController = {
    controlType,
    name,
    value,
    uiState: fallbackState,
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
        `${controlType}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> updates from ${JSON.stringify(currentUIState)} to ${JSON.stringify(newUIState)}`,
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
      const childControlType = childUIStateController.controlType;
      childUIStateControllerArray.push(childUIStateController);
      debugUIGroup(
        `${controlType}.registerChild("${childControlType}") -> registered (total: ${childUIStateControllerArray.length})`,
      );
      onChange(
        childUIStateController,
        new CustomEvent(`${childControlType}_mount`),
        { notifyExternal: false },
      );
    },
    onChildUIStateChange: (childUIStateController, e) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      const childControlType = childUIStateController.controlType;
      debugUIGroup(
        `${controlType}.onChildUIStateChange("${childControlType}") to ${JSON.stringify(
          childUIStateController.uiState,
        )}`,
      );
      onChange(childUIStateController, e);
    },
    unregisterChild: (childUIStateController) => {
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      const childControlType = childUIStateController.controlType;
      const index = childUIStateControllerArray.indexOf(childUIStateController);
      if (index === -1) {
        debugUIGroup(
          `${controlType}.unregisterChild("${childControlType}") -> not found`,
        );
        return;
      }
      childUIStateControllerArray.splice(index, 1);
      debugUIGroup(
        `${controlType}.unregisterChild("${childControlType}") -> unregisteed (remaining: ${childUIStateControllerArray.length})`,
      );
      onChange(
        childUIStateController,
        new CustomEvent(`${childControlType}_unmount`),
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
    findChildById: (id) => {
      for (const childUIStateController of childUIStateControllerArray) {
        if (childUIStateController.id === id) {
          return childUIStateController;
        }
      }
      return null;
    },
    subscribe: subscribeUIState,
  };
  uiStateControllerRef.current = uiStateController;
  return uiStateController;
};
// Stable reference for an empty selection so the action always receives an
// array (never undefined) and callers don't get a new reference each render.
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

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
    const onnavi_ui_state_change = (e) => {
      setUIState(e.detail.value);
    };
    inputEl.addEventListener("navi_ui_state_change", onnavi_ui_state_change);
    return () => {
      inputEl.removeEventListener(
        "navi_ui_state_change",
        onnavi_ui_state_change,
      );
    };
  }, [ref]);
  return uiState;
};

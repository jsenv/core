import {
  chainEvent,
  createPubSub,
  dispatchInternalCustomEvent,
  findEvent,
  getElementSignature,
} from "@jsenv/dom";
import { computed, signal } from "@preact/signals";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useMemo, useRef } from "preact/hooks";

import {
  useDebugFocus,
  useDebugInteraction,
  useDebugPopup,
  useDebugUIState,
} from "../navi_debug.jsx";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";
import { triggerNaviCommand } from "./commands.js";
import {
  findProxyController,
  getRadioSiblings,
  getUIStateControllerById,
  onUIStateControllerDestroyed,
} from "./controller_registry.js";
import { FormContext } from "./form_context.js";
import { createControlRules } from "./rules/control_rules.js";

/**
 * Minimal interface that any object placed in `ParentUIStateControllerContext` must satisfy.
 * Implemented by `useUIGroupStateController`, `useUIFacadeStateController`, and
 * `useUIStateController` (leaf controls act as transparent pass-throughs: they forward
 * registerChild/onChildUIAction/unregisterChild to their own parent).
 *
 * ```ts
 * interface UIStateController {
 *   id: string;
 *   controlType: string;          // Used for debug logging
 *   uiStateSignal: Signal;        // Accessed by button children to inherit parent value
 *   registerChild(child): void;   // Called on child mount
 *   onChildUIAction(child, e, { stateChanged: boolean }): void; // Called when a child fires a UI action
 *   unregisterChild(child): void; // Called on child unmount
 *   props: Object;
 *   elementRef: Ref; // Used to dispatch DOM events
 *   getManagedControls(): UIStateController[]; // Returns controls whose validity is managed by this controller
 * }
 * ```
 */
export const ParentUIStateControllerContext = createContext();

/**
 * Manages the UI state of a single interactive leaf control (input, checkbox, radio, button…).
 *
 * **Leaf vs group**: a leaf control owns one atomic value (e.g. a string, a boolean).
 * Use `useUIGroupStateController` when multiple children aggregate into one value.
 *
 * **State vs UI state**:
 * - `state` — the last value acknowledged by the action/form (the "truth" coming from outside).
 * - `uiState` — what the user currently sees, which may diverge from `state` while an action
 *   is in flight or the user is mid-edit. On reset, uiState snaps back to state.
 *
 * **setUIState flow** (all state changes go through this path):
 * 1. Update DOM element value synchronously (avoids a re-render flash).
 * 2. Update `uiState` and the reactive signal.
 * 3. Uncheck radio siblings (radio-only).
 * 4. Dispatch `navi_ui_state_change` on the element so external subscribers stay in sync.
 * 5. Call `uiAction` + `uiActionInternal` + `command` (user-observable reactions).
 * 6. Notify the parent group controller (if any) via `notifyParentAboutChildUIAction`.
 * 7. Dispatch a synthetic `input` event so `addInputEffect` / `navi_change` listeners fire.
 *
 * When `stateIsTheSame` (value didn't change):
 * - For **buttons**: still fires reactions (a click is always meaningful).
 * - For **radios**: fires reactions + notifies the parent group so it can fire its own
 *   `uiAction`/`command` (re-clicking an already-selected radio is a valid user gesture).
 * - For everything else: no-op.
 *
 * **internalBehavior events** (e.g. radio_sibling_uncheck, state_prop re-sync):
 * skip reactions and parent notification — they are programmatic, not user-initiated.
 *
 * The controller exposes `elementRef` so parent groups can dispatch DOM events on children
 * (e.g. `resetUIState` cascading `navi_reset_ui_state`).
 */
export const useUIStateController = (
  props,
  {
    controlInfo,
    syncDomState,
    uiActionInternal,
    persists,
    allowNameless = false,
  } = {},
) => {
  const debugPopup = useDebugPopup();
  const debugInteraction = useDebugInteraction();
  const debugUIState = useDebugUIState();
  const debugFocus = useDebugFocus();

  const uiStateControllerRef = useRef();
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const formContext = useContext(FormContext);
  const { id, uiAction } = props;
  const ref = props.ref;
  const isProxy = Boolean(props["navi-control-proxy-for"]);
  if (persists === undefined && formContext) {
    persists = true;
  }
  const controlType = controlInfo.controlType;
  const isRadio = controlType === "input" && props.type === "radio";
  const [
    notifyParentAboutChildMount,
    notifyParentAboutChildUIAction,
    notifyParentAboutChildUnmount,
  ] = useParentControllerNotifiers(
    parentUIStateController,
    uiStateControllerRef,
    controlType,
    debugUIState,
  );
  useLayoutEffect(() => {
    const controller = uiStateControllerRef.current;
    const el = ref.current;
    if (el) {
      el.__uiStateController__ = controller;
    }
    notifyParentAboutChildMount();
    return () => {
      if (el && el.__uiStateController__ === controller) {
        delete el.__uiStateController__;
      }
      notifyParentAboutChildUnmount();
      onUIStateControllerDestroyed(controller);
    };
  }, []);

  const existingUIStateController = uiStateControllerRef.current;
  if (existingUIStateController) {
    existingUIStateController._checkForUpdates({
      props,
      controlInfo,
    });
    return existingUIStateController;
  }
  const { stateInitial } = controlInfo;
  debugUIState(
    `Creating "${controlType}" ui state controller - initial state:`,
    JSON.stringify(stateInitial),
  );
  const [publishUIState, subscribeUIState] = createPubSub();
  const ownUIStateSignal = signal(stateInitial);
  const inherit =
    controlType === "button" &&
    !controlInfo.hasStateProp &&
    parentUIStateController;
  const uiStateSignal = inherit
    ? computed(() => {
        const parentUIState = parentUIStateController.uiStateSignal.value;
        const ownUIState = ownUIStateSignal.value;
        return ownUIState || parentUIState;
      })
    : ownUIStateSignal;

  const uiStateController = {
    _checkForUpdates: ({ props, controlInfo }) => {
      // Raw Preact props from the current render. These are the component's input props,
      // not the resolved/curated host props. useInteractiveProps overwrites
      // uiStateController.controlHostProps with the resolved subset on every render.
      uiStateController.props = props;
      uiStateController.id = props.id; // never suppoed to changed, not supported for now
      uiStateController.name = props.name;

      const { value, hasStateProp, state } = controlInfo;
      uiStateController.value = value;
      if (hasStateProp) {
        uiStateController.hasStateProp = true;
        const currentState = uiStateController.state;
        if (compareTwoJsValues(state, currentState)) {
          // state is the same, nothing to do
        } else {
          uiStateController.state = state;
          uiStateController.setUIState(
            state,
            new CustomEvent("state_prop_change"),
          );
        }
      } else if (uiStateController.hasStateProp) {
        uiStateController.hasStateProp = false;
        uiStateController.state = stateInitial;
      }
    },

    controlType,
    parentUIStateController,
    isProxy,
    allowNameless,
    elementRef: ref,
    props,

    id: props.id,
    name: props.name,
    state: stateInitial,
    uiState: stateInitial,
    uiStateSignal,
    value: controlInfo.value,

    facadeChild: null,
    getManagedControls: () => {
      if (uiStateController.facadeChild) {
        const child = uiStateController.facadeChild;
        const childManaged = child.getManagedControls();
        if (childManaged.length > 0) {
          return childManaged;
        }
        return [child];
      }
      return [];
    },
    onUIAction: (e, { skipCommand } = {}) => {
      if (controlType === "button" && uiStateController.controlHostProps.name) {
        const buttonName = uiStateController.controlHostProps.name;
        const parentController = uiStateController.parentUIStateController;
        if (parentController && parentController.wantRequesterButtonState) {
          const currentState = parentController.uiState;
          const mergedState = {
            ...currentState,
            [buttonName]: uiStateController.uiState,
          };
          parentController.syncInternalState(mergedState);
          debugUIState(
            `merging button state into parent control group:`,
            mergedState,
          );
        }
      }
      // Trigger uiAction/command side effects without changing UI state.
      const currentUIState = uiStateController.uiState;
      uiActionInternal?.(currentUIState, e);
      if (uiAction) {
        debugUIState(`calling uiAction for ${controlType}`, currentUIState);
        uiAction(currentUIState, e);
      }
      if (skipCommand) {
      } else {
        const command = uiStateController.controlHostProps.command;
        if (command) {
          const element = uiStateController.elementRef.current;
          if (element) {
            debugUIState(
              `triggering command "${command}" for "${controlType}"`,
            );
            triggerNaviCommand(element, command, e);
          }
        }
      }
    },
    setUIState: (newUIState, e) => {
      const controllerSig = getElementSignature(e.currentTarget || ref.current);
      // if (persists) {
      //   setNavState(prop);
      // }
      const currentUIState = uiStateController.uiState;
      const stateIsTheSame = compareTwoJsValues(newUIState, currentUIState);
      if (stateIsTheSame) {
        if (controlType === "button") {
          if (!isInternalEvent(e)) {
            uiStateController.onUIAction(e);
          }
          return true;
        }
        debugUIState(
          e,
          `${controllerSig}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> state unchanged, no update needed`,
        );
        if (
          controlType === "input" &&
          uiStateController.controlHostProps.type === "radio" &&
          !isInternalEvent(e)
        ) {
          notifyParentAboutChildUIAction(e, { stateChanged: false });
        }
        // A stale/reused event (currentTarget is null) means this is a debounced
        // callback firing the original input event after a timeout. The state hasn't
        // changed and this is not a live user gesture — skip uiAction and command.
        if (e.currentTarget === null) {
          return false;
        }
        // state_prop_change with the same uiState means the state prop was updated
        // to match what the user already has in the UI (e.g. action completed and
        // synced state back). No real user gesture — skip uiAction and command.
        if (e.type === "state_prop_change") {
          return false;
        }
        uiStateController.onUIAction(e);
        return false;
      }
      // set immediatly (don't wait for preact re-render) so ui is in the right state for:
      // - side effect
      // - any "input" event that might be dispatched below
      syncDomState(newUIState, e);
      uiStateController.uiState = newUIState;
      ownUIStateSignal.value = newUIState;
      // Radio group: when a radio becomes checked, uncheck all siblings.
      // We only update their UIState — no parent notification, no synthetic
      // input event (the browser never fires input on the unchecked radios,
      // and we don't want to trigger their action flow with a stale DOM value).
      // Uses the in-memory registry instead of DOM queries so this works even
      // when sibling items are virtualized (not in the DOM).
      // Form scoping is preserved by comparing parentUIStateController references.
      const controlProxyFor =
        uiStateController.controlHostProps["navi-control-proxy-for"];
      if (isRadio && newUIState && uiStateController.name && !controlProxyFor) {
        const siblings = getRadioSiblings(uiStateController);
        if (siblings) {
          const siblingUncheckEvent = new CustomEvent("radio_sibling_uncheck", {
            detail: {},
          });
          chainEvent(siblingUncheckEvent, e);
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
            siblingController.setUIState(undefined, siblingUncheckEvent);
          }
        }
      }
      debugUIState(e, `publishUIState(${JSON.stringify(newUIState)})`);
      publishUIState(newUIState, e);
      const el = ref.current;
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
      if (!controlProxyFor) {
        // Find any mounted controller that declared itself as a proxy for this one.
        // Communicates directly to the proxy controller — no DOM query needed.
        const proxyController = findProxyController(id);
        if (proxyController) {
          const mirrorEvent = new CustomEvent("proxy_mirror_state", {
            detail: {},
          });
          chainEvent(mirrorEvent, e);
          proxyController.setUIState(newUIState, mirrorEvent);
        }
      }
      if (isInternalEvent(e)) {
        // Still fire uiAction so external listeners (e.g. signals) stay in
        // sync, but do NOT fire the command and do NOT notify the parent —
        // both would cause an infinite loop when a parent cascades state
        // down to its children (child command would re-trigger the cascade).
        uiStateController.onUIAction(e, {
          skipCommand: true,
        });
        return true;
      }
      notifyParentAboutChildUIAction(e, { stateChanged: true });
      if (controlProxyFor) {
        // Proxy: forward the state change to the real input.
        // Use a dedicated internal event so that when the real input's setUIState
        // sees stateIsTheSame=true (already updated by the real input's own flow),
        // it does NOT fire notifyParentAboutChildUIAction(stateChanged=false) back
        // to the group — which would trigger the group action with a stale value.
        const targetController = getUIStateControllerById(controlProxyFor);
        if (targetController) {
          debugUIState(
            e,
            `forwarding set_ui_state "${newUIState}" to ${getElementSignature(targetController.elementRef.current)}`,
          );
          const forwardEvent = new CustomEvent("proxy_forward_set_ui_state", {
            detail: {},
          });
          chainEvent(forwardEvent, e);
          targetController.setUIState(newUIState, forwardEvent);
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
              debugUIState(
                e,
                "dispatching synthetic input event without data for checkbox/radio",
              );
              el.dispatchEvent(new Event("input", { bubbles: true }));
            } else {
              debugUIState(
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
      uiStateController.onUIAction(e);
      // Sync validity after state change: re-check constraints against the new value.
      // Internal events (programmatic) → silent check only.
      // User events → full sync (may open/close callout).
      if (isInternalEvent(e)) {
        uiStateController.rules.validation.checkValidity({ event: e });
      } else {
        uiStateController.rules.validation.syncValidity(e);
      }
      return true;
    },
    clearUIState: (e) => {
      uiStateController.setUIState("", e);
    },
    resetUIState: (e) => {
      uiStateController.setUIState(uiStateController.state, e);
    },
    actionEnd: async (e) => {
      debugUIState(`"${controlType}" actionEnd called`);
      // wait for preact to re-render to update readonly as action end side effects are runned
      await new Promise((r) => requestAnimationFrame(r));
      uiStateController.rules.validation.syncValidity(e);
    },
    actionError: (e) => {
      debugUIState(`"${controlType}" actionError called`);
      uiStateController.rules.validation.syncValidity(e);
    },
    subscribe: subscribeUIState,
    // Leaf controls don't aggregate children, but they act as a transparent
    // pass-through so that controls nested inside them (e.g. an Input inside
    // a List.Item) can bubble up registration to the nearest group ancestor.
    registerChild: (childUIStateController, options) => {
      if (parentUIStateController) {
        parentUIStateController.registerChild(childUIStateController, options);
      }
    },
    unregisterChild: (childUIStateController) => {
      if (parentUIStateController) {
        parentUIStateController.unregisterChild(childUIStateController);
      }
    },
    onChildUIAction: (childUIStateController, e, options) => {
      if (parentUIStateController) {
        parentUIStateController.onChildUIAction(
          childUIStateController,
          e,
          options,
        );
      }
    },
  };
  uiStateControllerRef.current = uiStateController;
  const rules = createControlRules(uiStateController, {
    debugPopup,
    debugInteraction,
    debugUIState,
    debugFocus,
  });
  uiStateController.rules = rules;
  return uiStateController;
};

const NO_PARENT = [() => {}, () => {}, () => {}];
const useParentControllerNotifiers = (
  parentUIStateController,
  uiStateControllerRef,
  controlType,
  debugUIState,
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

    const notifyParentAboutChildUIAction = (
      e,
      { stateChanged, silent = false },
    ) => {
      const uiStateController = uiStateControllerRef.current;
      debugUIState(
        `"${controlType}" notifying "${parentControlType}" of child ui action (stateChanged: ${stateChanged})`,
      );
      parentUIStateController.onChildUIAction(uiStateController, e, {
        stateChanged,
        silent,
      });
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
      notifyParentAboutChildUIAction,
      notifyParentAboutChildUnmount,
    ];
  }, []);
};

/**
 * Manages the aggregated UI state of a group of child controls (radio list, checkbox list, etc.).
 *
 * Children register themselves automatically on mount and unregister on unmount.
 * Whenever a child fires a UI action, the group re-aggregates all child states
 * via `aggregateChildStates` and reacts accordingly.
 *
 * **Three distinct methods — each with a clear responsibility**:
 *
 * - `setUIState(newUIState, e)` — called when a child UI action **changes** the aggregated value.
 *   Updates the group state, then calls `onUIAction(e)` for user-observable reactions
 *   (uiAction, command), then dispatches `navi_ui_state_change` so `control_hooks.jsx`
 *   can trigger the action pipeline (constraints → execute action).
 *
 * - `syncInternalState(newUIState)` — called silently during mount/unmount/render-batch.
 *   Updates state and signal with no external reactions whatsoever.
 *
 * - `onUIAction(e)` — called when a child's UI action does **not** change the aggregated
 *   value (e.g. re-clicking an already-selected radio). Fires `uiAction` + `command` only;
 *   does not touch state, does not trigger the action pipeline.
 *
 * **Child UI action flow**:
 * 1. Child leaf fires `notifyParentAboutChildUIAction(e, { stateChanged })`.
 * 2. Group's `onChildUIAction` receives it.
 *    - If `stateChanged=true`: re-aggregates → `setUIState` → full reactions + action pipeline.
 *    - If `stateChanged=false`: calls `onUIAction` → uiAction + command only.
 *
 * **Filtering**: `childControlFilter` can exclude certain child types from aggregation
 * (e.g. ignoring buttons inside a selectable list).
 */
export const useUIGroupStateController = (
  props,
  controlType,
  {
    stateType,
    childControlFilter,
    aggregateChildStates,
    wantRequesterButtonState,
    uiActionInternal,
    allowCapture = false,
    cascadeValidationToChildren = false,
  },
) => {
  const debugPopup = useDebugPopup();
  const debugInteraction = useDebugInteraction();
  const debugUIGroup = useDebugUIState();
  const debugFocus = useDebugFocus();

  if (typeof aggregateChildStates !== "function") {
    throw new TypeError("aggregateChildStates must be a function");
  }
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const { id, name, value, uiAction, command } = props;
  const ref = props.ref;
  const uiActionRef = useRef(uiAction);
  const fallbackState =
    stateType === "array"
      ? EMPTY_ARRAY
      : stateType === "object"
        ? EMPTY_OBJECT
        : undefined;
  const childUIStateControllerArrayRef = useRef([]);
  const childUIStateControllerArray = childUIStateControllerArrayRef.current;
  const controllerRef = useRef();
  // Tracks children this controller rejected and delegated upward (bubble-up
  // registration). Used to forward onChildUIAction and unregisterChild.
  const delegatedChildrenRef = useRef(new Map());

  const groupIsRenderingRef = useRef(false);
  const pendingChangeRef = useRef(false);
  groupIsRenderingRef.current = true;
  pendingChangeRef.current = false;

  const [
    notifyParentAboutChildMount,
    notifyParentAboutChildUIAction,
    notifyParentAboutChildUnmount,
  ] = useParentControllerNotifiers(
    parentUIStateController,
    controllerRef,
    controlType,
    debugUIGroup,
  );
  useLayoutEffect(() => {
    const controller = controllerRef.current;
    const el = ref.current;
    if (el) {
      el.__uiStateController__ = controller;
    }
    notifyParentAboutChildMount();
    return () => {
      notifyParentAboutChildUnmount();
      onUIStateControllerDestroyed(controller);
    };
  }, []);

  const onChange = (e, { notifyExternal }) => {
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
    debugUIGroup(
      e,
      `${controlType}.getUIState -> ${JSON.stringify(groupUIState)}`,
    );
    const groupUIStateController = controllerRef.current;
    if (notifyExternal === true) {
      applyState(groupUIState, e);
    } else if (notifyExternal === "silent") {
      // Silent mount/unmount sync: update state without triggering uiAction/command,
      // but still notify parent (e.g. facade) so it can track the current child state.
      groupUIStateController.syncInternalState(groupUIState, e);
      notifyParentAboutChildUIAction(e, {
        stateChanged: true,
        silent: true,
      });
    } else {
      groupUIStateController.syncInternalState(groupUIState, e);
    }
  };

  // Applies the aggregated state: updates signal, fires uiAction/command/navi_ui_state_change,
  // and notifies the parent. Called both from onChange (after child UI action) and from
  // setUIState (after cascading to children).
  const applyState = (newUIState, e, { internalBehavior = false } = {}) => {
    const groupUIStateController = controllerRef.current;
    const currentUIState = groupUIStateController.uiState;
    groupUIStateController.uiState = newUIState;
    uiStateSignal.value = newUIState;
    debugUIGroup(
      e,
      `${controlType}.applyState(${JSON.stringify(newUIState)}, "${e.type}") -> updates from ${JSON.stringify(currentUIState)} to ${JSON.stringify(newUIState)}`,
    );
    publishUIState(newUIState);
    // Notify the parent (facade) BEFORE firing the command so that when a
    // command like --navi-send closes the picker, the picker input already
    // holds the new value.
    notifyParentAboutChildUIAction(e, { stateChanged: true });
    groupUIStateController.onUIAction(e, {
      skipCommand: internalBehavior,
    });
    const el = ref.current;
    if (el) {
      dispatchInternalCustomEvent(el, "navi_ui_state_change", {
        event: e,
        value: newUIState,
      });
    }
  };

  useLayoutEffect(() => {
    groupIsRenderingRef.current = false;
    if (pendingChangeRef.current) {
      pendingChangeRef.current = false;
      onChange(new CustomEvent(`${controlType}_batched_ui_state_update`), {
        notifyExternal: "silent",
      });
    }
  });

  const existingController = controllerRef.current;
  if (existingController) {
    existingController.props = props;
    existingController.id = id;
    existingController.name = name;
    existingController.value = value;
    uiActionRef.current = uiAction;
    return existingController;
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
  const groupUIStateController = {
    controlType,
    id,
    name,
    value,
    props,
    uiState: fallbackState,
    uiStateSignal,
    wantRequesterButtonState,
    elementRef: ref,
    getPropFromState: (uiState) => uiState,
    // Cascades the new value to each monitored child (fires each child's uiAction
    // via internalBehavior), then re-aggregates and fires this group's own reactions.
    // Cascade strategy depends on controlType:
    //   - "radio_group": child gets true/false based on whether its value matches the scalar state.
    //   - "checkbox_group": child gets true/false based on whether its value is in the state array.
    //   - default (ControlGroup): child gets the value at its named key in the state object.
    setUIState: (newUIState, e) => {
      if (
        stateType === "object" &&
        (newUIState === null || typeof newUIState !== "object")
      ) {
        console.warn(
          `[${controlType}] setUIState received a non-object value: ${JSON.stringify(newUIState)} (expected an object). Ignoring.`,
          newUIState,
        );
        return;
      }
      if (stateType === "array" && !Array.isArray(newUIState)) {
        console.warn(
          `[${controlType}] setUIState received a non-array value: ${JSON.stringify(newUIState)} (expected an array). Ignoring.`,
          newUIState,
        );
        return;
      }
      const propagateDownEvent = new CustomEvent(
        "propagate_down_set_ui_state",
        { detail: {} },
      );
      chainEvent(propagateDownEvent, e);
      for (const childUIStateController of childUIStateControllerArray) {
        if (!isMonitoringChild(childUIStateController)) {
          continue;
        }
        if (childUIStateController.controlType === "button") {
          continue;
        }
        if (controlType === "radio_group") {
          const childChecked =
            childUIStateController.props.value === newUIState;
          childUIStateController.setUIState(childChecked, propagateDownEvent);
        } else if (controlType === "checkbox_group") {
          const childChecked =
            Array.isArray(newUIState) &&
            newUIState.includes(childUIStateController.props.value);
          childUIStateController.setUIState(childChecked, propagateDownEvent);
        } else {
          const childName = childUIStateController.name;
          if (
            childName &&
            newUIState !== null &&
            typeof newUIState === "object" &&
            Object.prototype.hasOwnProperty.call(newUIState, childName)
          ) {
            childUIStateController.setUIState(
              newUIState[childName],
              propagateDownEvent,
            );
          }
        }
      }
      // Re-aggregate from children and apply — do NOT call onChange to avoid a loop
      // (onChange would call setUIState again, which would cascade again).
      const aggChildState = aggregateChildStates(
        childUIStateControllerArray,
        fallbackState,
      );
      const groupUIState =
        aggChildState === undefined ? fallbackState : aggChildState;
      applyState(groupUIState, e, { internalBehavior: true });
    },
    // Called on mount/unmount/render-batch: updates state silently with no external reactions.
    syncInternalState: (newUIState) => {
      const currentUIState = groupUIStateController.uiState;
      if (newUIState === currentUIState) {
        return;
      }
      groupUIStateController.uiState = newUIState;
      uiStateSignal.value = newUIState;
      publishUIState(newUIState);
    },
    // Called when a child UI action does NOT change the aggregated value (e.g. radio re-clicked).
    // Fires uiAction + command without touching state or the action pipeline.
    onUIAction: (e, { skipCommand } = {}) => {
      const currentUIState = groupUIStateController.uiState;
      const uiAction = uiActionRef.current;
      uiAction?.(currentUIState, e);
      uiActionInternal?.(currentUIState, e);
      if (skipCommand) {
        // Fire uiAction only — skip command to avoid re-triggering the same command
        // that caused this setUIState call in the first place.
      } else if (command) {
        const el = ref.current;
        if (el) {
          triggerNaviCommand(el, command, e);
        }
      }
    },
    registerChild: (
      childUIStateController,
      // { bubbled = false } = {}
    ) => {
      if (!isMonitoringChild(childUIStateController)) {
        // Filter rejected this child.
        if (!allowCapture && parentUIStateController) {
          // Not a boundary — bubble the child up to the nearest ancestor.
          delegatedChildrenRef.current.set(
            childUIStateController,
            parentUIStateController,
          );
          parentUIStateController.registerChild(childUIStateController);
        }
        // allowCapture=true: hard boundary, stop bubbling and drop silently.
        // No parent: end of chain, drop silently.
        return;
      }
      const childControlType = childUIStateController.controlType;
      childUIStateControllerArray.push(childUIStateController);
      debugUIGroup(
        `${controlType}.registerChild("${childControlType}") -> registered (total: ${childUIStateControllerArray.length})`,
      );
      onChange(new CustomEvent(`${childControlType}_mount`), {
        notifyExternal: "silent",
        // childUIStateController,
      });
    },
    onChildUIAction: (childUIStateController, e, { stateChanged }) => {
      const delegatedTo = delegatedChildrenRef.current.get(
        childUIStateController,
      );
      if (delegatedTo) {
        // Forward UI action for delegated children — we don't aggregate them,
        // but their parent (who adopted them) needs to know about the change.
        delegatedTo.onChildUIAction(childUIStateController, e, {
          stateChanged,
        });
        return;
      }
      if (!isMonitoringChild(childUIStateController)) {
        return;
      }
      const childControlType = childUIStateController.controlType;
      debugUIGroup(
        `${controlType}.onChildUIAction("${childControlType}") stateChanged=${stateChanged} -> child state: ${JSON.stringify(
          childUIStateController.uiState,
        )}`,
      );
      if (stateChanged) {
        // Value changed: re-aggregate and fire all reactions (uiAction, command, action pipeline).
        onChange(e, { notifyExternal: true });
      } else {
        // Value unchanged (e.g. radio re-clicked): fire uiAction + command only.
        groupUIStateController.onUIAction(e);
      }
    },
    unregisterChild: (childUIStateController) => {
      const delegatedTo = delegatedChildrenRef.current.get(
        childUIStateController,
      );
      if (delegatedTo) {
        delegatedChildrenRef.current.delete(childUIStateController);
        delegatedTo.unregisterChild(childUIStateController);
        return;
      }
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
      onChange(new CustomEvent(`${childControlType}_unmount`), {
        notifyExternal: "silent",
        // childUIStateController,
      });
    },
    resetUIState: (e) => {
      const propagateDownResetEvent = new CustomEvent(
        "propagate_down_reset_ui_state",
        { detail: {} },
      );
      chainEvent(propagateDownResetEvent, e);
      for (const childUIStateController of childUIStateControllerArray) {
        if (!isMonitoringChild(childUIStateController)) {
          continue;
        }
        if (childUIStateController.controlType === "button") {
          continue;
        }
        childUIStateController.resetUIState(propagateDownResetEvent);
      }
      onChange(e, { notifyExternal: true });
    },
    clearUIState: (e) => {
      const propagateDownClearEvent = new CustomEvent(
        "propagate_down_clear_ui_state",
        { detail: {} },
      );
      chainEvent(propagateDownClearEvent, e);
      for (const childUIStateController of childUIStateControllerArray) {
        if (!isMonitoringChild(childUIStateController)) {
          continue;
        }
        if (childUIStateController.controlType === "button") {
          continue;
        }
        childUIStateController.clearUIState(propagateDownClearEvent);
      }
      onChange(e, { notifyExternal: true });
    },
    actionEnd: (e) => {
      groupUIStateController.rules.validation.syncValidity(e);
    },
    actionError: (e) => {
      groupUIStateController.rules.validation.syncValidity(e);
    },
    findChildById: (id) => {
      for (const childUIStateController of childUIStateControllerArray) {
        if (childUIStateController.id === id) {
          return childUIStateController;
        }
      }
      return null;
    },
    getChildControllers: () => childUIStateControllerArray,
    getManagedControls: () => {
      if (!cascadeValidationToChildren) {
        return [];
      }
      return childUIStateControllerArray.slice();
    },
    subscribe: subscribeUIState,
  };
  controllerRef.current = groupUIStateController;
  const rules = createControlRules(groupUIStateController, {
    debugPopup,
    debugInteraction,
    debugUIState: debugUIGroup,
    debugFocus,
  });
  groupUIStateController.rules = rules;
  return groupUIStateController;
};
// Stable reference for an empty selection so the action always receives an
// array (never undefined) and callers don't get a new reference each render.
const EMPTY_ARRAY = [];
const EMPTY_OBJECT = {};

/**
 * Facade UI state controller — establishes a transparent 1:1 sync between
 * the picker's hidden input and the first child control inside the picker popup.
 *
 * **Relationship**: picker input ↔ first child (Input, ControlGroup, …)
 *
 * - Child → picker input: when the child's UI state changes,
 *   `onChildUIAction` forwards the new value to the picker input using
 *   `dispatchRequestSetUIState` with `internalBehavior: true` so the picker input
 *   updates without triggering another propagation cycle.
 *
 * - Picker input → child: we listen to `navi_ui_state_change` on the picker
 *   input element. When the event fires AND we are not currently in a
 *   child→picker propagation (`updatingRef`), we push the new value down to
 *   the child with `internalBehavior: true`.
 *
 * The `updatingRef` flag breaks the potential loop:
 *   child changes → we update picker input → navi_ui_state_change fires →
 *   we see updatingRef=true → skip → no loop.
 *
 * This removes the need for `command="--navi-update"` on controls placed
 * inside the picker popup. It also means `commands.js` no longer has to
 * manually re-dispatch to inner controls.
 */
export const useUIFacadeStateController = (props, realUIStateController) => {
  const firstChildControllerRef = useRef(null);
  const updatingRef = useRef(false);
  const debugPopup = useDebugPopup();
  const debugInteraction = useDebugInteraction();
  const debugUIState = useDebugUIState();
  const debugFocus = useDebugFocus();

  useLayoutEffect(() => {
    return realUIStateController.subscribe((newUIState, e) => {
      if (updatingRef.current) {
        return;
      }
      const child = firstChildControllerRef.current;
      if (!child) {
        return;
      }
      updatingRef.current = true;
      const propagateDownEvent = new CustomEvent(
        "propagate_down_set_ui_state",
        { detail: {} },
      );
      chainEvent(propagateDownEvent, e);
      child.setUIState(newUIState, propagateDownEvent);
      updatingRef.current = false;
    });
  }, []);

  const includeChildController = (childController) => {
    if (childController.controlType === "button") {
      return false;
    }
    if (childController.props["navi-list"]) {
      // Controls with navi-list act as standalone list navigators and should
      // not be treated as the picker's synced child.
      return false;
    }
    if (
      props.type === "controlgroup" &&
      childController.controlType !== "control_group"
    ) {
      // ignore non control group registration (input outside the control group for instance)
      return false;
    }
    if (
      props.type === "array" &&
      childController.controlType !== "checkbox_group"
    ) {
      // only selectable list expose array, ignore others
      return false;
    }
    return true;
  };

  const controllerRef = useRef();
  if (controllerRef.current) {
    return controllerRef.current;
  }

  const facadeUIStateController = {
    controlType: "facade",
    props,
    elementRef: realUIStateController.elementRef,
    uiStateSignal: realUIStateController.uiStateSignal,
    registerChild: (child) => {
      if (!includeChildController(child)) {
        return;
      }
      const childType = child.controlType;
      if (firstChildControllerRef.current) {
        console.warn(
          `[useUIFacadeStateController] A second child ("${childType}"${child.name ? ` name="${child.name}"` : ""}) tried to register in the picker facade. ` +
            `The facade only syncs with the first child — wrap multiple controls in a single ControlGroup.`,
          child,
        );
      } else {
        debugUIState(
          `[useUIFacadeStateController] "${childType}"${child.name ? ` name="${child.name}"` : ""} registered as the first child in the picker facade.`,
        );
        firstChildControllerRef.current = child;
        realUIStateController.facadeChild = child;
      }
    },
    unregisterChild: (child) => {
      if (firstChildControllerRef.current === child) {
        firstChildControllerRef.current = null;
        realUIStateController.facadeChild = null;
      }
    },
    getManagedControls: () => {
      const child = firstChildControllerRef.current;
      if (!child) {
        return [];
      }
      return child.getManagedControls();
    },
    onChildUIAction: (child, e, { stateChanged, silent = false }) => {
      if (!stateChanged) {
        return;
      }
      if (child !== firstChildControllerRef.current) {
        return;
      }
      updatingRef.current = true;
      // Use a different event type for silent (mount/unmount) syncs so that
      // the picker's setUIState does not fire navi_change or action pipelines.
      const eventType = silent
        ? "facade_child_mount_sync"
        : "facade_propagate_up";
      const propagateUpEvent = new CustomEvent(eventType, {
        detail: {},
      });
      chainEvent(propagateUpEvent, e);
      realUIStateController.setUIState(child.uiState, propagateUpEvent);
      updatingRef.current = false;
    },
  };
  controllerRef.current = facadeUIStateController;
  const rules = createControlRules(facadeUIStateController, {
    debugPopup,
    debugInteraction,
    debugUIState,
    debugFocus,
  });
  facadeUIStateController.rules = rules;
  // No initial checkValidity() here — the facade has no controlHostProps and no children
  // have registered yet, so any check would be a no-op. The real validity check happens
  // when child controllers trigger UI actions through the facade.
  return facadeUIStateController;
};

/**
 * Returns true when `e` should trigger parent notification (child → parent bubbling).
 *
 * Events that originate from the parent (or from siblings) should NOT bubble back up
 * to avoid infinite loops. The event type itself carries this information:
 *
 * - `"state_prop_change"` — re-syncing with the external `state` prop (`_checkForUpdates`).
 * - `"radio_sibling_uncheck"` — a radio sibling is being unchecked programmatically.
 * - `"propagate_down_set_ui_state"` / `"propagate_down_reset_ui_state"` / `"propagate_down_clear_ui_state"` —
 *   parent (group or facade) is pushing state down to children.
 *
 * State IS propagated by these events (e.g. `facade_child_mount_sync` travels from
 * group → facade → picker input to sync the picker's displayed value). What is suppressed
 * is the **UI action side effects**: action pipeline, commands, synthetic input events,
 * and further parent notification chains.
 *
 * Anything not in this set is treated as a real user UI action and triggers the full pipeline.
 */
const INTERNAL_EVENT_SET = new Set([
  "state_prop_change",
  "radio_sibling_uncheck",
  // Proxy forwarding to real input: prevents the real input from sending a
  // spurious stateChanged=false notification to the group when the proxy
  // forwards back a value the real input already holds.
  "proxy_forward_set_ui_state",
  // Real input mirroring state to its proxy: the proxy is a visual replica;
  // it should sync DOM only — no action pipeline, no group notification, no synthetic input.
  "proxy_mirror_state",
  "propagate_down_set_ui_state",
  "propagate_down_reset_ui_state",
  "propagate_down_clear_ui_state",
  // Silent mount/unmount sync: state is propagated from child group → facade → picker input
  // so the picker knows the child's current value (e.g. for "store value at open"),
  // but no action pipeline, command, or synthetic input event should fire.
  "facade_child_mount_sync",
]);
const isInternalEvent = (e) => {
  return INTERNAL_EVENT_SET.has(e.type);
};

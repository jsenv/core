import {
  chainEvent,
  createPubSub,
  dispatchInternalCustomEvent,
  findEvent,
  getElementSignature,
} from "@jsenv/dom";
import { computed, signal } from "@preact/signals";
import { createContext } from "preact";
import { useContext, useLayoutEffect, useRef } from "preact/hooks";

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
 *   ref: Ref; // Used to dispatch DOM events
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
 * The controller exposes `ref` so parent groups can dispatch DOM events on children
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
  if (persists === undefined && formContext) {
    persists = true;
  }
  const controlType = controlInfo.controlType;
  const isRadio = controlType === "input" && props.type === "radio";
  const isProxy = Boolean(props["navi-control-proxy-for"]);

  // Single "live context" ref — mutated in place on every render before any
  // early-return.  Controller methods close over `live` (= liveRef.current).
  // Because Object.assign mutates the same object reference, every closure
  // always reads the latest values — no stale captures.
  const liveRef = useRef();
  if (!liveRef.current) liveRef.current = {};
  const live = liveRef.current;
  if (!live.parentUiStateSignalHolder) {
    live.parentUiStateSignalHolder = signal(
      parentUIStateController?.uiStateSignal ?? null,
    );
  }
  live.parentUiStateSignalHolder.value =
    parentUIStateController?.uiStateSignal ?? null;
  Object.assign(live, {
    ref: props.ref,
    id: props.id,
    name: props.name,
    props,
    controlInfo,
    uiAction: props.uiAction,
    uiActionInternal,
    parentUIStateController,
  });

  // DOM binding: runs once on mount, cleans up on unmount.
  useLayoutEffect(() => {
    const controller = uiStateControllerRef.current;
    const el = controller.ref.current;
    if (el) {
      el.__uiStateController__ = controller;
    }
    return () => {
      if (el && el.__uiStateController__ === controller) {
        delete el.__uiStateController__;
      }
      onUIStateControllerDestroyed(controller);
    };
  }, []);
  // Parent registration: re-runs when parent controller changes identity.
  // The parent is captured locally at effect-run time so the cleanup always
  // unregisters from the correct (old) parent, not whatever parent is current
  // at cleanup time.
  useLayoutEffect(() => {
    const parent = live.parentUIStateController;
    if (!parent) return undefined;
    const controller = uiStateControllerRef.current;
    debugUIState(`"${controlType}" registering into "${parent.controlType}"`);
    parent.registerChild(controller);
    return () => {
      debugUIState(`"${controlType}" unregistering from "${parent.controlType}"`);
      parent.unregisterChild(controller);
    };
  }, [parentUIStateController]);

  const existingUIStateController = uiStateControllerRef.current;
  if (existingUIStateController) {
    // Sync all public-facing fields for external callers (control_validation.js,
    // control_callout.js, etc.) from liveRef — one place, not scattered.
    existingUIStateController.ref = live.ref;
    existingUIStateController.id = live.id;
    existingUIStateController.name = live.name;
    existingUIStateController.props = live.props;
    const { value, hasStateProp, state, stateInitial } = controlInfo;
    existingUIStateController.value = value;
    if (hasStateProp) {
      existingUIStateController.hasStateProp = true;
      const currentState = existingUIStateController.state;
      if (!compareTwoJsValues(state, currentState)) {
        existingUIStateController.state = state;
        existingUIStateController.setUIState(
          state,
          new CustomEvent("state_prop_change"),
        );
      }
    } else if (existingUIStateController.hasStateProp) {
      existingUIStateController.hasStateProp = false;
      existingUIStateController.state = stateInitial;
    }
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
        // Read through the holder signal (reactive) so that when the parent
        // controller changes identity and we update the holder, this computed
        // re-subscribes to the NEW parent's uiStateSignal automatically.
        const parentSig = live.parentUiStateSignalHolder.value;
        const parentUIState = parentSig?.value;
        const ownUIState = ownUIStateSignal.value;
        return ownUIState || parentUIState;
      })
    : ownUIStateSignal;

  const uiStateController = {
    controlType,
    parentUIStateController,
    isProxy,
    allowNameless,

    props,
    ref: props.ref,
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
      live.uiActionInternal?.(currentUIState, e);
      if (live.uiAction) {
        debugUIState(`calling uiAction for ${controlType}`, currentUIState);
        live.uiAction(currentUIState, e);
      }
      if (skipCommand) {
      } else {
        const command = uiStateController.controlHostProps.command;
        if (command) {
          const element = uiStateController.ref.current;
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
      const guardResult = uiStateController.rules.guard.checkUIState(
        newUIState,
        e,
      );
      if (guardResult) {
        if (Object.hasOwn(guardResult, "fixedValue")) {
          newUIState = guardResult.fixedValue;
          // fall through — continue with truncated value (callout already shown by guard)
        } else {
          return false;
        }
      }
      const controllerSig = getElementSignature(
        e.currentTarget || uiStateController.ref.current,
      );
      // if (persists) {
      //   setNavState(prop);
      // }
      const currentUIState = uiStateController.uiState;
      const stateIsTheSame = compareTwoJsValues(newUIState, currentUIState);
      if (stateIsTheSame) {
        if (controlType === "button" || controlType === "link") {
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
          live.parentUIStateController?.onChildUIAction(
            uiStateController,
            e,
            { stateChanged: false },
          );
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
        // "change" fires after "input" for native inputs (date, color, etc.).
        // The "input" event already updated the state and fired uiAction.
        // When state is unchanged here it means "input" already ran — skip to
        // avoid a duplicate uiAction on the same user gesture.
        if (e.type === "change") {
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
              live.parentUIStateController
            ) {
              continue;
            }
            siblingController.setUIState(undefined, siblingUncheckEvent);
          }
        }
      }
      debugUIState(e, `publishUIState(${JSON.stringify(newUIState)})`);
      publishUIState(newUIState, e);
      const el = uiStateController.ref.current;
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
        const proxyController = findProxyController(live.id);
        if (proxyController) {
          const mirrorEvent = new CustomEvent("proxy_mirror_state", {
            detail: {},
          });
          chainEvent(mirrorEvent, e);
          proxyController.setUIState(newUIState, mirrorEvent);
        }
      }
      if (isInternalEvent(e)) {
        if (e.type === "facade_child_mount_sync") {
          // Warn when the picker's initial signal value is "" but the list
          // resolved to undefined (no selection). These are semantically
          // equivalent but technically different, so the mount-sync registers
          // as a state change and fires uiAction unexpectedly.
          // Fix: initialise the signal with undefined instead of "".
          const wasEmptyString =
            currentUIState === "" && newUIState === undefined;
          const wasUndefinedNowEmpty =
            currentUIState === undefined && newUIState === "";
          if (wasEmptyString) {
            console.warn(
              `[navi] Picker mount sync changed state from "" to undefined. ` +
                `This will call uiAction on mount, which is likely unintended. ` +
                `Initialise the signal with undefined instead of "" to avoid this.`,
            );
          } else if (wasUndefinedNowEmpty) {
            console.warn(
              `[navi] Picker mount sync changed state from undefined to "". ` +
                `This will call uiAction on mount, which is likely unintended. ` +
                `The child component is emitting "" for an empty value — it should emit undefined instead.`,
            );
          }
        }
        // initial_state_push is pure initialization (equivalent to defaultValue on the
        // child itself): skip uiAction entirely so no side effects fire on mount.
        if (e.type !== "initial_state_push") {
          // Still fire uiAction so external listeners (e.g. signals) stay in
          // sync, but do NOT fire the command and do NOT notify the parent —
          // both would cause an infinite loop when a parent cascades state
          // down to its children (child command would re-trigger the cascade).
          uiStateController.onUIAction(e, {
            skipCommand: true,
          });
        }
        // Exception: when the facade propagates a child state change up to the
        // real picker input, also notify the parent group (e.g. Form) so it
        // keeps its cached aggregated state in sync and fires its own uiAction.
        // This is consistent with how a direct Input inside a Form behaves:
        // the Form's uiAction fires on every value change.
        if (e.type === "facade_propagate_up") {
          live.parentUIStateController?.onChildUIAction(
            uiStateController,
            e,
            { stateChanged: true },
          );
        }
        // Exception: state_prop_change can only fire on a control with its own
        // controlled state/value prop (see hasStateProp above) — groups never
        // cascade state down into such children (they're explicitly skipped,
        // see shouldPropagateStateToChild/hasStateProp checks), so this change
        // can never be an echo of the parent's own cascade. The loop risk this
        // suppression exists for only applies when the parent itself just pushed
        // this value down, which requires the parent to be controlled (have its
        // own state/value prop). When the parent is "stateless" (uncontrolled),
        // notifying it is always safe and necessary — otherwise its aggregated
        // state silently drifts out of sync with this child.
        if (
          e.type === "state_prop_change" &&
          live.parentUIStateController &&
          !live.parentUIStateController.hasStateProp
        ) {
          live.parentUIStateController.onChildUIAction(
            uiStateController,
            e,
            { stateChanged: true },
          );
        }
        return true;
      }
      live.parentUIStateController?.onChildUIAction(
        uiStateController,
        e,
        { stateChanged: true },
      );
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
            `forwarding set_ui_state "${newUIState}" to ${getElementSignature(targetController.ref.current)}`,
          );
          const forwardEvent = new CustomEvent("proxy_forward_set_ui_state", {
            detail: {},
          });
          chainEvent(forwardEvent, e);
          targetController.setUIState(newUIState, forwardEvent);
        }
      }
      let syntheticInputFired = false;
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
              syntheticInputFired = true;
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
              syntheticInputFired = true;
            }
          }
          // TODO: select, textarea
        }
      }
      // When a synthetic "input" event was dispatched, the stateIsTheSame path
      // already called onUIAction via the input event handler — skip here to
      // avoid a duplicate uiAction on the same user gesture.
      if (!syntheticInputFired) {
        uiStateController.onUIAction(e);
      }
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
      // Radio and checkbox "unchecked" state is `undefined`, not `""`.
      // Passing `""` would set checked=true because `"" !== undefined`.
      const isCheckable =
        controlType === "input" &&
        (props.type === "radio" || props.type === "checkbox");
      uiStateController.setUIState(isCheckable ? undefined : "", e);
    },
    resetUIState: (e) => {
      uiStateController.setUIState(uiStateController.state, e);
    },
    onActionEnd: async (e) => {
      debugUIState(`"${controlType}" actionEnd called`);
      // wait for preact to re-render to update readonly as action end side effects are runned
      // await new Promise((r) => requestAnimationFrame(r));
      uiStateController.rules.validation.syncValidity(e);
    },
    onActionError: (e) => {
      debugUIState(`"${controlType}" actionError called`);
      uiStateController.rules.validation.syncValidity(e, { report: true });
    },
    subscribe: subscribeUIState,
    // Leaf controls don't aggregate children, but they act as a transparent
    // pass-through so that controls nested inside them (e.g. an Input inside
    // a List.Item) can bubble up registration to the nearest group ancestor.
    // Reads from liveRef.current so calls always reach the live parent.
    registerChild: (childUIStateController, options) => {
      live.parentUIStateController?.registerChild(
        childUIStateController,
        options,
      );
    },
    unregisterChild: (childUIStateController) => {
      live.parentUIStateController?.unregisterChild(
        childUIStateController,
      );
    },
    onChildUIAction: (childUIStateController, e, options) => {
      live.parentUIStateController?.onChildUIAction(
        childUIStateController,
        e,
        options,
      );
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
const CANNOT_DERIVE = Symbol("cannot_derive");

// Default aggregate/distribute implementations keyed by controlType or stateType.
// Looked up in useUIGroupStateController to fill in omitted aggregateChildStates /
// distributeChildUIState. If neither a default nor an explicit impl is found for a
// group, creation throws so the caller knows it must supply them.
const GROUP_DEFAULTS = {
  radio_group: {
    childControlFilter: (child) =>
      child.controlType === "input" && child.controlHostProps?.type === "radio",
    aggregateChildStates: (children) => {
      for (const child of children) {
        const childUIState = child.uiState;
        if (childUIState !== undefined) {
          return childUIState;
        }
      }
      return undefined;
    },
    distributeChildUIState: (newUIState, childUIStateController) => {
      const childSelected = childUIStateController.props.value === newUIState;
      if (childSelected) {
        return childUIStateController.props.value;
      }
      return undefined;
    },
  },
  checkbox_group: {
    childControlFilter: (child) =>
      child.controlType === "input" &&
      child.controlHostProps?.type === "checkbox",
    aggregateChildStates: (children) => {
      const values = [];
      for (const child of children) {
        const childUIState = child.uiState;
        if (childUIState !== undefined) {
          values.push(childUIState);
        }
      }
      return values.length === 0 ? undefined : values;
    },
    distributeChildUIState: (newUIState, childUIStateController) => {
      const childSelected =
        Array.isArray(newUIState) &&
        newUIState.includes(childUIStateController.props.value);
      if (childSelected) {
        return childUIStateController.props.value;
      }
      return undefined;
    },
  },
  object: {
    aggregateChildStates: (children) => {
      const groupValues = {};
      for (const child of children) {
        const { name, uiState, allowNameless } = child;
        if (!name) {
          if (!allowNameless) {
            console.warn(
              "A group child is missing a name property, its state won't be included in the group state",
              child,
            );
          }
          continue;
        }
        groupValues[name] = uiState;
      }
      return groupValues;
    },
    distributeChildUIState: (newUIState, child) => {
      const childName = child.name;
      if (
        childName &&
        newUIState !== null &&
        typeof newUIState === "object" &&
        Object.prototype.hasOwnProperty.call(newUIState, childName)
      ) {
        return newUIState[childName];
      }
      return CANNOT_DERIVE;
    },
  },
};

export const useUIGroupStateController = (
  props,
  controlType,
  {
    stateType,
    childControlFilter,
    aggregateChildStates,
    distributeChildUIState,
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

  const defaults = GROUP_DEFAULTS[controlType] ?? GROUP_DEFAULTS[stateType];
  const resolvedChildControlFilter =
    childControlFilter ?? defaults?.childControlFilter ?? null;
  const resolvedAggregateChildStates =
    aggregateChildStates ?? defaults?.aggregateChildStates;
  const resolvedDistributeChildUIState =
    distributeChildUIState ?? defaults?.distributeChildUIState;
  if (
    typeof resolvedAggregateChildStates !== "function" ||
    typeof resolvedDistributeChildUIState !== "function"
  ) {
    throw new Error(
      `No aggregate/distribute implementation found for controlType="${controlType}" stateType="${stateType}". ` +
        `Either use a known controlType/stateType or provide aggregateChildStates and distributeChildUIState explicitly.`,
    );
  }
  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const hasValueProp = Object.hasOwn(props, "value");
  const hasDefaultValueProp = Object.hasOwn(props, "defaultValue");
  const { id, name, value, defaultValue, uiAction } = props;
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

  // Single live context ref — same pattern as useUIStateController.
  const liveRef = useRef();
  if (!liveRef.current) liveRef.current = {};
  const live = liveRef.current;
  Object.assign(live, { ref, parentUIStateController });

  useLayoutEffect(() => {
    const controller = controllerRef.current;
    const el = ref.current;
    if (el) {
      el.__uiStateController__ = controller;
    }
    return () => {
      onUIStateControllerDestroyed(controller);
    };
  }, []);
  useLayoutEffect(() => {
    const parent = live.parentUIStateController;
    const controller = controllerRef.current;
    if (!parent) return undefined;
    debugUIGroup(`"${controlType}" registering into "${parent.controlType}"`);
    parent.registerChild(controller);
    return () => {
      debugUIGroup(
        `"${controlType}" unregistering from "${parent.controlType}"`,
      );
      parent.unregisterChild(controller);
    };
  }, [parentUIStateController]);

  const onChange = (e, { notifyExternal }) => {
    if (groupIsRenderingRef.current) {
      pendingChangeRef.current = true;
      return;
    }
    const aggChildState = resolvedAggregateChildStates(
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
      live.parentUIStateController?.onChildUIAction(
        controllerRef.current,
        e,
        { stateChanged: true, silent: true },
      );
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
    live.parentUIStateController?.onChildUIAction(
      controllerRef.current,
      e,
      { stateChanged: true },
    );
    groupUIStateController.onUIAction(e, {
      skipCommand: internalBehavior,
    });
    // Use controllerRef.current.ref rather than the closure `ref` so we always
    // get the live ref even after a Suspense-driven remount updated the ref identity.
    const el = controllerRef.current.ref.current;
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

  const isMonitoringChild = (childUIStateController) => {
    if (childUIStateController.isProxy) {
      return false;
    }
    if (
      resolvedChildControlFilter &&
      !resolvedChildControlFilter(childUIStateController)
    ) {
      return false;
    }
    return true;
  };
  const shouldPropagateStateToChild = (childUIStateController) => {
    if (!isMonitoringChild(childUIStateController)) {
      return false;
    }
    if (childUIStateController.controlType === "button") {
      return false;
    }
    if (childUIStateController.controlType === "link") {
      return false;
    }
    return true;
  };

  const existingController = controllerRef.current;
  if (existingController) {
    const prevValue = existingController.value;
    const prevHasValueProp = existingController.hasValueProp;
    existingController.props = props;
    // Re-sync to this render's ref object — see the matching comment in
    // useUIStateController._checkForUpdates for why this can't be captured
    // once at creation time and left untouched.
    existingController.ref = ref;
    existingController.id = id;
    existingController.name = name;
    existingController.value = value;
    existingController.defaultValue = defaultValue;
    existingController.hasValueProp = hasValueProp;
    existingController.hasDefaultValueProp = hasDefaultValueProp;
    uiActionRef.current = uiAction;
    // When the controlled value prop changes (or when becoming controlled for the
    // first time), silently cascade to children that have no individual state prop.
    if (
      hasValueProp &&
      (!prevHasValueProp || !compareTwoJsValues(value, prevValue))
    ) {
      const propagateDownEvent = new CustomEvent(
        "propagate_down_set_ui_state",
        { detail: {} },
      );
      for (const childUIStateController of childUIStateControllerArray) {
        if (!shouldPropagateStateToChild(childUIStateController)) {
          continue;
        }
        if (childUIStateController.hasStateProp) {
          continue;
        }
        const childNewState = existingController.distributeChildUIState(
          value,
          childUIStateController,
        );
        if (childNewState === CANNOT_DERIVE) {
          continue;
        }
        childUIStateController.setUIState(childNewState, propagateDownEvent);
      }
      existingController.syncInternalState(value);
    }
    return existingController;
  }
  debugUIGroup(
    `Creating "${controlType}" ui state controller (monitoring some descendants ui state(s))"`,
  );

  const [publishUIState, subscribeUIState] = createPubSub();
  const uiStateSignal = signal(fallbackState);
  const groupUIStateController = {
    controlType,
    id,
    name,
    value,
    defaultValue,
    hasValueProp,
    hasDefaultValueProp,
    props,
    uiState: fallbackState,
    uiStateSignal,
    wantRequesterButtonState,
    ref,
    getPropFromState: (uiState) => uiState,
    distributeChildUIState: resolvedDistributeChildUIState,
    // Cascades newUIState to each monitored child via resolvedDistributeChildUIState,
    // then re-aggregates and fires this group's own reactions.
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
      // initial_state_push propagates silently (no uiAction anywhere in the chain);
      // regular updates use propagate_down_set_ui_state which fires uiAction on children.
      const propagateEventType =
        e.type === "initial_state_push"
          ? "initial_state_push"
          : "propagate_down_set_ui_state";
      const propagateDownEvent = new CustomEvent(propagateEventType, {
        detail: {},
      });
      chainEvent(propagateDownEvent, e);
      for (const childUIStateController of childUIStateControllerArray) {
        if (!shouldPropagateStateToChild(childUIStateController)) {
          continue;
        }
        const childNewState = resolvedDistributeChildUIState(
          newUIState,
          childUIStateController,
        );
        if (childNewState === CANNOT_DERIVE) {
          continue;
        }
        childUIStateController.setUIState(childNewState, propagateDownEvent);
      }
      // Re-aggregate from children and apply — do NOT call onChange to avoid a loop
      // (onChange would call setUIState again, which would cascade again).
      const aggChildState = resolvedAggregateChildStates(
        childUIStateControllerArray,
        fallbackState,
      );
      const groupUIState =
        aggChildState === undefined ? fallbackState : aggChildState;
      if (e.type === "initial_state_push") {
        // Silent initialization: update state without firing uiAction or notifying parent.
        groupUIStateController.syncInternalState(groupUIState);
        return;
      }
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
      } else if (controllerRef.current.props.command) {
        const el = controllerRef.current.ref.current;
        if (el) {
          triggerNaviCommand(el, controllerRef.current.props.command, e);
        }
      }
    },
    registerChild: (
      childUIStateController,
      // { bubbled = false } = {}
    ) => {
      if (!isMonitoringChild(childUIStateController)) {
        // Filter rejected this child.
        const currentParent = live.parentUIStateController;
        if (!allowCapture && currentParent) {
          // Not a boundary — bubble the child up to the nearest ancestor.
          delegatedChildrenRef.current.set(childUIStateController, currentParent);
          currentParent.registerChild(childUIStateController);
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
      // Auto-derive child's initial state from the group's value/defaultValue
      // when the child has no individually-controlled state prop.
      // Use initial_state_push so uiAction does not fire during mount initialization.
      if (!childUIStateController.hasStateProp) {
        const initialEvent = new CustomEvent("initial_state_push", {
          detail: {},
        });
        if (groupUIStateController.hasValueProp) {
          // Controlled: always cascade current group value (even undefined = deselect all).
          const childNewState = resolvedDistributeChildUIState(
            groupUIStateController.value,
            childUIStateController,
          );
          if (childNewState !== CANNOT_DERIVE) {
            childUIStateController.setUIState(childNewState, initialEvent);
          }
        } else if (groupUIStateController.hasDefaultValueProp) {
          // Uncontrolled: set initial state from defaultValue on mount.
          const childNewState = resolvedDistributeChildUIState(
            groupUIStateController.defaultValue,
            childUIStateController,
          );
          if (childNewState !== CANNOT_DERIVE) {
            childUIStateController.setUIState(childNewState, initialEvent);
          }
        }
      }
      onChange(new CustomEvent(`${childControlType}_mount`), {
        notifyExternal: "silent",
        // childUIStateController,
      });
    },
    onChildUIAction: (childUIStateController, e, { stateChanged, silent }) => {
      const delegatedTo = delegatedChildrenRef.current.get(
        childUIStateController,
      );
      if (delegatedTo) {
        // Forward UI action for delegated children — we don't aggregate them,
        // but their parent (who adopted them) needs to know about the change.
        delegatedTo.onChildUIAction(childUIStateController, e, {
          stateChanged,
          silent,
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
        if (silent) {
          // Silent update: keep the group's cached state in sync without firing
          // uiAction, command, or action pipeline. Used when e.g. the picker facade
          // propagates a child state change up through an internal event path.
          onChange(e, { notifyExternal: "silent" });
        } else {
          // Value changed: re-aggregate and fire all reactions (uiAction, command, action pipeline).
          onChange(e, { notifyExternal: true });
        }
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
        if (!shouldPropagateStateToChild(childUIStateController)) {
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
        if (childUIStateController.controlType === "link") {
          continue;
        }
        childUIStateController.clearUIState(propagateDownClearEvent);
      }
      onChange(e, { notifyExternal: true });
    },
    onActionEnd: (e) => {
      groupUIStateController.rules.validation.syncValidity(e);
    },
    onActionError: (e) => {
      groupUIStateController.rules.validation.syncValidity(e, { report: true });
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

  // The facade controller object below is created once and cached across
  // renders (see the `controllerRef.current` early return). Its closures
  // (registerChild/unregisterChild/onChildUIAction) must not capture
  // `realUIStateController` directly: that parameter can legitimately point
  // to a different controller instance on a later render (e.g. the picker's
  // own controller getting recreated), and those closures would otherwise
  // stay bound to the original instance forever. Indirecting through a ref
  // that's refreshed on every render keeps every closure pointed at the
  // current instance.
  const realUIStateControllerRef = useRef(realUIStateController);
  realUIStateControllerRef.current = realUIStateController;

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
  }, [realUIStateController]);

  const canRegisterAsFacadeChild = (childController) => {
    if (childController.controlType === "button") {
      return false;
    }
    if (childController.controlType === "link") {
      return false;
    }
    if (childController.controlType === "facade") {
      return false;
    }
    if (childController.isProxy) {
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
    // Same reasoning as useUIStateController._checkForUpdates and
    // useUIGroupStateController's existing-controller branch: re-sync the
    // fields read directly (not through realUIStateControllerRef.current) so
    // they don't stay frozen on the instance that existed when this facade
    // was first created.
    controllerRef.current.ref = realUIStateController.ref;
    controllerRef.current.uiStateSignal = realUIStateController.uiStateSignal;
    controllerRef.current.controlHostProps =
      realUIStateController.controlHostProps;
    return controllerRef.current;
  }

  const facadeUIStateController = {
    controlType: "facade",
    props,
    ref: realUIStateController.ref,
    uiStateSignal: realUIStateController.uiStateSignal,
    registerChild: (child) => {
      if (!canRegisterAsFacadeChild(child)) {
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
        realUIStateControllerRef.current.facadeChild = child;
        // If the picker already has a meaningful state (from value or defaultValue),
        // push it to the child on registration so it reflects the pre-set value
        // without firing uiAction (equivalent to defaultValue on the child itself).
        const initialState = realUIStateControllerRef.current.uiState;
        if (initialState !== undefined) {
          updatingRef.current = true;
          const initialEvent = new CustomEvent("initial_state_push", {
            detail: {},
          });
          child.setUIState(initialState, initialEvent);
          updatingRef.current = false;
        }
      }
    },
    unregisterChild: (child) => {
      if (firstChildControllerRef.current === child) {
        firstChildControllerRef.current = null;
        realUIStateControllerRef.current.facadeChild = null;
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
      realUIStateControllerRef.current.setUIState(
        child.uiState,
        propagateUpEvent,
      );
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
  facadeUIStateController.controlHostProps =
    realUIStateController.controlHostProps;
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
  // Facade propagating child group state up to the picker input: the facade
  // already handled parent notification; the picker input must not re-notify
  // upward (loop risk) and must not dispatch a synthetic input that would
  // fire onUIAction a second time.
  "facade_propagate_up",
  "propagate_down_set_ui_state",
  "propagate_down_reset_ui_state",
  "propagate_down_clear_ui_state",
  // Silent mount/unmount sync: state is propagated from child group → facade → picker input
  // so the picker knows the child's current value (e.g. for "store value at open"),
  // but no action pipeline, command, or synthetic input event should fire.
  "facade_child_mount_sync",
  // Facade pushing its current state (from value/defaultValue) down to the first child
  // on registration, and group pushing value/defaultValue to children on registerChild.
  // Equivalent to defaultValue initialization: no uiAction, no commands, no parent notification.
  "initial_state_push",
]);
const isInternalEvent = (e) => {
  return INTERNAL_EVENT_SET.has(e.type);
};

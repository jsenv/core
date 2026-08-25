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
import { warnSignalCollision } from "./control_value.js";
import {
  findProxyControllers,
  getRadioSiblings,
  getUIStateControllerById,
  onUIStateControllerCreated,
  onUIStateControllerDestroyed,
} from "./controller_registry.js";
import { FormContext } from "./form_context.js";
import { createControlRules } from "./rules/control_rules.js";

/**
 * Returns a stable object that is mutated across renders.
 * Closures that capture the returned reference always read current values
 * because the same object reference is reused — no stale captures.
 *
 * - `init(scope)` — called **once** on mount. Receives the (initially empty)
 *   stable scope object and returns properties to assign to it. Use this to
 *   create anything that must live for the component's full lifetime: signals,
 *   pubsub pairs, the controller object itself, etc.
 *
 * - `update(scope)` — called on every subsequent render. Receives the current
 *   scope and returns properties to update. Use this to sync mutable values
 *   (current props, parent controller, etc.) and run side-effectful logic like
 *   checking whether a controlled `state` prop changed.
 */
const useRenderScope = (init, update) => {
  const scopeRef = useRef();
  let scope = scopeRef.current;
  if (!scope) {
    scope = {};
    scopeRef.current = scope;
    const initScope = init(scope);
    Object.assign(scope, initScope);
  } else {
    const updateScope = update(scope);
    Object.assign(scope, updateScope);
  }
  return scope;
};

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
 *   getInteractionBlockingControls(): UIStateController[]; // Subset of the above whose busy state also blocks interacting with this controller
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

  const parentUIStateController = useContext(ParentUIStateControllerContext);
  const formContext = useContext(FormContext);
  if (persists === undefined && formContext) {
    persists = true;
  }
  const controlType = controlInfo.controlType;
  const isRadio = controlType === "input" && props.type === "radio";
  const isProxy = Boolean(props["navi-control-proxy-for"]);
  const emptyUIState = resolveEmptyUIState(props, controlType);

  // Live values controller methods read through the scope (`s.…`) — one list
  // feeding both init and update: init so the values exist before any
  // re-render, update so they follow the renders. A value listed in only one
  // of the two goes stale on mount or across re-renders, silently.
  const liveValues = () => ({
    ref: props.ref,
    id: props.id,
    name: props.name,
    props,
    controlInfo,
    syncDomState,
    uiAction: props.uiAction,
    uiActionInternal,
    parentUIStateController,
  });

  const scope = useRenderScope(
    // ── init: runs once on mount ───────────────────────────────────────────
    // Creates the controller and all long-lived objects. Captures first-render
    // values for stable config (controlType, isRadio…); live values are read
    // through `s` which is always updated by `update` before any method call.
    (s) => {
      const parentUiStateSignalHolder = signal(
        parentUIStateController?.uiStateSignal ?? null,
      );
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
            const parentSig = parentUiStateSignalHolder.value;
            const parentUIState = parentSig?.value;
            const ownUIState = ownUIStateSignal.value;
            return ownUIState || parentUIState;
          })
        : ownUIStateSignal;

      // The two-way half of a bound `signal` prop: setting it re-renders and
      // re-syncs via state_prop_change, but with the same value → guarded as a
      // no-op, so no loop. For a checkbox/radio the signal holds the boolean
      // checked state.
      const writeBoundSignal = (uiState) => {
        const boundSignal = s.controlInfo?.signal;
        if (!boundSignal) {
          return;
        }
        boundSignal.value = s.controlInfo.signalHoldsChecked
          ? uiState !== undefined
          : uiState;
      };

      const controller = {
        controlType,
        parentUIStateController,
        parentUiStateSignalHolder,
        isProxy,
        allowNameless,
        emptyUIState,
        // Set here too, not only in `update` below: a control rendered once and
        // never re-rendered would otherwise never say whether it was GIVEN a
        // value (`value`, or a bound signal with no default of its own) or is
        // merely showing a suggestion (`defaultValue`) — a distinction Form
        // reads to decide what counts as already sent.
        hasStateProp: Boolean(controlInfo.hasStateProp),

        props,
        ref: props.ref,
        id: props.id,
        name: props.name,

        state: stateInitial,
        uiState: stateInitial,
        uiStateSignal,
        // What this control holds by ITSELF — the same signal as above unless
        // it is a button inheriting from the control around it (see `inherit`).
        // "The value I am about" and "the value I was given" are two different
        // questions, and a button answering the first with the second is how a
        // travel command ended up carrying a picker's selection: see
        // resolveCommandValue in commands.js.
        ownUIStateSignal,
        value: controlInfo.value,
        // The suggestion this control started on — what tells a field showing
        // its default from one carrying an answer (see isUIStateHeld).
        defaultValue: controlInfo.defaultValue,

        facadeChild: null,
        // Set for the duration of one interaction by whatever wants the
        // command to wait for something (a button's own action) — see the
        // command trigger in onUIAction below.
        commandDeferral: null,
        getManagedControls: () => {
          if (controller.facadeChild) {
            const child = controller.facadeChild;
            const childManaged = child.getManagedControls();
            if (childManaged.length > 0) {
              return childManaged;
            }
            return [child];
          }
          return [];
        },
        // A facade child lives inside the control's own popup, so it is out of
        // reach until that popup opens. Letting it block interaction would make
        // a picker whose content is loading impossible to open at all.
        getInteractionBlockingControls: () => [],
        onUIAction: (e, { skipCommand } = {}) => {
          if (controlType === "button" && controller.controlHostProps.name) {
            const buttonName = controller.controlHostProps.name;
            const parentController = controller.parentUIStateController;
            if (parentController && parentController.wantRequesterButtonState) {
              const currentState = parentController.uiState;
              const mergedState = {
                ...currentState,
                [buttonName]: controller.uiState,
              };
              parentController.syncInternalState(mergedState);
              debugUIState(
                `merging button state into parent control group:`,
                mergedState,
              );
            }
          }
          // Trigger uiAction/command side effects without changing UI state.
          const currentUIState = controller.uiState;
          writeBoundSignal(currentUIState);
          s.uiActionInternal?.(currentUIState, e);
          if (s.uiAction) {
            debugUIState(`calling uiAction for ${controlType}`, currentUIState);
            s.uiAction(currentUIState, e);
          }
          if (skipCommand) {
          } else {
            const command = controller.controlHostProps.command;
            if (command) {
              const element = controller.ref.current;
              if (element) {
                debugUIState(
                  `triggering command "${command}" for "${controlType}"`,
                );
                const runCommand = () => {
                  triggerNaviCommand(element, command, e);
                };
                // What the press means may not be due yet: a button with an
                // action of its own runs the work first and lets its command
                // follow only once that work succeeded (see control_hooks).
                // The command is handed over rather than run; nobody claiming
                // it means now.
                if (controller.commandDeferral) {
                  controller.commandDeferral(runCommand);
                } else {
                  runCommand();
                }
              }
            }
          }
        },
        setUIState: (newUIState, e) => {
          const guardResult = controller.rules.guard.checkUIState(
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
            e.currentTarget || controller.ref.current,
          );
          const currentUIState = controller.uiState;
          const stateIsTheSame = compareTwoJsValues(newUIState, currentUIState);
          if (stateIsTheSame) {
            if (controlType === "button" || controlType === "link") {
              if (!isInternalEvent(e)) {
                controller.onUIAction(e);
              }
              return true;
            }
            debugUIState(
              e,
              `${controllerSig}.setUIState(${JSON.stringify(newUIState)}, "${e.type}") -> state unchanged, no update needed`,
            );
            if (
              controlType === "input" &&
              controller.controlHostProps.type === "radio" &&
              !isInternalEvent(e)
            ) {
              s.parentUIStateController?.onChildUIAction(controller, e, {
                stateChanged: false,
              });
            }
            if (e.currentTarget === null) {
              // A stale/reused event (currentTarget is null) means this is a debounced
              // callback firing the original input event after a timeout. The state hasn't
              // changed and this is not a live user gesture — skip uiAction and command.
              return false;
            }
            if (e.type === "state_prop_change") {
              // state_prop_change with the same uiState means the state prop was updated
              // to match what the user already has in the UI (e.g. action completed and
              // synced state back). No real user gesture — skip uiAction and command.
              return false;
            }
            if (e.type === "change") {
              // "change" fires after "input" for native inputs (date, color, etc.).
              // The "input" event already updated the state and fired uiAction.
              // When state is unchanged here it means "input" already ran — skip to
              // avoid a duplicate uiAction on the same user gesture.
              return false;
            }
            controller.onUIAction(e);
            return false;
          }
          // set immediatly (don't wait for preact re-render) so ui is in the right state for:
          // - side effect
          // - any "input" event that might be dispatched below
          // Read through the scope: syncDomState closes over the render's props
          // (ref, type, pad), so the mount-time one would write a stale element.
          s.syncDomState(newUIState, e);
          controller.uiState = newUIState;
          ownUIStateSignal.value = newUIState;
          const controlProxyFor =
            controller.controlHostProps["navi-control-proxy-for"];
          // Radio group: when a radio becomes checked, uncheck all siblings.
          // We only update their UIState — no parent notification, no synthetic
          // input event (the browser never fires input on the unchecked radios,
          // and we don't want to trigger their action flow with a stale DOM value).
          // Uses the in-memory registry instead of DOM queries so this works even
          // when sibling items are virtualized (not in the DOM).
          // Form scoping is preserved by comparing parentUIStateController references.
          // Checked, not truthy: a radio holding `false` (two rows asking a
          // yes/no) is as checked as one holding a name, and the row that was
          // checked before has to let go all the same.
          if (
            isRadio &&
            newUIState !== undefined &&
            controller.name &&
            !controlProxyFor
          ) {
            const siblings = getRadioSiblings(controller);
            if (siblings) {
              const siblingUncheckEvent = new CustomEvent(
                "radio_sibling_uncheck",
                { detail: {} },
              );
              chainEvent(siblingUncheckEvent, e);
              for (const siblingController of siblings) {
                if (siblingController === controller) {
                  continue;
                }
                if (
                  siblingController.parentUIStateController !==
                  s.parentUIStateController
                ) {
                  continue;
                }
                siblingController.setUIState(undefined, siblingUncheckEvent);
              }
            }
          }
          debugUIState(e, `publishUIState(${JSON.stringify(newUIState)})`);
          publishUIState(newUIState, e);
          // A picker hands what it holds to the control in its popup — see
          // useUIFacadeStateController, which is what puts this here.
          controller.pushStateDownToFacadeChild?.(newUIState, e);
          const el = controller.ref.current;
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
          if (!controlProxyFor) {
            // When this controller is a real input that has a visible proxy
            // (linked via `navi-control-proxy-for`), mirror the new state to the
            // proxy DOM synchronously. Otherwise the proxy would only catch up
            // later through a React re-render — visible as e.g. two radios
            // appearing checked at once between the real input update and the
            // next render (radio_sibling_uncheck case).
            // Every mounted controller that declared itself as a proxy for this
            // one. Communicates directly to them — no DOM query needed.
            const proxyControllerSet = findProxyControllers(s.id);
            if (proxyControllerSet) {
              for (const proxyController of proxyControllerSet) {
                const mirrorEvent = new CustomEvent("proxy_mirror_state", {
                  detail: {},
                });
                chainEvent(mirrorEvent, e);
                proxyController.setUIState(newUIState, mirrorEvent);
              }
            }
          }
          if (isInternalEvent(e)) {
            if (isPropagateDownEvent(e)) {
              // A bound signal mirrors what the control holds, and what it
              // holds just changed — see isPropagateDownEvent.
              writeBoundSignal(newUIState);
            }
            if (e.type === "facade_child_mount_sync") {
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
              controller.onUIAction(e, { skipCommand: true });
            }
            if (e.type === "facade_propagate_up") {
              // Exception: when the facade propagates a child state change up to the
              // real picker input, also notify the parent group (e.g. Form) so it
              // keeps its cached aggregated state in sync and fires its own uiAction.
              // This is consistent with how a direct Input inside a Form behaves:
              // the Form's uiAction fires on every value change.
              s.parentUIStateController?.onChildUIAction(controller, e, {
                stateChanged: true,
              });
            }
            if (
              e.type === "state_prop_change" &&
              s.parentUIStateController &&
              !s.parentUIStateController.hasStateProp
            ) {
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
              s.parentUIStateController.onChildUIAction(controller, e, {
                stateChanged: true,
              });
            }
            return true;
          }
          s.parentUIStateController?.onChildUIAction(controller, e, {
            stateChanged: true,
          });
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
              const forwardEvent = new CustomEvent(
                "proxy_forward_set_ui_state",
                { detail: {} },
              );
              chainEvent(forwardEvent, e);
              targetController.setUIState(newUIState, forwardEvent);
            }
          }
          // Dispatch a synthetic "input" event so external listeners see the new
          // value. Skip when an input event on this element already exists in the chain.
          let syntheticInputFired = false;
          if (el) {
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
                  dispatchSyntheticInput(
                    el,
                    new Event("input", { bubbles: true }),
                    e,
                  );
                  syntheticInputFired = true;
                } else {
                  debugUIState(
                    e,
                    `dispatching synthetic input event with data "${newUIState}" for input`,
                  );
                  dispatchSyntheticInput(
                    el,
                    new InputEvent("input", {
                      bubbles: true,
                      cancelable: true,
                      inputType: "insertText",
                      data: newUIState,
                    }),
                    e,
                  );
                  syntheticInputFired = true;
                }
              } else if (el.tagName === "SELECT") {
                debugUIState(
                  e,
                  `dispatching synthetic input event for select "${newUIState}"`,
                );
                // A plain Event, not an InputEvent: that is what the browser
                // itself fires on a select, and input_effect reads the value off
                // the element anyway.
                dispatchSyntheticInput(
                  el,
                  new Event("input", { bubbles: true }),
                  e,
                );
                syntheticInputFired = true;
              }
              // TODO: textarea
            }
          }
          if (!syntheticInputFired) {
            // When a synthetic "input" event was dispatched, the stateIsTheSame path
            // already called onUIAction via the input event handler — skip here to
            // avoid a duplicate uiAction on the same user gesture.
            controller.onUIAction(e);
          }
          // Sync validity after state change: re-check constraints against the new value.
          // Internal events (programmatic) → silent check only.
          // User events → full sync (may open/close callout).
          if (isInternalEvent(e)) {
            controller.rules.validation.checkValidity({ event: e });
          } else {
            controller.rules.validation.syncValidity(e);
          }
          return true;
        },
        clearUIState: (e) => {
          controller.setUIState(resolveClearedUIState(controller), e);
        },
        resetUIState: (e) => {
          controller.setUIState(controller.state, e);
        },
        onActionEnd: (e) => {
          debugUIState(`"${controlType}" actionEnd called`);
          controller.rules.validation.syncValidity(e);
        },
        onActionError: (e) => {
          debugUIState(`"${controlType}" actionError called`);
          controller.rules.validation.syncValidity(e, { report: true });
        },
        subscribe: subscribeUIState,
        // Leaf controls act as a transparent pass-through so that controls
        // nested inside them (e.g. an Input inside a List.Item) can bubble
        // up registration to the nearest group ancestor.
        registerChild: (childUIStateController, options) => {
          s.parentUIStateController?.registerChild(
            childUIStateController,
            options,
          );
        },
        unregisterChild: (childUIStateController) => {
          s.parentUIStateController?.unregisterChild(childUIStateController);
        },
        onChildUIAction: (childUIStateController, e, options) => {
          s.parentUIStateController?.onChildUIAction(
            childUIStateController,
            e,
            options,
          );
        },
      };
      const rules = createControlRules(controller, {
        debugPopup,
        debugInteraction,
        debugUIState,
        debugFocus,
      });
      controller.rules = rules;

      return {
        controller,
        parentUiStateSignalHolder,
        ...liveValues(),
      };
    },
    // ── update: runs every render after the first ─────────────────────────
    // Syncs public-facing fields and handles controlled state prop changes.
    (s) => {
      const { controller } = s;
      // Raw Preact props from the current render. These are the component's input props,
      // not the resolved/curated host props. useInteractiveProps overwrites
      // uiStateController.controlHostProps with the resolved subset on every render.
      controller.props = props;
      // Re-sync to this render's ref object. It's normally stable, but it can
      // legitimately change identity (e.g. switching from an internal fallback
      // ref to a forwarded one, or across an interrupted/resumed render such as
      // a Suspense boundary resolving) — if we kept the original ref forever,
      // `ref.current` would be stuck at whatever it was at creation time, even
      // after the controller has moved on to a different, live DOM node.
      controller.ref = props.ref;
      controller.id = props.id; // never supposed to change, not supported for now
      controller.name = props.name;
      controller.emptyUIState = emptyUIState;
      controller.parentUIStateController = parentUIStateController;
      const {
        value,
        defaultValue,
        hasStateProp,
        state,
        stateInitial,
        stateFromSignal,
      } = controlInfo;
      controller.value = value;
      controller.defaultValue = defaultValue;
      // An optimistic control with work in flight keeps the user's intent on
      // screen: an incoming external state is the echo of an intermediate
      // commit (the first of two queued toggles landing), and the queued
      // request about to go out was built on top of the UI state —
      // overwriting it would both flash the superseded value and send it.
      // `controller.state` is still taken below: it is the last known good
      // state, the rollback target if the chain fails.
      const optimisticWorkInFlight = Boolean(
        props.optimistic &&
        (controller.actionInFlight || controller.queuedActionAllowedEvent),
      );
      if (hasStateProp) {
        controller.hasStateProp = true;
        const currentState = controller.state;
        if (!compareTwoJsValues(state, currentState)) {
          controller.state = state;
          if (!optimisticWorkInFlight) {
            controller.setUIState(state, new CustomEvent("state_prop_change"));
          }
        }
      } else {
        if (controller.hasStateProp) {
          controller.hasStateProp = false;
          controller.state = stateInitial;
        }
        if (controlInfo.signal) {
          // The other half of a bound signal: the control follows it when
          // something else writes it. Compared against `state` (what the signal
          // last said), never against the ui state — otherwise typing into an
          // uncontrolled control would be undone on the next render. A write
          // coming from the control itself lands here with the value already in
          // place, and setUIState treats an unchanged state as a no-op.
          const currentState = controller.state;
          if (!compareTwoJsValues(stateFromSignal, currentState)) {
            controller.state = stateFromSignal;
            if (!optimisticWorkInFlight) {
              controller.setUIState(
                stateFromSignal,
                new CustomEvent("state_prop_change"),
              );
            }
          }
        }
      }
      return liveValues();
    },
  );
  scope.parentUiStateSignalHolder.value =
    parentUIStateController?.uiStateSignal ?? null;

  const { controller } = scope;
  const controllerRef = controller.ref;
  useLayoutEffect(() => {
    const el = controllerRef.current;
    if (el) {
      el.__uiStateController__ = controller;
    }
    // Re-register so the radio registry stays in sync when props.ref changes
    // identity (e.g. across a Suspense boundary). The render-phase call in
    // control_hooks.jsx handles the initial mount; this call handles re-runs.
    onUIStateControllerCreated(controller);
    return () => {
      if (el && el.__uiStateController__ === controller) {
        delete el.__uiStateController__;
      }
      onUIStateControllerDestroyed(controller);
    };
  }, [controllerRef]);

  const { parentUIStateController: parentController } = scope;
  useLayoutEffect(() => {
    if (!parentController) {
      return undefined;
    }

    debugUIState(
      `"${controlType}" registering into "${parentController.controlType}"`,
    );
    parentController.registerChild(controller);
    return () => {
      debugUIState(
        `"${controlType}" unregistering from "${parentController.controlType}"`,
      );
      parentController.unregisterChild(controller);
    };
  }, [parentController]);

  return controller;
};

const CANNOT_DERIVE = Symbol("cannot_derive");

// A child that groups other controls and was given no name of its own, holding
// an object — the only shape that can be merged into the object around it.
// A nameless LEAF (an input nobody named) is still a mistake and still warns.
const isNamelessGrouping = (child, uiState) =>
  typeof child.registerChild === "function" &&
  uiState !== null &&
  typeof uiState === "object" &&
  !Array.isArray(uiState);

const firstDefinedChildUIState = (children) => {
  for (const child of children) {
    const childUIState = child.uiState;
    if (childUIState !== undefined) {
      return childUIState;
    }
  }
  return undefined;
};

// Default aggregate/distribute implementations keyed by controlType or stateType.
// Looked up in useUIGroupStateController to fill in omitted aggregateChildStates /
// distributeChildUIState. If neither a default nor an explicit impl is found for a
// group, creation throws so the caller knows it must supply them.
const GROUP_DEFAULTS = {
  radio_group: {
    childControlFilter: (child) =>
      child.controlType === "input" && child.controlHostProps?.type === "radio",
    aggregateChildStates: firstDefinedChildUIState,
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
  // One value, not an object: the group holds whatever its single meaningful
  // child holds. What a picker's popup does — the list inside it IS the value,
  // and naming it would only add a key nobody asked for. A popup containing a
  // real form uses "object" (the default) instead.
  single: {
    // The same exclusions canRegisterAsFacadeChild already makes below (the
    // picker façade asked the very same question: which child IS the value).
    // Buttons and links never hold one, and neither does a control that
    // declared itself nameless. A control *carrying* navi-list is the search
    // box driving some other list — not the list itself, which stays a
    // perfectly good single value here (one item, or the array a multiple list
    // exposes). Excluding the searcher is what leaves the list alone.
    childControlFilter: (child) => {
      if (child.controlType === "button" || child.controlType === "link") {
        return false;
      }
      if (child.allowNameless) {
        return false;
      }
      if (child.props?.["navi-list"]) {
        return false;
      }
      return true;
    },
    aggregateChildStates: firstDefinedChildUIState,
    distributeChildUIState: (newUIState) => newUIState,
  },
  object: {
    // Buttons are not fields. HTML has always been clear about it: a submit
    // button's name/value is sent only when it is the one that submitted, which
    // is how a form offers two ways out ("save" / "delete") and still knows
    // which was pressed. Aggregated like the fields, every button would be in
    // the value at once and the last one would win — pressing Enter (which
    // sends through the FIRST submit button) would then carry the LAST button's
    // meaning. The one that was actually pressed writes itself in on its own,
    // through wantRequesterButtonState (see the button branch in
    // useUIStateController).
    childControlFilter: (child) => {
      return child.controlType !== "button" && child.controlType !== "link";
    },
    aggregateChildStates: (children) => {
      const groupValues = {};
      for (const child of children) {
        const { name, allowNameless, emptyUIState } = child;
        // A control holding nothing writes its own empty, not a hole: the key
        // is in the object either way, and what is read from it keeps the shape
        // the reader was promised (see resolveEmptyUIState).
        const uiState =
          child.uiState === undefined && emptyUIState !== undefined
            ? emptyUIState
            : child.uiState;
        if (!name) {
          if (allowNameless) {
            // A control that says it is not a field is not one, whatever it
            // holds: a picker used as a door holds the shape its popup draws,
            // and merging that in would put the popup's keys in the object as
            // if the door had been a group.
            continue;
          }
          // A nameless GROUP is a grouping, not a value: it exists to hold its
          // children together (a WheelGroup sharing navigation, a fieldset-ish
          // cluster) without claiming a key of its own, so what it holds is
          // merged in as if its children had been written here. Naming it is
          // what turns the same group into one key — see ControlGroup's `name`.
          if (isNamelessGrouping(child, uiState)) {
            Object.assign(groupValues, uiState);
            continue;
          }
          console.warn(
            "A group child is missing a name property, its state won't be included in the group state",
            child,
          );
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
      // Merged in on the way up (see above), so on the way down it takes the
      // whole object and picks out its own keys — the same value it produced.
      if (isNamelessGrouping(child, child.uiState)) {
        return newUIState;
      }
      if (
        newUIState !== null &&
        typeof newUIState === "object" &&
        Object.keys(newUIState).length === 0
      ) {
        // An object with nothing in it is not a partial answer, it is the
        // absence of one — a group being cleared — and every child empties. A
        // partial object leaves the children it does not name alone, which is
        // what CANNOT_DERIVE says below: a value that mentions `start` says
        // nothing about `end`, an empty one says there is no answer at all.
        return undefined;
      }
      return CANNOT_DERIVE;
    },
  },
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
    distributeChildUIState,
    distributeChildStates,
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

  // What the group is worth is one key per child (or one item per child) only
  // as long as nobody said otherwise: a group with its own aggregate is worth
  // whatever IT says — a "HH:MM", an ISO duration — and the shape checks in
  // setUIState below are about the default shape, not about that one.
  const stateShapeIsTheDefaultOne =
    !aggregateChildStates && !distributeChildUIState && !distributeChildStates;
  const defaults = GROUP_DEFAULTS[controlType] ?? GROUP_DEFAULTS[stateType];
  const resolvedChildControlFilter =
    childControlFilter ?? defaults?.childControlFilter ?? null;
  const resolvedAggregateChildStates =
    aggregateChildStates ?? defaults?.aggregateChildStates;
  const resolvedDistributeChildUIState =
    distributeChildUIState ?? defaults?.distributeChildUIState;
  // The plural half of the pair: `aggregateChildStates` already sees all the
  // children at once, and a group whose value is not one key per child usually
  // needs the same view on the way down — which of four seats each player takes
  // cannot be decided one seat at a time. Given both, the plural one wins.
  const resolvedDistributeChildStates =
    distributeChildStates ?? defaults?.distributeChildStates;
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
  // A bound signal seeds the group the way `defaultValue` does — uncontrolled,
  // with the signal's current value as what it starts on. Write-back is handled
  // by applyState's own boundSignal; the read half is below: children are
  // placed from it when they register, and again whenever it moves.
  const boundSignal = props.signal;
  // The signal is the source of truth, here as on a leaf control: a `value`
  // passed alongside is ignored, not merged. Both halves have to agree on that
  // — a group that placed its children from `value` while writing the user's
  // choice into the signal answered to two owners at once.
  if (boundSignal) {
    warnSignalCollision(props, controlType, "value");
  }
  const hasValueProp = !boundSignal && Object.hasOwn(props, "value");
  const hasOwnDefaultValueProp = Object.hasOwn(props, "defaultValue");
  const hasDefaultValueProp = hasOwnDefaultValueProp || Boolean(boundSignal);
  const { id, name, value, uiAction } = props;
  // A signal holding something wins over `defaultValue`: the default is a
  // suggestion of where to start (and where a reset goes back to), the signal's
  // value is the answer — same precedence a leaf control applies (see
  // control_hooks' own resolveControlInfo).
  const defaultValue =
    boundSignal && boundSignal.value !== undefined
      ? boundSignal.value
      : hasOwnDefaultValueProp
        ? props.defaultValue
        : boundSignal?.value;
  const ref = props.ref;
  const fallbackState =
    stateType === "array"
      ? EMPTY_ARRAY
      : stateType === "object"
        ? EMPTY_OBJECT
        : undefined;
  // A group told what it holds holds it from the start, before any child has
  // registered to show it: what it was given is the answer, and the children
  // are where that answer is shown (see stateGivenFromAbove).
  const stateInitial = hasValueProp
    ? value
    : hasDefaultValueProp && defaultValue !== undefined
      ? defaultValue
      : fallbackState;
  const childUIStateControllerArrayRef = useRef([]);
  const childUIStateControllerArray = childUIStateControllerArrayRef.current;
  // Tracks children rejected by the filter and delegated upward (bubble-up).
  const delegatedChildrenRef = useRef(new Map());

  const groupIsRenderingRef = useRef(false);
  const pendingChangeRef = useRef(null);
  groupIsRenderingRef.current = true;
  pendingChangeRef.current = null;

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

  // Live values controller methods read through the scope (`s.…`) — same
  // contract as the leaf controller's liveValues above: one list feeding both
  // init and update.
  const liveValues = () => ({
    ref,
    parentUIStateController,
    uiAction,
    uiActionInternal,
    id,
    name,
    value,
    defaultValue,
    hasValueProp,
    hasDefaultValueProp,
    // `props` is what writeBoundSignal reads to find the bound `signal`.
    // Missing here, a group whose component never re-renders between mount
    // and the first choice wrote nothing back into its signal — and said
    // nothing about it: the list showed the choice, the signal stayed empty.
    props,
  });

  const scope = useRenderScope(
    // ── init: runs once on mount ───────────────────────────────────────────
    (s) => {
      debugUIGroup(
        `Creating "${controlType}" ui state controller (monitoring some descendants ui state(s))"`,
      );
      const [publishUIState, subscribeUIState] = createPubSub();
      const uiStateSignal = signal(stateInitial);

      // What the group is worth right now, and what it keeps when there is
      // nobody to ask: a list whose items have not arrived yet, a popup built
      // at open, a group whose children are still mounting. Such a group has
      // no opinion — its aggregate falls back to the empty of its type, and
      // taking that for an answer is how a value handed to it evaporates on
      // the way in, and how that emptiness then travels back up to whoever
      // handed it (a picker showing its row as unanswered).
      const aggregateGroupUIState = (whenNobodyCanAnswer) => {
        const someChildCanAnswer = childUIStateControllerArray.some(
          shouldPropagateStateToChild,
        );
        if (!someChildCanAnswer) {
          return whenNobodyCanAnswer;
        }
        const aggChildState = resolvedAggregateChildStates(
          childUIStateControllerArray,
          fallbackState,
        );
        if (aggChildState !== undefined) {
          return aggChildState;
        }
        // A group with an aggregate of its own is the one who knows what its
        // children add up to, `undefined` included — half a time is not a time,
        // wheels nobody turned have settled nothing. Only the default shapes
        // fall back to the empty of their type, where "no child says anything"
        // and "the value is empty" are the same sentence.
        return stateShapeIsTheDefaultOne ? fallbackState : undefined;
      };

      // onChange and applyState live inside init so they close over the stable
      // signals/pubsub without needing external refs.
      const onChange = (e, { notifyExternal }) => {
        if (groupIsRenderingRef.current) {
          // Held until the layout effect below, WITH what it asked for: a child
          // whose bound signal was written from the outside changes during the
          // render that follows, and replaying that as a mount sync is what
          // makes a group silently drift — its own state comes up to date while
          // the form around it is never told anything moved. A real change
          // deferred alongside a mount sync stays a real change.
          const pendingChange = pendingChangeRef.current;
          pendingChangeRef.current = {
            e,
            notifyExternal:
              pendingChange?.notifyExternal === true ? true : notifyExternal,
          };
          return;
        }
        const { controller } = s;
        // A child mounting or unmounting is not somebody answering: while the
        // children of a group are still arriving, their aggregate is a partial
        // reading, and taking it for the truth is how the value the group was
        // given gets destroyed one row at a time — the first row to register
        // aggregates alone, the group drops to that, and every row after it is
        // placed from what is left. A group that derived its own value has
        // nothing to protect and aggregates as usual.
        const groupUIState =
          notifyExternal === "silent" && controller.stateGivenFromAbove
            ? controller.uiState
            : aggregateGroupUIState(controller.uiState);
        debugUIGroup(
          e,
          `${controlType}.getUIState -> ${JSON.stringify(groupUIState)}`,
        );
        if (notifyExternal === true) {
          // Somebody answered: what the group is worth is what its children say
          // between them, from here on.
          controller.stateGivenFromAbove = false;
          applyState(groupUIState, e);
        } else if (notifyExternal === "silent") {
          controller.syncInternalState(groupUIState);
          s.parentUIStateController?.onChildUIAction(controller, e, {
            stateChanged: true,
            silent: true,
          });
        } else {
          controller.syncInternalState(groupUIState);
          writeBoundSignal(groupUIState);
        }
      };

      // The two-way half of a bound `signal`: the same write a leaf control
      // makes from its own setUIState (see useUIStateController's boundSignal),
      // for a group whose value is its children's put together.
      //
      // Called from every path where what the group holds really moves:
      // applyState when the change is notified outward, syncInternalState when
      // the group only brings itself up to date, and the value arriving from
      // above (see isPropagateDownEvent). Which one it is gets decided at each
      // call site rather than guessed at here — the initial push and the
      // mount/unmount syncs leave the signal alone.
      const writeBoundSignal = (newUIState) => {
        const boundSignal = s.props?.signal;
        if (boundSignal) {
          boundSignal.value = newUIState;
        }
      };

      const applyState = (newUIState, e, { internalBehavior = false } = {}) => {
        const { controller } = s;
        const currentUIState = controller.uiState;
        controller.uiState = newUIState;
        uiStateSignal.value = newUIState;
        debugUIGroup(
          e,
          `${controlType}.applyState(${JSON.stringify(newUIState)}, "${e.type}") -> updates from ${JSON.stringify(currentUIState)} to ${JSON.stringify(newUIState)}`,
        );
        publishUIState(newUIState);
        if (!internalBehavior) {
          writeBoundSignal(newUIState);
        }
        s.parentUIStateController?.onChildUIAction(controller, e, {
          stateChanged: true,
        });
        controller.onUIAction(e, { skipCommand: internalBehavior });
        const el = controller.ref.current;
        if (el) {
          dispatchInternalCustomEvent(el, "navi_ui_state_change", {
            event: e,
            value: newUIState,
          });
        }
      };

      const controller = {
        controlType,
        id,
        name,
        value,
        defaultValue,
        hasValueProp,
        hasDefaultValueProp,
        props,
        uiState: stateInitial,
        // Whether what the group holds was HANDED to it (a parent distributing,
        // a picker filling its popup, a value prop) rather than worked out from
        // its children. What it protects is read in onChange.
        stateGivenFromAbove: hasValueProp || hasDefaultValueProp,
        uiStateSignal,
        wantRequesterButtonState,
        ref,
        getPropFromState: (uiState) => uiState,
        distributeChildUIState: resolvedDistributeChildUIState,
        // Where the group puts a value on ONE child: the only place that knows
        // what each child gets, and the only one that sees a child it cannot
        // place — see warnChildAnswersForItself.
        // One pass over every child, which is what a plural distribute needs:
        // it is asked once, sees the whole group, and answers for all of them.
        placeChildrenUIState: (groupUIState, e) => {
          if (!resolvedDistributeChildStates) {
            for (const childUIStateController of childUIStateControllerArray) {
              controller.placeChildUIState(
                childUIStateController,
                groupUIState,
                e,
              );
            }
            return;
          }
          const monitoredChildren = childUIStateControllerArray.filter(
            shouldPropagateStateToChild,
          );
          const stateByChild = resolvedDistributeChildStates(
            groupUIState,
            monitoredChildren,
          );
          if (!stateByChild) {
            return;
          }
          for (const childUIStateController of monitoredChildren) {
            if (!stateByChild.has(childUIStateController)) {
              // Not named by the answer: left where it is, the way
              // CANNOT_DERIVE leaves a child a per-child distribute says
              // nothing about.
              continue;
            }
            if (
              childUIStateController.hasStateProp &&
              !childUIStateController.props.signal
            ) {
              continue;
            }
            childUIStateController.setUIState(
              stateByChild.get(childUIStateController),
              e,
            );
          }
        },
        placeChildUIState: (childUIStateController, groupUIState, e) => {
          if (!shouldPropagateStateToChild(childUIStateController)) {
            return;
          }
          const childNewState = resolvedDistributeChildUIState(
            groupUIState,
            childUIStateController,
          );
          if (childNewState === CANNOT_DERIVE) {
            return;
          }
          if (
            childUIStateController.hasStateProp &&
            !childUIStateController.props.signal
          ) {
            // A child bound to a signal is placed like any other: bound is not
            // frozen, and the placement writes the signal, so both ends keep
            // saying the same thing. Only a child controlled by a `value` /
            // `checked` prop cannot be moved — its owner decides. Worth saying
            // out loud only when the two disagree: a child already showing what
            // the group would put there has lost nothing, and both being fed
            // from the same value is a legitimate way to write a group.
            if (
              !compareTwoJsValues(childNewState, childUIStateController.uiState)
            ) {
              warnChildAnswersForItself(controller, childUIStateController);
            }
            return;
          }
          childUIStateController.setUIState(childNewState, e);
        },
        setUIState: (newUIState, e) => {
          if (
            stateType === "object" &&
            stateShapeIsTheDefaultOne &&
            (newUIState === null || typeof newUIState !== "object")
          ) {
            console.warn(
              `[${controlType}] setUIState received a non-object value: ${JSON.stringify(newUIState)} (expected an object). Ignoring.`,
              newUIState,
            );
            return;
          }
          if (
            stateType === "array" &&
            stateShapeIsTheDefaultOne &&
            !Array.isArray(newUIState)
          ) {
            console.warn(
              `[${controlType}] setUIState received a non-array value: ${JSON.stringify(newUIState)} (expected an array). Ignoring.`,
              newUIState,
            );
            return;
          }
          controller.stateGivenFromAbove = true;
          const propagateEventType =
            e.type === "initial_state_push"
              ? "initial_state_push"
              : "propagate_down_set_ui_state";
          const propagateDownEvent = new CustomEvent(propagateEventType, {
            detail: {},
          });
          chainEvent(propagateDownEvent, e);
          controller.placeChildrenUIState(newUIState, propagateDownEvent);
          const groupUIState = aggregateGroupUIState(newUIState);
          if (e.type === "initial_state_push") {
            controller.syncInternalState(groupUIState);
            writeBoundSignal(groupUIState);
            return;
          }
          applyState(groupUIState, e, { internalBehavior: true });
          if (isPropagateDownEvent(e)) {
            writeBoundSignal(groupUIState);
          }
        },
        syncInternalState: (newUIState) => {
          const currentUIState = controller.uiState;
          if (newUIState === currentUIState) {
            return;
          }
          controller.uiState = newUIState;
          uiStateSignal.value = newUIState;
          publishUIState(newUIState);
        },
        onUIAction: (e, { skipCommand } = {}) => {
          const currentUIState = controller.uiState;
          // The same write applyState/onChange make (see writeBoundSignal), for
          // the case where the state did not move but the user acted all the
          // same — a picker whose suggestion was confirmed untouched, say. A
          // leaf control writes its signal from its own onUIAction for exactly
          // this reason; setting a signal to what it already holds is a no-op,
          // so the paths that write twice cost nothing.
          writeBoundSignal(currentUIState);
          s.uiAction?.(currentUIState, e);
          s.uiActionInternal?.(currentUIState, e);
          if (!skipCommand && controller.props.command) {
            const el = controller.ref.current;
            if (el) {
              triggerNaviCommand(el, controller.props.command, e);
            }
          }
        },
        registerChild: (childUIStateController) => {
          if (!isMonitoringChild(childUIStateController)) {
            const currentParent = s.parentUIStateController;
            if (!allowCapture && currentParent) {
              delegatedChildrenRef.current.set(
                childUIStateController,
                currentParent,
              );
              currentParent.registerChild(childUIStateController);
            }
            return;
          }
          const childControlType = childUIStateController.controlType;
          childUIStateControllerArray.push(childUIStateController);
          debugUIGroup(
            `${controlType}.registerChild("${childControlType}") -> registered (total: ${childUIStateControllerArray.length})`,
          );
          const stateToPlaceChildFrom = controller.hasValueProp
            ? controller.value
            : controller.hasDefaultValueProp
              ? controller.defaultValue
              : // What the group HOLDS, for a child arriving after the value
                // did: a list item loaded later, a row scrolled back into a
                // virtualized list, a popup built at open. Two conditions, and
                // both are about not overwriting an answer with a silence — the
                // group must actually hold something, and the child must have
                // nothing of its own to show (one arriving with its own default
                // is answering, and the group is what its answers add up to).
                uiStateHoldsNothing(controller.uiState) ||
                  !uiStateHoldsNothing(childUIStateController.uiState)
                ? undefined
                : controller.uiState;
          if (stateToPlaceChildFrom !== undefined) {
            const initialEvent = new CustomEvent("initial_state_push", {
              detail: {},
            });
            if (resolvedDistributeChildStates) {
              // A group answering for all its children at once has to be asked
              // again now that there is one more: what each of them shows may
              // depend on who else is there.
              controller.placeChildrenUIState(
                stateToPlaceChildFrom,
                initialEvent,
              );
            } else {
              controller.placeChildUIState(
                childUIStateController,
                stateToPlaceChildFrom,
                initialEvent,
              );
            }
          }
          onChange(new CustomEvent(`${childControlType}_mount`), {
            notifyExternal: "silent",
          });
        },
        onChildUIAction: (
          childUIStateController,
          e,
          { stateChanged, silent },
        ) => {
          const delegatedTo = delegatedChildrenRef.current.get(
            childUIStateController,
          );
          if (delegatedTo) {
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
            onChange(e, { notifyExternal: silent ? "silent" : true });
          } else {
            controller.onUIAction(e);
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
          const index = childUIStateControllerArray.indexOf(
            childUIStateController,
          );
          if (index === -1) {
            debugUIGroup(
              `${controlType}.unregisterChild("${childControlType}") -> not found`,
            );
            return;
          }
          childUIStateControllerArray.splice(index, 1);
          debugUIGroup(
            `${controlType}.unregisterChild("${childControlType}") -> unregistered (remaining: ${childUIStateControllerArray.length})`,
          );
          onChange(new CustomEvent(`${childControlType}_unmount`), {
            notifyExternal: "silent",
          });
        },
        resetUIState: (e) => {
          const ev = new CustomEvent("propagate_down_reset_ui_state", {
            detail: {},
          });
          chainEvent(ev, e);
          for (const c of childUIStateControllerArray) {
            if (shouldPropagateStateToChild(c)) {
              c.resetUIState(ev);
            }
          }
          onChange(e, { notifyExternal: true });
        },
        clearUIState: (e) => {
          const ev = new CustomEvent("propagate_down_clear_ui_state", {
            detail: {},
          });
          chainEvent(ev, e);
          for (const c of childUIStateControllerArray) {
            if (
              !isMonitoringChild(c) ||
              c.controlType === "button" ||
              c.controlType === "link"
            ) {
              continue;
            }
            c.clearUIState(ev);
          }
          onChange(e, { notifyExternal: true });
        },
        onActionEnd: (e) => {
          controller.rules.validation.syncValidity(e);
        },
        onActionError: (e) => {
          controller.rules.validation.syncValidity(e, { report: true });
        },
        // Whether `maxLengthGuard` stands between this child and the selection.
        // A guard on the gesture only: what the group already holds is left
        // alone, however long, and a selected child is never blocked — it must
        // stay takeable back. Read off the signal so the other children learn
        // about the group filling up and emptying again.
        isChildBlockedByMaxLengthGuard: (childUIStateController) => {
          const { maxLengthGuard } = controller.props;
          if (maxLengthGuard === undefined) {
            return false;
          }
          if (childUIStateController.uiState !== undefined) {
            return false;
          }
          const uiState = uiStateSignal.value;
          if (!Array.isArray(uiState)) {
            return false;
          }
          return uiState.length >= maxLengthGuard;
        },
        findChildById: (searchId) => {
          for (const c of childUIStateControllerArray) {
            if (c.id === searchId) {
              return c;
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
        // Group children sit next to the group itself: a busy one really does
        // prevent the group from acting as a whole.
        getInteractionBlockingControls: () => {
          return controller.getManagedControls();
        },
        subscribe: subscribeUIState,
      };
      const rules = createControlRules(controller, {
        debugPopup,
        debugInteraction,
        debugUIState: debugUIGroup,
        debugFocus,
      });
      controller.rules = rules;

      return {
        controller,
        _onChange: onChange,
        ...liveValues(),
      };
    },
    // ── update: runs every render after the first ─────────────────────────
    (s) => {
      const { controller } = s;
      const prevValue = controller.value;
      const prevHasValueProp = controller.hasValueProp;
      const prevDefaultValue = controller.defaultValue;
      controller.props = props;
      controller.ref = ref;
      controller.id = id;
      controller.name = name;
      controller.value = value;
      controller.defaultValue = defaultValue;
      controller.hasValueProp = hasValueProp;
      controller.hasDefaultValueProp = hasDefaultValueProp;
      const placeChildrenFrom = (groupUIState) => {
        const propagateDownEvent = new CustomEvent(
          "propagate_down_set_ui_state",
          { detail: {} },
        );
        controller.placeChildrenUIState(groupUIState, propagateDownEvent);
        controller.syncInternalState(groupUIState);
      };
      if (
        hasValueProp &&
        (!prevHasValueProp || !compareTwoJsValues(value, prevValue))
      ) {
        placeChildrenFrom(value);
      }
      if (
        boundSignal &&
        !hasValueProp &&
        !compareTwoJsValues(defaultValue, prevDefaultValue)
      ) {
        // The signal moved from the outside: the children are placed from it
        // again, exactly as they were when they registered. Without this a
        // group would answer a write to its own signal by silently writing its
        // former value back over it on the next child interaction.
        placeChildrenFrom(defaultValue);
      }

      return liveValues();
    },
  );

  const { controller } = scope;
  useLayoutEffect(() => {
    const el = ref.current;
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

  const { parentUIStateController: parentController } = scope;
  useLayoutEffect(() => {
    if (!parentController) {
      return undefined;
    }

    debugUIGroup(
      `"${controlType}" registering into "${parentController.controlType}"`,
    );
    parentController.registerChild(controller);
    return () => {
      debugUIGroup(
        `"${controlType}" unregistering from "${parentController.controlType}"`,
      );
      parentController.unregisterChild(controller);
    };
  }, [parentController]);

  useLayoutEffect(() => {
    groupIsRenderingRef.current = false;
    const pendingChange = pendingChangeRef.current;
    if (pendingChange) {
      pendingChangeRef.current = null;
      const batchedEvent = new CustomEvent(
        `${controlType}_batched_ui_state_update`,
        { detail: {} },
      );
      chainEvent(batchedEvent, pendingChange.e);
      scope._onChange(batchedEvent, {
        notifyExternal: pendingChange.notifyExternal,
      });
    }
  });

  return controller;
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
  const namelessChildSetRef = useRef(new Set());
  const updatingRef = useRef(false);
  const debugPopup = useDebugPopup();
  const debugInteraction = useDebugInteraction();
  const debugUIState = useDebugUIState();
  const debugFocus = useDebugFocus();

  // The facade controller's closures (registerChild/unregisterChild/onChildUIAction)
  // must not capture `realUIStateController` directly: that parameter can legitimately
  // point to a different controller instance on a later render (e.g. the picker's own
  // controller getting recreated). Instead, closures read `s.realUIStateController`
  // from the stable scope object, which is kept current by `update` on every render.
  const scope = useRenderScope(
    // ── init: runs once on mount ───────────────────────────────────────────
    (s) => {
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
        if (childController.allowNameless) {
          // A control saying it is not a field is not the one the picker talks
          // to: the search box above the list, the "select all" switch beside
          // it. It is there to help find the answer, not to be it.
          namelessChildSetRef.current.add(childController);
          return false;
        }
        if (childController.props["navi-list"]) {
          // Controls with navi-list act as standalone list navigators and should
          // not be treated as the picker's synced child.
          return false;
        }
        return true;
      };

      // Picker → child. Handed to the real controller during THIS render so it
      // is in place before any layout effect runs: the value a parent form
      // distributes reaches its children from their registration effect, which
      // fires before the picker's own effects — a façade that only started
      // listening from an effect of its own was told nothing, and the popup
      // opened empty on a value the picker already held.
      const pushStateDownToChild = (newUIState, e) => {
        if (updatingRef.current) {
          return;
        }
        const child = firstChildControllerRef.current;
        if (!child) {
          warnPopupHasNothingButNamelessControls(
            props,
            namelessChildSetRef.current,
          );
          return;
        }
        updatingRef.current = true;
        const propagateEventType =
          e.type === "initial_state_push"
            ? "initial_state_push"
            : "propagate_down_set_ui_state";
        const propagateDownEvent = new CustomEvent(propagateEventType, {
          detail: {},
        });
        chainEvent(propagateDownEvent, e);
        warnIfChildCannotHold(props, child, newUIState);
        child.setUIState(newUIState, propagateDownEvent);
        updatingRef.current = false;
      };
      realUIStateController.pushStateDownToFacadeChild = pushStateDownToChild;

      const facadeUIStateController = {
        controlType: "facade",
        props,
        pushStateDownToChild,
        ref: realUIStateController.ref,
        uiStateSignal: realUIStateController.uiStateSignal,
        controlHostProps: realUIStateController.controlHostProps,
        registerChild: (child) => {
          if (!canRegisterAsFacadeChild(child)) {
            return;
          }
          const childType = child.controlType;
          if (firstChildControllerRef.current) {
            console.warn(
              `[navi] a second control ("${childType}"${child.name ? ` name="${child.name}"` : ""}) registered in the ${describePicker(props)} popup. ` +
                `A picker talks to ONE control: the first one receives the picker's whole value and is the only one read back, ` +
                `so this one is neither filled nor collected. ` +
                `A popup holding several values needs one group around them — wrap them in a <ControlGroup>, name each control inside it, and give the picker type="object". ` +
                `A control that is there to FIND the answer rather than be it (a search box, a "select all") says so with allowNameless and steps out of the way.`,
              child,
            );
          } else {
            debugUIState(
              `[useUIFacadeStateController] "${childType}"${child.name ? ` name="${child.name}"` : ""} registered as the first child in the picker facade.`,
            );
            firstChildControllerRef.current = child;
            s.realUIStateController.facadeChild = child;
            // If the picker already has a meaningful state (from value or defaultValue),
            // push it to the child on registration so it reflects the pre-set value
            // without firing uiAction (equivalent to defaultValue on the child itself).
            const initialState = s.realUIStateController.uiState;
            if (initialState !== undefined) {
              warnIfChildCannotHold(props, child, initialState);
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
            s.realUIStateController.facadeChild = null;
          }
        },
        getManagedControls: () => {
          const child = firstChildControllerRef.current;
          if (!child) {
            return [];
          }
          return child.getManagedControls();
        },
        getInteractionBlockingControls: () => {
          const child = firstChildControllerRef.current;
          if (!child) {
            return [];
          }
          return child.getInteractionBlockingControls();
        },
        onChildUIAction: (child, e, { stateChanged, silent = false }) => {
          if (!stateChanged) {
            return;
          }
          if (child !== firstChildControllerRef.current) {
            return;
          }
          if (
            silent &&
            uiStateHoldsNothing(child.uiState) &&
            !uiStateHoldsNothing(s.realUIStateController.uiState)
          ) {
            // A silent sync means the child's own structure changed (children
            // mounted/unmounted), not that the user acted. A child that ends up
            // with no value there is one that currently *cannot* express one —
            // a <List loading> holds no items yet, a popup whose items are gone
            // aggregates to the empty array its stateType falls back to — which
            // must not read as the user clearing the picker, nor fire its
            // uiAction.
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
          s.realUIStateController.setUIState(child.uiState, propagateUpEvent);
          updatingRef.current = false;
        },
      };
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
      return {
        controller: facadeUIStateController,
        realUIStateController,
        props,
      };
    },
    // ── update: runs every render after the first ─────────────────────────
    (s) => {
      s.controller.props = props;
      s.controller.ref = realUIStateController.ref;
      s.controller.uiStateSignal = realUIStateController.uiStateSignal;
      s.controller.controlHostProps = realUIStateController.controlHostProps;
      realUIStateController.pushStateDownToFacadeChild =
        s.controller.pushStateDownToChild;

      return {
        realUIStateController,
        props,
      };
    },
  );

  return scope.controller;
};

const describePicker = (props) =>
  `<Picker${props.name ? ` name="${props.name}"` : ""}${props.type ? ` type="${props.type}"` : ""}>`;

// A picker holding an object hands that object to the control in its popup, and
// a control that is not itself a group has nowhere to put it: it takes the
// object as its own value and writes it wherever it is bound — a signal, the
// url, which is where "[object Object]" comes from. Said out loud because
// nothing else will: the push succeeds, the control just shows nonsense.
/**
 * `allowNameless` says two things at once, and inside a popup the second one
 * bites: "I am not a field" also means "I am not what the picker talks to". Put
 * on the ONE control a popup holds, it leaves the picker with nobody to fill —
 * the popup opens blank on a value the picker is holding, and nothing is said.
 */
const namelessOnlyWarnedSet = new WeakSet();
const warnPopupHasNothingButNamelessControls = (props, namelessChildSet) => {
  if (!import.meta.dev) {
    return;
  }
  if (namelessChildSet.size === 0) {
    return;
  }
  const [firstNamelessChild] = namelessChildSet;
  if (namelessOnlyWarnedSet.has(firstNamelessChild)) {
    return;
  }
  namelessOnlyWarnedSet.add(firstNamelessChild);
  console.warn(
    `[navi] the ${describePicker(props)} popup holds nothing but allowNameless controls, so the picker has nobody to fill and the popup opens blank. ` +
      `Inside a popup, allowNameless also means "the picker does not talk to me" — it is for the search box BESIDE the answer, not for the answer itself. ` +
      `Drop it from the control that IS the value.`,
    firstNamelessChild,
  );
};

const cannotHoldWarnedSet = new WeakSet();
const warnIfChildCannotHold = (props, child, newUIState) => {
  if (!import.meta.dev) {
    return;
  }
  if (newUIState === null || typeof newUIState !== "object") {
    return;
  }
  if (typeof child.registerChild === "function") {
    return;
  }
  if (cannotHoldWarnedSet.has(child)) {
    return;
  }
  cannotHoldWarnedSet.add(child);
  console.warn(
    `[navi] ${describePicker(props)} holds an object, but the "${child.controlType}"${child.name ? ` name="${child.name}"` : ""} in its popup holds a single value — it receives the object whole. ` +
      `The control inside a picker whose value is an object must be the group that shapes it: a <ControlGroup> (or a <Form>) with one named control per key, and type="object" on the picker.`,
    child,
  );
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
  // navi undoing its own optimistic write: the clear cross emptied the control
  // before the send that commits it, the send failed, and the value it emptied
  // goes back where it was (see the --navi-clear command). Nothing acted — the
  // control is being put back on the state the caller still holds — so this
  // must not fire a uiAction, a command, or a report on the way.
  "clear_rollback",
]);
const isInternalEvent = (e) => {
  return INTERNAL_EVENT_SET.has(e.type);
};

/**
 * A value handed DOWN to a control by whoever owns it: a picker filling its
 * popup (on open, and again when Escape puts back what it held), a group
 * placing its children, a reset cascading through them.
 *
 * Internal, so no reaction fires — nobody acted. But the control's state really
 * did move, and a bound `signal` is that state's mirror rather than a reaction
 * to it: leaving it behind makes the app and the control disagree about what is
 * on screen, which is how a popup reopens on the tab the user cancelled out of.
 * The way UP is deliberately not part of this: a picker's own signal is written
 * when the picker commits, not while its popup is being played with.
 */
const PROPAGATE_DOWN_EVENT_SET = new Set([
  "propagate_down_set_ui_state",
  "propagate_down_reset_ui_state",
  "propagate_down_clear_ui_state",
  // The FIRST value handed down is one too: a control placed as it registers
  // (a group filling a child that just arrived, a picker filling its popup)
  // holds it from that moment, and a signal that kept saying nothing would have
  // the app and the screen disagree from the very first paint.
  "initial_state_push",
]);
const isPropagateDownEvent = (e) => {
  return PROPAGATE_DOWN_EVENT_SET.has(e.type);
};

/**
 * The synthetic "input" event is how the new state reaches the outside world
 * (`uiAction` is called from the input handler it triggers). It carries what
 * caused the state change so a listener can tell a gesture apart from navi
 * talking to itself: `findEvent(e, "navi_clear_ui_state")` answers "the user
 * pressed the clear cross", the same way the facade hops are recognized.
 */
const dispatchSyntheticInput = (el, inputEvent, causeEvent) => {
  chainEvent(inputEvent, causeEvent);
  el.dispatchEvent(inputEvent);
};

/**
 * Both ends claim the same state: the group was handed a value to place on its
 * children, and one of them answers for itself. The child wins and the group never moves
 * it — which on screen is a row that does not respond to being clicked, with
 * nothing said anywhere.
 *
 * A child following a signal is not that case: it is bound, not frozen, and
 * whoever writes the signal moves it.
 */
const childAnswersForItselfWarnedSet = new WeakSet();
const warnChildAnswersForItself = (groupController, child) => {
  if (!import.meta.dev) {
    return;
  }
  if (!groupController.stateGivenFromAbove) {
    // Nothing claims this child: a group with no value of its own is worth what
    // its children say between them, and a child answering for itself is how
    // that value gets built (a list whose rows carry `selected` and whose
    // `action` writes them back). The conflict is with a group being PLACED.
    return;
  }
  const childProps = child.props;
  if (childProps.signal) {
    return;
  }
  const statePropName = Object.hasOwn(childProps, "checked")
    ? "checked"
    : Object.hasOwn(childProps, "value")
      ? "value"
      : null;
  if (!statePropName) {
    return;
  }
  // Once per group: the mistake is made on all the rows at once and repeating
  // it per row buries the one line that matters.
  if (childAnswersForItselfWarnedSet.has(groupController)) {
    return;
  }
  childAnswersForItselfWarnedSet.add(groupController);
  const groupType = groupController.controlType;
  const isSelectableList =
    groupType === "checkbox_group" || groupType === "radio_group";
  const childDescription = isSelectableList
    ? "a <List.Item> declares `selected`"
    : `a "${child.controlType}"${child.name ? ` name="${child.name}"` : ""} declares \`${statePropName}\``;
  const groupDescription = isSelectableList ? "the list" : `the "${groupType}"`;
  // A prop SET to undefined is the same claim wearing a disguise, and the one
  // that costs the most to find: `checked={bound ? undefined : checked}` reads
  // like "no prop at all" and is not — the key being there is what makes the
  // control controlled, so it holds nothing, for good. Naming it is the whole
  // point of saying anything here.
  const advice =
    childProps[statePropName] === undefined
      ? `\`${statePropName}\` is undefined here, which is NOT the same as not passing it: the key being present is what makes a control controlled, so this one holds nothing and keeps holding nothing. ` +
        `Leave the prop out when the group is the one answering — {...(bound ? {} : { ${statePropName} })}.`
      : `Bind one end or the other, not both.`;
  console.warn(
    `[navi] ${childDescription} while ${groupDescription} around it is placed from a value — ${groupDescription} cannot move it, so clicking it changes nothing and what it shows never follows. ${advice}`,
    child,
  );
};

/**
 * What a control is worth when it holds nothing — nothing, in the shape of the
 * question it answers. A list of days nobody picked is an empty list, not an
 * empty string; a yes/no nobody said yes to is `false`. Without this the shape
 * changes under the reader as soon as the answer is empty, and the conversion
 * back gets written after the wrong value has already been sent.
 *
 * `undefined` means the control has no empty of its own — it is simply not
 * there, which is what an untouched date or an unchecked radio is.
 */
const resolveEmptyUIState = (props, controlType) => {
  if (controlType === "input" && props.type === "checkbox") {
    // A checkbox is a member of a set, the way HTML has it: checked it sends
    // its value ("on" by default), unchecked it sends nothing at all. Only one
    // holding `true` is a yes/no, and a yes/no nobody said yes to is `false`.
    return props.value === true ? false : undefined;
  }
  const stateShape = props["navi-state-shape"];
  if (stateShape === "array") {
    return EMPTY_ARRAY;
  }
  if (stateShape === "object") {
    return EMPTY_OBJECT;
  }
  return undefined;
};

// What a cleared control shows: its own empty, kept in the shape it was holding.
const resolveClearedUIState = (controller) => {
  const { controlType, props } = controller;
  if (
    controlType === "input" &&
    (props.type === "radio" || props.type === "checkbox")
  ) {
    // Unchecked is `undefined`: any other value reads as checked, `false`
    // included (see the `checked` line in control_hooks' toDomProps). What such
    // a control is worth once unchecked is `emptyUIState`, read where the value
    // is collected rather than stored here.
    return undefined;
  }
  const { emptyUIState } = controller;
  if (emptyUIState !== undefined) {
    return emptyUIState;
  }
  const currentUIState = controller.uiState;
  if (Array.isArray(currentUIState)) {
    return EMPTY_ARRAY;
  }
  if (currentUIState !== null && typeof currentUIState === "object") {
    return EMPTY_OBJECT;
  }
  return "";
};

// What a control says when it has nothing to say: no value at all, the empty
// array/object a group falls back to while it has no child to aggregate — or a
// shape whose every part is itself nothing. That last one is what a group with
// an aggregate of its own produces before its children have arrived
// (`{ mode: undefined, levels: [] }` has two keys and says nothing), and
// reading it as an answer is how a popup opening empties the row above it.
export const uiStateHoldsNothing = (uiState) => {
  if (uiState === undefined) {
    return true;
  }
  if (Array.isArray(uiState)) {
    return uiState.every(uiStateHoldsNothing);
  }
  if (uiState !== null && typeof uiState === "object") {
    return Object.values(uiState).every(uiStateHoldsNothing);
  }
  return false;
};

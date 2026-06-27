/**
 * Orchestrates the three rule managers for a UI state controller.
 *
 * Instead of holding `controller.controlInteraction` + `controller.controlValidity`
 * independently, a controller now has a single `controller.rules` object:
 *
 *   controller.rules.callout     — shared callout display manager
 *   controller.rules.interaction — interactivity gate (disabled/readonly/busy)
 *   controller.rules.validation  — value validity gate (required/pattern/etc.)
 *
 * The callout manager is created first so both interaction and validation
 * can use the same callout slot and the same lifecycle hooks.
 */

import { createPubSub } from "@jsenv/dom";

import { createInputGuard } from "../control_input_guard.js";
import { createCalloutManager } from "./control_callout.js";
import { createControlInteraction } from "./control_interaction.js";
import { createControlValidation } from "./control_validation.js";

/**
 * Creates all rule managers for a controller and wires them together.
 *
 * @param {object} controller - The UI state controller.
 * @param {object} [options]
 * @param {Function} [options.debugUIState]  - Debug logger for state/validity events.
 * @param {Function} [options.debugFocus]    - Debug logger for focus events.
 * @returns {{ callout, interaction, validation, guard, uninstall }}
 */
export const createControlRules = (
  controller,
  { debugInteraction, debugPopup, debugUIState, debugFocus } = {},
) => {
  const [teardown, addTeardown] = createPubSub();

  const callout = createCalloutManager(controller, {
    addTeardown,
    debugFocus,
    debugPopup,
  });

  const interaction = createControlInteraction(controller, {
    callout,
    debugInteraction,
  });

  const validation = createControlValidation(controller, {
    callout,
    debugUIState,
  });

  const guard = createInputGuard(controller);

  return {
    callout,
    interaction,
    validation,
    guard,
    uninstall: teardown,
  };
};

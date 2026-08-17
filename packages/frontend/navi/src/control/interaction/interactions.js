/**
 * The `interactions` prop: the registry, plus the detectors navi ships with.
 *
 * Imported for their side effect — each detector registers itself, in the order
 * they are listed here, which is the order they are given a press. Nothing else
 * imports them: whatever reads `interactions` goes through this file, so a
 * control cannot end up with the registry and only some of its detectors.
 *
 * These imports exist ONLY for that registration, so the build drops them unless
 * the package says the files have side effects: `sideEffects` in package.json
 * lists this directory. Without that entry the published bundle keeps the registry
 * and no detector at all, and every `interactions` prop silently does nothing.
 */

import "./interaction_native.js";
import "./interaction_press.js";
import "./interaction_drag.js";
import "./interaction_keyboard.js";

export {
  defineInteractionDetector,
  resolveInteractions,
  useInteractionsEffect,
} from "./interaction_registry.js";

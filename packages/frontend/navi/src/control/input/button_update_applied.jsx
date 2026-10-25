/**
 * A `--navi-update` source says when its value is the one its target holds:
 * pressing it would change nothing, so it is drawn applied (`:-navi-applied`,
 * `[data-applied]`) and says so to assistive tech (`aria-pressed`). A shortcut
 * under a control (« aujourd'hui », « 1h30 », « En semaine ») lights itself
 * from what the control holds, its suggestion included.
 *
 * Followed live through the target controller's ui state signal. The target is
 * found as the command finds it (resolveUpdateTarget): an id naming the box
 * around a control (a Spin's) is that control, here as at the press. Looked up
 * again as controllers register, for a target mounting after the source or
 * built again under it.
 */

import { effect, useSignal } from "@preact/signals";
import { useLayoutEffect, useState } from "preact/hooks";

import {
  renderResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { resolveUpdateTarget } from "../commands.js";
import { findControlHost } from "../control_dom.js";
import {
  getUIStateControllerById,
  listenControllerRegistration,
} from "../controller_registry.js";
import {
  isUpdateApplied,
  readUpdateCommandModifiers,
} from "../update_command_value.js";

export const ButtonUpdateAppliedResolver = (props) => {
  const Next = useNextResolver();
  const { command } = props;
  if (command && command.split(":")[0] === "--navi-update") {
    return renderResolver(ButtonUpdateApplied, props);
  }
  return <Next {...props} />;
};

const ButtonUpdateApplied = (props) => {
  const Next = useNextResolver();
  const { ref, command, commandFor, pseudoState } = props;
  const { toggle } = readUpdateCommandModifiers(
    command.includes(":") ? command.slice(command.indexOf(":") + 1) : "",
  );
  const sourceValue =
    props["command-value"] === undefined ? props.value : props["command-value"];

  // A signal the effect below reads, so a new value re-reads the target
  // without resubscribing; equal by content, so an inline array (`value={[…]}`)
  // is not a change at every render.
  const sourceValueSignal = useSignal(sourceValue);
  useLayoutEffect(() => {
    if (!compareTwoJsValues(sourceValueSignal.peek(), sourceValue)) {
      sourceValueSignal.value = sourceValue;
    }
  });

  const [applied, setApplied] = useState(false);
  useLayoutEffect(() => {
    const source = ref.current;
    if (!source) {
      return undefined;
    }
    let followed = null;
    let stopFollowing = () => {};
    const follow = () => {
      const targetController = findTargetController(source);
      if (targetController === followed) {
        return;
      }
      stopFollowing();
      followed = targetController;
      if (!targetController) {
        stopFollowing = () => {};
        setApplied(false);
        return;
      }
      stopFollowing = effect(() => {
        const held = targetController.uiStateSignal.value;
        setApplied(isUpdateApplied(held, sourceValueSignal.value, { toggle }));
      });
    };
    follow();
    const stopListening = listenControllerRegistration(() => {
      if (followed && getUIStateControllerById(followed.id) === followed) {
        return;
      }
      follow();
    });
    return () => {
      stopListening();
      stopFollowing();
    };
  }, [commandFor, toggle]);

  return (
    <Next
      // Under whatever the caller says, like pseudoState below.
      aria-pressed={applied ? "true" : "false"}
      {...props}
      pseudoState={{
        ":-navi-applied": applied,
        ...pseudoState,
      }}
    />
  );
};

// The controller answering on the host the command dispatches to. Read in
// the registry by the host's id as well: an effect attaches the controller to
// its host, and a target rendered after the source in the same commit has not
// run it yet, where the render registered it already.
const findTargetController = (source) => {
  const target = resolveUpdateTarget(source);
  if (!target) {
    return null;
  }
  const host = findControlHost(target) || target;
  return (
    host.__uiStateController__ ||
    (host.id ? getUIStateControllerById(host.id) : undefined) ||
    null
  );
};

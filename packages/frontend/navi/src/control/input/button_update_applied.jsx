/**
 * A `--navi-update` source says when its value is the one its target holds:
 * pressing it would change nothing, so it is drawn applied (`:-navi-applied`,
 * `[data-applied]`) and says so to assistive tech (`aria-pressed`). A shortcut
 * under a control (« aujourd'hui », « 1h30 », « En semaine ») lights itself
 * from what the control holds, its suggestion included.
 *
 * Followed live through the target controller's ui state signal, found by id
 * (`commandFor`) — waiting for it when it mounts after the source — or as the
 * control around the source, the way the command itself resolves its target.
 */

import { effect, useSignal } from "@preact/signals";
import { useLayoutEffect, useState } from "preact/hooks";

import {
  renderResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { resolveFirstParentControl } from "../commands.js";
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
    let stopFollowing = () => {};
    const follow = (targetController) => {
      stopFollowing();
      stopFollowing = effect(() => {
        const held = targetController.uiStateSignal.value;
        setApplied(isUpdateApplied(held, sourceValueSignal.value, { toggle }));
      });
    };
    if (commandFor) {
      const stopListening = listenControllerRegistration(commandFor, follow);
      const targetController = getUIStateControllerById(commandFor);
      if (targetController) {
        follow(targetController);
      }
      return () => {
        stopListening();
        stopFollowing();
      };
    }
    const targetController = findControllerAround(ref.current);
    if (targetController) {
      follow(targetController);
    }
    return () => {
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

// The control a source without `commandFor` updates: the one around it, found
// the way the command itself finds it.
const findControllerAround = (source) => {
  if (!source) {
    return null;
  }
  const target = resolveFirstParentControl(source);
  if (!target) {
    return null;
  }
  return (findControlHost(target) || target).__uiStateController__ || null;
};

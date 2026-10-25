/**
 * A popup nobody has asked for yet stands in as one bare element: a
 * `<dialog>` for a Dialog, a `<div>` for a Popover. That element is all that
 * reaches a closed popup before its first opening: a command finds it by id
 * (`commandfor`) and asks it to open, a press on what opens it announces
 * itself on it (navi_open_press), --navi-toggle reads its aria-expanded. The
 * popup proper — its open controller, its box, its backdrop, its focus and
 * pseudo-class wiring — is built at the first request: an open, a press about
 * to open it, its signal or its `open` saying open. A list whose rows each hold
 * a few popups mounts hundreds of them, and would pay for every one at every
 * mount, for openings that mostly never come. Built once, the popup stays: the
 * next opening finds it there.
 *
 * Nothing about where the popup goes is needed at rest: a popover reads its
 * anchor at the opening, from the request.
 */

import { dispatchCustomEvent } from "@jsenv/dom";
import { computed } from "@preact/signals";
import { useMemo, useRef, useState } from "preact/hooks";

import { preloadState } from "../nav/route.js";
import { flushSyncRendering } from "../utils/flush_sync_rendering.js";
import { readOpened, readOpenValue } from "./open_controller.js";
import { requestBuildOnPress } from "./popup_content_mount.js";

/**
 * @returns {[null|"mount"|"interaction"|"request"|"press", {current: Element}, object]}
 *   Why the popup proper exists (`null` while it stands in; "interaction" is
 *   an opening asked while it stood in, which plays like any other), the ref
 *   both elements share, and the props of the stand-in element.
 */
export const usePopupStandIn = (props) => {
  const { ref, id, signal, value, open } = props;
  const ownRef = useRef();
  const popupRef = ref || ownRef;
  // Why the popup proper exists, once it does; never undone.
  const builtRef = useRef(null);
  const mountedRef = useRef(false);
  const isMount = !mountedRef.current;
  mountedRef.current = true;
  // Its own reading of the signal: the popup of one card among many, told
  // apart by `value`, follows whether IT is the one open rather than every
  // write the others cause.
  const openedSignal = useMemo(
    () => (signal ? computed(() => readOpened(signal.value, value)) : null),
    [signal, value],
  );
  const openedBySignal = openedSignal ? openedSignal.value : false;
  if (builtRef.current === null) {
    if (isMount && (needsPopupFromMount(props) || open || openedBySignal)) {
      builtRef.current = "mount";
    } else if (open || openedBySignal) {
      builtRef.current = "interaction";
    }
  }
  const [, setBuildCount] = useState(0);
  const warmRef = useRef(null);
  const build = (reason) => {
    if (builtRef.current !== null) {
      return;
    }
    builtRef.current = reason;
    flushSyncRendering(() => {
      setBuildCount((count) => count + 1);
    });
  };

  const standInProps = {
    "ref": popupRef,
    id,
    "navi-hidden": "",
    "navi-out-of-flow": "",
    "aria-expanded": "false",
    "data-testid": props["data-testid"],
    "onnavi_request_open": (e) => {
      // Built in this same event, and asked again: the opening is the one
      // the popup proper would have had — its source, its anchor, its value.
      build("request");
      const opened = dispatchCustomEvent(
        popupRef.current,
        "navi_request_open",
        e.detail,
      );
      if (!opened) {
        e.preventDefault();
      }
    },
    "onnavi_open_press": (e) => {
      // What the opening will read is asked for at once, as the popup proper
      // does (see open_controller.js); the popup itself once the press is
      // taken for one (see requestBuildOnPress) — the click that follows opens
      // it built, or builds it itself when it comes sooner.
      if (signal) {
        preloadState(signal, readOpenValue(value));
      }
      if (warmRef.current) {
        return;
      }
      warmRef.current = requestBuildOnPress(e, {
        onBuild: () => {
          warmRef.current = null;
          build("press");
        },
        onGiveUp: () => {
          warmRef.current = null;
        },
      });
    },
  };
  return [builtRef.current, popupRef, standInProps];
};

// What needs the popup proper from the start: an opening at mount, content
// built ahead of any opening, a history entry to read, an anchor whose hover
// or focus builds the content ahead of the click.
const needsPopupFromMount = (props) => {
  if (props.defaultOpen || props.navState || props.anchor !== undefined) {
    return true;
  }
  return props.mount !== undefined && props.mount !== "from-first-open";
};

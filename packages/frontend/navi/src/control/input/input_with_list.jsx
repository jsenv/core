import { dispatchCustomEvent } from "@jsenv/dom";
import { useLayoutEffect, useState } from "preact/hooks";

import { createOnKeyDownForShortcuts } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { useNextResolver } from "../../resolver/resolver.jsx";

export const InputWithListResolver = (props) => {
  const Next = useNextResolver();

  if (props["navi-list"]) {
    return <InputWithList {...props} />;
  }
  return <Next {...props} />;
};

/**
 * InputWithList — connects an input to a SelectableList via its id.
 *
 * Usage: <Input navi-list="my-list-id" /> next to <SelectableList id="my-list-id" />
 *
 * Behavior:
 *   - ArrowDown / ArrowUp move the list's "current item" without moving focus
 *   - Home / End jump to first/last navigable item
 *   - Enter triggers selection of the current item (same as clicking it)
 *   - aria-controls dynamically points at the current item's real input so the
 *     pseudo-styles focus-inheritance kicks in (list item shows :focus /
 *     :focus-visible while the input is focused).
 *   - aria-activedescendant points at the current item's <li> id (standard
 *     combobox/listbox ARIA pattern).
 */
const InputWithList = (props) => {
  const Next = useNextResolver();
  const { "navi-list": naviList, onKeyDown } = props;

  const getListEl = () => {
    return document.getElementById(naviList);
  };

  const [currentId, setCurrentId] = useState(() => {
    const listEl = getListEl();
    return listEl ? listEl.getAttribute("navi-current-id") || null : null;
  });
  useLayoutEffect(() => {
    const listEl = getListEl();
    if (!listEl) {
      return undefined;
    }
    // Sync in case list updated before our effect ran.
    setCurrentId(listEl.getAttribute("navi-current-id") || null);
    const onCurrentChange = (e) => {
      setCurrentId(e.detail.id || null);
    };
    listEl.addEventListener("navi_current_change", onCurrentChange);
    return () => {
      listEl.removeEventListener("navi_current_change", onCurrentChange);
    };
  }, [naviList]);

  const requestListNav = (e, goal) => {
    const listEl = getListEl();
    if (!listEl) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    dispatchCustomEvent(listEl, "navi_request_nav", {
      event: e,
      goal,
    });
  };

  const onKeyDownShortcuts = createOnKeyDownForShortcuts({
    arrowdown: (e) => requestListNav(e, "down"),
    arrowup: (e) => requestListNav(e, "up"),
    home: (e) => requestListNav(e, "first"),
    end: (e) => requestListNav(e, "last"),
    enter: (e) => {
      const listEl = getListEl();
      if (!listEl) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      dispatchCustomEvent(listEl, "navi_request_activate", {
        event: e,
      });
    },
  });

  return (
    <Next
      role="combobox"
      aria-haspopup="listbox"
      aria-autocomplete="list"
      aria-controls={currentId ? `${currentId}_input` : undefined}
      aria-activedescendant={currentId || undefined}
      autoComplete="off"
      {...props}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        onKeyDownShortcuts(e);
      }}
    />
  );
};

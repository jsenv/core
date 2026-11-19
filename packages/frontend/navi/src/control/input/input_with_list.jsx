import { dispatchCustomEvent } from "@jsenv/dom";
import { useLayoutEffect, useState } from "preact/hooks";

import { createOnKeyDownForShortcuts } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { renderResolver, useNextResolver } from "../../resolver/resolver.jsx";

export const InputWithListResolver = (props) => {
  const Next = useNextResolver();

  if (props["navi-list"]) {
    return renderResolver(InputWithList, props);
  }
  return <Next {...props} />;
};

/**
 * InputWithList — a field driving a selectable List, named by its id.
 *
 * Usage: <Input navi-list="my-list-id" /> next to <List selectable id="my-list-id">
 *
 * The keys reach the list while the focus stays in the field:
 *   - ArrowDown / ArrowUp move the list's current item, Home / End to its
 *     first / last item — over the whole collection, the items a window does
 *     not draw included (they are brought into view);
 *   - Enter selects the current item (same as pressing it), or lets it go
 *     where pressing it would.
 * A key is taken only when the list answers it: with nothing to move to, the
 * arrows and Home / End do what they do in any field (Home and End move the
 * caret), and a target that is not a selectable list takes no key at all.
 * Enter stays the list's even with no current item — a form around the field
 * is not submitted by a key meant for the list.
 *
 * Typing changes what is looked for, so what the keys pointed at is let go:
 * nothing is current until the keys pick something again, and Enter right
 * after typing selects nothing.
 *
 * Where the keys point is said on the field: aria-activedescendant and
 * aria-controls name the current item's real input — the radio or checkbox
 * that carries the item's state (a selectable List is a group of those) — and
 * aria-controls is also what draws the item as focused while the field is
 * (the focus inheritance of pseudo_styles.js).
 */
const InputWithList = (props) => {
  const Next = useNextResolver();
  const { "navi-list": naviList, onKeyDown, onInput } = props;

  const getListEl = () => {
    return document.getElementById(naviList);
  };

  const [current, setCurrent] = useState(() => readCurrent(getListEl()));
  useLayoutEffect(() => {
    const listEl = getListEl();
    // Sync in case list updated before our effect ran.
    setCurrent(readCurrent(listEl));
    if (!listEl) {
      return undefined;
    }
    const onCurrentChange = (e) => {
      setCurrent(readCurrent(listEl, e.detail.realInputId || null));
    };
    listEl.addEventListener("navi_current_change", onCurrentChange);
    return () => {
      listEl.removeEventListener("navi_current_change", onCurrentChange);
    };
  }, [naviList]);

  // The list says whether it answered (onAnswer): only then is the key its.
  const requestList = (e, eventName, detail) => {
    const listEl = getListEl();
    if (!listEl) {
      return;
    }
    let answered = false;
    dispatchCustomEvent(listEl, eventName, {
      event: e,
      ...detail,
      onAnswer: () => {
        answered = true;
      },
    });
    if (answered) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const onKeyDownShortcuts = createOnKeyDownForShortcuts({
    arrowdown: (e) => requestList(e, "navi_request_nav", { goal: "next" }),
    arrowup: (e) => requestList(e, "navi_request_nav", { goal: "previous" }),
    home: (e) => requestList(e, "navi_request_nav", { goal: "first" }),
    end: (e) => requestList(e, "navi_request_nav", { goal: "last" }),
    enter: (e) => requestList(e, "navi_request_activate"),
  });

  return (
    <Next
      aria-autocomplete={current.selectable ? "list" : undefined}
      aria-controls={current.realInputId || undefined}
      aria-activedescendant={current.realInputId || undefined}
      autoComplete="off"
      {...props}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        onKeyDownShortcuts(e);
      }}
      onInput={(e) => {
        onInput?.(e);
        const listEl = getListEl();
        if (listEl) {
          dispatchCustomEvent(listEl, "navi_request_nav", {
            event: e,
            goal: "none",
          });
        }
      }}
    />
  );
};

// What the field says of the list it drives: whether it is a selectable one,
// and the real input of its current item — the one the list announced, or the
// one its current item name designates when nothing was announced yet.
const NOT_SELECTABLE = { selectable: false, realInputId: null };
const readCurrent = (listEl, realInputIdAnnounced) => {
  if (!listEl || !listEl.hasAttribute("navi-selectable")) {
    return NOT_SELECTABLE;
  }
  if (realInputIdAnnounced !== undefined) {
    return { selectable: true, realInputId: realInputIdAnnounced };
  }
  const name = listEl.getAttribute("navi-current-id");
  if (name === null) {
    return { selectable: true, realInputId: null };
  }
  const itemEl = listEl.querySelector(
    `[navi-list-item-real="${CSS.escape(name)}"]`,
  );
  const realInput =
    itemEl && itemEl.querySelector("[navi-selectable-real-input]");
  return { selectable: true, realInputId: realInput ? realInput.id : null };
};

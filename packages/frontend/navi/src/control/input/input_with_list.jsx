import { createOnKeyDownForShortcuts } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { useNextResolver } from "../../resolver/resolver.jsx";

export const InputWithList = (props) => {
  const Next = useNextResolver();
  const { ref, naviList, onKeyDown, ...rest } = props;

  const getListEl = () => {
    return document.getElementById(naviList);
  };

  const onKeyDownShortcuts = createOnKeyDownForShortcuts({
    arrowdown: (e) => {
      const listEl = getListEl();
      e.stopPropagation(); // when within a list, prevent list from handling it twice
      return requestListNavFromCurrent(listEl, {
        event: e,
        goal: "down",
      });
    },
    arrowup: (e) => {
      const listEl = getListEl();
      e.stopPropagation(); // when within a list, prevent list from handling it twice
      return requestListNavFromCurrent(listEl, {
        event: e,
        goal: "up",
      });
    },
    home: (e) => {
      const listEl = getListEl();
      e.stopPropagation(); // when within a list, prevent list from handling it twice
      return requestListNavFromCurrent(listEl, {
        event: e,
        goal: "first",
      });
    },
    end: (e) => {
      const listEl = getListEl();
      e.stopPropagation(); // when within a list, prevent list from handling it twice
      return requestListNavFromCurrent(listEl, {
        event: e,
        goal: "last",
      });
    },
    enter: (e) => {
      const listEl = getListEl();
      e.stopPropagation(); // when within a list, prevent list from handling it twice
      return requestListSelectCurrent(listEl, { event: e });
    },
    escape: (e) => {
      // prevent escape from reaching eventual <select> ancestor
      // when the escape is meant to clear the search input (otherwise it would close the select too)
      if (e.currentTarget.type === "search" && e.currentTarget.value !== "") {
        e.stopPropagation();
        return true;
      }
      const listEl = getListEl();
      // here we allow propagation of escape up to the <select> to allow closing if within a select
      // it also means list might catch escape and reset again but it's ok to reset twice here as it won't cause side effects
      // (if we need the same pattern for other events where it could be problematic we would have to mark
      // event as handled somehow to prevent list containing input to react to it)
      return requestListInteractionStateReset(listEl, { event: e });
    },
    // home: () => {},
    // end: () => {},
    // enter: () => {},
  });

  <Next
    role="combobox"
    aria-haspopup="listbox"
    aria-autocomplete="list"
    autoComplete="off"
    {...rest}
    ref={ref}
    onKeyDown={(e) => {
      onKeyDown?.(e);
      onKeyDownShortcuts(e);
    }}
  />;
};

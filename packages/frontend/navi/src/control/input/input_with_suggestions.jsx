import { dispatchCustomEvent } from "@jsenv/dom";
import { useEffect, useRef, useState } from "preact/hooks";

import { ChevronDownSvg } from "@jsenv/navi/src/graphic/icons/chevron_updown_svg.jsx";
import { createOnKeyDownForShortcuts } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { Icon } from "@jsenv/navi/src/text/icon.jsx";
import { useNextResolver } from "../../resolver/resolver.jsx";
import { InputRightSlot } from "./input_components.jsx";

export const InputWithSuggestionsResolver = (props) => {
  const Next = useNextResolver();

  if (props["navi-suggestions"]) {
    return <InputTextualWithSuggestions {...props} />;
  }
  return <Next {...props} />;
};

const InputTextualWithSuggestions = (props) => {
  const Next = useNextResolver();
  const {
    ref,
    suggestions,
    onInput,
    onFocus,
    onBlur,
    onKeyDown,
    children,
    ...rest
  } = props;
  const [expanded, setExpanded] = useState(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const expand = () => {
    expandedRef.current = true;
    setExpanded(true);
  };
  const collapse = () => {
    expandedRef.current = false;
    setExpanded(false);
  };
  const getListEl = () => {
    return document.getElementById(suggestions);
  };
  const showSuggestions = (e) => {
    if (expandedRef.current) {
      return;
    }
    const listEl = getListEl();
    if (listEl) {
      dispatchCustomEvent(listEl, "navi_request_open", {
        event: e,
        anchor: ref.current,
      });
      expand();
    }
  };
  const hideSuggestions = (e) => {
    if (!expandedRef.current) {
      return;
    }
    const listEl = getListEl();
    if (listEl) {
      dispatchCustomEvent(listEl, "navi_request_close", { event: e });
      collapse();
    }
  };

  useEffect(() => {
    const inputEl = ref.current;
    const listEl = getListEl();
    if (!listEl) {
      return undefined;
    }
    const onSelect = (e) => {
      const { item } = e.detail;
      const { value } = item;
      inputEl.value = value;
      inputEl.dispatchEvent(new Event("input", { bubbles: true }));
      hideSuggestions(e);
    };
    listEl.addEventListener("navi_list_select", onSelect);
    return () => {
      listEl.removeEventListener("navi_list_select", onSelect);
    };
  }, [suggestions]);

  const onKeyDownShortcuts = createOnKeyDownForShortcuts({
    arrowdown: (e) => {
      showSuggestions(e);
    },
    arrowup: (e) => {
      showSuggestions(e);
    },
    escape: (e) => {
      if (!expandedRef.current) {
        return false;
      }
      hideSuggestions(e);
      return true;
    },
    home: () => {},
    end: () => {},
    enter: () => {},
  });

  return (
    <Next
      role="combobox"
      aria-haspopup="listbox"
      aria-expanded={expanded}
      aria-autocomplete="list"
      autoComplete="off"
      basePseudoState={{
        ":-navi-expanded": expanded,
      }}
      onnavi_callout_open={(e) => {
        hideSuggestions(e);
      }}
      {...rest}
      ref={ref}
      onFocus={(e) => {
        onFocus?.(e);
        showSuggestions(e);
      }}
      onBlur={(e) => {
        onBlur?.(e);
        hideSuggestions(e);
      }}
      onInput={(e) => {
        onInput?.(e);
        showSuggestions(e);
      }}
      onKeyDown={(e) => {
        onKeyDown?.(e);
        onKeyDownShortcuts(e);
      }}
      //  arrowdown: (e) => {
      //   const listEl = getListEl();
      //   e.stopPropagation(); // when within a list, prevent list from handling it twice
      //   return requestListNavFromCurrent(listEl, {
      //     event: e,
      //     goal: "down",
      //   });
      // },
      // arrowup: (e) => {
      //   const listEl = getListEl();
      //   e.stopPropagation(); // when within a list, prevent list from handling it twice
      //   return requestListNavFromCurrent(listEl, {
      //     event: e,
      //     goal: "up",
      //   });
      // },
      // home: (e) => {
      //   const listEl = getListEl();
      //   e.stopPropagation(); // when within a list, prevent list from handling it twice
      //   return requestListNavFromCurrent(listEl, {
      //     event: e,
      //     goal: "first",
      //   });
      // },
      // end: (e) => {
      //   const listEl = getListEl();
      //   e.stopPropagation(); // when within a list, prevent list from handling it twice
      //   return requestListNavFromCurrent(listEl, {
      //     event: e,
      //     goal: "last",
      //   });
      // },
      // enter: (e) => {
      //   const listEl = getListEl();
      //   e.stopPropagation(); // when within a list, prevent list from handling it twice
      //   return requestListSelectCurrent(listEl, { event: e });
      // },
      // escape: (e) => {
      //   // prevent escape from reaching eventual <select> ancestor
      //   // when the escape is meant to clear the search input (otherwise it would close the select too)
      //   if (e.currentTarget.type === "search" && e.currentTarget.value !== "") {
      //     e.stopPropagation();
      //     return true;
      //   }
      //   const listEl = getListEl();
      //   // here we allow propagation of escape up to the <select> to allow closing if within a select
      //   // it also means list might catch escape and reset again but it's ok to reset twice here as it won't cause side effects
      //   // (if we need the same pattern for other events where it could be problematic we would have to mark
      //   // event as handled somehow to prevent list containing input to react to it)
      //   return requestListInteractionStateReset(listEl, { event: e });
      // },
    >
      {children || (
        <InputRightSlot
          onClick={(e) => {
            if (expanded) {
              hideSuggestions(e);
            } else {
              showSuggestions(e);
            }
          }}
        >
          <Icon color="rgba(28, 43, 52, 0.5)">
            <ChevronDownSvg />
          </Icon>
        </InputRightSlot>
      )}
    </Next>
  );
};

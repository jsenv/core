/**
 * 
- https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md
 - https://open-ui.org/components/focusgroup.explainer/
 - https://github.com/openui/open-ui/issues/990
 */

import { performArrowNavigation } from "./arrow_navigation.js";
import { setFocusGroup } from "./focus_group_registry.js";
import { performTabNavigation } from "./tab_navigation.js";

export const initFocusGroup = (
  element,
  {
    direction = "both",
    // extend = true,
    skipTab = true,
    loop = false,
    name, // Can be undefined for implicit ancestor-descendant grouping
  } = {},
) => {
  const cleanupCallbackSet = new Set();
  const cleanup = () => {
    for (const callback of cleanupCallbackSet) {
      callback();
    }
    cleanupCallbackSet.clear();
  };

  // Store focus group data in registry
  const removeFocusGroup = setFocusGroup(element, {
    direction,
    loop,
    name, // Store undefined as-is for implicit grouping
  });
  cleanupCallbackSet.add(removeFocusGroup);

  tab: {
    if (!skipTab) {
      break tab;
    }
    const handleTabKeyDown = (event) => {
      performTabNavigation(event, { outsideOfElement: element });
    };
    // Handle Tab navigation (exit group)
    element.addEventListener("keydown", handleTabKeyDown, {
      capture: true,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleTabKeyDown, {
        capture: true,
        passive: false,
      });
    });
  }

  // Handle Arrow key navigation (within group)
  arrow_keys: {
    const handleArrowKeyDown = (event) => {
      performArrowNavigation(event, element, { direction, loop, name });
    };
    element.addEventListener("keydown", handleArrowKeyDown, {
      capture: true,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleArrowKeyDown, {
        capture: true,
        passive: false,
      });
    });
  }

  return { cleanup };
};

/**
 * 
- https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md
 - https://open-ui.org/components/focusgroup.explainer/
 - https://github.com/openui/open-ui/issues/990

 - https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md#69-grid-focusgroups
 */

import { performArrowNavigation } from "./arrow_navigation.js";
import { setFocusGroup } from "./focus_group_registry.js";
import { isFocusNavMarked } from "./focus_nav_event_marker.js";
import { performTabNavigation } from "./tab_navigation.js";

export const initFocusGroup = (
  element,
  {
    // extend = true,
    skipTab = true,
    name, // Can be undefined for implicit ancestor-descendant grouping
    excludeAriaHidden = true,
    // Which axes are active: "x", "y", or "both" (default)
    direction = "both",
    // Which axes loop at boundaries: "x", "y", "both", or undefined (no looping)
    wrap,
    // CSS selector to restrict candidates on each axis
    xSelector,
    ySelector,
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
    name, // Store undefined as-is for implicit grouping
  });
  cleanupCallbackSet.add(removeFocusGroup);

  tab: {
    if (!skipTab) {
      break tab;
    }
    const handleTabKeyDown = (event) => {
      if (isFocusNavMarked(event)) {
        // Prevent double handling of the same event + allow preventing focus nav from outside
        return;
      }
      performTabNavigation(event, {
        outsideOfElement: element,
        excludeAriaHidden,
      });
    };
    // Handle Tab navigation (exit group)
    element.addEventListener("keydown", handleTabKeyDown, {
      // we must use capture: false to let chance for other part of the code
      // to call preventFocusNav
      capture: false,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleTabKeyDown, {
        capture: false,
        passive: false,
      });
    });
  }

  // Handle Arrow key navigation (within group)
  arrow_keys: {
    const handleArrowKeyDown = (event) => {
      if (isFocusNavMarked(event)) {
        // Prevent double handling of the same event + allow preventing focus nav from outside
        return;
      }
      performArrowNavigation(event, element, {
        name,
        excludeAriaHidden,
        direction,
        wrap,
        xSelector,
        ySelector,
      });
    };
    element.addEventListener("keydown", handleArrowKeyDown, {
      // we must use capture: false to let chance for other part of the code
      // to call preventFocusNav
      capture: false,
      passive: false,
    });
    cleanupCallbackSet.add(() => {
      element.removeEventListener("keydown", handleArrowKeyDown, {
        capture: false,
        passive: false,
      });
    });
  }

  return { cleanup };
};

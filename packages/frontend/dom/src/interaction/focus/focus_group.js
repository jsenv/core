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

/**
 * Initialises keyboard navigation for a focus group.
 *
 * Sets up two keyboard behaviours on the element:
 * - **Tab**: exits the group, moving focus to the next/previous focusable
 *   element outside the group (standard skip-group behaviour).
 * - **Arrow keys**: moves focus between focusable descendants according to
 *   the configured direction, wrapping and selector constraints.
 *
 * @param {Element} element - The focus-group root element.
 * @param {object} [options]
 * @param {boolean} [options.skipTab=true] - When true, Tab exits the group
 *   instead of moving through its children one by one.
 * @param {string} [options.name] - Optional name shared between related groups
 *   to enable delegation (focus jumps from one named group to another).
 * @param {boolean} [options.excludeAriaHidden=true] - Skip elements that are
 *   hidden from the accessibility tree (aria-hidden).
 * @param {"x"|"y"|"both"} [options.direction="both"] - Which axes are active.
 *   "x" = left/right only, "y" = up/down only, "both" = all four arrows.
 * @param {"x"|"y"|"both"} [options.wrap] - Which axes loop at boundaries.
 *   Omit or pass undefined for no looping on either axis.
 * @param {string} [options.xSelector] - CSS selector that candidates must match
 *   when navigating on the x axis. Omit to allow any focusable element.
 * @param {string} [options.ySelector] - CSS selector that candidates must match
 *   when navigating on the y axis. Omit to allow any focusable element.
 * @param {string} [options.manages] - CSS selector declaring which descendants
 *   this group "manages" for Tab navigation. When set, Tab only skips managed
 *   elements; other focusable descendants (e.g. inputs inside a radio widget)
 *   remain individually tabbable. When omitted, Tab skips the entire group.
 * @param {boolean} [options.strictTab=false] - When true AND manages is set,
 *   Tab always exits the group regardless of where focus is inside it.
 * @returns {{ cleanup: () => void }} Call cleanup() to remove all event listeners.
 */
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
    // CSS selector declaring which elements the group "manages" for Tab purposes.
    // Defaults to ySelector ?? xSelector so arrow-nav and tab-nav stay in sync.
    manages = ySelector ?? xSelector,
    strictTab = false,
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
  element.setAttribute("navi-focus-group", manages ?? "");
  cleanupCallbackSet.add(() => {
    element.removeAttribute("navi-focus-group");
  });
  if (manages && strictTab) {
    element.setAttribute("navi-focus-group-strict", "");
    cleanupCallbackSet.add(() => {
      element.removeAttribute("navi-focus-group-strict");
    });
  }

  tab: {
    if (!skipTab) {
      break tab;
    }
    const handleTabKeyDown = (event) => {
      if (isFocusNavMarked(event)) {
        // Prevent double handling of the same event + allow preventing focus nav from outside
        return;
      }
      // Smart mode: when focus is inside an unmanaged element (e.g. an input
      // inside a radio widget), do NOT skip the entire group — let Tab navigate
      // freely. The predicate in performTabNavigation will still skip managed
      // items (those matching `manages`) encountered along the way.
      const activeElement = document.activeElement;
      const focusIsOnUnmanagedDescendant =
        manages &&
        !strictTab &&
        element.contains(activeElement) &&
        !activeElement.matches(manages);
      performTabNavigation(event, {
        outsideOfElement: focusIsOnUnmanagedDescendant ? null : element,
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

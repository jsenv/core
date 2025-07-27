/**
 * 
 - https://open-ui.org/components/focusgroup.explainer/
 - https://github.com/MicrosoftEdge/MSEdgeExplainers/blob/main/Focusgroup/explainer.md
 - https://github.com/openui/open-ui/issues/990
 */

import { isTabEvent, performTabNavigation } from "./tab_navigation.js";

export const initFocusGroup = (
  element,
  {
    // direction = "vertical",
    // extend = true,
    skipTab = true,
  } = {},
) => {
  if (skipTab) {
    element.addEventListener(
      "keydown",
      (event) => {
        if (!isTabEvent(event)) {
          return;
        }
        performTabNavigation(event, {
          outsideOfElement: element,
        });
      },
      {
        capture: true,
        passive: false,
      },
    );
  }
};

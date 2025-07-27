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
    // lorsqu ele focus arrive dans ce groupe, on peut choisir de skip-tab
    // c'est a dire
    // que le prochain tab focus en dehors de ce groupe
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

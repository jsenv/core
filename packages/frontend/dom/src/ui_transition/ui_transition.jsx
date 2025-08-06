/**
 *  <div class="ui_transition_container">
 *    <div class="ui_transition_outer_wrapper"> <!-- for animation constraints -->
 *      <div class="ui_transition_measure_wrapper"> <!-- for content measurements -->
 *        <div class="ui_transition_slot">
 *          <!-- actual content -->
 *        </div>
 *     </div>
 *    </div>
 *    <div class="ui-transition-overlay">
 *     <!-- transition elements (clones) are inserted here -->
 *    </div>
 * </div>
 */

import { useLayoutEffect, useRef } from "preact/hooks";
import { initUITransition } from "./ui_transition.js";

export const UITransition = ({ children }) => {
  const ref = useRef();
  useLayoutEffect(() => {
    const uiTransition = initUITransition(ref.current);
    return () => {
      uiTransition.cleanup();
    };
  }, []);

  return (
    <div ref={ref} className="ui-transition-container">
      <div className="ui-transition-outer-wrapper">
        <div className="ui-transition-measure-wrapper">
          <div className="ui-transition-slot">{children}</div>
        </div>
      </div>
      <div className="ui-transition-overlay"></div>
    </div>
  );
};

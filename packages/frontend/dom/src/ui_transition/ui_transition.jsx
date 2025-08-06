/**
 * Required HTML structure for UI transitions with smooth size animations:
 *
 * <div class="ui_transition_container">
 *   <!-- Main container with relative positioning and overflow hidden -->
 *
 *   <div class="ui_transition_outer_wrapper">
 *     <!-- Size animation target: width/height constraints are applied here during transitions -->
 *
 *     <div class="ui_transition_measure_wrapper">
 *       <!-- Content measurement layer: ResizeObserver watches this to detect natural content size changes -->
 *
 *       <div class="ui_transition_slot">
 *         <!-- Content slot: actual content is inserted here via children -->
 *       </div>
 *     </div>
 *   </div>
 *
 *   <div class="ui-transition-overlay">
 *     <!-- Transition overlay: cloned old content is positioned here for slide/fade animations -->
 *   </div>
 * </div>
 *
 * This separation allows:
 * - Smooth size transitions by constraining outer-wrapper dimensions
 * - Accurate content measurement via measure-wrapper ResizeObserver
 * - Visual transitions using overlay-positioned clones
 * - Independent content updates in the slot without affecting ongoing animations
 */

import { useLayoutEffect, useRef } from "preact/hooks";
import { initUITransition } from "./ui_transition.js";

export const UITransition = ({ children, ...props }) => {
  const ref = useRef();
  useLayoutEffect(() => {
    const uiTransition = initUITransition(ref.current);
    return () => {
      uiTransition.cleanup();
    };
  }, []);

  return (
    <div ref={ref} {...props} className="ui-transition-container">
      <div className="ui-transition-outer-wrapper">
        <div className="ui-transition-measure-wrapper">
          <div className="ui-transition-slot">{children}</div>
        </div>
      </div>
      <div className="ui-transition-overlay"></div>
    </div>
  );
};

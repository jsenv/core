/**
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API#pseudo-elements
 * https://motion.dev/docs/react-layout-animations
 */

import { initUITransition } from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

export const UITransition = ({
  children,
  transitionType,
  transitionDuration,
  ...props
}) => {
  const ref = useRef();
  useLayoutEffect(() => {
    const uiTransition = initUITransition(ref.current);
    return () => {
      uiTransition.cleanup();
    };
  }, []);

  return (
    <div
      ref={ref}
      {...props}
      data-ui-transition={transitionType ? transitionType : undefined}
      data-ui-transition-duration={
        transitionDuration ? transitionDuration : undefined
      }
      className="ui_transition_container"
    >
      <div className="ui_transition_outer_wrapper">
        <div className="ui_transition_measure_wrapper">
          <div className="ui_transition_slot">{children}</div>
        </div>
      </div>
      <div className="ui_transition_overlay"></div>
    </div>
  );
};

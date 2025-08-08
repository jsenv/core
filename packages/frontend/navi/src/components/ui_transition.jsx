/**
 * UITransition
 *
 * A Preact component that enables smooth animated transitions between its children when the content changes.
 * It observes the value of `data-content-key` on child elements and animates transitions when the key changes.
 *
 * Usage:
 * - Wrap dynamic content in <UITransition> to animate between states (loading, error, completed, etc.)
 * - Set a unique `data-content-key` on your rendered content to identify each state or variant
 * - Use the `transitionType` prop to control the animation style (e.g. "slide-left", "cross-fade")
 * - Use `transitionDuration` to control animation speed in milliseconds
 *
 * Example:
 *
 *   <UITransition transitionType="slide-left" transitionDuration={400}>
 *     {isLoading
 *       ? <Spinner data-content-key={userId} data-content-phase />
 *       : <UserProfile user={user} data-content-key={userId} />}
 *   </UITransition>
 *
 * When `data-content-key` changes, UITransition animates the transition between the old and new content using the specified transitionType.
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
          <div className="ui_transition_phase_overlay"></div>
        </div>
      </div>
      <div className="ui_transition_content_overlay"></div>
    </div>
  );
};

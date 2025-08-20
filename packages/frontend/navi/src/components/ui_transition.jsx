/**
 * UITransition
 *
 * A Preact component that enables smooth animated transitions between its children when the content changes.
 * It observes content keys and phases to create different types of transitions.
 *
 * Features:
 * - Content transitions: Between different content keys (e.g., user profiles, search results)
 * - Phase transitions: Between loading/content/error states for the same content key
 * - Automatic size animation to accommodate content changes
 * - Configurable transition types: "slide-left", "cross-fade"
 * - Independent duration control for content and phase transitions
 *
 * Usage:
 * - Wrap dynamic content in <UITransition> to animate between states
 * - Set a unique `data-content-key` on your rendered content to identify each content variant
 * - Use `data-content-phase` to mark loading/error states for phase transitions
 * - Configure transition types and durations for both content and phase changes
 *
 * Example:
 *
 *   <UITransition
 *     transitionType="slide-left"
 *     transitionDuration={400}
 *     phaseTransitionType="cross-fade"
 *     phaseTransitionDuration={300}
 *   >
 *     {isLoading
 *       ? <Spinner data-content-key={userId} data-content-phase />
 *       : <UserProfile user={user} data-content-key={userId} />}
 *   </UITransition>
 *
 * When `data-content-key` changes, UITransition animates content transitions.
 * When `data-content-phase` changes for the same key, it animates phase transitions.
 */

import { initUITransition } from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";
import { useContentKeyContext } from "./content_key_context.jsx";

export const UITransition = ({
  children,
  contentKey,
  sizeTransition,
  sizeTransitionDuration,
  transitionType,
  transitionDuration,
  phaseTransitionType,
  phaseTransitionDuration,
  ...props
}) => {
  const contentKeyFromContext = useContentKeyContext();
  const effectiveContentKey = contentKey || contentKeyFromContext;

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
      data-size-transition={sizeTransition ? "" : undefined}
      data-size-transition-duration={
        sizeTransitionDuration ? sizeTransitionDuration : undefined
      }
      data-content-transition={transitionType ? transitionType : undefined}
      data-content-transition-duration={
        transitionDuration ? transitionDuration : undefined
      }
      data-phase-transition={
        phaseTransitionType ? phaseTransitionType : undefined
      }
      data-phase-transition-duration={
        phaseTransitionDuration ? phaseTransitionDuration : undefined
      }
      className="ui_transition_container"
    >
      <div className="ui_transition_outer_wrapper">
        <div className="ui_transition_measure_wrapper">
          <div
            className="ui_transition_slot"
            data-content-key={
              effectiveContentKey ? effectiveContentKey : undefined
            }
          >
            {children}
          </div>
          <div className="ui_transition_phase_overlay"></div>
        </div>
      </div>
      <div className="ui_transition_content_overlay"></div>
    </div>
  );
};

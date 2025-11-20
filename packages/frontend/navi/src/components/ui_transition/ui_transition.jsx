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
 * - Set a unique `data-content-id` on your rendered content to identify each content variant
 * - Use `data-content-phase` to mark loading/error states for phase transitions
 * - Configure transition types and durations for both content and phase changes
 *
 * Example:
 *
 *   <UITransition>
 *     {isLoading
 *       ? <Spinner data-content-key={userId} data-content-phase />
 *       : <UserProfile user={user} data-content-key={userId} />}
 *   </UITransition>
 *
 * When `data-content-id` changes, UITransition animates content transitions.
 * When `data-content-phase` changes for the same key, it animates phase transitions.
 */

import { createContext } from "preact";
import { useContext, useLayoutEffect, useMemo, useRef } from "preact/hooks";

import { createUITransitionController } from "./ui_transition.js";

const UITransitionContentIdContext = createContext();

export const UITransition = ({
  children,
  contentId,
  type,
  duration,
  debugDetection,
  debugContent,
  debugSize,
  disabled,
  uiTransitionRef,
  alignX,
  alignY,
  ...props
}) => {
  const contentIdRef = useRef(contentId);
  const updateContentId = () => {
    const uiTransition = uiTransitionRef.current;
    if (!uiTransition) {
      return;
    }
    const value = contentIdRef.current;
    uiTransition.updateContentId(value);
  };

  const uiTransitionContentIdContextValue = useMemo(() => {
    const set = new Set();
    const onSetChange = () => {
      const value = Array.from(set).join("|");
      contentIdRef.current = value;
      updateContentId();
    };
    const update = (part, newPart) => {
      if (!set.has(part)) {
        console.warn(
          `UITransition: trying to update an id that does not exist: ${part}`,
        );
        return;
      }
      set.delete(part);
      set.add(newPart);
      onSetChange();
    };
    const add = (part) => {
      if (!part) {
        return;
      }
      if (set.has(part)) {
        return;
      }
      set.add(part);
      onSetChange();
    };
    const remove = (part) => {
      if (!part) {
        return;
      }
      if (!set.has(part)) {
        return;
      }
      set.delete(part);
      onSetChange();
    };
    return { add, update, remove };
  }, []);

  const ref = useRef();
  const uiTransitionRefDefault = useRef();
  uiTransitionRef = uiTransitionRef || uiTransitionRefDefault;
  useLayoutEffect(() => {
    if (disabled) {
      return null;
    }
    const uiTransition = createUITransitionController(ref.current, {
      alignX,
      alignY,
    });
    uiTransitionRef.current = uiTransition;
    return () => {
      uiTransition.cleanup();
    };
  }, [disabled, alignX, alignY]);

  if (disabled) {
    return children;
  }

  return (
    <div
      ref={ref}
      {...props}
      className="ui_transition"
      data-transition-type={type}
      data-transition-duration={duration}
      data-debug-detection={debugDetection ? "" : undefined}
      data-debug-size={debugSize ? "" : undefined}
      data-debug-content={debugContent ? "" : undefined}
    >
      <div className="ui_transition_active_group">
        <div
          className="ui_transition_target_slot"
          data-content-id={
            contentIdRef.current ? contentIdRef.current : undefined
          }
        >
          <UITransitionContentIdContext.Provider
            value={uiTransitionContentIdContextValue}
          >
            {children}
          </UITransitionContentIdContext.Provider>
        </div>
        <div className="ui_transition_outgoing_slot"></div>
      </div>
      <div className="ui_transition_previous_group">
        <div className="ui_transition_previous_target_slot"></div>
        <div className="ui_transition_previous_outgoing_slot"></div>
      </div>
    </div>
  );
};

/**
 * The goal of this hook is to allow a component to set a "content key"
 * Meaning all content within the component is identified by that key
 *
 * When the key changes, UITransition will be able to detect that and consider the content
 * as changed even if the component is still the same
 *
 * This is used by <Route> to set the content key to the route path
 * When the route becomes inactive it will call useUITransitionContentId(undefined)
 * And if a sibling route becones active it will call useUITransitionContentId with its own path
 *
 */
export const useUITransitionContentId = (value) => {
  const contentId = useContext(UITransitionContentIdContext);
  const valueRef = useRef();
  if (contentId !== undefined && valueRef.current !== value) {
    const previousValue = valueRef.current;
    valueRef.current = value;
    if (previousValue === undefined) {
      contentId.add(value);
    } else {
      contentId.update(previousValue, value);
    }
  }
  useLayoutEffect(() => {
    if (contentId === undefined) {
      return null;
    }
    return () => {
      contentId.remove(valueRef.current);
    };
  }, []);
};

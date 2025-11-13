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

import { createContext } from "preact";
import {
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";

import { initUITransition } from "./ui_transition.js";

const ContentKeyContext = createContext();

export const UITransition = ({
  children,
  contentKey,
  fluid,
  sizeTransition = true,
  sizeTransitionDuration,
  transitionType,
  transitionDuration,
  phaseTransitionType,
  phaseTransitionDuration,
  debugDetection,
  debugContent,
  debugSize,
  debugBreakAfterClone,
  disabled,
  ...props
}) => {
  const [contentKeyFromContext, setContentKeyFromContext] = useState();
  const contentKeyContextValue = useMemo(() => {
    const keySet = new Set();
    const onKeySetChange = () => {
      setContentKeyFromContext(Array.from(keySet).join("|"));
    };
    const update = (key, newKey) => {
      if (!keySet.has(key)) {
        console.warn(
          `UITransition: trying to update a key that does not exist: ${key}`,
        );
        return;
      }
      keySet.delete(key);
      keySet.add(newKey);
      onKeySetChange();
    };
    const add = (key) => {
      if (!key) {
        return;
      }
      if (keySet.has(key)) {
        return;
      }
      keySet.add(key);
      onKeySetChange();
    };
    const remove = (key) => {
      if (!key) {
        return;
      }
      if (!keySet.has(key)) {
        return;
      }
      keySet.delete(key);
      onKeySetChange();
    };
    return { add, update, remove };
  }, []);
  const effectiveContentKey = contentKey || contentKeyFromContext;

  const ref = useRef();
  useLayoutEffect(() => {
    if (disabled) {
      return null;
    }
    const uiTransition = initUITransition(ref.current);
    return () => {
      uiTransition.cleanup();
    };
  }, [disabled]);

  if (disabled) {
    return children;
  }

  return (
    <ContentKeyContext.Provider value={contentKeyContextValue}>
      <div
        ref={ref}
        {...props}
        className="ui_transition"
        data-fluid={fluid ? "" : undefined}
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
        data-debug-detection={debugDetection ? "" : undefined}
        data-debug-size={debugSize ? "" : undefined}
        data-debug-content={debugContent ? "" : undefined}
        data-debug-break-after-clone={debugBreakAfterClone}
      >
        <div className="ui_transition_outer_wrapper">
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
        <div className="ui_transition_content_overlay"></div>
      </div>
    </ContentKeyContext.Provider>
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
 * When the route becomes inactive it will call useContentKey(undefined)
 * And if a sibling route becones active it will call useContentKey with its own path
 *
 */
export const useContentKey = (key) => {
  const contentKey = useContext(ContentKeyContext);
  const keyRef = useRef();
  if (keyRef.current !== key && contentKey !== undefined) {
    const previousKey = keyRef.current;
    keyRef.current = key;
    if (previousKey === undefined) {
      contentKey.add(key);
    } else {
      contentKey.update(previousKey, key);
    }
  }
  useLayoutEffect(() => {
    if (contentKey === undefined) {
      return null;
    }
    return () => {
      contentKey.remove(keyRef.current);
    };
  }, []);
};

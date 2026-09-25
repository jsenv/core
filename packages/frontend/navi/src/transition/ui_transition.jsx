/**
 * UITransition
 *
 * A Preact component that animates the change between its children: the
 * outgoing content fades out while the incoming one fades in, and the box
 * resizes from the one to the other (the mechanics are in ui_transition.js).
 *
 * Two kinds of change are told apart, from attributes on the rendered content:
 * - a content transition, when the content key changes — `data-content-key` on
 *   the rendered element (a user id, a search), or `useUITransitionContentId`
 *   called from a component inside (what `<Route>` does with its url pattern);
 * - a phase transition, when `data-content-phase` (a loading or error state)
 *   changes for the same content key.
 *
 * Example:
 *
 *   <UITransition>
 *     {isLoading
 *       ? <Spinner data-content-key={userId} data-content-phase />
 *       : <UserProfile user={user} data-content-key={userId} />}
 *   </UITransition>
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
        if (set.size === 0) {
          console.warn(
            `UITransition: content id update "${part}" -> "${newPart}" ignored because content id set is empty`,
          );
          return;
        }
        console.warn(
          `UITransition: content id update "${part}" -> "${newPart}" ignored because content id not found in set, only got [${Array.from(set).join(", ")}]`,
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
    const uiTransition = createUITransitionController(ref.current, {
      alignX,
      alignY,
    });
    uiTransitionRef.current = uiTransition;
    return () => {
      uiTransition.cleanup();
    };
  }, [disabled, alignX, alignY]);

  return (
    <div
      ref={ref}
      {...props}
      className="ui_transition"
      data-disabled={disabled ? "" : undefined}
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
        <div className="ui_transition_outgoing_slot" inert></div>
      </div>
      <div className="ui_transition_previous_group" inert>
        <div className="ui_transition_previous_target_slot"></div>
        <div className="ui_transition_previous_outgoing_slot"></div>
      </div>
    </div>
  );
};

/**
 * Names the content a component renders, for the <UITransition> around it:
 * everything rendered inside is identified by that key, and the key changing
 * is read as a content change even though the component is the same.
 *
 * <Route> calls it with the url pattern of the branch it renders; the branch
 * unmounting removes its part, and a sibling branch mounting adds its own.
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

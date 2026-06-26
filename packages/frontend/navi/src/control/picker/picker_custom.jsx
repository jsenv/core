import { dispatchCustomEvent, findEvent } from "@jsenv/dom";
import { useId, useRef, useState } from "preact/hooks";

import { createOnKeyDownForShortcuts } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { windowWidthSignal } from "@jsenv/navi/src/layout/responsive.js";
import { useDebugFocus, useDebugPopup } from "@jsenv/navi/src/navi_debug.jsx";
import { Dialog } from "@jsenv/navi/src/popup/dialog.jsx";
import { Popover } from "@jsenv/navi/src/popup/popover.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { compareTwoJsValues } from "@jsenv/navi/src/utils/compare_two_js_values.js";
import { dispatchRequestAction } from "../rules/control_action.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import {
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "../ui_state_dom.js";

const css = /* css */ `
  .navi_picker {
    /* popover */
    &[aria-haspopup="listbox"] {
      .navi_picker_popover {
        position: absolute;
        inset: unset;
        min-width: var(--anchor-width, 0px);
        max-width: 95vw;
        /* max-height covers the placeholder + list; the list scrolls internally */
        max-height: var(--space-available, 95dvh);
        margin: 0;
        padding: 0;
        background: var(--picker-background-color);
        border-width: var(--picker-border-width);
        border-style: solid;
        border-color: var(--x-picker-border-color);
        border-radius: var(--picker-border-radius);
        outline-width: var(--picker-outline-width);
        outline-color: var(--picker-outline-color);
        outline-offset: 0px;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.08),
          0 12px 40px rgba(0, 0, 0, 0.22);
        cursor: default; /* Reset pointer cursor within the select */
        overflow: hidden;
        overscroll-behavior: none;

        /* The anchor placeholder is a non-interactive visual clone of the
           trigger. It makes the popover wrap both the trigger area and the list
           under a single border/shadow. CSS order places it before the list
           when the popover is below the trigger, and after when above. */
        .navi_picker_anchor_clone {
          display: flex;
          /* To make clone same height as original we need to force it because context can impact height */
          /* Like siblings with a bigger height in a flex container */
          /* We subtract the border sizes as anchor-height includes borders in the dimensions */
          min-height: var(--anchor-inner-height);
          /* Mirror the trigger's padding so the clone looks identical */
          padding-top: var(--x-picker-padding-top);
          padding-right: var(--x-picker-padding-right);
          padding-bottom: var(--x-picker-padding-bottom);
          padding-left: var(--x-picker-padding-left);
          flex-shrink: 0;
          flex-direction: column;
          justify-content: center;
          gap: var(--navi-s);
          order: -1; /* before the list — popover is below the trigger */
          background: var(--x-picker-background-color);
          border-bottom: var(--picker-border-width) solid
            var(--x-picker-border-color);

          &:hover {
            --x-picker-background-color: var(--picker-background-color-hover);
            --x-picker-border-color: var(--picker-border-color-hover);
          }
        }

        &[data-position-y-current="above"],
        &[data-position-y-current="above-overlap"] {
          .navi_picker_anchor_clone {
            order: 1; /* after the list — popover is above the trigger */
            border-top: var(--picker-border-width) solid
              var(--x-picker-border-color);
            border-bottom: none;
          }
        }

        /* The list scrolls inside the popover */
        .navi_list_container {
          width: 100%;
          border-radius: max(
            0px,
            var(--picker-border-radius) - var(--picker-border-width)
          );
          overflow: auto;
          overscroll-behavior: none;
        }

        &[data-focus-visible] {
          outline-style: solid;
        }
      }

      &[aria-expanded="true"] {
        &[navi-popover-mode="overlay"],
        &[navi-popover-mode="attached"] {
          /* When sizes uses float AND the border uses border-radius it's possible it's possible to see some pixels
          of the underlying select borders. We hide them to ensure this cannot happen.  */
          border-color: transparent;
        }

        .navi_picker_popover {
          display: flex;
          flex-direction: column;
        }
      }
    }

    /* dialog */
    &[aria-haspopup="dialog"] {
      .navi_picker_dialog {
        min-width: var(--anchor-width, 0px);
        max-height: 95dvh;
        padding: 0;
        background: var(--picker-background-color);
        border: var(--picker-border-width) solid var(--x-picker-border-color);
        border-radius: var(--picker-border-radius);
        outline-width: var(--picker-outline-width);
        outline-color: var(--picker-outline-color);
        outline-offset: 0;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.08),
          0 12px 40px rgba(0, 0, 0, 0.22);
        cursor: default; /* Reset pointer cursor within the select */
        /* overscroll-behavior: contain; */

        &[open] {
          display: flex;
          flex-direction: column;
        }

        &[data-focus-visible] {
          outline-style: solid;
        }

        &::backdrop {
          background: rgba(0, 0, 0, 0.4);
        }
      }

      .navi_list_container {
        width: 100%;
        border-radius: max(
          0px,
          var(--picker-border-radius) - var(--picker-border-width)
        );
        overflow: auto;
        overscroll-behavior: none;
      }
    }
  }
`;

export const PickerCustomResolver = (props) => {
  if (props.children === undefined) {
    return <PickerNative {...props} />;
  }
  return <PickerCustom {...props} />;
};

const PickerNative = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      {...props}
      // When the picker has its own action we want to run it when native "change" event occur (native picker dialog closes)
      // not on every change of color while user is selecting a color for instance
      // (it would cause too many calls and would likely not be what the user expects)
      // (uiAction can be used to react live)
      actionEvent={props.action ? "change" : undefined}
      resetOnCancel
      resetOnAbort
      resetOnError
      onnavi_request_open={(e) => {
        const pickerEl = props.ref.current;
        const pickerInput = getPickerInput(pickerEl);
        if (!pickerInput) {
          e.preventDefault();
          return;
        }
        dispatchRequestInteraction(pickerInput, {
          event: e,
          name: "navi_request_open to show native picker",
          allowed: () => {
            try {
              pickerInput.showPicker();
            } catch {
              pickerInput.click();
            }
          },
        });
      }}
      eventReactionDefinitions={{
        click: (e) => {
          return {
            name: "click to show native picker",
            prevented: () => {
              e.preventDefault();
            },
            allowed: () => {
              const pickerEl = props.ref.current;
              const pickerInput = getPickerInput(pickerEl);
              // requestCloseValidityCallout(pickerEl, e);
              if (pickerInput.type === "color") {
                // nothing to do, color picker whole surface is opening the picker
              } else {
                // other picker might not open the picker when clicking the input surface (only the calendar picker for instance would open)
                pickerInput.showPicker();
              }
            },
          };
        },
      }}
    />
  );
};

const PickerCustom = (props) => {
  const { ref, mode: modeProp } = props;
  // Freeze the mode for the lifetime of an opening: compute it when closed,
  // keep it stable while open so a screen resize mid-session doesn't switch
  // between Popover and Dialog.
  const defaultModeRef = useRef(null);
  if (defaultModeRef.current === null) {
    const isSmallScreen = windowWidthSignal.peek() <= 600;
    const maxWidthPx = parseFloat(props.maxWidth);
    const isCompact = isFinite(maxWidthPx) && maxWidthPx < 150;
    defaultModeRef.current =
      modeProp ?? (isSmallScreen && !isCompact ? "dialog" : "popover");
  }
  const mode = defaultModeRef.current;

  const pickerProps = {
    ...props,
  };
  const popupProps = {};
  Object.assign(pickerProps, {
    popupProps,
    actionEvent: "custom",
  });
  // ref
  const popupRef = useRef(null);
  popupProps.ref = popupRef;
  // aria-controls + id
  id: {
    const popupId = useId();
    Object.assign(pickerProps, {
      "aria-controls": popupId,
    });
    Object.assign(popupProps, {
      id: popupId,
    });
  }
  // aria-expanded + open close + interactions to open close
  open_close: {
    const debugFocus = useDebugFocus();
    const debugPopup = useDebugPopup();
    const [expanded, setExpanded] = useState(false);
    const expandedRef = useRef(expanded);
    expandedRef.current = expanded;
    const valueAtOpenRef = useRef(null);
    const activeElementAtOpenRef = useRef(null);
    // Tracks whether a uiAction has occurred since the last close denial.
    // true  = no pending denial (initial state, or user has interacted since)
    // false = close was denied and user hasn't interacted yet
    // When false, a second close attempt is treated as cancel.
    const uiActionSinceDeniedRef = useRef(true);

    const onOpen = (e) => {
      expandedRef.current = true;
      setExpanded(true);
      uiActionSinceDeniedRef.current = true;

      const focusedBeforeOpen = e.detail.focusedBeforeOpen;
      activeElementAtOpenRef.current = focusedBeforeOpen;
      debugFocus(e, "picked opened, store element focused", focusedBeforeOpen);

      const valueAtOpen = getPickerInputUIState(ref.current);
      valueAtOpenRef.current = valueAtOpen;
      debugPopup(e, `picker opened, store value at open`, valueAtOpen);
    };
    const restoreFocus = (e) => {
      const activeElementAtOpen = activeElementAtOpenRef.current;
      activeElementAtOpenRef.current = null;

      const focusoutEvent = findEvent(e, "focusout");
      if (focusoutEvent) {
        debugFocus(e, `closed by focusout -> let focus go away`);
        return;
      }

      const mousedownEvent = findEvent(e, "mousedown");
      if (mousedownEvent) {
        debugFocus(
          e,
          "closed by mousedown -> prevent browser focus (mousedown.preventDefault())",
        );
        mousedownEvent.preventDefault();
      }
      debugFocus(
        e,
        `restore focus to previously focused element`,
        activeElementAtOpen,
      );
      activeElementAtOpen.focus({ preventScroll: true });
      return;
    };
    const onClose = (e) => {
      const mousedownEvent = findEvent(e, "mousedown");
      if (mousedownEvent) {
        debugPopup(e, `closed by mousedown -> disable next click`);
        disableClickFor();
      } else {
        const spaceEvent = findEvent(
          e,
          (e) => e.type === "keydown" && e.key === " ",
        );
        if (spaceEvent) {
          // space would trigger a click on the picker button causing it to re-open immediatly after closing
          debugPopup(e, `closed by space key -> prevent browser click`);
          // browser won't try to dispatch click
          // and our "space_to_open" will see e.defaultPrevented too and won't try to open picker
          spaceEvent.preventDefault();
        }
      }
      expandedRef.current = false;
      setExpanded(false);
      // Reset so the next opening re-evaluates screen size
      defaultModeRef.current = null;
      restoreFocus(e);
    };
    const disableClickFor = useIgnoreClickForMousedown(ref, (e) => {
      debugPopup(e, `click ignored`);
    });
    const requestOpen = (e) => {
      // scroll <button> of the picker into view when opening it
      const pickerEl = ref.current;
      pickerEl.scrollIntoView({ block: "nearest" });
      const popupEl = popupRef.current;
      return dispatchCustomEvent(popupEl, "navi_request_open", {
        event: e,
        anchor: pickerEl,
      });
    };
    const requestClose = (
      e = new CustomEvent("programmatic"),
      { isCancel = false } = {},
    ) => {
      const popupEl = popupRef.current;
      return dispatchCustomEvent(popupEl, "navi_request_close", {
        event: e,
        isCancel,
      });
    };

    const requestInteraction = (options) => {
      dispatchRequestInteraction(ref.current, options);
    };

    const { onActionStart, children, uiAction: uiActionProp } = props;
    Object.assign(pickerProps, {
      "aria-expanded": expanded,
      "onActionStart": (e) => {
        onActionStart?.(e);
        // requestClose(e);
      },
      "onnavi_request_open": (e) => {
        if (expandedRef.current) {
          return;
        }
        requestInteraction({
          event: e,
          name: "navi_request_open_event",
          allowed: () => {
            requestOpen(e);
          },
        });
      },
      "onnavi_request_close": (e) => {
        requestInteraction({
          event: e,
          allowed: () => {
            requestClose(e);
          },
        });
      },
      // Intercept uiAction to detect user interaction after a close denial.
      "uiAction": (v, e) => {
        uiActionSinceDeniedRef.current = true;
        uiActionProp?.(v, e);
      },
      children,
    });
    Object.assign(popupProps, {
      closeRequestHandler: (requestCloseEvent, closePermission) => {
        const cancelEvent = findEvent(
          requestCloseEvent,
          (eInChain) =>
            eInChain.type === "navi_request_close" && eInChain.detail.isCancel,
        );
        const isCancel = Boolean(cancelEvent);
        const pickerEl = ref.current;
        const inputEl = getPickerInput(pickerEl);
        const valueAtOpen = valueAtOpenRef.current;

        if (isCancel) {
          uiActionSinceDeniedRef.current = true;
          dispatchRequestSetUIState(inputEl, valueAtOpen, {
            event: requestCloseEvent,
          });
          return;
        }

        // If close was previously denied and the user hasn't interacted since,
        // treat this re-attempt as a cancel so they are not trapped.
        if (!uiActionSinceDeniedRef.current) {
          debugPopup(
            requestCloseEvent,
            `picker close was denied and user did not interact, treating re-attempt as cancel (restoring ${JSON.stringify(valueAtOpen)})`,
          );
          uiActionSinceDeniedRef.current = true;
          dispatchRequestSetUIState(inputEl, valueAtOpen, {
            event: requestCloseEvent,
          });
          return;
        }

        const valueAtClose = getPickerInputUIState(pickerEl);
        if (compareTwoJsValues(valueAtClose, valueAtOpen)) {
          debugPopup(
            requestCloseEvent,
            `picker closed with same value as when it opened (${JSON.stringify(valueAtClose)}), no action dispatched`,
          );
          return;
        }
        debugPopup(
          requestCloseEvent,
          `picker attempt to close with value (${JSON.stringify(valueAtClose)}) wait for picker action to close picker`,
        );
        dispatchRequestAction(inputEl, {
          event: requestCloseEvent,
          name: "picker close",
          prevented: () => {
            closePermission.deny();
          },
          // Always report validation when the picker tries to close so the
          // user sees what is wrong, even if the picker has no action prop.
          reportOnInvalid: true,
          onInvalid: () => {
            uiActionSinceDeniedRef.current = false;
            closePermission.deny();
          },
          allowed: () => {},
        });
      },
      onnavi_open: (e) => {
        onOpen(e);
      },
      onnavi_close: (e) => {
        onClose(e);
      },
    });

    interactions: {
      const onKeyDownShortcuts = createOnKeyDownForShortcuts({
        "a-z": (e) => {
          return {
            name: "letter key to open",
            allowed: () => {
              requestOpen(e);
            },
          };
        },
        "0-9": (e) => {
          return {
            name: "numeric key to open",
            allowed: () => {
              requestOpen(e);
            },
          };
        },
        "arrowdown": (e) => {
          return {
            name: "arrow_down_to_open",
            allowed: () => {
              requestOpen(e);
              e.preventDefault(); // prevent container scroll
            },
          };
        },
        "arrowup": (e) => {
          return {
            name: "arrow_up_to_open",
            allowed: () => {
              requestOpen(e);
              e.preventDefault(); // prevent container scroll
            },
          };
        },
        "space": (e) => {
          return {
            name: "space_to_open",
            allowed: () => {
              requestOpen(e);
              e.preventDefault(); // prevent scroll
            },
          };
        },
        "escape": (e) => {
          if (!expandedRef.current) {
            return null;
          }
          return {
            name: "escape_to_cancel",
            allowed: () => {
              requestClose(e, { isCancel: true });
              e.preventDefault(); // prevent browser from closing the dialog (if any)
            },
          };
        },
      });

      Object.assign(pickerProps, {
        eventReactionDefinitions: {
          mouseDown: (e) => {
            if (expandedRef.current) {
              return {
                name: "mousedown to close picker",
                allowed: () => requestClose(e),
              };
            }
            return {
              name: "mousedown to open picker",
              allowed: () => {
                debugFocus(
                  e,
                  `prevent browser giving focus to button (mousedown.preventDefault())`,
                );
                requestOpen(e);
                e.preventDefault(); // prevent browser trying to give focus to the select (popover will take focus)
              },
            };
          },
          click: (e) => {
            // When a label is clicked it transfers focus to the select
            // in that case we want to open it (otherwise we have already opened on mousedown interaction)
            return {
              name:
                e.detail === 0
                  ? "click (keyboard or progammatic) to open picker"
                  : "click to open picker",
              allowed: () => {
                requestOpen(e);
                e.preventDefault();
              },
            };
          },
          keyDown: (e) => {
            return onKeyDownShortcuts(e);
          },
        },
      });
      Object.assign(popupProps, {
        onMouseDown: (e) => {
          if (e.button !== 0) {
            return;
          }
          // mousedown inside popover should not bubble to the select (would re-open it if that mousedown closes it)
          debugPopup(
            e,
            `"mousedown" received on popup -> prevent bubbling to picker (e.stopPropagation())`,
          );
          e.stopPropagation();
        },
        onClick: (e) => {
          if (e.button !== 0) {
            return;
          }
          // click inside popover should not bubble to the picker (would re-open it if that click closes it)
          debugPopup(
            e,
            `"click" received on popup -> prevent bubbling to picker (e.stopPropagation())`,
          );
          e.stopPropagation();
          // Here we can't preventDefault because the click might be needed to check a radio for instance.
          // As a result we have to let it go through which means it could trigger form submission
          // but we've put type="button" on the picker to ensure it can't submit the form
          // so browser won't submit eventual form for clicks inside the popover/dialog
          // e.preventDefault();
        },
        onKeyDown: (e) => {
          // some keys pressed inside popover should not reach the picker button
          // (like enter that would try to request action of closest form otherwise for instance)
          if (e.key === "Enter") {
            debugPopup(
              e,
              `"enter" received on popup -> prevent bubbling to picker (e.stopPropagation())`,
            );
            e.stopPropagation();
            // preventDefault prevents the browser from dispatching a "click" on the
            // picker button when focus moves to it synchronously during enterEffect
            e.preventDefault();
          }
        },
      });
    }
  }

  if (mode === "popover") {
    return <PickerContentInsidePopover {...pickerProps} />;
  }
  if (mode === "dialog") {
    return <PickerContentInsideDialog {...pickerProps} />;
  }
  return null;
};

const getPickerInput = (pickerEl) => {
  return pickerEl.querySelector(".navi_picker_input");
};
const getPickerInputUIState = (pickerEl) => {
  const pickerInput = getPickerInput(pickerEl);
  return getUIStateFromElement(pickerInput);
};

const PickerContentInsidePopover = (props) => {
  const Next = useNextResolver();
  import.meta.css = css;
  const {
    popupProps,
    children,
    pointerTrap,
    scrollTrap,
    focusTrap = true,
    popoverMode = "nearby",
    popoverSpacing = popoverMode === "nearby" ? 5 : 0,
    viewportSpacing = 10,
    closeOnFocusOut = false,
    ...rest
  } = props;

  return (
    <Next
      aria-haspopup="listbox"
      navi-popover-mode={popoverMode}
      {...rest}
      onFocusOut={(e) => {
        if (!closeOnFocusOut) {
          return;
        }
        // Close when focus leaves the select entirely (not just moving between internal elements).
        // relatedTarget is the element receiving focus; if it's inside the select or the popover, keep open.
        const relatedTarget = e.relatedTarget;
        const pickerEl = props.ref.current;
        const popoverEl = popupProps.ref.current;
        const focusStaysInside =
          (pickerEl && pickerEl.contains(relatedTarget)) ||
          (popoverEl && popoverEl.contains(relatedTarget));
        if (focusStaysInside) {
          return;
        }
        dispatchRequestInteraction(pickerEl, {
          event: e,
          name: "blur",
          category: "interaction",
          allowed: () => {
            dispatchCustomEvent(popoverEl, "navi_request_close", { event: e });
          },
        });
      }}
    >
      <Popover
        {...popupProps}
        className="navi_picker_popover"
        positionX="left-aligned"
        positionY={popoverMode === "nearby" ? "below" : "below-overlap"}
        spacing={popoverSpacing}
        viewportSpacing={viewportSpacing}
        scrollTrap={scrollTrap}
        pointerTrap={pointerTrap}
        focusTrap={focusTrap}
        /* make popover focusable so it can be the first focus target when opening */
        tabIndex={-1}
        autoFocus="fallback"
      >
        {/* In "attached" mode clone the trigger visually so the popover wraps both the trigger
            and the list with a unified border/shadow. The clone is not
            interactive — the real trigger behind it handles all events. */}
        {popoverMode === "attached" ? (
          <div
            className="navi_picker_anchor_clone"
            onMouseDown={(e) => {
              if (e.button !== 0) {
                return;
              }
              const popupEl = popupProps.ref.current;
              dispatchCustomEvent(popupEl, "navi_request_close", { event: e });
            }}
          >
            {props.trigger}
          </div>
        ) : null}
        {children}
      </Popover>
    </Next>
  );
};

const PickerContentInsideDialog = (props) => {
  const Next = useNextResolver();
  import.meta.css = css;
  const { popupProps, children, scrollTrap, pointerTrap, ...rest } = props;

  return (
    <Next aria-haspopup="dialog" {...rest}>
      <Dialog
        {...popupProps}
        className="navi_picker_dialog"
        scrollTrap={scrollTrap}
        pointerTrap={pointerTrap}
        centerInVisualViewport
        autoFocus="fallback"
      >
        {children}
      </Dialog>
    </Next>
  );
};

/**
 * Returns a `disableClickFor` function that suppresses the next `click` event
 * that lands on a specific element after a `mousedown` already handled an
 * open/close action.
 *
 * Problem: when the popover backdrop closes on mousedown, the browser then
 * dispatches a `click` on whatever element is under the pointer. If that element
 * is the picker button, it would immediately re-open the picker.
 *
 * We cannot call `stopPropagation()` or `preventDefault()` on the backdrop
 * `mousedown` to prevent that click — the browser dispatches it regardless.
 *
 * Solution: register a self-removing capture-phase `click` listener on `document`
 * and suppress the click only if it lands inside the given element (the picker
 * button). Clicks on any other element (e.g. a submit button) pass through
 * normally.
 *
 * Note: the popover backdrop stays in the DOM (with pointer-events:none) so that
 * the browser always finds a target for the mousedown → click sequence. If the
 * backdrop were removed from the DOM between mousedown and mouseup, the browser
 * would not dispatch a click at all, which would leave this listener armed
 * forever and cause it to swallow the next unrelated user click.
 */
const useIgnoreClickForMousedown = (elementRef, onIgnore) => {
  const disableClickFor = () => {
    const suppressClick = (clickEvent) => {
      document.removeEventListener("click", suppressClick, { capture: true });
      const el = elementRef.current;
      if (!el || !el.contains(clickEvent.target)) {
        // Click landed outside the element we are guarding — let it through.
        return;
      }
      clickEvent.stopPropagation();
      clickEvent.preventDefault();
      onIgnore?.(clickEvent);
    };
    document.addEventListener("click", suppressClick, { capture: true });
  };
  return disableClickFor;
};

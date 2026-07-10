import { dispatchCustomEvent } from "@jsenv/dom";
import { useContext, useId, useRef } from "preact/hooks";

import { createOnKeyDownForShortcuts } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { useNavState } from "@jsenv/navi/src/nav/browser_integration/browser_integration.js";
import { useDebugFocus, useDebugPopup } from "@jsenv/navi/src/navi_debug.jsx";
import {
  useOpenController,
  useOpenPropsEffectOnOpenController,
} from "@jsenv/navi/src/popup/open_controller.js";
import { Popup, usePopupMode } from "@jsenv/navi/src/popup/popup.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { compareTwoJsValues } from "../../utils/compare_two_js_values.js";
import { ControlIdContext } from "../control_context.js";
import { dispatchRequestAction } from "../rules/control_action.js";
import { dispatchRequestInteraction } from "../rules/control_interaction.js";
import {
  dispatchRequestSetUIState,
  getUIStateFromElement,
} from "../ui_state_dom.js";

const css = /* css */ `
  .navi_picker {
    /* Sizing ceilings (maxmax), background, box-shadow, outline, padding,
       overflow... are already handled correctly by Popup/Popover/Dialog
       themselves — nothing to redefine here. Only the picker's own look
       (border color/radius/width, background) needs bridging into the vars
       Popover/Dialog actually consume, plus a couple of genuinely
       picker-specific bits below (anchor-width min-width, the anchor clone,
       the nested list). */

    /* popover */
    &[aria-haspopup="listbox"] {
      .navi_popover {
        --popover-border-radius: var(--picker-border-radius);
        --popover-border-width: var(--picker-border-width);
        --popover-border-color: var(--x-picker-border-color);
        --popover-background-color: var(--picker-background-color);
        --popover-outline-width: var(--picker-outline-width);
        --popover-outline-color: var(--picker-outline-color);

        min-width: var(--anchor-width, 0px);
        cursor: default; /* Reset pointer cursor within the select */

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

        &[data-position-y-current="top"],
        &[data-position-y-current="inset-bottom"] {
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
      }

      &[aria-expanded="true"] {
        &[navi-popover-mode="overlay"],
        &[navi-popover-mode="attached"] {
          /* When sizes uses float AND the border uses border-radius it's possible it's possible to see some pixels
          of the underlying select borders. We hide them to ensure this cannot happen.  */
          border-color: transparent;
        }

        /* Popover itself has no opinion on its content's own layout (plain
           div, block by default) — the picker's content (anchor clone +
           list) needs to stack vertically. */
        .navi_popover {
          display: flex;
          flex-direction: column;
        }
      }
    }

    /* dialog */
    &[aria-haspopup="dialog"] {
      .navi_dialog {
        --dialog-border-radius: var(--picker-border-radius);
        --dialog-border-color: var(--x-picker-border-color);
        --dialog-background-color: var(--picker-background-color);
        --dialog-outline-width: var(--picker-outline-width);
        --dialog-outline-color: var(--picker-outline-color);

        /* Dialog itself already sizes min-width off --anchor-width — only
           the cursor reset below is picker-specific here. */
        cursor: default; /* Reset pointer cursor within the select */

        /* Dialog already applies display: flex to [open] itself, but
           defaults to row — the picker's content needs to stack vertically. */
        &[open] {
          flex-direction: column;
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
  import.meta.css = css;

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
          prevented: () => {
            e.preventDefault();
          },
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
              if (pickerInput.type === "color") {
                // nothing to do, color picker whole surface is opening the picker
              } else {
                // other picker might not open the picker when clicking the input surface (only the calendar picker for instance would open)
                try {
                  pickerInput.showPicker();
                } catch {
                  pickerInput.click();
                }
              }
            },
          };
        },
      }}
    />
  );
};

const PickerCustom = (props) => {
  const { ref, mode: modeProp, open, defaultOpen } = props;
  // Resolve the id the same way useControlProps does (own id > Field's id > generated id)
  // before computing popupId below, so two Pickers without an explicit id never collide.
  // Captured before the fallback chain below overwrites props.id — needed to
  // know whether the id actually came from the caller (stable) or from
  // useId()/ControlIdContext (not guaranteed stable across a reload), see
  // pickerNavType below.
  const hasExplicitId = Boolean(props.id);
  const idDefault = useId();
  const controlId = useContext(ControlIdContext);
  props.id = props.id || controlId || idDefault;
  // Same small-screen/maxWidth-compact heuristic Popup itself uses (see
  // popup.jsx's own usePopupMode) — frozen for the lifetime of an opening
  // (computed when closed, stable while open, so a screen resize mid-session
  // doesn't switch between Popover and Dialog), with resetMode called from
  // this picker's own onClose below to re-evaluate on the *next* open.
  const [mode, resetMode] = usePopupMode(modeProp, props.maxWidth);

  const pickerProps = {
    ...props,
  };
  // Consumed right here (useNavState's own defaultValue above) — not a
  // real DOM/Popup prop, so it must not travel any further down (would
  // otherwise leak through PickerContentInsidePopup's own ...rest).
  delete pickerProps.open;
  delete pickerProps.defaultOpen;
  const popupProps = {};
  Object.assign(pickerProps, {
    popupProps,
    actionEvent: "custom",
  });
  // ref
  const popupRef = useRef(null);
  popupProps.ref = popupRef;
  // aria-controls + id
  const popupId = `${props.id}_picker_popup`;
  id: {
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
    // In "dialog" mode with a stable, caller-provided id, enterExpanded()
    // pushes a history entry so the back button closes it. Every other case
    // (popover mode, or a dialog whose id was auto-generated via useId()/
    // ControlIdContext) replaces the current history state instead — a
    // generated id isn't stable across a reload, so pushing it would either
    // silently drop the entry or, worse, collide with a different
    // component's own generated id (see useNavState's own fallback for the
    // same concern, applied here proactively for the id we control).
    const pickerNavType =
      mode === "dialog" && hasExplicitId ? "push" : "replace";
    const [expanded, enterExpanded, leaveExpanded] = useNavState(popupId, {
      type: pickerNavType,
      defaultValue: open || defaultOpen ? "on" : undefined,
      // onLeave fires only when the state key disappears externally (back button/gesture most of the time).
      onLeave: () => {
        requestClose(new CustomEvent("navi_nav_away", { detail: {} }), {
          isCancel: true,
        });
      },
    });
    // openController centralizes open/close decision-making (validation,
    // focus and value bookkeeping) for the picker. The returned
    // { onRequestClose, onClose } pair is the picker's reaction to close
    // requests — see createOpenController below for the full contract.
    const openController = useOpenController((openEvent) => {
      enterExpanded();

      const valueAtOpen = getPickerInputUIState(ref.current);
      debugPopup(openEvent, `picker opened, store value at open`, valueAtOpen);

      return {
        onRequestClose: (requestCloseEvent) => {
          if (requestCloseEvent.detail.isCancel) {
            // Cancelling always succeeds — nothing to validate.
            return;
          }
          const pickerEl = ref.current;
          const inputEl = getPickerInput(pickerEl);
          const valueAtClose = getUIStateFromElement(inputEl);
          if (compareTwoJsValues(valueAtClose, valueAtOpen)) {
            // Value unchanged — no action to run, but still allow the close.
            return;
          }

          dispatchRequestAction(inputEl, {
            event: requestCloseEvent,
            name: "picker request close",
            prevented: () => {
              requestCloseEvent.preventDefault();
            },
            // Always report validation when the picker tries to close so the
            // user sees what is wrong, even if the picker has no action prop.
            reportOnInvalid: true,
            onInvalid: () => {
              requestCloseEvent.preventDefault();
            },
          });
        },
        onClose: (closeEvent) => {
          if (closeEvent.detail.isCancel) {
            const pickerEl = ref.current;
            const inputEl = getPickerInput(pickerEl);
            debugPopup(
              closeEvent,
              `picker cancel, restoring value at open ${JSON.stringify(valueAtOpen)}`,
            );
            dispatchRequestSetUIState(inputEl, valueAtOpen, {
              event: closeEvent,
            });
          }
          leaveExpanded({ isBack: closeEvent.detail.isCancel });
          // Reset so the next opening re-evaluates screen size
          resetMode();
        },
      };
    });
    // scroll <button> of the picker into view when opening it
    // -> would be overriden by dialog.jsx or popover.jsx
    // so ideally openEffect should be either protective or a pubSub to allow multiple callbacks
    // openController.openEffect = () => {
    //   const pickerEl = ref.current;
    //   pickerEl.scrollIntoView({ block: "nearest" });
    // };
    const requestOpen = openController.open;
    const requestClose = openController.requestClose;
    // Same skip-if-already-matching / open-or-requestClose control flow as
    // useOpenControllerByProps (see open_controller.js) — the picker's own
    // "open" comes from history state (expanded) rather than a literal
    // `open` prop, so it adapts requestOpen/requestClose to the shape that
    // hook expects instead of driving openController directly.
    useOpenPropsEffectOnOpenController(openController, {
      open: Boolean(expanded),
    });

    const requestInteraction = (options) => {
      dispatchRequestInteraction(ref.current, options);
    };

    const { onActionStart, children, uiAction: uiActionProp } = props;
    Object.assign(pickerProps, {
      "aria-expanded": Boolean(expanded),
      "onActionStart": (e) => {
        onActionStart?.(e);
        // requestClose(e);
      },
      "uiAction": (v, e) => {
        uiActionProp?.(v, e);
      },
      // The picker's own trigger also carries aria-expanded, so
      // resolveClosestExpandable() in commands.js can resolve *it* (not the
      // popup) as the target — e.g. a --navi-open/--navi-close/--navi-toggle
      // command whose source sits inside the trigger but outside the popup's
      // own content. Forward the request down to the popup so its
      // openController (registered above via onnavi_request_open/close on
      // popupProps) is the single place actually deciding open/close.
      "onnavi_request_open": (e) => {
        dispatchCustomEvent(popupRef.current, "navi_request_open", e.detail);
      },
      "onnavi_request_close": (e) => {
        dispatchCustomEvent(popupRef.current, "navi_request_close", e.detail);
      },
      children,
    });
    Object.assign(popupProps, {
      anchor: props.ref,
      openController,
      // Not on pickerProps (the trigger): commands.js's own
      // resolveClosestExpandable() does `el.closest("[aria-expanded]")` to
      // find where to dispatch navi_request_open/navi_request_close — and
      // the popup itself now carries its own aria-expanded (see
      // popover.jsx/dialog.jsx), which is *closer* than the picker's own
      // aria-expanded for anything dispatched from inside the popup's own
      // content (e.g. a `command="--navi-close"` button rendered as
      // children here). That command lands on the popup element, not the
      // picker — so these listeners have to live here to ever see it.
      onnavi_request_open: (e) => {
        if (openController.opened) {
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
      onnavi_request_close: (e) => {
        requestInteraction({
          event: e,
          allowed: () => {
            requestClose(e, { isCancel: e.detail.isCancel });
          },
        });
      },
    });

    interactions: {
      const isWithinPickerContent = (el) => {
        const pickerEl = ref.current;
        const pickerContentEl = pickerEl.querySelector(".navi_picker_content");
        return pickerContentEl?.contains(el);
      };

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
        "enter": (e) => {
          if (isWithinPickerContent(e.target)) {
            // Enter within popup should not try to re-open it
            // (enter within input would close popup and this one would try to re-open it)
            return null;
          }
          return {
            name: "enter_to_open",
            allowed: () => {
              requestOpen(e);
              e.preventDefault(); // prevent form submission
            },
          };
        },
        "escape": (e) => {
          if (!openController.opened) {
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
            if (isWithinPickerContent(e.target)) {
              return null;
            }
            if (openController.opened) {
              return {
                name: "mousedown to close picker",
                allowed: () => requestClose(e, { isCancel: true }),
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
            if (isWithinPickerContent(e.target)) {
              return null;
            }
            // When a label is clicked it transfers focus to the select
            // in that case we want to open it (otherwise we have already opened on mousedown interaction)
            return {
              name:
                e.detail === 0
                  ? "click (keyboard or progammatic) to open picker"
                  : "click to open picker",
              prevented: () => {
                e.preventDefault();
              },
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
    }
  }

  return <PickerContentInsidePopup {...pickerProps} mode={mode} />;
};

const getPickerInput = (pickerEl) => {
  return pickerEl.querySelector(".navi_picker_input");
};
const getPickerInputUIState = (pickerEl) => {
  const pickerInput = getPickerInput(pickerEl);
  return getUIStateFromElement(pickerInput);
};

const PickerContentInsidePopup = (props) => {
  const Next = useNextResolver();
  const {
    popupProps,
    children,
    mode,
    pointerLock,
    scrollCapture,
    // No default here (matches Popover's own default of inactive) — the
    // old, differently-named `focusTrap = true` prop never actually reached
    // Popover's real `focusCapture` prop (see this file's history), so
    // focus-trapping has never really been active for popover-mode pickers;
    // defaulting the now-correctly-named prop to `true` would be a real,
    // unintended behavior change riding along with the rename.
    focusCapture,
    popoverMode = "nearby",
    popoverSpacing = popoverMode === "nearby" ? 5 : 0,
    marginWithContainer = 10,
    closeOnFocusOut = false,
    dialogExpand,
    dialogExpandX,
    dialogExpandY,
    ...rest
  } = props;
  const isPopover = mode === "popover";
  const expandX = dialogExpand || dialogExpandX;
  const expandY = dialogExpand || dialogExpandY;

  return (
    <Next
      aria-haspopup={isPopover ? "listbox" : "dialog"}
      navi-popover-mode={isPopover ? popoverMode : undefined}
      {...rest}
      onFocusOut={(e) => {
        if (!isPopover || !closeOnFocusOut) {
          return;
        }
        // Close when focus leaves the select entirely (not just moving between internal elements).
        // relatedTarget is the element receiving focus; if it's inside the select or the popup, keep open.
        const relatedTarget = e.relatedTarget;
        const pickerEl = props.ref.current;
        const popupEl = popupProps.ref.current;
        const focusStaysInside =
          (pickerEl && pickerEl.contains(relatedTarget)) ||
          (popupEl && popupEl.contains(relatedTarget));
        if (focusStaysInside) {
          return;
        }
        dispatchRequestInteraction(pickerEl, {
          event: e,
          name: "blur",
          category: "interaction",
          allowed: () => {
            popupProps.openController.requestClose(e, { isCancel: true });
          },
        });
      }}
    >
      <Popup
        {...popupProps}
        mode={mode}
        positionArea={
          isPopover
            ? popoverMode === "nearby"
              ? "bottom-start"
              : "inset(top-left)"
            : undefined
        }
        marginWithAnchor={isPopover ? popoverSpacing : undefined}
        marginWithContainer={isPopover ? marginWithContainer : undefined}
        scrollCapture={scrollCapture}
        pointerInteractionOutsideEffect={pointerLock ? "capture" : "close"}
        focusCapture={isPopover ? focusCapture : undefined}
        expandX={!isPopover ? expandX : undefined}
        expandY={!isPopover ? expandY : undefined}
      >
        {/* In "attached" mode clone the trigger visually so the popup wraps both the trigger
            and the list with a unified border/shadow. The clone is not
            interactive — the real trigger behind it handles all events. */}
        {isPopover && popoverMode === "attached" ? (
          <div
            className="navi_picker_anchor_clone"
            onMouseDown={(e) => {
              if (e.button !== 0) {
                return;
              }
              popupProps.openController.requestClose(e, { isCancel: true });
            }}
          >
            {props.trigger}
          </div>
        ) : null}
        {children}
      </Popup>
    </Next>
  );
};

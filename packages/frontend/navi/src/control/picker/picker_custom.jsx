import { useContext, useId, useLayoutEffect, useRef } from "preact/hooks";

import { createOnKeyDownForShortcuts } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { windowWidthSignal } from "@jsenv/navi/src/layout/responsive.js";
import { useNavState } from "@jsenv/navi/src/nav/browser_integration/browser_integration.js";
import { useDebugFocus, useDebugPopup } from "@jsenv/navi/src/navi_debug.jsx";
import { Dialog } from "@jsenv/navi/src/popup/dialog.jsx";
import { useOpenController } from "@jsenv/navi/src/popup/open_controller.js";
import { Popover } from "@jsenv/navi/src/popup/popover.jsx";
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
    /* Shared by popover and dialog */
    --picker-popup-background-color: var(--picker-background-color);
    --picker-popup-border-radius: var(--picker-border-radius);
    --picker-popup-border-width: var(--picker-border-width);
    /* Popover */
    --picker-popover-max-height: 300px; /* soft: user-configurable preferred max-height */
    --picker-popover-maxmax-height: calc(0.95 * var(--navi-vvh));
    --picker-popover-maxmax-width: calc(0.95 * var(--navi-vvw));
    /* --picker-popover-max-width: soft, leave unset to rely on maxmax */
    /* Dialog */
    --picker-dialog-margin: 3dvw; /* min gap between dialog edges and viewport */
    --picker-dialog-maxmax-width: calc(
      var(--navi-vvw) - 2 * var(--picker-dialog-margin)
    );
    --picker-dialog-maxmax-height: calc(
      var(--navi-vvh) - 2 * var(--picker-dialog-margin)
    );
    --picker-dialog-border-width: 0px; /* Dialog do not need border like popover (they stand out more) */

    /* popover */
    &[aria-haspopup="listbox"] {
      .navi_picker_popover {
        position: absolute;
        inset: unset;
        min-width: var(--anchor-width, 0px);
        max-width: min(
          var(--picker-popover-max-width, var(--picker-popover-maxmax-width)),
          var(--picker-popover-maxmax-width)
        );
        /* max-height covers the placeholder + list; the list scrolls internally */
        max-height: min(
          var(--picker-popover-max-height),
          var(--space-available, var(--picker-popover-maxmax-height)),
          var(--picker-popover-maxmax-height)
        );
        margin: 0;
        padding: 0;
        background: var(--picker-popup-background-color);
        border-width: var(--picker-border-width);
        border-style: solid;
        border-color: var(--x-picker-border-color);
        border-radius: var(--picker-popup-border-radius);
        outline-width: var(--picker-outline-width);
        outline-color: var(--picker-outline-color);
        outline-offset: 0px;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.08),
          0 12px 40px rgba(0, 0, 0, 0.22);
        cursor: default; /* Reset pointer cursor within the select */
        overflow: auto;
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
        &[data-position-y-current="aligned-bottom"] {
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
            var(--picker-popup-border-radius) - var(--picker-border-width)
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
        max-width: min(
          var(--picker-dialog-max-width, var(--picker-dialog-maxmax-width)),
          var(--picker-dialog-maxmax-width)
        );
        max-height: min(
          var(--picker-dialog-max-height, var(--picker-dialog-maxmax-height)),
          var(--picker-dialog-maxmax-height)
        );
        padding: 0;
        background: var(--picker-popup-background-color);
        border: var(--picker-dialog-border-width) solid
          var(--x-picker-border-color);
        border-radius: var(--picker-popup-border-radius);
        outline-width: var(--picker-outline-width);
        outline-color: var(--picker-outline-color);
        outline-offset: 0;
        box-shadow:
          0 4px 8px rgba(0, 0, 0, 0.08),
          0 12px 40px rgba(0, 0, 0, 0.22);
        cursor: default; /* Reset pointer cursor within the select */
        /* overscroll-behavior: contain; */

        &[data-expand-x] {
          width: var(--picker-dialog-maxmax-width);
        }
        &[data-expand-y] {
          height: var(--picker-dialog-maxmax-height);
        }

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
          var(--picker-popup-border-radius) - var(--picker-border-width)
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
  const { ref, mode: modeProp } = props;
  // Resolve the id the same way useControlProps does (own id > Field's id > generated id)
  // before computing popupId below, so two Pickers without an explicit id never collide.
  const idDefault = useId();
  const controlId = useContext(ControlIdContext);
  props.id = props.id || controlId || idDefault;
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
    // In "dialog" mode, enterExpanded() pushes a history entry so the back button closes.
    // In "popover" mode, it replaces the current history state (no history entry added).
    const pickerNavType = mode === "dialog" ? "push" : "replace";
    const [expanded, enterExpanded, leaveExpanded] = useNavState(popupId, {
      type: pickerNavType,
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

      const focusedBeforeOpen = openEvent.detail.focusedBeforeOpen;
      debugFocus(
        openEvent,
        "picked opened, store element focused",
        focusedBeforeOpen,
      );
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
          defaultModeRef.current = null;
        },
      };
    });
    const requestOpen = (e, detail) => {
      // scroll <button> of the picker into view when opening it
      const pickerEl = ref.current;
      pickerEl.scrollIntoView({ block: "nearest" });
      openController.open(e, detail);
    };
    const requestClose = openController.requestClose;

    const open = Boolean(expanded);
    useLayoutEffect(() => {
      if (open === undefined) {
        return;
      }
      // Skip when the popup is already in the desired state.
      // openController.opened tracks actual open/close (updated by onopen/onclose,
      // not by renders) so it is the authoritative check against feedback loops.
      if (open === openController.opened) {
        return;
      }
      // open_prop_change means the parent is driving the open state directly
      // (e.g. back-button navigation flipped openProp to false before onLeave fires).
      // Always treat it as cancel — the user's in-progress edit should be discarded.
      if (open) {
        requestOpen(new CustomEvent("open_by_prop", { detail: {} }), {
          isCancel: true,
        });
      } else {
        requestClose(new CustomEvent("close_by_prop", { detail: {} }), {
          isCancel: true,
        });
      }
    }, [open]);

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
      "onnavi_request_open": (e) => {
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
      "onnavi_request_close": (e) => {
        requestInteraction({
          event: e,
          allowed: () => {
            requestClose(e, { isCancel: e.detail.isCancel });
          },
        });
      },
      "uiAction": (v, e) => {
        uiActionProp?.(v, e);
      },
      children,
    });
    Object.assign(popupProps, {
      anchor: props.ref,
      openController,
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
        "enter": (e) => {
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

      const isWithinPopup = (el) => {
        const popupEl = popupRef.current;
        return el === popupEl || popupEl.contains(el);
      };

      Object.assign(pickerProps, {
        eventReactionDefinitions: {
          mouseDown: (e) => {
            if (isWithinPopup(e.target)) {
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
            if (isWithinPopup(e.target)) {
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
  const {
    popupProps,
    children,
    pointerLock,
    scrollLock,
    focusTrap = true,
    popoverMode = "nearby",
    popoverSpacing = popoverMode === "nearby" ? 5 : 0,
    containerSpacing = 10,
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
            popupProps.openController.requestClose(e, { isCancel: true });
          },
        });
      }}
    >
      <Popover
        {...popupProps}
        className="navi_picker_popover"
        anchorArea={
          popoverMode === "nearby"
            ? "below aligned-left"
            : "aligned-top aligned-left"
        }
        anchorSpacing={popoverSpacing}
        containerSpacing={containerSpacing}
        scrollLock={scrollLock}
        pointerInteractionOutsideEffect={pointerLock ? "capture" : "close"}
        focusTrap={focusTrap}
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
              popupProps.openController.requestClose(e, { isCancel: true });
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
  const {
    popupProps,
    children,
    scrollLock,
    pointerLock,
    dialogExpand,
    dialogExpandX,
    dialogExpandY,
    ...rest
  } = props;
  const expandX = dialogExpand || dialogExpandX;
  const expandY = dialogExpand || dialogExpandY;

  return (
    <Next aria-haspopup="dialog" {...rest}>
      <Dialog
        {...popupProps}
        className="navi_picker_dialog"
        scrollLock={scrollLock}
        pointerInteractionOutsideEffect={pointerLock ? "capture" : "close"}
        centerInVisualViewport
        data-expand-x={expandX ? "" : undefined}
        data-expand-y={expandY ? "" : undefined}
      >
        {children}
      </Dialog>
    </Next>
  );
};

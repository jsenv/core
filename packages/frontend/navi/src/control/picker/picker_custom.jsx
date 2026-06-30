import { chainEvent, findEvent } from "@jsenv/dom";
import { useLayoutEffect, useRef } from "preact/hooks";

import { createOnKeyDownForShortcuts } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { windowWidthSignal } from "@jsenv/navi/src/layout/responsive.js";
import { useNavState } from "@jsenv/navi/src/nav/browser_integration/browser_integration.js";
import { useDebugFocus, useDebugPopup } from "@jsenv/navi/src/navi_debug.jsx";
import { Dialog } from "@jsenv/navi/src/popup/dialog.jsx";
import { Popover } from "@jsenv/navi/src/popup/popover.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { useStableCallback } from "@jsenv/navi/src/utils/use_stable_callback.js";
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

    const disableClickFor = useIgnoreClickForMousedown(ref, (e) => {
      debugPopup(e, `click ignored`);
    });
    // openController centralizes the open/close decision-making (guards,
    // validation, focus/value bookkeeping) here in the picker. Dialog/Popover
    // only provide the DOM-specific "how to actually open/close" (registered via
    // openController.onopen, returning its own close callback) — no more
    // navi_open/navi_close/navi_request_open/navi_request_close round-trip
    // through DOM events.
    // openHandler's return value is { requestClose, close } (CloseWatcher-ish,
    // see https://developer.mozilla.org/en-US/docs/Web/API/CloseWatcher):
    // - requestClose(e): about to close — call e.preventDefault() to stay open
    //   (validation lives here, replacing the old closeRequestHandler).
    // - close(e): actually closing, not preventable — final reactions live here
    //   (replacing the old onClosed). Runs whether we got here through
    //   requestClose() being granted, or through forceClose() skipping it
    //   entirely (e.g. the popup unmounting).
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

          prevent_reopen: {
            const mousedownEvent = findEvent(closeEvent, "mousedown");
            if (mousedownEvent) {
              debugPopup(
                closeEvent,
                `closed by mousedown -> disable next click`,
              );
              disableClickFor();
            } else {
              const spaceEvent = findEvent(
                closeEvent,
                (e) => e.type === "keydown" && e.key === " ",
              );
              if (spaceEvent) {
                // space would trigger a click on the picker button causing it to re-open immediatly after closing
                debugPopup(
                  closeEvent,
                  `closed by space key -> prevent browser click`,
                );
                // browser won't try to dispatch click
                // and our "space_to_open" will see e.defaultPrevented too and won't try to open picker
                spaceEvent.preventDefault();
              }
            }
          }

          restore_focus: {
            const focusoutEvent = findEvent(closeEvent, "focusout");
            if (focusoutEvent) {
              debugFocus(closeEvent, `closed by focusout -> let focus go away`);
            } else {
              const mousedownEvent = findEvent(closeEvent, "mousedown");
              if (mousedownEvent) {
                debugFocus(
                  closeEvent,
                  "closed by mousedown -> prevent browser focus (mousedown.preventDefault())",
                );
                mousedownEvent.preventDefault();
              }
              debugFocus(
                closeEvent,
                `restore focus to previously focused element`,
                focusedBeforeOpen,
              );
              focusedBeforeOpen.focus({ preventScroll: true });
            }
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
      anchorRef: props.ref,
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
            popupProps.openController.requestClose(e, { isCancel: true });
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
    scrollTrap,
    pointerTrap,
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
        scrollTrap={scrollTrap}
        pointerTrap={pointerTrap}
        centerInVisualViewport
        autoFocus="fallback"
        data-expand-x={expandX ? "" : undefined}
        data-expand-y={expandY ? "" : undefined}
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

// Created once per picker instance: openHandler is wrapped in a stable callback
// so the controller identity never changes across renders, even though
// Dialog/Popover read fresh closures (scrollTrap, etc.) via
// openController.onopen on every render.
const useOpenController = (openHandler) => {
  const stableOpenHandler = useStableCallback(openHandler);
  const controllerRef = useRef(null);
  if (!controllerRef.current) {
    controllerRef.current = createOpenController(stableOpenHandler);
  }
  // Unmount safety net: if Dialog/Popover unmounts while still open (parent
  // removes it from the tree without going through requestClose()), there is
  // no choice to leave open — close it for real.
  useLayoutEffect(() => {
    return () => {
      controllerRef.current.close();
    };
  }, []);
  return controllerRef.current;
};

/**
 * Owns the open/close decision-making for a picker popup (Dialog or Popover):
 * guards against duplicate requests and notifies the picker's own reactions.
 *
 * Dialog/Popover only provide the DOM-specific mechanics — they register them
 * via `openController.onopen` (reassigned on every render, mirroring native
 * EventTarget.onopen) and call `openController.requestClose(e, { isCancel })`
 * for their own internal triggers (backdrop click, Escape). `onopen` may
 * optionally return a close callback, which becomes `onclose` for that
 * opening — there's nothing to clean up if it doesn't (e.g. open failed).
 *
 * `openHandler`'s return value is `{ onRequestClose, onClose }`, in the
 * spirit of CloseWatcher
 * (https://developer.mozilla.org/en-US/docs/Web/API/CloseWatcher) but with
 * clearer naming than its cancel/close pair:
 * - `onRequestClose(e)`: about to close — call `e.preventDefault()` to stay
 *   open. This is where validation lives (replaces the old closeRequestHandler).
 * - `onClose(e)`: actually closing, not preventable — final reactions live
 *   here (replaces the old onClosed).
 *
 * The controller exposes matching action methods:
 * - `open()`: requests opening.
 * - `requestClose()`: requests closing — calls `onRequestClose` then `onClose`,
 *   stopping after the first if denied. The popup may choose to stay open.
 * - `close()`: closes for real — calls only `onClose`, skipping
 *   `onRequestClose` entirely. Used when there really is no choice (e.g. the
 *   popup unmounting).
 *
 * There is no DOM CustomEvent round-trip (navi_open/navi_close/
 * navi_request_open/navi_request_close) anymore — everything goes through
 * direct calls on this controller.
 */
const createOpenController = (openHandler) => {
  let closeHandlers = null; // { onRequestClose, onClose } returned by openHandler
  const performClose = (closeEvent) => {
    controller.opened = false;
    closeHandlers?.onClose?.(closeEvent);
    controller.onclose?.(closeEvent);
    controller.onclose = null;
    closeHandlers = null;
  };
  const controller = {
    opened: false,
    onopen: null,
    onclose: null,
    open: (e, detail) => {
      if (controller.opened || !controller.onopen) {
        return;
      }
      const requestOpenEvent = new CustomEvent("navi_request_open", {
        detail: { event: e, ...detail },
        cancelable: true,
      });
      chainEvent(requestOpenEvent, e);
      controller.opened = true;
      // onopen may populate requestOpenEvent.detail (e.g. focusedBeforeOpen)
      // by mutating it — openHandler reads it right after, synchronously.
      controller.onclose = controller.onopen(requestOpenEvent) || null;
      closeHandlers = openHandler(requestOpenEvent) || null;
    },
    requestClose: (
      e = new CustomEvent("programmatic", { detail: {} }),
      detail,
    ) => {
      if (!controller.opened) {
        return;
      }
      const requestCloseEvent = new CustomEvent("navi_request_close", {
        detail: { event: e, ...detail },
        cancelable: true,
      });
      chainEvent(requestCloseEvent, e);
      closeHandlers?.onRequestClose?.(requestCloseEvent);
      if (requestCloseEvent.defaultPrevented) {
        // The native <dialog> "cancel" event (Escape key) closes the dialog
        // by default; prevent that default so denial actually keeps it open.
        const nativeCancelEvent = findEvent(requestCloseEvent, "cancel");
        if (nativeCancelEvent) {
          nativeCancelEvent.preventDefault();
        }
        return;
      }
      performClose(requestCloseEvent);
    },
    close: (e = new CustomEvent("programmatic", { detail: {} }), detail) => {
      if (!controller.opened) {
        return;
      }
      const closeEvent = new CustomEvent("navi_close", {
        detail: { event: e, ...detail },
      });
      chainEvent(closeEvent, e);
      // Skips onRequestClose entirely — there is no choice here.
      performClose(closeEvent);
    },
  };
  return controller;
};

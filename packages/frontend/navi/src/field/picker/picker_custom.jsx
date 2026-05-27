import { dispatchCustomEvent, findEvent } from "@jsenv/dom";
import { useId, useRef, useState } from "preact/hooks";

import { shortcutsViaOnKeyDown } from "@jsenv/navi/src/keyboard/keyboard_shortcuts.js";
import { windowWidthSignal } from "@jsenv/navi/src/layout/responsive.js";
import { useDebugFocus, useDebugPopup } from "@jsenv/navi/src/navi_debug.jsx";
import { Dialog } from "@jsenv/navi/src/popup/dialog.jsx";
import { Popover } from "@jsenv/navi/src/popup/popover.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { dispatchRequestInteraction } from "../validation/custom_constraint_validation.js";
import { PickerRequestCloseContext } from "./picker_context.jsx";

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
        outline-width: var(--x-picker-outline-width);
        outline-color: var(--picker-outline-color);
        outline-offset: var(--x-picker-outline-offset);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
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
          border-radius: inherit;
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

        .navi_picker_popover {
          display: flex;
          flex-direction: column;
        }
      }

      /* &:has([data-hover]) {
        .navi_picker_popover {
          --x-picker-border-color: var(--picker-border-color-hover);
        }
      } */

      /* .navi_list_container {
        width: 100%;
        border: none;
        border-radius: 0;
        outline: none;

        .navi_list {
          width: 100%;
        }
      }
      &:has([data-focus-visible]) {
        .navi_picker_popover {
          outline-style: solid;
        }
      } */
    }

    /* dialog */
    &[aria-haspopup="dialog"] {
      .navi_picker_dialog {
        max-height: 95dvh;
        padding: 0;
        background: var(--picker-background-color);
        border: var(--picker-border-width) solid var(--x-picker-border-color);
        border-radius: var(--picker-border-radius);
        outline-width: var(--x-picker-outline-width);
        outline-color: var(--picker-outline-color);
        outline-offset: var(--x-picker-outline-offset);
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
        cursor: default; /* Reset pointer cursor within the select */
        /* overscroll-behavior: contain; */

        &[open] {
          display: flex;
          flex-direction: column;
        }

        &::backdrop {
          background: rgba(0, 0, 0, 0.4);
        }
      }

      /* .navi_list_container {
        --list-max-height: none;
        width: 100%;
        border: none;
        border-radius: 0;
        outline: none;

        .navi_list {
          width: 100%;
        }
      }
      &:has([data-focus-visible]) {
        .navi_select_dialog {
          outline-style: solid;
        }
      } */
    }
  }
`;

export const PickerCustom = (props) => {
  const isSmallScreen = windowWidthSignal.value <= 600;
  const defaultMode = isSmallScreen ? "dialog" : "popover";
  const { ref, mode = defaultMode } = props;

  const popupProps = {};
  Object.assign(props, {
    popupProps,
    actionInteraction: "manual",
  });
  // ref
  const popupRef = useRef(null);
  popupProps.ref = popupRef;
  // aria-controls + id
  id: {
    const popupId = useId();
    Object.assign(props, {
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
    const moveFocusToPicker = (e) => {
      const pickerEl = ref.current;
      const mousedownEvent = findEvent(e, "mousedown");
      if (mousedownEvent) {
        debugFocus(
          e,
          `move focus to picker (mousedown.preventDefault() + pickerEl.focus()`,
        );
        mousedownEvent.preventDefault();
        pickerEl.focus({ preventScroll: true });
        return;
      }
      const focusoutEvent = findEvent(e, "focusout");
      if (focusoutEvent) {
        // If the popover closed because focus left the select (focusout),
        // don't steal focus back — let focus go where the user intended.
        debugFocus(e, `let focus go away`);
        return;
      }
      debugFocus(e, `move focus to picker`);
      pickerEl.focus({ preventScroll: true });
    };

    const [expanded, setExpanded] = useState(false);
    const expandedRef = useRef(expanded);
    expandedRef.current = expanded;
    const onOpen = () => {
      expandedRef.current = true;
      setExpanded(true);
    };
    const onClose = (e) => {
      expandedRef.current = false;
      setExpanded(false);
      moveFocusToPicker(e);
    };
    const disableClickFor = useIgnoreClickForMousedown();
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
    const requestClose = (e = new CustomEvent("programmatic")) => {
      const mousedownEvent = findEvent(e, "mousedown");
      if (mousedownEvent) {
        debugPopup(e, `disable click`);
        disableClickFor();
      }
      const popupEl = popupRef.current;
      return dispatchCustomEvent(popupEl, "navi_request_close", { event: e });
    };

    Object.assign(props, {
      "aria-expanded": expanded,
      "onActionStart": (e) => {
        props.onActionStart?.(e);
        requestClose(e);
      },
      "onnavi_request_close": (e) => {
        if (dispatchRequestInteraction(ref.current, e)) {
          requestClose(e);
        }
      },
      "children": (
        <PickerRequestCloseContext.Provider value={requestClose}>
          {props.children}
        </PickerRequestCloseContext.Provider>
      ),
    });
    Object.assign(popupProps, {
      onnavi_open: (e) => {
        onOpen(e);
      },
      onnavi_close: (e) => {
        onClose(e);
      },
    });

    interactions: {
      const { onMouseDown, onClick, onKeyDown } = props;
      Object.assign(props, {
        onMouseDown: (e) => {
          onMouseDown?.(e);
          const pickerEl = ref.current;
          if (
            dispatchRequestInteraction(pickerEl, e, "mousedown to open picker")
          ) {
            if (expandedRef.current) {
              requestClose(e);
            } else {
              e.preventDefault(); // prevent browser trying to give focus to the select (popover will take focus)
              debugFocus(
                e,
                `prevent browser giving focus to button (mousedown.preventDefault())`,
              );
              requestOpen(e);
            }
          }
        },
        onClick: (e) => {
          onClick?.(e);
          if (e.detail === 0) {
            // click triggered by enter won't open the popover
            return;
          }
          if (
            dispatchRequestInteraction(ref.current, e, "click to open picker")
          ) {
            // When a label is clicked it transfers focus to the select
            // in that case we want to open it (otherwise we have already opened on mousedown interaction)
            e.preventDefault();
            requestOpen(e);
          }
        },
        onKeyDown: shortcutsViaOnKeyDown(
          {
            arrowdown: (e) => {
              if (dispatchRequestInteraction(ref.current, e)) {
                e.preventDefault(); // prevent container scroll
                requestOpen(e);
              }
            },
            arrowup: (e) => {
              if (dispatchRequestInteraction(ref.current, e)) {
                e.preventDefault(); // prevent container scroll
                requestOpen(e);
              }
            },
            space: (e) => {
              if (dispatchRequestInteraction(ref.current, e)) {
                e.preventDefault(); // prevent scroll
                requestOpen(e);
              }
            },
            escape: (e) => {
              if (!expandedRef.current) {
                return;
              }
              if (dispatchRequestInteraction(ref.current, e)) {
                e.preventDefault();
                requestClose(e);
              }
            },
          },
          onKeyDown,
        ),
      });
      Object.assign(popupProps, {
        onMouseDown: (e) => {
          if (e.button !== 0) {
            return;
          }
          // mousedown inside popover should not bubble to the select (would re-open it if that mousedown closes it)
          debugPopup(e, `popover mouseDown stopPropagation`);
          e.stopPropagation();
        },
        onClick: (e) => {
          if (e.button !== 0) {
            return;
          }
          // click inside popover should not bubble to the select (would re-open it if that click closes it)
          debugPopup(e, `popover click stopPropagation`);
          e.stopPropagation();
        },
      });
    }
  }

  if (mode === "popover") {
    return <PickerContentInsidePopover {...props} />;
  }
  if (mode === "dialog") {
    return <PickerContentInsideDialog {...props} />;
  }
  return null;
};

const PickerContentInsidePopover = (props) => {
  const Next = useNextResolver();
  import.meta.css = css;
  const {
    popupProps,
    children,
    pointerTrap,
    scrollTrap = true,
    focusTrap = true,
    popoverMode = "nearby",
    popoverSpacing = popoverMode === "nearby" ? 5 : 0,
    viewportSpacing = 10,
    ...rest
  } = props;

  return (
    <Next
      aria-haspopup="listbox"
      navi-popover-mode={popoverMode}
      {...rest}
      onFocusOut={(e) => {
        if (import.meta.dev) {
          // during dev disable to allow inspecting the select (hot fix for now to ease life during dev)
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
        if (!focusStaysInside && dispatchRequestInteraction(pickerEl, e)) {
          dispatchCustomEvent(popoverEl, "navi_request_close", { event: e });
        }
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
  const {
    popupProps,
    children,
    scrollTrap = true,
    pointerTrap,
    ...rest
  } = props;

  return (
    <Next aria-haspopup="dialog" {...rest}>
      <Dialog
        {...popupProps}
        className="navi_picker_dialog"
        scrollTrap={scrollTrap}
        pointerTrap={pointerTrap}
      >
        {children}
      </Dialog>
    </Next>
  );
};

/**
 * Returns a `disableClickFor` function that suppresses the `click` event that
 * the browser fires after a `mousedown` which already handled an open/close action.
 *
 * Problem: when the user clicks a dialog's backdrop to close it, the browser
 * fires `mousedown` on the backdrop (which closes the dialog), then fires
 * `click` on whatever element is underneath once the dialog is gone. If that
 * element is the trigger button that originally opened the dialog, the `click`
 * would immediately re-open it.
 *
 * Calling `stopPropagation()` or `preventDefault()` on the backdrop `mousedown`
 * does not help: the browser dispatches the subsequent `click` regardless,
 * targeting whichever element ends up under the pointer after the dialog closes.
 *
 * Solution: register a self-removing capture-phase `click` listener on `document`
 * so the click is intercepted before it reaches any element handler.
 */
const useIgnoreClickForMousedown = () => {
  const disableClickFor = () => {
    const suppressClick = (clickEvent) => {
      clickEvent.stopPropagation();
      clickEvent.preventDefault();
      document.removeEventListener("click", suppressClick, { capture: true });
    };
    document.addEventListener("click", suppressClick, { capture: true });
  };
  return disableClickFor;
};

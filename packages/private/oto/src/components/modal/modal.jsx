import {
  elementIsFocusable,
  findDescendant,
  getSelfAndAncestorScrolls,
  setAttributes,
  trapFocusInside,
  trapScrollInside,
} from "@jsenv/dom";
import { Box } from "oto/src/components/box/box_oto.jsx";
import { createPortal } from "preact/compat";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { Inserts } from "./inserts.jsx";
import modalStyleSheet from "./modal.css" with { type: "css" };

const ModalOpened = ({
  id,
  name,
  x = "center",
  y = "center",
  width,
  height,
  container = document.body,
  children,
  onRequestClose = () => {},
  requestCloseOnClickOutside = true,
  requestCloseOnEscape = true,
  insert = {},
  backgroundColor = "white",
  onFocusIn = () => {},
  onFocusOut = () => {},
  onKeyDown = () => {},
}) => {
  const modalRef = useRef();

  /**
   * Display the modal where document scroll is + trap scroll inside
   */
  useLayoutEffect(() => {
    const modal = modalRef.current;
    const { scrollX, scrollY } = getSelfAndAncestorScrolls(modal);
    modal.style.left = `${scrollX}px`;
    modal.style.top = `${scrollY}px`;
    return trapScrollInside(modal);
  }, [container]);

  /**
   * Put aria-hidden on elements behind this dialog
   *
   * we hide previous and next siblings
   * because when opened everything around it should be considered
   * hidden (you cannot have several modal visible at the same time).
   * Let's keep in mind we are talking about a dialog in accessibility terms.
   * It should focus trap, prevent interaction with the rest of the page
   * and consider the rest as hidden.
   * This is not meant to be used for tooltip and so on.
   */
  useLayoutEffect(() => {
    const modal = modalRef.current;
    const parentChildren = Array.from(modal.parentNode.children);
    const siblings = [];
    for (const childCandidate of parentChildren) {
      if (childCandidate !== modal) {
        siblings.push(childCandidate);
      }
    }
    const cleanupCallbackSet = new Set();
    const hideElement = (el) => {
      const removeAriaHidden = setAttributes(el, {
        "aria-hidden": "true",
      });

      cleanupCallbackSet.add(() => {
        removeAriaHidden();
      });
    };
    for (const sibling of siblings) {
      hideElement(sibling);
    }
    return () => {
      for (const cleanupCallback of cleanupCallbackSet) {
        cleanupCallback();
      }
      cleanupCallbackSet.clear();
    };
  }, []);

  const getFirstFocusableElementOrSelf = () => {
    const modal = modalRef.current;
    const firstFocusableDescendant = findDescendant(modal, elementIsFocusable);
    if (firstFocusableDescendant) {
      return firstFocusableDescendant;
    }
    return modal;
  };

  /**
   * focusin/focusout
   */
  const [focusIsInside, focusIsInsideSetter] = useState(false);
  const focusInsideEffect = () => {
    focusIsInsideRef.current = true;
    focusIsInsideSetter(true);
  };
  const focusOutsideEffect = () => {
    focusIsInsideRef.current = false;
    focusIsInsideSetter(false);
  };
  const focusIsInsideRef = useRef(false);
  useLayoutEffect(() => {
    const modal = modalRef.current;

    if (hasOrContainsFocus(modal)) {
      focusInsideEffect();
    }
    const onDocumentBlur = (blurEvent) => {
      // focus is leaving the document and it was inside
      if (!blurEvent.relatedTarget) {
        if (focusIsInsideRef.current) {
          onFocusOut(blurEvent);
        }
        focusOutsideEffect();
      }
    };
    const onInnerFocus = (focusEvent) => {
      focusInsideEffect();
      onFocusIn(focusEvent);
    };
    const onDocumentFocus = (focusEvent) => {
      if (focusIsInsideRef.current) {
        focusInsideEffect();
      } else {
        focusOutsideEffect();
        onFocusOut(focusEvent);
      }
    };

    modal.addEventListener("focus", onInnerFocus, true);
    document.addEventListener("focus", onDocumentFocus, true);
    document.addEventListener("blur", onDocumentBlur, true);
    return () => {
      modal.removeEventListener("focus", onInnerFocus, true);
      document.removeEventListener("focus", onDocumentFocus, true);
      document.removeEventListener("blur", onDocumentBlur, true);
    };
  }, []);

  /**
   * Steal focus when opens, restore when closes + trap focus
   */
  useLayoutEffect(() => {
    const nodeFocusedBeforeTransfer = document.activeElement;
    const firstFocusableElementOrSelf = getFirstFocusableElementOrSelf();
    firstFocusableElementOrSelf.focus({ preventScroll: true });
    const removeFocusTrap = trapFocusInside(modalRef.current);
    return () => {
      nodeFocusedBeforeTransfer.focus({ preventScroll: true });
      removeFocusTrap();
    };
  }, []);

  return createPortal(
    <div
      ref={modalRef}
      id={id}
      name={name}
      role="dialog"
      className="modal"
      tabIndex="-1"
      onKeyDown={(keydownEvent) => {
        if (requestCloseOnEscape && keydownEvent.key === "Escape") {
          keydownEvent.stopPropagation();
          keydownEvent.preventDefault();
          onRequestClose(keydownEvent);
        }
        onKeyDown(keydownEvent);
      }}
    >
      <div
        className="modal_backdrop"
        onMouseDown={(mousedownEvent) => {
          // 1. prevent mousedown on backdrop from putting focus on document.body
          mousedownEvent.preventDefault();
          // 2. transfer focus to the modal content is not already inside
          const modalNode = modalRef.current;
          if (!hasOrContainsFocus(modalNode)) {
            const firstFocusableElementOrSelf =
              getFirstFocusableElementOrSelf();
            firstFocusableElementOrSelf.focus({ preventScroll: true });
          }
        }}
        onClick={(clickEvent) => {
          if (requestCloseOnClickOutside) {
            clickEvent.stopPropagation();
            onRequestClose(clickEvent);
          }
        }}
      />
      <div style="padding: 20px">
        <Box.div
          className="modal_box"
          backgroundColor={backgroundColor}
          width={width}
          height={height}
          x={x}
          y={y}
          focused={focusIsInside}
        >
          <Inserts {...insert}>
            <div className="modal_scrollable_content">{children}</div>
          </Inserts>
        </Box.div>
      </div>
    </div>,
    container,
  );
};
export const Modal = ({ opened = false, ...props }) => {
  if (!opened) {
    return null;
  }
  return <ModalOpened {...props} />;
};

const hasOrContainsFocus = (element) => {
  const { activeElement } = document;
  return element === activeElement || element.contains(activeElement);
};

document.adoptedStyleSheets = [...document.adoptedStyleSheets, modalStyleSheet];
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== modalStyleSheet,
    );
  });
}

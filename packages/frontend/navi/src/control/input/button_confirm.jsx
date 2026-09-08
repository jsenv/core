/**
 * A button that asks before doing what it stands for, in the place it stands.
 *
 *     [ Supprimer ]
 *     Supprimer ? Ses 3 clubs restent, sans enseigne. [Confirmer] [Annuler]
 *
 * The other half of `<Picker type="confirm">`, which asks the same question in
 * a popup. Here it takes the button's own place in the row: the gesture stays
 * under the finger, nothing is drawn over what the reader was looking at, and
 * changing one's mind is a press on "Annuler", a press anywhere else, or
 * Escape — there is nothing to dismiss.
 *
 * The button confirming IS the button that was pressed, `action`, `command`,
 * `href` and all: the wait, the busy state and the error callout land where the
 * person pressed, exactly as they would have without the question. Only the
 * first press is intercepted. The resolver sits after the route and command
 * ones on purpose: what they decide about the button as a whole — a submit
 * held back while its form has nothing to send, the label a command gives by
 * default — applies to the first press as much as to the second.
 */

import { useId, useLayoutEffect, useRef, useState } from "preact/hooks";

import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import {
  findFocusTarget,
  moveFocusTo,
} from "../../utils/focus/focus_transfer.js";
import { ButtonUI } from "./button_ui.jsx";

const css = /* css */ `
  .navi_button_confirm {
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--navi-s);
  }
`;

export const ButtonConfirmResolver = (props) => {
  const Next = useNextResolver();

  if (!props.confirm) {
    return <Next {...props} />;
  }
  return <ButtonConfirm {...props} Next={Next} />;
};

const ButtonConfirm = ({
  Next,
  confirm,
  confirmLabel = naviI18n("button.confirm"),
  cancelLabel = naviI18n("button.cancel"),
  confirmTestId,
  cancelTestId,
  ...props
}) => {
  import.meta.css = css;

  const [asking, setAsking] = useState(false);
  const askingRef = useRef(null);
  const cancelRef = useRef(null);
  // Whether going back to the resting label owes the focus a place to land: a
  // press on "Annuler" or an Escape does, a focus that already left does not —
  // it is elsewhere by then, and pulling it back would take it from whatever
  // the person moved to.
  const restoreFocusRef = useRef(false);
  const questionId = `${useId()}_question`;

  const cancel = (restoreFocus) => {
    restoreFocusRef.current = restoreFocus;
    setAsking(false);
  };

  const { action, command, onActionEnd, onClick } = props;
  // A submit button does not run anything itself: the form around it does,
  // with the button as requester, and the outcome never comes back through the
  // button's own action events. The question then waits on the form.
  const waitsForForm = !action && command === "--navi-send";

  useLayoutEffect(() => {
    if (asking) {
      // The press was aimed at this button, and the button that answers now is
      // where it should land: navi's own ladder inside the question, which
      // finds "Confirmer" (first in the row) unless the caller marked
      // something else.
      const found = findFocusTarget(askingRef.current, {
        restoreMayClaim: true,
      });
      if (found) {
        moveFocusTo(found.target);
      }
      if (!waitsForForm) {
        return undefined;
      }
      const buttonEl = props.ref.current;
      const formEl = buttonEl.form || buttonEl.closest("form");
      if (!formEl) {
        return undefined;
      }
      // Same reading as watchActionCompletion (control_action.js): a send that
      // failed leaves its message on the button that asked, so the question
      // stays up with it; one that went through is answered.
      const onFormActionStart = (actionStartEvent) => {
        const { requester, addSideEffect } = actionStartEvent.detail;
        if (requester && requester !== buttonEl) {
          return;
        }
        addSideEffect(({ error, aborted }) => {
          if (error || aborted) {
            return;
          }
          cancel(true);
        });
      };
      formEl.addEventListener("navi_action_start", onFormActionStart);
      return () => {
        formEl.removeEventListener("navi_action_start", onFormActionStart);
      };
    }
    if (restoreFocusRef.current) {
      restoreFocusRef.current = false;
      // The answer may have taken the button with it — a row deleting itself
      // is the whole point of asking — and there is then nothing to give the
      // focus back to.
      const buttonEl = props.ref.current;
      if (buttonEl) {
        moveFocusTo(buttonEl);
      }
    }
    return undefined;
  }, [asking]);

  if (!asking) {
    return (
      <Next
        {...props}
        // The first press is the question, not the act: nothing that acts
        // reaches the ui. What was decided about the button itself (readOnly,
        // cta, the label) stays.
        action={undefined}
        command={undefined}
        href={undefined}
        onClick={() => {
          setAsking(true);
        }}
      />
    );
  }

  return (
    <span
      className="navi_button_confirm"
      ref={askingRef}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          cancel(true);
        }
      }}
      onFocusOut={(e) => {
        if (!askingRef.current.contains(e.relatedTarget)) {
          cancel(false);
        }
      }}
    >
      <span id={questionId}>
        {confirm === true ? naviI18n("confirm.message") : confirm}
      </span>
      <Next
        {...props}
        aria-describedby={questionId}
        // The button confirming is the button that was pressed: it keeps the
        // caller's own testid unless the question names one of its own.
        data-testid={confirmTestId || props["data-testid"]}
        onClick={(e) => {
          onClick?.(e);
          if (!action && !waitsForForm) {
            // A command runs on the press itself: there is nothing to wait for,
            // the question is answered as soon as it is pressed.
            cancel(true);
          }
        }}
        // A run that failed keeps the question up, with its callout on the
        // button that raised it: the retry is then one press away.
        onActionEnd={(data, e) => {
          onActionEnd?.(data, e);
          cancel(true);
        }}
      >
        {confirmLabel}
      </Next>
      {/* The way out is drawn straight from the ui: it leads nowhere, runs
          nothing and asks nothing — none of the resolvers above this one has
          anything to say about it. */}
      <ButtonUI
        ref={cancelRef}
        type="button"
        data-testid={cancelTestId}
        onClick={() => {
          cancel(true);
        }}
      >
        {cancelLabel}
      </ButtonUI>
    </span>
  );
};

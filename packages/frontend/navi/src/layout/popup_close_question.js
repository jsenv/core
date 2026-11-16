/*
 * A popup holding something only one of its buttons writes (a draft of
 * filters its footer applies) asks before a close that would drop it without a
 * word: the cross, a press outside, a push through its edge. The popup stays
 * on screen behind the question, a push springs back, and leaving the
 * question returns to the popup. The question is a popup of the app's, named
 * by `closeQuestion` on Dialog/Popover, and its answer becomes the close the
 * popup was asked for:
 * - yes (`--navi-confirm`, a send): the popup closes with `isConfirm`;
 * - no (`--navi-cancel`): it closes with `isCancel`;
 * - any other way out of the question (Escape, a press outside it, its cross,
 *   Back) answers nothing, and the popup stays. Escape and `--navi-cancel`
 *   both arrive as `isCancel`: the no is the one a control said.
 *
 * Only a close that keeps is asked about. A cancel, a confirm and a send
 * already say what they mean, and that is also why the close following the
 * answer goes through: it says yes or no, so nothing has to remember that the
 * question was asked.
 *
 * A close is held only for a question opened in a press the popup owns. A
 * press outside a popup with no wall belongs to the page, which answers it
 * whatever the popup does (see armOutsidePressClose): asking in the middle of
 * it splits the press between the page and the question's wall, and the focus
 * the question gives goes with it. That press leaves the popup open instead,
 * and the question waits for a close that can be held.
 */

import { findEvent } from "@jsenv/dom";

import { triggerNaviCommand } from "../control/commands.js";
import { closeSaysYes, openPopupAsk } from "./popup_ask.js";

/**
 * The question of one opening of a popup, as the function its close requests
 * go through: it answers whether the request waits for the question (the
 * caller then refuses it), and opens the question when it is not on screen
 * yet. Called last, once nothing else refuses: a request it lets through is a
 * close.
 */
export const createCloseQuestion = (openController, readCloseQuestion) => {
  let pendingQuestion = null;

  return (requestCloseEvent) => {
    if (!closeAsksQuestion(requestCloseEvent)) {
      // A close that says what it means while the question is on screen (the
      // app closing the popup, Back): nothing is left to ask about. The
      // question leaves first, so the focus it gives back into the popup is
      // given before the popup gives its own back.
      const question = pendingQuestion;
      if (question) {
        pendingQuestion = null;
        const { element } = question;
        triggerNaviCommand(element, "--navi-cancel", requestCloseEvent, {
          optional: true,
        });
      }
      return false;
    }
    if (pendingQuestion) {
      // Already on screen: its answer is the answer to this request too.
      return true;
    }
    const questionElement = resolveQuestionElement(readCloseQuestion());
    if (!questionElement) {
      return false;
    }
    if (requestCloseEvent.detail.pressOnPage) {
      // The page already heard this press begin, and answers the rest of it:
      // a question opened now would put its wall in the middle of the press.
      // The popup stays, and asks at a close it can hold (its cross, a push).
      return true;
    }
    const question = { element: questionElement };
    pendingQuestion = question;
    const opened = openPopupAsk(questionElement, requestCloseEvent, {
      answer: (closeEvent) => {
        if (pendingQuestion !== question) {
          return;
        }
        pendingQuestion = null;
        if (closeSaysYes(closeEvent)) {
          openController.requestClose(closeEvent, { isConfirm: true });
          return;
        }
        const { isCancel, requester } = closeEvent.detail;
        if (isCancel && requester) {
          openController.requestClose(closeEvent, { isCancel: true });
        }
      },
      supersede: () => {
        if (pendingQuestion === question) {
          pendingQuestion = null;
        }
      },
    });
    if (!opened) {
      pendingQuestion = null;
      return false;
    }
    return true;
  };
};

const closeAsksQuestion = (requestCloseEvent) => {
  if (requestCloseEvent.detail.isCancel || closeSaysYes(requestCloseEvent)) {
    return false;
  }
  // A link pressed inside the popup: its navigation goes ahead whatever the
  // popup answers, so there is no close left to hold.
  const clickEvent = findEvent(requestCloseEvent, "click");
  if (clickEvent?.target.closest("a[href]")) {
    return false;
  }
  return true;
};

// Read at the request: a function is asked then, for a popup that only knows
// at the close whether anything changed.
const resolveQuestionElement = (closeQuestion) => {
  const named =
    typeof closeQuestion === "function" ? closeQuestion() : closeQuestion;
  if (!named) {
    return null;
  }
  if (typeof named === "string") {
    return document.getElementById(named);
  }
  return "current" in named ? named.current : named;
};

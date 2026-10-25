/**
 * What a busy control whose wait may be called off (`actionAbortable`) answers
 * a second press with: the busy sentence, and the way out of the wait beside
 * it. The person pressing again is asking « so? »; the answer is « still
 * running », with the choice to stop.
 *
 * A slot rather than an import: the way out is a navi Button, and the
 * interaction rules sit below every control in the import graph — a Button
 * imported from here would close a cycle through the control hooks. button.jsx
 * fills it. Unfilled, the busy sentence is said alone.
 */

let renderBusyAbortMessage = null;
export const provideBusyAbortMessage = (render) => {
  renderBusyAbortMessage = render;
};

export const busyAbortMessage = (message, abort) => {
  if (!renderBusyAbortMessage) {
    return message;
  }
  return renderBusyAbortMessage(message, abort);
};

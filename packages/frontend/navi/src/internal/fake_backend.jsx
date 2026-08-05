/**
 * A backend, on the page.
 *
 * Three bands, in the order things travel: the backend and what it holds at the
 * top, the frontier in the middle, the frontend (whatever one puts inside) at
 * the bottom. Everything crossing between the two is drawn in that middle
 * band — what the frontend sent, pointing up, and the two answers the backend
 * may give, pointing back down. Nothing is in flight until an action runs, so
 * the band is empty until then.
 *
 * What it is mostly for: the difference between the two. A form whose fields
 * already match the backend has nothing to send, so a submit that does nothing
 * is the right answer rather than a bug — which is impossible to see until the
 * backend's own value is on the page next to the screen's.
 *
 * The call waits on purpose. A delay one picks is a delay one waits through; a
 * call held until it is answered is a pause in the middle of the action, where
 * the loading state can be looked at for as long as one likes, and answered
 * either way.
 *
 * Children are a function, because what they need is what this holds:
 *
 *   <FakeBackend value={{ day: "2026-08-01" }}>
 *     {({ value, action }) => <Form action={action}>…</Form>}
 *   </FakeBackend>
 *
 * `action` is what a Form or a control takes: it returns a promise that settles
 * when the answer is given — with what it was handed (which becomes the new
 * state of the backend), or with an error.
 *
 * Not exported from the package: it is a demo's furniture, not an
 * application's.
 */

import { useState } from "preact/hooks";

const css = /* css */ `
  .navi_fake_backend {
    margin-bottom: 16px;
    border: 1px dashed #b0bec5;
    border-radius: 8px;
    overflow: hidden;
  }
  .navi_fake_backend_head {
    display: flex;
    padding: 8px 12px 26px;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    color: #37474f;
    font-size: 12px;
    background: #eceff1;
    /* The line the frontier below sits astride. */
    border-bottom: 1px dashed #b0bec5;
  }
  .navi_fake_backend_label {
    color: #78909c;
    font-weight: 600;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .navi_fake_backend_value {
    padding: 2px 6px;
    font-size: 12px;
    font-family: monospace;
    background: white;
    border-radius: 4px;
  }
  /* Neither side's, so it belongs to both: pulled up by half its height, it
     sits astride the line between them — a lane over the border rather than a
     third band under it. What is on it is in flight, and the arrows say which
     way. Hatched so it reads as a boundary and not as a third party. */
  .navi_fake_backend_frontier {
    display: flex;
    box-sizing: border-box;
    min-height: 34px;
    /* Room to grow for what crosses it — a payload is not always one line — and
       a scrollbar past that, so a big one does not push the two sides apart. */
    max-height: 100px;
    margin: -17px 12px 0;
    padding: 4px 10px;
    align-items: center;
    gap: 8px;
    color: #546e7a;
    font-size: 12px;
    background: repeating-linear-gradient(
      -45deg,
      #f5f7f8,
      #f5f7f8 6px,
      #eceff1 6px,
      #eceff1 12px
    );
    border: 1px dashed #b0bec5;
    border-radius: 15px;
    overflow-y: auto;
  }
  .navi_fake_backend_sent,
  .navi_fake_backend_answer {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  /* Upwards from the frontend, downwards from the backend: the same call, seen
     from the side that is speaking. */
  .navi_fake_backend_arrow {
    font-size: 14px;
    line-height: 1;
  }
  .navi_fake_backend_answer {
    margin-left: auto;
  }
  .navi_fake_backend_body {
    display: flex;
    padding: 12px 12px 14px;
    flex-direction: column;
    align-items: start;
    gap: 8px;
  }
`;

/**
 * @param {object} props
 * @param {any} [props.value] - what the backend holds to begin with. Nothing,
 *   when nothing is given: a backend that has never been told anything.
 * @param {(context: {value: any, action: Function}) => import("preact").ComponentChildren} props.children
 */
export const FakeBackend = ({ value: valueInitial, children }) => {
  import.meta.css = css;
  const [value, setValue] = useState(valueInitial);
  // The call in flight, held until someone answers it: what it was given, and
  // the two ways it can end.
  const [call, setCall] = useState(null);

  const action = (received) =>
    new Promise((resolve, reject) => {
      setCall({ received, resolve, reject });
    });
  const answer = () => {
    setValue(call.received);
    call.resolve(call.received);
    setCall(null);
  };
  const fail = () => {
    call.reject(new Error("Le serveur a refusé l'enregistrement."));
    setCall(null);
  };

  return (
    <div className="navi_fake_backend">
      <div className="navi_fake_backend_head">
        <span className="navi_fake_backend_label">backend</span>
        <span className="navi_fake_backend_value">{stringify(value)}</span>
      </div>
      <div className="navi_fake_backend_frontier">
        {call ? (
          <>
            <span className="navi_fake_backend_sent">
              <span className="navi_fake_backend_arrow">↑</span>
              <span className="navi_fake_backend_value">
                {stringify(call.received)}
              </span>
            </span>
            <span className="navi_fake_backend_answer">
              <button type="button" onClick={answer}>
                répondre
              </button>
              <button type="button" onClick={fail}>
                échouer
              </button>
              <span className="navi_fake_backend_arrow">↓</span>
            </span>
          </>
        ) : null}
      </div>
      <div className="navi_fake_backend_body">
        <span className="navi_fake_backend_label">frontend</span>
        {children({ value, action })}
      </div>
    </div>
  );
};

// Nothing is written as nothing: "undefined" through JSON.stringify comes back
// as the empty string, which reads as a bug rather than as an empty backend.
const stringify = (value) =>
  value === undefined ? "∅" : JSON.stringify(value);

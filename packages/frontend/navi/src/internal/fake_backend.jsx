/**
 * A backend, on the page.
 *
 * Two values and one call, all visible: what the backend holds, what the screen
 * holds, and — when an action runs — the call itself, waiting for an answer
 * that a human gives by pressing "répondre" or "échouer".
 *
 * What it is mostly for: the difference between the two values. A form whose
 * fields already match the backend has nothing to send, so a submit that does
 * nothing is the right answer rather than a bug — which is impossible to see
 * until both values are written down side by side.
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

import { effect } from "@preact/signals";
import { useLayoutEffect, useRef, useState } from "preact/hooks";

const css = /* css */ `
  .navi_fake_backend {
    margin-bottom: 16px;
    border: 1px dashed #b0bec5;
    border-radius: 8px;
    overflow: hidden;
  }
  .navi_fake_backend_head {
    display: flex;
    padding: 8px 12px;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 16px;
    color: #37474f;
    font-size: 12px;
    background: #eceff1;
  }
  .navi_fake_backend_field {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .navi_fake_backend_label {
    font-weight: 600;
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
  .navi_fake_backend_call {
    display: flex;
    margin-left: auto;
    align-items: center;
    gap: 6px;
  }
  .navi_fake_backend_idle {
    margin-left: auto;
    color: #78909c;
  }
  .navi_fake_backend_body {
    padding: 16px 12px;
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
  // What the screen holds, read from the control inside rather than passed in:
  // it is the other half of the comparison, and asking the DOM for it means the
  // caller has nothing to wire up.
  const [uiValue, setUIValue] = useState(undefined);
  const bodyRef = useRef();
  useLayoutEffect(() => {
    const controlElement = bodyRef.current.querySelector("[navi-control]");
    const controller = controlElement?.__uiStateController__;
    if (!controller) {
      return undefined;
    }
    return effect(() => {
      setUIValue(controller.uiStateSignal.value);
    });
  }, []);

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
        <span className="navi_fake_backend_field">
          <span className="navi_fake_backend_label">backend</span>
          <span className="navi_fake_backend_value">{stringify(value)}</span>
        </span>
        <span className="navi_fake_backend_field">
          <span className="navi_fake_backend_label">frontend</span>
          <span className="navi_fake_backend_value">{stringify(uiValue)}</span>
        </span>
        {call ? (
          <span className="navi_fake_backend_call">
            <span className="navi_fake_backend_value">
              {stringify(call.received)}
            </span>
            <button type="button" onClick={answer}>
              répondre
            </button>
            <button type="button" onClick={fail}>
              échouer
            </button>
          </span>
        ) : (
          <span className="navi_fake_backend_idle">aucun appel</span>
        )}
      </div>
      <div className="navi_fake_backend_body" ref={bodyRef}>
        {children({ value, action })}
      </div>
    </div>
  );
};

// Nothing is written as nothing: "undefined" through JSON.stringify comes back
// as the empty string, which reads as a bug rather than as an empty backend.
const stringify = (value) =>
  value === undefined ? "∅" : JSON.stringify(value);

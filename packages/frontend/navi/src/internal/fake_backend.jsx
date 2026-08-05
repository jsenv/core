/**
 * A backend, on the page.
 *
 * An async action is three things at once — what the server already knows, how
 * long it takes to answer, and whether it answers at all — and a demo that
 * hides all three leaves the reader guessing why a submit did nothing. So they
 * are put where they can be read and changed: the value the server holds, next
 * to the control that would change it; a delay one picks; a switch that makes
 * the next call fail.
 *
 * What it is for, mostly: the difference between what the screen shows and what
 * the server has. A form whose fields already match the server has nothing to
 * send, and a submit that does nothing is then the right answer rather than a
 * bug — which is impossible to see until both values are on the page.
 *
 * Children are a function, because what they need is what this holds:
 *
 *   <FakeBackend value={{ day: "2026-08-01" }}>
 *     {({ value, action }) => (
 *       <Form action={action}>…</Form>
 *     )}
 *   </FakeBackend>
 *
 * `action` is what a Form or a control takes: it waits, it fails when asked to,
 * and otherwise it keeps what it was given — which then shows up above as the
 * new state of the server.
 *
 * Not exported from the package: it is a demo's furniture, not an
 * application's.
 */

import { useRef, useState } from "preact/hooks";

const css = /* css */ `
  .navi_fake_backend {
    margin-bottom: 16px;
    border: 1px dashed #b0bec5;
    border-radius: 8px;
    overflow: hidden;
  }
  .navi_fake_backend_head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    color: #37474f;
    font-size: 12px;
    background: #eceff1;
  }
  .navi_fake_backend_name {
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .navi_fake_backend_value {
    padding: 2px 6px;
    font-family: monospace;
    font-size: 12px;
    background: white;
    border-radius: 4px;
  }
  .navi_fake_backend_option {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .navi_fake_backend_status {
    margin-left: auto;
  }
  .navi_fake_backend_status[data-status="pending"] {
    color: #ef6c00;
  }
  .navi_fake_backend_status[data-status="failed"] {
    color: #c62828;
  }
  .navi_fake_backend_status[data-status="done"] {
    color: #2e7d32;
  }
  .navi_fake_backend_body {
    padding: 16px 12px;
  }
`;

const DELAY_OPTIONS = [
  { label: "instantané", value: 0 },
  { label: "300 ms", value: 300 },
  { label: "1 s", value: 1000 },
  { label: "3 s", value: 3000 },
];

/**
 * @param {object} props
 * @param {any} props.value - what the server holds to begin with.
 * @param {number} [props.delay=300] - how long it takes to answer, to begin
 *   with; the reader can change it.
 * @param {string} [props.name="Backend"] - what to call it in the header.
 * @param {(value: any) => import("preact").ComponentChildren} props.children -
 *   given `{ value, action, calls }`.
 */
export const FakeBackend = ({
  value: valueInitial,
  delay: delayInitial = 300,
  name = "Backend",
  children,
}) => {
  import.meta.css = css;
  const [value, setValue] = useState(valueInitial);
  const [delay, setDelay] = useState(delayInitial);
  const [fails, setFails] = useState(false);
  const [status, setStatus] = useState("idle");
  // Read when the call ANSWERS, not when it was made: the reader is meant to
  // flip the switch (or move the delay) while a call is in flight and see what
  // that does, which only works if the answer is decided at the end.
  const failsRef = useRef(fails);
  failsRef.current = fails;
  const delayRef = useRef(delay);
  delayRef.current = delay;

  const action = async (received) => {
    setStatus("pending");
    await new Promise((resolve) => {
      setTimeout(resolve, delayRef.current);
    });
    if (failsRef.current) {
      setStatus("failed");
      throw new Error("Le serveur a refusé l'enregistrement.");
    }
    setValue(received);
    setStatus("done");
    return received;
  };

  return (
    <div className="navi_fake_backend">
      <div className="navi_fake_backend_head">
        <span className="navi_fake_backend_name">{name}</span>
        <span className="navi_fake_backend_value">
          {JSON.stringify(value)}
        </span>
        <label className="navi_fake_backend_option">
          répond en
          <select
            value={String(delay)}
            onChange={(e) => {
              setDelay(Number(e.target.value));
            }}
          >
            {DELAY_OPTIONS.map((option) => (
              <option key={option.value} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="navi_fake_backend_option">
          <input
            type="checkbox"
            checked={fails}
            onChange={(e) => {
              setFails(e.target.checked);
            }}
          />
          échoue
        </label>
        <span className="navi_fake_backend_status" data-status={status}>
          {STATUS_LABELS[status]}
        </span>
      </div>
      <div className="navi_fake_backend_body">{children({ value, action })}</div>
    </div>
  );
};

const STATUS_LABELS = {
  idle: "en attente d'un appel",
  pending: "appel en cours…",
  done: "à jour",
  failed: "dernier appel en erreur",
};

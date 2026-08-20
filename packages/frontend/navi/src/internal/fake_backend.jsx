/**
 * A backend, on the page.
 *
 * Three bands, in the order things travel: the backend and what it holds at the
 * top, the frontier in the middle, the frontend (whatever one puts inside) at
 * the bottom. Everything crossing between the two is drawn in that middle
 * band — the two answers the backend may give on the left, what the frontend
 * sent on the right. A side each, and each side keeps it: the backend speaks
 * from the left (its name, its value, its two buttons), the frontend from the
 * right (its name, and what it is asking for). Nothing is in flight until an
 * action runs, so the band is empty until then.
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
 * state of the backend), or with an error. Pass `{ signal }` alongside and the
 * call leaves the frontier by itself when whoever made it gives up on it.
 *
 * Not exported from the package: it is a demo's furniture, not an
 * application's.
 */

import { useEffect, useState } from "preact/hooks";

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
  .navi_fake_backend_mode {
    display: flex;
    margin-left: auto;
    align-items: center;
    gap: 5px;
    color: #78909c;
    font-size: 11px;
  }
  .navi_fake_backend_mode select {
    color: #37474f;
    font: inherit;
    font-size: 11px;
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
  /* Each side of the frontier belongs to the side it comes from: the backend
     answers from the left, where its name and its value are; what the frontend
     sends arrives on the right, where its own name is. */
  .navi_fake_backend_sent {
    margin-left: auto;
  }
  .navi_fake_backend_body {
    display: flex;
    padding: 12px 12px 14px;
    flex-direction: column;
    align-items: start;
    gap: 8px;
  }
  .navi_fake_backend_table {
    font-size: 12px;
    font-family: monospace;
    background: white;
    border-radius: 4px;
    border-collapse: collapse;
    overflow: hidden;
  }
  .navi_fake_backend_table th,
  .navi_fake_backend_table td {
    padding: 2px 8px;
    text-align: left;
    border: 1px solid #dce3e6;
  }
  .navi_fake_backend_table th {
    color: #78909c;
    font-weight: 600;
  }
  .navi_fake_backend_table button {
    padding: 0 4px;
    font-size: 11px;
    line-height: 1.4;
    cursor: pointer;
  }

  /* Right, against the backend's own name on the left: the two labels face each
     other across the frontier. */
  .navi_fake_backend_body > .navi_fake_backend_label {
    align-self: end;
  }
`;

/**
 * @param {object} props
 * @param {any} [props.value] - what the backend holds to begin with. Nothing,
 *   when nothing is given: a backend that has never been told anything.
 * @param {(rows: Array) => object} [props.newRow] - makes the backend editable
 *   from its own side: each row of the table gets a ✕ and the table a "+ row",
 *   and this builds the row that "+ row" adds. Use it to see the frontend take
 *   a change it did not ask for.
 * @param {(context: {value: any, action: Function}) => import("preact").ComponentChildren} props.children
 */
// How the backend answers. "manuel" is the default and the reason this whole
// thing exists — a call held is a loading state one can look at for as long as
// one likes. The others are for a page that exercises something else and only
// needs the backend to behave: an answer that is instant, slow, or never good.
const FAKE_BACKEND_MODES = {
  "manuel": null,
  "tout de suite": { delay: 0 },
  "500 ms": { delay: 500 },
  "2 s": { delay: 2000 },
  "échec en 500 ms": { delay: 500, fails: true },
};
export const resolveFakeBackendMode = (mode) => FAKE_BACKEND_MODES[mode];

export const FakeBackendModeSelect = ({ mode, onChange }) => (
  <label className="navi_fake_backend_mode">
    répond
    <select value={mode} onChange={(e) => onChange(e.target.value)}>
      {Object.keys(FAKE_BACKEND_MODES).map((modeName) => (
        <option key={modeName} value={modeName}>
          {modeName}
        </option>
      ))}
    </select>
  </label>
);

/**
 * The mode, and what it does to the call in flight.
 *
 * Applied to the call rather than to the moment it arrives, so switching out of
 * "manuel" releases the one already waiting — otherwise a page left holding a
 * call would need one last press to get out of the mode it just left.
 */
const useFakeBackendMode = (call, { answer, fail }) => {
  const [mode, setMode] = useState("manuel");
  useEffect(() => {
    const automatic = resolveFakeBackendMode(mode);
    if (!call || !automatic) {
      return undefined;
    }
    const timeout = setTimeout(
      automatic.fails ? fail : answer,
      automatic.delay,
    );
    return () => clearTimeout(timeout);
  }, [call, mode]);
  return [mode, setMode];
};

export const FakeBackend = ({ value: valueInitial, newRow, children }) => {
  import.meta.css = css;
  const [value, setValue] = useState(valueInitial);
  // The call in flight, held until someone answers it: what it was given, and
  // the two ways it can end.
  const [call, setCall] = useState(null);

  // A call can be given up on before it is answered — the frontend scrolled
  // past what it went to fetch. It then leaves the frontier the way it would
  // have left the network: dropped, with nobody waiting for it.
  const action = (received, { signal } = {}) =>
    new Promise((resolve, reject) => {
      const call = { received, resolve, reject };
      if (signal) {
        signal.addEventListener("abort", () => {
          setCall((current) => (current === call ? null : current));
          reject(signal.reason ?? new Error("aborted"));
        });
      }
      setCall(call);
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
  const [mode, setMode] = useFakeBackendMode(call, { answer, fail });

  // The backend changing on its own — someone else's edit, a job, a push. No
  // call is in flight for these: the value simply becomes something else and
  // the frontend has to notice.
  const removeRow = (index) => {
    setValue(value.filter((row, rowIndex) => rowIndex !== index));
  };
  const addRow = () => {
    setValue([...value, newRow(value)]);
  };

  return (
    <div className="navi_fake_backend">
      <div className="navi_fake_backend_head">
        <span className="navi_fake_backend_label">backend</span>
        <Value
          value={value}
          onRemoveRow={newRow ? removeRow : undefined}
          onAddRow={newRow ? addRow : undefined}
        />
        <FakeBackendModeSelect mode={mode} onChange={setMode} />
      </div>
      <div className="navi_fake_backend_frontier">
        {call ? (
          <>
            <span className="navi_fake_backend_answer">
              <span className="navi_fake_backend_arrow">↓</span>
              <button type="button" onClick={answer}>
                répondre
              </button>
              <button type="button" onClick={fail}>
                échouer
              </button>
            </span>
            <span className="navi_fake_backend_sent">
              <Value value={call.received} />
              <span className="navi_fake_backend_arrow">↑</span>
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

// A collection is shown as a table, everything else as its JSON. A list of
// records read as one long JSON line is the thing one gives up on reading —
// which defeats the purpose of putting the backend's own state on the page.
const Value = ({ value, onRemoveRow, onAddRow }) => {
  const columnNames = collectColumnNames(value);
  if (!columnNames) {
    return <span className="navi_fake_backend_value">{stringify(value)}</span>;
  }
  return (
    <table className="navi_fake_backend_table">
      <thead>
        <tr>
          {columnNames.map((columnName) => (
            <th key={columnName}>{columnName}</th>
          ))}
          {onRemoveRow && <th aria-hidden="true" />}
        </tr>
      </thead>
      <tbody>
        {value.map((row, index) => (
          <tr key={index}>
            {columnNames.map((columnName) => (
              <td key={columnName}>{stringify(row[columnName])}</td>
            ))}
            {onRemoveRow && (
              <td>
                <button
                  type="button"
                  title="Remove this row from the backend"
                  onClick={() => onRemoveRow(index)}
                >
                  ✕
                </button>
              </td>
            )}
          </tr>
        ))}
        {onAddRow && (
          <tr>
            <td colSpan={columnNames.length + 1}>
              <button
                type="button"
                title="Add a row to the backend"
                onClick={onAddRow}
              >
                + row
              </button>
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};
// The columns of an array of plain records, in the order they appear; null for
// anything else (that is the signal to fall back to JSON).
const collectColumnNames = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }
  const columnNames = [];
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      return null;
    }
    for (const key of Object.keys(row)) {
      if (!columnNames.includes(key)) {
        columnNames.push(key);
      }
    }
  }
  return columnNames;
};

// Nothing is written as nothing: "undefined" through JSON.stringify comes back
// as the empty string, which reads as a bug rather than as an empty backend.
const stringify = (value) =>
  value === undefined
    ? "∅"
    : typeof value === "string"
      ? value
      : JSON.stringify(value);

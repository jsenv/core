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
 * call shows, on the frontier, that whoever made it gave up on it.
 *
 * A call the client aborts does not leave by itself: a cancellation demand
 * rises from the frontend, drawn under the call, and the backend decides —
 * treat it ("annuler la requête": nothing was done, the request is aborted
 * the way fetch would be), or ignore it ("ignorer": cancellations not
 * honored, the request stays free to be answered or failed). That is the
 * truth about aborting a request: it only saves resources, and whether the
 * work happened is known from the backend's answer alone — which is why the
 * client keeps waiting for it (see the abort section in docs/actions.md).
 *
 * Not exported from the package: it is a demo's furniture, not an
 * application's.
 */

import { signal } from "@preact/signals";
import { useEffect, useRef, useState } from "preact/hooks";

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
  .navi_fake_backend_reset {
    padding: 1px 6px;
    color: #546e7a;
    font: inherit;
    font-size: 11px;
    cursor: pointer;
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
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
  /* One line per call in flight — several at once on a page with more than one
     endpoint, and the same single line as ever on a page with one. */
  .navi_fake_backend_call {
    display: flex;
    width: 100%;
    align-items: center;
    gap: 8px;
  }
  .navi_fake_backend_call_label {
    font-size: 12px;
    font-family: monospace;
  }
  .navi_fake_backend_sent,
  .navi_fake_backend_answer {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  /* A call and, when the client gave up on it, the cancellation demand risen
     under it: two crossings about the same request, kept together. */
  .navi_fake_backend_exchange {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: 2px;
  }
  .navi_fake_backend_cancel_demand {
    color: #e65100;
  }
  /* The frontend's word, so it sits on the frontend's side of the call. */
  .navi_fake_backend_cancel_demand_label {
    font-style: italic;
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

// How the backend answers. "manuel" is the default and the reason this whole
// thing exists — a call held is a loading state one can look at for as long as
// one likes. The others are for a page that exercises something else and only
// needs the backend to behave: an answer that is quick, slow, or never good.
const FAKE_BACKEND_MODES = {
  "manuel": null,
  "50 ms": { delay: 50 },
  "500 ms": { delay: 500 },
  "2 s": { delay: 2000 },
  "échec en 500 ms": { delay: 500, fails: true },
};
// Kept across reloads, and shared by every demo: the mode is how one is
// working right now ("leave me alone, answer everything"), not something a
// particular page means. Having to set it again on each reload is what makes it
// go unused.
const MODE_STORAGE_KEY = "navi_fake_backend_mode";
const readStoredMode = () => {
  const stored = localStorage.getItem(MODE_STORAGE_KEY);
  return stored && FAKE_BACKEND_MODES[stored] !== undefined ? stored : "manuel";
};

const FakeBackendModeSelect = ({ mode, onChange }) => (
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
 * The mode, and what it does to the calls in flight.
 *
 * Applied to the calls rather than to the moment they arrive, so switching out
 * of "manuel" releases what is already waiting — otherwise a page left holding
 * a call would need one last press to get out of the mode it just left.
 */
const useFakeBackendMode = (calls, { answer, fail, cancel }) => {
  const [mode, setMode] = useState(readStoredMode);
  useEffect(() => {
    const automatic = FAKE_BACKEND_MODES[mode];
    if (!automatic || calls.length === 0) {
      return undefined;
    }
    const timeouts = [];
    for (const call of calls) {
      // An automatic backend is a well-behaved one: it treats cancellation
      // demands.
      if (call.cancelRequested && !call.cancelIgnored) {
        cancel(call);
        continue;
      }
      timeouts.push(
        setTimeout(
          () => (automatic.fails ? fail(call) : answer(call)),
          automatic.delay,
        ),
      );
    }
    return () => {
      for (const timeout of timeouts) {
        clearTimeout(timeout);
      }
    };
  }, [calls, mode]);
  const chooseMode = (value) => {
    localStorage.setItem(MODE_STORAGE_KEY, value);
    setMode(value);
  };
  return [mode, chooseMode];
};

/**
 * A backend that can be reached from outside the component tree.
 *
 * The one inside `<FakeBackend value>` is enough for a page whose only call is
 * the form it is showing. A page with several endpoints has its calls made from
 * where they belong — a resource's REST callbacks, an api module — which is
 * nowhere near a component, so the backend is created there too and the
 * component is only what draws it.
 *
 * ```js
 * const backend = createFakeBackend({ value: [{ id: "1", name: "…" }] });
 * const GAME = resource("game", {
 *   GET: ({ id }) => backend.call(`GET /games/${id}`, () => findGame(id)),
 * });
 * // …
 * <FakeBackend backend={backend}>{() => <App />}</FakeBackend>
 * ```
 *
 * `produce` is what the call answers, run when the call is answered: it reads
 * the backend as it stands at that moment (not as it stood when the call was
 * made), and throwing from it is how a backend says no on its own — a game that
 * is not there.
 */
export const createFakeBackend = ({ value: valueInitial, persist } = {}) => {
  // Kept across reloads when asked for: a demo one comes back to with the
  // things one created last time is a demo one can keep working in, rather than
  // one where the first minute is spent putting the data back. What was
  // declared here stays the way back — see reset below.
  const readStoredValue = () => {
    if (!persist) {
      return undefined;
    }
    const stored = localStorage.getItem(persist);
    if (!stored) {
      return undefined;
    }
    try {
      return JSON.parse(stored);
    } catch {
      return undefined;
    }
  };
  const storedValue = readStoredValue();
  const valueSignal = signal(
    storedValue === undefined ? valueInitial : storedValue,
  );
  const callsSignal = signal([]);
  let callId = 0;

  const writeValue = (value) => {
    valueSignal.value = value;
    if (persist) {
      localStorage.setItem(persist, JSON.stringify(value));
    }
  };

  const leave = (call) => {
    callsSignal.value = callsSignal.value.filter(
      (candidate) => candidate !== call,
    );
  };
  // A call can be given up on before it is answered — the frontend scrolled
  // past what it went to fetch, a newer request made this one moot. The call
  // stays on the frontier with a cancellation demand under it: only the
  // backend knows whether the work was already done, so it is the one that
  // decides — treat the demand (cancel, see below) or ignore it.
  const call = (label, produce, { received, signal: abortSignal } = {}) =>
    new Promise((resolve, reject) => {
      const call = { id: ++callId, label, received, produce, resolve, reject };
      if (abortSignal) {
        abortSignal.addEventListener("abort", () => {
          call.cancelRequested = true;
          call.cancelReason = abortSignal.reason;
          callsSignal.value = [...callsSignal.value];
        });
      }
      callsSignal.value = [...callsSignal.value, call];
    });

  const backend = {
    valueSignal,
    callsSignal,
    call,
    // The nameless call: what a form sends, answered by the backend taking it
    // as its new state. What a page with one endpoint needs, and all it needs.
    action: (received, options) =>
      call(
        undefined,
        () => {
          writeValue(received);
          return received;
        },
        { ...options, received },
      ),
    setValue: writeValue,
    // Back to what the page declared, and nothing kept from the visits before.
    persists: Boolean(persist),
    reset: () => {
      if (persist) {
        localStorage.removeItem(persist);
      }
      valueSignal.value = valueInitial;
    },
    answer: (call) => {
      leave(call);
      try {
        call.resolve(call.produce());
      } catch (e) {
        call.reject(e);
      }
    },
    fail: (call) => {
      leave(call);
      call.reject(
        new Error(
          call.label
            ? `${call.label}: le serveur a refusé`
            : "Le serveur a refusé l'enregistrement.",
        ),
      );
    },
    // The backend treats the cancellation demand: nothing was done, the
    // request is aborted. The rejection mirrors fetch(url, { signal })
    // exactly: the promise rejects with the signal's reason, verbatim — a
    // DOMException named "AbortError" when abort() was called without one
    // (the platform fills it in). Rejecting with that same reason is also
    // what lets the caller classify the rejection as an abort rather than a
    // failure.
    cancel: (call) => {
      leave(call);
      call.reject(call.cancelReason);
    },
    // The backend ignores the cancellation demand: the request stays, free
    // to be answered or failed.
    ignoreCancel: (call) => {
      call.cancelIgnored = true;
      callsSignal.value = [...callsSignal.value];
    },
  };
  return backend;
};

/**
 * @param {object} props
 * @param {ReturnType<createFakeBackend>} [props.backend] - a backend made
 *   outside the tree (see createFakeBackend), for a page whose calls are made
 *   from where they belong rather than from its children.
 * @param {any} [props.value] - what the backend holds to begin with, when this
 *   component makes it itself. Nothing, when nothing is given: a backend that
 *   has never been told anything.
 * @param {string} [props.persist] - a localStorage key: what the backend holds
 *   is kept across reloads, and a "repartir de zéro" button appears next to the
 *   mode.
 * @param {(rows: Array) => object} [props.newRow] - makes the backend editable
 *   from its own side: each row of the table gets a ✕ and the table a "+ row",
 *   and this builds the row that "+ row" adds. Use it to see the frontend take
 *   a change it did not ask for.
 * @param {(context: {value: any, action: Function, call: Function}) => import("preact").ComponentChildren} props.children
 */
export const FakeBackend = ({
  backend: backendFromProps,
  value: valueInitial,
  persist,
  newRow,
  children,
}) => {
  import.meta.css = css;
  const ownBackendRef = useRef(null);
  if (!backendFromProps && !ownBackendRef.current) {
    ownBackendRef.current = createFakeBackend({ value: valueInitial, persist });
  }
  const backend = backendFromProps || ownBackendRef.current;
  const value = backend.valueSignal.value;
  const calls = backend.callsSignal.value;
  const [mode, setMode] = useFakeBackendMode(calls, backend);

  // The backend changing on its own — someone else's edit, a job, a push. No
  // call is in flight for these: the value simply becomes something else and
  // the frontend has to notice.
  const removeRow = (index) => {
    backend.setValue(value.filter((row, rowIndex) => rowIndex !== index));
  };
  const addRow = () => {
    backend.setValue([...value, newRow(value)]);
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
        {backend.persists ? (
          <button
            type="button"
            className="navi_fake_backend_reset"
            onClick={backend.reset}
          >
            repartir de zéro
          </button>
        ) : null}
      </div>
      <div className="navi_fake_backend_frontier">
        {calls.map((call) => {
          // The call keeps its own answers even while the demand waits:
          // answering or failing it IS a way of ignoring the demand.
          const cancelDemandPending =
            call.cancelRequested && !call.cancelIgnored;
          return (
            <div key={call.id} className="navi_fake_backend_exchange">
              <div className="navi_fake_backend_call">
                <span className="navi_fake_backend_answer">
                  <span className="navi_fake_backend_arrow">↓</span>
                  <button type="button" onClick={() => backend.answer(call)}>
                    répondre
                  </button>
                  <button type="button" onClick={() => backend.fail(call)}>
                    échouer
                  </button>
                </span>
                {call.label ? (
                  <span className="navi_fake_backend_call_label">
                    {call.label}
                  </span>
                ) : null}
                <span className="navi_fake_backend_sent">
                  {call.received === undefined ? null : (
                    <Value value={call.received} />
                  )}
                  <span className="navi_fake_backend_arrow">↑</span>
                </span>
              </div>
              {cancelDemandPending ? (
                <div className="navi_fake_backend_call navi_fake_backend_cancel_demand">
                  <span className="navi_fake_backend_answer">
                    <span className="navi_fake_backend_arrow">↓</span>
                    <button type="button" onClick={() => backend.cancel(call)}>
                      annuler la requête
                    </button>
                    <button
                      type="button"
                      onClick={() => backend.ignoreCancel(call)}
                    >
                      ignorer
                    </button>
                  </span>
                  <span className="navi_fake_backend_sent">
                    <span className="navi_fake_backend_cancel_demand_label">
                      demande d'annulation
                    </span>
                    <span className="navi_fake_backend_arrow">↑</span>
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="navi_fake_backend_body">
        <span className="navi_fake_backend_label">frontend</span>
        {children({ value, action: backend.action, call: backend.call })}
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

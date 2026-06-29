import { signal } from "@preact/signals";
import { useEffect, useRef } from "preact/hooks";

const TYPE_COLORS = {
  initial: { bg: "#f1f5f9", text: "#64748b", label: "initial" },
  push: { bg: "#dcfce7", text: "#16a34a", label: "push" },
  replace: { bg: "#dbeafe", text: "#1d4ed8", label: "replace" },
  traverse: { bg: "#fef9c3", text: "#b45309", label: "traverse" },
};

let nextId = 1;
const addEntry = (type, url, state) => {
  navEntriesSignal.value = [
    ...navEntriesSignal.value,
    { id: nextId++, type, url, state },
  ].slice(-30);
};

// Capture the document state before any component mounts.
const navEntriesSignal = signal([
  {
    id: nextId++,
    type: "initial",
    url: window.location.href,
    state: window.history.state,
  },
]);

const formatState = (state) => {
  if (!state) return null;
  const display = { ...state };
  // jsenv_visited_urls is an internal implementation detail — collapse it.
  if (Array.isArray(display.jsenv_visited_urls)) {
    display.jsenv_visited_urls = `[${display.jsenv_visited_urls.length} url(s)]`;
  }
  return JSON.stringify(display, null, 2);
};

const baseDir = window.location.pathname.replace(/\/[^/]*$/, "/");
const relativeUrl = (url) => {
  try {
    const u = new URL(url);
    if (u.origin !== window.location.origin) return url;
    const path = u.pathname.startsWith(baseDir)
      ? u.pathname.slice(baseDir.length) || "."
      : u.pathname;
    return path + u.search + u.hash;
  } catch {
    return url;
  }
};

const history = window.history;
export const NavInspect = () => {
  useEffect(() => {
    // Patch history.pushState / replaceState to intercept via_history.js calls.
    // When via_navigation.js is adopted, replace this with a "navigate" event
    // listener on window.navigation instead.
    const origPush = history.pushState.bind(history);
    history.pushState = (state, title, url) => {
      origPush(state, title, url);
      addEntry("push", String(url ?? window.location.href), state);
    };

    const origReplace = history.replaceState.bind(history);
    history.replaceState = (state, title, url) => {
      origReplace(state, title, url);
      addEntry("replace", String(url ?? window.location.href), state);
    };

    const onPopstate = (e) => {
      addEntry("traverse", window.location.href, e.state);
    };
    window.addEventListener("popstate", onPopstate);

    return () => {
      history.pushState = origPush;
      history.replaceState = origReplace;
      window.removeEventListener("popstate", onPopstate);
    };
  }, []);

  const entries = navEntriesSignal.value;
  const scrollRef = useRef(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [entries]);

  return (
    <div
      style={{
        fontFamily: "monospace",
        fontSize: "12px",
        border: "1px solid #e2e8f0",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          fontWeight: "600",
          fontSize: "11px",
          color: "#475569",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        Nav Inspect
      </div>
      <div
        ref={scrollRef}
        style={{
          maxHeight: "320px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {entries.map((entry) => {
          const colors = TYPE_COLORS[entry.type] ?? TYPE_COLORS.initial;
          const stateStr = formatState(entry.state);
          return (
            <div
              key={entry.id}
              style={{
                display: "grid",
                gridTemplateColumns: "70px 1fr",
                gap: "6px 10px",
                padding: "8px 12px",
                borderBottom: "1px solid #f1f5f9",
                alignItems: "start",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "1px 6px",
                  borderRadius: "3px",
                  background: colors.bg,
                  color: colors.text,
                  fontWeight: "600",
                  fontSize: "10px",
                  whiteSpace: "nowrap",
                  textAlign: "center",
                }}
              >
                {colors.label}
              </span>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  minWidth: "0",
                }}
              >
                <span
                  style={{
                    color: "#1e293b",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                  title={entry.url}
                >
                  {relativeUrl(entry.url)}
                </span>
                {stateStr ? (
                  <pre
                    style={{
                      margin: "0",
                      padding: "4px 8px",
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "3px",
                      color: "#475569",
                      fontSize: "11px",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {stateStr}
                  </pre>
                ) : (
                  <span style={{ color: "#94a3b8" }}>(no state)</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

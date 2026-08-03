/*
 * Injected into every dev-server page. Gives this browser a stable "client id"
 * (and this browsing context a "tab id"), reports what the tab is doing to the
 * dev server, and shows a toast when another client appears (or resumes) —
 * inviting the user to open that client's live-log monitor.
 *
 * It does NOT open a websocket: server → browser messages ride the existing
 * jsenv server-events channel (window.__server_events__), and browser → server
 * messages are batched POSTs to /.internal/clients/report carrying:
 * - the tab (id, url, title, visibility)
 * - recent qualified activities (load, hot_reload, click, keydown, mousemove,
 *   scroll, request, navigation, document_becomes_visible/hidden)
 * - buffered console logs
 */

const CLIENT_ID_STORAGE_KEY = "jsenv_client_id";
const TAB_ID_STORAGE_KEY = "jsenv_tab_id";
const REPORT_ENDPOINT = "/.internal/clients/report";
// Flush buffered logs/activities at most this often (a chatty page shouldn't
// POST per line).
const FLUSH_INTERVAL_MS = 1000;
// Heartbeat so the server keeps seeing this client as "online" while the page is
// open, and notices when it is picked back up after a quiet spell.
const HEARTBEAT_MS = 15000;
// Continuous activities (mousemove, scroll) only need to refresh "what the tab
// is doing" occasionally, not on every event.
const CONTINUOUS_THROTTLE_MS = 2000;

const randomId = () =>
  typeof window.crypto !== "undefined" && window.crypto.randomUUID
    ? window.crypto.randomUUID()
    : `${String(Math.random()).slice(2)}${Date.now().toString(36)}`;

const getClientId = () => {
  try {
    let id = localStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    // storage may be unavailable (private mode, sandbox) — a per-load id is fine.
    return `anon-${Date.now().toString(36)}`;
  }
};

// sessionStorage is per-tab and survives a reload, so it's a good tab identity.
const getTabId = () => {
  try {
    let id = sessionStorage.getItem(TAB_ID_STORAGE_KEY);
    if (!id) {
      id = randomId();
      sessionStorage.setItem(TAB_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `tab-${Date.now().toString(36)}`;
  }
};

// Best-effort, non-throwing stringify of console arguments.
const jsonReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";
      }
      seen.add(value);
    }
    if (typeof value === "function") {
      return `[Function ${value.name || "anonymous"}]`;
    }
    if (typeof value === "bigint") {
      return `${value}n`;
    }
    return value;
  };
};
const formatArg = (arg) => {
  if (typeof arg === "string") {
    return arg;
  }
  if (arg instanceof Error) {
    return arg.stack || `${arg.name}: ${arg.message}`;
  }
  if (arg === undefined) {
    return "undefined";
  }
  try {
    return JSON.stringify(arg, jsonReplacer());
  } catch {
    return String(arg);
  }
};
// Reproduce console formatting: %c sets CSS for the following text, %s/%d/%i/%f
// substitute values, %o/%O stringify objects. Returns a plain `text` (no CSS,
// good for copy/paste) plus, when any styling is present, `segments` of
// { text, css } so the monitor can render colors like the devtools console do.
const formatConsole = (args) => {
  const first = args[0];
  if (typeof first !== "string" || !/%[csdifoO]/.test(first)) {
    return { text: args.map(formatArg).join(" ") };
  }
  const segments = [];
  let buffer = "";
  let css = "";
  const flush = () => {
    if (buffer) {
      segments.push({ text: buffer, css });
      buffer = "";
    }
  };
  let argIndex = 1;
  let i = 0;
  while (i < first.length) {
    const char = first[i];
    const spec = char === "%" ? first[i + 1] : "";
    if (spec === "%") {
      buffer += "%";
      i += 2;
    } else if (spec === "c") {
      flush();
      css = argIndex < args.length ? String(args[argIndex++]) : "";
      i += 2;
    } else if (spec !== "" && "sdifoO".includes(spec)) {
      const value = argIndex < args.length ? args[argIndex++] : undefined;
      buffer += spec === "s" ? String(value) : formatArg(value);
      i += 2;
    } else {
      buffer += char;
      i += 1;
    }
  }
  flush();
  while (argIndex < args.length) {
    segments.push({ text: ` ${formatArg(args[argIndex++])}`, css: "" });
  }
  const text = segments.map((segment) => segment.text).join("");
  const styled = segments.some((segment) => segment.css);
  return styled ? { text, segments } : { text };
};

const setup = () => {
  const clientId = getClientId();
  const tabId = getTabId();
  // Use the unwrapped fetch for our own reports so they don't count as activity.
  const nativeFetch = window.fetch.bind(window);

  const tabInfo = ({ closing = false } = {}) => ({
    id: tabId,
    url: window.location.href,
    title: document.title,
    visible: document.visibilityState === "visible",
    closing,
  });

  // Buffer logs and activities; POST them (with the current tab) in batches. The
  // server reads the browser and OS from the request's own headers, so the body
  // only carries the id, tab, activities and log entries.
  let pendingLogs = [];
  let pendingActivities = [];
  const post = async ({ beacon = false, closing = false } = {}) => {
    const logs = pendingLogs;
    const activities = pendingActivities;
    pendingLogs = [];
    pendingActivities = [];
    const payload = JSON.stringify({
      clientId,
      tab: tabInfo({ closing }),
      activities,
      logs,
    });
    if (beacon && window.navigator.sendBeacon) {
      window.navigator.sendBeacon(
        REPORT_ENDPOINT,
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
    try {
      await nativeFetch(REPORT_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      });
    } catch {
      // dev server gone or offline — dropping the report is acceptable.
    }
  };

  // A page can declare itself perf critical (window.__jsenv_perf_critical__()):
  // measuring an animation means nothing if the thing measuring it steals a
  // frame. Monitoring then holds everything back until the page has been
  // genuinely idle — no interaction for a while — instead of flushing on its
  // own schedule.
  let perfCritical = false;
  let lastInteractionMs = 0;
  const PERF_CRITICAL_QUIET_MS = 2000;
  const isQuiet = () =>
    !perfCritical || Date.now() - lastInteractionMs > PERF_CRITICAL_QUIET_MS;
  const onInteraction = () => {
    lastInteractionMs = Date.now();
  };
  for (const eventName of ["pointerdown", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(eventName, onInteraction, {
      capture: true,
      passive: true,
    });
  }

  let flushScheduled = false;
  const scheduleFlush = () => {
    if (flushScheduled) {
      return;
    }
    flushScheduled = true;
    const attempt = () => {
      if (!isQuiet()) {
        // Still being used: come back later rather than take the frame now.
        setTimeout(attempt, PERF_CRITICAL_QUIET_MS);
        return;
      }
      flushScheduled = false;
      if (!pendingLogs.length && !pendingActivities.length) {
        return;
      }
      post();
    };
    setTimeout(attempt, FLUSH_INTERVAL_MS);
  };

  const pushLog = (entry) => {
    pendingLogs.push({ ...entry, ts: entry.ts ?? Date.now() });
    if (pendingLogs.length > 500) {
      pendingLogs.shift(); // cap the buffer if the server is unreachable
    }
    scheduleFlush();
  };

  // Formatting a console call (%c parsing + serializing object args) is
  // expensive, and verbose debug logging fires it hundreds of times inside a
  // single interaction — enough to dominate the main thread and delay paint.
  // So capture the raw args cheaply on the hot path and format them only when
  // the browser is idle (chunked to respect the idle deadline). Serialization
  // is kept in full; it just no longer blocks the interaction.
  const rawConsoleQueue = [];
  let consoleProcessScheduled = false;
  // requestIdleCallback is missing on Safari/iOS (our main mobile target), so
  // fall back to setTimeout there; either way each run is time-boxed below.
  // Named on window rather than exported: the page that needs it is a plain
  // html file, and it must be able to ask before anything else has loaded.
  window.__jsenv_perf_critical__ = () => {
    perfCritical = true;
  };

  const scheduleIdle =
    typeof requestIdleCallback === "function"
      ? (fn) => requestIdleCallback(fn, { timeout: 1000 })
      : (fn) => setTimeout(fn, 0);
  const formatOne = (captured) => {
    pushLog({
      level: captured.level,
      ts: captured.ts,
      ...formatConsole(captured.args),
    });
  };
  const processConsoleQueue = (deadline) => {
    consoleProcessScheduled = false;
    const start = performance.now();
    while (rawConsoleQueue.length) {
      // Yield within ~8ms (setTimeout fallback) or when idle time runs out (rIC),
      // so a burst of logs never becomes a long task itself.
      const outOfTime = deadline
        ? !deadline.didTimeout && deadline.timeRemaining() <= 1
        : performance.now() - start > 8;
      if (outOfTime) {
        break;
      }
      formatOne(rawConsoleQueue.shift());
    }
    if (rawConsoleQueue.length) {
      scheduleConsoleProcess();
    }
  };
  const scheduleConsoleProcess = () => {
    if (consoleProcessScheduled) {
      return;
    }
    consoleProcessScheduled = true;
    scheduleIdle(processConsoleQueue);
  };
  // Format everything now (page unloading — losing logs is worse than the cost).
  const drainConsoleQueue = () => {
    while (rawConsoleQueue.length) {
      formatOne(rawConsoleQueue.shift());
    }
  };
  const captureConsole = (level, args) => {
    rawConsoleQueue.push({ level, args, ts: Date.now() });
    if (rawConsoleQueue.length > 2000) {
      rawConsoleQueue.shift(); // bound memory if idle never runs
    }
    scheduleConsoleProcess();
  };
  const recordActivity = (type, detail = "") => {
    pendingActivities.push({ type, detail, ts: Date.now(), tabId });
    if (pendingActivities.length > 50) {
      pendingActivities.shift();
    }
    scheduleFlush();
  };

  // Forward console.* while keeping the original behavior intact.
  const LEVELS = ["log", "info", "warn", "error", "debug"];
  for (const level of LEVELS) {
    const original = console[level];
    if (typeof original !== "function") {
      continue;
    }
    console[level] = (...args) => {
      original.apply(console, args);
      captureConsole(level, args);
    };
  }
  window.addEventListener("error", (event) => {
    const location = event.filename
      ? ` (${event.filename}:${event.lineno})`
      : "";
    pushLog({ level: "error", text: `${event.message}${location}` });
  });
  window.addEventListener("unhandledrejection", (event) => {
    pushLog({
      level: "error",
      text: `Unhandled rejection: ${formatArg(event.reason)}`,
    });
  });

  // Qualified activity so the dashboard can say what the tab was last doing.
  // The detail is kept short enough to read inline (e.g. "mousemove: 40/120").
  window.addEventListener(
    "click",
    (event) => recordActivity("click", `${event.clientX}/${event.clientY}`),
    { passive: true },
  );
  window.addEventListener(
    "keydown",
    (event) => recordActivity("keydown", event.key),
    { passive: true },
  );
  let lastMove = 0;
  let lastScroll = 0;
  window.addEventListener(
    "mousemove",
    (event) => {
      const t = Date.now();
      if (t - lastMove < CONTINUOUS_THROTTLE_MS) {
        return;
      }
      lastMove = t;
      recordActivity("mousemove", `${event.clientX}/${event.clientY}`);
    },
    { passive: true },
  );
  window.addEventListener(
    "scroll",
    () => {
      const t = Date.now();
      if (t - lastScroll < CONTINUOUS_THROTTLE_MS) {
        return;
      }
      lastScroll = t;
      recordActivity("scroll", `${window.scrollX}/${window.scrollY}`);
    },
    { passive: true },
  );
  document.addEventListener("visibilitychange", () => {
    // Spell out the direction so the activity reads meaningfully on its own,
    // rather than a bare "visibility" whose value you have to interpret.
    recordActivity(
      document.visibilityState === "visible"
        ? "document_becomes_visible"
        : "document_becomes_hidden",
    );
    // push promptly so the dashboard's "active tab" tracks focus changes
    post();
  });

  // Report outgoing HTTP requests (skipping our own internal traffic).
  const isInternal = (url) => String(url).includes("/.internal/");
  window.fetch = (input, init) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
    if (!isInternal(url)) {
      const method =
        (init && init.method) ||
        (input instanceof Request ? input.method : "GET");
      recordActivity("request", `${method} ${url}`);
    }
    return nativeFetch(input, init);
  };
  // SPA navigations (history API + back/forward).
  const reportNavigation = () =>
    recordActivity("navigation", window.location.href);
  const patchHistory = (method) => {
    const original = window.history[method];
    if (typeof original !== "function") {
      return;
    }
    window.history[method] = (...args) => {
      const result = original.apply(window.history, args);
      reportNavigation();
      return result;
    };
  };
  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", reportNavigation);

  // Record the page load itself as an activity: after a reload the tab goes
  // hidden (pagehide on the old page) then loads again here, and without this the
  // dashboard would only ever show the "hidden" side of a reload. Sent with the
  // first heartbeat below.
  recordActivity("load", window.location.href);

  // Heartbeat keeps the client "online", refreshes tab info, and lets the server
  // detect a resume.
  post();
  const heartbeatId = setInterval(() => post(), HEARTBEAT_MS);
  window.addEventListener("pagehide", () => {
    clearInterval(heartbeatId);
    // Format whatever was captured but not yet processed, so the final beacon
    // doesn't drop logs.
    drainConsoleQueue();
    post({ beacon: true, closing: true });
  });

  // Toast when another client appears, and obey pilot commands aimed at us —
  // both reuse the server-events channel. window.__server_events__ is injected
  // before this script, so it's ready.
  window.__server_events__.listenEvents({
    client_here: (event) => {
      const { client, reason } = event.data;
      if (client.id === clientId) {
        return; // don't toast a client about itself
      }
      showClientToast({ client, reason });
    },
    client_command: (event) => {
      const { clientId: targetId, tabId: targetTabId, type, url } = event.data;
      if (targetId !== clientId) {
        return; // aimed at another client
      }
      if (targetTabId && targetTabId !== tabId) {
        return; // aimed at a specific tab of this client, not this one
      }
      if (type === "navigate" && url) {
        window.location.href = url;
      } else if (type === "reload") {
        window.location.reload();
      }
    },
    // jsenv autoreload broadcasts "reload" for hot updates and full reloads. A
    // full reload navigates away before this flushes and surfaces as "load" on
    // the next page; a hot update stays on the page, so this is what records it.
    reload: (event) => {
      const data = event.data || {};
      const reason =
        (typeof data.reason === "string" && data.reason) ||
        (typeof data.cause === "string" && data.cause) ||
        "";
      recordActivity("hot_reload", reason);
    },
  });
};

// "Chrome 149 · iOS 17.2" from the parsed runtime/os, falling back gracefully.
const describeClient = (client) => {
  const version = (v) => (v && v !== "unknown" ? ` ${v.split(".")[0]}` : "");
  const runtime = client.runtime || {};
  const os = client.os || {};
  const browserLabel =
    runtime.name && runtime.name !== "unknown"
      ? `${runtime.name}${version(runtime.version)}`
      : "";
  const osLabel =
    os.name && os.name !== "unknown" ? `${os.name}${version(os.version)}` : "";
  return (
    [browserLabel, osLabel].filter(Boolean).join(" · ") || "unknown client"
  );
};

const showClientToast = ({ client, reason }) => {
  const label =
    reason === "new" ? "A new client connected" : "A client resumed";
  const el = document.createElement("div");
  el.setAttribute("data-jsenv-client-toast", "");
  el.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "right:16px",
    "bottom:16px",
    "max-width:320px",
    "padding:12px 14px",
    "font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif",
    "color:#fff",
    "background:#1f2937",
    "border-radius:8px",
    "box-shadow:0 6px 20px rgba(0,0,0,0.35)",
  ].join(";");
  el.innerHTML = `<div style="font-weight:600;margin-bottom:4px">${label}</div><div style="opacity:.8;margin-bottom:8px">${describeClient(client)}</div>`;
  const link = document.createElement("a");
  link.href = `/.internal/client?id=${encodeURIComponent(client.id)}`;
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Monitor ↗";
  link.style.cssText = "color:#93c5fd;text-decoration:none;font-weight:600";
  el.appendChild(link);
  const close = document.createElement("button");
  close.textContent = "✕";
  close.style.cssText =
    "position:absolute;top:6px;right:8px;background:none;border:none;color:#9ca3af;cursor:pointer;font-size:12px";
  close.onclick = () => el.remove();
  el.appendChild(close);
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 12000);
};

window.__client_monitoring__ = { setup };

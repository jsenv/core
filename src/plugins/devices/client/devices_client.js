/*
 * Injected into every dev-server page. Gives this browser a stable "device id"
 * (and this browsing context a "tab id"), reports what the tab is doing to the
 * dev server, and shows a toast when another device appears (or resumes) —
 * inviting the user to open that device's live-log monitor.
 *
 * It does NOT open a websocket: server → browser messages ride the existing
 * jsenv server-events channel (window.__server_events__), and browser → server
 * messages are batched POSTs to /.internal/devices/log carrying:
 * - the tab (id, url, title, visibility)
 * - recent qualified activities (click, keydown, mousemove, scroll, request,
 *   navigation, visibility)
 * - buffered console logs
 */

const DEVICE_ID_STORAGE_KEY = "jsenv_device_id";
const TAB_ID_STORAGE_KEY = "jsenv_tab_id";
const LOG_ENDPOINT = "/.internal/devices/log";
// Flush buffered logs/activities at most this often (a chatty page shouldn't
// POST per line).
const FLUSH_INTERVAL_MS = 1000;
// Heartbeat so the server keeps seeing this device as "online" while the page is
// open, and notices when it is picked back up after a quiet spell.
const HEARTBEAT_MS = 15000;
// Continuous activities (mousemove, scroll) only need to refresh "what the tab
// is doing" occasionally, not on every event.
const CONTINUOUS_THROTTLE_MS = 2000;

const randomId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${String(Math.random()).slice(2)}${Date.now().toString(36)}`;

const getDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id = randomId();
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
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
  const deviceId = getDeviceId();
  const tabId = getTabId();
  // Use the unwrapped fetch for our own reports so they don't count as activity.
  const nativeFetch = window.fetch.bind(window);

  const tabInfo = ({ closing = false } = {}) => ({
    id: tabId,
    url: location.href,
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
      deviceId,
      tab: tabInfo({ closing }),
      activities,
      logs,
    });
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(
        LOG_ENDPOINT,
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
    try {
      await nativeFetch(LOG_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      });
    } catch {
      // dev server gone or offline — dropping the report is acceptable.
    }
  };

  let flushScheduled = false;
  const scheduleFlush = () => {
    if (flushScheduled) {
      return;
    }
    flushScheduled = true;
    setTimeout(() => {
      flushScheduled = false;
      if (!pendingLogs.length && !pendingActivities.length) {
        return;
      }
      post();
    }, FLUSH_INTERVAL_MS);
  };

  const pushLog = (entry) => {
    pendingLogs.push({ ...entry, ts: Date.now() });
    if (pendingLogs.length > 500) {
      pendingLogs.shift(); // cap the buffer if the server is unreachable
    }
    scheduleFlush();
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
      pushLog({ level, ...formatConsole(args) });
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
    recordActivity("visibility", document.visibilityState);
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
  const reportNavigation = () => recordActivity("navigation", location.href);
  const patchHistory = (method) => {
    const original = history[method];
    if (typeof original !== "function") {
      return;
    }
    history[method] = (...args) => {
      const result = original.apply(history, args);
      reportNavigation();
      return result;
    };
  };
  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", reportNavigation);

  // Heartbeat keeps the device "online", refreshes tab info, and lets the server
  // detect a resume.
  post();
  const heartbeatId = setInterval(() => post(), HEARTBEAT_MS);
  window.addEventListener("pagehide", () => {
    clearInterval(heartbeatId);
    post({ beacon: true, closing: true });
  });

  // Toast when another device appears — reusing the server-events channel.
  // window.__server_events__ is injected before this script, so it's ready.
  window.__server_events__.listenEvents({
    device_here: (event) => {
      const { device, reason } = event.data;
      if (device.id === deviceId) {
        return; // don't toast a device about itself
      }
      showDeviceToast({ device, reason });
    },
  });
};

// "Chrome 149 · iOS 17.2" from the parsed runtime/os, falling back gracefully.
const describeDevice = (device) => {
  const version = (v) => (v && v !== "unknown" ? ` ${v.split(".")[0]}` : "");
  const runtime = device.runtime || {};
  const os = device.os || {};
  const browserLabel =
    runtime.name && runtime.name !== "unknown"
      ? `${runtime.name}${version(runtime.version)}`
      : "";
  const osLabel =
    os.name && os.name !== "unknown" ? `${os.name}${version(os.version)}` : "";
  return (
    [browserLabel, osLabel].filter(Boolean).join(" · ") || "unknown device"
  );
};

const showDeviceToast = ({ device, reason }) => {
  const label =
    reason === "new" ? "A new device connected" : "A device resumed";
  const el = document.createElement("div");
  el.setAttribute("data-jsenv-device-toast", "");
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
  el.innerHTML = `<div style="font-weight:600;margin-bottom:4px">${label}</div><div style="opacity:.8;margin-bottom:8px">${describeDevice(device)}</div>`;
  const link = document.createElement("a");
  link.href = `/.internal/device?id=${encodeURIComponent(device.id)}`;
  link.target = "_blank";
  link.textContent = "Monitor its logs →";
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

window.__devices__ = { setup };

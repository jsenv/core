/*
 * Injected into every dev-server page. Gives this browser a stable "device id",
 * forwards its console.* output to the dev server over a plain HTTP POST, and
 * shows a toast when another device appears (or resumes) — inviting the user to
 * open that device's live-log monitor.
 *
 * It does NOT open a websocket: server → browser messages ride the existing
 * jsenv server-events channel (window.__server_events__), and browser → server
 * messages are batched POSTs to /.internal/devices/log.
 */

const DEVICE_ID_STORAGE_KEY = "jsenv_device_id";
const LOG_ENDPOINT = "/.internal/devices/log";
// Flush buffered logs at most this often (a chatty page shouldn't POST per line).
const FLUSH_INTERVAL_MS = 1000;
// Heartbeat so the server keeps seeing this device as "online" while the page is
// open, and notices when it is picked back up after a quiet spell.
const HEARTBEAT_MS = 15000;

const getDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `${String(Math.random()).slice(2)}${Date.now().toString(36)}`;
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    // storage may be unavailable (private mode, sandbox) — a per-load id is fine.
    return `anon-${Date.now().toString(36)}`;
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
const formatArgs = (args) => args.map(formatArg).join(" ");

const setup = () => {
  const deviceId = getDeviceId();

  // Buffer log entries and POST them in batches. The server reads the browser
  // and OS from the request's own user-agent/sec-ch-ua headers, so the body
  // only carries the id and the log entries.
  let pending = [];
  const post = async (entries, { beacon = false } = {}) => {
    const payload = JSON.stringify({ deviceId, entries });
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(
        LOG_ENDPOINT,
        new Blob([payload], { type: "application/json" }),
      );
      return;
    }
    try {
      await fetch(LOG_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: payload,
        keepalive: true,
      });
    } catch {
      // dev server gone or offline — dropping logs is acceptable.
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
      if (!pending.length) {
        return;
      }
      const entries = pending;
      pending = [];
      post(entries);
    }, FLUSH_INTERVAL_MS);
  };
  const record = (level, text) => {
    pending.push({ level, text, ts: Date.now() });
    if (pending.length > 500) {
      pending.shift(); // cap the buffer if the server is unreachable
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
      record(level, formatArgs(args));
    };
  }
  window.addEventListener("error", (event) => {
    const location = event.filename
      ? ` (${event.filename}:${event.lineno})`
      : "";
    record("error", `${event.message}${location}`);
  });
  window.addEventListener("unhandledrejection", (event) => {
    record("error", `Unhandled rejection: ${formatArg(event.reason)}`);
  });

  // Heartbeat keeps the device "online" and lets the server detect a resume.
  post([]);
  const heartbeatId = setInterval(() => post([]), HEARTBEAT_MS);
  window.addEventListener("pagehide", () => {
    clearInterval(heartbeatId);
    if (pending.length) {
      const entries = pending;
      pending = [];
      post(entries, { beacon: true });
    }
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

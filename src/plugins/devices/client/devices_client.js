/*
 * Injected into every dev-server page. Gives this browser a stable "device id",
 * opens a WebSocket to the dev server, forwards its console.* output over it,
 * and shows a toast when another device connects (or resumes) — inviting the
 * user to open that device's live-log tracker.
 */

const DEVICE_ID_STORAGE_KEY = "jsenv_device_id";
// Don't spam the server with an "activity" message on every pointer/key event.
const ACTIVITY_THROTTLE_MS = 5000;

const getDeviceId = () => {
  try {
    let id = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Math.random()).slice(2) + Date.now().toString(36);
      localStorage.setItem(DEVICE_ID_STORAGE_KEY, id);
    }
    return id;
  } catch {
    // storage may be unavailable (private mode, sandbox) — a per-load id is fine.
    return "anon-" + Date.now().toString(36);
  }
};

// Best-effort, non-throwing stringify of console arguments.
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
const formatArgs = (args) => args.map(formatArg).join(" ");

const setup = () => {
  const deviceId = getDeviceId();
  const wsUrl = `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/.internal/devices.websocket?role=device&deviceId=${encodeURIComponent(deviceId)}`;

  let socket = null;
  // Buffer logs produced before/while the socket is (re)connecting.
  const pending = [];
  const flush = () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    while (pending.length) {
      socket.send(JSON.stringify(pending.shift()));
    }
  };
  const send = (message) => {
    pending.push(message);
    if (pending.length > 500) {
      pending.shift(); // cap the offline buffer
    }
    flush();
  };

  let reconnectDelay = 500;
  const connect = () => {
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      scheduleReconnect();
      return;
    }
    socket.addEventListener("open", () => {
      reconnectDelay = 500;
      flush();
    });
    socket.addEventListener("message", (e) => {
      let event;
      try {
        event = JSON.parse(e.data);
      } catch {
        return;
      }
      if (event.type === "device_here") {
        showDeviceToast(event);
      }
    });
    socket.addEventListener("close", scheduleReconnect);
    socket.addEventListener("error", () => {
      try {
        socket.close();
      } catch {
        // already closing
      }
    });
  };
  let reconnectTimeout;
  const scheduleReconnect = () => {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 10000);
  };
  connect();

  // Forward console.* — keeping the original behavior intact.
  const LEVELS = ["log", "info", "warn", "error", "debug"];
  for (const level of LEVELS) {
    const original = console[level];
    if (typeof original !== "function") {
      continue;
    }
    console[level] = (...args) => {
      original.apply(console, args);
      send({ type: "log", level, text: formatArgs(args), ts: Date.now() });
    };
  }
  // Also capture uncaught errors and unhandled rejections.
  window.addEventListener("error", (e) => {
    send({
      type: "log",
      level: "error",
      text: e.message + (e.filename ? ` (${e.filename}:${e.lineno})` : ""),
      ts: Date.now(),
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    send({
      type: "log",
      level: "error",
      text: "Unhandled rejection: " + formatArg(e.reason),
      ts: Date.now(),
    });
  });

  // Report genuine user activity (throttled) so the server can tell when a
  // device is picked back up after a quiet spell.
  let lastActivitySent = 0;
  const reportActivity = () => {
    const now = Date.now();
    if (now - lastActivitySent < ACTIVITY_THROTTLE_MS) {
      return;
    }
    lastActivitySent = now;
    send({ type: "activity", ts: now });
  };
  for (const type of ["pointerdown", "keydown"]) {
    window.addEventListener(type, reportActivity, { passive: true });
  }

  window.addEventListener("pagehide", () => {
    try {
      socket?.close();
    } catch {
      // ignore
    }
  });
};

const showDeviceToast = (event) => {
  const { device, reason } = event;
  const label =
    reason === "new"
      ? "A new device connected"
      : reason === "reconnected"
        ? "A device reconnected"
        : "A device resumed";
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
  const shortUA = (device.userAgent || "unknown").slice(0, 60);
  el.innerHTML = `<div style="font-weight:600;margin-bottom:4px">${label}</div><div style="opacity:.8;margin-bottom:8px">${shortUA}</div>`;
  const link = document.createElement("a");
  link.href = `/.internal/device?id=${encodeURIComponent(device.id)}`;
  link.target = "_blank";
  link.textContent = "Track its logs →";
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

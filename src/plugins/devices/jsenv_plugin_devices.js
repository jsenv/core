/*
 * Devices plugin (dev only)
 * -------------------------
 * Tracks every browser "device" that connects to the dev server and lets you
 * watch a device's console logs from another device (e.g. read a phone's logs
 * from the desktop).
 *
 * - Every page gets a small client (client/devices_client.js) that assigns a
 *   stable device id, opens a WebSocket to /.internal/devices.websocket, and
 *   forwards its console.* calls over it. It also shows an in-page toast when
 *   another device connects (or resumes after inactivity), inviting the user to
 *   open that device's tracker page.
 * - The server keeps an in-memory registry of devices seen since it started,
 *   plus a short-lived, size-capped ring buffer of each device's logs so a
 *   tracker opened slightly late still sees the recent history.
 * - /.internal/devices        → dashboard listing devices
 * - /.internal/device?id=…    → per-device live log tracker
 * - /.internal/devices.json   → registry snapshot (dashboard polls it)
 * - /.internal/devices.websocket?role=device|tracker → the live channel
 */

import { readFileSync } from "node:fs";
import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";
import { WebSocketResponse } from "@jsenv/server";

const devicesClientFileUrl = new URL(
  "./client/devices_client.js",
  import.meta.url,
).href;
const devicesPageFileUrl = new URL("./client/devices_page.html", import.meta.url);
const deviceTrackerPageFileUrl = new URL(
  "./client/device_tracker_page.html",
  import.meta.url,
);

// Keep at most this many log entries per device, and drop entries older than
// LOG_TTL_MS — the buffer only exists so a tracker opened a bit late can still
// show recent history; it is not a persistent store.
const LOG_MAX_PER_DEVICE = 1000;
const LOG_TTL_MS = 60 * 60 * 1000; // 1h
// A device that goes quiet for longer than this, then logs/interacts again, is
// reported as "resumed" (the other devices get a fresh toast).
const INACTIVITY_MS = 60 * 1000;

export const jsenvPluginDevices = () => {
  // id -> device record
  const devices = new Map();
  // trackers watching a device's live logs: { socket, targetId }
  const trackers = new Set();
  // dashboard pages watching the whole device list (pushed, never polled).
  const dashboards = new Set();

  const now = () => Date.now();

  const getOrCreateDevice = (id, userAgent) => {
    let device = devices.get(id);
    if (!device) {
      device = {
        id,
        userAgent,
        firstSeen: now(),
        lastActivity: now(),
        connected: false,
        everConnected: false,
        sockets: new Set(),
        logs: [],
      };
      devices.set(id, device);
    } else if (userAgent) {
      device.userAgent = userAgent;
    }
    return device;
  };

  const pruneLogs = (device) => {
    const cutoff = now() - LOG_TTL_MS;
    while (device.logs.length && device.logs[0].ts < cutoff) {
      device.logs.shift();
    }
    while (device.logs.length > LOG_MAX_PER_DEVICE) {
      device.logs.shift();
    }
  };

  const serializeDevice = (device) => ({
    id: device.id,
    userAgent: device.userAgent,
    firstSeen: device.firstSeen,
    lastActivity: device.lastActivity,
    connected: device.connected,
    logCount: device.logs.length,
  });

  const sendTo = (socket, event) => {
    if (socket.readyState === 1) {
      socket.send(JSON.stringify(event));
    }
  };

  // Notify every device EXCEPT the one the event is about (you don't toast a
  // device about itself).
  const notifyOtherDevices = (exceptId, event) => {
    for (const device of devices.values()) {
      if (device.id === exceptId) {
        continue;
      }
      for (const socket of device.sockets) {
        sendTo(socket, event);
      }
    }
  };

  const forwardLogToTrackers = (deviceId, logEvent) => {
    for (const tracker of trackers) {
      if (tracker.targetId === deviceId) {
        sendTo(tracker.socket, logEvent);
      }
    }
  };

  // Push the whole device list to every dashboard — no client polling. Called
  // immediately on structural changes (a device connects/disconnects/appears);
  // an activity/log-count refresh is throttled so a chatty device doesn't spam.
  const pushDashboards = () => {
    const snapshot = [...devices.values()].map(serializeDevice);
    for (const socket of dashboards) {
      sendTo(socket, { type: "devices", devices: snapshot });
    }
  };
  let dashboardThrottleTimer = null;
  const pushDashboardsThrottled = () => {
    if (dashboardThrottleTimer || dashboards.size === 0) {
      return;
    }
    dashboardThrottleTimer = setTimeout(() => {
      dashboardThrottleTimer = null;
      pushDashboards();
    }, 1000);
  };

  const handleDashboardSocket = (socket) => {
    dashboards.add(socket);
    sendTo(socket, {
      type: "devices",
      devices: [...devices.values()].map(serializeDevice),
    });
    return () => {
      dashboards.delete(socket);
    };
  };

  const handleDeviceSocket = (socket, request) => {
    const deviceId = request.searchParams.get("deviceId");
    if (!deviceId) {
      socket.close();
      return undefined;
    }
    const userAgent = request.headers["user-agent"] || "";
    const device = getOrCreateDevice(deviceId, userAgent);

    const firstEver = !device.everConnected;
    const wasDisconnected = !device.connected;
    device.everConnected = true;
    device.connected = true;
    device.sockets.add(socket);
    device.lastActivity = now();

    if (firstEver) {
      notifyOtherDevices(deviceId, {
        type: "device_here",
        reason: "new",
        device: serializeDevice(device),
      });
    } else if (wasDisconnected) {
      notifyOtherDevices(deviceId, {
        type: "device_here",
        reason: "reconnected",
        device: serializeDevice(device),
      });
    }
    pushDashboards();

    socket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(String(raw));
      } catch {
        return;
      }
      const previousActivity = device.lastActivity;
      device.lastActivity = now();
      // A message after a long quiet spell means the user picked the device back
      // up — let the other devices know so they can re-open its tracker.
      if (device.lastActivity - previousActivity > INACTIVITY_MS) {
        notifyOtherDevices(deviceId, {
          type: "device_here",
          reason: "resumed",
          device: serializeDevice(device),
        });
        pushDashboards();
      }
      if (message.type === "log") {
        const entry = {
          level: message.level || "log",
          text: message.text || "",
          ts: message.ts || now(),
        };
        device.logs.push(entry);
        pruneLogs(device);
        forwardLogToTrackers(deviceId, { type: "log", ...entry });
      }
      pushDashboardsThrottled();
    });

    return () => {
      device.sockets.delete(socket);
      if (device.sockets.size === 0) {
        device.connected = false;
      }
      pushDashboards();
    };
  };

  const handleTrackerSocket = (socket, request) => {
    const targetId = request.searchParams.get("target");
    const tracker = { socket, targetId };
    trackers.add(tracker);
    // Replay the recent buffer so a tracker opened after the fact isn't empty.
    const device = devices.get(targetId);
    if (device) {
      for (const entry of device.logs) {
        sendTo(socket, { type: "log", ...entry });
      }
    }
    return () => {
      trackers.delete(tracker);
    };
  };

  const htmlResponse = (fileUrl) =>
    new Response(readFileSync(fileUrl), {
      headers: { "content-type": "text/html" },
    });

  return {
    name: "jsenv:devices",
    appliesDuring: "dev",
    transformUrlContent: {
      html: (urlInfo) => {
        // Don't instrument our own dashboard/tracker pages.
        if (urlInfo.url.includes("/.internal/device")) {
          return null;
        }
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        injectJsenvScript(htmlAst, {
          src: devicesClientFileUrl,
          initCall: {
            callee: "window.__devices__.setup",
            params: {},
          },
          pluginName: "jsenv:devices",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
    serverRoutes: [
      {
        endpoint: "GET /.internal/devices.websocket",
        description:
          "Live channel: browser devices report their console logs here; trackers stream a device's logs from here.",
        declarationSource: import.meta.url,
        fetch: (request) => {
          const role = request.searchParams.get("role") || "device";
          if (role === "tracker") {
            return new WebSocketResponse((socket) =>
              handleTrackerSocket(socket, request),
            );
          }
          if (role === "dashboard") {
            return new WebSocketResponse((socket) =>
              handleDashboardSocket(socket),
            );
          }
          return new WebSocketResponse((socket) =>
            handleDeviceSocket(socket, request),
          );
        },
      },
      {
        endpoint: "GET /.internal/devices.json",
        description: "Snapshot of every device seen since the server started.",
        declarationSource: import.meta.url,
        fetch: () =>
          Response.json([...devices.values()].map(serializeDevice)),
      },
      {
        endpoint: "GET /.internal/devices",
        description: "Dashboard listing connected devices.",
        declarationSource: import.meta.url,
        fetch: () => htmlResponse(devicesPageFileUrl),
      },
      {
        endpoint: "GET /.internal/device",
        description: "Live console-log tracker for one device (?id=…).",
        declarationSource: import.meta.url,
        fetch: () => htmlResponse(deviceTrackerPageFileUrl),
      },
    ],
  };
};

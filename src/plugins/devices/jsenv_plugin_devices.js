/*
 * Devices plugin (dev only)
 * -------------------------
 * Lets you read one browser's console logs from another browser — e.g. watch a
 * phone's logs from the desktop.
 *
 * Transport reuses what the dev server already has instead of opening a second
 * websocket:
 * - server → clients uses the jsenv "server events" channel (the same websocket
 *   the autoreload feature rides on). This plugin declares three server events:
 *     - "devices_list"  the whole registry (the dashboard renders it)
 *     - "device_log"    a single log line (a monitor appends it)
 *     - "device_here"   a device just appeared/resumed (every page can toast it)
 *   Server events are broadcast, so consumers filter what they care about.
 * - clients → server uses a plain HTTP POST (/.internal/devices/log). Each report
 *   carries the tab (id, url, title, visibility), recent qualified activities
 *   (click, request, navigation, …) and buffered console logs; a periodic
 *   heartbeat keeps it fresh. No extra socket.
 *
 * A device aggregates its open tabs and a short activity history. It is "online"
 * when any report arrived within INACTIVITY_MS — there is no dedicated
 * connection to track.
 *
 * The client is injected into EVERY cooked page, including our own dashboard and
 * monitor pages — so opening one of those counts as a connected device, and any
 * open page gets toasted when another device appears.
 *
 * Pages:
 * - /.internal/devices     → dashboard listing every device seen
 * - /.internal/device?id=… → live console-log monitor for one device
 *
 * Both pages are served THROUGH the graph (via redirectReference to a real HTML
 * file) rather than as a raw route response, so they get cooked like any app
 * page — which is what injects window.__server_events__ into them. They consume
 * the server events directly, no bespoke socket. See the "dev-server" skill next
 * to @jsenv/core for how internal pages get script injection.
 */

import { injectJsenvScript, parseHtml, stringifyHtmlAst } from "@jsenv/ast";
import { getRuntimeFromRequest } from "../../dev/dev_server_plugins/runtime_from_request.js";

// Normalize the dev server's { runtimeName, runtimeVersion } to the { name,
// version } shape the pages use for both browser and OS.
const runtimeFromRequest = (request) => {
  const { runtimeName, runtimeVersion } = getRuntimeFromRequest(request);
  return { name: runtimeName, version: runtimeVersion };
};

const devicesClientFileUrl = new URL(
  "./client/devices_client.js",
  import.meta.url,
).href;
const devicesPageFileUrl = new URL(
  "./client/devices_page.html",
  import.meta.url,
).href;
const deviceMonitorPageFileUrl = new URL(
  "./client/device_monitor_page.html",
  import.meta.url,
).href;

// Keep at most this many log entries per device, and drop entries older than
// LOG_TTL_MS — the buffer only exists so a monitor opened a bit late can still
// show recent history; it is not a persistent store.
const LOG_MAX_PER_DEVICE = 1000;
const LOG_TTL_MS = 60 * 60 * 1000; // 1h
// Recent qualified activities kept per device (click, mousemove, request, …),
// so a page can show "what the device was last doing" and a short history.
const ACTIVITY_MAX_PER_DEVICE = 50;
// A device silent (no report at all) for longer than this, then reporting
// again, is treated as "resumed" and defines "online".
const INACTIVITY_MS = 60 * 1000;
// A tab not heard from for this long is considered closed and dropped.
const TAB_TTL_MS = 2 * 60 * 1000;

// The dev server already parses browser + version from a request (sec-ch-ua or
// user-agent) via getRuntimeFromRequest; it does not cover the OS, so this fills
// that gap from the user-agent string.
const osFromUserAgent = (userAgent) => {
  const iosMatch = userAgent.match(/iPhone OS (\d+)[._](\d+)/);
  if (iosMatch) {
    return { name: "iOS", version: `${iosMatch[1]}.${iosMatch[2]}` };
  }
  if (/iPad/.test(userAgent)) {
    const ipadMatch = userAgent.match(/OS (\d+)[._](\d+)/);
    return {
      name: "iPadOS",
      version: ipadMatch ? `${ipadMatch[1]}.${ipadMatch[2]}` : "",
    };
  }
  const androidMatch = userAgent.match(/Android (\d+(?:\.\d+)*)/);
  if (androidMatch) {
    return { name: "Android", version: androidMatch[1] };
  }
  if (/Windows NT/.test(userAgent)) {
    const winMatch = userAgent.match(/Windows NT (\d+\.\d+)/);
    const version =
      winMatch && winMatch[1] === "10.0" ? "10/11" : winMatch?.[1];
    return { name: "Windows", version: version || "" };
  }
  const macMatch = userAgent.match(/Mac OS X (\d+)[._](\d+)(?:[._](\d+))?/);
  if (macMatch) {
    const patch = macMatch[3] ? `.${macMatch[3]}` : "";
    return { name: "macOS", version: `${macMatch[1]}.${macMatch[2]}${patch}` };
  }
  if (/CrOS/.test(userAgent)) {
    return { name: "ChromeOS", version: "" };
  }
  if (/Linux/.test(userAgent)) {
    return { name: "Linux", version: "" };
  }
  return { name: "unknown", version: "" };
};

export const jsenvPluginDevices = () => {
  // id -> device record
  const devices = new Map();

  // Assigned when the server-event channel is set up; broadcast helpers.
  let sendDevicesList = () => {};
  let sendDeviceLog = () => {};
  let sendDeviceHere = () => {};

  const now = () => Date.now();
  // "online" = we heard from the device (any report) recently.
  const isOnline = (device) => now() - device.lastSeen < INACTIVITY_MS;

  const getOrCreateDevice = (id, request) => {
    const userAgent = request.headers["user-agent"] || "";
    let device = devices.get(id);
    if (!device) {
      device = {
        id,
        userAgent,
        runtime: runtimeFromRequest(request),
        os: osFromUserAgent(userAgent),
        firstSeen: now(),
        lastSeen: now(),
        everSeen: false,
        logs: [],
        activities: [],
        // most recent qualified activity { type, detail, ts, tabId } or null
        lastActivity: null,
        // tabId -> { id, url, title, visible, lastSeen }
        tabs: new Map(),
      };
      devices.set(id, device);
    } else if (userAgent && userAgent !== device.userAgent) {
      device.userAgent = userAgent;
      device.runtime = runtimeFromRequest(request);
      device.os = osFromUserAgent(userAgent);
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

  const updateTab = (device, tab) => {
    if (!tab || typeof tab.id !== "string") {
      return;
    }
    if (tab.closing) {
      device.tabs.delete(tab.id);
      return;
    }
    device.tabs.set(tab.id, {
      id: tab.id,
      url: typeof tab.url === "string" ? tab.url : "",
      title: typeof tab.title === "string" ? tab.title : "",
      visible: Boolean(tab.visible),
      lastSeen: now(),
    });
  };

  const pruneTabs = (device) => {
    const cutoff = now() - TAB_TTL_MS;
    for (const [id, tab] of device.tabs) {
      if (tab.lastSeen < cutoff) {
        device.tabs.delete(id);
      }
    }
  };

  // The tab to show as "current": a visible one wins, otherwise the most
  // recently seen. No Math.max — a single scan keeping the best.
  const activeTabOf = (device) => {
    let best = null;
    for (const tab of device.tabs.values()) {
      if (!best) {
        best = tab;
        continue;
      }
      if (tab.visible && !best.visible) {
        best = tab;
        continue;
      }
      if (tab.visible === best.visible && tab.lastSeen > best.lastSeen) {
        best = tab;
      }
    }
    return best;
  };

  const recordActivity = (device, rawActivity) => {
    const activity = {
      type:
        typeof rawActivity.type === "string" ? rawActivity.type : "activity",
      detail: typeof rawActivity.detail === "string" ? rawActivity.detail : "",
      ts: rawActivity.ts || now(),
      tabId: typeof rawActivity.tabId === "string" ? rawActivity.tabId : "",
    };
    device.activities.push(activity);
    while (device.activities.length > ACTIVITY_MAX_PER_DEVICE) {
      device.activities.shift();
    }
    device.lastActivity = activity;
  };

  const serializeTab = (tab) => ({
    id: tab.id,
    url: tab.url,
    title: tab.title,
    visible: tab.visible,
    lastSeen: tab.lastSeen,
  });

  // Summary sent in the (broadcast) list — kept lean: the active tab and a tab
  // count rather than every tab, the last activity rather than the whole
  // history. Pages fetch the full record for their dialogs.
  const serializeDevice = (device) => {
    const activeTab = activeTabOf(device);
    return {
      id: device.id,
      userAgent: device.userAgent,
      // parsed { name, version } so pages can show a friendly browser/OS
      runtime: device.runtime,
      os: device.os,
      firstSeen: device.firstSeen,
      lastSeen: device.lastSeen,
      online: isOnline(device),
      logCount: device.logs.length,
      tabCount: device.tabs.size,
      activeTab: activeTab ? serializeTab(activeTab) : null,
      lastActivity: device.lastActivity,
    };
  };

  const snapshot = () => [...devices.values()].map(serializeDevice);

  // A single device's full record: the summary plus everything a dialog needs
  // (all tabs, recent activities, buffered logs). Device-scoped rather than
  // named after logs because the shape is meant to grow.
  const deviceDetail = (device) => ({
    ...serializeDevice(device),
    tabs: [...device.tabs.values()].map(serializeTab),
    activities: device.activities.slice(),
    logs: device.logs,
  });

  // Broadcasting the full list on every log line would be wasteful, so a
  // log-driven refresh (logCount/lastActivity) is throttled; structural changes
  // (a device appears/resumes) push immediately.
  let listThrottleTimer = null;
  const pushListThrottled = () => {
    if (listThrottleTimer) {
      return;
    }
    listThrottleTimer = setTimeout(() => {
      listThrottleTimer = null;
      sendDevicesList();
    }, 1000);
  };

  const ingest = async (request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400 };
    }
    const deviceId = body.deviceId;
    if (!deviceId || typeof deviceId !== "string") {
      return { status: 400 };
    }
    const device = getOrCreateDevice(deviceId, request);

    const firstEver = !device.everSeen;
    const wasOnline = !firstEver && isOnline(device);
    device.everSeen = true;
    device.lastSeen = now();

    updateTab(device, body.tab);
    pruneTabs(device);

    if (firstEver) {
      sendDeviceHere({ reason: "new", device: serializeDevice(device) });
      sendDevicesList();
    } else if (!wasOnline) {
      // A report after a long quiet spell means the device was picked back up.
      sendDeviceHere({ reason: "resumed", device: serializeDevice(device) });
      sendDevicesList();
    }

    const activities = Array.isArray(body.activities) ? body.activities : [];
    for (const rawActivity of activities) {
      recordActivity(device, rawActivity);
    }

    const logs = Array.isArray(body.logs) ? body.logs : [];
    for (const rawLog of logs) {
      const entry = {
        level: rawLog.level || "log",
        text: typeof rawLog.text === "string" ? rawLog.text : "",
        ts: rawLog.ts || now(),
      };
      device.logs.push(entry);
      sendDeviceLog({ deviceId, ...entry });
    }
    if (logs.length) {
      pruneLogs(device);
    }
    pushListThrottled();
    return { status: 204 };
  };

  const jsonResponse = (data) => {
    const json = JSON.stringify(data);
    return {
      status: 200,
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(json),
      },
      body: json,
    };
  };

  // Map our two page URLs onto their real HTML files. Returning a graph URL
  // here (instead of serving the file from a raw route) makes the dev server
  // cook the page, which is what gets window.__server_events__ injected into it.
  const redirectToPage = (reference) => {
    if (reference.isInline || !reference.url.startsWith("file:")) {
      return null;
    }
    const { pathname, search } = new URL(reference.url);
    if (pathname.endsWith("/.internal/devices")) {
      return devicesPageFileUrl;
    }
    if (pathname.endsWith("/.internal/device")) {
      // carry ?id=… so the monitor page knows which device to watch
      return `${deviceMonitorPageFileUrl}${search}`;
    }
    return null;
  };

  return {
    name: "jsenv:devices",
    appliesDuring: "dev",
    redirectReference: redirectToPage,
    serverEvents: {
      devices_list: (serverEventInfo) => {
        sendDevicesList = () => serverEventInfo.sendServerEvent(snapshot());
      },
      device_log: (serverEventInfo) => {
        sendDeviceLog = (payload) => serverEventInfo.sendServerEvent(payload);
      },
      device_here: (serverEventInfo) => {
        sendDeviceHere = (payload) => serverEventInfo.sendServerEvent(payload);
      },
    },
    transformUrlContent: {
      html: (urlInfo) => {
        // Injected into every page, including our own dashboard/monitor pages,
        // so opening one registers that browser as a device and any open page
        // gets toasted when another device appears.
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
        endpoint: "POST /.internal/devices/log",
        description:
          "A browser reports its console output and activity heartbeat here.",
        declarationSource: import.meta.url,
        fetch: (request) => ingest(request),
      },
      {
        endpoint: "GET /.internal/devices.json",
        description: "Snapshot of every device seen since the server started.",
        availableMediaTypes: ["application/json"],
        declarationSource: import.meta.url,
        fetch: () => jsonResponse(snapshot()),
      },
      {
        endpoint: "GET /.internal/device.json",
        description:
          "One device's record — info plus buffered logs (?id=…), so a monitor opened late still has recent history.",
        availableMediaTypes: ["application/json"],
        declarationSource: import.meta.url,
        fetch: (request) => {
          const id = request.searchParams.get("id");
          const device = id && devices.get(id);
          return jsonResponse(device ? deviceDetail(device) : { id, logs: [] });
        },
      },
    ],
  };
};

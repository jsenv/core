/*
 * Client monitoring plugin (dev only)
 * -----------------------------------
 * Lets you watch one client from another — e.g. read a phone's console logs and
 * activity from the desktop. A "client" here is a browser/navigator context that
 * cooked one of our pages and reports back; we can only see clients that execute
 * our injected script, not arbitrary HTTP clients of the dev server.
 *
 * Transport reuses what the dev server already has instead of opening a second
 * websocket:
 * - server → clients uses the jsenv "server events" channel (the same websocket
 *   the autoreload feature rides on). This plugin declares four server events:
 *     - "clients_list"    the whole registry (the dashboard renders it)
 *     - "client_log"      a single log line (a monitor appends it)
 *     - "client_activity" a single qualified activity (a monitor appends it)
 *     - "client_here"     a client just appeared/resumed (every page can toast it)
 *   Server events are broadcast, so consumers filter what they care about.
 * - clients → server uses a plain HTTP POST (/.internal/clients/report). Each
 *   report carries the tab (id, url, title, visibility), recent qualified
 *   activities (click, request, navigation, …) and buffered console logs; a
 *   periodic heartbeat keeps it fresh. No extra socket.
 *
 * A client aggregates its open tabs and a short activity history. It is "online"
 * when any report arrived within INACTIVITY_MS — there is no dedicated
 * connection to track.
 *
 * The monitoring script is injected into EVERY cooked page, including our own
 * dashboard and monitor pages — so opening one of those counts as a connected
 * client, and any open page gets toasted when another client appears.
 *
 * Pages:
 * - /.internal/clients     → dashboard listing every client seen
 * - /.internal/client?id=… → live console-log monitor for one client
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

const clientReporterFileUrl = new URL(
  "./client/client_reporter.js",
  import.meta.url,
).href;
const clientsPageFileUrl = new URL(
  "./client/clients_page.html",
  import.meta.url,
).href;
const clientMonitorPageFileUrl = new URL(
  "./client/client_monitor_page.html",
  import.meta.url,
).href;

// Keep at most this many log entries per client, and drop entries older than
// LOG_TTL_MS — the buffer only exists so a monitor opened a bit late can still
// show recent history; it is not a persistent store.
const LOG_MAX_PER_CLIENT = 1000;
const LOG_TTL_MS = 60 * 60 * 1000; // 1h
// Recent qualified activities kept per client (click, mousemove, request, …),
// so a page can show "what the client was last doing" and a short history.
const ACTIVITY_MAX_PER_CLIENT = 50;
// A client silent (no report at all) for longer than this, then reporting
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

export const jsenvPluginClientMonitoring = () => {
  // id -> client record
  const clients = new Map();

  // Assigned when the server-event channel is set up; broadcast helpers.
  let sendClientsList = () => {};
  let sendClientLog = () => {};
  let sendClientActivity = () => {};
  let sendClientHere = () => {};

  const now = () => Date.now();
  // "online" = we heard from the client (any report) recently.
  const isOnline = (client) => now() - client.lastSeen < INACTIVITY_MS;

  const getOrCreateClient = (id, request) => {
    const userAgent = request.headers["user-agent"] || "";
    let client = clients.get(id);
    if (!client) {
      client = {
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
      clients.set(id, client);
    } else if (userAgent && userAgent !== client.userAgent) {
      client.userAgent = userAgent;
      client.runtime = runtimeFromRequest(request);
      client.os = osFromUserAgent(userAgent);
    }
    return client;
  };

  const pruneLogs = (client) => {
    const cutoff = now() - LOG_TTL_MS;
    while (client.logs.length && client.logs[0].ts < cutoff) {
      client.logs.shift();
    }
    while (client.logs.length > LOG_MAX_PER_CLIENT) {
      client.logs.shift();
    }
  };

  const updateTab = (client, tab) => {
    if (!tab || typeof tab.id !== "string") {
      return;
    }
    if (tab.closing) {
      client.tabs.delete(tab.id);
      return;
    }
    client.tabs.set(tab.id, {
      id: tab.id,
      url: typeof tab.url === "string" ? tab.url : "",
      title: typeof tab.title === "string" ? tab.title : "",
      visible: Boolean(tab.visible),
      lastSeen: now(),
    });
  };

  const pruneTabs = (client) => {
    const cutoff = now() - TAB_TTL_MS;
    for (const [id, tab] of client.tabs) {
      if (tab.lastSeen < cutoff) {
        client.tabs.delete(id);
      }
    }
  };

  // The tab to show as "current": a visible one wins, otherwise the most
  // recently seen. No Math.max — a single scan keeping the best.
  const activeTabOf = (client) => {
    let best = null;
    for (const tab of client.tabs.values()) {
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

  const recordActivity = (client, rawActivity) => {
    const activity = {
      type:
        typeof rawActivity.type === "string" ? rawActivity.type : "activity",
      detail: typeof rawActivity.detail === "string" ? rawActivity.detail : "",
      ts: rawActivity.ts || now(),
      tabId: typeof rawActivity.tabId === "string" ? rawActivity.tabId : "",
    };
    client.activities.push(activity);
    while (client.activities.length > ACTIVITY_MAX_PER_CLIENT) {
      client.activities.shift();
    }
    client.lastActivity = activity;
    return activity;
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
  const serializeClient = (client) => {
    const activeTab = activeTabOf(client);
    return {
      id: client.id,
      userAgent: client.userAgent,
      // parsed { name, version } so pages can show a friendly browser/OS
      runtime: client.runtime,
      os: client.os,
      firstSeen: client.firstSeen,
      lastSeen: client.lastSeen,
      online: isOnline(client),
      logCount: client.logs.length,
      tabCount: client.tabs.size,
      activeTab: activeTab ? serializeTab(activeTab) : null,
      lastActivity: client.lastActivity,
    };
  };

  const snapshot = () => [...clients.values()].map(serializeClient);

  // A single client's full record: the summary plus everything a dialog needs
  // (all tabs, recent activities, buffered logs). Client-scoped rather than
  // named after logs because the shape is meant to grow.
  const clientDetail = (client) => ({
    ...serializeClient(client),
    tabs: [...client.tabs.values()].map(serializeTab),
    activities: client.activities.slice(),
    logs: client.logs,
  });

  // Broadcasting the full list on every log line would be wasteful, so a
  // log-driven refresh (logCount/lastActivity) is throttled; structural changes
  // (a client appears/resumes) push immediately.
  let listThrottleTimer = null;
  const pushListThrottled = () => {
    if (listThrottleTimer) {
      return;
    }
    listThrottleTimer = setTimeout(() => {
      listThrottleTimer = null;
      sendClientsList();
    }, 1000);
  };

  const ingest = async (request) => {
    let body;
    try {
      body = await request.json();
    } catch {
      return { status: 400 };
    }
    const clientId = body.clientId;
    if (!clientId || typeof clientId !== "string") {
      return { status: 400 };
    }
    const client = getOrCreateClient(clientId, request);

    const firstEver = !client.everSeen;
    const wasOnline = !firstEver && isOnline(client);
    client.everSeen = true;
    client.lastSeen = now();

    updateTab(client, body.tab);
    pruneTabs(client);

    if (firstEver) {
      sendClientHere({ reason: "new", client: serializeClient(client) });
      sendClientsList();
    } else if (!wasOnline) {
      // A report after a long quiet spell means the client was picked back up.
      sendClientHere({ reason: "resumed", client: serializeClient(client) });
      sendClientsList();
    }

    const activities = Array.isArray(body.activities) ? body.activities : [];
    for (const rawActivity of activities) {
      const activity = recordActivity(client, rawActivity);
      sendClientActivity({ clientId, ...activity });
    }

    const logs = Array.isArray(body.logs) ? body.logs : [];
    for (const rawLog of logs) {
      const entry = {
        level: rawLog.level || "log",
        text: typeof rawLog.text === "string" ? rawLog.text : "",
        ts: rawLog.ts || now(),
      };
      // styled console segments ({ text, css } per %c run), when present, so a
      // monitor can render colors; the plain text stays for copy/paste.
      if (Array.isArray(rawLog.segments)) {
        entry.segments = rawLog.segments;
      }
      client.logs.push(entry);
      sendClientLog({ clientId, ...entry });
    }
    if (logs.length) {
      pruneLogs(client);
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
    if (pathname.endsWith("/.internal/clients")) {
      return clientsPageFileUrl;
    }
    if (pathname.endsWith("/.internal/client")) {
      // carry ?id=… so the monitor page knows which client to watch
      return `${clientMonitorPageFileUrl}${search}`;
    }
    return null;
  };

  return {
    name: "jsenv:client_monitoring",
    appliesDuring: "dev",
    redirectReference: redirectToPage,
    serverEvents: {
      clients_list: (serverEventInfo) => {
        sendClientsList = () => serverEventInfo.sendServerEvent(snapshot());
      },
      client_log: (serverEventInfo) => {
        sendClientLog = (payload) => serverEventInfo.sendServerEvent(payload);
      },
      client_activity: (serverEventInfo) => {
        sendClientActivity = (payload) =>
          serverEventInfo.sendServerEvent(payload);
      },
      client_here: (serverEventInfo) => {
        sendClientHere = (payload) => serverEventInfo.sendServerEvent(payload);
      },
    },
    transformUrlContent: {
      html: (urlInfo) => {
        // Injected into every page, including our own dashboard/monitor pages,
        // so opening one registers that browser as a client and any open page
        // gets toasted when another client appears.
        const htmlAst = parseHtml({ html: urlInfo.content, url: urlInfo.url });
        injectJsenvScript(htmlAst, {
          src: clientReporterFileUrl,
          initCall: {
            callee: "window.__client_monitoring__.setup",
            params: {},
          },
          pluginName: "jsenv:client_monitoring",
        });
        return stringifyHtmlAst(htmlAst);
      },
    },
    serverRoutes: [
      // The two pages are actually served THROUGH the graph (see
      // redirectReference above) so they get window.__server_events__ injected.
      // These entries exist only to make the pages discoverable in the route
      // inspector (/.internal/route_inspector): their fetch returns null, which
      // makes the router fall through to the dev server's catch-all "GET *",
      // which does the real cooking + injection.
      {
        endpoint: "GET /.internal/clients",
        description:
          "Dashboard of every browser (client) connected to this dev server since it started.",
        availableMediaTypes: ["text/html"],
        declarationSource: import.meta.url,
        fetch: () => null,
      },
      {
        endpoint: "GET /.internal/client",
        description:
          "Live monitor (console logs + activity) for one client — pass ?id=<clientId>.",
        availableMediaTypes: ["text/html"],
        declarationSource: import.meta.url,
        fetch: () => null,
      },
      {
        endpoint: "POST /.internal/clients/report",
        description:
          "A browser reports its console output and activity heartbeat here.",
        declarationSource: import.meta.url,
        fetch: (request) => ingest(request),
      },
      {
        endpoint: "GET /.internal/clients.json",
        description: "Snapshot of every client seen since the server started.",
        availableMediaTypes: ["application/json"],
        declarationSource: import.meta.url,
        fetch: () => jsonResponse(snapshot()),
      },
      {
        endpoint: "GET /.internal/client.json",
        description:
          "One client's record — info plus buffered logs (?id=…), so a monitor opened late still has recent history.",
        availableMediaTypes: ["application/json"],
        declarationSource: import.meta.url,
        fetch: (request) => {
          const id = request.searchParams.get("id");
          const client = id && clients.get(id);
          return jsonResponse(client ? clientDetail(client) : { id, logs: [] });
        },
      },
    ],
  };
};

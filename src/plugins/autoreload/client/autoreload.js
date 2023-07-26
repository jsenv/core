import { urlHotMetas } from "../../import_meta_hot/client/import_meta_hot.js";
import { compareTwoUrlPaths } from "./url_helpers.js";
import {
  reloadHtmlPage,
  reloadJsImport,
  getDOMNodesUsingUrl,
} from "./reload.js";

let debug = false;
const reloader = {
  urlHotMetas,
  status: {
    value: "idle",
    onchange: () => {},
    goTo: (value) => {
      reloader.status.value = value;
      reloader.status.onchange();
    },
  },
  autoreload: {
    enabled: ["1", null].includes(window.localStorage.getItem("autoreload")),
    onchange: () => {},
    enable: () => {
      reloader.autoreload.enabled = true;
      window.localStorage.setItem("autoreload", "1");
      reloader.autoreload.onchange();
    },
    disable: () => {
      reloader.autoreload.enabled = false;
      window.localStorage.setItem("autoreload", "0");
      reloader.autoreload.onchange();
    },
  },
  changes: {
    value: [],
    onchange: () => {},
    add: (reloadMessage) => {
      if (debug) {
        console.debug("received reload message", reloadMessage);
      }
      reloader.changes.value.push(reloadMessage);
      reloader.changes.onchange();
      if (reloader.autoreload.enabled) {
        reloader.reload();
      } else {
        reloader.status.goTo("can_reload");
      }
    },
    remove: (reloadMessage) => {
      const index = reloader.changes.value.indexOf(reloadMessage);
      if (index > -1) {
        reloader.changes.value.splice(index, 1);
        if (reloader.changes.value.length === 0) {
          reloader.status.goTo("idle");
        }
        reloader.changes.onchange();
      }
    },
  },
  currentExecution: null,
  reload: () => {
    const someEffectIsFullReload = reloader.changes.value.some(
      (reloadMessage) => reloadMessage.type === "full",
    );
    if (someEffectIsFullReload) {
      reloadHtmlPage();
      return;
    }
    reloader.status.goTo("reloading");
    const onApplied = (reloadMessage) => {
      reloader.changes.remove(reloadMessage);
    };
    const setReloadMessagePromise = (reloadMessage, promise) => {
      promise.then(
        () => {
          onApplied(reloadMessage);
          reloader.currentExecution = null;
        },
        (e) => {
          reloader.status.goTo("failed");
          if (typeof window.reportError === "function") {
            window.reportError(e);
          } else {
            console.error(e);
          }
          console.error(
            `[jsenv] Hot reload failed after ${reloadMessage.reason}.
This could be due to syntax errors or importing non-existent modules (see errors in console)`,
          );
          reloader.currentExecution = null;
        },
      );
    };
    reloader.changes.value.forEach((reloadMessage) => {
      if (reloadMessage.type === "hot") {
        const promise = addToHotQueue(() => {
          return applyHotReload(reloadMessage);
        });
        setReloadMessagePromise(reloadMessage, promise);
      } else {
        setReloadMessagePromise(reloadMessage, Promise.resolve());
      }
    });
  },
};

let pendingCallbacks = [];
let running = false;
const addToHotQueue = async (callback) => {
  pendingCallbacks.push(callback);
  dequeue();
};
const dequeue = async () => {
  if (running) {
    return;
  }
  const callbacks = pendingCallbacks.slice();
  pendingCallbacks = [];
  running = true;
  try {
    await callbacks.reduce(async (previous, callback) => {
      await previous;
      await callback();
    }, Promise.resolve());
  } finally {
    running = false;
    if (pendingCallbacks.length) {
      dequeue();
    }
  }
};

const applyHotReload = async ({ cause, hotInstructions }) => {
  await hotInstructions.reduce(
    async (previous, { type, boundary, acceptedBy }) => {
      await previous;

      const hot = Date.now();
      const urlToFetch = new URL(boundary, `${window.location.origin}/`).href;
      const urlHotMeta = urlHotMetas[urlToFetch];
      // there is no url hot meta when:
      // - code was not executed (code splitting with dynamic import)
      // - import.meta.hot.accept() is not called (happens for HTML and CSS)

      if (type === "prune") {
        if (urlHotMeta) {
          delete urlHotMetas[urlToFetch];
          if (urlHotMeta.disposeCallback) {
            console.groupCollapsed(
              `[jsenv] cleanup ${boundary} (no longer referenced by ${acceptedBy})`,
            );
            console.log(`call dispose callback`);
            await urlHotMeta.disposeCallback();
            console.groupEnd();
          }
        }
        return null;
      }

      if (acceptedBy === boundary) {
        console.groupCollapsed(`[jsenv] hot reloading ${boundary} (${cause})`);
      } else {
        console.groupCollapsed(
          `[jsenv] hot reloading ${acceptedBy} usage in ${boundary} (${cause})`,
        );
      }
      if (type === "js_module") {
        if (!urlHotMeta) {
          // code was not executed, no need to re-execute it
          return null;
        }
        if (urlHotMeta.disposeCallback) {
          console.log(`call dispose callback`);
          await urlHotMeta.disposeCallback();
        }
        console.log(`importing js module`);
        reloader.currentExecution = {
          type: "dynamic_import",
          url: urlToFetch,
        };
        const namespace = await reloadJsImport(urlToFetch, hot);
        if (urlHotMeta.acceptCallback) {
          await urlHotMeta.acceptCallback(namespace);
        }
        console.log(`js module import done`);
        console.groupEnd();
        return namespace;
      }
      if (type === "html") {
        const isRootHtmlFile =
          window.location.pathname === "/" &&
          new URL(urlToFetch).pathname.slice(1).indexOf("/") === -1;
        if (
          !isRootHtmlFile &&
          !compareTwoUrlPaths(urlToFetch, window.location.href)
        ) {
          // we are not in that HTML page
          return null;
        }
        const urlToReload = new URL(acceptedBy, `${window.location.origin}/`)
          .href;
        const domNodesUsingUrl = getDOMNodesUsingUrl(urlToReload);
        const domNodesCount = domNodesUsingUrl.length;
        if (domNodesCount === 0) {
          console.log(`no dom node using ${acceptedBy}`);
        } else if (domNodesCount === 1) {
          console.log(`reloading`, domNodesUsingUrl[0].node);
          domNodesUsingUrl[0].reload(hot);
        } else {
          console.log(`reloading ${domNodesCount} nodes using ${acceptedBy}`);
          domNodesUsingUrl.forEach((domNodesUsingUrl) => {
            domNodesUsingUrl.reload(hot);
          });
        }
        console.groupEnd();
        return null;
      }
      console.warn(`unknown update type: "${type}"`);
      return null;
    },
    Promise.resolve(),
  );
};

window.__reloader__ = reloader;
window.__server_events__.listenEvents({
  reload: (reloadServerEvent) => {
    reloader.changes.add(reloadServerEvent.data);
  },
});

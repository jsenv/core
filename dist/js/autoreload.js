import { urlHotMetas } from "./import_meta_hot.js";
import { parseSrcSet, stringifySrcSet } from "@jsenv/ast/src/html/html_src_set.js";

const compareTwoUrlPaths = (url, otherUrl) => {
  if (url === otherUrl) {
    return true;
  }
  const urlObject = new URL(url);
  const otherUrlObject = new URL(otherUrl);
  if (urlObject.origin !== otherUrlObject.origin) {
    return false;
  }
  if (urlObject.pathname !== otherUrlObject.pathname) {
    return false;
  }
  return true;
};

const injectQuery = (url, query) => {
  const urlObject = new URL(url);
  const { searchParams } = urlObject;
  Object.keys(query).forEach((key) => {
    searchParams.set(key, query[key]);
  });
  return String(urlObject);
};

const reloadHtmlPage = () => {
  window.location.reload(true);
};

// This function can consider everything as hot reloadable:
// - no need to check [hot-accept]and [hot-decline] attributes for instance
// This is because if something should full reload, we receive "full_reload"
// from server and this function is not called
const getDOMNodesUsingUrl = (urlToReload) => {
  const nodes = [];
  const shouldReloadUrl = (urlCandidate) => {
    return compareTwoUrlPaths(urlCandidate, urlToReload);
  };
  const visitNodeAttributeAsUrl = (node, attributeName) => {
    let attribute = node[attributeName];
    if (!attribute) {
      return;
    }
    if (SVGAnimatedString && attribute instanceof SVGAnimatedString) {
      attribute = attribute.animVal;
    }
    if (!shouldReloadUrl(attribute)) {
      return;
    }
    nodes.push({
      node,
      reload: (hot) => {
        if (node.nodeName === "SCRIPT") {
          const copy = document.createElement("script");
          Array.from(node.attributes).forEach((attribute) => {
            copy.setAttribute(attribute.nodeName, attribute.nodeValue);
          });
          copy.src = injectQuery(node.src, { hot });
          if (node.parentNode) {
            node.parentNode.replaceChild(copy, node);
          } else {
            document.body.appendChild(copy);
          }
        } else {
          node[attributeName] = injectQuery(attribute, { hot });
        }
      },
    });
  };
  Array.from(document.querySelectorAll(`link[rel="stylesheet"]`)).forEach(
    (link) => {
      visitNodeAttributeAsUrl(link, "href");
    },
  );
  Array.from(document.querySelectorAll(`link[rel="icon"]`)).forEach((link) => {
    visitNodeAttributeAsUrl(link, "href");
  });
  Array.from(document.querySelectorAll("script")).forEach((script) => {
    visitNodeAttributeAsUrl(script, "src");
    const inlinedFromSrc = script.getAttribute("inlined-from-src");
    if (inlinedFromSrc) {
      const inlinedFromUrl = new URL(inlinedFromSrc, window.location.origin)
        .href;
      if (shouldReloadUrl(inlinedFromUrl)) {
        nodes.push({
          node: script,
          reload: () =>
            window.__supervisor__.reloadSupervisedScript(inlinedFromSrc),
        });
      }
    }
  });
  // There is no real need to update a.href because the resource will be fetched when clicked.
  // But in a scenario where the resource was already visited and is in browser cache, adding
  // the dynamic query param ensure the cache is invalidated
  Array.from(document.querySelectorAll("a")).forEach((a) => {
    visitNodeAttributeAsUrl(a, "href");
  });
  // About iframes:
  // - By default iframe itself and everything inside trigger a parent page full-reload
  // - Adding [hot-accept] on the iframe means parent page won't reload when iframe full/hot reload
  //   In that case and if there is code in the iframe and parent doing post message communication:
  //   you must put import.meta.hot.decline() for code involved in communication.
  //   (both in parent and iframe)
  Array.from(document.querySelectorAll("img")).forEach((img) => {
    visitNodeAttributeAsUrl(img, "src");
    const srcset = img.srcset;
    if (srcset) {
      nodes.push({
        node: img,
        reload: (hot) => {
          const srcCandidates = parseSrcSet(srcset);
          srcCandidates.forEach((srcCandidate) => {
            const url = new URL(
              srcCandidate.specifier,
              `${window.location.href}`,
            );
            if (shouldReloadUrl(url)) {
              srcCandidate.specifier = injectQuery(url, { hot });
            }
          });
          img.srcset = stringifySrcSet(srcCandidates);
        },
      });
    }
  });
  Array.from(document.querySelectorAll("source")).forEach((source) => {
    visitNodeAttributeAsUrl(source, "src");
  });
  // svg image tag
  Array.from(document.querySelectorAll("image")).forEach((image) => {
    visitNodeAttributeAsUrl(image, "href");
  });
  // svg use
  Array.from(document.querySelectorAll("use")).forEach((use) => {
    visitNodeAttributeAsUrl(use, "href");
  });
  return nodes;
};

const reloadJsImport = async (url, hot) => {
  const urlWithHotSearchParam = injectQuery(url, { hot });
  const namespace = await import(urlWithHotSearchParam);
  return namespace;
};

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
      // console.debug("received reload message", reloadMessage);
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

const applyHotReload = async ({ cause, hot, hotInstructions }) => {
  await hotInstructions.reduce(
    async (previous, { type, boundary, acceptedBy }) => {
      await previous;

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

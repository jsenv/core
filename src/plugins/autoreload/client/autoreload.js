import {
  parseSrcSet,
  stringifySrcSet,
} from "@jsenv/ast/src/html/html_src_set.js";
import {
  dispatchAfterPartialReload,
  dispatchBeforeFullReload,
  dispatchBeforePartialReload,
  dispatchBeforePrune,
  urlHotMetas,
} from "../../import_meta_hot/client/import_meta_hot.js";

export const initAutoreload = ({ mainFilePath }) => {
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
        (reloadMessage) => {
          if (reloadMessage.type === "full") {
            return true;
          }
          if (reloadMessage.type === "hot") {
            for (const reloadInstruction of reloadMessage.hotInstructions) {
              if (reloadInstruction.type === "html") {
                const acceptedByUrl = new URL(
                  reloadInstruction.acceptedBy,
                  `${window.location.origin}/`,
                ).href;
                const isCurrentHtmlFile = compareTwoUrlPaths(
                  acceptedByUrl,
                  window.location.href,
                );
                if (isCurrentHtmlFile) {
                  return true;
                }
              }
            }
          }
          return false;
        },
      );
      if (someEffectIsFullReload) {
        dispatchBeforeFullReload();
        reloadHtmlPage();
        return;
      }
      dispatchBeforePartialReload();
      reloader.status.goTo("reloading");
      const onApplied = (reloadMessage) => {
        reloader.changes.remove(reloadMessage);
      };
      const setReloadMessagePromise = (reloadMessage, promise) => {
        promise.then(
          () => {
            onApplied(reloadMessage);
            reloader.currentExecution = null;
            dispatchAfterPartialReload();
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
      for (const reloadMessage of reloader.changes.value) {
        if (reloadMessage.type === "hot") {
          const promise = addToHotQueue(() => {
            return applyHotReload(reloadMessage);
          });
          setReloadMessagePromise(reloadMessage, promise);
        } else {
          setReloadMessagePromise(reloadMessage, Promise.resolve());
        }
      }
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
    for (const instruction of hotInstructions) {
      const { type, boundary, acceptedBy } = instruction;

      const hot = Date.now();
      const urlToFetch = new URL(boundary, `${window.location.origin}/`).href;
      const urlHotMeta = urlHotMetas[urlToFetch];
      // there is no url hot meta when:
      // - code was not executed (code splitting with dynamic import)
      // - import.meta.hot.accept() is not called (happens for HTML and CSS)
      if (type === "prune") {
        if (!urlHotMeta) {
          // code not executed for this url, no need to prune
          continue;
        }
        dispatchBeforePrune();
        delete urlHotMetas[urlToFetch];
        if (urlHotMeta.disposeCallback) {
          console.log(
            `[jsenv] cleanup ${boundary} (no longer referenced by ${acceptedBy})`,
          );
          if (debug) {
            console.log(`call dispose callback`);
          }
          await urlHotMeta.disposeCallback();
        }
        continue;
      }
      if (type === "js_module") {
        if (!urlHotMeta) {
          // code not yet executed for this url, no need to re-execute it
          continue;
        }
        if (acceptedBy === boundary) {
          console.log(`[jsenv] hot reload ${boundary} (${cause})`);
        } else {
          console.log(
            `[jsenv] hot reload ${acceptedBy} usage in ${boundary} (${cause})`,
          );
        }
        if (urlHotMeta.disposeCallback) {
          if (debug) {
            console.log(`call dispose callback`);
          }
          await urlHotMeta.disposeCallback();
        }
        if (debug) {
          console.log(`importing js module`);
        }
        reloader.currentExecution = {
          type: "dynamic_import",
          url: urlToFetch,
        };
        const namespace = await reloadJsImport(urlToFetch, hot);
        if (urlHotMeta.acceptCallback) {
          await urlHotMeta.acceptCallback(namespace);
        }
        if (debug) {
          console.log(`js module import done`);
        }
        continue;
      }
      if (type === "html") {
        let isRootHtmlFile;
        if (window.location.pathname === "/") {
          if (new URL(urlToFetch).pathname.slice(1).indexOf("/") === -1) {
            isRootHtmlFile = true;
          } else if (new URL(urlToFetch).pathname === mainFilePath) {
            isRootHtmlFile = true;
          }
        }
        if (
          !isRootHtmlFile &&
          !compareTwoUrlPaths(urlToFetch, window.location.href)
        ) {
          if (debug) {
            console.log(
              `[jsenv] skip ${acceptedBy} hot reload because we are not in that html page`,
            );
          }
          // we are not in that HTML page
          continue;
        }
        if (acceptedBy === boundary) {
          console.log(`[jsenv] hot reload ${boundary} (${cause})`);
        } else {
          console.log(
            `[jsenv] hot reload ${acceptedBy} usage in ${boundary} (${cause})`,
          );
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
        continue;
      }
      console.warn(`unknown update type: "${type}"`);
    }
  };

  window.__reloader__ = reloader;
  window.__server_events__.listenEvents({
    reload: (reloadServerEvent) => {
      reloader.changes.add(reloadServerEvent.data);
    },
  });
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
// const reloadAllCss = () => {
//   const links = Array.from(document.getElementsByTagName("link"));
//   links.forEach((link) => {
//     if (link.rel === "stylesheet") {
//       link.href = injectQuery(link.href, { hot: Date.now() });
//     }
//   });
// };

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

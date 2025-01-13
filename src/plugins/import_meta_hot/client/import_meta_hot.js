/*
 * https://vitejs.dev/guide/api-hmr.html#hot-accept-deps-cb
 * https://modern-web.dev/docs/dev-server/plugins/hmr/
 */

export const urlHotMetas = {};

const createEvent = () => {
  const callbackSet = new Set();
  const addCallback = (callback) => {
    callbackSet.add(callback);
    return () => {
      callbackSet.delete(callback);
    };
  };
  const dispatch = () => {
    for (const callback of callbackSet) {
      callback();
    }
  };
  return [{ addCallback }, dispatch];
};
const [beforePartialReload, dispatchBeforePartialReload] = createEvent();
const [afterPartialReload, dispatchAfterPartialReload] = createEvent();
const [beforeFullReload, dispatchBeforeFullReload] = createEvent();
const [beforePrune, dispatchBeforePrune] = createEvent();
export {
  dispatchAfterPartialReload,
  dispatchBeforeFullReload,
  dispatchBeforePartialReload,
  dispatchBeforePrune,
};

const hotEvents = {
  beforePartialReload,
  afterPartialReload,
  beforeFullReload,
  beforePrune,
};

export const createImportMetaHot = (importMetaUrl) => {
  const data = {};
  const url = asUrlWithoutHotSearchParam(importMetaUrl);

  return {
    data,
    events: hotEvents,
    accept: (firstArg, secondArg) => {
      if (!firstArg) {
        addUrlMeta(url, {
          dependencies: [url],
          acceptCallback: () => {},
        });
        return;
      }
      if (typeof firstArg === "function") {
        addUrlMeta(url, {
          dependencies: [url],
          acceptCallback: firstArg,
        });
        return;
      }
      if (typeof firstArg === "string") {
        addUrlMeta(url, {
          dependencies: [firstArg],
          acceptCallback: secondArg,
        });
        return;
      }
      if (Array.isArray(firstArg)) {
        addUrlMeta(url, {
          dependencies: firstArg,
          acceptCallback: secondArg,
        });
        return;
      }
      throw new Error(
        `invalid call to import.meta.hot.accept(), received ${firstArg}`,
      );
    },
    dispose: (callback) => {
      addUrlMeta(url, {
        disposeCallback: () => {
          return callback(data);
        },
      });
    },
    decline: () => {
      addUrlMeta(url, {
        declined: true,
      });
    },
    invalidate: () => {
      window.location.reload(true);
      addUrlMeta(url, {
        invalidated: true,
      });
    },
  };
};

const addUrlMeta = (url, meta) => {
  urlHotMetas[url] = {
    ...urlHotMetas[url],
    ...meta,
  };
};

const asUrlWithoutHotSearchParam = (url) => {
  const urlObject = new URL(url);
  if (urlObject.searchParams.has("hot")) {
    urlObject.searchParams.delete("hot");
    return urlObject.href;
  }
  return url;
};

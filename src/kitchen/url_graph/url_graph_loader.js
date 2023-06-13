export const createUrlGraphLoader = (kitchen) => {
  const promises = [];
  const promiseMap = new Map();
  const load = (
    urlInfo,
    dishContext,
    { ignoreRessourceHint = true, ignoreDynamicImport = false } = {},
  ) => {
    const promiseFromData = promiseMap.get(urlInfo);
    if (promiseFromData) return promiseFromData;
    const promise = (async () => {
      await kitchen.cook(urlInfo, {
        cookDuringCook: load,
        ...dishContext,
      });
      loadReferencedUrlInfos(urlInfo, {
        ignoreRessourceHint,
        ignoreDynamicImport,
      });
    })();
    promises.push(promise);
    promiseMap.set(urlInfo, promise);
    return promise;
  };

  const loadReferencedUrlInfos = (
    urlInfo,
    { ignoreRessourceHint, ignoreDynamicImport } = {},
  ) => {
    const { references } = urlInfo;
    references.current.forEach((reference) => {
      // we don't cook resource hints
      // because they might refer to resource that will be modified during build
      // It also means something else have to reference that url in order to cook it
      // so that the preload is deleted by "resync_resource_hints.js" otherwise
      if (ignoreRessourceHint && reference.isResourceHint) {
        return;
      }
      if (ignoreDynamicImport && reference.subtype === "import_dynamic") {
        return;
      }
      // we use reference.generatedUrl to mimic what a browser would do:
      // do a fetch to the specifier as found in the file
      const referencedUrlInfo = kitchen.graph.reuseOrCreateUrlInfo(
        reference,
        true,
      );
      load(referencedUrlInfo, {
        reference,
        ignoreRessourceHint,
        ignoreDynamicImport,
      });
    });
  };

  const getAllLoadDonePromise = async (operation) => {
    const waitAll = async () => {
      if (operation) {
        operation.throwIfAborted();
      }
      if (promises.length === 0) {
        return;
      }
      const promisesToWait = promises.slice();
      promises.length = 0;
      await Promise.all(promisesToWait);
      await waitAll();
    };
    await waitAll();
    promiseMap.clear();
  };

  return {
    loadReferencedUrlInfos,
    getAllLoadDonePromise,
  };
};

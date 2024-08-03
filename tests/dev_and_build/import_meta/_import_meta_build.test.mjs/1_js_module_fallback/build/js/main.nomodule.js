System.register([], function (_export, _context) {
  "use strict";

  var meta, url, urlDestructured, metaCopy;
  return {
    setters: [],
    execute: function () {
      meta = _context.meta;
      url = _context.meta.url;
      ({
        url: urlDestructured
      } = _context.meta);
      metaCopy = {
        ...meta
      };
      metaCopy.url = metaCopy.url.replace(window.origin, "window.origin");
      window.resolveResultPromise({
        meta: metaCopy,
        url: url.replace(window.origin, "window.origin"),
        urlDestructured: urlDestructured.replace(window.origin, "window.origin"),
        importMetaDev: undefined,
        importMetaTest: _context.meta.test,
        importMetaBuild: true
      });
    }
  };
});
System.register([], function (_export, _context) {
  "use strict";

  var meta, url, urlDestructured;
  return {
    setters: [],
    execute: function () {
      meta = _context.meta;
      url = _context.meta.url;
      ({
        url: urlDestructured
      } = _context.meta);
      window.resolveResultPromise({
        meta,
        url,
        urlDestructured,
        importMetaDev: undefined,
        importMetaTest: _context.meta.test,
        importMetaBuild: true
      });
    }
  };
});
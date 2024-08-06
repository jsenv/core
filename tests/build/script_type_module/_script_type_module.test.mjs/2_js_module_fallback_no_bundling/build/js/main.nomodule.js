System.register([__v__("/js/file.nomodule.js")], function (_export, _context) {
  "use strict";

  var answer;
  return {
    setters: [function (_fileJs) {
      answer = _fileJs.answer;
    }],
    execute: function () {
      setTimeout(() => {
        const url = _context.meta.url;
        window.resolveResultPromise({
          answer,
          url: url.replace(window.origin, "window.origin")
        });
      }, 100);
    }
  };
});
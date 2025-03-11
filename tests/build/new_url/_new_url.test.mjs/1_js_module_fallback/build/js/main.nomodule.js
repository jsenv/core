System.register([__v__("/js/file.nomodule.js")], function (_export, _context) {
  "use strict";

  var textFileUrl, absoluteUrl, windowLocationRelativeUrl, windowOriginRelativeUrl, absoluteBaseUrl;
  return {
    setters: [function (_fileJs) {}],
    execute: function () {
      textFileUrl = new URL(__v__("/other/file.txt"), _context.meta.url).href;
      console.log(textFileUrl);
      absoluteUrl = new URL("http://example.com/file.txt", "https://jsenv.dev").href;
      console.log(absoluteUrl);
      windowLocationRelativeUrl = {
        toto: new URL(__v__("/other/file.txt"), window.location).href
      }.toto;
      windowOriginRelativeUrl = new URL(__v__("/other/file.txt"), window.origin).href;
      absoluteBaseUrl = new URL("./file.txt", "http://jsenv.dev").href;
      window.resolveResultPromise({
        textFileUrl: textFileUrl.replace(window.origin, "window.origin"),
        absoluteUrl,
        windowLocationRelativeUrl: windowLocationRelativeUrl.replace(window.origin, "window.origin"),
        windowOriginRelativeUrl: windowOriginRelativeUrl.replace(window.origin, "window.origin"),
        absoluteBaseUrl: absoluteBaseUrl.replace(window.origin, "window.origin")
      });
    }
  };
});
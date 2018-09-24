"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
var createBrowserIndexHTML = exports.createBrowserIndexHTML = function createBrowserIndexHTML(_ref) {
  var loaderSource = _ref.loaderSource;

  return "<!doctype html>\n\n<head>\n  <title>Skeleton for chrome headless</title>\n  <meta charset=\"utf-8\" />\n\t<script type=\"text/javascript\">\n\t\t" + loaderSource + "\n\t</script>\n  <script type=\"text/javascript\">\n    window.System = window.createBrowserLoader.createBrowserLoader()\n  </script>\n</head>\n\n<body>\n  <main></main>\n</body>\n\n</html>";
};
//# sourceMappingURL=createBrowserIndexHTML.js.map
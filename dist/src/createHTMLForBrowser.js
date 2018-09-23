"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createHTMLForBrowser = exports.detectIndentation = undefined;

var _fs = require("fs");

var _fs2 = _interopRequireDefault(_fs);

var _path = require("path");

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var readBrowserLoader = function readBrowserLoader() {
  return new Promise(function (resolve, reject) {
    var filename = _path2["default"].resolve(__dirname,
    // we add an additional ../ to get rid of dist/
    "../../node_modules/@dmail/module-loader/src/browser/index.js");
    _fs2["default"].readFile(filename, function (error, buffer) {
      if (error) {
        reject(error);
      } else {
        resolve(buffer.toString());
      }
    });
  });
};

var countLeading = function countLeading(string, predicate) {
  var leading = 0;
  var i = 0;
  while (i < string.length) {
    if (predicate(string[i])) {
      i++;
      leading++;
    } else {
      break;
    }
  }
  return leading;
};

var detectLineSeparator = function detectLineSeparator(string) {
  var lineSeparators = ["\r\n", "\r", "\n"];
  return lineSeparators.find(function (separator) {
    return string.indexOf(separator) > -1;
  });
};

var detectIndentation = exports.detectIndentation = function detectIndentation(lines) {
  var firstLineWithLeadingWhiteSpace = lines.find(function (line) {
    return line[0] === " " || line[0] === "\t";
  });

  if (!firstLineWithLeadingWhiteSpace) {
    return "";
  }

  if (firstLineWithLeadingWhiteSpace[0] === " ") {
    return " ".repeat(countLeading(firstLineWithLeadingWhiteSpace), function (char) {
      return char === " ";
    });
  }

  return "\t".repeat(countLeading(firstLineWithLeadingWhiteSpace), function (char) {
    return char === "\t";
  });
};

var prefixLines = function prefixLines(string) {
  var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "  ";

  var _ref = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {},
      _ref$lineSeparator = _ref.lineSeparator,
      lineSeparator = _ref$lineSeparator === undefined ? "auto" : _ref$lineSeparator;

  if (lineSeparator === "auto") {
    lineSeparator = detectLineSeparator(string);
  }

  var lines = string.split(lineSeparator);

  return lines.map(function (line, index) {
    return "" + (index === 0 ? "" : prefix) + line;
  }).join(lineSeparator);
};

var renderScript = function renderScript(_ref2) {
  var source = _ref2.source;

  return "<script type=\"text/javascript\">\n  " + source + "\n</script>";
};

var createHTMLForBrowser = exports.createHTMLForBrowser = function createHTMLForBrowser() {
  var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref3$title = _ref3.title,
      title = _ref3$title === undefined ? "Untitled" : _ref3$title,
      _ref3$charset = _ref3.charset,
      charset = _ref3$charset === undefined ? "utf-8" : _ref3$charset,
      script = _ref3.script;

  return readBrowserLoader().then(function (loaderSource) {
    return "<!doctype html>\n\n<head>\n  <title>" + title + "</title>\n  <meta charset=\"" + charset + "\" />\n</head>\n\n<body>\n  <main></main>\n  " + prefixLines(renderScript({ source: loaderSource }), "  ") + "\n  " + prefixLines(renderScript({
      source: "window.System = window.createBrowserLoader.createBrowserLoader()"
    }), "  ") + "\n  " + prefixLines(renderScript({
      source: script
    }), "  ") + "\n</body>\n\n</html>";
  });
};
//# sourceMappingURL=createHTMLForBrowser.js.map
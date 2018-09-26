"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createHTMLForBrowser = exports.detectIndentation = void 0;

var _fs = _interopRequireDefault(require("fs"));

var _path = _interopRequireDefault(require("path"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const readBrowserLoader = () => {
  return new Promise((resolve, reject) => {
    const filename = _path.default.resolve(__dirname, // we add an additional ../ to get rid of dist/
    "../../node_modules/@dmail/module-loader/src/browser/index.js");

    _fs.default.readFile(filename, (error, buffer) => {
      if (error) {
        reject(error);
      } else {
        resolve(buffer.toString());
      }
    });
  });
};

const countLeading = (string, predicate) => {
  let leading = 0;
  let i = 0;

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

const detectLineSeparator = string => {
  const lineSeparators = ["\r\n", "\r", "\n"];
  return lineSeparators.find(separator => {
    return string.indexOf(separator) > -1;
  });
};

const detectIndentation = lines => {
  const firstLineWithLeadingWhiteSpace = lines.find(line => {
    return line[0] === " " || line[0] === "\t";
  });

  if (!firstLineWithLeadingWhiteSpace) {
    return "";
  }

  if (firstLineWithLeadingWhiteSpace[0] === " ") {
    return " ".repeat(countLeading(firstLineWithLeadingWhiteSpace), char => char === " ");
  }

  return "\t".repeat(countLeading(firstLineWithLeadingWhiteSpace), char => char === "\t");
};

exports.detectIndentation = detectIndentation;

const prefixLines = (string, prefix = "  ", {
  lineSeparator = "auto"
} = {}) => {
  if (lineSeparator === "auto") {
    lineSeparator = detectLineSeparator(string);
  }

  const lines = string.split(lineSeparator);
  return lines.map((line, index) => `${index === 0 ? "" : prefix}${line}`).join(lineSeparator);
};

const renderScript = ({
  source
}) => {
  return `<script type="text/javascript">
  ${source}
</script>`;
};

const createHTMLForBrowser = ({
  title = "Untitled",
  charset = "utf-8",
  script
} = {}) => {
  return readBrowserLoader().then(loaderSource => {
    return `<!doctype html>

<head>
  <title>${title}</title>
  <meta charset="${charset}" />
</head>

<body>
  <main></main>
  ${prefixLines(renderScript({
      source: loaderSource
    }), "  ")}
  ${prefixLines(renderScript({
      source: `window.System = window.createBrowserLoader.createBrowserLoader()`
    }), "  ")}
  ${prefixLines(renderScript({
      source: script
    }), "  ")}
</body>

</html>`;
  });
};

exports.createHTMLForBrowser = createHTMLForBrowser;
//# sourceMappingURL=createHTMLForBrowser.js.map
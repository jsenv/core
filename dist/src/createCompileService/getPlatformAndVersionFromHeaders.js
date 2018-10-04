"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.getPlatformAndVersionFromHeaders = void 0;

var _uaParserJs = _interopRequireDefault(require("ua-parser-js"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const getPlatformNameAndVersionFromUserAgent = userAgent => {
  if (userAgent.startsWith("node/")) {
    return {
      platformName: "node",
      platformVersion: userAgent.slice("node/".length)
    };
  }

  const data = (0, _uaParserJs.default)(userAgent);
  return {
    platformName: data.browser.name,
    platformVersion: data.browser.version
  };
};

const getPlatformAndVersionFromHeaders = headers => {
  if (headers.has("user-agent")) {
    return getPlatformNameAndVersionFromUserAgent(headers.get("user-agent"));
  }

  return {
    platformName: "unknown",
    platformVersion: "0"
  };
};

exports.getPlatformAndVersionFromHeaders = getPlatformAndVersionFromHeaders;
//# sourceMappingURL=getPlatformAndVersionFromHeaders.js.map
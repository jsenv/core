"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openFirefoxClient = void 0;

var _seleniumWebdriver = require("selenium-webdriver");

var _firefox = _interopRequireDefault(require("selenium-webdriver/firefox"));

var _createHTMLForBrowser = require("../createHTMLForBrowser.js");

var _openIndexServer = require("../openIndexServer/openIndexServer.js");

var _getRemoteLocation = require("../getRemoteLocation.js");

var _getClientSetupAndTeardown = require("../getClientSetupAndTeardown.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var clientFunction = function clientFunction(file, setupSource, teardownSource, done) {
  eval(setupSource)(file);
  window.System.import(file).then(eval(teardownSource)).then(function (value) {
    return done({
      status: "resolved",
      value: value
    });
  }, function (value) {
    return done({
      status: "rejected",
      value: value
    });
  });
};

var openFirefoxClient = function openFirefoxClient(_ref) {
  var compileURL = _ref.compileURL,
      _ref$headless = _ref.headless,
      headless = _ref$headless === void 0 ? true : _ref$headless,
      _ref$runFile = _ref.runFile,
      runFile = _ref$runFile === void 0 ? function (_ref2) {
    var driver = _ref2.driver,
        file = _ref2.file,
        setup = _ref2.setup,
        teardown = _ref2.teardown;
    return driver.executeScriptAsync("(".concat(clientFunction.toString(), ".apply(this, arguments)"), file, "(".concat(setup.toString(), ")"), "(".concat(teardown.toString(), ")")).then(function (_ref3) {
      var status = _ref3.status,
          value = _ref3.value;
      return status === "resolved" ? value : Promise.reject(value);
    });
  } : _ref$runFile;
  var options = new _firefox.default.Options();

  if (headless) {
    options.headless();
  }

  return new _seleniumWebdriver.Builder().forBrowser("firefox").setFirefoxOptions(options).build().then(function (driver) {
    return (0, _createHTMLForBrowser.createHTMLForBrowser)({
      title: "Skeleton for Firefox"
    }).then(function (indexHTML) {
      return (0, _openIndexServer.openIndexServer)({
        indexBody: indexHTML
      }).then(function (indexRequestHandler) {
        var execute = function execute(_ref4) {
          var file = _ref4.file,
              _ref4$autoClean = _ref4.autoClean,
              autoClean = _ref4$autoClean === void 0 ? false : _ref4$autoClean,
              _ref4$collectCoverage = _ref4.collectCoverage,
              collectCoverage = _ref4$collectCoverage === void 0 ? false : _ref4$collectCoverage;
          var remoteFile = (0, _getRemoteLocation.getRemoteLocation)({
            compileURL: compileURL,
            file: file
          });
          return driver.get(indexRequestHandler.url).then(function () {
            return runFile(_objectSpread({
              driver: driver,
              file: remoteFile
            }, (0, _getClientSetupAndTeardown.getBrowserSetupAndTeardowm)({
              collectCoverage: collectCoverage
            })));
          }).then(function (_ref5) {
            var status = _ref5.status,
                value = _ref5.value;

            if (autoClean) {
              indexRequestHandler.stop();
            }

            if (status === "resolved") {
              return value;
            }

            return Promise.reject(value);
          });
        };

        var close = function close() {
          return driver.quit();
        };

        return {
          execute: execute,
          close: close
        };
      });
    });
  });
};

exports.openFirefoxClient = openFirefoxClient;
//# sourceMappingURL=openFirefoxClient.js.map
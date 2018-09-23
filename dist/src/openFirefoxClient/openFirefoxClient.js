"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openFirefoxClient = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; // https://www.npmjs.com/package/selenium-webdriver

// http://seleniumhq.github.io/selenium/docs/api/javascript/module/selenium-webdriver/index_exports_WebDriver.html

// https://github.com/SeleniumHQ/selenium/blob/master/javascript/node/selenium-webdriver/firefox.js#L34


var _seleniumWebdriver = require("selenium-webdriver");

var _firefox = require("selenium-webdriver/firefox");

var _firefox2 = _interopRequireDefault(_firefox);

var _createHTMLForBrowser = require("../createHTMLForBrowser.js");

var _openIndexServer = require("../openIndexServer/openIndexServer.js");

var _getRemoteLocation = require("../getRemoteLocation.js");

var _getClientSetupAndTeardown = require("../getClientSetupAndTeardown.js");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var clientFunction = function clientFunction(file, setupSource, teardownSource, done) {
  eval(setupSource)(file);
  window.System["import"](file).then(eval(teardownSource)).then(function (value) {
    return done({ status: "resolved", value: value });
  }, function (value) {
    return done({ status: "rejected", value: value });
  });
};

var openFirefoxClient = exports.openFirefoxClient = function openFirefoxClient(_ref) {
  var compileURL = _ref.compileURL,
      _ref$headless = _ref.headless,
      headless = _ref$headless === undefined ? true : _ref$headless,
      _ref$runFile = _ref.runFile,
      runFile = _ref$runFile === undefined ? function (_ref2) {
    var driver = _ref2.driver,
        file = _ref2.file,
        setup = _ref2.setup,
        teardown = _ref2.teardown;

    return driver.executeScriptAsync("(" + clientFunction.toString() + ".apply(this, arguments)", file, "(" + setup.toString() + ")", "(" + teardown.toString() + ")").then(function (_ref3) {
      var status = _ref3.status,
          value = _ref3.value;

      return status === "resolved" ? value : Promise.reject(value);
    });
  } : _ref$runFile;

  var options = new _firefox2["default"].Options();
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
              autoClean = _ref4$autoClean === undefined ? false : _ref4$autoClean,
              _ref4$collectCoverage = _ref4.collectCoverage,
              collectCoverage = _ref4$collectCoverage === undefined ? false : _ref4$collectCoverage;

          var remoteFile = (0, _getRemoteLocation.getRemoteLocation)({
            compileURL: compileURL,

            file: file
          });

          return driver.get(indexRequestHandler.url).then(function () {
            return runFile(_extends({
              driver: driver,
              file: remoteFile
            }, (0, _getClientSetupAndTeardown.getBrowserSetupAndTeardowm)({ collectCoverage: collectCoverage })));
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

        return { execute: execute, close: close };
      });
    });
  });
};
//# sourceMappingURL=openFirefoxClient.js.map
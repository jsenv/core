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

const clientFunction = (file, setupSource, teardownSource, done) => {
  eval(setupSource)(file);
  window.System.import(file).then(eval(teardownSource)).then(value => done({
    status: "resolved",
    value
  }), value => done({
    status: "rejected",
    value
  }));
};

const openFirefoxClient = ({
  compileURL,
  headless = true,
  runFile = ({
    driver,
    file,
    setup,
    teardown
  }) => {
    return driver.executeScriptAsync(`(${clientFunction.toString()}.apply(this, arguments)`, file, `(${setup.toString()})`, `(${teardown.toString()})`).then(({
      status,
      value
    }) => {
      return status === "resolved" ? value : Promise.reject(value);
    });
  }
}) => {
  const options = new _firefox.default.Options();

  if (headless) {
    options.headless();
  }

  return new _seleniumWebdriver.Builder().forBrowser("firefox").setFirefoxOptions(options).build().then(driver => {
    return (0, _createHTMLForBrowser.createHTMLForBrowser)({
      title: "Skeleton for Firefox"
    }).then(indexHTML => {
      return (0, _openIndexServer.openIndexServer)({
        indexBody: indexHTML
      }).then(indexRequestHandler => {
        const execute = ({
          file,
          autoClean = false,
          collectCoverage = false
        }) => {
          const remoteFile = (0, _getRemoteLocation.getRemoteLocation)({
            compileURL,
            file
          });
          return driver.get(indexRequestHandler.url).then(() => runFile(_objectSpread({
            driver,
            file: remoteFile
          }, (0, _getClientSetupAndTeardown.getBrowserSetupAndTeardowm)({
            collectCoverage
          })))).then(({
            status,
            value
          }) => {
            if (autoClean) {
              indexRequestHandler.stop();
            }

            if (status === "resolved") {
              return value;
            }

            return Promise.reject(value);
          });
        };

        const close = () => {
          return driver.quit();
        };

        return {
          execute,
          close
        };
      });
    });
  });
};

exports.openFirefoxClient = openFirefoxClient;
//# sourceMappingURL=openFirefoxClient.js.map
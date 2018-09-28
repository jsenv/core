"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openChromiumClient = void 0;

var _puppeteer = _interopRequireDefault(require("puppeteer"));

var _createHTMLForBrowser = require("../createHTMLForBrowser.js");

var _openIndexServer = require("../openIndexServer/openIndexServer.js");

var _getRemoteLocation = require("../getRemoteLocation.js");

var _getClientSetupAndTeardown = require("../getClientSetupAndTeardown.js");

var _signal = require("@dmail/signal");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

var openIndexRequestInterception = function openIndexRequestInterception(_ref) {
  var url = _ref.url,
      page = _ref.page,
      body = _ref.body;
  return page.setRequestInterception(true).then(function () {
    page.on("request", function (interceptedRequest) {
      if (interceptedRequest.url().startsWith(url)) {
        interceptedRequest.respond({
          status: 200,
          contentType: "text/html",
          headers: {
            "content-type": "text/html",
            "content-length": Buffer.byteLength(body),
            "cache-control": "no-store"
          },
          body: body
        });
        return;
      }
    });
  }).then(function () {
    return {
      url: url,
      close: function close() {
        return page.setRequestInterception(false);
      }
    };
  });
};

var openChromiumClient = function openChromiumClient(_ref2) {
  var _ref2$url = _ref2.url,
      url = _ref2$url === void 0 ? "https://127.0.0.1:0" : _ref2$url,
      server = _ref2.server,
      compileURL = _ref2.compileURL,
      _ref2$openIndexReques = _ref2.openIndexRequestHandler,
      openIndexRequestHandler = _ref2$openIndexReques === void 0 ? _openIndexServer.openIndexServer : _ref2$openIndexReques,
      _ref2$headless = _ref2.headless,
      headless = _ref2$headless === void 0 ? true : _ref2$headless,
      _ref2$mirrorConsole = _ref2.mirrorConsole,
      mirrorConsole = _ref2$mirrorConsole === void 0 ? false : _ref2$mirrorConsole,
      _ref2$runFile = _ref2.runFile,
      runFile = _ref2$runFile === void 0 ? function (_ref3) {
    var serverURL = _ref3.serverURL,
        page = _ref3.page,
        file = _ref3.file,
        setup = _ref3.setup,
        teardown = _ref3.teardown;
    return page.evaluate(function (compileRoot, file, setupSource, teardownSource) {
      var evtSource = new EventSource(compileRoot);
      evtSource.addEventListener("message", function (e) {
        console.log("received event", e);
      });
      return Promise.resolve(file).then(eval(setupSource)).then(function () {
        return window.System.import(file);
      }).then(eval(teardownSource));
    }, serverURL.href, file, "(".concat(setup.toString(), ")"), "(".concat(teardown.toString(), ")"));
  } : _ref2$runFile;

  if (openIndexRequestHandler === openIndexRequestInterception && headless === false) {
    throw new Error("openIndexRequestInterception work only in headless mode");
  }

  var openBrowser = function openBrowser() {
    return _puppeteer.default.launch({
      headless: headless,
      ignoreHTTPSErrors: true // because we use a self signed certificate
      // handleSIGINT: true,
      // handleSIGTERM: true,
      // handleSIGHUP: true,
      // because the 3 above are true by default pupeeter will auto close browser
      // so we apparently don't have to use listenNodeBeforeExit in order to close browser
      // as we do for server

    });
  }; // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md


  var execute = function execute(_ref4) {
    var file = _ref4.file,
        _ref4$autoClose = _ref4.autoClose,
        autoClose = _ref4$autoClose === void 0 ? false : _ref4$autoClose,
        _ref4$autoCloseOnErro = _ref4.autoCloseOnError,
        autoCloseOnError = _ref4$autoCloseOnErro === void 0 ? false : _ref4$autoCloseOnErro,
        _ref4$collectCoverage = _ref4.collectCoverage,
        collectCoverage = _ref4$collectCoverage === void 0 ? false : _ref4$collectCoverage,
        _ref4$executeTest = _ref4.executeTest,
        executeTest = _ref4$executeTest === void 0 ? false : _ref4$executeTest;
    var closed = (0, _signal.createSignal)();

    var close = function close() {
      closed.emit();
    };

    var promise = openBrowser().then(function (browser) {
      closed.listen(function () {
        browser.close();
      });
      return browser.newPage().then(function (page) {
        closed.listen(function () {// page.close() // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
        });

        var createPageUnexpectedBranch = function createPageUnexpectedBranch(page) {
          return new Promise(function (resolve, reject) {
            // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
            page.on("error", reject); // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror

            page.on("pageerror", reject);
          });
        };

        var createPageExpectedBranch = function createPageExpectedBranch(page) {
          if (mirrorConsole) {
            page.on("console", function (message) {
              // there is also message._args
              // which is an array of JSHandle{ _context, _client _remoteObject }
              console[message._type](message._text);
            });
          }

          return (0, _createHTMLForBrowser.createHTMLForBrowser)({
            title: "Skeleton for Chromium"
          }).then(function (html) {
            return openIndexRequestHandler({
              url: url,
              page: page,
              body: html
            }).then(function (indexRequestHandler) {
              closed.listen(function () {
                indexRequestHandler.close();
              });
              var remoteFile = (0, _getRemoteLocation.getRemoteLocation)({
                compileURL: compileURL,
                file: file
              });
              return page.goto(String(indexRequestHandler.url)).then(function () {
                return runFile(_objectSpread({
                  serverURL: server.url,
                  page: page,
                  file: remoteFile
                }, (0, _getClientSetupAndTeardown.getBrowserSetupAndTeardowm)({
                  collectCoverage: collectCoverage,
                  executeTest: executeTest
                })));
              });
            });
          });
        };

        return Promise.race([createPageUnexpectedBranch(page), createPageExpectedBranch(page)]);
      });
    }).then(function (value) {
      if (autoClose) {
        close();
      }

      return value;
    }, function (reason) {
      if (autoCloseOnError) {
        close();
      }

      return Promise.reject(reason);
    });
    return Promise.resolve({
      promise: promise,
      close: close
    });
  };

  return Promise.resolve({
    execute: execute
  });
};

exports.openChromiumClient = openChromiumClient;
//# sourceMappingURL=openChromiumClient.js.map
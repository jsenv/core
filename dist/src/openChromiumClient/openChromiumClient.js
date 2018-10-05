"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.openChromiumClient = void 0;

var _createHTMLForBrowser = require("../createHTMLForBrowser.js");

var _openIndexServer = require("../openIndexServer/openIndexServer.js");

var _getRemoteLocation = require("../getRemoteLocation.js");

var _getClientSetupAndTeardown = require("../getClientSetupAndTeardown.js");

var _signal = require("@dmail/signal");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const openIndexRequestInterception = ({
  url,
  page,
  body
}) => {
  return page.setRequestInterception(true).then(() => {
    page.on("request", interceptedRequest => {
      if (interceptedRequest.url().startsWith(url)) {
        interceptedRequest.respond({
          status: 200,
          contentType: "text/html",
          headers: {
            "content-type": "text/html",
            "content-length": Buffer.byteLength(body),
            "cache-control": "no-store"
          },
          body
        });
        return;
      }
    });
  }).then(() => {
    return {
      url,
      close: () => page.setRequestInterception(false)
    };
  });
};

const openChromiumClient = ({
  puppeteer,
  url = "https://127.0.0.1:0",
  server,
  compileURL,
  openIndexRequestHandler = _openIndexServer.openIndexServer,
  headless = true,
  mirrorConsole = false,
  runFile = ({
    serverURL,
    page,
    file,
    setup,
    teardown
  }) => {
    return page.evaluate((compileRoot, file, setupSource, teardownSource) => {
      const evtSource = new EventSource(compileRoot);
      evtSource.addEventListener("message", e => {
        console.log("received event", e);
      });
      return Promise.resolve(file).then(eval(setupSource)).then(() => window.System.import(file)).then(eval(teardownSource));
    }, serverURL.href, file, `(${setup.toString()})`, `(${teardown.toString()})`);
  }
}) => {
  if (openIndexRequestHandler === openIndexRequestInterception && headless === false) {
    throw new Error(`openIndexRequestInterception work only in headless mode`);
  }

  const openBrowser = () => {
    return puppeteer.launch({
      headless,
      ignoreHTTPSErrors: true // because we use a self signed certificate
      // handleSIGINT: true,
      // handleSIGTERM: true,
      // handleSIGHUP: true,
      // because the 3 above are true by default pupeeter will auto close browser
      // so we apparently don't have to use listenNodeBeforeExit in order to close browser
      // as we do for server

    });
  }; // https://github.com/GoogleChrome/puppeteer/blob/master/docs/api.md


  const execute = ({
    file,
    autoClose = false,
    // autoCloseOnError is different than autoClose because you often want to keep browser opened to debug error
    autoCloseOnError = false,
    collectCoverage = false,
    executeTest = false
  }) => {
    const closed = (0, _signal.createSignal)();

    const close = () => {
      closed.emit();
    };

    const promise = openBrowser().then(browser => {
      closed.listen(() => {
        browser.close();
      });
      return browser.newPage().then(page => {
        closed.listen(() => {// page.close() // commented until https://github.com/GoogleChrome/puppeteer/issues/2269
        });

        const createPageUnexpectedBranch = page => {
          return new Promise((resolve, reject) => {
            // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-error
            page.on("error", reject); // https://github.com/GoogleChrome/puppeteer/blob/v1.4.0/docs/api.md#event-pageerror

            page.on("pageerror", reject);
          });
        };

        const createPageExpectedBranch = page => {
          if (mirrorConsole) {
            page.on("console", message => {
              // there is also message._args
              // which is an array of JSHandle{ _context, _client _remoteObject }
              console[message._type](message._text);
            });
          }

          return (0, _createHTMLForBrowser.createHTMLForBrowser)({
            title: "Skeleton for Chromium"
          }).then(html => {
            return openIndexRequestHandler({
              url,
              page,
              body: html
            }).then(indexRequestHandler => {
              closed.listen(() => {
                indexRequestHandler.close();
              });
              const remoteFile = (0, _getRemoteLocation.getRemoteLocation)({
                compileURL,
                file
              });
              return page.goto(String(indexRequestHandler.url)).then(() => runFile(_objectSpread({
                serverURL: server.url,
                page,
                file: remoteFile
              }, (0, _getClientSetupAndTeardown.getBrowserSetupAndTeardowm)({
                collectCoverage,
                executeTest
              }))));
            });
          });
        };

        return Promise.race([createPageUnexpectedBranch(page), createPageExpectedBranch(page)]);
      });
    }).then(value => {
      if (autoClose) {
        close();
      }

      return value;
    }, reason => {
      if (autoCloseOnError) {
        close();
      }

      return Promise.reject(reason);
    });
    return Promise.resolve({
      promise,
      close
    });
  };

  return Promise.resolve({
    execute
  });
};

exports.openChromiumClient = openChromiumClient;
//# sourceMappingURL=openChromiumClient.js.map
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.listenRequest = exports.openServer = undefined;

var _http = require("http");

var _http2 = _interopRequireDefault(_http);

var _https = require("https");

var _https2 = _interopRequireDefault(_https);

var _url = require("url");

var _createSelfSignature = require("./createSelfSignature.js");

var _processTeardown = require("./processTeardown.js");

var _createNodeRequestHandler = require("./createNodeRequestHandler.js");

var _signal = require("@dmail/signal");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

// import { addNodeExceptionHandler } from "./addNodeExceptionHandler.js"
var REASON_CLOSING = "closing";

var openServer = exports.openServer = function openServer() {
  var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref$url = _ref.url,
      url = _ref$url === undefined ? "https://127.0.0.1:0" : _ref$url,
      _ref$getSignature = _ref.getSignature,
      getSignature = _ref$getSignature === undefined ? _createSelfSignature.createSelfSignature : _ref$getSignature,
      _ref$autoCloseOnExit = _ref.autoCloseOnExit,
      autoCloseOnExit = _ref$autoCloseOnExit === undefined ? true : _ref$autoCloseOnExit,
      _ref$autoCloseOnCrash = _ref.autoCloseOnCrash,
      autoCloseOnCrash = _ref$autoCloseOnCrash === undefined ? true : _ref$autoCloseOnCrash,
      _ref$autoCloseOnError = _ref.autoCloseOnError,
      autoCloseOnError = _ref$autoCloseOnError === undefined ? true : _ref$autoCloseOnError;

  url = new _url.URL(url);

  var protocol = url.protocol;
  var hostname = url.hostname;

  if (hostname === "0.0.0.0" && process.platform === "win32") {
    // https://github.com/nodejs/node/issues/14900
    throw new Error("listening " + hostname + " any not available on window");
  }

  var nodeServer = void 0;
  var agent = void 0;
  if (protocol === "http:") {
    nodeServer = _http2["default"].createServer();
    agent = global.Agent;
  } else if (protocol === "https:") {
    var _getSignature = getSignature(),
        privateKey = _getSignature.privateKey,
        certificate = _getSignature.certificate;

    nodeServer = _https2["default"].createServer({
      key: privateKey,
      cert: certificate
    });
    agent = new _https2["default"].Agent({
      rejectUnauthorized: false // allow self signed certificate
    });
  } else {
    throw new Error("unsupported protocol " + protocol);
  }

  var port = url.port;

  var connections = new Set();
  nodeServer.on("connection", function (connection) {
    connection.on("close", function () {
      connections["delete"](connection);
    });
    connections.add(connection);
  });

  var requestHandlers = [];
  var addInternalRequestHandler = function addInternalRequestHandler(handler) {
    requestHandlers.push(handler);
    nodeServer.on("request", handler);
    return function () {
      nodeServer.removeListener("request", handler);
    };
  };

  var addRequestHandler = function addRequestHandler(handler, transform) {
    var nodeRequestHandler = (0, _createNodeRequestHandler.createNodeRequestHandler)({ handler: handler, transform: transform, url: url });
    return addInternalRequestHandler(nodeRequestHandler);
  };

  var clients = new Set();

  var closeClients = function closeClients(_ref2) {
    var isError = _ref2.isError,
        reason = _ref2.reason;

    var status = void 0;
    if (isError) {
      status = 500;
      // reason = 'shutdown because error'
    } else {
      status = 503;
      // reason = 'unavailable because closing'
    }

    return Promise.all(Array.from(clients).map(function (_ref3) {
      var response = _ref3.response;

      if (response.headersSent === false) {
        response.writeHead(status, reason);
      }

      return new Promise(function (resolve) {
        if (response.finished === false) {
          response.on("finish", resolve);
          response.on("error", resolve);
          response.destroy(reason);
        } else {
          resolve();
        }
      });
    }));
  };

  addInternalRequestHandler(function (nodeRequest, nodeResponse) {
    var client = { nodeRequest: nodeRequest, nodeResponse: nodeResponse };

    clients.add(client);
    nodeResponse.on("finish", function () {
      clients["delete"](client);
    });
  });

  // nodeServer.on("upgrade", (request, socket, head) => {
  //   // when being requested using a websocket
  //   // we could also answr to the request ?
  //   // socket.end([data][, encoding])

  //   console.log("upgrade", { head, request })
  //   console.log("socket", { connecting: socket.connecting, destroyed: socket.destroyed })
  // })

  var status = "opening";

  var listen = function listen() {
    return new Promise(function (resolve, reject) {
      nodeServer.listen(port, hostname, function (error) {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  };

  var closed = (0, _signal.createSignal)();

  return listen().then(function () {
    status = "opened";

    // in case port is 0 (randomly assign an available port)
    // https://nodejs.org/api/net.html#net_server_listen_port_host_backlog_callback
    var port = nodeServer.address().port;
    url.port = port;

    var closeConnections = function closeConnections(reason) {
      // should we do this async ?
      // should we do this before closing the server ?
      connections.forEach(function (connection) {
        connection.destroy(reason);
      });
    };

    var close = function close() {
      var _ref4 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
          _ref4$isError = _ref4.isError,
          isError = _ref4$isError === undefined ? false : _ref4$isError,
          _ref4$reason = _ref4.reason,
          reason = _ref4$reason === undefined ? REASON_CLOSING : _ref4$reason;

      if (status !== "opened") {
        throw new Error("server status must be \"opened\" during close() (got " + status);
      }

      // ensure we don't try to handle request while server is closing
      requestHandlers.forEach(function (requestHandler) {
        nodeServer.removeListener("request", requestHandler);
      });
      requestHandlers.length = 0;

      status = "closing";

      return new Promise(function (resolve, reject) {
        // closing server prevent it from accepting new connections
        // but opened connection must be shutdown before the close event is emitted
        nodeServer.once("close", function (error) {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
        nodeServer.close();
        closeClients({ isError: isError, reason: reason }).then(function () {
          closeConnections(reason);
        });
      }).then(function () {
        status = "closed";
        closed.emit();
      });
    };

    if (autoCloseOnError) {
      var removeAutoCloseOnError = addInternalRequestHandler(function (nodeRequest, nodeResponse) {
        if (nodeResponse.statusCode === 500) {
          close({
            isError: true,
            // we don't specify the true error object but only a string
            // identifying the error to avoid sending stacktrace to client
            // and right now there is no clean way to retrieve error from here
            reason: nodeResponse.statusMessage || "internal error"
          });
        }
      });
      var wrappedClose = close;
      close = function close() {
        removeAutoCloseOnError();
        return wrappedClose.apply(undefined, arguments);
      };
    }

    if (autoCloseOnExit) {
      var removeTeardown = (0, _processTeardown.processTeardown)(function (exitReason) {
        close({ reason: "server process exiting " + exitReason });
      });
      var _wrappedClose = close;
      close = function close() {
        removeTeardown();
        return _wrappedClose.apply(undefined, arguments);
      };
    }

    if (autoCloseOnCrash) {
      // and if we do that we have to remove the listener
      // while closing to avoid closing twice in case
      // addNodeExceptionHandler((exception) => {
      //   return close({ reason: exception }).then(
      //     // to indicates exception is not handled
      //     () => false,
      //   )
      // })
    }

    return {
      url: url,
      nodeServer: nodeServer,
      addRequestHandler: addRequestHandler,
      agent: agent,
      close: close,
      closed: closed
    };
  });
};

var listenRequest = exports.listenRequest = function listenRequest(nodeServer, requestHandler) {
  nodeServer.on("request", requestHandler);
};
//# sourceMappingURL=openServer.js.map
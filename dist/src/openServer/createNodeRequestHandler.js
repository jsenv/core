"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enableCORS = exports.createNodeRequestHandler = exports.populateNodeResponse = exports.createRequestFromNodeRequest = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; }; // https://github.com/jsenv/core/tree/master/src/util/rest

var _url = require("url");

var _createBody = require("./createBody.js");

var _createHeaders = require("./createHeaders.js");

var _signal = require("@dmail/signal");

// serverURL pourrait valoir par défaut `file:///${process.cwd()}` ?
var createRequestFromNodeRequest = exports.createRequestFromNodeRequest = function createRequestFromNodeRequest(nodeRequest, serverURL) {
  var method = nodeRequest.method;

  var url = new _url.URL(nodeRequest.url, serverURL);
  var headers = (0, _createHeaders.createHeaders)(nodeRequest.headers);
  var body = (0, _createBody.createBody)(method === "POST" || method === "PUT" || method === "PATCH" ? nodeRequest : undefined);

  return Object.freeze({
    method: method,
    url: url,
    headers: headers,
    body: body
  });
};

var populateNodeResponse = exports.populateNodeResponse = function populateNodeResponse(nodeResponse, _ref) {
  var status = _ref.status,
      _ref$reason = _ref.reason,
      reason = _ref$reason === undefined ? "" : _ref$reason,
      headers = _ref.headers,
      body = _ref.body;

  var headerAsJSON = headers.toJSON();
  nodeResponse.writeHead(status, reason, headerAsJSON);

  var keepAlive = headers.get("connection") === "keep-alive";
  body.pipeTo(nodeResponse, { propagateClose: !keepAlive });
};

var createResponse = function createResponse(_ref2) {
  var method = _ref2.method;

  var _ref3 = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
      _ref3$status = _ref3.status,
      status = _ref3$status === undefined ? 501 : _ref3$status,
      reason = _ref3.reason,
      _ref3$headers = _ref3.headers,
      headers = _ref3$headers === undefined ? (0, _createHeaders.createHeaders)() : _ref3$headers,
      _ref3$body = _ref3.body,
      body = _ref3$body === undefined ? (0, _createBody.createBody)() : _ref3$body;

  if (method === "HEAD") {
    // don't send body for HEAD requests
    body = (0, _createBody.createBody)();
  } else {
    body = (0, _createBody.createBody)(body);
  }

  headers = (0, _createHeaders.createHeaders)(headers);

  return Object.freeze({ status: status, reason: reason, headers: headers, body: body });
};

var createNodeRequestHandler = exports.createNodeRequestHandler = function createNodeRequestHandler(_ref4) {
  var handler = _ref4.handler,
      _ref4$transform = _ref4.transform,
      transform = _ref4$transform === undefined ? function (response) {
    return response;
  } : _ref4$transform,
      url = _ref4.url;

  return function (nodeRequest, nodeResponse) {
    var closed = (0, _signal.createSignal)({ smart: true });
    nodeResponse.connection.once("close", function () {
      return closed.emit();
    });

    // should have some kind of id for a request
    // so that logs knows whichs request they belong to
    var request = createRequestFromNodeRequest(nodeRequest, url);
    console.log(request.method, request.url.toString());

    nodeRequest.on("error", function (error) {
      console.log("error on", request.url.toString(), error);
    });

    return Promise.resolve().then(function () {
      return handler(request);
    }).then(function (responseProperties) {
      var response = createResponse(request, responseProperties);
      return transform(response);
    })["catch"](function (error) {
      return createResponse(request, {
        status: 500,
        reason: "internal error",
        body: error && error.stack ? error.stack : error
      });
    }).then(function (finalResponse) {
      console.log(finalResponse.status + " " + request.url);
      // ensure body is closed when client is closed
      closed.listen(function () {
        finalResponse.body.close();
      });
      populateNodeResponse(nodeResponse, finalResponse);
    });
  };
};

var enableCORS = exports.enableCORS = function enableCORS(response) {
  var corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"].join(", "),
    "access-control-allow-headers": ["x-requested-with", "content-type", "accept"].join(", "),
    "access-control-max-age": 1 // Seconds
  };

  var headersWithCORS = (0, _createHeaders.createHeaders)(response.headers);
  Object.keys(corsHeaders).forEach(function (corsHeaderName) {
    if (response.headers.has(corsHeaderName) === false) {
      // we should merge any existing response cors headers with the one above
      headersWithCORS.append(corsHeaderName, corsHeaders[corsHeaderName]);
    }
  });

  return _extends({}, response, {
    headers: headersWithCORS
  });
};
//# sourceMappingURL=createNodeRequestHandler.js.map
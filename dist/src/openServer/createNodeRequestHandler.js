"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enableCORS = exports.createNodeRequestHandler = exports.populateNodeResponse = exports.createRequestFromNodeRequest = void 0;

var _url = require("url");

var _createBody = require("./createBody.js");

var _createHeaders = require("./createHeaders.js");

var _signal = require("@dmail/signal");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// serverURL pourrait valoir par défaut `file:///${process.cwd()}` ?
const createRequestFromNodeRequest = (nodeRequest, serverURL) => {
  const {
    method
  } = nodeRequest;
  const url = new _url.URL(nodeRequest.url, serverURL);
  const headers = (0, _createHeaders.createHeaders)(nodeRequest.headers);
  const body = (0, _createBody.createBody)(method === "POST" || method === "PUT" || method === "PATCH" ? nodeRequest : undefined);
  return Object.freeze({
    method,
    url,
    headers,
    body
  });
};

exports.createRequestFromNodeRequest = createRequestFromNodeRequest;

const populateNodeResponse = (nodeResponse, {
  status,
  reason = "",
  headers,
  body
}) => {
  const headerAsJSON = headers.toJSON();
  nodeResponse.writeHead(status, reason, headerAsJSON);
  body.pipeTo(nodeResponse);

  if (headers.get("connection") !== "keep-alive") {
    body.close();
  }
};

exports.populateNodeResponse = populateNodeResponse;

const createResponse = ({
  method
}, {
  status = 501,
  reason,
  headers = (0, _createHeaders.createHeaders)(),
  body = (0, _createBody.createBody)()
} = {}) => {
  if (method === "HEAD") {
    // don't send body for HEAD requests
    body = (0, _createBody.createBody)();
  } else {
    body = (0, _createBody.createBody)(body);
  }

  headers = (0, _createHeaders.createHeaders)(headers);
  return Object.freeze({
    status,
    reason,
    headers,
    body
  });
};

const createNodeRequestHandler = ({
  handler,
  transform = response => response,
  url
}) => {
  return (nodeRequest, nodeResponse) => {
    const closed = (0, _signal.createSignal)({
      smart: true
    });
    nodeResponse.once("close", () => closed.emit()); // should have some kind of id for a request
    // so that logs knows whichs request they belong to

    const request = createRequestFromNodeRequest(nodeRequest, url);
    console.log(request.method, request.url.toString());
    nodeRequest.on("error", error => {
      console.log("error on", request.url.toString(), error);
    });
    return Promise.resolve().then(() => {
      return handler(request);
    }).then(responseProperties => {
      const response = createResponse(request, responseProperties);
      return transform(response);
    }).catch(error => {
      return createResponse(request, {
        status: 500,
        reason: "internal error",
        body: error && error.stack ? error.stack : error
      });
    }).then(finalResponse => {
      console.log(`${finalResponse.status} ${request.url}`); // ensure body is closed when client is closed

      closed.listen(() => {
        finalResponse.body.close();
      });
      populateNodeResponse(nodeResponse, finalResponse);
    });
  };
};

exports.createNodeRequestHandler = createNodeRequestHandler;

const enableCORS = response => {
  const corsHeaders = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"].join(", "),
    "access-control-allow-headers": ["x-requested-with", "content-type", "accept"].join(", "),
    "access-control-max-age": 1 // Seconds

  };
  const headersWithCORS = (0, _createHeaders.createHeaders)(response.headers);
  Object.keys(corsHeaders).forEach(corsHeaderName => {
    if (response.headers.has(corsHeaderName) === false) {
      // we should merge any existing response cors headers with the one above
      headersWithCORS.append(corsHeaderName, corsHeaders[corsHeaderName]);
    }
  });
  return _objectSpread({}, response, {
    headers: headersWithCORS
  });
};

exports.enableCORS = enableCORS;
//# sourceMappingURL=createNodeRequestHandler.js.map
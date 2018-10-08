"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.enableCORS = exports.createNodeRequestHandler = exports.populateNodeResponse = exports.createRequestFromNodeRequest = void 0;

var _url = require("url");

var _index = require("./createConnection/index.js");

var _headers = require("./headers.js");

var _signal = require("@dmail/signal");

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

// serverURL pourrait valoir par défaut `file:///${process.cwd()}` ?
const createRequestFromNodeRequest = (nodeRequest, serverURL) => {
  const {
    method
  } = nodeRequest;
  const url = new _url.URL(nodeRequest.url, serverURL);
  const headers = (0, _headers.headersFromString)(nodeRequest.headers);
  const body = (0, _index.createBody)(method === "POST" || method === "PUT" || method === "PATCH" ? nodeRequest : undefined);
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
  nodeResponse.writeHead(status, reason, headers);
  (0, _index.pipe)(body, nodeResponse);
};

exports.populateNodeResponse = populateNodeResponse;

const createResponse = ({
  method
}, // this is the request method
{
  status = 501,
  reason,
  headers = {},
  body = (0, _index.createBody)()
} = {}) => {
  if (method === "HEAD") {
    // don't send body for HEAD requests
    body = (0, _index.createBody)();
  }

  if (body) {
    body = (0, _index.createBody)(body);
  }

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
  return _objectSpread({}, response, {
    headers: _objectSpread({}, corsHeaders, response.headers)
  });
};

exports.enableCORS = enableCORS;
//# sourceMappingURL=createNodeRequestHandler.js.map
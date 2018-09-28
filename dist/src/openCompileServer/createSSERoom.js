"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createSSERoom = void 0;

var _createBody = require("../openServer/createBody.js");

function _toConsumableArray(arr) { return _arrayWithoutHoles(arr) || _iterableToArray(arr) || _nonIterableSpread(); }

function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance"); }

function _iterableToArray(iter) { if (Symbol.iterator in Object(iter) || Object.prototype.toString.call(iter) === "[object Arguments]") return Array.from(iter); }

function _arrayWithoutHoles(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = new Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } }

// https://github.com/dmail-old/project/commit/da7d2c88fc8273850812972885d030a22f9d7448
// https://github.com/dmail-old/project/commit/98b3ae6748d461ac4bd9c48944a551b1128f4459
// https://github.com/dmail-old/http-eventsource/blob/master/lib/event-source.js
// http://html5doctor.com/server-sent-events/
var stringifySourceEvent = function stringifySourceEvent(_ref) {
  var data = _ref.data,
      _ref$type = _ref.type,
      type = _ref$type === void 0 ? "message" : _ref$type,
      id = _ref.id,
      retry = _ref.retry;
  var string = "";

  if (id !== undefined) {
    string += "id:".concat(id, "\n");
  }

  if (retry) {
    string += "retry:".concat(retry, "\n");
  }

  if (type !== "message") {
    string += "event:".concat(type, "\n");
  }

  string += "data:".concat(data, "\n\n");
  return string;
};

var createEventHistory = function createEventHistory() {
  var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      limit = _ref2.limit;

  var events = [];
  var removedCount = 0;

  var add = function add(data) {
    events.push(data);

    if (events.length >= limit) {
      events.shift();
      removedCount++;
    }
  };

  var since = function since(index) {
    index = parseInt(index);

    if (isNaN(index)) {
      throw new TypeError("history.since() expect a number");
    }

    index -= removedCount;
    return index < 0 ? [] : events.slice(index);
  };

  var reset = function reset() {
    events.length = 0;
    removedCount = 0;
  };

  return {
    add: add,
    since: since,
    reset: reset
  };
}; // https://www.html5rocks.com/en/tutorials/eventsource/basics/


var createSSERoom = function createSSERoom() {
  var _ref3 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
      _ref3$keepaliveDurati = _ref3.keepaliveDuration,
      keepaliveDuration = _ref3$keepaliveDurati === void 0 ? 30000 : _ref3$keepaliveDurati,
      _ref3$retryDuration = _ref3.retryDuration,
      retryDuration = _ref3$retryDuration === void 0 ? 1000 : _ref3$retryDuration,
      _ref3$historyLength = _ref3.historyLength,
      historyLength = _ref3$historyLength === void 0 ? 1000 : _ref3$historyLength,
      _ref3$maxLength = _ref3.maxLength,
      maxLength = _ref3$maxLength === void 0 ? 100 : _ref3$maxLength;

  var connections = new Set();
  var history = createEventHistory(historyLength);
  var lastEventId = 0;
  var state = "closed";
  var interval;

  var connect = function connect(lastEventId) {
    if (connections.size > maxLength) {
      return {
        status: 503
      };
    }

    if (state === "closed") {
      return {
        status: 204
      };
    }

    var joinEvent = {
      id: lastEventId,
      retry: retryDuration,
      type: "join",
      data: new Date().toLocaleTimeString()
    };
    lastEventId++;
    history.add(joinEvent);
    var events = [joinEvent].concat(_toConsumableArray(lastEventId === undefined ? [] : history.since(lastEventId)));
    var connection = (0, _createBody.createBody)();
    connections.add(connection);
    connection.closed.listen(function () {
      console.log("client disconnected, number of client connected to event source: ".concat(connections.size));
      connections.delete(connection);
    });
    console.log("client joined, number of client connected to event source: ".concat(connections.size, ", max allowed: ").concat(maxLength));
    events.forEach(function (event) {
      console.log("send ".concat(event.type, " event to this new client"));
      connection.write(stringifySourceEvent(event));
    });
    return {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive"
      },
      body: connection
    };
  };

  var write = function write(data) {
    connections.forEach(function (connection) {
      connection.write(data);
    });
  };

  var sendEvent = function sendEvent(event) {
    if (event.type !== "comment") {
      console.log("send ".concat(event.type, " event, number of client listening event source: ").concat(connections.size));
      event.id = lastEventId;
      lastEventId++;
      history.add(event);
    }

    write(stringifySourceEvent(event));
  };

  var keepAlive = function keepAlive() {
    // maybe that, when an event occurs, we can delay the keep alive event
    console.log("send keep alive event, number of client listening event source: ".concat(connections.size));
    sendEvent({
      type: "comment",
      data: new Date().toLocaleTimeString()
    });
  };

  var open = function open() {
    interval = setInterval(keepAlive, keepaliveDuration);
    state = "opened";
  };

  var close = function close() {
    // it should close every connection no?
    clearInterval(interval);
    history.reset();
    state = "closed";
  };

  return {
    open: open,
    close: close,
    connect: connect,
    sendEvent: sendEvent
  };
};

exports.createSSERoom = createSSERoom;
//# sourceMappingURL=createSSERoom.js.map
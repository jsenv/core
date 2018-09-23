"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createBody = undefined;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _stream = require("stream");

var _stream2 = _interopRequireDefault(_stream);

var _promise = require("../promise.js");

var _signal = require("@dmail/signal");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { "default": obj }; }

var isNodeStream = function isNodeStream(a) {
  if (a instanceof _stream2["default"].Stream || a instanceof _stream2["default"].Writable) {
    return true;
  }
  return false;
};

var closeStream = function closeStream(stream) {
  if (isNodeStream(stream)) {
    stream.end();
  } else {
    stream.close();
  }
};

var createTwoWayStream = function createTwoWayStream() {
  var buffers = [];
  var length = 0;
  var status = "opened";

  var _createPromiseAndHook = (0, _promise.createPromiseAndHooks)(),
      promise = _createPromiseAndHook.promise,
      resolve = _createPromiseAndHook.resolve;

  var errored = (0, _signal.createSignal)({ smart: true });
  var cancelled = (0, _signal.createSignal)({ smart: true });
  var closed = (0, _signal.createSignal)({ smart: true });
  var writed = (0, _signal.createSignal)();

  var error = function error(e) {
    status = "errored";
    errored.emit(e);
    throw e;
  };

  var cancel = function cancel() {
    if (status === "cancelled") {
      return;
    }
    status = "cancelled";
    buffers.length = 0;
    length = 0;
    cancelled.emit();
  };

  var close = function close() {
    if (status === "closed") {
      return;
    }
    status = "closed";
    resolve(buffers);
    closed.emit();
  };

  var write = function write(data) {
    buffers.push(data);
    length += data.length;
    writed.emit(data);
  };

  var pipeTo = function pipeTo(stream) {
    var _ref = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {},
        _ref$propagateData = _ref.propagateData,
        propagateData = _ref$propagateData === undefined ? true : _ref$propagateData,
        _ref$propagateCancel = _ref.propagateCancel,
        propagateCancel = _ref$propagateCancel === undefined ? true : _ref$propagateCancel,
        _ref$propagateClose = _ref.propagateClose,
        propagateClose = _ref$propagateClose === undefined ? true : _ref$propagateClose,
        _ref$propagateError = _ref.propagateError,
        propagateError = _ref$propagateError === undefined ? true : _ref$propagateError;

    if (propagateCancel) {
      cancelled.listenOnce(function () {
        stream.cancel();
      });
    }
    if (propagateError) {
      errored.listenOnce(function (error) {
        stream.error(error);
      });
    }
    if (propagateData) {
      if (length) {
        buffers.forEach(function (buffer) {
          stream.write(buffer);
        });
      }
      writed.listen(function (buffer) {
        stream.write(buffer);
      });
    }
    if (propagateClose) {
      closed.listenOnce(function () {
        closeStream(stream);
      });
    }

    return stream;
  };

  return Object.freeze({
    error: error,
    errored: errored,
    cancel: cancel,
    cancelled: cancelled,
    close: close,
    closed: closed,
    write: write,
    writed: writed,
    pipeTo: pipeTo,
    promise: promise
  });
};

var stringToArrayBuffer = function stringToArrayBuffer(string) {
  string = String(string);
  var buffer = new ArrayBuffer(string.length * 2); // 2 bytes for each char
  var bufferView = new Uint16Array(buffer);
  var i = 0;
  while (i < string.length) {
    bufferView[i] = string.charCodeAt(i);
    i++;
  }
  return buffer;
};

var createBody = exports.createBody = function createBody(body) {
  var twoWayStream = createTwoWayStream();

  var fill = function fill(data) {
    if (isNodeStream(data)) {
      var nodeStream = data;

      // nodeStream.resume() ?
      nodeStream.once("error", function (error) {
        twoWayStream.error(error);
      });
      nodeStream.on("data", function (data) {
        twoWayStream.write(data);
      });
      nodeStream.once("end", function () {
        twoWayStream.close();
      });
    } else if (data && data.pipeTo) {
      data.pipeTo(twoWayStream);
    } else {
      twoWayStream.write(data);
      twoWayStream.close();
    }
  };

  if (body !== undefined) {
    fill(body);
  }

  var readAsString = function readAsString() {
    return twoWayStream.promise.then(function (buffers) {
      return buffers.join("");
    });
  };

  var text = function text() {
    return readAsString();
  };

  var arraybuffer = function arraybuffer() {
    return text().then(stringToArrayBuffer);
  };

  var json = function json() {
    return text().then(JSON.parse);
  };

  return _extends({}, twoWayStream, {
    text: text,
    arraybuffer: arraybuffer,
    json: json
  });
};
//# sourceMappingURL=createBody.js.map
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createBody = void 0;

var _stream = _interopRequireDefault(require("stream"));

var _promise = require("../promise.js");

var _signal = require("@dmail/signal");

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; var ownKeys = Object.keys(source); if (typeof Object.getOwnPropertySymbols === 'function') { ownKeys = ownKeys.concat(Object.getOwnPropertySymbols(source).filter(function (sym) { return Object.getOwnPropertyDescriptor(source, sym).enumerable; })); } ownKeys.forEach(function (key) { _defineProperty(target, key, source[key]); }); } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

const isNodeStream = a => {
  if (a === undefined) return false;

  if (a instanceof _stream.default.Stream || a instanceof _stream.default.Writable) {
    return true;
  }

  return false;
};

const closeStream = stream => {
  if (isNodeStream(stream)) {
    stream.end();
  } else {
    stream.close();
  }
};

const createTwoWayStream = ({
  willAutoClose = false
} = {}) => {
  const buffers = [];
  let length = 0;
  let status = "opened";
  const {
    promise,
    resolve
  } = (0, _promise.createPromiseAndHooks)();
  const errored = (0, _signal.createSignal)({
    smart: true
  });
  const cancelled = (0, _signal.createSignal)({
    smart: true
  });
  const closed = (0, _signal.createSignal)({
    smart: true
  });
  const writed = (0, _signal.createSignal)();

  const error = e => {
    status = "errored";
    errored.emit(e);
    throw e;
  };

  const cancel = () => {
    if (status === "cancelled") {
      return;
    }

    status = "cancelled";
    buffers.length = 0;
    length = 0;
    cancelled.emit();
  };

  const close = () => {
    if (status === "closed") {
      return;
    }

    status = "closed";
    resolve(buffers);
    closed.emit();
  };

  const write = data => {
    // if (status === "closed") {
    //   return
    // }
    // console.log("writing", data.toString())
    buffers.push(data);
    length += data.length;
    writed.emit(data);
  };

  const pipeTo = (stream, {
    propagateData = true,
    propagateCancel = true,
    propagateClose = true,
    propagateError = true
  } = {}) => {
    if (propagateCancel) {
      cancelled.listenOnce(() => {
        stream.cancel();
      });
    }

    if (propagateError) {
      errored.listenOnce(error => {
        stream.error(error);
      });
    }

    if (propagateData) {
      if (length) {
        buffers.forEach(buffer => {
          stream.write(buffer);
        });
      }

      const writeListener = writed.listen(buffer => {
        stream.write(buffer);
      }); // closed.listenOnce(() => {
      //   writeListener.remove()
      // })
    }

    if (propagateClose) {
      closed.listenOnce(() => {
        closeStream(stream);
      });
    }

    return stream;
  };

  return Object.freeze({
    error,
    errored,
    cancel,
    cancelled,
    close,
    closed,
    write,
    writed,
    pipeTo,
    promise,
    willAutoClose
  });
};

const stringToArrayBuffer = string => {
  string = String(string);
  const buffer = new ArrayBuffer(string.length * 2); // 2 bytes for each char

  const bufferView = new Uint16Array(buffer);
  let i = 0;

  while (i < string.length) {
    bufferView[i] = string.charCodeAt(i);
    i++;
  }

  return buffer;
};

const createBody = data => {
  if (data && data.pipeTo) {
    return data;
  }

  let twoWayStream;

  if (data === undefined) {
    twoWayStream = createTwoWayStream();
  } else if (isNodeStream(data)) {
    twoWayStream = createTwoWayStream({
      willAutoClose: true
    });
    const nodeStream = data; // nodeStream.resume() ?

    nodeStream.once("error", error => {
      twoWayStream.error(error);
    });
    nodeStream.on("data", data => {
      twoWayStream.write(data);
    });
    nodeStream.once("end", () => {
      twoWayStream.close();
    });
  } else if (data && data.pipeTo) {
    twoWayStream = createTwoWayStream({
      willAutoClose: data.willAutoClose
    });
    data.pipeTo(twoWayStream);
  } else if (data !== undefined) {
    twoWayStream = createTwoWayStream();
    twoWayStream.write(data);
  }

  const readAsString = () => {
    return twoWayStream.promise.then(buffers => buffers.join(""));
  };

  const text = () => {
    return readAsString();
  };

  const arraybuffer = () => {
    return text().then(stringToArrayBuffer);
  };

  const json = () => {
    return text().then(JSON.parse);
  };

  return _objectSpread({}, twoWayStream, {
    text,
    arraybuffer,
    json
  });
};

exports.createBody = createBody;
//# sourceMappingURL=createBody.js.map
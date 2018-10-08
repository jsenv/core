"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.pipe = void 0;

var _createTwoWayStream = require("./createTwoWayStream.js");

var _isNodeStream = require("./isNodeStream.js");

const listenError = (dataSource, cb) => {
  if ((0, _createTwoWayStream.isTwoWayStream)(dataSource)) {
    const listener = dataSource.errored.listenOnce(cb);
    return () => {
      listener.remove();
    };
  }

  if ((0, _isNodeStream.isNodeStream)(dataSource)) {
    dataSource.once("error", cb);
    return () => {
      dataSource.removeListener("error", cb);
    };
  } // other source cannot trigger error


  return () => {};
};

const listenCancel = (dataSource, cb) => {
  if ((0, _createTwoWayStream.isTwoWayStream)(dataSource)) {
    const listener = dataSource.cancelled.listenOnce(cb);
    return () => {
      listener.remove();
    };
  }

  if ((0, _isNodeStream.isNodeStream)(dataSource)) {
    // there is no cancel mecanis on node stream
    return () => {};
  } // there is no cancel mecanism otherwise


  return () => {};
};

const listenData = (dataSource, cb) => {
  if ((0, _createTwoWayStream.isTwoWayStream)(dataSource)) {
    const listener = dataSource.writed.listen(cb);
    return () => {
      listener.remove();
    };
  }

  if ((0, _isNodeStream.isNodeStream)(dataSource)) {
    dataSource.on("data", cb);
    return () => {
      dataSource.removeListener("data", cb);
    };
  }

  cb(dataSource);
  return () => {};
};

const listenClose = (dataSource, cb) => {
  if ((0, _createTwoWayStream.isTwoWayStream)(dataSource)) {
    const listener = dataSource.closed.listenOnce(cb);
    return () => {
      listener.remove();
    };
  }

  if ((0, _isNodeStream.isNodeStream)(dataSource)) {
    dataSource.once("end", cb);
    return () => {
      dataSource.removeListener("end", cb);
    };
  }

  cb();
  return () => {};
};

const callError = (stream, value) => {
  if ((0, _createTwoWayStream.isTwoWayStream)(stream)) {
    return stream.error(value);
  }

  if ((0, _isNodeStream.isNodeStream)(stream)) {
    return stream.error(value);
  }

  return undefined;
};

const callClose = stream => {
  if ((0, _createTwoWayStream.isTwoWayStream)(stream)) {
    return stream.close();
  }

  if ((0, _isNodeStream.isNodeStream)(stream)) {
    return stream.end();
  }

  return undefined;
};

const callCancel = stream => {
  if ((0, _createTwoWayStream.isTwoWayStream)(stream)) {
    return stream.cancel();
  }

  if ((0, _isNodeStream.isNodeStream)(stream)) {
    // node stream have no cancel mecanism
    return undefined;
  }

  return undefined;
};

const callWrite = (stream, data) => {
  if ((0, _createTwoWayStream.isTwoWayStream)(stream)) {
    return stream.write(data);
  }

  if ((0, _isNodeStream.isNodeStream)(stream)) {
    return stream.write(data);
  }

  return undefined;
};

const pipe = (streamA, streamB, {
  pipeData = true,
  pipeCancel = true,
  pipeClose = true,
  pipeError = true
} = {}) => {
  // streamB.resume() when it is a nodejs stream ?
  if (pipeCancel) {
    listenCancel(streamA, () => {
      callCancel(streamB);
    });
  }

  if (pipeError) {
    listenError(streamA, () => {
      callError(streamB);
    });
  }

  if (pipeData) {
    // if streamA is already closed or errored or cancelled
    // we should not attach this listener ?
    const removeDataListener = listenData(streamA, data => {
      callWrite(streamB, data);
    });
    listenError(streamA, removeDataListener);
  }

  if (pipeClose) {
    listenClose(streamA, () => {
      callClose(streamB);
    });
  }
};

exports.pipe = pipe;
//# sourceMappingURL=pipe.js.map
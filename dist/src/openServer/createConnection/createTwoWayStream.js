"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.createTwoWayStream = exports.isTwoWayStream = void 0;

var _promise = require("../../promise.js");

var _signal = require("@dmail/signal");

const twoWayStreamSymbol = Symbol.for("twoWayStream");

const isTwoWayStream = a => {
  return a && typeof a === "object" && twoWayStreamSymbol in a;
};

exports.isTwoWayStream = isTwoWayStream;

const createTwoWayStream = () => {
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
  const writed = (0, _signal.createSignal)({
    smart: true
  });

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
    writed.smartMemory.length = 0;
    length = 0;
    cancelled.emit();
  };

  const close = () => {
    if (status === "closed") {
      return;
    }

    status = "closed";
    resolve(writed.smartMemory.map(([buffer]) => buffer));
    closed.emit();
  };

  const write = data => {
    if (status === "closed") {
      throw new Error("write after end");
    }

    if (data) {
      length += data.length;
      writed.emit(data);
    }
  };

  const getLength = () => length;

  return Object.freeze({
    [twoWayStreamSymbol]: true,
    error,
    errored,
    cancel,
    cancelled,
    close,
    closed,
    write,
    writed,
    getLength,
    promise
  });
};

exports.createTwoWayStream = createTwoWayStream;
//# sourceMappingURL=createTwoWayStream.js.map
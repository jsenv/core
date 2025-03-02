import { Readable, Stream, Writable } from "node:stream";
import { isObservable } from "./observable.js";

export const getObservableValueType = (value) => {
  if (value && typeof value.then === "function") {
    return "promise";
  }

  if (isObservable(value)) {
    return "observable";
  }

  if (isFileHandle(value)) {
    return "file_handle";
  }

  if (isNodeStream(value)) {
    return "node_stream";
  }

  if (value instanceof ReadableStream) {
    return "node_web_stream";
  }

  return "js_value";
};

export const isFileHandle = (value) => {
  return value && value.constructor && value.constructor.name === "FileHandle";
};

const isNodeStream = (value) => {
  if (value === undefined) {
    return false;
  }

  if (
    value instanceof Stream ||
    value instanceof Writable ||
    value instanceof Readable
  ) {
    return true;
  }

  return false;
};

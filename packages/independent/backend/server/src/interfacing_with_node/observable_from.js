import { getObservableValueType } from "./get_observable_value_type.js";
import { createObservable } from "./observable.js";
import { observableFromFileHandle } from "./observable_from_file_handle.js";
import { observableFromNodeStream } from "./observable_from_node_stream.js";
import { observableFromNodeWebReadableStream } from "./observable_from_node_web_readable_stream.js";
import { observableFromPromise } from "./observable_from_promise.js";

export const observableFromValue = (value) => {
  const observableValueType = getObservableValueType(value);
  if (observableValueType === "observable") {
    return value;
  }
  if (observableValueType === "promise") {
    return observableFromPromise(value);
  }
  if (observableValueType === "file_handle") {
    return observableFromFileHandle(value);
  }
  if (observableValueType === "node_stream") {
    return observableFromNodeStream(value);
  }
  if (observableValueType === "node_web_stream") {
    return observableFromNodeWebReadableStream(value);
  }
  return createObservable(({ next, complete, addTeardown }) => {
    next(value);
    const timer = setTimeout(() => {
      complete();
    });
    addTeardown(() => {
      clearTimeout(timer);
    });
  });
};

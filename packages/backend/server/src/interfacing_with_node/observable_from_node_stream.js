// https://github.com/jamestalmage/stream-to-observable/blob/master/index.js
import { createObservable } from "./observable.js";

export const observableFromNodeStream = (nodeStream) => {
  return createObservable(({ next, error, complete, addTeardown }) => {
    const errorEventCallback = (e) => {
      error(e);
    };
    const dataEventCallback = (data) => {
      next(data);
    };
    const closeEventCallback = () => {
      complete();
    };
    const endEventCallback = () => {
      complete();
    };
    nodeStream.once("error", errorEventCallback);
    nodeStream.on("data", dataEventCallback);
    nodeStream.once("end", endEventCallback);
    nodeStream.once("close", closeEventCallback); // not sure it's required
    addTeardown(() => {
      nodeStream.removeListener("error", errorEventCallback);
      nodeStream.removeListener("data", dataEventCallback);
      nodeStream.removeListener("end", endEventCallback);
      nodeStream.removeListener("close", closeEventCallback); // not sure it's required
    });
    if (nodeStream.isPaused()) {
      nodeStream.resume();
    } else if (nodeStream.complete) {
      complete();
    }
  });
};

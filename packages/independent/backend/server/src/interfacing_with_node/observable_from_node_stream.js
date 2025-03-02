// https://github.com/jamestalmage/stream-to-observable/blob/master/index.js
import { Readable } from "node:stream";
import { createObservable } from "./observable.js";

export const observableFromNodeStream = (
  nodeStream,
  { readableLifeTime } = {},
) => {
  const observable = createObservable(
    ({ next, error, complete, addTeardown }) => {
      if (nodeStream.complete) {
        complete();
        return;
      }
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
      }
    },
  );

  if (readableLifeTime && nodeStream instanceof Readable) {
    // safe measure, ensure the readable stream gets
    // used in the next ${readableStreamLifetimeInSeconds} otherwise destroys it
    const timeout = setTimeout(() => {
      process.emitWarning(
        `Readable stream not used after ${
          readableLifeTime / 1000
        } seconds. It will be destroyed to release resources`,
        {
          CODE: "READABLE_STREAM_TIMEOUT",
          // url is for http client request
          detail: `path: ${nodeStream.path}, fd: ${nodeStream.fd}, url: ${nodeStream.url}`,
        },
      );
      nodeStream.destroy();
    }, readableLifeTime);
    onceReadableStreamUsedOrClosed(nodeStream, () => {
      clearTimeout(timeout);
    });
  }

  return observable;
};

const onceReadableStreamUsedOrClosed = (readableStream, callback) => {
  const dataOrCloseCallback = () => {
    readableStream.removeListener("data", dataOrCloseCallback);
    readableStream.removeListener("close", dataOrCloseCallback);
    callback();
  };
  readableStream.on("data", dataOrCloseCallback);
  readableStream.once("close", dataOrCloseCallback);
};

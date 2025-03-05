// https://github.com/jamestalmage/stream-to-observable/blob/master/index.js
import { Readable } from "node:stream";
import { createObservable } from "./observable.js";

export const observableFromNodeStream = (
  nodeStream,
  { readableLifetime } = {},
) => {
  const observable = createObservable(
    ({ next, error, complete, addTeardown }) => {
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
    },
  );

  if (readableLifetime && nodeStream instanceof Readable) {
    // safe measure, ensure the readable stream gets
    // used in the next ${readableStreamLifetimeInSeconds} otherwise destroys it
    const timeout = setTimeout(() => {
      process.emitWarning(
        `Readable stream not used after ${
          readableLifetime / 1000
        } seconds. It will be destroyed to release resources`,
        {
          CODE: "READABLE_STREAM_TIMEOUT",
          // url is for http client request
          detail: `path: ${nodeStream.path}, fd: ${nodeStream.fd}, url: ${nodeStream.url}`,
        },
      );
      nodeStream.destroy();
    }, readableLifetime).unref();
    onceReadableStreamUsedOrClosed(nodeStream, () => {
      clearTimeout(timeout);
    });
    observable.timeout = timeout;
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

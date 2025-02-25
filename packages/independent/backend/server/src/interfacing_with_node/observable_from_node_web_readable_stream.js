// https://github.com/jamestalmage/stream-to-observable/blob/master/index.js

import { createObservable } from "./observable.js";

export const observableFromNodeWebReadableStream = (nodeWebReadableStream) => {
  const observable = createObservable(({ next, error, complete }) => {
    const reader = nodeWebReadableStream.getReader();

    const readNext = async () => {
      try {
        const { done, value } = await reader.read();
        if (done) {
          complete();
          return;
        }
        next(value);
        readNext();
      } catch (e) {
        error(e);
      }
    };
    readNext();
    return () => {
      // reader.releaseLock();
      reader.cancel();
    };
  });

  return observable;
};

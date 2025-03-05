import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { createObservable } from "./interfacing_with_node/observable.js";

export class ProgressiveResponse {
  constructor(responseBodyHandler, { status, statusText, headers } = {}) {
    const contentType = headers ? headers["content-type"] : "text/plain";
    const progressiveResponse = {
      status,
      statusText,
      headers,
      body: createObservable(({ next, complete, addTeardown }) => {
        // we must write something for fetch promise to resolve
        // this is conform to HTTP spec where client expect body to starts writing
        // before resolving response promise client side
        if (CONTENT_TYPE.isTextual(contentType)) {
          next("");
        } else {
          next(new Uint8Array());
        }
        const returnValue = responseBodyHandler({
          write: (data) => {
            next(data);
          },
          end: () => {
            complete();
          },
        });
        if (typeof returnValue === "function") {
          addTeardown(() => {
            returnValue();
          });
        }
      }),
    };
    // eslint-disable-next-line no-constructor-return
    return progressiveResponse;
  }
}

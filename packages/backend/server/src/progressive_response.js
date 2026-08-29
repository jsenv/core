import { CONTENT_TYPE } from "@jsenv/utils/src/content_type/content_type.js";
import { createObservable } from "./interfacing_with_node/observable.js";

/**
 * A response whose body is written over time (long polling, progress
 * reporting). Return it from a route `fetch`: the headers are sent right away
 * and the handler writes the body chunks whenever it wants.
 *
 * @param {(body: { write: (chunk: string|Uint8Array) => void, end: () => void }) => void | (() => void)} responseBodyHandler
 *   Receives `write` and `end`. If it returns a function, that function runs
 *   when the client disconnects before `end` was called (cleanup).
 * @param {Object} [init]
 * @param {number} [init.status=200]
 * @param {string} [init.statusText]
 * @param {Object} [init.headers] - `content-type` decides whether the first
 *   (empty) chunk is text or binary; defaults to text/plain.
 *
 * @example
 * {
 *   endpoint: "GET /progress",
 *   fetch: () => new ProgressiveResponse(({ write, end }) => {
 *     const interval = setInterval(() => write("."), 100);
 *     setTimeout(() => { clearInterval(interval); end(); }, 1000);
 *     return () => clearInterval(interval);
 *   }),
 * }
 */
export class ProgressiveResponse {
  constructor(responseBodyHandler, { status = 200, statusText, headers } = {}) {
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

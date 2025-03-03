import { assert } from "@jsenv/assert";
import { createObservableBody, startServer } from "@jsenv/server";

let _write;
let _close;
const apiServer = await startServer({
  logLevel: "warn",
  routes: [
    {
      endpoint: "GET /",
      response: () => {
        return {
          status: 200,
          headers: {
            "content-type": "text/plain",
          },
          body: createObservableBody({
            opened: ({ write, close }) => {
              // we must write something for fetch promise to resolve
              // this is conform to HTTP spec where client expect body to starts writing
              // before resolving response promise client side
              write("");
              _write = write;
              _close = close;
            },
          }),
        };
      },
    },
  ],
  keepProcessAlive: false,
});
const response = await fetch(`${apiServer.origin}/`, {
  method: "GET",
});
const reader = response.body.getReader();

const firstReadPromise = reader.read();
_write("a");
const firstRead = await firstReadPromise;

const secondReadPromise = reader.read();
_write("b");
const secondRead = await secondReadPromise;

_close();
const thirdReadPromise = reader.read();
const thirdRead = await thirdReadPromise;

const decoder = new TextDecoder("utf-8");
const firstReadValue = decoder.decode(firstRead.value);
const secondReadValue = decoder.decode(secondRead.value);
const actual = {
  status: response.status,
  headers: Object.fromEntries(response.headers),
  firstReadValue,
  secondReadValue,
  thirdReadValue: thirdRead.value,
};
const expect = {
  status: 200,
  headers: {
    "connection": "keep-alive",
    "content-type": "text/plain",
    "date": assert.any(String),
    "keep-alive": "timeout=5",
    "transfer-encoding": "chunked",
  },
  firstReadValue: "a",
  secondReadValue: "b",
  thirdReadValue: undefined, // means body is closed
};
assert({ actual, expect });

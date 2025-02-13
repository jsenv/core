import { assert } from "@jsenv/assert";

import { Abort } from "@jsenv/abort";
import { requestServer, startServer } from "./test_helpers.mjs";

const abortController = new AbortController();

try {
  const { server, port } = await startServer();
  server.unref();
  const responsePromise = requestServer({
    signal: abortController.signal,
    port,
  });

  // setTimeout allow to trigger socket hangup error
  setTimeout(() => {
    abortController.abort();
  }, 2);

  await responsePromise;
  throw new Error("should abort");
} catch (error) {
  const actual = Abort.isAbortError(error);
  const expect = true;
  assert({ actual, expect });
}

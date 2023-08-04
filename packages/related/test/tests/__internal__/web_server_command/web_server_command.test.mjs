/*

TODO

- We want to test that the command works when correctly set
- We want to test that if the command does not start a server we get 
an error after a timeout
- We want to test if the command does not exists we get an error

TODO:

- Create an other test for dynamic import

*/

import { fileURLToPath } from "node:url";
import { assert } from "@jsenv/assert";
import { ensureWebServerIsStarted } from "@jsenv/test/src/execution/web_server_param.js";
import { createTeardown } from "@jsenv/test/src/helpers/teardown.js";
import { pingServer } from "@jsenv/test/src/helpers/ping_server.js";

// the command starts a server
{
  const teardown = createTeardown();
  const webServer = {
    origin: "http://localhost:5810",
    command: `node ${fileURLToPath(
      new URL("./start_server.mjs", import.meta.url),
    )}`,
  };
  await ensureWebServerIsStarted(webServer, {
    signal: new AbortController().signal,
    logger: { debug: () => {}, info: () => {} },
    teardown,
  });
  const serverUp = await pingServer(webServer.origin);
  await teardown.trigger();
  const serverUpAfterTeardown = await pingServer(webServer.origin);
  const actual = {
    serverUp,
    serverUpAfterTeardown,
  };
  const expected = {
    serverUp: true,
    serverUpAfterTeardown: false,
  };
  assert({ actual, expected });
}

// the command does not start a server (or not fast enough)
{
  const webServer = {
    origin: "http://localhost:5811",
    command: `node ${fileURLToPath(
      new URL("./do_nothing.mjs", import.meta.url),
    )}`,
  };
  try {
    const teardown = createTeardown();
    await ensureWebServerIsStarted(webServer, {
      signal: new AbortController().signal,
      logger: { debug: () => {}, info: () => {} },
      teardown,
      allocatedMs: 500,
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = e;
    const expected = new Error(
      `"${webServer.command}" command did not start a server in less than 500ms (webServer.command)`,
    );
    assert({ actual, expected });
  }
}

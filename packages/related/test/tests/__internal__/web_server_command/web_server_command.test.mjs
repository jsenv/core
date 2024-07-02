import { fileURLToPath } from "node:url";
import { assert } from "@jsenv/assert";
import { ensureWebServerIsStarted } from "@jsenv/test/src/execution/web_server_param.js";
import { pingServer } from "@jsenv/test/src/helpers/ping_server.js";

// the command does not exists
{
  const webServer = {
    origin: "http://localhost:3459",
    command: `abryiryiu`,
  };
  try {
    await ensureWebServerIsStarted(webServer, {
      signal: new AbortController().signal,
      logger: { debug: () => {}, info: () => {} },
      teardownCallbackSet: new Set(),
      allocatedMs: 500,
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = e;
    const expect = new Error(
      `"${webServer.command}" command did not start a server in less than 500ms`,
    );
    assert({ actual, expect });
  }
}

// the command fails
{
  const webServer = {
    origin: "http://localhost:3459",
    command: `node ${fileURLToPath(new URL("./error.mjs", import.meta.url))}`,
  };
  try {
    await ensureWebServerIsStarted(webServer, {
      signal: new AbortController().signal,
      logger: { debug: () => {}, info: () => {} },
      teardownCallbackSet: new Set(),
      allocatedMs: 500,
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = e;
    const expect = new Error(
      `"${webServer.command}" command did not start a server in less than 500ms`,
    );
    assert({ actual, expect });
  }
}

// the command does not start a server (or not fast enough)
{
  const webServer = {
    origin: "http://localhost:3459",
    command: `node ${fileURLToPath(
      new URL("./do_nothing.mjs", import.meta.url),
    )}`,
  };
  try {
    await ensureWebServerIsStarted(webServer, {
      signal: new AbortController().signal,
      logger: { debug: () => {}, info: () => {} },
      teardownCallbackSet: new Set(),
      allocatedMs: 500,
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = e;
    const expect = new Error(
      `"${webServer.command}" command did not start a server in less than 500ms`,
    );
    assert({ actual, expect });
  }
}

// the command starts a server
{
  const teardownCallbackSet = new Set();
  const webServer = {
    origin: "http://localhost:3459",
    command: `node ${fileURLToPath(
      new URL("./start_server.mjs", import.meta.url),
    )}`,
  };
  await ensureWebServerIsStarted(webServer, {
    signal: new AbortController().signal,
    logger: { debug: () => {}, info: () => {} },
    teardownCallbackSet,
  });
  const serverUp = await pingServer(webServer.origin);
  for (const teardownCallback of teardownCallbackSet) {
    await teardownCallback();
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
  const serverUpAfterTeardown = await pingServer(webServer.origin);
  const actual = {
    serverUp,
    serverUpAfterTeardown,
  };
  const expect = {
    serverUp: true,
    serverUpAfterTeardown: false,
  };
  assert({ actual, expect });
}

import { assert } from "@jsenv/assert";
import { ensureWebServerIsStarted } from "@jsenv/test/src/execution/web_server_param.js";
import { createTeardown } from "@jsenv/test/src/helpers/teardown.js";
import { pingServer } from "@jsenv/test/src/helpers/ping_server.js";

// the module does not exists
{
  const webServer = {
    origin: "http://localhost:5811",
    moduleUrl: new URL("./404.mjs", import.meta.url),
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
      `webServer.moduleUrl does not lead to a file at "${webServer.moduleUrl}"`,
    );
    assert({ actual, expected });
  }
}

// the module execution fails
{
  const webServer = {
    origin: "http://localhost:5811",
    moduleUrl: new URL("./error.mjs", import.meta.url),
  };
  try {
    const teardown = createTeardown();
    await ensureWebServerIsStarted(webServer, {
      signal: new AbortController().signal,
      logger: { debug: () => {}, info: () => {} },
      teardown,
    });
    throw new Error("should throw");
  } catch (e) {
    const actual = e.message;
    const expected = `toto`;
    assert({ actual, expected });
  }
}

// the module does not start a server (or not fast enough)
{
  const webServer = {
    origin: "http://localhost:5811",
    moduleUrl: new URL("./do_nothing.mjs", import.meta.url),
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
      `"${webServer.moduleUrl}" did not start a server in less than 500ms (webServer.moduleUrl)`,
    );
    assert({ actual, expected });
  }
}

// the module starts a server
{
  const teardown = createTeardown();
  const webServer = {
    origin: "http://localhost:5810",
    moduleUrl: new URL("./start_server.mjs", import.meta.url),
  };
  await ensureWebServerIsStarted(webServer, {
    signal: new AbortController().signal,
    logger: { debug: () => {}, info: () => {} },
    teardown,
  });
  const serverUp = await pingServer(webServer.origin);
  await teardown.trigger();
  await new Promise((resolve) => setTimeout(resolve, 1_000));
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

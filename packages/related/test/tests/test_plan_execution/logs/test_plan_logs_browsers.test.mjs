import { writeFileSync } from "@jsenv/filesystem";
import { renderTerminalSvg } from "@jsenv/terminal-snapshot";
import { takeFileSnapshot } from "@jsenv/snapshot";
import { UNICODE, ANSI } from "@jsenv/log";
import { startDevServer } from "@jsenv/core";

import { executeTestPlan, chromium, firefox, webkit } from "@jsenv/test";

// force unicode and color support on windows
// to make snapshot predictible on windows (otherwise "✔" would be "√" for instance)
UNICODE.supported = true;
ANSI.supported = true;

const devServer = await startDevServer({
  logLevel: "warn",
  sourceDirectoryUrl: new URL("./client/", import.meta.url),
  keepProcessAlive: false,
  port: 0,
});

const test = async (filename, params) => {
  const terminalSnapshotFileUrl = new URL(
    `./snapshots/browsers/${filename}.svg`,
    import.meta.url,
  );
  const terminalFileSnapshot = takeFileSnapshot(terminalSnapshotFileUrl);
  {
    let stdout = "";
    const { write } = process.stdout;
    process.stdout.write = (...args) => {
      stdout += args;
    };
    await executeTestPlan({
      logs: {
        dynamic: false,
        mockFluctuatingValues: true,
      },
      rootDirectoryUrl: new URL("./client/", import.meta.url),
      testPlan: {
        [filename]: {
          chromium: {
            runtime: chromium(),
          },
          firefox: {
            runtime: firefox(),
          },
          webkit: {
            runtime: webkit(),
          },
        },
      },
      githubCheck: false,
      webServer: {
        origin: devServer.origin,
      },
      ...params,
    });
    process.stdout.write = write;
    writeFileSync(terminalSnapshotFileUrl, await renderTerminalSvg(stdout));
  }
  terminalFileSnapshot.compare();
};

await test("console.spec.html");
await test("empty.spec.html");
await test("error_in_script.spec.html");
await test("error_in_script.spec.html");
await test("error_in_script_module.spec.html");
await test("error_in_js_module.spec.html");
await test("error_in_js_classic.spec.html");
await test("error_jsenv_assert_in_script_module.spec.html");

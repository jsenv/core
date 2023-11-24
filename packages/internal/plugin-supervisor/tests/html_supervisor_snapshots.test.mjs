import { readFileSync } from "node:fs";
import { writeFileSync } from "@jsenv/filesystem";
import { takeDirectorySnapshot, compareSnapshots } from "@jsenv/snapshot";

import { injectSupervisorIntoHTML } from "@jsenv/plugin-supervisor";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
const test = async (fixtureFilename) => {
  const fileUrl = new URL(`./fixtures/${fixtureFilename}`, import.meta.url);
  const fileSnapshotUrl = new URL(
    `./snapshots/${fixtureFilename}`,
    import.meta.url,
  );
  const originalContent = readFileSync(fileUrl, "utf8");
  const { content } = await injectSupervisorIntoHTML(
    {
      content: originalContent,
      url: String(fileUrl),
    },
    {
      supervisorScriptSrc: "mocked_for_test.js",
      supervisorOptions: {},
      webServer: {
        rootDirectoryUrl: new URL("./fixtures/", import.meta.url),
      },
      sourcemaps: "none",
    },
  );

  writeFileSync(fileSnapshotUrl, content);
};

const actualDirectorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
await test("script_inline.html");
await test("script_src.html");
await test("script_type_module_inline.html");
await test("script_type_module_src.html");
const expectedDirectorySnapshot = takeDirectorySnapshot(snapshotsDirectoryUrl);
compareSnapshots(actualDirectorySnapshot, expectedDirectorySnapshot);

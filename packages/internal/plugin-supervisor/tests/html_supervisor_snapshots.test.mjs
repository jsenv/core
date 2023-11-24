import { readFileSync } from "node:fs";
import { writeFileSync } from "@jsenv/filesystem";
import { compareSnapshots, takeDirectorySnapshot } from "@jsenv/snapshot";

import { injectSupervisorIntoHTML } from "@jsenv/plugin-supervisor";

const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);
const test = async (fixtureFilename) => {
  const fileFixtureUrl = new URL(
    `./fixtures/${fixtureFilename}`,
    import.meta.url,
  );
  const { content } = await injectSupervisorIntoHTML(
    {
      content: readFileSync(fileFixtureUrl, "utf8"),
      url: String(fileFixtureUrl),
    },
    {
      supervisorOptions: {},
      webServer: {
        rootDirectoryUrl: new URL("./fixtures/", import.meta.url),
      },
      sourcemaps: "none",
    },
  );
  const fileSnapshotUrl = new URL(
    `./snapshots/${fixtureFilename}`,
    import.meta.url,
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

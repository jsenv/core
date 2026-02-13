import { assert } from "@jsenv/assert";
import {
  ensureEmptyDirectorySync,
  moveEntrySync,
  registerFileLifecycle,
  removeEntrySync,
  writeEntryModificationTimeSync,
  writeFileSync,
} from "@jsenv/filesystem";
import { wait } from "@jsenv/filesystem/tests/testHelpers.js";
import { resolveUrl } from "@jsenv/urls";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
ensureEmptyDirectorySync(tempDirectoryUrl);

// added file exists
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  writeFileSync(fileUrl);
  const mutations = [];
  const unregister = registerFileLifecycle(fileUrl, {
    added: () => {
      mutations.push({ type: "added" });
    },
    updated: (data) => {
      mutations.push({ type: "updated", ...data });
    },
    removed: () => {
      mutations.push({ type: "removed" });
    },
    keepProcessAlive: false,
  });

  const actual = mutations;
  const expect = [];
  assert({ actual, expect });
  unregister();
  ensureEmptyDirectorySync(tempDirectoryUrl);
}

// added, file exstis and notifyExistent
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  writeFileSync(fileUrl);
  const mutations = [];
  const unregister = registerFileLifecycle(fileUrl, {
    added: () => {
      mutations.push({ type: "added" });
    },
    updated: (data) => {
      mutations.push({ type: "updated", ...data });
    },
    removed: () => {
      mutations.push({ type: "removed" });
    },
    keepProcessAlive: false,
    notifyExistent: true,
  });

  const actual = mutations;
  const expect = [{ type: "added" }];
  assert({ actual, expect });
  unregister();
  ensureEmptyDirectorySync(tempDirectoryUrl);
}

// added, removed, added
if (process.env.FLAKY) {
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  const mutations = [];
  const unregister = registerFileLifecycle(fileUrl, {
    added: () => {
      mutations.push({ type: "added" });
    },
    updated: () => {
      mutations.push({ type: "updated" });
    },
    keepProcessAlive: false,
  });
  writeFileSync(fileUrl);
  await wait(200);
  removeEntrySync(fileUrl);
  await wait(200);
  writeFileSync(fileUrl);
  await wait(200);

  const actual = mutations;
  const expect = [{ type: "added" }, { type: "added" }];
  assert({ actual, expect });
  unregister();
  ensureEmptyDirectorySync(tempDirectoryUrl);
}

// added, updated, removed
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  const mutations = [];
  const unregister = registerFileLifecycle(fileUrl, {
    added: () => {
      mutations.push({ type: "added" });
    },
    updated: (data) => {
      mutations.push({ type: "updated", ...data });
    },
    removed: () => {
      mutations.push({ type: "removed" });
    },
    keepProcessAlive: false,
  });
  writeFileSync(fileUrl);
  await wait(200);
  writeEntryModificationTimeSync(fileUrl, Date.now());
  await wait(200);
  removeEntrySync(fileUrl);
  await wait(200);
  const actual = mutations;
  const expect = [{ type: "added" }, { type: "updated" }, { type: "removed" }];
  assert({ actual, expect });
  unregister();
  ensureEmptyDirectorySync(tempDirectoryUrl);
}

// move
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  const destinationUrl = resolveUrl("file-2", tempDirectoryUrl);
  const mutations = [];
  const unregister = registerFileLifecycle(fileUrl, {
    added: () => {
      mutations.push({ type: "added" });
    },
    updated: (data) => {
      mutations.push({ type: "updated", ...data });
    },
    removed: () => {
      mutations.push({ type: "removed" });
    },
    cooldownBetweenFileEvents: 200,
    keepProcessAlive: false,
  });
  writeFileSync(fileUrl);
  await wait(200);
  moveEntrySync({ from: fileUrl, to: destinationUrl });
  await wait(200);
  const actual = mutations;
  const expect = [{ type: "added" }, { type: "removed" }];
  assert({ actual, expect });
  unregister();
  ensureEmptyDirectorySync(tempDirectoryUrl);
}

// removed
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  writeFileSync(fileUrl);
  const mutations = [];
  const unregister = registerFileLifecycle(fileUrl, {
    removed: () => {
      mutations.push({ type: "removed" });
    },
    keepProcessAlive: false,
  });
  await wait(200);
  removeEntrySync(fileUrl);
  await wait(200);
  writeFileSync(fileUrl);
  await wait(200);
  removeEntrySync(fileUrl);
  await wait(200);

  const actual = mutations;
  const expect = [{ type: "removed" }, { type: "removed" }];
  assert({ actual, expect });
  unregister();
  ensureEmptyDirectorySync(tempDirectoryUrl);
}

// updated lot
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  writeFileSync(fileUrl);
  const mutations = [];
  const unregister = registerFileLifecycle(fileUrl, {
    updated: (data) => {
      mutations.push({ type: "updated", ...data });
    },
    removed: () => {
      mutations.push({ type: "removed" });
    },
    keepProcessAlive: false,
  });
  await wait(100);
  writeEntryModificationTimeSync(fileUrl, Date.now());
  await wait(300);
  writeEntryModificationTimeSync(fileUrl, Date.now());
  await wait(300);
  writeEntryModificationTimeSync(fileUrl, Date.now());
  await wait(300);

  const actual = mutations;
  const expect = [
    { type: "updated" },
    { type: "updated" },
    { type: "updated" },
  ];
  assert({ actual, expect });
  unregister();
  ensureEmptyDirectorySync(tempDirectoryUrl);
}

// windows eperm
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  const mutations = [];
  const unregister = registerFileLifecycle(fileUrl, {
    added: () => {},
    updated: (data) => {
      mutations.push({ type: "updated", ...data });
    },
    keepProcessAlive: false,
  });
  removeEntrySync(tempDirectoryUrl);
  await wait(200);

  const actual = mutations;
  const expect = [];
  assert({ actual, expect });
  unregister();
  ensureEmptyDirectorySync(tempDirectoryUrl);
}

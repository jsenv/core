import { assert } from "@jsenv/assert";
import {
  ensureEmptyDirectory,
  moveEntry,
  registerFileLifecycle,
  removeEntry,
  writeEntryModificationTime,
  writeFile,
} from "@jsenv/filesystem";
import { wait } from "@jsenv/filesystem/tests/testHelpers.js";
import { resolveUrl } from "@jsenv/urls";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);

// added file exists
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(fileUrl);
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
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// added, file exstis and notifyExistent
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(fileUrl);
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
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// added, removed, added
{
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
  await writeFile(fileUrl);
  await wait(200);
  await removeEntry(fileUrl);
  await wait(200);
  await writeFile(fileUrl);
  await wait(200);

  const actual = mutations;
  const expect = [{ type: "added" }, { type: "added" }];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
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
  await writeFile(fileUrl);
  await wait(200);
  await writeEntryModificationTime(fileUrl, Date.now());
  await wait(200);
  await removeEntry(fileUrl);
  await wait(200);
  const actual = mutations;
  const expect = [{ type: "added" }, { type: "updated" }, { type: "removed" }];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
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
  await writeFile(fileUrl);
  await wait(500);
  await moveEntry({ from: fileUrl, to: destinationUrl });
  await wait(500);
  const actual = mutations;
  const expect = [{ type: "added" }, { type: "removed" }];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// removed
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(fileUrl);
  const mutations = [];
  const unregister = registerFileLifecycle(fileUrl, {
    removed: () => {
      mutations.push({ type: "removed" });
    },
    keepProcessAlive: false,
  });
  await removeEntry(fileUrl);
  await wait(200);
  await writeFile(fileUrl);
  await wait(200);
  await removeEntry(fileUrl);
  await wait(200);

  const actual = mutations;
  const expect = [{ type: "removed" }, { type: "removed" }];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// updated lot
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(fileUrl);
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
  await writeEntryModificationTime(fileUrl, Date.now());
  await wait(300);
  await writeEntryModificationTime(fileUrl, Date.now());
  await wait(300);
  await writeEntryModificationTime(fileUrl, Date.now());
  await wait(300);

  const actual = mutations;
  const expect = [
    { type: "updated" },
    { type: "updated" },
    { type: "updated" },
  ];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
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
  await removeEntry(tempDirectoryUrl);
  await wait(200);

  const actual = mutations;
  const expect = [];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
}

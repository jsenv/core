import { assert } from "@jsenv/assert";
import {
  ensureEmptyDirectory,
  registerDirectoryLifecycle,
  removeEntry,
  removeEntrySync,
  writeDirectory,
  writeEntryModificationTime,
  writeFile,
  writeFileSync,
} from "@jsenv/filesystem";
import { wait } from "@jsenv/filesystem/tests/testHelpers.js";
import { resolveUrl } from "@jsenv/urls";

const tempDirectoryUrl = resolveUrl("./temp/", import.meta.url);
await ensureEmptyDirectory(tempDirectoryUrl);

// file added
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  const mutations = [];
  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { "./file": "toto" },
    // debug: true,
    added: (data) => {
      mutations.push({ name: "added", ...data });
    },
    updated: (data) => {
      mutations.push({ name: "updated", ...data });
    },
    keepProcessAlive: false,
  });

  await wait(400);
  writeFileSync(fileUrl);
  await wait(400);
  removeEntrySync(fileUrl);
  await wait(400);
  writeFileSync(fileUrl);
  await wait(400);
  const actual = mutations;
  const expect = [
    {
      name: "added",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "added",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
  ];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// file added inside directory
{
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl);
  const fileUrl = resolveUrl("dir/file", tempDirectoryUrl);
  const mutations = [];
  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { "dir/": "toto" },
    added: (data) => {
      mutations.push({ name: "added", ...data });
    },
    updated: (data) => {
      mutations.push({ name: "updated", ...data });
    },
    keepProcessAlive: false,
    recursive: true,
  });
  await writeDirectory(directoryUrl);
  await wait(400);
  writeFileSync(fileUrl);
  await wait(400);

  const actual = mutations;
  const expect = [
    {
      name: "added",
      relativeUrl: `dir`,
      type: "directory",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "added",
      relativeUrl: `dir/file`,
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
  ];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// add, update, remove file
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  const mutations = [];
  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { file: "toto" },
    added: (data) => {
      mutations.push({ name: "added", ...data });
    },
    updated: (data) => {
      mutations.push({ name: "updated", ...data });
    },
    removed: (data) => {
      mutations.push({ name: "removed", ...data });
    },
    keepProcessAlive: false,
  });
  writeFileSync(fileUrl);
  await wait(400);
  await writeEntryModificationTime(fileUrl, Date.now());
  await wait(400);
  removeEntrySync(fileUrl);
  await wait(400);

  const actual = mutations;
  const expect = [
    {
      name: "added",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: actual[0].mtime,
    },
    {
      name: "removed",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
  ];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// remove, add, remove a file
{
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  const mutations = [];
  await writeFile(fileUrl);

  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { file: "toto" },
    updated: (data) => {
      mutations.push({ name: "updated", ...data });
    },
    removed: (data) => {
      mutations.push({ name: "removed", ...data });
    },
    keepProcessAlive: false,
  });
  removeEntrySync(fileUrl);
  await wait(400);
  writeFileSync(fileUrl);
  await wait(400);
  removeEntrySync(fileUrl);
  await wait(400);
  const actual = mutations;
  const expect = [
    {
      name: "removed",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "removed",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
  ];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// remove inside directory
if (process.env.FLAKY) {
  const directoryUrl = resolveUrl("dir", tempDirectoryUrl);
  const fileUrl = resolveUrl("dir/file", tempDirectoryUrl);
  await writeDirectory(directoryUrl);
  await writeFile(fileUrl);
  const mutations = [];

  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { "dir/": "toto" },
    removed: (data) => {
      mutations.push({ name: "removed", ...data });
    },
    keepProcessAlive: false,
    recursive: true,
  });
  await removeEntry(fileUrl);
  await removeEntry(directoryUrl);
  await wait(400);
  await writeDirectory(directoryUrl);
  await writeFile(fileUrl);
  await wait(400);
  await removeEntry(fileUrl);
  await removeEntry(directoryUrl);
  await wait(400);
  const actual = mutations;
  const expect = [
    {
      name: "removed",
      relativeUrl: "dir/file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "removed",
      relativeUrl: "dir",
      type: "directory",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "removed",
      relativeUrl: "dir/file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
    {
      name: "removed",
      relativeUrl: "dir",
      type: "directory",
      patternValue: "toto",
      mtime: assert.any(Number),
    },
  ];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// update file
if (process.env.FLAKY) {
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(fileUrl);
  const mutations = [];

  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { file: "toto" },
    updated: (data) => {
      mutations.push({ name: "updated", ...data });
    },
    keepProcessAlive: false,
  });
  await writeEntryModificationTime(fileUrl, Date.now());
  await wait(400);
  // file removed and created in between
  await removeEntry(fileUrl);
  await wait(400);
  await writeFile(fileUrl);
  await wait(400);
  await writeEntryModificationTime(fileUrl, Date.now() + 1000);
  await wait(400);
  const actual = mutations;
  const expect = [
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: assert.any(Number),
    },
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: assert.any(Number),
    },
  ];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
}

// for now let's disable this one it fails too often even locally
if (process.env.NOPE) {
  // update many
  const fileUrl = resolveUrl("file", tempDirectoryUrl);
  await writeFile(fileUrl);
  await wait(400);
  const mutations = [];

  const unregister = registerDirectoryLifecycle(tempDirectoryUrl, {
    watchPatterns: { file: "toto" },
    updated: (data) => {
      mutations.push({ name: "updated", ...data });
    },
    keepProcessAlive: false,
  });
  await writeEntryModificationTime(fileUrl, Date.now());
  await wait(400);
  await writeEntryModificationTime(fileUrl, Date.now());
  await wait(400);
  await writeEntryModificationTime(fileUrl, Date.now());
  await wait(400);
  const actual = mutations;
  const expect = [
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: assert.any(Number),
    },
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: actual[0].mtime,
    },
    {
      name: "updated",
      relativeUrl: "file",
      type: "file",
      patternValue: "toto",
      mtime: assert.any(Number),
      previousMtime: actual[1].mtime,
    },
  ];
  assert({ actual, expect });
  unregister();
  await ensureEmptyDirectory(tempDirectoryUrl);
}

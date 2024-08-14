/**

This test is meant to work like this:

It reads comment_snapshot.md and ensure regenerating it gives the same output.
The goal is to force dev to regenerate comment_snapshot.md and ensure it looks correct
before commiting it.

-> This is snapshot testing to force a human review when comment is modified.

*/

import { assert } from "@jsenv/assert";
import { readFileSync } from "node:fs";

const commentSnapshotFileUrl = new URL(
  "./comment_snapshot.md",
  import.meta.url,
);
const readCommentSnapshotFile = () => {
  const fileContent = String(readFileSync(commentSnapshotFileUrl));
  return fileContent;
};

// disable on windows because it would fails due to line endings (CRLF)
if (process.platform !== "win32") {
  const expect = readCommentSnapshotFile();
  await import("./generate_comment_snapshot_file.mjs");
  const actual = readCommentSnapshotFile();
  assert({ actual, expect });
}

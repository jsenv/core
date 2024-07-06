import {
  readFileSync,
  removeEntrySync,
  writeFileSync,
} from "@jsenv/filesystem";
import { assert } from "@jsenv/assert";

import { takeFileSnapshot } from "@jsenv/snapshot";
import { FileContentAssertionError } from "@jsenv/snapshot/src/errors.js";

const snapshotFileUrl = new URL("./snapshots/file.png", import.meta.url);
const test = (callback) => {
  removeEntrySync(snapshotFileUrl, { allowUseless: true });
  try {
    callback();
  } finally {
    removeEntrySync(snapshotFileUrl, { allowUseless: true });
  }
};

test(() => {
  writeFileSync(
    snapshotFileUrl,
    readFileSync(new URL("./fixtures/map_actual.png", import.meta.url)),
  );
  const fileSnapshot = takeFileSnapshot(snapshotFileUrl);
  writeFileSync(
    snapshotFileUrl,
    readFileSync(new URL("./fixtures/map_expect.png", import.meta.url)),
  );
  try {
    fileSnapshot.compare(true);
    throw new Error("should throw");
  } catch (e) {
    assert({
      actual: e,
      expect:
        new FileContentAssertionError(`snapshot comparison failed for "file.png"
--- reason ---
content has changed
--- file ---
${snapshotFileUrl.href}`),
    });
  }
});

test(() => {
  writeFileSync(
    snapshotFileUrl,
    readFileSync(new URL("./fixtures/restau_actual.png", import.meta.url)),
  );
  const fileSnapshot = takeFileSnapshot(snapshotFileUrl);
  writeFileSync(
    snapshotFileUrl,
    readFileSync(new URL("./fixtures/restau_expect.png", import.meta.url)),
  );
  fileSnapshot.compare(true);
});

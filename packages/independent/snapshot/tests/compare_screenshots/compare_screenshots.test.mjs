import {
  readFileSync,
  removeEntrySync,
  writeFileSync,
} from "@jsenv/filesystem";

import { takeFileSnapshot } from "@jsenv/snapshot";

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
  fileSnapshot.compare();
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
  fileSnapshot.compare();
});

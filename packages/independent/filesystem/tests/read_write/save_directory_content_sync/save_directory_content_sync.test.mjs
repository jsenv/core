import { assert } from "@jsenv/assert";

import {
  saveDirectoryContentSync,
  writeFileStructureSync,
  readFileStructureSync,
  removeFileSync,
  writeFileSync,
  ensureEmptyDirectorySync,
} from "@jsenv/filesystem";

const tempDirectoryUrl = new URL("./temp/", import.meta.url);
const test = (callback) => {
  ensureEmptyDirectorySync(tempDirectoryUrl);
  try {
    callback();
  } finally {
    ensureEmptyDirectorySync(tempDirectoryUrl);
  }
};

// restore empty (remove files that where aded)
test(() => {
  const tempDirectoryContentBackup = saveDirectoryContentSync(tempDirectoryUrl);
  writeFileStructureSync(tempDirectoryUrl, {
    "a.js": "",
    "b.txt": "toto",
  });
  tempDirectoryContentBackup.restore();
  const actual = readFileStructureSync(tempDirectoryUrl);
  const expected = {};
  assert({ actual, expected });
});

// restore one file that got removed
test(() => {
  writeFileStructureSync(tempDirectoryUrl, {
    "file.txt": "hello",
  });
  const tempDirectoryContentBackup = saveDirectoryContentSync(tempDirectoryUrl);
  removeFileSync(new URL("./file.txt", tempDirectoryUrl));
  tempDirectoryContentBackup.restore();
  const actual = readFileStructureSync(tempDirectoryUrl);
  const expected = {
    "file.txt": "hello",
  };
  assert({ actual, expected });
});

// restore one file that got updated
test(() => {
  writeFileStructureSync(tempDirectoryUrl, {
    "file.txt": "hello",
  });
  const tempDirectoryContentBackup = saveDirectoryContentSync(tempDirectoryUrl);
  writeFileSync(new URL("./file.txt", tempDirectoryUrl), "coucou");
  tempDirectoryContentBackup.restore();
  const actual = readFileStructureSync(tempDirectoryUrl);
  const expected = {
    "file.txt": "hello",
  };
  assert({ actual, expected });
});

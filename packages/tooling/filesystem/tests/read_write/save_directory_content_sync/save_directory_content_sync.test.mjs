import { assert } from "@jsenv/assert";

import {
  ensureEmptyDirectorySync,
  readFileStructureSync,
  removeFileSync,
  saveDirectoryContentSync,
  writeFileStructureSync,
  writeFileSync,
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
  const expect = {};
  assert({ actual, expect });
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
  const expect = {
    "file.txt": "hello",
  };
  assert({ actual, expect });
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
  const expect = {
    "file.txt": "hello",
  };
  assert({ actual, expect });
});

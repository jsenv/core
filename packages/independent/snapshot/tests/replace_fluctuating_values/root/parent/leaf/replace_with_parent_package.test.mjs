import { assert } from "@jsenv/assert";
import { replaceFluctuatingValues } from "@jsenv/snapshot/src/replace_fluctuating_values.js";
import { fileURLToPath } from "node:url";

{
  const source = `
- file: ${import.meta.url}
- dir: ${new URL("./", import.meta.url)}
- parent: ${new URL("../", import.meta.url)}
- grandparent: ${new URL("../../", import.meta.url)}
`;
  const actual = replaceFluctuatingValues(source, {
    cwdPath: fileURLToPath(new URL("./", import.meta.url)),
    ancestorPackagesRootDirectoryUrl: new URL("../../../", import.meta.url)
      .href,
  });
  const expect = `
- file: root/parent/leaf/replace_with_parent_package.test.mjs
- dir: root/parent/leaf/
- parent: root/parent/
- grandparent: root/
`;
  assert({ actual, expect });
}

{
  const source = `
- file: ${import.meta.url}
- dir: ${new URL("./", import.meta.url)}
- parent: ${new URL("../", import.meta.url)}
  `;
  const actual = replaceFluctuatingValues(source, {
    cwdPath: fileURLToPath(new URL("./", import.meta.url)),
    ancestorPackagesRootDirectoryUrl: new URL("../../", import.meta.url).href,
  });
  const expect = `
- file: parent/leaf/replace_with_parent_package.test.mjs
- dir: parent/leaf/
- parent: parent/
  `;
  assert({ actual, expect });
}

{
  const source = `
- file: ${import.meta.url}
- dir: ${new URL("./", import.meta.url)}
`;
  const actual = replaceFluctuatingValues(source, {
    cwdPath: fileURLToPath(new URL("./", import.meta.url)),
    ancestorPackagesRootDirectoryUrl: new URL("../", import.meta.url).href,
  });
  const expect = `
- file: leaf/replace_with_parent_package.test.mjs
- dir: leaf/
`;
  assert({ actual, expect });
}

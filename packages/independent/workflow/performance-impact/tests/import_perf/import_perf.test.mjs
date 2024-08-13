import { assert } from "@jsenv/assert";
import { startMeasures } from "@jsenv/performance-impact";

if (process.platform === "win32") {
  process.exit(0);
}

const test = async (fileRelativeUrl) => {
  const measures = startMeasures({
    filesystem: true,
  });
  await import(`${fileRelativeUrl}main.js`);
  const { fsOpenCall, fsStatCall } = measures.stop();
  return { fsOpenCall, fsStatCall };
};
const actual = {
  single: await test("./fixtures/0_single_file/"),
  twoImport: await test("./fixtures/1_two_import/"),
  twoImportAndShared: await test("./fixtures/2_two_import_and_shared/"),
};
const expect = {
  single: {
    fsOpenCall: 1,
    fsStatCall: 3,
  },
  twoImport: {
    fsOpenCall: 3,
    fsStatCall: 4,
  },
  twoImportAndShared: {
    fsOpenCall: 4,
    fsStatCall: 5,
  },
};
assert({ actual, expect });

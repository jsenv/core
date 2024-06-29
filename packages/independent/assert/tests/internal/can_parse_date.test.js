import { canParseDate } from "@jsenv/assert/src/utils/can_parse_date.js";

const test = ({ shouldFail, shouldPass }) => {
  for (const v of shouldFail) {
    const result = canParseDate(v);
    if (result) {
      throw new Error(`canParseDate should have returned false for ${v}`);
    }
  }
  for (const v of shouldPass) {
    const result = canParseDate(v);
    if (!result) {
      throw new Error(`canParseDate should have returned true for ${v}`);
    }
  }
};
test({
  shouldFail: [
    "0",
    "28",
    "0/1",
    "70/01/01",
    "1.1",
    "2014-25-23",
    "2014-02-30",
    "a/0",
    "a\n/0",
    "1980/01/01",
  ],
  shouldPass: [
    "Thu, 01 Jan 1970 00:00:00",
    "1995-12-04 00:12:00.000Z",
    "Tue May 07 2024 11:27:04 GMT+0200 (Central European Summer Time)",
  ],
});

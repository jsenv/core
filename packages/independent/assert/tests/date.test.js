// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/parse#non-standard_date_strings
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#date_time_string_format

import { assert } from "@jsenv/assert";
import { startSnapshotTesting } from "./utils/start_snapshot_testing.js";

await startSnapshotTesting("date", ({ test }) => {
  test("year month day minutes diff on iso", () => {
    assert({
      actual: "1970-01-01 00:00:00.000Z",
      expect: "1995-12-04 00:12:00.000Z",
    });
  });
  test("millisecond only diff on iso", () => {
    assert({
      actual: "1970-01-01 00:00:00.000Z",
      expect: "1970-01-01 00:00:00.020Z",
    });
  });
  test("+2 hour on timezone", () => {
    assert({
      actual: "1970-01-01 10:00:00+03:00",
      expect: "1970-01-01 10:00:00+01:00",
    });
  });
  test("-2 hour on timezone", () => {
    assert({
      actual: "1970-01-01 10:00:00-03:00",
      expect: "1970-01-01 10:00:00-01:00",
    });
  });
  test("+1h30 on timezone", () => {
    assert({
      actual: "1970-01-01 10:00:00+01:30",
      expect: "1970-01-01 10:00:00+00:00",
    });
  });
  test("-1h30 on timezone", () => {
    assert({
      actual: "1970-01-01 10:00:00-01:30",
      expect: "1970-01-01 10:00:00+00:00",
    });
  });
  test("+0h30 on timezone", () => {
    assert({
      actual: "1970-01-01 10:00:00+00:30",
      expect: "1970-01-01 10:00:00+00:00",
    });
  });
  timezone: {
    test("timezone stuff", () => {
      assert({
        actual: "Thu Jan 01 1970 12:00:00 GMT+0500",
        expect: "1970-01-01 00:00:00.000Z",
      });
    });
    test("GMT vs iso", () => {
      assert({
        actual: "Tue May 07 2024 11:27:04 GMT+0200",
        expect: "1970-01-01 00:00:00Z",
      });
    });
    test("simplified date", () => {
      assert({
        actual: "1970-01-01 10:00:00",
        expect: "1970-01-01 10:00:00Z",
      });
    });
  }
  test("date objects", () => {
    assert({
      actual: new Date("1970-01-01 10:00:00Z"),
      expect: new Date("1970-01-01 8:00:00Z"),
    });
  });
  test("date object vs date string", () => {
    assert({
      actual: new Date("1970-01-01 10:00:00Z"),
      expect: "1970-01-01 10:00:00Z",
    });
  });
  test("date object prop", () => {
    assert({
      actual: Object.assign(new Date("1970-01-01 10:00:00Z"), { foo: true }),
      expect: Object.assign(new Date("1970-01-01 10:00:00Z"), { foo: false }),
    });
  });
  test(`incorrect date string`, () => {
    assert({
      actual: "0",
      expect: "70/01/01",
    });
  });
});

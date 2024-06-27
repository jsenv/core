import { assert } from "../src/assert_scratch.js";
import { startSnapshotTesting } from "./start_snapshot_testing.js";

await startSnapshotTesting("number", ({ test }) => {
  test.ONLY("-0 and 0", () => {
    assert({
      actual: -0,
      expect: +0,
    });
  });
  test("1 and -0", () => {
    assert({
      actual: 1,
      expect: -0,
    });
  });
  test("-1 and 1", () => {
    assert({
      actual: -1,
      expect: 1,
    });
  });
  test("10.45 and 10.456", () => {
    assert({
      actual: 10.45,
      expect: 10.456,
    });
  });
  test("-Infinity and Infinity", () => {
    assert({
      actual: -Infinity,
      expect: Infinity,
    });
  });
  test("NaN and Infinity", () => {
    assert({
      actual: NaN,
      expect: Infinity,
    });
  });
  test("decimals using exponent", () => {
    assert({
      actual: 2e-6,
      expect: 2e-7,
    });
  });
  test("decimals using exponent v2", () => {
    assert({
      actual: 2e-7,
      expect: 2e-8,
    });
  });
  test("exponent integer", () => {
    assert({
      actual: 10e12,
      expect: 10e11,
    });
  });
  test("exponent negative integer", () => {
    assert({
      actual: 10e12,
      expect: -10e12,
    });
  });
  test("1235 and 67_000", () => {
    assert({
      actual: 1235,
      expect: 67_000,
    });
  });
  test("149_600_000 and 1_464_301", () => {
    assert({
      actual: 149_600_000,
      expect: 1_464_301,
    });
  });
  test("1_001 and 2_002", () => {
    assert({
      actual: 1_001,
      expect: 2_002,
    });
  });
  test("2_200_002 and 1_100_001", () => {
    assert({
      actual: 2_200_002,
      expect: 1_100_001,
    });
  });
  test("1234.56 and 12_345.67", () => {
    assert({
      actual: 1234.56,
      expect: 12_345.67,
    });
  });
  test("-0.120_123 and -1_000_001", () => {
    assert({
      actual: -0.120_123,
      expect: -1_000_001,
    });
  });
  test("-1.23456e15 and -1200000e5", () => {
    assert({
      actual: -1.23456e15,
      expect: -1200000e5,
    });
  });
  test("1.8e307 and 1.8e308", () => {
    assert({
      actual: 1.8e307,
      expect: 1.8e308,
    });
  });
  test("special notations", () => {
    assert({
      maxDiffPerObject: 10,
      actual: {
        a: 3.65432e12,
        b: 0b10101010101010, // binary
        // prettier-ignore
        c: 0B10101010101010, // binary 2
        d: 0xfabf00d, // hexadecimal
        e: 0xabcdef,
        f: 0o010101010101, // octal,
        // prettier-ignore
        g: 0O010101010101, // octal 2
      },
      expect: {},
    });
  });
  test("BigInt(1) and BigInt(2)", () => {
    assert({
      actual: BigInt(1),
      expect: BigInt(2),
    });
  });
  test(`BigInt(1) and "1n"`, () => {
    assert({
      actual: BigInt(1),
      expect: "1n",
    });
  });
  test(`10 and "10"`, () => {
    assert({
      actual: 10,
      expect: "10",
    });
  });
});

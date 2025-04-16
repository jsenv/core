import { snapshotTests } from "@jsenv/snapshot";
import { PATTERN } from "../pattern.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_named_only", () => {
    const pattern = PATTERN.create("before/:id/after", {
      namedGroupDelimiter: "/",
    });
    const a = pattern.generate({ id: "a" });
    const b = pattern.generate({ id: "b" });
    const auto = pattern.generateExample();
    return {
      a,
      b,
      auto,
    };
  });

  test("1_star_only", () => {
    const pattern = PATTERN.create("start/*/middle/*/end", {
      namedGroupDelimiter: "/",
    });
    const a = pattern.generate("a", "b");
    const b = pattern.generate("c", "d");
    const auto = pattern.generateExample();
    return {
      a,
      b,
      auto,
    };
  });

  test("2_named_and_star", () => {
    const pattern = PATTERN.create("start/:id/*", {
      namedGroupDelimiter: "/",
    });
    const a = pattern.generate({ id: "id_value" }, "path_value");
    const auto = pattern.generateExample();
    return {
      a,
      auto,
    };
  });
});

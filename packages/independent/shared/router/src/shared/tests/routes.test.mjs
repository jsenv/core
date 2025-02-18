import { snapshotTests } from "@jsenv/snapshot";
import { createRoutes } from "../routes.js";

await snapshotTests(import.meta.url, ({ test }) => {
  test("0_match_and_order", () => {
    const match = createRoutes({
      "*": () => "*",
      "GET *": () => "GET *",
      "GET /a": () => "GET /a",
      "GET /ab": () => "GET /ab",
    });

    return {
      a: match({ method: "GET", resource: "/" }),
      b: match({ method: "GET", resource: "/a" }),
      c: match({ method: "GET", resource: "/ab" }),
      d: match({ method: "POST", resource: "/" }),
      e: match({ method: "POST", resource: "/a" }),
    };
  });
});

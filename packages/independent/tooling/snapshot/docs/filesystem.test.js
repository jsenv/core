import { snapshotTests } from "@jsenv/snapshot";
import { writeFileSync } from "node:fs";

const writeFileTxt = (content) => {
  writeFileSync(new URL("./file.txt", import.meta.url), content);
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("when writing toto", () => {
    return writeFileTxt("toto");
  });

  test("when writing  tata", () => {
    return writeFileTxt("tata");
  });
});

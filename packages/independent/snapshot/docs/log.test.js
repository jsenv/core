import { snapshotTests } from "@jsenv/snapshot";

const logMyName = (name) => {
  console.log(`my name is: ${name}`);
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("when name is toto", () => {
    return logMyName("toto");
  });

  test("when name is tata", () => {
    return logMyName("tata");
  });
});

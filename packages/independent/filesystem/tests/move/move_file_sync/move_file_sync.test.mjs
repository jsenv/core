import { moveFileSync, writeFileStructureSync } from "@jsenv/filesystem";

const test = (scenario, fn) => {
  const scenarioAtStartDirectoryUrl = new URL(
    `./fixtures/${scenario}/`,
    import.meta.url,
  );
  const scenarioDirectoryUrl = new URL(
    `./output/${scenario}/`,
    import.meta.url,
  );
  writeFileStructureSync(scenarioDirectoryUrl, scenarioAtStartDirectoryUrl);
  fn(scenarioDirectoryUrl);
};

test("0_into_nothing", (scenarioDirectoryUrl) => {
  moveFileSync({
    from: new URL("./a.txt", scenarioDirectoryUrl),
    to: new URL("./b.txt", scenarioDirectoryUrl),
  });
});

test("1_into_existing_file_and_override_enabled", (scenarioDirectoryUrl) => {
  moveFileSync({
    from: new URL("./a.txt", scenarioDirectoryUrl),
    to: new URL("./b.txt", scenarioDirectoryUrl),
    override: true,
  });
});

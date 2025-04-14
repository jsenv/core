import { FOO } from "./jsenv_core_node_modules.js?dynamic_import_id=build";

const answer = 42;

const build = async () => {
  await import("../bar_index/bar_index.js?dynamic_import_id=bar_index");

  console.log("build", FOO, answer);
};

export { build };

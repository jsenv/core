import { FOO } from "./jsenv_core_node_modules.js?dynamic_import_id=build_server";

const answer = 42;

const startBuildServer = async () => {
  await import("./bar_index/bar_index.js?dynamic_import_id=bar_index");

  console.log("start build server", FOO, answer);
};

export { startBuildServer };

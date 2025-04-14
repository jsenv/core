import { FOO } from "./jsenv_core_node_modules.js?dynamic_import_id=dev";

const answer = 42;

const startDevServer = () => {
  console.log("start dev server", FOO, answer);
};

export { startDevServer };

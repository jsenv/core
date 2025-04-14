import { FOO } from "/jsenv_core_node_modules.js";
import { answer } from "/main_build.js";

const build = async () => {
  await import("/js/bar_index.js");

  console.log("build", FOO, answer);
};

export { build };

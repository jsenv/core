import { eslintConfigRelax } from "@jsenv/eslint-config-relax";

export default eslintConfigRelax({
  rootDirectoryUrl: new URL("./", import.meta.url),
  type: "browser",
  jsxPragmaAuto: true,
});

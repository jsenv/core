import { eslintConfigRelax } from "@jsenv/eslint-config-relax";

export default eslintConfigRelax({
  rootDirectoryUrl: new URL("./", import.meta.url),
  browserDirectoryUrl: new URL("./src/", import.meta.url),
  jsxPragmaAuto: true,
});

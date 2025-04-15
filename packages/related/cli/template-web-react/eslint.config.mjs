import { eslintConfigRelax } from "@jsenv/eslint-config-relax";

export default eslintConfigRelax({
  rootDirectoryUrl: import.meta.resolve("./"),
  browserDirectoryUrl: import.meta.resolve("./src/"),
  jsxPragmaAuto: true,
});

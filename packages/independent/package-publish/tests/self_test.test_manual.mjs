import { publishPackage } from "@jsenv/package-publish";
import { loadEnvFile } from "./test_helper.js";

const run = async () => {
  if (!process.env.CI) {
    await loadEnvFile(new URL("../secrets.json", import.meta.url).href);
  }

  const projectDirectoryUrl = new URL("../", import.meta.url).href;

  const report = await publishPackage({
    projectDirectoryUrl,
    registriesConfig: {
      "https://registry.npmjs.org": {
        token: process.env.NPM_TOKEN,
      },
      "https://npm.pkg.github.com": {
        token: process.env.GITHUB_TOKEN,
      },
    },
  });
  console.log(report);
};
run();

/*
 * ok l'idée va etre de demande au front de faire une requete vers le back
 * et d'afficher le résultat dans la UI
 * pour au'on puisse prendre un screenshot
 * c'est ptet un poil trop proche de l'exp utiliisateur alors
 * que la plupart du temps un backend doit etre request par n'importe qui
 * on va garder ce test pour plus tard et commencer headless
 */

import { writeFileSync } from "@jsenv/filesystem";
import { createFileSystemFetch, startServer } from "@jsenv/server";
import { chromium } from "playwright";

let debug = false;
const clientDirectoryUrl = new URL("./client/", import.meta.url);
const snapshotsDirectoryUrl = new URL("./snapshots/", import.meta.url);

const frontendServer = await startServer({
  routes: [
    {
      endpoint: "GET *",
      fetch: createFileSystemFetch(clientDirectoryUrl),
    },
  ],
});
const backendServer = await startServer({
  routes: [
    {
      endpoint: "GET /",
      fetch: () => new Response("Hello world"),
    },
  ],
});

const takeScreenshot = async (scenario) => {
  const sceenshotBuffer = await page.screenshot();
  writeFileSync(
    new URL(`./${scenario}.png`, snapshotsDirectoryUrl),
    sceenshotBuffer,
  );
};

const browser = await chromium.launch({
  headless: !debug,
  devtools: debug,
});
const page = await browser.newPage({ ignoreHTTPSErrors: true });
await page.setViewportSize({ width: 800, height: 500 }); // set a relatively small and predicatble size
try {
  await page.goto(`${frontendServer.origin}/index.html`);
  await takeScreenshot("0_hello_world");
} finally {
  if (!debug) {
    browser.close();
    frontendServer.stop();
    backendServer.stop();
  }
}

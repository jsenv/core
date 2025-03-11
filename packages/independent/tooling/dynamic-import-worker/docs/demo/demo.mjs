import { importOneExportFromFile } from "@jsenv/dynamic-import-worker";

const randomNumberFileUrl = new URL("./random_number.mjs", import.meta.url);
const randomNumberExportUrl = `${randomNumberFileUrl}#randomNumber`;

const randomNumberA = await importOneExportFromFile(randomNumberExportUrl);
const randomNumberB = await importOneExportFromFile(randomNumberExportUrl);

console.log(randomNumberA);
console.log(randomNumberB);

import { readFile } from "@jsenv/filesystem"
import { applyAlgoToRepresentationData } from "@jsenv/integrity"

console.log(
  applyAlgoToRepresentationData(
    "sha256",
    await readFile(new URL("./client/file.js", import.meta.url)),
  ),
)

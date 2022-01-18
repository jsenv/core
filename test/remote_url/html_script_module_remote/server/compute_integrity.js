import { readFile } from "@jsenv/filesystem"
import { applyAlgoToRepresentationData } from "@jsenv/core/src/internal/integrity/integrity_algorithms.js"

console.log(
  applyAlgoToRepresentationData(
    "sha256",
    await readFile(new URL("./client/file.js", import.meta.url)),
  ),
)

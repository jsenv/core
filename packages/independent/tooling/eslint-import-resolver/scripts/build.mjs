import { writeFile } from "@jsenv/filesystem";
import { isFileSystemPath } from "@jsenv/urls";
import { fileURLToPath, pathToFileURL } from "node:url";

const esToCjs = async ({ url, map, content }) => {
  const { rollup } = await import("rollup");
  const rollupBuild = await rollup({
    input: fileURLToPath(url),
    plugins: [
      {
        resolveId: async (id, importer = fileURLToPath(url)) => {
          if (id.startsWith("node:")) {
            return { id, external: true };
          }
          if (isFileSystemPath(id)) {
            id = String(pathToFileURL(id));
          }
          const url = await import.meta.resolve(id, pathToFileURL(importer));
          if (url.endsWith("emoji-regex/index.js")) {
            return fileURLToPath(new URL(url.replace("index.js", "index.mjs")));
          }
          if (url.startsWith("node:")) {
            return { id: url, external: true };
          }
          const path = fileURLToPath(new URL(url));
          return path;
        },
        outputOptions: (outputOptions) => {
          outputOptions.paths = (id) => {
            if (id.startsWith("node:")) {
              return id.slice("node:".length);
            }
            return null;
          };
        },
      },
    ],
  });
  const { output } = await rollupBuild.generate({
    format: "cjs",
    sourcemap: true,
  });
  const firstChunk = output[0];
  map = firstChunk.map;
  content = firstChunk.code;
  return {
    map,
    content,
  };
};
const { content } = await esToCjs({
  url: new URL("../src/main.js", import.meta.url).href,
});
await writeFile(
  new URL("../dist/jsenv_eslint_import_resolver.cjs", import.meta.url),
  content,
);

import {
  readFile,
  readFileSync,
  writeDirectory,
  writeDirectorySync,
  writeFile,
  writeFileSync,
} from "@jsenv/filesystem";
import { snapshotFunctionSideEffects } from "@jsenv/snapshot";
import { existsSync } from "node:fs";

write_file: {
  snapshotFunctionSideEffects(
    () => {
      writeFileSync(
        new URL("./toto.txt", import.meta.url),
        "0_write_file_sync",
      );
    },
    new URL("./output/0_write_sync.md", import.meta.url),
  );
  snapshotFunctionSideEffects(
    () => {
      writeFileSync(
        new URL("./toto.txt", import.meta.url),
        "1_write_then_read_sync",
      );
      const value = String(
        readFileSync(new URL("./toto.txt", import.meta.url)),
      );
      return value;
    },
    new URL("./output/1_write_then_read_sync.md", import.meta.url),
  );
  snapshotFunctionSideEffects(
    () => {
      writeFileSync(
        new URL("./toto.txt", import.meta.url),
        "2_write_sync_out_directory",
      );
    },
    new URL("./output/2_write_sync_out_directory.md", import.meta.url),
    {
      filesystemEffects: {
        rootDirectory: new URL("./", import.meta.url),
        outDirectory: "./2_write_sync_out_directory/",
      },
    },
  );
  snapshotFunctionSideEffects(
    () => {
      writeFileSync(
        new URL("./toto/toto.txt", import.meta.url),
        "3_write_sync_deep",
      );
    },
    new URL("./output/3_write_sync_deep.md", import.meta.url),
  );
  await snapshotFunctionSideEffects(
    async () => {
      await writeFile(new URL("./toto.txt", import.meta.url), "4_write_async");
    },
    new URL("./output/4_write_async.md", import.meta.url),
  );
}
read_file: {
  // read file twice
  // there was a bug about this in a previous implementation
  // where second read file would never resolve
  await snapshotFunctionSideEffects(
    async () => {
      await readFile(import.meta.url, { as: "string" });
    },
    new URL("./output/5_read_file_first.md", import.meta.url),
  );
  await snapshotFunctionSideEffects(
    async () => {
      await readFile(import.meta.url, { as: "string" });
    },
    new URL("./output/6_read_file_second.md", import.meta.url),
  );
}
write_directory: {
  snapshotFunctionSideEffects(
    () => {
      writeDirectorySync(new URL("./dir_sync/", import.meta.url));
      return existsSync(new URL("./dir_sync/", import.meta.url));
    },
    new URL("./output/5_write_directory_sync.md", import.meta.url),
  );
  await snapshotFunctionSideEffects(
    () => {
      writeDirectory(new URL("./dir_async/", import.meta.url));
      return existsSync(new URL("./dir_async/", import.meta.url));
    },
    new URL("./output/6_write_directory_async.md", import.meta.url),
  );
}

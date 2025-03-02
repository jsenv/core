import { createReadStream } from "node:fs";
import { observableFromNodeStream } from "./observable_from_node_stream.js";

export const observableFromFileHandle = (fileHandle) => {
  return observableFromNodeStream(fileHandleToReadableStream(fileHandle));
};

export const fileHandleToReadableStream = (fileHandle) => {
  const fileReadableStream =
    typeof fileHandle.createReadStream === "function"
      ? fileHandle.createReadStream()
      : createReadStream(
          "/toto", // is it ok to pass a fake path like this?
          {
            fd: fileHandle.fd,
            emitClose: true,
            // autoClose: true
          },
        );
  // I suppose it's required only when doing fs.createReadStream()
  // and not fileHandle.createReadStream()
  // fileReadableStream.on("end", () => {
  //   fileHandle.close()
  // })
  return fileReadableStream;
};

import { observableFromNodeStream } from "./observable_from_node_stream.js";

export const isFileHandle = (value) => {
  return value && value.constructor && value.constructor.name === "FileHandle";
};

export const observableFromFileHandle = (fileHandle) => {
  return observableFromNodeStream(fileHandleToReadableStream(fileHandle));
};

export const fileHandleToReadableStream = (fileHandle) => {
  return fileHandle.createReadStream();
};

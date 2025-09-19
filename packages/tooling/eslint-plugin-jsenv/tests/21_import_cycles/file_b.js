import { mainFunction } from "./file_a.js";

export function helperFunction({ userId, processData, options }) {
  return mainFunction({ userId, processData, options });
}
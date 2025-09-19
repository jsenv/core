// Middle layer that re-exports from core
export { processItem } from "./core.js";

export function enhanceItem({ item, config, enhancement }) {
  return { enhanced: true, item, config, enhancement };
}

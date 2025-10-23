// Top layer that imports from utils (which re-exports from core)
import { enhanceItem, processItem } from "./utils.js";

export function handleItemWithDeepNesting({
  item,
  config,
  enhancement,
  metadata,
}) {
  const processed = processItem({ item, config });
  const enhanced = enhanceItem({ item: processed.item, config, enhancement });
  return { ...enhanced, metadata, level: "deep" };
}

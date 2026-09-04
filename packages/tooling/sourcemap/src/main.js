// tslint:disable:ordered-imports

export { createMagicSource } from "./magic_source.js";
export {
  composeSourcemaps,
  composeTwoSourcemaps,
} from "./sourcemap_composition_v3.js";
export { applyContentEditsOnSourcemap } from "./sourcemap_edits.js";

export { getOriginalPosition } from "./original_position.js";
export { sourcemapConverter } from "./sourcemap_converter.js";
export {
  generateSourcemapFileUrl,
  generateSourcemapDataUrl,
} from "./sourcemap_url_generator.js";
export { SOURCEMAP } from "./sourcemap_comment.js";

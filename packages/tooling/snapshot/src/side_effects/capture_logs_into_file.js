import { createCaptureSideEffects } from "./create_capture_side_effects.js";
import { renderLogsSvg } from "./render_logs_svg.js";

export const captureLogsIntoFile = async (fn, { svgFileUrl }) => {
  const capture = createCaptureSideEffects({
    executionEffects: false,
    filesystemEffects: false,
    logEffects: {
      group: false,
    },
  });
  const sideEffects = await capture(fn);
  renderLogsSvg(sideEffects, svgFileUrl);
};

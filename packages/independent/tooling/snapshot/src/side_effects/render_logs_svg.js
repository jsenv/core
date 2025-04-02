import { writeFileSync } from "@jsenv/filesystem";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
import { isLogSideEffect } from "./log/log_side_effects.js";

export const renderLogsSvg = async (
  sideEffects,
  svgFileUrl,
  svgOptions = {},
) => {
  const terminalRecorder = await startTerminalRecording({
    svg: {
      title: "Terminal",
      width: "auto",
      ...svgOptions,
    },
  });
  for (const sideEffect of sideEffects) {
    if (isLogSideEffect(sideEffect)) {
      await terminalRecorder.write(`${sideEffect.value}\n`, {
        delay: sideEffect.delay,
      });
    }
  }
  const result = await terminalRecorder.stop();
  const svg = await result.svg();
  writeFileSync(new URL(svgFileUrl), svg);
};

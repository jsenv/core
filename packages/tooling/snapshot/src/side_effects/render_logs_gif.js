import { writeFileSync } from "@jsenv/filesystem";
import { startTerminalRecording } from "@jsenv/terminal-recorder";
import { isLogSideEffect } from "./log/log_side_effects.js";

export const renderLogsGif = async (sideEffects, gifFileUrl) => {
  const terminalRecorder = await startTerminalRecording({
    gif: true,
  });
  for (const sideEffect of sideEffects) {
    if (isLogSideEffect(sideEffect)) {
      await terminalRecorder.write(sideEffect.value, {
        delay: sideEffect.delay,
      });
    }
  }
  const result = await terminalRecorder.stop();
  const gif = await result.gif();
  writeFileSync(new URL(gifFileUrl), gif);
};

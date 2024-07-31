import { writeFileSync } from "@jsenv/filesystem";
import { startTerminalRecording } from "@jsenv/terminal-recorder";

export const renderLogsGif = async (sideEffects, gitFileUrl) => {
  const terminalRecorder = await startTerminalRecording({
    gif: true,
  });
  for (const sideEffect of sideEffects) {
    if (sideEffect.type === "console.log") {
      await terminalRecorder.write(sideEffect.value, {
        delay: sideEffect.delay,
      });
    }
  }
  const result = await terminalRecorder.stop();
  const gif = await result.gif();
  writeFileSync(new URL(gitFileUrl), gif);
};

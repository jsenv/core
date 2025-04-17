export const createPlaybackAbortError = () => {
  const playbackAbortError = new Error("Playback aborted");
  playbackAbortError.name = "AbortError";
  playbackAbortError.isPlaybackAbortError = true;
  return playbackAbortError;
};

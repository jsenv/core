import { createParallelPlaybackController } from "./playback_parallel.js";
import { createPlaybackSequenceController } from "./playback_sequence.js";

export const PLAYBACK = {
  sequence: createPlaybackSequenceController,
  parallel: createParallelPlaybackController,
};

import { Box } from "oto/src/components/box/box_oto.jsx";
import {
  pauseAllMusics,
  playAllMusics,
  useMusicsAllPaused,
} from "./music/music_global_controls.js";

export const ButtonPlayPause = () => {
  const musicsAllPaused = useMusicsAllPaused();
  if (musicsAllPaused) {
    return (
      <Box.button
        onClick={() => {
          playAllMusics();
        }}
        width="32"
      >
        <PlayIconSvg />
      </Box.button>
    );
  }
  return (
    <Box.button
      onClick={() => {
        pauseAllMusics();
      }}
      width="32"
    >
      <PauseIconSvg />
    </Box.button>
  );
};

const PlayIconSvg = () => {
  return (
    <svg name="play_icon" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M6 6 L16 12 L6 18 Z"
        stroke="#000000"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

const PauseIconSvg = () => {
  return (
    <svg name="pause_icon" viewBox="0 0 24 24" fill="currentColor">
      <path
        d="M8 5 V19 M16 5 V19"
        stroke="#000000"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
};

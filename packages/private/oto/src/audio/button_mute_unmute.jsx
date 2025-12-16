import { Box } from "oto/src/components/box/box_oto.jsx";
import { mute, unmute, useMuted } from "./audio.js";

export const ButtonMuteUnmute = () => {
  const muted = useMuted();
  if (muted) {
    return (
      <Box.button onClick={unmute} width="32">
        <AudioDisabledIcon />
      </Box.button>
    );
  }
  return (
    <Box.button onClick={mute} width="32">
      <AudioEnabledIcon />
    </Box.button>
  );
};

// https://www.svgrepo.com/collection/cfpb-design-system-icons/2

const AudioDisabledIcon = () => {
  return (
    <svg viewBox="-1.5 0 19 19">
      <path
        fill="currentColor"
        d="M7.676 4.938v9.63c0 .61-.353.756-.784.325l-2.896-2.896H2.02A1.111 1.111 0 0 1 .911 10.89V8.618a1.112 1.112 0 0 1 1.108-1.109h1.977l2.896-2.896c.43-.43.784-.284.784.325zm7.251 6.888a.554.554 0 1 1-.784.784l-2.072-2.073-2.073 2.073a.554.554 0 1 1-.784-.784l2.073-2.073L9.214 7.68a.554.554 0 0 1 .784-.783L12.07 8.97l2.072-2.073a.554.554 0 0 1 .784.783l-2.072 2.073z"
      />
    </svg>
  );
};

const AudioEnabledIcon = () => {
  return (
    <svg viewBox="-2.5 0 19 19">
      <path
        fill="currentColor"
        d="M7.365 4.785v9.63c0 .61-.353.756-.784.325l-2.896-2.896H1.708A1.112 1.112 0 0 1 .6 10.736V8.464a1.112 1.112 0 0 1 1.108-1.108h1.977L6.581 4.46c.43-.43.784-.285.784.325zm2.468 7.311a3.53 3.53 0 0 0 0-4.992.554.554 0 0 0-.784.784 2.425 2.425 0 0 1 0 3.425.554.554 0 1 0 .784.783zm1.791 1.792a6.059 6.059 0 0 0 0-8.575.554.554 0 1 0-.784.783 4.955 4.955 0 0 1 0 7.008.554.554 0 1 0 .784.784z"
      />
    </svg>
  );
};

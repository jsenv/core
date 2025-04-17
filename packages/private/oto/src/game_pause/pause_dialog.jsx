import { useKeyEffect } from "hooks/use_key_effect.js";
import { pauseGame, playGame, useGamePaused } from "./game_pause.js";

export const PauseDialog = ({ visible }) => {
  const gamePaused = useGamePaused();

  useKeyEffect({
    Escape: {
      enabled: !gamePaused,
      callback: () => {
        pauseGame();
      },
    },
    Enter: {
      enabled: gamePaused,
      callback: () => {
        playGame();
      },
    },
  });

  return (
    <div
      name="pause_dialog"
      style={{
        position: "absolute",
        display: visible ? "flex" : "none",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        justifyContent: "center",
        alignItems: "center",
      }}
      onClick={() => {
        playGame();
      }}
    >
      <button disabled={!visible}>Play</button>
    </div>
  );
};

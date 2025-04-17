import { useLayoutEffect, useRef } from "preact/hooks";
import gameStyleSheet from "./game.css" with { type: "css" };
import { ButtonMuteUnmute } from "/audio/button_mute_unmute.jsx";
import { ButtonPlayPause } from "/audio/button_play_pause.jsx";
import { Box, borderWithStroke } from "/components/box/box.jsx";
import { Curtain } from "/components/curtain/curtain.jsx";
import { Fight } from "/fight/fight.jsx";
import { pauseGame, playGame, useGamePaused } from "/game_pause/game_pause.js";
import { PauseDialog } from "/game_pause/pause_dialog.jsx";

export const Game = () => {
  useLayoutEffect(() => {
    document.adoptedStyleSheets = [
      ...document.adoptedStyleSheets,
      gameStyleSheet,
    ];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (s) => s !== gameStyleSheet,
      );
    };
  }, []);

  const gamePaused = useGamePaused();
  const sceneCurtainRef = useRef();

  return (
    <div style="font-size: 16px;">
      <Box vertical name="screen" width="400" height="400">
        <Box
          name="top_hud"
          width="100%"
          height="10%"
          backgroundColor="red"
          border={borderWithStroke({
            color: "white",
            size: 2,
            strokeColor: "black",
          })}
        >
          <ButtonMuteUnmute />
          <ButtonPlayPause />
        </Box>
        <Fight
          onFightEnd={() => {
            sceneCurtainRef.current.fadeIn();
          }}
        />
        <Curtain ref={sceneCurtainRef} />
        <PauseDialog visible={gamePaused} />
      </Box>
      <div>
        <button
          onClick={() => {
            if (gamePaused) {
              playGame();
            } else {
              pauseGame();
            }
          }}
        >
          {gamePaused ? "play" : "pause"}
        </button>
      </div>
    </div>
  );
};

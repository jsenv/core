import { useGamePaused } from "oto/src/game_pause/game_pause.js";
import { useCallback, useEffect, useRef } from "preact/hooks";

const noop = () => {};

export const useAnimate = ({
  animate,
  onStart = noop,
  onCancel = noop,
  onFinish = noop,
}) => {
  const animationRef = useRef();
  const gamePaused = useGamePaused();

  const play = useCallback(() => {
    if (animationRef.current) {
      animationRef.current.play();
      onStart();
      return animationRef.current.finished;
    }
    const animation = animate();
    animationRef.current = animation;
    animation.oncancel = () => {
      animationRef.current = null;
      onCancel();
    };
    animation.onfinish = () => {
      animationRef.current = null;
      onFinish();
    };
    onStart();
    return animation.finished;
  }, [animate, onStart, onCancel, onFinish]);
  const pause = useCallback(() => {
    const animation = animationRef.current;
    if (!animation) {
      return;
    }
    animation.pause();
  }, []);
  const cancel = useCallback(() => {
    const animation = animationRef.current;
    if (!animation) {
      return;
    }
    if (animation.playState !== "finished") {
      animation.cancel();
    }
  }, []);

  useEffect(() => {
    return () => {
      cancel();
    };
  }, [cancel]);

  useEffect(() => {
    if (!animationRef.current) {
      return;
    }
    if (gamePaused) {
      pause();
    } else {
      play();
    }
  }, [gamePaused]);

  return [play, pause, cancel];
};

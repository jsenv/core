import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { useVisualContentPlaybackIsPrevented } from "/playback/visual_content_playback.js";

export const useFrame = (frames, { msBetweenFrames = 350, loop } = {}) => {
  const intervalRef = useRef();
  const frameIndexRef = useRef(0);
  const playStateRef = useRef("idle");
  const visualContentPlaybackIsPrevented =
    useVisualContentPlaybackIsPrevented();
  const [frame, frameSetter] = useState(frames[0]);
  const play = useCallback(() => {
    if (playStateRef.current === "running") {
      return;
    }
    if (playStateRef.current === "paused") {
    } else {
      frameIndexRef.current = 0;
    }
    playStateRef.current = "running";
    frameSetter(frames[frameIndexRef.current]);
    intervalRef.current = setInterval(() => {
      const frameIndex = frameIndexRef.current;
      if (frameIndex === frames.length - 1) {
        if (loop) {
          frameIndexRef.current = 0;
          frameSetter(frames[0]);
        } else {
          clearInterval(intervalRef.current);
        }
      } else {
        frameIndexRef.current++;
        frameSetter(frames[frameIndex + 1]);
      }
    }, msBetweenFrames);
  }, [...frames, msBetweenFrames, loop]);
  const pause = useCallback(() => {
    if (playStateRef.current === "paused") return;
    playStateRef.current = "paused";
    clearInterval(intervalRef.current);
  }, []);

  useEffect(() => {
    if (visualContentPlaybackIsPrevented) {
      pause();
    } else {
      play();
    }
  }, [visualContentPlaybackIsPrevented]);

  return [frame, play, pause];
};

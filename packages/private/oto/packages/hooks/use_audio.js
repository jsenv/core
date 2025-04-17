import { useCallback, useEffect, useRef, useState } from "preact/hooks";

const { userActivation } = window.navigator;

export const useAudio = ({
  url,
  volume = 1,
  autoplay,
  loop,
  startTime = 0,
  restartOnPlay = !loop,
}) => {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);

  if (audioRef.current === null) {
    const audio = new Audio(url);
    audio.volume = volume;
    audio.loop = loop;
    audio.autoplay = autoplay;
    if (startTime) {
      audio.currentTime = startTime;
    }
    audioRef.current = audio;
  }

  useEffect(() => {
    const audio = audioRef.current;
    audio.addEventListener("ended", () => setPlaying(false));
    audio.addEventListener("abort", () => {});
    return () => {
      audio.removeEventListener("ended", () => setPlaying(false));
      audio.pause();
      audioRef.current = null;
    };
  }, []);

  const play = useCallback(() => {
    const canPlaySound =
      userActivation.hasBeenActive || userActivation.isActive;
    if (!canPlaySound) {
      return;
    }
    const audio = audioRef.current;
    if (restartOnPlay) {
      audio.currentTime = startTime;
    }
    audio.play();
  }, [restartOnPlay, startTime]);
  const pause = useCallback(() => {
    const audio = audioRef.current;
    audio.pause();
  }, []);

  const mute = useCallback(() => {
    const audio = audioRef.current;
    audio.muted = true;
  }, []);
  const unmute = useCallback(() => {
    const audio = audioRef.current;
    audio.muted = false;
  }, []);

  return {
    play,
    pause,
    playing,
    mute,
    unmute,
    audio: audioRef.current,
  };
};

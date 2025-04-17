import { useEffect } from "preact/hooks";
import { useSubscription } from "/utils/use_subscription.js";

export const useAudio = (media) => {
  const { play, pause } = media;

  useEffect(() => {
    return () => {
      media.pause();
    };
  }, []);

  return [play, pause];
};

export const useMuted = (media) => {
  const { audio } = media;
  return useSubscription(
    () => audio.muted,
    (onchange) => {
      audio.addEventListener("volumechange", onchange);
      return () => {
        audio.removeEventListener("volumechange", onchange);
      };
    },
  );
};

export const useVolume = (media) => {
  const { audio } = media;
  return useSubscription(
    () => audio.volume,
    (onchange) => {
      audio.addEventListener("volumechange", onchange);
      return () => {
        audio.removeEventListener("volumechange", onchange);
      };
    },
  );
};

export const usePlaybackState = (media) => {
  const { audio } = media;
  return useSubscription(
    () => {
      if (audio.paused) {
        return "paused";
      }
      return "playing";
    },
    (onchange) => {
      audio.addEventListener("play", onchange);
      audio.addEventListener("pause", onchange);
      return () => {
        audio.removeEventListener("play", onchange);
        audio.removeEventListener("pause", onchange);
      };
    },
  );
};

export const useIsPlaying = (media) => {
  return usePlaybackState(media) === "playing";
};
export const useIsPaused = (media) => {
  return usePlaybackState(media) === "paused";
};

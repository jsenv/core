import { computed, effect, signal } from "@preact/signals";
import {
  musicGlobalVolumeSignal,
  musicsAllMutedSignal,
  musicsAllPausedSignal,
  playOneAtATimeSignal,
} from "./music_global_controls.js";
import { animateNumber } from "/animations/number/animate_number.js";
import { EASING } from "/animations/utils/easing.js";
import { documentHiddenSignal } from "/utils/document_visibility.js";
import { userActivationSignal } from "/utils/user_activation.js";

let debug = false;
const fadeInDefaults = {
  duration: 600,
  easing: EASING.EASE_IN_EXPO,
};
const fadeOutDefaults = {
  duration: 1500,
  easing: EASING.EASE_OUT_EXPO,
};

const NO_OP = () => {};
const musicSet = new Set();

let activeMusic = null;
let previousActiveMusic = null;
export const music = ({
  name,
  url,
  startTime = 0,
  volume = 1,
  loop = true,
  autoplay = false,
  restartOnPlay,
  canPlayWhilePaused,
  muted,
  volumeAnimation = true,
  fadeIn = true,
  fadeOut = true,
}) => {
  if (fadeIn === true) {
    fadeIn = {};
  }
  if (fadeOut === true) {
    fadeOut = {};
  }
  const musicObject = {};

  const audio = new Audio(url);
  audio.loop = loop;
  if (startTime) {
    audio.currentTime = startTime;
  }

  init_volume: {
    const volumeAnimatedSignal = signal();
    const volumeRequestedSignal = signal(volume);
    const volumeSignal = computed(() => {
      const musicGlobalVolume = musicGlobalVolumeSignal.value;
      const volumeAnimated = volumeAnimatedSignal.value;
      const volumeRequested = volumeRequestedSignal.value;
      const volumeToSet =
        volumeAnimated === undefined ? volumeRequested : volumeAnimated;
      const volumeToSetResolved = volumeToSet * musicGlobalVolume;
      // if (debug) {
      //   console.log({ volume, volumeAnimated, volumeToSetResolved });
      // }
      return volumeToSetResolved;
    });
    effect(() => {
      const volume = volumeSignal.value;
      audio.volume = volume;
    });

    let removeVolumeAnimation = NO_OP;
    const animateVolume = ({
      from,
      to,
      onremove = NO_OP,
      onfinish = NO_OP,
      ...rest
    }) => {
      if (debug) {
        console.log("animate", from, to);
      }
      removeVolumeAnimation();
      const volumeAnimation = animateNumber(from, to, {
        // when doc is hidden the browser won't let the animation run
        // and onfinish() won't be called -> audio won't pause
        isAudio: true,
        ...rest,
        effect: (volumeValue) => {
          volumeAnimatedSignal.value = volumeValue;
        },
        onremove: () => {
          volumeAnimatedSignal.value = undefined;
          removeVolumeAnimation = NO_OP;
          onremove();
        },
        onfinish: () => {
          removeVolumeAnimation = NO_OP;
          onfinish();
        },
      });
      removeVolumeAnimation = () => {
        volumeAnimation.remove();
      };
      return volumeAnimation;
    };

    const fadeInVolume = (params) => {
      return animateVolume({
        ...fadeInDefaults,
        ...fadeIn,
        from: 0,
        to: volumeRequestedSignal.peek(),
        ...params,
      });
    };
    const fadeOutVolume = (params) => {
      return animateVolume({
        ...fadeOutDefaults,
        ...fadeOut,
        from: volumeSignal.peek(),
        to: 0,
        ...params,
      });
    };

    const setVolume = (
      value,
      { animated = volumeAnimation, duration = 500 } = {},
    ) => {
      if (debug) {
        console.log("set volume", value);
      }
      removeVolumeAnimation();
      if (!animated) {
        volumeRequestedSignal.value = value;
        return;
      }
      const from = volumeSignal.peek();
      const to = value;
      animateVolume({
        from,
        to,
        duration,
        easing: EASING.EASE_OUT_EXPO,
        onstart: () => {
          volumeRequestedSignal.value = value;
        },
        onremove: () => {
          volumeAnimatedSignal.value = undefined;
        },
        onfinish: () => {
          volumeAnimatedSignal.value = undefined;
        },
      });
    };

    Object.assign(musicObject, {
      volumeSignal,
      volumeRequestedSignal,
      setVolume,
      fadeInVolume,
      fadeOutVolume,
      removeVolumeAnimation: () => {
        removeVolumeAnimation();
      },
    });
  }

  init_muted: {
    const muteRequestedSignal = signal(muted);
    const mute = () => {
      muteRequestedSignal.value = true;
    };
    const unmute = () => {
      muteRequestedSignal.value = false;
    };
    effect(() => {
      const musicsAllMuted = musicsAllMutedSignal.value;
      const muteRequested = muteRequestedSignal.value;
      const shouldMute = musicsAllMuted || muteRequested;
      if (shouldMute) {
        audio.muted = true;
      } else {
        audio.muted = false;
      }
    });
    Object.assign(musicObject, {
      muteRequestedSignal,
      mute,
      unmute,
    });
  }

  init_paused: {
    let volumeFadeoutThenPauseAnimation = null;
    const handleShouldBePaused = () => {
      if (audio.paused) {
        return;
      }
      if (!fadeOut) {
        audio.pause();
        return;
      }
      if (debug) {
        console.log("start fadeout then pause");
      }
      // volume fadeout then pause
      volumeFadeoutThenPauseAnimation = musicObject.fadeOutVolume({
        onremove: () => {
          if (debug) {
            console.log("remove fadeout then pause -> pause");
          }
          volumeFadeoutThenPauseAnimation = null;
          // audio.pause();
        },
        onfinish: () => {
          if (debug) {
            console.log("finish fadeout -> pause");
          }
          volumeFadeoutThenPauseAnimation = null;
          audio.pause();
        },
      });
    };
    const handleShouldBePlaying = async () => {
      if (playOneAtATimeSignal.peek() && playRequestedSignal.value) {
        if (activeMusic && activeMusic !== musicObject) {
          const musicToReplace = activeMusic;
          musicToReplace.pauseRequestedByActiveMusicSignal.value = true;
          previousActiveMusic = musicToReplace;
        }
        activeMusic = musicObject;
      }

      if (volumeFadeoutThenPauseAnimation) {
        volumeFadeoutThenPauseAnimation.remove();
      }
      if (!audio.paused) {
        return;
      }
      if (restartOnPlay) {
        audio.currentTime = startTime;
      }
      if (!fadeIn) {
        try {
          await audio.play();
        } catch {}
        return;
      }
      musicObject.fadeInVolume({
        onstart: async () => {
          try {
            await audio.play();
          } catch {}
        },
      });
    };

    const playRequestedSignal = signal(autoplay);
    const pauseRequestedByActiveMusicSignal = signal(false);
    effect(() => {
      const documentHidden = documentHiddenSignal.value;
      const userActivation = userActivationSignal.value;
      const musicsAllPaused = musicsAllPausedSignal.value;
      const playRequested = playRequestedSignal.value;
      const pauseRequestedByActiveMusic =
        pauseRequestedByActiveMusicSignal.value;
      const shouldPlay =
        playRequested &&
        !documentHidden &&
        userActivation !== "inactive" &&
        !musicsAllPaused &&
        !pauseRequestedByActiveMusic;
      if (shouldPlay) {
        handleShouldBePlaying();
      } else {
        handleShouldBePaused();
      }
    });

    const play = () => {
      playRequestedSignal.value = true;
      pauseRequestedByActiveMusicSignal.value = false;
    };
    const pause = () => {
      playRequestedSignal.value = false;
      if (playOneAtATimeSignal.peek()) {
        if (musicObject === activeMusic) {
          activeMusic = null;
          if (previousActiveMusic) {
            const musicToReplay = previousActiveMusic;
            previousActiveMusic = null;
            musicToReplay.pauseRequestedByActiveMusicSignal.value = false;
          }
        } else if (musicObject === previousActiveMusic) {
          previousActiveMusic = null;
        }
      }
    };

    Object.assign(musicObject, {
      playRequestedSignal,
      pauseRequestedByActiveMusicSignal,
      play,
      pause,
    });
  }

  Object.assign(musicObject, {
    audio,
    canPlayWhilePaused,
    name,
    url,
    volumeAtStart: volume,
  });
  musicSet.add(musicObject);
  return musicObject;
};

export const useReasonsToBeMuted = (music) => {
  const reasons = [];
  const musicsAllMuted = musicsAllMutedSignal.value;
  const muteRequested = music.mutedRequestedSignal.value;
  if (musicsAllMuted) {
    reasons.push("globally_muted");
  }
  if (muteRequested) {
    reasons.push("mute_requested");
  }
  return reasons;
};
export const useReasonsToBePaused = (music) => {
  const reasons = [];
  const documentHidden = documentHiddenSignal.value;
  const userActivation = userActivationSignal.value;
  const musicAllPaused = musicsAllPausedSignal.value;
  const playRequested = music.playRequestedSignal.value;
  if (documentHidden) {
    reasons.push("document_hidden");
  }
  if (!userActivation) {
    reasons.push("user_inactive");
  }
  if (!playRequested) {
    reasons.push("play_not_requested");
  }
  if (musicAllPaused) {
    reasons.push("globally_paused");
  }
  return reasons;
};

// const pauseMusicUrl = import.meta.resolve("./pause.mp3");
// const pauseMusic = music({
//   name: "pause",
//   url: pauseMusicUrl,
//   volume: 0.2,
//   restartOnPlay: true,
//   canPlayWhilePaused: true,
// });
// pauseMusic.play();
// effect(() => {
//   if (audioPausedSignal.value) {
//     pauseMusic.play();
//   } else {
//     pauseMusic.pause();
//   }
// });

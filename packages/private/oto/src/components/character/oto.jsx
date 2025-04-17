import { useFrame } from "oto/src/animations/hooks/use_frame.js";
import { forwardRef } from "preact/compat";
import { useLayoutEffect } from "preact/hooks";

const otoWalkASvgUrl = new URL("./oto_1.svg", import.meta.url);
const otoWalkBSvgUrl = new URL("./oto_2.svg", import.meta.url);

export const Oto = forwardRef(
  (
    {
      activity = "", // 'walking', 'jumping', 'pushing', 'wondering'
      animate = true,
    },
    ref,
  ) => {
    const hasAnimation = activity !== "";
    const [frame, playFrameAnimation, pauseFrameAnimation] = useFrame(
      ["a", "b"],
      { loop: true },
    );
    useLayoutEffect(() => {
      if (!animate || !hasAnimation) return () => {};
      playFrameAnimation();
      return pauseFrameAnimation;
    }, [animate, hasAnimation, playFrameAnimation, pauseFrameAnimation]);
    const url = frame === "a" ? otoWalkASvgUrl : otoWalkBSvgUrl;

    return <img ref={ref} width="100%" height="auto" src={url}></img>;
  },
);

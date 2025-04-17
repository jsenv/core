import { useFrame } from "oto/src/animations/hooks/use_frame.js";
import { Img } from "oto/src/components/img/img.jsx";
import { forwardRef } from "preact/compat";
import { useLayoutEffect } from "preact/hooks";

const characterSpritesheetUrl = new URL(
  "./character_spritesheet.png",
  import.meta.url,
);

const HERO_STATE_CELL = {
  walking_bottom_a: { x: 0 + 9, y: 0 + 17 },
  walking_bottom_b: { x: 17 + 9, y: 0 + 17 },
  walking_left_a: { x: 17 * 2 + 9, y: 0 + 17 },
  walking_left_b: { x: 17 * 3 + 9, y: 0 + 17 },
  walking_top_a: { x: 17 * 4 + 9, y: 0 + 17 },
  walking_top_b: { x: 17 * 5 + 9, y: 0 + 17 },
  walking_right_a: { x: 17 * 2 + 9, y: 0 + 17, mirrorX: true },
  walking_right_b: { x: 17 * 3 + 9, y: 0 + 17, mirrorX: true },
};

export const Benjamin = forwardRef(
  (
    {
      direction = "top",
      activity = "", // 'walking', 'jumping', 'pushing', 'wondering'
      animate = true,
      ...props
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
    const { x, y, mirrorX, mirrorY } =
      HERO_STATE_CELL[`${activity}_${direction}_${frame}`];

    return (
      <Img
        ref={ref}
        name="benjamin"
        source={{
          url: characterSpritesheetUrl,
          x,
          y,
          mirrorX,
          mirrorY,
          transparentColor: [
            [0, 206, 206],
            [0, 155, 155],
          ],
        }}
        width="17"
        height="17"
        {...props}
      />
    );
  },
);

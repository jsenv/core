import { Img } from "oto/src/components/img/img.jsx";
import { forwardRef } from "preact/compat";

const battleBackgroundsSpritesheetUrl = new URL(
  "./battle_background_spritesheet.png",
  import.meta.url,
);

export const MountainAndSkyBattleBackground = forwardRef((props, ref) => {
  return (
    <Img
      ref={ref}
      name="mountain_and_sky"
      source={{
        url: battleBackgroundsSpritesheetUrl,
        x: 260 * 1 + 5,
        y: 100 * 0 + 1,
      }}
      width="254"
      height="200"
      {...props}
    />
  );
});

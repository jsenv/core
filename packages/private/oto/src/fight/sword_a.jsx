import { Img } from "oto/src/components/img/img.jsx";
import { forwardRef } from "preact/compat";

const weaponSpriteSheetUrl = new URL("./weapon.png", import.meta.url);

const WEAPON_CELLS = {
  sword_a: { x: 195, y: 265, width: 64, height: 64 },
};

export const SwordAImg = forwardRef((props, ref) => {
  const { x, y, width, height } = WEAPON_CELLS[`sword_a`];

  return (
    <Img
      ref={ref}
      name="sword_a"
      source={{
        url: weaponSpriteSheetUrl,
        x,
        y,
      }}
      width={width}
      height={height}
      {...props}
    />
  );
});

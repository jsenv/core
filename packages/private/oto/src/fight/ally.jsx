import { forwardRef } from "preact/compat";
import { useImperativeHandle, useRef, useState } from "preact/hooks";
import { animateDamageDisplay } from "/animations/damage/damage.js";
import { animateElement } from "/animations/element/animate_element.js";
import { animateRecoilAfterHit } from "/animations/recoil_after_hit.js";
import { Box } from "/components/box/box.jsx";
import { Oto } from "/components/character/oto.jsx";
import { Digits } from "/components/text/digits.jsx";

export const Ally = forwardRef((props, ref) => {
  const elementRef = useRef();
  const [damage, damageSetter] = useState(null);
  const digitsElementRef = useRef();

  useImperativeHandle(ref, () => {
    return {
      moveToAct: async () => {
        await animateElement(elementRef.current, {
          id: "ally_move_to_act",
          to: {
            y: -20,
          },
          duration: 200,
        }).finished;
      },
      moveBackToPosition: async () => {
        await animateElement(elementRef.current, {
          id: "ally_move_back_to_position",
          to: {
            y: 0,
          },
          duration: 200,
        }).finished;
      },
      recoilAfterHit: async () => {
        await animateRecoilAfterHit(elementRef.current, {
          duration: 500,
        }).finished;
      },
      displayDamage: async (value) => {
        damageSetter(value);
        await animateDamageDisplay(digitsElementRef.current, {
          duration: 300,
          toY: -1.2,
        }).finished;
      },
    };
  });

  return (
    <Box name="ally_box" ratio="1/1" height="100%" x="center">
      <Oto ref={elementRef} direction="top" activity="walking" />
      <Box
        ref={digitsElementRef}
        name="digits_box"
        absolute
        hidden={damage === null}
        width="100%"
        height="100%"
      >
        <Box x="center" y="end">
          <Digits
            name="digits"
            dx="0.3em" // for some reason it's better centered with that
          >
            {damage}
          </Digits>
        </Box>
      </Box>
    </Box>
  );
});

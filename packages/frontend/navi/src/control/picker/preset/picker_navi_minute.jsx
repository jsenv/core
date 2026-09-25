import { Box } from "@jsenv/navi/src/box/box.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Button } from "../../input/button.jsx";
import { InputTextual } from "../../input/input_textual.jsx";

/**
 * PickerNaviMinute — a custom minute picker that opens a number input.
 *
 * Renders a popover containing an `<input type="number">` pre-filled with the
 * current value, plus Confirm / Clear / Cancel actions. The picker holds a
 * number of minutes: its own field is a text one told
 * `navi-input-type="minute"`, so the value is read back as a number and a
 * min/max/step message speaks of minutes.
 *
 * Usage:
 *   <Picker type="navi_minute" min={15} max={300} step={15} value={90} />
 */
export const PickerNaviMinute = (props) => {
  const Next = useNextResolver();
  const { min, max, step, value } = props;

  // resolveInputProps has already run (PickerFirstResolver), so the type
  // handed on is one the picker renders as is — the text field a navi numeric
  // type resolves to, told what its value is.
  return (
    <Next {...props} type="text" navi-input-type="minute">
      <Box flex="y" spacing="s" padding="s">
        <InputTextual
          type="number"
          command="--navi-update"
          min={min}
          max={max}
          step={step}
          value={value}
        />
        <Box flex spacing="s">
          <Button command="--navi-send">Confirmer</Button>
          <Button command="--navi-clear">Vider</Button>
          <Button command="--navi-cancel">Annuler</Button>
        </Box>
      </Box>
    </Next>
  );
};

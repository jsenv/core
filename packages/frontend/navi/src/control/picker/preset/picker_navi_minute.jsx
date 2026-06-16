import { Box } from "@jsenv/navi/src/box/box.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Button } from "../../input/button.jsx";
import { InputTextual } from "../../input/input_textual.jsx";

/**
 * PickerNaviMinute — a custom minute picker that opens a number input.
 *
 * Renders a popover containing an `<input type="number">` pre-filled with the
 * current value, plus Confirm / Clear / Cancel actions.
 *
 * Usage:
 *   <Picker type="navi_minute" min={15} max={300} step={15} value={90} />
 */
export const PickerNaviMinute = (props) => {
  const Next = useNextResolver();
  const { min, max, step, value } = props;

  return (
    <Next {...props} type="minute">
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

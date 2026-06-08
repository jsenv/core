import { useMemo } from "preact/hooks";

import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { List } from "../../list/list.jsx";
import { parseStepToSeconds } from "../time_helpers.js";

/**
 * PickerNaviTime — a fully custom time picker driven by min/max/step.
 *
 * Unlike the native `<input type="time">`, this picker only exposes the exact
 * slots generated from min/max/step, so the user can never pick an out-of-range
 * or out-of-step value. The popover content is a `SelectableList` of the
 * available slots; picking one closes the popover and submits the value.
 *
 * Usage:
 *   <Picker type="navi_time" min="08:00" max="18:00" step="00:30" />
 */
export const PickerNaviTime = (props) => {
  const Next = useNextResolver();
  const { min = "00:00", max = "23:30", step, value } = props;
  const stepSeconds = parseStepToSeconds(step) ?? 1800;
  const slots = useMemo(
    () => generateTimeSlots(min, max, stepSeconds),
    [min, max, stepSeconds],
  );

  return (
    <Next {...props} type="time">
      <List selectable action="send">
        {slots.map((slot, i) => (
          <List.Item
            selectable
            key={slot}
            id={slot}
            index={i}
            value={slot}
            selected={value === slot}
          >
            <Time type="time">{slot}</Time>
          </List.Item>
        ))}
      </List>
    </Next>
  );
};

const generateTimeSlots = (min, max, stepSeconds) => {
  const slots = [];
  const [minH, minM] = min.split(":").map(Number);
  const [maxH, maxM] = max.split(":").map(Number);
  const stepMinutes = Math.round(stepSeconds / 60);
  let current = minH * 60 + minM;
  const end = maxH * 60 + maxM;
  while (current <= end) {
    const h = Math.floor(current / 60);
    const m = current % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    current += stepMinutes;
  }
  return slots;
};

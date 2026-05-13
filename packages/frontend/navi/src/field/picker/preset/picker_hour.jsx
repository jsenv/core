import { useMemo } from "preact/hooks";

import { Box } from "@jsenv/navi/src/box/box.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { List, ListItem } from "../../list/list.jsx";
import { Select } from "../../select/select.jsx";
import { parseStepToSeconds } from "../time_helpers.js";

/**
 * HourPicker — a Select-based time slot picker.
 *
 * Unlike the native time Picker, HourPicker only exposes the exact slots
 * generated from min/max/step, so the user can never pick an out-of-range time.
 *
 * Props:
 *   min           — earliest slot as "HH:MM" string (e.g. "07:00")
 *   max           — latest slot as "HH:MM" string (e.g. "21:00")
 *   step          — interval in seconds between slots (e.g. 1800 = 30 min)
 *   selectedDay        — date string "YYYY-MM-DD"; when equal to today, past slots are disabled
 *   minReadonly        — "HH:MM" threshold: slots at or before this time are disabled
 *   minReadonlyMessage — message shown in the list footer when a readonly slot is clicked
 *   noSlotsMessage     — text shown when all slots are disabled
 *   value / uiAction / name / placeholder / required / disabled — forwarded to Select
 */
export const PickerHour = ({
  min = "00:00",
  max = "23:30",
  step: stepProp = 1800,
  selectedDay,
  minHidden,
  minReadonly,
  minReadonlyMessage,
  noSlotsMessage,
  value,
  uiAction,
  placeholder,
  ...rest
}) => {
  const step = parseStepToSeconds(stepProp);
  const slots = useMemo(() => {
    const allSlots = generateTimeSlots(min, max, step);
    if (!minHidden) {
      return allSlots;
    }
    const [hh, mm] = minHidden.split(":").map(Number);
    const minHiddenMinutes = hh * 60 + mm;
    return allSlots.filter((slot) => {
      const [sh, sm] = slot.split(":").map(Number);
      return sh * 60 + sm >= minHiddenMinutes;
    });
  }, [min, max, step, minHidden]);

  const todayStr = toDateString(new Date());
  const now = new Date();
  const nowMinutes =
    selectedDay === todayStr ? now.getHours() * 60 + now.getMinutes() : -1;

  const minReadonlyMinutes = useMemo(() => {
    if (minReadonly) {
      const [h, m] = minReadonly.split(":").map(Number);
      return h * 60 + m;
    }
    return nowMinutes;
  }, [minReadonly, nowMinutes]);

  const isSlotReadonly = (slot) => {
    if (minReadonlyMinutes === -1) {
      return false;
    }
    const [h, m] = slot.split(":").map(Number);
    return h * 60 + m <= minReadonlyMinutes;
  };

  const allDisabled = slots.length > 0 && slots.every(isSlotReadonly);

  if (allDisabled) {
    return (
      <Box
        as="span"
        style={{
          fontSize: "0.85em",
          color: "color-mix(in srgb, currentColor 60%, transparent)",
          fontStyle: "italic",
        }}
      >
        {noSlotsMessage ?? naviI18n("picker.hour.no_slots")}
      </Box>
    );
  }

  return (
    <Select
      value={value}
      uiAction={uiAction}
      placeholder={placeholder}
      {...rest}
    >
      <List role="listbox">
        {slots.map((slot, i) => (
          <ListItem
            key={slot}
            index={i}
            id={slot}
            value={slot}
            selected={value === slot}
            readOnly={isSlotReadonly(slot)}
            data-readonly-message={
              minReadonlyMessage ?? naviI18n("picker.hour.readonly_slot")
            }
          >
            {slot}
          </ListItem>
        ))}
      </List>
    </Select>
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

const toDateString = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

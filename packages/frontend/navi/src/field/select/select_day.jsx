import { useSignal } from "@preact/signals";
import { useContext } from "preact/hooks";

import { Text } from "@jsenv/navi/src/text/text.jsx";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { Input } from "../input/input.jsx";
import { List, ListItem, requestListItemSelect } from "../list/list.jsx";
import { UIStateControllerContext } from "../use_ui_state_controller.js";

export const SelectDay = (props) => {
  const {
    min,
    max,
    maxLength = 10,
    custom: forceCustom,
    value,
    placeholder = "Choisir un jour",
    SelectDispatcher,
    ...rest
  } = props;

  const minDate = startOfDay(min ?? new Date());
  const minDateString = toDateString(minDate);

  let daysToShow;
  let showCustomPicker;
  if (max) {
    const maxDate = startOfDay(max);
    const totalDays = dateDiffInDays(minDate, maxDate) + 1;
    if (totalDays > maxLength) {
      daysToShow = maxLength;
      showCustomPicker = true;
    } else {
      daysToShow = totalDays;
      showCustomPicker = forceCustom || false;
    }
  } else {
    daysToShow = maxLength;
    showCustomPicker = forceCustom || false;
  }

  const dayOptions = buildDayOptions(minDate, daysToShow);
  const fixedDateStrings = dayOptions.map((o) => o.dateString);
  const staticDateStringSet = new Set(fixedDateStrings);

  return (
    <SelectDispatcher
      placeholder={placeholder}
      value={value}
      {...rest}
      type={undefined}
    >
      <List expandX>
        {dayOptions.map(({ dateString }, index) => (
          <DayOption
            key={dateString}
            value={dateString}
            index={index}
            id={dateString}
            selected={value === dateString}
          >
            <Time type="day" capitalize>
              {dateString}
            </Time>
          </DayOption>
        ))}
        {showCustomPicker && (
          <CustomDayOption
            value={value}
            index={dayOptions.length}
            minDateString={minDateString}
            staticDateStringSet={staticDateStringSet}
          />
        )}
      </List>
    </SelectDispatcher>
  );
};

const DayOption = ({ children, ...rest }) => {
  return (
    <ListItem paddingX="s" paddingY="m" {...rest}>
      {children}
    </ListItem>
  );
};

const CustomDayOption = ({
  value,
  index,
  minDateString,
  staticDateStringSet,
}) => {
  const isValueInFixed = staticDateStringSet.has(value);
  const initialCustomDateString = value && !isValueInFixed ? value : undefined;
  const customDateStringSignal = useSignal(initialCustomDateString);
  const customDateString = customDateStringSignal.value;
  const hasCustom = customDateStringSignal.value !== undefined;

  const listUIStateController = useContext(UIStateControllerContext);

  const onDatePicked = (dateString, e) => {
    if (!dateString) {
      // user clicked "effacer" on the date picker
      customDateStringSignal.value = undefined;
      listUIStateController.setUIState("", e);
      return;
    }
    if (staticDateStringSet.has(dateString)) {
      customDateStringSignal.value = undefined;
      const itemEl = document.getElementById(dateString);
      if (itemEl) {
        requestListItemSelect(itemEl, { event: e });
      }
    } else {
      customDateStringSignal.value = dateString;
      const itemEl = document.getElementById("custom_display");
      if (itemEl) {
        requestListItemSelect(itemEl, { event: e });
      }
    }
  };

  return (
    <>
      <DayOption
        id="custom_display"
        index={index}
        value={customDateStringSignal}
        hidden={!hasCustom}
        selected={value === customDateString}
      >
        <Time type="day" capitalize>
          {customDateString}
        </Time>
      </DayOption>
      <DayOption id="custom_pick" index={index + 1} value="custom" relative>
        <Text>Choisir un autre jour…</Text>
        <Input
          type="date"
          value={customDateString}
          min={minDateString}
          uiAction={onDatePicked}
          onMouseDown={(e) => {
            if (e.button !== 0) {
              return;
            }
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.showPicker();
          }}
          absolute
          inset
          expand
          opacity={0}
          tabIndex={-1}
        />
      </DayOption>
    </>
  );
};

const buildDayOptions = (minDate, count) => {
  const options = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(minDate);
    d.setDate(minDate.getDate() + i);
    const dateString = toDateString(d);
    options.push({ dateString });
  }
  return options;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const dateDiffInDays = (a, b) => Math.round((b - a) / MS_PER_DAY);

const MS_PER_DAY = 86_400_000;

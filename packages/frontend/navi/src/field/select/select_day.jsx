import { useState } from "preact/hooks";

import { Text } from "@jsenv/navi/src/text/text.jsx";
import { Input } from "../input/input.jsx";
import { List, ListItem } from "../list/list.jsx";

export const SelectDay = (props) => {
  const {
    min,
    max,
    maxLength = 10,
    custom: forceCustom,
    locale = "fr-FR",
    value,
    placeholder = "Choisir un jour",
    SelectDispatcher,
    ...rest
  } = props;

  const minDate = startOfDay(min ?? new Date());
  const minKey = toDateKey(minDate);
  const todayKey = toDateKey(startOfDay(new Date()));
  const minIsToday = minKey === todayKey;

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

  const dayOptions = buildDayOptions(minDate, daysToShow, locale, minIsToday);

  return (
    <SelectDispatcher
      placeholder={placeholder}
      value={value}
      {...rest}
      type={undefined}
    >
      <List expandX>
        {dayOptions.map(({ key, label }, index) => (
          <DayOption
            key={key}
            value={key}
            index={index}
            id={key}
            selected={value === key}
          >
            <Text capitalize>{label}</Text>
          </DayOption>
        ))}
        {showCustomPicker && (
          <CustomDayOption
            value={value}
            index={dayOptions.length}
            minKey={minKey}
            locale={locale}
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

const CustomDayOption = ({ value, index, minKey, locale }) => {
  const fixedOptions = buildDayOptions(
    dateKeyToDate(minKey),
    index,
    locale,
    false,
  );
  const isValueInFixed = fixedOptions.some((o) => o.key === value);
  const initialCustomKey =
    value && value !== "custom" && !isValueInFixed ? value : null;
  const [customKey, setCustomKey] = useState(initialCustomKey);
  const hasCustom = customKey !== null;

  return (
    <>
      {hasCustom && (
        <DayOption
          id="custom_display"
          index={index}
          value={customKey}
          selected={value === customKey}
        >
          <Text capitalize>
            {dateKeyToDate(customKey).toLocaleDateString(locale, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </Text>
        </DayOption>
      )}
      <DayOption
        id="custom_pick"
        index={hasCustom ? index + 1 : index}
        value="custom"
        relative
      >
        <Text>Choisir un autre jour…</Text>
        <Input
          type="date"
          value={hasCustom ? customKey : undefined}
          min={minKey}
          uiAction={(newKey) => {
            setCustomKey(newKey);
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.showPicker();
          }}
          absolute
          inset
          expand
          opacity={0}
          cursor="pointer"
        />
      </DayOption>
    </>
  );
};

const buildDayOptions = (minDate, count, locale, minIsToday) => {
  const options = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(minDate);
    d.setDate(minDate.getDate() + i);
    const key = toDateKey(d);
    const baseLabel = d.toLocaleDateString(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    let label = baseLabel;
    if (minIsToday) {
      if (i === 0) {
        label = `${baseLabel} (aujourd'hui)`;
      } else if (i === 1) {
        label = `${baseLabel} (demain)`;
      }
    }
    options.push({ key, label });
  }
  return options;
};

const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const dateKeyToDate = (dateKey) => new Date(`${dateKey}T00:00:00`);

const dateDiffInDays = (a, b) => Math.round((b - a) / MS_PER_DAY);

const MS_PER_DAY = 86_400_000;

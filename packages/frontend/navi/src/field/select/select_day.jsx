import { dispatchCustomEvent } from "@jsenv/dom";
import { useSignal } from "@preact/signals";
import { useRef } from "preact/hooks";

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
  const minDateString = toDateString(minDate);
  const todayDateString = toDateString(startOfDay(new Date()));
  const minIsToday = minDateString === todayDateString;

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
  const fixedDateStrings = dayOptions.map((o) => o.dateString);
  const staticDateStringSet = new Set(fixedDateStrings);
  const listRef = useRef(null);

  return (
    <SelectDispatcher
      placeholder={placeholder}
      value={value}
      {...rest}
      type={undefined}
    >
      <List ref={listRef} expandX>
        {dayOptions.map(({ dateString, label }, index) => (
          <DayOption
            key={dateString}
            value={dateString}
            index={index}
            id={dateString}
            selected={value === dateString}
          >
            <Text capitalize>{label}</Text>
          </DayOption>
        ))}
        {showCustomPicker && (
          <CustomDayOption
            value={value}
            index={dayOptions.length}
            minDateString={minDateString}
            locale={locale}
            staticDateStringSet={staticDateStringSet}
            listRef={listRef}
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
  locale,
  staticDateStringSet,
  listRef,
}) => {
  const isValueInFixed = staticDateStringSet.has(value);
  const initialCustomDateString =
    value && value !== "custom" && !isValueInFixed ? value : undefined;
  const customDateStringSignal = useSignal(initialCustomDateString);
  const customDateString = customDateStringSignal.value;
  const hasCustom = customDateStringSignal.value !== undefined;

  const onDatePicked = (dateString) => {
    const listEl = listRef.current;
    if (staticDateStringSet.has(dateString)) {
      customDateStringSignal.value = undefined;
      dispatchCustomEvent(listEl, "navi_list_request_select", {
        item: { id: dateString, value: dateString },
        event: { type: "change" },
      });
    } else {
      customDateStringSignal.value = dateString;
      dispatchCustomEvent(listEl, "navi_list_request_select", {
        item: { id: "custom_display", value: dateString },
        event: { type: "change" },
      });
    }
  };

  return (
    <>
      <DayOption
        id="custom_display"
        index={index}
        value={customDateString}
        hidden={!hasCustom}
        selected={value === customDateString}
      >
        <Text capitalize>
          {hasCustom
            ? dateStringToDate(customDateString).toLocaleDateString(locale, {
                weekday: "long",
                day: "numeric",
                month: "long",
              })
            : null}
        </Text>
      </DayOption>
      <DayOption
        id="custom_pick"
        index={hasCustom ? index + 1 : index}
        value="custom"
        relative
      >
        <Text>Choisir un autre jour…</Text>
        <Input
          type="date"
          value={customDateString}
          min={minDateString}
          uiAction={onDatePicked}
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
    const dateString = toDateString(d);
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
    options.push({ dateString, label });
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

const dateStringToDate = (dateString) => new Date(`${dateString}T00:00:00`);

const dateDiffInDays = (a, b) => Math.round((b - a) / MS_PER_DAY);

const MS_PER_DAY = 86_400_000;

import { useContext } from "preact/hooks";

import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Color } from "@jsenv/navi/src/text/color.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { Text } from "@jsenv/navi/src/text/text.jsx";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { PickerPlaceholder } from "./picker_components.jsx";
import { PickerContext } from "./picker_context.jsx";
import { parseStepToSeconds } from "./time_helpers.js";

export const PickerText = (props) => {
  const Next = useNextResolver();
  return <Next icon={<PencilSvg />} {...props} />;
};

export const PickerArray = (props) => {
  const Next = useNextResolver();
  return <Next ui={<PickerArrayUI />} {...props} />;
};
const PickerArrayUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value || value.length === 0) {
    if (!placeholder) {
      return null;
    }
    return <PickerPlaceholder>{placeholder}</PickerPlaceholder>;
  }
  return (
    <Text spacing=", " shrinkWrap>
      {value.map((item) => {
        return <span key={item}>{item}</span>;
      })}
    </Text>
  );
};

export const PickerColor = (props) => {
  const Next = useNextResolver();
  return (
    <Next
      requiredMessage={naviI18n(`picker.required.color`)}
      ui={<PickerColorUI />}
      icon={<ColorSvg />}
      type="color"
      {...props}
    />
  );
};
const PickerColorUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    if (!placeholder) {
      return <Color />;
    }
    return <PickerPlaceholder>{placeholder}</PickerPlaceholder>;
  }
  return <Color>{value}</Color>;
};

export const PickerDay = (props) => {
  const Next = useNextResolver();
  const min = resolveDateProp(props.min, toInputDay);
  const max = resolveDateProp(props.max, toInputDay);

  return (
    <Next
      requiredMessage={naviI18n(`picker.required.day`)}
      ui={<PickerDayUI />}
      icon={<CalendarSvg />}
      min={min}
      max={max}
      type="date"
      {...props}
    />
  );
};
const PickerDayUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    return placeholder ? (
      <PickerPlaceholder>{placeholder}</PickerPlaceholder>
    ) : null;
  }
  return (
    <Time type="day" capitalize>
      {value}
    </Time>
  );
};
const toInputDay = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
export const PickerMonth = (props) => {
  const Next = useNextResolver();
  const min = resolveDateProp(props.min, toInputMonth);
  const max = resolveDateProp(props.max, toInputMonth);

  return (
    <Next
      requiredMessage={naviI18n(`picker.required.month`)}
      ui={<PickerMonthUI />}
      icon={<CalendarSvg />}
      type="month"
      min={min}
      max={max}
      {...props}
    />
  );
};
const PickerMonthUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    return placeholder || null;
  }
  return (
    <Time type="month" capitalize>
      {value}
    </Time>
  );
};
const toInputMonth = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
};
export const PickerWeek = (props) => {
  const Next = useNextResolver();
  const min = resolveDateProp(props.min, toInputWeek);
  const max = resolveDateProp(props.max, toInputWeek);

  return (
    <Next
      requiredMessage={naviI18n(`picker.required.week`)}
      ui={<PickerWeekUI />}
      icon={<CalendarSvg />}
      type="week"
      min={min}
      max={max}
      {...props}
    />
  );
};
const PickerWeekUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    return placeholder || null;
  }
  return (
    <Time type="week" capitalize>
      {value}
    </Time>
  );
};
const toInputWeek = (date) => {
  // ISO week number
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const week =
    Math.round(
      ((d - yearStart) / 86400000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7,
    ) + 1;
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
};
export const PickerTime = (props) => {
  const Next = useNextResolver();
  const min = resolveDateProp(props.min, toInputTime);
  const max = resolveDateProp(props.max, toInputTime);
  const step = parseStepToSeconds(props.step);

  return (
    <Next
      requiredMessage={naviI18n(`picker.required.time`)}
      ui={<PickerTimeUI />}
      icon={<ClockSvg />}
      type="time"
      min={min}
      max={max}
      step={step}
      {...props}
    />
  );
};
const PickerTimeUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    return placeholder || null;
  }
  return <Time type="time">{value}</Time>;
};
const toInputTime = (date) => {
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${hh}:${min}`;
};
export const PickerDatetime = (props) => {
  const Next = useNextResolver();
  const min = resolveDateProp(props.min, toInputDatetime);
  const max = resolveDateProp(props.max, toInputDatetime);
  const step = parseStepToSeconds(props.step);

  return (
    <Next
      requiredMessage={naviI18n(`picker.required.datetime`)}
      ui={<PickerDatetimeUI />}
      icon={<CalendarSvg />}
      type="datetime-local"
      min={min}
      max={max}
      step={step}
      {...props}
    />
  );
};
const PickerDatetimeUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    return placeholder || null;
  }
  return <Time type="datetime">{value}</Time>;
};
const toInputDatetime = (date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

export const PickerFile = (props) => {
  const Next = useNextResolver();
  const requiredMessage = props.multiple
    ? naviI18n(`picker.required.file.multiple`)
    : naviI18n(`picker.required.file`);
  return (
    <Next
      requiredMessage={requiredMessage}
      ui={<PickerFileUI />}
      icon={<FileSvg />}
      type="file"
      {...props}
    />
  );
};
const PickerFileUI = () => {
  const { value, placeholder } = useContext(PickerContext);
  if (!value) {
    return placeholder || null;
  }
  // value is a FileList-like string from the input; display file names
  return <span>{value}</span>;
};

const resolveDateProp = (value, formatter) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (value instanceof Date) {
    return formatter(value);
  }
  return value;
};
const PencilSvg = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
    </svg>
  );
};
const CalendarSvg = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
    </svg>
  );
};
const ClockSvg = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67V7z" />
    </svg>
  );
};
const ColorSvg = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z" />
    </svg>
  );
};
const FileSvg = () => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z" />
    </svg>
  );
};

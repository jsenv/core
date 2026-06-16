import { useContext } from "preact/hooks";

import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Badge } from "@jsenv/navi/src/text/badge.jsx";
import { BadgeList } from "@jsenv/navi/src/text/badge_list.jsx";
import { Color } from "@jsenv/navi/src/text/color.jsx";
import { Text } from "@jsenv/navi/src/text/text.jsx";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { PickerContext } from "./picker_context.jsx";

export const PickerTypeResolver = (props) => {
  const Next = useNextResolver();

  if (props.type === "color") {
    return <PickerColor {...props} />;
  }
  if (props.type === "date") {
    return <PickerDate {...props} />;
  }
  if (props.type === "month") {
    return <PickerMonth {...props} />;
  }
  if (props.type === "week") {
    return <PickerWeek {...props} />;
  }
  if (props.type === "time") {
    return <PickerTime {...props} />;
  }
  if (props.type === "datetime") {
    return <PickerDatetime {...props} />;
  }
  if (props.type === "file") {
    return <PickerFile {...props} />;
  }
  if (props.type === "text") {
    return <PickerText {...props} />;
  }
  if (props.type === "array") {
    return <PickerArray {...props} />;
  }
  if (props.type === "controlgroup") {
    return <PickerControlGroup {...props} />;
  }
  return <Next {...props} />;
};

const PickerText = (props) => {
  const Next = useNextResolver();

  return <Next icon={<PencilSvg />} {...props} />;
};

const PickerControlGroup = (props) => {
  const Next = useNextResolver();

  return <Next ui={<PickerControlGroupUI />} {...props} type="navi_js" />;
};
export const PickerControlGroupUI = () => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value || Object.keys(value).length === 0) {
    if (!placeholder) {
      return null;
    }
    return placeholder;
  }
  return (
    <BadgeList>
      {Object.entries(value).map(([key, val]) => {
        return (
          <Badge key={key}>
            <span style={{ opacity: 0.6 }}>{key}</span>
            <span>:</span>
            {String(val ?? "")}
          </Badge>
        );
      })}
    </BadgeList>
  );
};

const PickerArray = (props) => {
  const Next = useNextResolver();

  return <Next maxLines="3" ui={<PickerArrayUI />} {...props} type="navi_js" />;
};
export const PickerArrayUI = () => {
  const { value, placeholder, maxLines } = useContext(PickerContext);

  if (!value || value.length === 0) {
    if (!placeholder) {
      return null;
    }
    return placeholder;
  }
  return (
    <Text spacing=", " shrinkWrap maxLines={maxLines}>
      {value.map((item) => {
        return <span key={item}>{item}</span>;
      })}
    </Text>
  );
};

const PickerColor = (props) => {
  const Next = useNextResolver();

  return (
    <Next ui={<PickerColorUI />} icon={<ColorSvg />} type="color" {...props} />
  );
};
export const PickerColorUI = () => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return <Color />;
    }
    return placeholder;
  }
  return <Color>{value}</Color>;
};

const PickerDate = (props) => {
  const Next = useNextResolver();

  return (
    <Next ui={<PickerDateUI />} icon={<CalendarSvg />} {...props} type="date" />
  );
};
export const PickerDateUI = (props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time
          type="date"
          color="var(--picker-placeholder-color"
          capitalize
          maxLines="1"
          {...props}
        />
      );
    }
    return placeholder;
  }
  return (
    <Time type="date" capitalize maxLines="1" {...props}>
      {value}
    </Time>
  );
};

const PickerMonth = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerMonthUI />}
      icon={<CalendarSvg />}
      {...props}
      type="month"
    />
  );
};
export const PickerMonthUI = (props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time
          type="month"
          color="var(--picker-placeholder-color"
          maxLines="1"
          {...props}
        />
      );
    }
    return placeholder;
  }
  return (
    <Time type="month" maxLines="1" capitalize {...props}>
      {value}
    </Time>
  );
};

const PickerWeek = (props) => {
  const Next = useNextResolver();

  return (
    <Next ui={<PickerWeekUI />} icon={<CalendarSvg />} {...props} type="week" />
  );
};
export const PickerWeekUI = (props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time
          type="week"
          color="var(--picker-placeholder-color"
          maxLines="1"
          {...props}
        />
      );
    }
    return placeholder;
  }
  return (
    <Time type="week" capitalize maxLines="1" {...props}>
      {value}
    </Time>
  );
};

const PickerTime = (props) => {
  const Next = useNextResolver();

  return (
    <Next ui={<PickerTimeUI />} icon={<ClockSvg />} {...props} type="time" />
  );
};
export const PickerTimeUI = (props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time
          type="time"
          color="var(--picker-placeholder-color"
          maxLines="1"
          {...props}
        />
      );
    }
    return placeholder;
  }
  return (
    <Time type="time" maxLines="1" {...props}>
      {value}
    </Time>
  );
};

const PickerDatetime = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerDatetimeUI />}
      icon={<CalendarSvg />}
      {...props}
      type="datetime-local"
    />
  );
};
export const PickerDatetimeUI = (props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time
          type="datetime"
          color="var(--picker-placeholder-color"
          maxLines="1"
          {...props}
        />
      );
    }
    return placeholder;
  }
  return (
    <Time type="datetime" maxLines="1">
      {value}
    </Time>
  );
};

const PickerFile = (props) => {
  const Next = useNextResolver();

  return (
    <Next ui={<PickerFileUI />} icon={<FileSvg />} type="file" {...props} />
  );
};
export const PickerFileUI = () => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return null;
    }
    return placeholder;
  }
  // value is a FileList-like string from the input; display file names
  return value;
};

export const PencilSvg = () => {
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
export const CalendarSvg = () => {
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
export const ClockSvg = () => {
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
export const ColorSvg = () => {
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
export const FileSvg = () => {
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

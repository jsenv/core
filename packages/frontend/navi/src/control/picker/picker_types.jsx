import { useContext } from "preact/hooks";

import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Badge } from "@jsenv/navi/src/text/badge.jsx";
import { BadgeList } from "@jsenv/navi/src/text/badge_list.jsx";
import { Color } from "@jsenv/navi/src/text/color.jsx";
import { Text } from "@jsenv/navi/src/text/text.jsx";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { renderSafe } from "@jsenv/navi/src/utils/render_safe.js";
import { PickerContext } from "./picker_context.jsx";
import { CalendarSvg } from "../../graphic/icons/calendar_svg.jsx";
import { ClockSvg } from "../../graphic/icons/clock_svg.jsx";
import { ColorSvg } from "../../graphic/icons/color_svg.jsx";
import { DurationSvg } from "../../graphic/icons/duration_svg.jsx";
import { FileSvg } from "../../graphic/icons/file_svg.jsx";
import { PencilSvg } from "../../graphic/icons/pencil_svg.jsx";

export const PickerTypeResolver = (props) => {
  const Next = useNextResolver();

  if (props.type === "color") {
    return <PickerColor {...props} />;
  }
  if (props.type === "datetime") {
    return <PickerDatetime {...props} />;
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
  if (props.type === "duration") {
    return <PickerDuration {...props} />;
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

  // popupStateType: this picker's popup really is a group of named controls,
  // so its popup aggregates into an object like any other dialog would.
  return (
    <Next
      ui={<PickerControlGroupUI />}
      popupStateType="object"
      {...props}
      type="navi_js"
    />
  );
};
export const PickerControlGroupUI = () => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value || Object.keys(value).length === 0) {
    if (!placeholder) {
      return null;
    }
    return renderSafe(placeholder);
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
    return renderSafe(placeholder);
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
    return renderSafe(placeholder);
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
          {...props}
        />
      );
    }
    return renderSafe(placeholder);
  }
  return (
    <Time type="date" capitalize {...props}>
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
        <Time type="month" color="var(--picker-placeholder-color" {...props} />
      );
    }
    return renderSafe(placeholder);
  }
  return (
    <Time type="month" capitalize {...props}>
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
        <Time type="week" color="var(--picker-placeholder-color" {...props} />
      );
    }
    return renderSafe(placeholder);
  }
  return (
    <Time type="week" capitalize {...props}>
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
        <Time type="time" color="var(--picker-placeholder-color" {...props} />
      );
    }
    return renderSafe(placeholder);
  }
  return (
    <Time type="time" {...props}>
      {value}
    </Time>
  );
};

const PickerDuration = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerDurationUI />}
      icon={<DurationSvg />}
      {...props}
      type="text"
      navi-input-type="duration"
    />
  );
};
export const PickerDurationUI = (props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time type="time" color="var(--picker-placeholder-color" {...props} />
      );
    }
    return renderSafe(placeholder);
  }
  return (
    <Time type="duration" {...props}>
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
          {...props}
        />
      );
    }
    return renderSafe(placeholder);
  }
  return <Time type="datetime">{value}</Time>;
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
    return renderSafe(placeholder);
  }
  // value is a FileList-like string from the input; display file names
  return String(value);
};

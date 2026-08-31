import { useContext } from "preact/hooks";

import { CloseSvg } from "@jsenv/navi/src/graphic/icons/close_svg.jsx";
import { useNextResolver } from "@jsenv/navi/src/resolver/resolver.jsx";
import { Badge } from "@jsenv/navi/src/text/badge.jsx";
import { BadgeList } from "@jsenv/navi/src/text/badge_list.jsx";
import { Color } from "@jsenv/navi/src/text/color.jsx";
import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { Icon, Text } from "@jsenv/navi/src/text/text.jsx";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { renderSafe } from "@jsenv/navi/src/utils/render_safe.js";
import { uiStateHoldsNothing } from "../ui_state_controller.js";
import { asPickerOwnUI, PickerContext } from "./picker_context.jsx";
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
  if (props.type === "object") {
    return <PickerObject {...props} />;
  }
  return <Next {...props} />;
};

const PickerText = (props) => {
  const Next = useNextResolver();

  return <Next rightSlotIcon={<PencilSvg />} {...props} />;
};

// The popup holds a group of named controls — a `<ControlGroup>`, or a `<Form>`
// when that group is a question with a send of its own — and this picker's
// value is the object that group aggregates. The popup itself holds nothing: it
// is a surface (see dialog.jsx), so there is nothing to tell it about the shape.
const PickerObject = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerObjectUI />}
      {...props}
      type="navi_js"
      navi-state-shape="object"
    />
  );
};
export const PickerObjectUI = asPickerOwnUI(() => {
  const { value, placeholder } = useContext(PickerContext);

  if (uiStateHoldsNothing(value)) {
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
});

const PickerArray = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerArrayUI />}
      {...props}
      type="navi_js"
      navi-state-shape="array"
    />
  );
};
export const PickerArrayUI = asPickerOwnUI(() => {
  const { value, placeholder, maxLines } = useContext(PickerContext);

  if (uiStateHoldsNothing(value)) {
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
});

/**
 * One value the picker holds, drawn as a chip with a cross that takes it back
 * out. Sits wherever the application draws what was picked — on the picker's
 * façade (`ui`) or inside its popup — and both behave the same.
 *
 * The cross asks with `--navi-unselect` rather than writing a new list, and it
 * asks the picker — which holds what was picked, and hands it down to whatever
 * draws it in the popup. Nothing to name: the picker is the nearest control
 * around the chip. `commandFor` is for a chip that stands outside the picker it
 * speaks for.
 *
 * The cross claims the press (see self_interactions.js), so it belongs to it
 * and not to the picker underneath, and it goes when the picker turns read-only
 * — a row being read still says what was picked, it just no longer offers to
 * unpick it.
 *
 * @type {import("preact").FunctionComponent<{
 *   value: any,
 *   commandFor?: string,
 *   children?: import("preact").ComponentChildren,
 *   [key: string]: any,
 * }>}
 * @param {any} value The value this chip stands for — one entry of what the
 *   picker holds, and what `--navi-unselect` carries.
 * @param {string} [commandFor] The id of the picker to take the value out of,
 *   when the chip does not sit inside it.
 */
export const PickerChip = ({ value, commandFor, children, ...rest }) => {
  return (
    <Badge inline flex {...rest}>
      {children}
      <Badge.Button
        selfInteractions="click"
        command="--navi-unselect"
        commandFor={commandFor}
        value={value}
        aria-label={naviI18n("button.remove")}
      >
        <Icon lineOverflow="allow">
          <CloseSvg />
        </Icon>
      </Badge.Button>
    </Badge>
  );
};

const PickerColor = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerColorUI />}
      rightSlotIcon={<ColorSvg />}
      type="color"
      {...props}
    />
  );
};
export const PickerColorUI = asPickerOwnUI(() => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return <Color />;
    }
    return renderSafe(placeholder);
  }
  return <Color>{value}</Color>;
});

const PickerDate = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerDateUI />}
      rightSlotIcon={<CalendarSvg />}
      {...props}
      type="date"
    />
  );
};
export const PickerDateUI = asPickerOwnUI((props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time
          type="date"
          color="var(--picker-placeholder-color)"
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
});

const PickerMonth = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerMonthUI />}
      rightSlotIcon={<CalendarSvg />}
      {...props}
      type="month"
    />
  );
};
export const PickerMonthUI = asPickerOwnUI((props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time type="month" color="var(--picker-placeholder-color)" {...props} />
      );
    }
    return renderSafe(placeholder);
  }
  return (
    <Time type="month" capitalize {...props}>
      {value}
    </Time>
  );
});

const PickerWeek = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerWeekUI />}
      rightSlotIcon={<CalendarSvg />}
      {...props}
      type="week"
    />
  );
};
export const PickerWeekUI = asPickerOwnUI((props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time type="week" color="var(--picker-placeholder-color)" {...props} />
      );
    }
    return renderSafe(placeholder);
  }
  return (
    <Time type="week" capitalize {...props}>
      {value}
    </Time>
  );
});

const PickerTime = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerTimeUI />}
      rightSlotIcon={<ClockSvg />}
      {...props}
      type="time"
    />
  );
};
export const PickerTimeUI = asPickerOwnUI((props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time type="time" color="var(--picker-placeholder-color)" {...props} />
      );
    }
    return renderSafe(placeholder);
  }
  return (
    <Time type="time" {...props}>
      {value}
    </Time>
  );
});

const PickerDuration = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerDurationUI />}
      rightSlotIcon={<DurationSvg />}
      {...props}
      type="text"
      navi-input-type="duration"
    />
  );
};
export const PickerDurationUI = asPickerOwnUI((props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time type="time" color="var(--picker-placeholder-color)" {...props} />
      );
    }
    return renderSafe(placeholder);
  }
  return (
    <Time type="duration" {...props}>
      {value}
    </Time>
  );
});

const PickerDatetime = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerDatetimeUI />}
      rightSlotIcon={<CalendarSvg />}
      {...props}
      type="datetime-local"
    />
  );
};
export const PickerDatetimeUI = asPickerOwnUI((props) => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return (
        <Time
          type="datetime"
          color="var(--picker-placeholder-color)"
          {...props}
        />
      );
    }
    return renderSafe(placeholder);
  }
  return <Time type="datetime">{value}</Time>;
});

const PickerFile = (props) => {
  const Next = useNextResolver();

  return (
    <Next
      ui={<PickerFileUI />}
      rightSlotIcon={<FileSvg />}
      type="file"
      {...props}
    />
  );
};
export const PickerFileUI = asPickerOwnUI(() => {
  const { value, placeholder } = useContext(PickerContext);

  if (!value) {
    if (!placeholder) {
      return null;
    }
    return renderSafe(placeholder);
  }
  // value is a FileList-like string from the input; display file names
  return String(value);
});

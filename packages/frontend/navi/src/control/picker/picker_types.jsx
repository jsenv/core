import { CloseSvg } from "@jsenv/navi/src/graphic/icons/close_svg.jsx";
import {
  renderResolver,
  useNextResolver,
} from "@jsenv/navi/src/resolver/resolver.jsx";
import { Badge } from "@jsenv/navi/src/text/badge.jsx";
import { BadgeList } from "@jsenv/navi/src/text/badge_list.jsx";
import { Color } from "@jsenv/navi/src/text/color.jsx";
import { buttonI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { Icon, Text } from "@jsenv/navi/src/text/text.jsx";
import { Time } from "@jsenv/navi/src/text/time.jsx";
import { renderSafe } from "@jsenv/navi/src/utils/render_safe.js";
import { dispatchRequestAction } from "../rules/control_action.js";
import { uiStateHoldsNothing } from "../ui_state_controller.js";
import { asPickerOwnUI, usePickerContext } from "./picker_context.jsx";
import { getPickerInput } from "./picker_custom.jsx";
import { CalendarSvg } from "../../graphic/icons/calendar_svg.jsx";
import { ClockSvg } from "../../graphic/icons/clock_svg.jsx";
import { ColorSvg } from "../../graphic/icons/color_svg.jsx";
import { DurationSvg } from "../../graphic/icons/duration_svg.jsx";
import { FileSvg } from "../../graphic/icons/file_svg.jsx";
import { PencilSvg } from "../../graphic/icons/pencil_svg.jsx";

export const PickerTypeResolver = (props) => {
  const Next = useNextResolver();

  if (props.type === "color") {
    return renderResolver(PickerColor, props);
  }
  if (props.type === "datetime") {
    return renderResolver(PickerDatetime, props);
  }
  if (props.type === "date") {
    return renderResolver(PickerDate, props);
  }
  if (props.type === "month") {
    return renderResolver(PickerMonth, props);
  }
  if (props.type === "week") {
    return renderResolver(PickerWeek, props);
  }
  if (props.type === "time") {
    return renderResolver(PickerTime, props);
  }
  if (props.type === "duration") {
    return renderResolver(PickerDuration, props);
  }
  if (props.type === "file") {
    return renderResolver(PickerFile, props);
  }
  if (props.type === "text") {
    return renderResolver(PickerText, props);
  }
  if (props.type === "array") {
    return renderResolver(PickerArray, props);
  }
  if (props.type === "object") {
    return renderResolver(PickerObject, props);
  }
  return <Next {...props} />;
};

const PickerText = (props) => {
  const Next = useNextResolver();

  return <Next rightSlotIcon={<PencilSvg />} {...props} />;
};

// The popup holds a group of named controls — a `<ControlGroup>`, or a `<Form>`
// when that group is a question with a send of its own and the picker is not
// itself inside a form (a form in a form answers for itself, see form.jsx) —
// and this picker's value is the object that group aggregates. The popup itself
// holds nothing: it is a surface (see dialog.jsx), so there is nothing to tell
// it about the shape.
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
export const PickerObjectUI = /*#__PURE__*/ asPickerOwnUI(() => {
  const { value, placeholder } = usePickerContext();

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
export const PickerArrayUI = /*#__PURE__*/ asPickerOwnUI(() => {
  const { value, placeholder, maxLines } = usePickerContext();

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
 * façade (`ui`) or inside its popup. Inside the open popup the removal waits
 * for the close like any change made there; pressed while the popup is closed
 * it is the whole gesture, and the picker's `action` runs at once.
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
    <Badge {...rest}>
      {children}
      <Badge.Button
        selfInteractions="click"
        command="--navi-unselect"
        commandFor={commandFor}
        value={value}
        aria-label={buttonI18n("button.remove")}
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
export const PickerColorUI = /*#__PURE__*/ asPickerOwnUI(() => {
  const { value, placeholder } = usePickerContext();

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
export const PickerDateUI = /*#__PURE__*/ asPickerOwnUI((props) => {
  const { value, placeholder } = usePickerContext();

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
export const PickerMonthUI = /*#__PURE__*/ asPickerOwnUI((props) => {
  const { value, placeholder } = usePickerContext();

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
export const PickerWeekUI = /*#__PURE__*/ asPickerOwnUI((props) => {
  const { value, placeholder } = usePickerContext();

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
export const PickerTimeUI = /*#__PURE__*/ asPickerOwnUI((props) => {
  const { value, placeholder } = usePickerContext();

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
export const PickerDurationUI = /*#__PURE__*/ asPickerOwnUI((props) => {
  const { value, placeholder } = usePickerContext();

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
export const PickerDatetimeUI = /*#__PURE__*/ asPickerOwnUI((props) => {
  const { value, placeholder } = usePickerContext();

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

// What a file picker holds is the File — the Files, with `multiple` — kept as
// a JS value (navi_js), the way a picker with a popup keeps what its popup
// holds: a file input's own value can only ever be written empty, so it
// could not take a File back on a rollback, nor hold one handed down. The
// browser's chooser is an input of its own, which chooses and holds nothing.
const PickerFile = (props) => {
  const Next = useNextResolver();
  if (props.children !== undefined) {
    // A popup of the caller's holds the file (a file picker in it): this one
    // draws what it holds.
    return (
      <Next
        ui={<PickerFileUI />}
        rightSlotIcon={<FileSvg />}
        {...props}
        type="navi_js"
      />
    );
  }
  const { accept, multiple, capture, ...rest } = props;

  return (
    <Next
      ui={<PickerFileUI />}
      rightSlotIcon={<FileSvg />}
      {...rest}
      type="navi_js"
      // eslint-disable-next-line react/no-children-prop
      children={
        <PickerFileChooser
          accept={accept}
          multiple={multiple}
          capture={capture}
        />
      }
    />
  );
};
// Opened by the picker's press (see findNativePicker in picker_custom.jsx).
// A chooser dismissed without a choice fires `cancel`, never `change`: nothing
// is held, nothing is sent.
const PickerFileChooser = ({ accept, multiple, capture }) => {
  return (
    <input
      type="file"
      className="navi_picker_file_chooser"
      accept={accept}
      multiple={multiple}
      capture={capture}
      hidden
      tabIndex={-1}
      aria-hidden="true"
      // The click() a browser without showPicker() is opened by must not
      // reach the picker's own press, which would open it again.
      onClick={(e) => {
        e.stopPropagation();
      }}
      onChange={(e) => {
        const chooser = e.currentTarget;
        const files = Array.from(chooser.files);
        // Emptied right away: the same file chosen again is a choice too.
        chooser.value = "";
        if (files.length === 0) {
          return;
        }
        const pickerInput = getPickerInput(chooser.closest(".navi_picker"));
        // The choice IS the answer, as a native picker's change is: held,
        // then sent — the trigger busy while it runs, put back if it fails.
        dispatchRequestAction(pickerInput, {
          event: e,
          name: "file chosen",
          allowed: () => {
            pickerInput.__uiStateController__.setUIState(
              multiple ? files : files[0],
              e,
            );
          },
        });
      }}
    />
  );
};
export const PickerFileUI = /*#__PURE__*/ asPickerOwnUI(() => {
  const { value, placeholder } = usePickerContext();

  if (uiStateHoldsNothing(value)) {
    if (!placeholder) {
      return null;
    }
    return renderSafe(placeholder);
  }
  const files = Array.isArray(value) ? value : [value];
  return files.map((file) => file.name).join(", ");
});

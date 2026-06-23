import { useRef } from "preact/hooks";

import { Unit } from "@jsenv/navi/src/text/unit.jsx";
import { Label } from "../field.jsx";
import { Input } from "./input.jsx";
import { InputGroup } from "./input_group.jsx";

export const InputDuration = ({
  hour,
  minute,
  uiAction,
  action,
  required,
  unitHour = (
    <Unit
      unit="hour"
      plural
      color="secondary"
      // We need this because ":" is inside the first input so
      // in case unit pushes to the right it should account for the space of ":"
      marginRight="1ch"
    />
  ),
  unitMinute = <Unit unit="minute" plural color="secondary" />,
}) => {
  // Use refs to always read the latest prop values in callbacks,
  // even if navi Input caches the uiAction/action reference internally.
  const hourRef = useRef(hour);
  const minuteRef = useRef(minute);
  hourRef.current = hour;
  minuteRef.current = minute;

  return (
    <InputGroup flex spacing="xxs" width="fit-content">
      <Label flex="y" textAlign="right">
        <Input
          type="navi_hour"
          name="hour"
          unit={false}
          variant="underline"
          size="l"
          expandX
          value={hour}
          required={required}
          uiAction={(v) => {
            hourRef.current = v;
            uiAction?.({ hour: v, minute: minuteRef.current });
          }}
          action={
            action
              ? (v, context) => {
                  hourRef.current = v;
                  action({ hour: v, minute: minuteRef.current }, context);
                }
              : undefined
          }
        >
          <Input.UI.UnitSlot>:</Input.UI.UnitSlot>
        </Input>
        {unitHour}
      </Label>
      <Label flex="y">
        <Input
          type="navi_minute"
          name="minute"
          size="l"
          unit={false}
          variant="underline"
          expandX
          value={minute}
          required={required}
          uiAction={(v) => {
            minuteRef.current = v;
            uiAction?.({ hour: hourRef.current, minute: v });
          }}
          action={
            action
              ? (v, context) => {
                  minuteRef.current = v;
                  action({ hour: hourRef.current, minute: v }, context);
                }
              : undefined
          }
        />
        {unitMinute}
      </Label>
    </InputGroup>
  );
};

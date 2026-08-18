import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";
import { getUIStateControllerById } from "../../controller_registry.js";
import { CONSTRAINT_ATTRIBUTE_SET } from "../constraint_attribute_set.js";

// A time that must not land before another one: the field says which one it
// comes after (data-time-after, the id of the control holding it) and how much
// room there must be between the two at least (data-time-min-duration, in
// minutes — zero by default, so a span of no length is a span all the same).
// Carried by the LATER of the two: it is the one that would have to move, so it
// is the one the answer is about.
export const TIME_RANGE_CONSTRAINT = {
  name: "time_after",
  messageAttribute: "data-time-after-message",
  check: (field) => {
    const after = field.controlHostProps["data-time-after"];
    if (after === undefined) {
      return null;
    }
    const otherController = getUIStateControllerById(after);
    if (!otherController) {
      console.warn(`Time after constraint: no control with id "${after}"`);
      return null;
    }
    const timeBefore = minutesFromTime(otherController.uiState);
    const timeAfter = minutesFromTime(field.uiState);
    if (timeBefore === null || timeAfter === null) {
      return null;
    }
    const minDuration = Number(
      field.controlHostProps["data-time-min-duration"] ?? 0,
    );
    const duration = timeAfter - timeBefore;
    if (duration >= minDuration) {
      return null;
    }
    if (minDuration > 0) {
      return naviI18n("constraint.time_after.min_duration").replace(
        "[duration]",
        String(minDuration),
      );
    }
    return naviI18n("constraint.time_after.default");
  },
};
CONSTRAINT_ATTRIBUTE_SET.add("data-time-after");
CONSTRAINT_ATTRIBUTE_SET.add("data-time-min-duration");

// "HH:MM" as a number of minutes, which is what two times are compared and
// subtracted as. Anything else is a time nobody has finished writing.
const minutesFromTime = (time) => {
  if (typeof time !== "string") {
    return null;
  }
  const match = /^(\d{1,2}):(\d{1,2})$/.exec(time);
  if (!match) {
    return null;
  }
  return Number(match[1]) * 60 + Number(match[2]);
};

import { PickerNaviMinute } from "./preset/picker_navi_minute.jsx";
import { PickerNaviTime } from "./preset/picker_navi_time.jsx";

// A preset type and the resolver drawing it, reached from the head of the
// picker's chain (see PickerFirstResolver in picker.jsx).
export const PICKER_PRESET_RESOLVER_MAP = new Map([
  ["navi_time", PickerNaviTime],
  ["navi_minute", PickerNaviMinute],
]);

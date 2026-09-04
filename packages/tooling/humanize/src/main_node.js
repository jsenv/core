// tslint:disable:ordered-imports

export {
  createDetailedMessage,
  renderNamedSections,
} from "./log/detailed_message.js";
export { ANSI } from "./ansi/ansi_node.js";
export { UNICODE } from "./unicode/unicode_node.js";
export { humanize, humanizeMethodSymbol } from "./js_value/humanize.js";
export { humanizeDuration, humanizeEllapsedTime } from "./time/time.js";
export { humanizeFileSize, humanizeMemory } from "./byte/byte.js";
// text formatting for the reader of an app: locale-aware, translated through
// humanizeI18n (a frontend re-exports these rather than shipping its own —
// see @jsenv/navi)
export { createI18n } from "./i18n/i18n.js";
export { humanizeI18n } from "./i18n/humanize_i18n.js";
export {
  installInterpolateJsx,
  interpolateText,
} from "./i18n/interpolate_text.js";
export { getRuntimeLang, setRuntimeLangSource } from "./i18n/runtime_lang.js";
export { formatNumber } from "./number/format_number.js";
export {
  formatDatePlaceholder,
  formatDatetime,
  formatDatetimePlaceholder,
  formatDay,
  formatDayRelative,
  formatDuration,
  formatHourDuration,
  formatMinuteDuration,
  formatMonth,
  formatMonthPlaceholder,
  formatSecondDuration,
  formatTime,
  formatTimeOfDay,
  formatTimeRange,
  formatTimeRelative,
  formatWeekPlaceholder,
  getRelativeDay,
  resolveTimeRangePrecision,
  toDate,
  toTimeOfDay,
} from "./time/format_time.js";

export { distributePercentages } from "./percentage/distribute_percentages.js";
export { generateContentFrame } from "./content_frame/content_frame.js";
export { createCallOrderer } from "./log/call_orderer.js";
export { errorToMarkdown } from "./error/error_to_markdown.js";
export { errorToHTML } from "./error/error_to_html.js";
export { formatError } from "./error/format_error.js";

export {
  prefixFirstAndIndentRemainingLines,
  preNewLineAndIndentation,
  wrapNewLineAndIndentation,
} from "./utils/indentation.js";

// node only
export { renderSection, renderBigSection } from "./log/section.js";
export { renderDetails } from "./log/details.js";
export { createLogger } from "./log/logger.js";
export { createDynamicLog } from "./log/dynamic_log.js";
export { startSpinner } from "./log/spinner.js";
export { createTaskLog } from "./log/task_log.js";

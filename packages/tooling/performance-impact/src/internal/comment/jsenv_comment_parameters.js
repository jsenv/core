import { jsenvFormatGroupSummary } from "./jsenv_format_group_summary.js";
import { jsenvFormatPerformanceImpactCell } from "./jsenv_format_performance_impact_cell.js";
import { jsenvIsPerformanceImpactBig } from "./jsenv_is_performance_impact_big.js";

export const jsenvCommentParameters = {
  isPerformanceImpactBig: jsenvIsPerformanceImpactBig,
  formatGroupSummary: jsenvFormatGroupSummary,
  formatPerformanceImpactCell: jsenvFormatPerformanceImpactCell,
};

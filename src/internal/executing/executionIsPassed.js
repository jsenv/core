export const executionIsPassed = ({ planSummary }) =>
  planSummary.executionCount === planSummary.completedCount

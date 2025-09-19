import { formatNumericDiff } from "./format_numeric_diff.js";

export const createLighthouseImpactComment = ({
  pullRequestBase,
  pullRequestHead,
  beforeMergeLighthouseReport,
  afterMergeLighthouseReport,
  beforeMergeGist,
  afterMergeGist,
}) => {
  const warnings = [];

  const beforeMergeVersion = beforeMergeLighthouseReport.lighthouseVersion;
  const afterMergeVersion = afterMergeLighthouseReport.lighthouseVersion;
  let impactAnalysisEnabled = true;
  if (beforeMergeVersion !== afterMergeVersion) {
    impactAnalysisEnabled = false;
    warnings.push(
      `**Warning:** Impact analysis skipped because lighthouse version are different on \`${pullRequestBase}\` (${beforeMergeVersion}) and \`${pullRequestHead}\` (${afterMergeVersion}).`,
    );
  }

  const beforeMergeWarnings = beforeMergeLighthouseReport.runWarnings;
  if (beforeMergeWarnings && beforeMergeWarnings.length) {
    warnings.push(
      `**Warning**: warnings produced while generating lighthouse report on \`${pullRequestBase}\`:
- ${beforeMergeWarnings.join(`
- `)}`,
    );
  }
  const afterMergeWarnings = afterMergeLighthouseReport.runWarnings;
  if (afterMergeWarnings && afterMergeWarnings.length) {
    warnings.push(
      `**Warning**: warnings produced while generating lighthouse report after merge:
- ${afterMergeWarnings.join(`
- `)}`,
    );
  }

  const bodyLines = [
    ...(beforeMergeGist
      ? [`<!-- before_merge_gist_id=${beforeMergeGist.id} -->`]
      : []),
    ...(afterMergeGist
      ? [`<!-- after_merge_gist_id=${afterMergeGist.id} -->`]
      : []),
    `<h4>Lighthouse impact</h4>`,
    ...(impactAnalysisEnabled
      ? [
          `
${renderBody({
  beforeMergeLighthouseReport,
  afterMergeLighthouseReport,
})}
`,
        ]
      : []),
    ...(beforeMergeGist
      ? [
          renderGistLinks({
            pullRequestBase,
            beforeMergeGist,
            afterMergeGist,
          }),
        ]
      : []),
  ];

  const body = bodyLines.join(`
`);

  return { warnings, body };
};

const renderBody = ({
  beforeMergeLighthouseReport,
  afterMergeLighthouseReport,
}) => {
  return Object.keys(afterMergeLighthouseReport.categories).map(
    (categoryName) => {
      return renderCategory(categoryName, {
        beforeMergeLighthouseReport,
        afterMergeLighthouseReport,
      });
    },
  ).join(`

`);
};

const renderCategory = (
  category,
  { beforeMergeLighthouseReport, afterMergeLighthouseReport },
) => {
  const beforeMergeDisplayedScore = scoreToDisplayedScore(
    beforeMergeLighthouseReport.categories[category].score,
  );
  const afterMergeDisplayedScore = scoreToDisplayedScore(
    afterMergeLighthouseReport.categories[category].score,
  );
  const diff = afterMergeDisplayedScore - beforeMergeDisplayedScore;
  const diffDisplayValue = diff === 0 ? "no impact" : formatNumericDiff(diff);

  const summaryText = `${category} score: ${afterMergeDisplayedScore} (${diffDisplayValue})`;

  return `<details>
  <summary>${summaryText}</summary>
  ${
    category === "performance"
      ? `<br /><blockquote>Keep in mind performance score variation may be caused by external factors. <a href="https://github.com/GoogleChrome/lighthouse/blob/91b4461c214c0e05d318ec96f6585dcca52a51cc/docs/variability.md#score-variability">Learn more</a>.</blockquote>`
      : ""
  }
  ${renderCategoryAudits(category, {
    beforeMergeLighthouseReport,
    afterMergeLighthouseReport,
  })}
</details>`;
};

const scoreToDisplayedScore = (floatingNumber) =>
  Math.round(floatingNumber * 100);

const renderCategoryAudits = (
  category,
  { beforeMergeLighthouseReport, afterMergeLighthouseReport },
) => {
  const { auditRefs } = afterMergeLighthouseReport.categories[category];
  const audits = [];
  auditRefs.forEach((auditRef) => {
    const auditId = auditRef.id;
    const beforeMergeAudit = beforeMergeLighthouseReport.audits[auditId];
    const afterMergeAudit = afterMergeLighthouseReport.audits[auditId];
    const beforeMergeAuditOutput = renderAudit(beforeMergeAudit);
    const afterMergeAuditOutput = renderAudit(afterMergeAudit);

    // both are not applicable
    if (beforeMergeAuditOutput === null && afterMergeAuditOutput === null) {
      return;
    }

    // becomes applicable
    if (beforeMergeAuditOutput === null && afterMergeAuditOutput !== null) {
      audits.push([
        `<td nowrap>${auditId}</td>`,
        `<td nowrap>---</td>`,
        `<td nowrap>---</td>`,
        `<td nowrap>${afterMergeAuditOutput}</td>`,
      ]);
      return;
    }

    // becomes unapplicable
    if (beforeMergeAuditOutput !== null && afterMergeAuditOutput === null) {
      audits.push([
        `<td nowrap>${auditId}</td>`,
        `<td nowrap>---</td>`,
        `<td nowrap>${beforeMergeAuditOutput}</td>`,
        `<td nowrap>---</td>`,
      ]);
      return;
    }

    if (
      typeof beforeMergeAuditOutput === "number" &&
      typeof afterMergeAuditOutput === "number"
    ) {
      const diff = afterMergeAuditOutput - beforeMergeAuditOutput;

      audits.push([
        `<td nowrap>${auditId}</td>`,
        `<td nowrap>${diff === 0 ? "none" : formatNumericDiff(diff)}</td>`,
        `<td nowrap>${beforeMergeAuditOutput}</td>`,
        `<td nowrap>${afterMergeAuditOutput}</td>`,
      ]);
      return;
    }

    audits.push([
      `<td nowrap>${auditId}</td>`,
      `<td nowrap>${
        beforeMergeAuditOutput === afterMergeAuditOutput ? "none" : "---"
      }</td>`,
      `<td nowrap>${beforeMergeAuditOutput}</td>`,
      `<td nowrap>${afterMergeAuditOutput}</td>`,
    ]);
  });

  return `
  <table>
    <thead>
      <tr>
        <th nowrap>${category} audit</th>
        <th nowrap>impact</th>
        <th nowrap>before merge</th>
        <th nowrap>after merge</th>
      </tr>
    </thead>
    <tbody>
      <tr>${audits.map(
        (cells) => `
        ${cells.join(`
        `)}`,
      ).join(`
      </tr>
      <tr>`)}
      </tr>
    </tbody>
  </table>`;
};

const renderAudit = (audit) => {
  const { scoreDisplayMode } = audit;

  if (scoreDisplayMode === "manual") {
    return null;
  }

  if (scoreDisplayMode === "notApplicable") {
    return null;
  }

  if (scoreDisplayMode === "informative") {
    const { displayValue } = audit;
    if (typeof displayValue !== "undefined") return displayValue;

    const { numericValue } = audit;
    if (typeof numericValue !== "undefined") return numericValue;

    return null;
  }

  if (scoreDisplayMode === "binary") {
    const { score } = audit;
    return score ? "✔" : "☓";
  }

  if (scoreDisplayMode === "numeric") {
    const { score } = audit;
    return scoreToDisplayedScore(score);
  }

  if (scoreDisplayMode === "error") {
    return "error";
  }

  return null;
};

const renderGistLinks = ({
  beforeMergeGist,
  afterMergeGist,
  pullRequestBase,
}) => {
  return `<sub>
  Impact analyzed comparing <a href="${gistIdToReportUrl(
    beforeMergeGist.id,
  )}">${pullRequestBase} report</a> and <a href="${gistIdToReportUrl(
    afterMergeGist.id,
  )}">report after merge</a>
</sub><br />`;
};

const gistIdToReportUrl = (gistId) => {
  return `https://googlechrome.github.io/lighthouse/viewer/?gist=${gistId}`;
};

import {
  ANSI,
  distributePercentages,
  humanizeDuration,
  humanizeFileSize,
  humanizeMemory,
  renderBigSection,
  renderDetails,
} from "@jsenv/humanize";
import { renderTable } from "@jsenv/terminal-table";

export const createBuildContentSummary = (
  buildFileContents,
  { indent, title } = {},
) => {
  const buildContentReport = createBuildContentReport(buildFileContents);
  return `--- ${title} ---  
${createRepartitionMessage(buildContentReport, { indent })}
--------------------`;
};

const humanizeProcessCpuUsage = (ratio) => {
  const percentageAsNumber = ratio * 100;
  const percentageAsNumberRounded = Math.round(percentageAsNumber);
  const percentage = `${percentageAsNumberRounded}%`;
  return percentage;
};
const humanizeProcessMemoryUsage = (value) => {
  return humanizeMemory(value, { short: true, decimals: 0 });
};
export const renderBuildDoneLog = ({
  entryPointArray,
  duration,
  buildFileContents,
  processCpuUsage,
  processMemoryUsage,
}) => {
  const buildContentReport = createBuildContentReport(buildFileContents);

  let title = "";
  const lines = [];

  const entryPointCount = entryPointArray.length;
  if (entryPointCount === 1) {
    title = `build done`;
  } else {
    title = `build done (${entryPointCount} entry points)`;
  }

  // cpu usage
  let cpuUsageLine = "cpu: ";
  cpuUsageLine += `${humanizeProcessCpuUsage(processCpuUsage.end)}`;
  cpuUsageLine += renderDetails({
    med: humanizeProcessCpuUsage(processCpuUsage.median),
    min: humanizeProcessCpuUsage(processCpuUsage.min),
    max: humanizeProcessCpuUsage(processCpuUsage.max),
  });
  lines.push(cpuUsageLine);

  // memory usage
  let memoryUsageLine = "memory: ";
  memoryUsageLine += `${humanizeProcessMemoryUsage(processMemoryUsage.end)}`;
  memoryUsageLine += renderDetails({
    med: humanizeProcessMemoryUsage(processMemoryUsage.median),
    min: humanizeProcessMemoryUsage(processMemoryUsage.min),
    max: humanizeProcessMemoryUsage(processMemoryUsage.max),
  });
  lines.push(memoryUsageLine);

  // duration
  let durationLine = `duration: `;
  durationLine += humanizeDuration(duration, { short: true });
  lines.push(durationLine);

  // content
  let filesLine = `content: `;
  const filesWrittenCount = buildContentReport.total.count;
  if (filesWrittenCount === 1) {
    filesLine += "1 file";
  } else {
    filesLine += `${filesWrittenCount} files`;
  }
  filesLine += " (";
  filesLine += humanizeFileSize(buildContentReport.total.size);
  filesLine += ")";
  lines.push(filesLine);

  // file repartition
  const keys = Object.keys(buildContentReport);
  const rows = [];
  let y = 0;
  let highestPercentage = 0;
  let highestPercentageY = 0;
  for (const key of keys) {
    if (key === "sourcemaps") {
      continue;
    }
    if (key === "total") {
      continue;
    }
    const { count, size, percentage } = buildContentReport[key];
    if (count === 0) {
      continue;
    }
    const row = [
      {
        value: key,
        borderTop: {},
        borderBottom: {},
      },
      {
        value: count,
        borderTop: {},
        borderBottom: {},
      },
      {
        value: size,
        format: "size",
        borderTop: {},
        borderBottom: {},
      },
      {
        value: percentage,
        format: "percentage",
        unit: "%",
        borderTop: {},
        borderBottom: {},
      },
    ];
    if (percentage > highestPercentage) {
      highestPercentage = percentage;
      highestPercentageY = y;
    }
    rows.push(row);
    y++;
  }
  if (rows.length > 1) {
    const rowWithHighestPercentage = rows[highestPercentageY];
    for (const cell of rowWithHighestPercentage) {
      cell.bold = true;
    }
    const table = renderTable(rows, {
      borderCollapse: true,
      ansi: true,
    });
    lines.push(table);
  }

  const content = lines.join("\n");
  return `${renderBigSection({
    title,
    content,
  })}`;
};

export const createBuildContentOneLineSummary = (
  buildFileContents,
  { indent },
) => {
  const buildContentReport = createBuildContentReport(buildFileContents);
  const shortSummary = createBuildShortSummary(buildContentReport);
  return `${indent}${shortSummary}`;
};

const createBuildContentReport = (buildFileContents) => {
  const countGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0,
  };
  const sizeGroups = {
    sourcemaps: 0,
    html: 0,
    css: 0,
    js: 0,
    json: 0,
    other: 0,
    total: 0,
  };

  for (const buildRelativeUrl of Object.keys(buildFileContents)) {
    const content = buildFileContents[buildRelativeUrl];
    const contentSize = Buffer.byteLength(content);
    const category = determineCategory(buildRelativeUrl);
    if (category === "sourcemap") {
      countGroups.sourcemaps++;
      sizeGroups.sourcemaps += contentSize;
      continue;
    }
    countGroups.total++;
    sizeGroups.total += contentSize;
    if (category === "html") {
      countGroups.html++;
      sizeGroups.html += contentSize;
      continue;
    }
    if (category === "css") {
      countGroups.css++;
      sizeGroups.css += contentSize;
      continue;
    }
    if (category === "js") {
      countGroups.js++;
      sizeGroups.js += contentSize;
      continue;
    }
    if (category === "json") {
      countGroups.json++;
      sizeGroups.json += contentSize;
      continue;
    }
    countGroups.other++;
    sizeGroups.other += contentSize;
    continue;
  }

  const sizesToDistribute = {};
  for (const groupName of Object.keys(sizeGroups)) {
    if (groupName !== "sourcemaps" && groupName !== "total") {
      sizesToDistribute[groupName] = sizeGroups[groupName];
    }
  }
  const percentageGroups = distributePercentages(sizesToDistribute);

  return {
    // sourcemaps are special, there size are ignored
    // so there is no "percentage" associated
    sourcemaps: {
      count: countGroups.sourcemaps,
      size: sizeGroups.sourcemaps,
      percentage: undefined,
    },

    html: {
      count: countGroups.html,
      size: sizeGroups.html,
      percentage: percentageGroups.html,
    },
    css: {
      count: countGroups.css,
      size: sizeGroups.css,
      percentage: percentageGroups.css,
    },
    js: {
      count: countGroups.js,
      size: sizeGroups.js,
      percentage: percentageGroups.js,
    },
    json: {
      count: countGroups.json,
      size: sizeGroups.json,
      percentage: percentageGroups.json,
    },
    other: {
      count: countGroups.other,
      size: sizeGroups.other,
      percentage: percentageGroups.other,
    },
    total: {
      count: countGroups.total,
      size: sizeGroups.total,
      percentage: 100,
    },
  };
};

const determineCategory = (buildRelativeUrl) => {
  if (buildRelativeUrl.endsWith(".map")) {
    return "sourcemap";
  }
  if (buildRelativeUrl.endsWith(".html")) {
    return "html";
  }
  if (buildRelativeUrl.endsWith(".css")) {
    return "css";
  }
  if (
    buildRelativeUrl.endsWith(".js") ||
    buildRelativeUrl.endsWith(".mjs") ||
    buildRelativeUrl.endsWith(".cjs")
  ) {
    return "js";
  }
  if (buildRelativeUrl.endsWith(".json")) {
    return "json";
  }
  return "other";
};

const createBuildShortSummary = ({ html, css, js, json, other, total }) => {
  let shortSummary = "";

  const tag =
    html.count === total.count
      ? "html"
      : css.count === total.count
        ? "css"
        : js.count === total.count
          ? "js"
          : json.count === total.count
            ? "json"
            : "";

  if (total.count === 1) {
    if (tag) {
      shortSummary += `1 ${tag} file`;
    } else {
      shortSummary += "1 file";
    }
  } else if (tag) {
    shortSummary += `${total.count} ${tag} files`;
  } else {
    shortSummary += `${total.count} files`;
  }

  shortSummary += " (";
  shortSummary += humanizeFileSize(total.size);
  const repart = [];
  if (html.count) {
    repart.push(`html: ${html.percentage}%`);
  }
  if (css.count) {
    repart.push(`css: ${css.percentage}%`);
  }
  if (js.count) {
    repart.push(`js: ${js.percentage}%`);
  }
  if (json.count) {
    repart.push(`json: ${js.percentage}%`);
  }
  if (other.count) {
    repart.push(`other: ${js.percentage}%`);
  }
  if (repart.length > 1) {
    shortSummary += ` / ${repart.join(" ")}`;
  }
  shortSummary += ")";
  return shortSummary;
};

const createRepartitionMessage = (
  { html, css, js, json, other, total },
  { indent },
) => {
  const addPart = (name, { count, size, percentage }) => {
    let part = "";
    part += ANSI.color(`${name}:`, ANSI.GREY);
    part += " ";
    part += count;
    part += " ";
    part += ANSI.color(
      `(${humanizeFileSize(size)} / ${percentage} %)`,
      ANSI.GREY,
    );
    parts.push(part);
  };

  const parts = [];
  // if (sourcemaps.count) {
  //   parts.push(
  //     `${ANSI.color(`sourcemaps:`, ANSI.GREY)} ${
  //       sourcemaps.count
  //     } (${humanizeFileSize(sourcemaps.size)})`,
  //   )
  // }
  if (html.count) {
    addPart("html ", html);
  }
  if (css.count) {
    addPart("css  ", css);
  }
  if (js.count) {
    addPart("js   ", js);
  }
  if (json.count) {
    addPart("json ", json);
  }
  if (other.count) {
    addPart("other", other);
  }
  addPart("total", total);
  return `${indent}${ANSI.color("-", ANSI.GREY)} ${parts.join(`
${indent}${ANSI.color("-", ANSI.GREY)} `)}`;
};

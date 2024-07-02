import { createSupportsColor } from "supports-color";
import { createAnsi } from "./ansi_runtime_agnostic.js";

const processSupportsBasicColor = createSupportsColor(process.stdout).hasBasic;

export const ANSI = createAnsi({
  supported:
    processSupportsBasicColor ||
    // GitHub workflow does support ANSI but "supports-color" returns false
    // because stream.isTTY returns false, see https://github.com/actions/runner/issues/241
    process.env.GITHUB_WORKFLOW,
});

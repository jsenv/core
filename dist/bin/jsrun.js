#!/usr/bin/env node
"use strict";

var _getFromProcessArguments = require("./getFromProcessArguments.js");

var _run = require("../src/run/run.js");

// ce qu'on fera ptet pour rendre le truc generique c'4est utiliser un chemin de fichier absolu
// et en deduire root
const root = process.cwd();
const file = process.argv[1];
const port = (0, _getFromProcessArguments.getFromProcessArguments)("port") || 0;
const platform = (0, _getFromProcessArguments.getFromProcessArguments)("platform") || "node";
const watch = (0, _getFromProcessArguments.getFromProcessArguments)("watch") || false;
const instrument = (0, _getFromProcessArguments.getFromProcessArguments)("instrument") || false;
const headless = (0, _getFromProcessArguments.getFromProcessArguments)("headless") || false;
(0, _run.run)({
  root,
  file,
  port,
  platform,
  watch,
  instrument,
  headless
});
//# sourceMappingURL=jsrun.js.map
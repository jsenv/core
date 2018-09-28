#!/usr/bin/env node
"use strict";

var _getFromProcessArguments = require("./getFromProcessArguments.js");

var _run = require("../src/run/run.js");

// ce qu'on fera ptet pour rendre le truc generique c'4est utiliser un chemin de fichier absolu
// et en deduire root
var root = process.cwd();
var file = process.argv[1];
var port = (0, _getFromProcessArguments.getFromProcessArguments)("port") || 0;
var platform = (0, _getFromProcessArguments.getFromProcessArguments)("platform") || "node";
var watch = (0, _getFromProcessArguments.getFromProcessArguments)("watch") || false;
var instrument = (0, _getFromProcessArguments.getFromProcessArguments)("instrument") || false;
var headless = (0, _getFromProcessArguments.getFromProcessArguments)("headless") || false;
(0, _run.run)({
  root: root,
  file: file,
  port: port,
  platform: platform,
  watch: watch,
  instrument: instrument,
  headless: headless
});
//# sourceMappingURL=jsrun.js.map
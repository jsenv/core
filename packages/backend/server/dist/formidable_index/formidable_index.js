import { IncomingForm } from "./jsenv_server_node_modules.js";
export { DummyParser, PersistentFile as File, JSONParser, MultipartParser, OctetStreamParser, OctetStreamParser as OctetstreamParser, PersistentFile, QuerystringParser as QueryStringParser, QuerystringParser, VolatileFile, DEFAULT_OPTIONS as defaultOptions, plugin as json, plugin$1 as multipart, plugin$2 as octetstream, plugin$3 as querystring } from "./jsenv_server_node_modules.js";
import "node:domain";
import "node:events";
import "node:fs/promises";
import "node:os";
import "node:path";
import "node:string_decoder";
import "node:fs";
import "node:crypto";
import "node:stream";

// make it available without requiring the `new` keyword
// if you want it access `const formidable.IncomingForm` as v1
const formidable = (...args) => new IncomingForm(...args);

export { IncomingForm as Formidable, IncomingForm, formidable };

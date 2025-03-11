import { urlToFileSystemPath } from "@jsenv/urls";
import { basename, dirname } from "node:path";
import { assertAndNormalizeFileUrl } from "../path_and_url/file_url_validation.js";
import { readEntryStatSync } from "../read_write/stat/read_entry_stat_sync.js";
import { statsToType } from "../read_write/stat/stats_to_type.js";
import { callOnceIdle } from "./call_once_idle.js";
import { createWatcher } from "./create_watcher.js";
import { guardTooFastSecondCall } from "./guard_second_call.js";
import { trackResources } from "./track_resources.js";

const isMacos = process.platform === "darwin";
const isLinux = process.platform === "linux";
const isFreeBSD = process.platform === "freebsd";

export const registerFileLifecycle = (
  source,
  {
    added,
    updated,
    removed,
    notifyExistent = false,
    keepProcessAlive = true,
    cooldownBetweenFileEvents = 0,
    idleMs = 50,
  },
) => {
  const sourceUrl = assertAndNormalizeFileUrl(source);
  if (!undefinedOrFunction(added)) {
    throw new TypeError(`added must be a function or undefined, got ${added}`);
  }
  if (!undefinedOrFunction(updated)) {
    throw new TypeError(
      `updated must be a function or undefined, got ${updated}`,
    );
  }
  if (!undefinedOrFunction(removed)) {
    throw new TypeError(
      `removed must be a function or undefined, got ${removed}`,
    );
  }
  if (idleMs) {
    if (updated) {
      updated = callOnceIdle(updated, idleMs);
    }
  }
  if (cooldownBetweenFileEvents) {
    if (added) {
      added = guardTooFastSecondCall(added, cooldownBetweenFileEvents);
    }
    if (updated) {
      updated = guardTooFastSecondCall(updated, cooldownBetweenFileEvents);
    }
    if (removed) {
      removed = guardTooFastSecondCall(removed, cooldownBetweenFileEvents);
    }
  }

  const tracker = trackResources();

  const handleFileFound = ({ stat, existent }) => {
    const fileMutationStopWatching = watchFileMutation(sourceUrl, {
      updated,
      removed: () => {
        fileMutationStopTracking();
        watchFileAdded();
        if (removed) {
          removed();
        }
      },
      keepProcessAlive,
      stat,
    });
    const fileMutationStopTracking = tracker.registerCleanupCallback(
      fileMutationStopWatching,
    );

    if (added) {
      if (existent) {
        if (notifyExistent) {
          added({ existent: true });
        }
      } else {
        added({});
      }
    }
  };

  const watchFileAdded = () => {
    const fileCreationStopWatching = watchFileCreation(
      sourceUrl,
      (stat) => {
        fileCreationgStopTracking();
        handleFileFound({ stat, existent: false });
      },
      keepProcessAlive,
    );
    const fileCreationgStopTracking = tracker.registerCleanupCallback(
      fileCreationStopWatching,
    );
  };

  const { type, stat } = readFileInfo(sourceUrl);
  if (type === null) {
    if (added) {
      watchFileAdded();
    } else {
      throw new Error(
        `${urlToFileSystemPath(sourceUrl)} must lead to a file, found nothing`,
      );
    }
  } else if (type === "file") {
    handleFileFound({ stat, existent: true });
  } else {
    throw new Error(
      `${urlToFileSystemPath(
        sourceUrl,
      )} must lead to a file, type found instead`,
    );
  }

  return tracker.cleanup;
};

const readFileInfo = (url) => {
  try {
    const stat = readEntryStatSync(new URL(url));
    return {
      type: statsToType(stat),
      stat,
    };
  } catch (e) {
    if (e.code === "ENOENT") {
      return {
        type: null,
        stat: null,
      };
    }
    throw e;
  }
};

const undefinedOrFunction = (value) =>
  typeof value === "undefined" || typeof value === "function";

const watchFileCreation = (source, callback, keepProcessAlive) => {
  const sourcePath = urlToFileSystemPath(source);
  const sourceFilename = basename(sourcePath);
  const directoryPath = dirname(sourcePath);
  let directoryWatcher = createWatcher(directoryPath, {
    persistent: keepProcessAlive,
  });
  directoryWatcher.on("change", (eventType, filename) => {
    if (filename && filename !== sourceFilename) return;

    const { type, stat } = readFileInfo(source);
    // ignore if something else with that name gets created
    // we are only interested into files
    if (type !== "file") {
      return;
    }
    directoryWatcher.close();
    directoryWatcher = undefined;
    callback(stat);
  });

  return () => {
    if (directoryWatcher) {
      directoryWatcher.close();
    }
  };
};

const watchFileMutation = (
  sourceUrl,
  { updated, removed, keepProcessAlive, stat },
) => {
  let prevStat = stat;
  let watcher;

  const onChange = () => {
    const { type, stat } = readFileInfo(sourceUrl);

    if (type === null) {
      stopWatching();
      if (removed) {
        removed();
      }
    } else if (type === "file") {
      if (updated && shouldCallUpdated(stat, prevStat)) {
        updated();
      }
      if ((isMacos || isLinux || isFreeBSD) && prevStat.ino !== stat.ino) {
        stopWatching();
        watch();
      }
    }
    prevStat = stat;
  };

  const watch = () => {
    watcher = createWatcher(urlToFileSystemPath(sourceUrl), {
      persistent: keepProcessAlive,
    });
    watcher.on("change", onChange);
  };
  const stopWatching = () => {
    if (watcher) {
      watcher.close();
      watcher = undefined;
    }
  };
  watch();
  return stopWatching;
};

const shouldCallUpdated = (stat, prevStat) => {
  if (!stat.atimeMs) {
    return true;
  }
  if (stat.atimeMs <= stat.mtimeMs) {
    return true;
  }
  if (stat.mtimeMs !== prevStat.mtimeMs) {
    return true;
  }
  return false;
};

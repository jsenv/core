// we might wanna expose the sync versions as follows:
// readDirectory.sync()
// +1: very easy to switch between sync/async versions of a given function
// -1: code splitting
// -1: unusual

// path_and_url
export {
  validateDirectoryUrl,
  assertAndNormalizeDirectoryUrl,
} from "./path_and_url/directory_url_validation.js";
export {
  validateFileUrl,
  assertAndNormalizeFileUrl,
} from "./path_and_url/file_url_validation.js";
export { comparePathnames } from "./path_and_url/compare_pathnames.js";
export { ensureWindowsDriveLetter } from "./path_and_url/ensure_windows_drive_letter.js";

// list
export { collectDirectoryMatchReport } from "./list/collect_directory_match_report.js";
export { collectFiles } from "./list/collect_files.js";
export { listFilesMatching } from "./list/list_files_matching.js";

// read and write
export { ensureParentDirectories } from "./read_write/ensure_parent_directories.js";
export { readDirectory } from "./read_write/read_directory.js";
export { writeDirectory } from "./read_write/write_directory.js";
export { readFile } from "./read_write/read_file.js";
export { writeFile } from "./read_write/write_file.js";
export { readFileSync } from "./read_write/read_file_sync.js";
export { writeFileSync } from "./read_write/write_file_sync.js";
export { readSymbolicLink } from "./read_write/read_symbolic_link.js";
export { writeSymbolicLink } from "./read_write/write_symbolic_link.js";
// read and write sync
export { ensureParentDirectoriesSync } from "./read_write/ensure_parent_directories_sync.js";
export { readDirectorySync } from "./read_write/read_directory_sync.js";
export { getRealFileSystemUrlSync } from "./read_write/get_real_file_system_url_sync.js";
export { readSymbolicLinkSync } from "./read_write/read_symbolic_link_sync.js";
export { writeDirectorySync } from "./read_write/write_directory_sync.js";
export { readFileStructureSync } from "./read_write/read_file_structure_sync.js";
export { writeFileStructureSync } from "./read_write/write_file_structure_sync.js";

// stat
export { readEntryStat } from "./read_write/stat/read_entry_stat.js";
export { readEntryModificationTime } from "./read_write/stat/read_entry_modification_time.js";
export { writeEntryModificationTime } from "./read_write/stat/write_entry_modification_time.js";
export { readEntryPermissions } from "./read_write/stat/read_entry_permissions.js";
export { writeEntryPermissions } from "./read_write/stat/write_entry_permissions.js";
export { grantPermissionsOnEntry } from "./read_write/stat/grant_permissions_on_entry.js";
export { testEntryPermissions } from "./read_write/stat/test_entry_permissions.js";
// stat sync
export { readEntryStatSync } from "./read_write/stat/read_entry_stat_sync.js";
export { writeEntryModificationTimeSync } from "./read_write/stat/write_entry_modification_time_sync.js";

// move
export { moveDirectoryContent } from "./move/move_directory_content.js";
export { moveEntry } from "./move/move_entry.js";

// copy
export { copyEntry } from "./copy/copy_entry.js";
export { copyDirectoryContent } from "./copy/copy_directory_content.js";
export { copyEntrySync } from "./copy/copy_entry_sync.js";
export { copyDirectorySync } from "./copy/copy_directory_sync.js";
export { copyDirectoryContentSync } from "./copy/copy_directory_content_sync.js";

// remove
export { ensureEmptyDirectory } from "./remove/ensure_empty_directory.js";
export { ensureEmptyDirectorySync } from "./remove/ensure_empty_directory_sync.js";
export { clearDirectorySync } from "./remove/clear_directory_sync.js";
export { removeDirectory } from "./remove/remove_directory.js";
export { removeFile } from "./remove/remove_file.js";
export { removeEntry } from "./remove/remove_entry.js";
export { removeDirectorySync } from "./remove/remove_directory_sync.js";
export { removeFileSync } from "./remove/remove_file_sync.js";
export { removeEntrySync } from "./remove/remove_entry_sync.js";

// lifecycle
export { registerDirectoryLifecycle } from "./lifecycle/register_directory_lifecycle.js";
export { registerFileLifecycle } from "./lifecycle/register_file_lifecycle.js";

// other
export { assertDirectoryPresence } from "./assert_directory_presence.js";
export { assertFilePresence } from "./assert_file_presence.js";
export { bufferToEtag } from "./buffer_to_etag.js";

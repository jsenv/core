const IS_WINDOWS = process.platform === "win32"

export const HOSTS_FILE_PATH = IS_WINDOWS
  ? "C:\\Windows\\System32\\Drivers\\etc\\hosts"
  : "/etc/hosts"

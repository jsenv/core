const IS_WINDOWS = process.platform === "win32";

// https://github.com/feross/hostile/blob/master/index.js
export const parseHosts = (
  hosts,
  { EOL = IS_WINDOWS ? "\r\n" : "\n" } = {},
) => {
  const lines = [];
  hosts.split(/\r?\n/).forEach((line) => {
    const lineWithoutComments = line.replace(/#.*/, "");
    // eslint-disable-next-line regexp/no-super-linear-backtracking
    const matches = /^\s*?(.+?)\s+(.+?)\s*$/.exec(lineWithoutComments);
    if (matches && matches.length === 3) {
      const [, ip, host] = matches;
      const hostnames = host.split(" ");
      lines.push({ type: "rule", ip, hostnames });
    } else {
      // Found a comment, blank line, or something else
      lines.push({ type: "other", value: line });
    }
  });

  const getAllIpHostnames = () => {
    const ipHostnames = {};
    lines.forEach((line) => {
      if (line.type === "rule") {
        const { ip, hostnames } = line;
        const existingHostnames = ipHostnames[ip];
        ipHostnames[ip] = existingHostnames
          ? [...existingHostnames, ...hostnames]
          : hostnames;
      }
    });
    return ipHostnames;
  };

  const getIpHostnames = (ip) => {
    const hosts = [];
    lines.forEach((line) => {
      if (line.type === "rule" && line.ip === ip) {
        hosts.push(...line.hostnames);
      }
    });
    return hosts;
  };

  const addIpHostname = (ip, host) => {
    const alreadyThere = lines.some(
      (line) =>
        line.type === "rule" && line.ip === ip && line.hostnames.includes(host),
    );
    if (alreadyThere) {
      return false;
    }

    const rule = { type: "rule", ip, hostnames: [host] };
    const lastLineIndex = lines.length - 1;
    const lastLine = lines[lastLineIndex];
    // last line is just empty characters, put the rule above it
    if (lastLine.type === "other" && /\s*/.test(lastLine.value)) {
      lines.splice(lastLineIndex, 0, rule);
    } else {
      lines.push(rule);
    }
    return true;
  };

  const removeIpHostname = (ip, host) => {
    let lineIndexFound;
    let hostnamesFound;
    let hostIndexFound;
    const found = lines.find((line, lineIndex) => {
      if (line.type !== "rule") {
        return false;
      }
      if (line.ip !== ip) {
        return false;
      }
      const { hostnames } = line;
      const hostIndex = hostnames.indexOf(host);
      if (hostIndex === -1) {
        return false;
      }

      lineIndexFound = lineIndex;
      hostnamesFound = hostnames;
      hostIndexFound = hostIndex;
      return true;
    });

    if (!found) {
      return false;
    }

    if (hostnamesFound.length === 1) {
      lines.splice(lineIndexFound, 1);
      return true;
    }

    hostnamesFound.splice(hostIndexFound, 1);
    return true;
  };

  const asFileContent = () => {
    let hostsFileContent = "";
    const ips = lines
      .filter((line) => line.type === "rule")
      .map((line) => line.ip);
    const longestIp = ips.reduce((previous, ip) => {
      const length = ip.length;
      return length > previous ? length : previous;
    }, 0);

    lines.forEach((line, index) => {
      if (line.type === "rule") {
        const { ip, hostnames } = line;
        const ipLength = ip.length;
        const lengthDelta = longestIp - ipLength;
        hostsFileContent += `${ip}${" ".repeat(lengthDelta)} ${hostnames.join(
          " ",
        )}`;
      } else {
        hostsFileContent += line.value;
      }

      const nextLine = lines[index + 1];
      if (nextLine) {
        hostsFileContent += EOL;
      }
    });
    return hostsFileContent;
  };

  return {
    getAllIpHostnames,
    getIpHostnames,
    addIpHostname,
    removeIpHostname,
    asFileContent,
  };
};

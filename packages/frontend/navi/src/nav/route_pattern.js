/**
 * Custom route pattern matching system
 * Replaces URLPattern with a simpler, more predictable approach
 */

import { globalSignalRegistry } from "../state/state_signal.js";
import { compareTwoJsValues } from "../utils/compare_two_js_values.js";

const DEBUG =
  typeof process === "object" ? process.env.DEBUG === "true" : false;
const debug = (...args) => {
  if (DEBUG) {
    console.debug(...args);
  }
};

// Base URL management
let baseFileUrl;
let baseUrl;
export const setBaseUrl = (value) => {
  baseFileUrl = new URL(
    value,
    typeof window === "undefined" ? "http://localhost/" : window.location,
  ).href;
  baseUrl = new URL(".", baseFileUrl).href;
};
setBaseUrl(
  typeof window === "undefined"
    ? "/"
    : import.meta.dev
      ? new URL(window.HTML_ROOT_PATHNAME, window.location).href
      : window.location.origin,
);

/**
 * The single place where "this param was not provided, take the signal value"
 * happens while building a url. A weak param qualifies one visit, not the
 * screen: it enters a url only when the caller names it (or when it is already
 * in the url being preserved), so here it always reads as absent.
 * Not reading the signal also keeps the built url from depending on it.
 */
const readSignalForUrlBuild = (connection) => {
  if (!connection || !connection.signal) {
    return undefined;
  }
  if (connection.weak) {
    return undefined;
  }
  return connection.signal.value;
};

/**
 * Creates a custom route pattern matcher
 */
export const createRoutePattern = (
  pattern,
  { searchParams = {}, params: paramConstraints = {} } = {},
) => {
  // Detect and process path signals in the pattern
  const [cleanPattern, pathConnections] = detectSignals(pattern);

  // Build pathConnectionMap from path signals
  const pathConnectionMap = new Map();
  for (const connection of pathConnections) {
    pathConnectionMap.set(connection.paramName, connection);
  }

  // Build queryConnectionMap directly from searchParams
  const queryConnectionMap = new Map();
  for (const [paramName, searchParam] of Object.entries(searchParams)) {
    // A search param is the signal it syncs with, or that signal plus what the
    // state is worth ON THIS ROUTE: `{ signal, default }`. One state can start
    // somewhere else depending on the page it is read on — a wizard's step
    // opens on the first question where one is created and on the summary where
    // one is edited — without the state having to know which routes exist, and
    // without a route and a signal having to name each other.
    const paramSignal = searchParam.signal || searchParam;
    const routeDefaultValue = searchParam.signal
      ? searchParam.default
      : undefined;
    const signalId = paramSignal.__signalId;
    const registryEntry = globalSignalRegistry.get(signalId);
    if (registryEntry) {
      const { signal, options } = registryEntry;
      const connection = { paramName, signal, paramType: "query", ...options };
      if (routeDefaultValue !== undefined) {
        // Everything that asks "is this the default" asks this route, so the
        // param stays out of the address on the step this page opens on, and
        // an address that names none puts the state back on it.
        connection.staticDefaultValue = routeDefaultValue;
        connection.dynamicDefaultSignal = null;
        connection.getDefaultValue = () => routeDefaultValue;
        connection.isDefaultValue = (value) =>
          compareTwoJsValues(value, routeDefaultValue);
        connection.isCustomValue = (value) =>
          value !== undefined && !compareTwoJsValues(value, routeDefaultValue);
      }
      queryConnectionMap.set(paramName, connection);
    }
  }

  // All connections (path + query) for ancestor/descendant signal resolution
  const connections = [...pathConnections, ...queryConnectionMap.values()];

  const paramConstraintMap = createParamConstraintMap(paramConstraints);
  const parsedPattern = parsePattern(cleanPattern, {
    pathConnectionMap,
    queryConnectionMap,
    paramConstraintMap,
  });
  if (import.meta.dev) {
    warnOnParamConstraintWithoutSegment(paramConstraintMap, parsedPattern);
  }

  debug(`[CustomPattern] Created pattern:`, parsedPattern);
  debug(`[CustomPattern] Signal connections:`, connections);
  debug(`[CustomPattern] Path connections:`, pathConnectionMap.size);
  debug(`[CustomPattern] Query connections:`, queryConnectionMap.size);

  /**
   * @param {string} url
   * @param {object} [options]
   * @param {boolean} [options.exact] - Only match the url this pattern is the
   *   address of: a trailing slash or a wildcard stops catching what lies below
   *   it. What "/" means for a container ("everything under me") and what it
   *   means for a redirection ("that very address") are not the same question.
   */
  const applyOn = (url, { exact = false } = {}) => {
    const result = matchUrl(parsedPattern, url, {
      baseUrl,
      baseFileUrl,
      queryConnectionMap,
      paramConstraintMap,
      exact,
      patternObj: patternObject,
    });

    debug(
      `[CustomPattern] Matching "${url}" against "${cleanPattern}":`,
      result,
    );

    return result;
  };

  const resolveParams = (providedParams = {}) => {
    const resolvedParams = { ...providedParams };

    // Signal values for parameters that were not explicitly provided
    for (const connection of connections) {
      const { paramName } = connection;
      if (paramName in providedParams) {
        // Parameter was explicitly provided - always respect explicit parameters
        continue;
      }
      const signalValue = readSignalForUrlBuild(connection);
      if (signalValue !== undefined) {
        resolvedParams[paramName] = signalValue;
      }
    }

    // Defaults for parameters that are still missing
    for (const connection of connections) {
      const { paramName } = connection;
      if (paramName in resolvedParams) {
        continue;
      }
      const currentDefault = connection.getDefaultValue();
      if (currentDefault !== undefined) {
        resolvedParams[paramName] = currentDefault;
      }
    }

    // Inherit search parameters from ancestry chain
    // Search params are global and should be inherited from any matching ancestor
    // regardless of path segment relationships
    let ancestorPatternObj = patternObject.parent;
    while (ancestorPatternObj) {
      for (const [
        paramName,
        ancestorConnection,
      ] of ancestorPatternObj.queryConnectionMap) {
        // Skip if this parameter is already resolved
        if (paramName in resolvedParams) {
          continue;
        }

        const ancestorSignalValue = readSignalForUrlBuild(ancestorConnection);
        if (
          ancestorSignalValue !== undefined &&
          ancestorSignalValue !== ancestorConnection.getDefaultValue()
        ) {
          // Inherit non-default values from ancestors
          resolvedParams[paramName] = ancestorSignalValue;
        }
      }
      ancestorPatternObj = ancestorPatternObj.parent;
    }

    // Include active non-default parameters from child routes for URL optimization
    // Only include from child routes that would actually match the current parameters
    const childPatternObjs = patternObject.children;
    for (const childPatternObj of childPatternObjs) {
      // Check if this child route would match the current resolved parameters
      // by simulating URL building and seeing if the child segments align
      let childWouldMatch = true;

      // Compare child segments with what would be built from current params
      for (let i = 0; i < childPatternObj.pattern.segments.length; i++) {
        const childSegment = childPatternObj.pattern.segments[i];
        const parentSegment = parsedPattern.segments[i];

        if (childSegment.type === "literal") {
          if (parentSegment && parentSegment.type === "param") {
            // Child has literal where parent has parameter - check if values match
            const paramValue = resolvedParams[parentSegment.name];
            if (paramValue !== childSegment.value) {
              childWouldMatch = false;
              break;
            }
          } else if (!parentSegment) {
            // Child has literal segments beyond parent's segments
            // Check if this route can be reached through intermediate routes in the hierarchy
            let canReachThroughIntermediates = false;

            // Look for intermediate routes that could bridge the gap
            const intermediateRoutes = patternObject.children;
            for (const intermediateRoute of intermediateRoutes) {
              // Check if intermediate route has a parameter at this position
              const intermediateSegment = intermediateRoute.pattern.segments[i];
              if (intermediateSegment && intermediateSegment.type === "param") {
                // Check if the child's literal value could match this parameter
                // This means there's a potential path: parent → intermediate → child
                canReachThroughIntermediates = true;
                break;
              }
            }

            if (!canReachThroughIntermediates) {
              // No viable path through intermediates - truly unreachable
              childWouldMatch = false;
              break;
            }
          } else if (
            parentSegment.type === "literal" &&
            parentSegment.value !== childSegment.value
          ) {
            // Both have literals but they don't match
            childWouldMatch = false;
            break;
          }
          // If parent also has matching literal at this position, continue
        }
        // Parameter segments are always compatible if parent has corresponding segment
      }

      if (childWouldMatch) {
        // Only check child query parameters - path parameters should not be inherited as search params
        for (const [
          childParam,
          childConnection,
        ] of childPatternObj.queryConnectionMap) {
          if (childParam in resolvedParams) {
            continue;
          }
          const childSignalValue = readSignalForUrlBuild(childConnection);
          // Only include if not already resolved and is non-default
          if (
            childSignalValue !== undefined &&
            childSignalValue !== childConnection.getDefaultValue()
          ) {
            resolvedParams[childParam] = childSignalValue;
          }
        }
      }
    }

    return resolvedParams;
  };

  /**
   * Generate-and-verify url building.
   *
   * One hard rule: a built url must ROUND-TRIP. Matched back against the
   * route family and re-resolved (defaults included), it must reproduce
   * exactly the state it was built from — and it must still match this
   * route. The verifier makes a wrong url impossible; the candidate order
   * then decides which of several faithful urls is canonical:
   *
   * - highest ancestor first: when everything this route adds over an
   *   ancestor is default values, the ancestor's shorter url is the same
   *   place ("/admin/settings" with default tab IS "/admin")
   * - the route itself
   * - descendants, deepest first: a descendant url is used when it carries
   *   custom state that this route's own url cannot encode (a tab the user
   *   selected must survive "/admin" being rebuilt)
   */

  /**
   * The state a url built by this route must encode, as a Map of
   * paramName -> { value, connection, segmentIndex, owner, explicit }.
   * owner is relative to this route: "own" | "ancestor" | "descendant" | "extra".
   *
   * Sources, in priority order (first write wins):
   * - explicit params (an explicit undefined pins the param to its default)
   * - own connection signals (path + query, inherited query included)
   * - ancestor path params pinned by this pattern's own literals: being on
   *   "/admin/settings" MEANS section=settings, whatever the signal says
   * - ancestor query signals holding custom values
   * - reachable descendants' connection signals. A descendant is reachable
   *   when its literals agree with the state collected so far (a tab value
   *   is unreachable while section conflicts with the tab route's literals)
   *   and its extra literals are justified by a param value (building "/"
   *   must not teleport to "/admin").
   *
   * Every family signal is read (not only the stored ones) so that a url
   * computed inside a preact computed() subscribes to all of them.
   */
  const buildIntendedState = (explicitParams) => {
    const intended = new Map();
    const reachableDescendants = new Set();
    const setEntry = (
      name,
      value,
      connection,
      segmentIndex,
      owner,
      explicit,
      pageNaming = false,
    ) => {
      if (intended.has(name)) {
        return;
      }
      intended.set(name, {
        value,
        connection,
        segmentIndex,
        owner,
        explicit,
        pageNaming,
      });
    };
    const paramSegmentIndex = (patternObj, name) => {
      const seg = patternObj.pattern.segments.find(
        (s) => s.type === "param" && s.name === name,
      );
      return seg ? seg.index : undefined;
    };
    const findFamilyConnection = (name) => {
      const own = pathConnectionMap.get(name) || queryConnectionMap.get(name);
      if (own) {
        return {
          connection: own,
          segmentIndex: paramSegmentIndex(patternObject, name),
          owner: "own",
        };
      }
      let ancestor = patternObject.parent;
      while (ancestor) {
        const conn =
          ancestor.pathConnectionMap.get(name) ||
          ancestor.queryConnectionMap.get(name);
        if (conn) {
          return {
            connection: conn,
            segmentIndex: paramSegmentIndex(ancestor, name),
            owner: "ancestor",
          };
        }
        ancestor = ancestor.parent;
      }
      let found = null;
      const visit = (patternObj) => {
        for (const child of patternObj.children) {
          if (found) {
            return;
          }
          const conn =
            child.pathConnectionMap.get(name) ||
            child.queryConnectionMap.get(name);
          if (conn) {
            found = {
              connection: conn,
              segmentIndex: paramSegmentIndex(child, name),
              owner: "descendant",
            };
            return;
          }
          visit(child);
        }
      };
      visit(patternObject);
      return (
        found || {
          connection: undefined,
          segmentIndex: undefined,
          owner: "extra",
        }
      );
    };

    for (const [name, value] of Object.entries(explicitParams)) {
      const { connection, segmentIndex, owner } = findFamilyConnection(name);
      setEntry(name, value, connection, segmentIndex, owner, true);
    }
    for (const connection of connections) {
      const { paramName } = connection;
      const value = readSignalForUrlBuild(connection);
      if (value !== undefined) {
        setEntry(
          paramName,
          value,
          connection,
          paramSegmentIndex(patternObject, paramName),
          "own",
          false,
        );
      }
    }
    let ancestor = patternObject.parent;
    while (ancestor) {
      for (const seg of ancestor.pattern.segments) {
        if (seg.type !== "param" || intended.has(seg.name)) {
          continue;
        }
        const conn = ancestor.pathConnectionMap.get(seg.name);
        if (!conn) {
          continue;
        }
        const selfSeg = parsedPattern.segments[seg.index];
        if (selfSeg && selfSeg.type === "literal") {
          setEntry(seg.name, selfSeg.value, conn, seg.index, "ancestor", false);
        }
      }
      for (const [name, conn] of ancestor.queryConnectionMap) {
        if (intended.has(name)) {
          continue;
        }
        const value = readSignalForUrlBuild(conn);
        if (value !== undefined && conn.isCustomValue(value)) {
          setEntry(name, value, conn, undefined, "ancestor", false);
        }
      }
      ancestor = ancestor.parent;
    }

    const intendedValueAt = (name) => {
      const entry = intended.get(name);
      return entry ? entry.value : undefined;
    };
    const isDescendantReachable = (descendant) => {
      const selfSegments = parsedPattern.segments;
      for (const dSeg of descendant.pattern.segments) {
        if (dSeg.type !== "literal") {
          continue;
        }
        const selfSeg = selfSegments[dSeg.index];
        if (selfSeg) {
          if (selfSeg.type === "literal") {
            if (selfSeg.value !== dSeg.value) {
              return false;
            }
            continue;
          }
          const value = intendedValueAt(selfSeg.name);
          if (value === undefined || String(value) !== dSeg.value) {
            return false;
          }
          continue;
        }
        // beyond this route's own segments: the literal must be justified by
        // a custom param value at the same position, or by an explicit value
        const connsAtPosition =
          patternObject.descendantPathSignals.get(dSeg.index) || [];
        const justifiedBySignal = connsAtPosition.some((conn) => {
          const entry = intended.get(conn.paramName);
          return (
            entry &&
            entry.value !== undefined &&
            conn.isCustomValue(entry.value) &&
            String(entry.value) === dSeg.value
          );
        });
        if (justifiedBySignal) {
          continue;
        }
        const justifiedByExplicit = [...intended.values()].some(
          (entry) => entry.explicit && String(entry.value) === dSeg.value,
        );
        if (!justifiedByExplicit) {
          return false;
        }
      }
      return true;
    };
    // Query values are inherited under a LOOSER rule than path descent: the
    // descendant's extra literals only need a param position to exist there,
    // not a param value naming them. Leaving a sub screen keeps its query
    // prefs in the url; entering it by literal requires a value that says so.
    const isDescendantQueryReachable = (descendant) => {
      const selfSegments = parsedPattern.segments;
      for (const dSeg of descendant.pattern.segments) {
        if (dSeg.type !== "literal") {
          continue;
        }
        const selfSeg = selfSegments[dSeg.index];
        if (selfSeg) {
          if (selfSeg.type === "literal") {
            if (selfSeg.value !== dSeg.value) {
              return false;
            }
            continue;
          }
          const entry = intended.get(selfSeg.name);
          const conn = pathConnectionMap.get(selfSeg.name);
          const value =
            entry && entry.value !== undefined
              ? entry.value
              : conn
                ? conn.getDefaultValue()
                : undefined;
          if (String(value) !== dSeg.value) {
            return false;
          }
          continue;
        }
        const connsAtPosition = patternObject.descendantPathSignals.get(
          dSeg.index,
        );
        if (!connsAtPosition || connsAtPosition.length === 0) {
          return false;
        }
      }
      return true;
    };
    const visitDescendants = (patternObj) => {
      for (const child of patternObj.children) {
        const reachable = isDescendantReachable(child);
        if (reachable) {
          reachableDescendants.add(child);
        }
        const queryReachable = reachable || isDescendantQueryReachable(child);
        for (const conn of child.connections) {
          if (conn.inherited) {
            continue;
          }
          const { paramName } = conn;
          // read even when the value is not kept: subscribes the caller
          const value = readSignalForUrlBuild(conn);
          if (intended.has(paramName)) {
            continue;
          }
          if (conn.paramType === "path") {
            if (!reachable || value === undefined) {
              continue;
            }
            // A param whose other values are declared as literal routes and
            // which has a default NAMES pages: this route's url stays the
            // url of the default value, it does not follow the signal. The
            // value still travels along when something else picks the page
            // (pageNaming entries build urls but neither trigger descent nor
            // fail verification).
            const pageNaming =
              conn.namedByLiteralRoutes &&
              conn.getDefaultValue() !== undefined &&
              !pathConnectionMap.has(paramName);
            setEntry(
              paramName,
              value,
              conn,
              paramSegmentIndex(child, paramName),
              "descendant",
              false,
              pageNaming,
            );
            continue;
          }
          if (!queryReachable || value === undefined) {
            continue;
          }
          if (conn.isCustomValue(value)) {
            setEntry(paramName, value, conn, undefined, "descendant", false);
          }
        }
        visitDescendants(child);
      }
    };
    visitDescendants(patternObject);

    return { intended, reachableDescendants };
  };

  /**
   * The natural url of one candidate route for the intended state.
   * Values are placed where they belong: path params in the path, query
   * connections and explicit extras in the query string. A meaningful path
   * value the candidate can express neither as a param nor as a matching
   * literal disqualifies it — except an explicit value for an ancestor path
   * param, which travels as a search param ("/admin/settings?section=toto").
   */
  const buildCandidateUrl = (
    candidate,
    intended,
    { dropMissing, lenient } = {},
  ) => {
    const urlParams = {};
    const candidateSegments = candidate.pattern.segments;
    for (const seg of candidateSegments) {
      if (seg.type !== "param") {
        continue;
      }
      const entry = intended.get(seg.name);
      if (!entry || entry.value === undefined) {
        continue;
      }
      const meaningful = entry.connection
        ? entry.connection.isCustomValue(entry.value)
        : true;
      if (meaningful) {
        urlParams[seg.name] = entry.value;
      }
    }
    for (const [name, entry] of intended) {
      if (name in urlParams) {
        continue;
      }
      if (entry.value === undefined) {
        continue;
      }
      const conn = entry.connection;
      if (!conn) {
        if (entry.explicit) {
          urlParams[name] = entry.value;
        }
        continue;
      }
      if (!conn.isCustomValue(entry.value)) {
        continue;
      }
      if (conn.paramType === "path") {
        const literalSeg =
          entry.segmentIndex === undefined
            ? undefined
            : candidateSegments[entry.segmentIndex];
        if (
          literalSeg &&
          literalSeg.type === "literal" &&
          literalSeg.value === String(entry.value)
        ) {
          continue; // the candidate's path itself encodes this value
        }
        if (entry.explicit && entry.owner === "ancestor") {
          urlParams[name] = entry.value;
          continue;
        }
        if (entry.pageNaming) {
          // deliberately left out: this url does not follow the signal
          continue;
        }
        if (lenient) {
          if (entry.explicit) {
            urlParams[name] = entry.value;
          }
          continue;
        }
        return null;
      }
      urlParams[name] = entry.value;
    }
    let buildPattern = candidate.pattern;
    if (dropMissing) {
      const keptSegments = candidateSegments.filter(
        (seg) => seg.type !== "param" || seg.name in urlParams,
      );
      if (keptSegments.length !== candidateSegments.length) {
        buildPattern = { ...buildPattern, segments: keptSegments };
        if (buildPattern.trailingSlash) {
          buildPattern.trailingSlash = false;
        }
      }
    }
    const url = buildUrlFromPattern(
      buildPattern,
      urlParams,
      candidate.originalPattern,
      candidate,
    );
    if (url.includes("/:")) {
      return null;
    }
    return url;
  };

  const urlValueEquals = (intendedValue, reproducedValue) => {
    let a = intendedValue;
    if (a && typeof a === "object" && a[rawUrlPartSymbol]) {
      a = a.value;
    }
    if (a instanceof Date) {
      const yyyy = a.getUTCFullYear();
      const mm = String(a.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(a.getUTCDate()).padStart(2, "0");
      a = `${yyyy}-${mm}-${dd}`;
    }
    if (compareTwoJsValues(a, reproducedValue)) {
      return true;
    }
    if (a === true && reproducedValue === "") {
      // `true` is written as a bare "?flag", which an untyped connection
      // reads back as an empty string
      return true;
    }
    return String(a) === String(reproducedValue);
  };

  /**
   * Does the url reproduce the intended state?
   * A connection's reproduced value is what the url gives back on a reload:
   * the value extracted by a matching family pattern that carries the
   * connection, or the connection's default when no matching pattern does.
   */
  const verifyUrl = (url, intended) => {
    if (!applyOn(url)) {
      return false; // whatever this url is, it is not one of OUR urls
    }
    const familyPatterns = [];
    const seen = new Set();
    const visit = (patternObj) => {
      if (seen.has(patternObj)) {
        return;
      }
      seen.add(patternObj);
      familyPatterns.push(patternObj);
      for (const child of patternObj.children) {
        visit(child);
      }
    };
    visit(patternObject.familyRoot || patternObject);
    const matchResultMap = new Map();
    for (const familyPattern of familyPatterns) {
      matchResultMap.set(familyPattern, familyPattern.applyOn(url));
    }
    for (const [name, entry] of intended) {
      const conn = entry.connection;
      if (!conn) {
        continue; // extra params have no state to lose
      }
      if (entry.pageNaming) {
        continue; // losing it is deliberate (see buildIntendedState)
      }
      let reproducedValue;
      let extracted = false;
      for (const familyPattern of familyPatterns) {
        const matchResult = matchResultMap.get(familyPattern);
        if (!matchResult) {
          continue;
        }
        const holdsParam =
          familyPattern.queryConnectionMap.has(name) ||
          familyPattern.pattern.segments.some(
            (seg) => seg.type === "param" && seg.name === name,
          );
        if (!holdsParam) {
          continue;
        }
        if (name in matchResult && matchResult[name] !== undefined) {
          reproducedValue = matchResult[name];
          extracted = true;
          break;
        }
      }
      if (!extracted) {
        reproducedValue = conn.getDefaultValue();
      }
      const wantedValue =
        entry.value === undefined ? conn.getDefaultValue() : entry.value;
      if (!urlValueEquals(wantedValue, reproducedValue)) {
        return false;
      }
    }
    return true;
  };

  /**
   * When may this route's url collapse to an ancestor's shorter url?
   * Policy kept from behavior the round-trip check cannot decide alone
   * (several faithful urls exist, one is canonical):
   * - immediate parent, when this pattern's literals sitting at the parent's
   *   param positions all spell the params' DEFAULT values ("/admin/settings"
   *   is "/admin" when settings is the default section) — custom query values
   *   ride along, custom own path values forbid it
   * - immediate parent otherwise: only when none of this route's own
   *   (non-inherited) connections holds a custom value
   * - higher ancestors: only for a pure-literal route with no connections
   */
  const isAncestorCollapseAllowed = (ancestorPattern, intended) => {
    const entryIsMeaningful = (conn) => {
      const entry = intended.get(conn.paramName);
      return (
        Boolean(entry) &&
        entry.value !== undefined &&
        conn.isCustomValue(entry.value)
      );
    };
    if (ancestorPattern !== patternObject.parent) {
      return (
        connections.length === 0 &&
        parsedPattern.segments.every((seg) => seg.type === "literal")
      );
    }
    let literalsPinDefaults = false;
    for (const seg of ancestorPattern.pattern.segments) {
      if (seg.type !== "param") {
        continue;
      }
      const conn = ancestorPattern.pathConnectionMap.get(seg.name);
      const selfSeg = parsedPattern.segments[seg.index];
      if (!conn || !selfSeg || selfSeg.type !== "literal") {
        continue;
      }
      if (selfSeg.value !== String(conn.getDefaultValue())) {
        literalsPinDefaults = false;
        break;
      }
      literalsPinDefaults = true;
    }
    if (literalsPinDefaults) {
      return !connections.some(
        (conn) =>
          !conn.inherited &&
          conn.paramType === "path" &&
          entryIsMeaningful(conn),
      );
    }
    return !connections.some(
      (conn) => !conn.inherited && entryIsMeaningful(conn),
    );
  };

  const buildMostPreciseUrl = (params = {}) => {
    const { intended, reachableDescendants } = buildIntendedState(params);
    // ancestors: start at the immediate parent, climb while urls keep round-
    // tripping, keep the highest one ("/" is never a target)
    let ancestorUrl = null;
    let ancestor = patternObject.parent;
    while (ancestor && ancestor.originalPattern !== "/") {
      if (!isAncestorCollapseAllowed(ancestor, intended)) {
        break;
      }
      const url = buildCandidateUrl(ancestor, intended, {
        dropMissing: true,
      });
      if (!url || !verifyUrl(url, intended)) {
        break;
      }
      debug(
        `[${pattern}] ancestor url ${url} (via ${ancestor.originalPattern})`,
      );
      ancestorUrl = url;
      ancestor = ancestor.parent;
    }
    if (ancestorUrl) {
      return ancestorUrl;
    }
    const selfUrl = buildCandidateUrl(patternObject, intended, {
      dropMissing: true,
    });
    if (selfUrl && verifyUrl(selfUrl, intended)) {
      return selfUrl;
    }
    // deepest reachable descendant whose url round-trips, walking greedily
    let current = patternObject;
    let descendantUrl = null;
    descend: while (true) {
      for (const child of current.children) {
        if (!reachableDescendants.has(child)) {
          continue;
        }
        const url = buildCandidateUrl(child, intended);
        if (url && verifyUrl(url, intended)) {
          debug(
            `[${pattern}] descendant url ${url} (via ${child.originalPattern})`,
          );
          descendantUrl = url;
          current = child;
          continue descend;
        }
      }
      break;
    }
    if (descendantUrl) {
      return descendantUrl;
    }
    // no url round-trips (state not fully representable): this route's own
    // url, dropping what it cannot encode
    return (
      buildCandidateUrl(patternObject, intended, {
        dropMissing: true,
        lenient: true,
      }) || "/"
    );
  };

  // Returns the pathname that this route's own literal prefix resolves to.
  // For route "/": "/"
  // For route "/profile/": "/profile/"
  // For route "/map/isochrone/compare": "/map/isochrone/compare"
  // For route "/map/isochrone/:tab=/": "/map/isochrone/" (literal prefix before first param)
  const getOwnBasePathname = () => {
    const segments = parsedPattern.segments;
    if (segments.length === 0) {
      return new URL(resolveRouteUrl("/")).pathname;
    }
    const literalSegments = [];
    for (const seg of segments) {
      if (seg.type !== "literal") {
        break;
      }
      literalSegments.push(seg.value);
    }
    if (literalSegments.length === 0) {
      return new URL(resolveRouteUrl("/")).pathname;
    }
    const prefix = `/${literalSegments.join("/")}/`;
    return new URL(resolveRouteUrl(prefix)).pathname;
  };

  // Like buildMostPreciseUrl but takes the actual current browser URL into account.
  // When buildMostPreciseUrl returns the route's own base URL (catch-all matching an
  // unrepresentable path like "/404") the current pathname is preserved and only
  // search params are updated. When buildMostPreciseUrl performs an ancestor
  // optimisation (e.g. "/map/isochrone/compare" → "/map/isochrone") it is trusted
  // as-is because the built pathname will differ from the route's own base pathname.
  // Weak params are never inherited from their signal, but a url that already
  // carries one keeps it: staying on the same screen while another param
  // changes must not end the visit this param qualifies.
  const carryOverWeakParams = (currentUrl, params) => {
    let paramsWithWeak = params;
    for (const connection of connections) {
      const { paramName } = connection;
      if (!connection.weak || paramName in paramsWithWeak) {
        continue;
      }
      const currentValue = connection.signal.peek();
      if (currentValue === undefined) {
        continue;
      }
      const currentParams = applyOn(currentUrl);
      if (!currentParams || currentParams[paramName] === undefined) {
        continue;
      }
      if (paramsWithWeak === params) {
        paramsWithWeak = { ...params };
      }
      paramsWithWeak[paramName] = currentParams[paramName];
    }
    return paramsWithWeak;
  };

  // A path param nothing answers for is READ from the url being amended. The
  // url is the truth about where one stands; rebuilding the pattern without it
  // would drop the segment and move the page — writing one search param must
  // never do that. A param a signal is bound to is left alone: the signal
  // answers for it, and buildMostPreciseUrl reads it.
  const carryOverPathParams = (currentUrl, params) => {
    let paramsWithPath = params;
    let currentParams;
    for (const segment of parsedPattern.segments) {
      if (segment.type !== "param") {
        continue;
      }
      const paramName = segment.name;
      if (paramName in paramsWithPath || pathConnectionMap.has(paramName)) {
        continue;
      }
      if (currentParams === undefined) {
        currentParams = applyOn(currentUrl) || null;
      }
      if (!currentParams || currentParams[paramName] === undefined) {
        continue;
      }
      if (paramsWithPath === params) {
        paramsWithPath = { ...params };
      }
      paramsWithPath[paramName] = currentParams[paramName];
    }
    return paramsWithPath;
  };

  const buildUrlPreservingPath = (currentUrl, params = {}) => {
    params = carryOverWeakParams(currentUrl, params);
    if (currentUrl) {
      params = carryOverPathParams(currentUrl, params);
    }
    const relativeBuiltUrl = buildMostPreciseUrl(params);
    if (!currentUrl) {
      return resolveRouteUrl(relativeBuiltUrl);
    }
    const absoluteBuiltUrl = resolveRouteUrl(relativeBuiltUrl);
    const builtPathname = new URL(absoluteBuiltUrl).pathname;
    const currentPathname = new URL(currentUrl).pathname;
    if (builtPathname === currentPathname) {
      return absoluteBuiltUrl;
    }
    const ownBasePathname = getOwnBasePathname();
    if (builtPathname === ownBasePathname) {
      // Catch-all: the route resolved to its own base pathname but the current URL
      // sits on a different path that this trailing-slash route caught.  Keep the
      // current pathname and only update the search string.
      const correctedUrl = new URL(currentUrl);
      correctedUrl.search = new URL(absoluteBuiltUrl).search;
      return correctedUrl.href;
    }
    // Ancestor optimisation or descendant selection — trust buildMostPreciseUrl.
    return absoluteBuiltUrl;
  };

  // Pattern object with unified data and methods
  const patternObject = {
    urlPatternRaw: pattern,
    cleanPattern,
    connections,
    pathConnectionMap, // Separate map for path parameters
    queryConnectionMap, // Separate map for query parameters
    paramConstraintMap, // Which values each param accepts (Map<paramName, test>)
    parsedPattern,
    children: [],
    parent: null,
    familyRoot: null, // Topmost ancestor, computed during setupPatterns
    depth: 0, // Will be calculated after relationships are built
    descendantPathSignals: new Map(), // Precomputed during setupPatterns (Map<segmentIndex, conn[]>)

    originalPattern: pattern,
    pattern: parsedPattern,
    applyOn,
    buildMostPreciseUrl,
    buildUrlPreservingPath,
    resolveParams,
  };

  return patternObject;
};

// Raw URL part functionality for bypassing encoding
const rawUrlPartSymbol = Symbol("raw_url_part");
export const rawUrlPart = (value) => {
  return {
    [rawUrlPartSymbol]: true,
    value,
  };
};

/**
 * Encode parameter values for URL usage, with special handling for raw URL parts.
 * When a parameter is wrapped with rawUrlPart(), it bypasses encoding and is
 * inserted as-is into the URL.
 */
const encodeParamValue = (value, isWildcard = false) => {
  if (value && value[rawUrlPartSymbol]) {
    return value.value;
  }

  if (isWildcard) {
    // For wildcards, only encode characters that are invalid in URL paths,
    // but preserve slashes as they are path separators
    return value
      ? value.replace(/[^a-zA-Z0-9\-._~!$&'()*+,;=:@/]/g, (char) => {
          return encodeURIComponent(char);
        })
      : value;
  }

  // For named parameters and search params, encode everything including slashes
  return encodeURIComponent(value);
};

// Function to detect signals in route patterns and connect them
const detectSignals = (routePattern) => {
  const signalConnections = [];
  let updatedPattern = routePattern;

  // Look for path signals: :paramName={navi_state_signal:id}
  const signalParamRegex = /(:)(\w+)(=)?(\{navi_state_signal:[^}]+\})/g;
  let match;

  while ((match = signalParamRegex.exec(routePattern)) !== null) {
    const [fullMatch, prefix, paramName, equalSign, signalString] = match;

    // Emit warning if equal sign is missing
    if (!equalSign) {
      console.warn(
        `[detectSignals] Missing '=' sign in route pattern: "${prefix}${paramName}${signalString}". ` +
          `Consider using "${prefix}${paramName}=${signalString}" for better clarity.`,
      );
    }

    // Extract the signal ID from the format: {navi_state_signal:id}
    const signalIdMatch = signalString.match(/\{navi_state_signal:([^}]+)\}/);
    if (!signalIdMatch) {
      console.warn(
        `[detectSignals] Failed to extract signal ID from: ${signalString}`,
      );
      continue;
    }

    const signalId = signalIdMatch[1];
    const signalData = globalSignalRegistry.get(signalId);

    if (signalData) {
      const { signal, options } = signalData;
      updatedPattern = updatedPattern.replace(fullMatch, `:${paramName}`);
      signalConnections.push({
        paramName,
        signal,
        paramType: "path",
        ...options,
      });
    } else {
      console.warn(
        `[detectSignals] Signal not found in registry for ID: "${signalId}"`,
      );
      console.warn(
        `[detectSignals] Available signal IDs in registry:`,
        Array.from(globalSignalRegistry.keys()),
      );
      console.warn(`[detectSignals] Full pattern: "${routePattern}"`);
    }
  }

  return [updatedPattern, signalConnections];
};

const EMPTY_PARAM_CONSTRAINT_MAP = new Map();

/**
 * Turns `{ gameId: /^W-[A-Z0-9]{8}$/i }` into `Map<paramName, (value) => boolean>`.
 * A constraint is a regexp, a list of accepted values, or a predicate.
 * A constraint decides which url segments the param accepts; a segment it
 * declines makes the whole route a non-match, so only path params can carry
 * one — a search param is extracted from a url the path already matched.
 */
const createParamConstraintMap = (paramConstraints) => {
  const entries = Object.entries(paramConstraints);
  if (entries.length === 0) {
    return EMPTY_PARAM_CONSTRAINT_MAP;
  }
  const paramConstraintMap = new Map();
  for (const [paramName, constraint] of entries) {
    if (constraint instanceof RegExp) {
      paramConstraintMap.set(paramName, (value) => {
        constraint.lastIndex = 0; // a /g or /y regexp would otherwise resume where the previous test stopped
        return constraint.test(value);
      });
      continue;
    }
    if (Array.isArray(constraint)) {
      // a url segment is a string, so the list is compared as strings:
      // `oneOf: [1, 2, 3]` accepts "/2"
      const acceptedValueSet = new Set(
        constraint.map((value) => String(value)),
      );
      paramConstraintMap.set(paramName, (value) => acceptedValueSet.has(value));
      continue;
    }
    if (typeof constraint === "function") {
      paramConstraintMap.set(paramName, (value) => Boolean(constraint(value)));
      continue;
    }
    throw new TypeError(
      `params.${paramName} must be a regexp, an array of values or a function, got ${constraint}`,
    );
  }
  return paramConstraintMap;
};

const warnOnParamConstraintWithoutSegment = (
  paramConstraintMap,
  parsedPattern,
) => {
  for (const paramName of paramConstraintMap.keys()) {
    const hasSegment = parsedPattern.segments.some(
      (segment) => segment.type === "param" && segment.name === paramName,
    );
    if (!hasSegment) {
      console.warn(
        `params.${paramName} has no effect on "${parsedPattern.original}": there is no ":${paramName}" segment in this pattern`,
      );
    }
  }
};

/**
 * Parse a route pattern string into structured segments
 */
const parsePattern = (
  pattern,
  {
    pathConnectionMap,
    queryConnectionMap,
    paramConstraintMap = EMPTY_PARAM_CONSTRAINT_MAP,
  },
) => {
  // Build queryParams from queryConnectionMap
  const queryParams = [];
  for (const [paramName, connection] of queryConnectionMap) {
    queryParams.push({
      type: "query_param",
      name: paramName,
      hasDefaultValue: connection.getDefaultValue() !== undefined,
    });
  }

  // Handle root route
  if (pattern === "/") {
    return {
      original: pattern,
      segments: [],
      trailingSlash: true,
      wildcard: false,
      queryParams,
    };
  }

  // Remove leading slash for processing the path portion
  let cleanPattern = pattern.startsWith("/") ? pattern.slice(1) : pattern;

  // Check for wildcard first
  const wildcard = cleanPattern.endsWith("*");
  if (wildcard) {
    cleanPattern = cleanPattern.slice(0, -1); // Remove *
    // Also remove the slash before * if present
    if (cleanPattern.endsWith("/")) {
      cleanPattern = cleanPattern.slice(0, -1);
    }
  }

  // Check for trailing slash (after wildcard check)
  const trailingSlash = !wildcard && pattern.endsWith("/");
  if (trailingSlash) {
    cleanPattern = cleanPattern.slice(0, -1); // Remove trailing /
  }

  // Split into segments (filter out empty segments)
  const segmentStrings = cleanPattern
    ? cleanPattern.split("/").filter((s) => s !== "")
    : [];
  const segments = segmentStrings.map((seg, index) => {
    if (seg.startsWith(":")) {
      // Parameter segment
      const paramName = seg.slice(1).replace("?", ""); // Remove : and optional ?

      // Check if parameter should be optional:
      // 1. Explicitly marked with ?
      // 2. Has a default value
      // 3. Connected signal has undefined value and no explicit default (allows /map to match /map/:panel)
      //    — unless the param is constrained: "no segment" is not one of the values it accepts
      const connection =
        pathConnectionMap.get(paramName) || queryConnectionMap.get(paramName);
      const hasDefault =
        connection && connection.getDefaultValue() !== undefined;
      let isOptional = seg.endsWith("?") || hasDefault;

      if (!isOptional && !paramConstraintMap.has(paramName)) {
        // Check if connected signal has undefined value (making parameter optional for index routes)
        if (
          connection &&
          connection.signal &&
          readSignalForUrlBuild(connection) === undefined &&
          !hasDefault
        ) {
          isOptional = true;
        }
      }

      return {
        type: "param",
        name: paramName,
        optional: isOptional,
        index,
      };
    }
    // Literal segment
    return {
      type: "literal",
      value: seg,
      index,
    };
  });

  return {
    original: pattern,
    segments,
    queryParams, // Add query parameters to the parsed pattern
    trailingSlash,
    wildcard,
  };
};

/**
 * Check if a literal segment can be treated as optional based on pattern hierarchy
 */
const checkIfLiteralCanBeOptionalWithPatternObj = (
  literalValue,
  patternObj,
) => {
  if (!patternObj) {
    return false; // No pattern object available, cannot determine optionality
  }

  // Check current pattern's connections
  for (const connection of patternObj.connections) {
    if (connection.isDefaultValue(literalValue)) {
      return true;
    }
  }

  // Check parent pattern's connections
  let currentParent = patternObj.parent;
  while (currentParent) {
    for (const connection of currentParent.connections) {
      if (connection.isDefaultValue(literalValue)) {
        return true;
      }
    }
    currentParent = currentParent.parent;
  }

  // Check children pattern's connections
  const checkChildrenRecursively = (pattern) => {
    for (const child of pattern.children || []) {
      for (const connection of child.connections) {
        if (connection.isDefaultValue(literalValue)) {
          return true;
        }
      }
      if (checkChildrenRecursively(child)) {
        return true;
      }
    }
    return false;
  };

  return checkChildrenRecursively(patternObj);
};

/**
 * Helper function to try extracting parameters from child routes for remaining URL segments
 */
const tryExtractChildParameters = (
  childPattern,
  remainingSegments,
  existingParams,
) => {
  const childParsedPattern = childPattern.pattern;

  // For child patterns, we need to check if they can provide additional parameters
  // by matching segments that come after what the parent matched

  // The child pattern might have literals that were already matched by the parent
  // We need to find where in the child pattern we should start matching the remaining segments
  let remainingIndex = 0;
  const childParams = {};

  // Simple approach: look for parameter segments in the child pattern that could
  // match our remaining segments, but skip literals that were likely matched by parent
  for (let i = 0; i < childParsedPattern.segments.length; i++) {
    const segment = childParsedPattern.segments[i];

    if (segment.type === "param" && remainingIndex < remainingSegments.length) {
      // Check if this parameter segment could match a remaining URL segment
      // We need to verify that this parameter isn't already captured by parent
      if (!(segment.name in existingParams)) {
        const urlSegment = remainingSegments[remainingIndex];
        const paramValue = decodeURIComponent(urlSegment);
        const paramConstraint = childPattern.paramConstraintMap.get(
          segment.name,
        );
        if (paramConstraint && !paramConstraint(paramValue)) {
          return null; // the child declines this value, it cannot explain these segments
        }
        childParams[segment.name] = paramValue;
        remainingIndex++;
      }
    } else if (
      segment.type === "literal" &&
      remainingIndex < remainingSegments.length
    ) {
      // Check if this literal matches remaining segments
      const urlSegment = remainingSegments[remainingIndex];
      if (urlSegment === segment.value) {
        remainingIndex++;
      }
      // Note: we don't return null if literal doesn't match, because it might be
      // a literal that was already consumed by the parent pattern
    }
  }

  // Return extracted parameters if we found any
  return Object.keys(childParams).length > 0 ? childParams : null;
};

/**
 * Match a URL against a parsed pattern
 */
const matchUrl = (
  parsedPattern,
  url,
  {
    baseUrl,
    baseFileUrl,
    queryConnectionMap,
    paramConstraintMap = EMPTY_PARAM_CONSTRAINT_MAP,
    exact = false,
    patternObj = null,
  },
) => {
  // Parse the URL
  const urlObj = new URL(url, baseUrl);
  let pathname = urlObj.pathname;
  const originalPathname = pathname; // Store original pathname before baseUrl processing

  // If baseUrl is provided, calculate the pathname relative to the baseUrl's directory
  if (baseUrl) {
    const baseUrlObj = new URL(baseUrl);
    // if the base url is a file, we want to be relative to the directory containing that file
    const baseDir = baseUrlObj.pathname.endsWith("/")
      ? baseUrlObj.pathname
      : baseUrlObj.pathname.substring(0, baseUrlObj.pathname.lastIndexOf("/"));
    if (pathname.startsWith(baseDir)) {
      pathname = pathname.slice(baseDir.length);
    }
  }

  // Handle root route - only matches empty path or just "/"
  // OR when URL exactly matches baseUrl (treating baseUrl as root)
  // OR any sub-path when the route has a trailing slash (prefix matching)
  if (parsedPattern.segments.length === 0) {
    if (pathname === "/" || pathname === "") {
      return extractSearchParams(urlObj, queryConnectionMap);
    }

    // Special case: if URL exactly matches baseUrl or baseFileUrl (the HTML root file), treat as root route
    if (baseUrl) {
      const baseUrlObj = new URL(baseUrl);
      if (originalPathname === baseUrlObj.pathname) {
        return extractSearchParams(urlObj, queryConnectionMap);
      }
    }
    if (baseFileUrl) {
      const baseFileUrlObj = new URL(baseFileUrl);
      if (originalPathname === baseFileUrlObj.pathname) {
        return extractSearchParams(urlObj, queryConnectionMap);
      }
    }

    // Root route with trailing slash matches all sub-paths (prefix matching, like other trailing-slash routes)
    if (parsedPattern.trailingSlash && !exact) {
      return extractSearchParams(urlObj, queryConnectionMap);
    }

    return null;
  }

  // Remove leading slash and split into segments
  let urlSegments = pathname.startsWith("/")
    ? pathname
        .slice(1)
        .split("/")
        .filter((s) => s !== "")
    : pathname.split("/").filter((s) => s !== "");

  // Handle trailing slash flexibility: if pattern has trailing slash but URL doesn't (or vice versa)
  // and we're at the end of segments, allow the match
  const urlHasTrailingSlash = pathname.endsWith("/") && pathname !== "/";
  const patternHasTrailingSlash = parsedPattern.trailingSlash;

  const params = {};
  let urlSegmentIndex = 0;

  // Process each pattern segment
  for (let i = 0; i < parsedPattern.segments.length; i++) {
    const patternSeg = parsedPattern.segments[i];

    if (patternSeg.type === "literal") {
      // Check if URL has this segment
      if (urlSegmentIndex >= urlSegments.length) {
        // URL is too short for this literal segment
        // Check if this literal segment can be treated as optional based on pattern hierarchy
        const canBeOptional = checkIfLiteralCanBeOptionalWithPatternObj(
          patternSeg.value,
          patternObj,
        );
        if (canBeOptional) {
          // Skip this literal segment, don't increment urlSegmentIndex
          continue;
        }
        return null; // URL too short and literal is not optional
      }

      const urlSeg = urlSegments[urlSegmentIndex];
      if (urlSeg !== patternSeg.value) {
        // Literal mismatch - this route doesn't match this URL
        return null;
      }
      urlSegmentIndex++;
    } else if (patternSeg.type === "param") {
      // Parameter segment
      if (urlSegmentIndex >= urlSegments.length) {
        // No URL segment for this parameter
        if (patternSeg.optional) {
          // Optional parameter - don't add default here, let resolveParams handle it
          continue;
        }
        // Required parameter missing - but check if we can use trailing slash logic
        // If this is the last segment and we have a trailing slash difference, it might still match
        const isLastSegment = i === parsedPattern.segments.length - 1;
        if (isLastSegment && patternHasTrailingSlash && !urlHasTrailingSlash) {
          // Pattern expects trailing slash segment, URL doesn't have it - allow missing optional param
          continue;
        }
        return null; // Required parameter missing
      }

      // Capture URL segment as parameter value
      const urlSeg = urlSegments[urlSegmentIndex];
      const paramValue = decodeURIComponent(urlSeg);
      const paramConstraint = paramConstraintMap.get(patternSeg.name);
      if (paramConstraint && !paramConstraint(paramValue)) {
        return null; // the param declines this value: the route does not match
      }
      params[patternSeg.name] = paramValue;
      urlSegmentIndex++;
    }
  }

  // Check for remaining URL segments
  // Patterns with trailing slashes can match additional URL segments (like wildcards)
  // Patterns without trailing slashes should match exactly (unless they're wildcards)
  if (
    (exact || (!parsedPattern.wildcard && !parsedPattern.trailingSlash)) &&
    urlSegmentIndex < urlSegments.length
  ) {
    return null; // Pattern without trailing slash/wildcard should not match extra segments
  }

  // If there are remaining URL segments and we have descendant routes,
  // try to capture parameters from descendant routes
  if (
    urlSegmentIndex < urlSegments.length &&
    patternObj &&
    patternObj.children
  ) {
    const remainingSegments = urlSegments.slice(urlSegmentIndex);

    // Try to match remaining segments against child routes to extract their parameters
    for (const childPattern of patternObj.children) {
      const childParams = tryExtractChildParameters(
        childPattern,
        remainingSegments,
        params,
      );
      if (childParams) {
        Object.assign(params, childParams);
        break; // Found a matching child pattern
      }
    }
  }

  // Add search parameters
  const searchParams = extractSearchParams(urlObj, queryConnectionMap);
  Object.assign(params, searchParams);

  // Don't add defaults here - rawParams should only contain what's in the URL
  // Defaults are handled by resolveParams() to create the final merged parameters

  return params;
};

/**
 * Build query string from parameters, respecting rawUrlPart values
 */
const buildQueryString = (params) => {
  const searchParamPairs = [];

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      const encodedKey = encodeURIComponent(key);

      // Handle array values - join with commas
      if (Array.isArray(value)) {
        if (value.length === 0) {
          // Empty array - written as "key=", the form extractSearchParams reads
          // back as []. Omitting the param entirely would mean "absent" which
          // resolves to the default value, making "nothing selected"
          // inexpressible for a signal whose default is non-empty.
          searchParamPairs.push(`${encodedKey}=`);
        } else {
          const encodedValue = value
            .map((item) => encodeURIComponent(String(item)))
            .join(",");
          searchParamPairs.push(`${encodedKey}=${encodedValue}`);
        }
      }
      // Handle boolean values - if true, just add the key without value
      else if (value === true || value === "") {
        searchParamPairs.push(encodedKey);
      }
      // Handle Date objects - format as YYYY-MM-DD using UTC to match new Date('YYYY-MM-DD') semantics
      else if (value instanceof Date) {
        const yyyy = value.getUTCFullYear();
        const mm = String(value.getUTCMonth() + 1).padStart(2, "0");
        const dd = String(value.getUTCDate()).padStart(2, "0");
        searchParamPairs.push(`${encodedKey}=${yyyy}-${mm}-${dd}`);
      } else {
        const encodedValue = encodeParamValue(value, false); // Search params encode slashes
        searchParamPairs.push(`${encodedKey}=${encodedValue}`);
      }
    }
  }

  return searchParamPairs.join("&");
};

/**
 * Cast an array item read from the URL into the item type declared on the
 * signal (`stateSignal([], { type: "array", itemType: "number" })`).
 *
 * Without it every item comes back as a string and the value no longer equals
 * what was assigned, so the URL→signal sync overwrites the signal with strings.
 * Declared explicitly rather than guessed, so a "42" string item stays a string
 * unless the signal says otherwise.
 */
const castStringToItemType = (item, itemType) => {
  if (itemType === "number" || itemType === "float") {
    const numberValue = Number(item);
    return isNaN(numberValue) ? item : numberValue;
  }
  if (itemType === "boolean") {
    return item === "true" || item === "1" || item === "";
  }
  return item;
};

/**
 * Extract search parameters from URL
 */
const extractSearchParams = (urlObj, queryConnectionMap) => {
  const params = {};

  // Parse the raw query string manually instead of using urlObj.searchParams
  // This is necessary for array parameters to handle encoded commas correctly.
  // urlObj.searchParams automatically decodes %2C to , which breaks our comma-based array splitting.
  //
  // Design choice: We use comma-separated values (colors=red,blue,green) instead of
  // the standard repeated parameters (colors=red&colors=blue&colors=green) because:
  // 1. More human-readable URLs
  // 2. Shorter URL length
  // 3. Easier to copy/paste and manually edit
  if (!urlObj.search) {
    return params;
  }

  const rawQuery = urlObj.search.slice(1); // Remove leading ?
  const pairs = rawQuery.split("&");

  for (const pair of pairs) {
    const eqIndex = pair.indexOf("=");
    let key;
    let rawValue;

    if (eqIndex > -1) {
      key = decodeURIComponent(pair.slice(0, eqIndex));
      rawValue = pair.slice(eqIndex + 1); // Keep raw for array processing
    } else {
      key = decodeURIComponent(pair);
      rawValue = "";
    }

    const connection = queryConnectionMap.get(key);
    const signalType = connection ? connection.type : null;
    const itemType = connection ? connection.itemType : null;

    // Cast value based on signal type
    if (signalType === "array") {
      // Handle array query parameters with proper comma encoding:
      // ?colors=red,blue,green → ["red", "blue", "green"]
      // ?colors=red,blue%2Cgreen → ["red", "blue,green"] (comma in value)
      // ?colors= → []
      // ?colors → []
      if (rawValue === "") {
        params[key] = [];
      } else {
        params[key] = rawValue
          .split(",")
          .map((item) => decodeURIComponent(item))
          .filter((item) => item.trim() !== "")
          .map((item) => castStringToItemType(item, itemType));
      }
    } else if (signalType === "number" || signalType === "float") {
      const decodedValue = decodeURIComponent(rawValue);
      const numberValue = Number(decodedValue);
      params[key] = isNaN(numberValue) ? decodedValue : numberValue;
    } else if (signalType === "boolean") {
      const decodedValue = decodeURIComponent(rawValue);
      // Handle boolean query parameters:
      // ?walk=true → true
      // ?walk=1 → true
      // ?walk → true (parameter present without value)
      // ?walk=false → false
      // ?walk=0 → false
      params[key] =
        decodedValue === "true" || decodedValue === "1" || decodedValue === "";
    } else if (signalType === "date") {
      const decodedValue = decodeURIComponent(rawValue);
      // Keep as "YYYY-MM-DD" string — canonical date form, no timezone conversion
      params[key] = decodedValue.slice(0, 10);
    } else if (signalType === "datetime") {
      const decodedValue = decodeURIComponent(rawValue);
      // Normalize to ISO string — canonical datetime form
      const d = new Date(decodedValue);
      params[key] = isNaN(d.getTime()) ? decodedValue : d.toISOString();
    } else {
      params[key] = decodeURIComponent(rawValue);
    }
  }

  return params;
};

/**
 * Build hierarchical query parameters from pattern hierarchy
 *
 * IMPORTANT: This function implements parameter inheritance - child routes inherit
 * query parameters from their ancestor routes. This is intentional behavior that
 * allows child routes to preserve context from parent routes.
 *
 * For example:
 * - Parent route: /map/?lon=123
 * - Child route: /map/isochrone?iso_lon=456
 * - Final URL: /map/isochrone?lon=123&iso_lon=456
 *
 * The child route inherits 'lon' from its parent, maintaining navigation context.
 * Only parameters that match their defaults (static or dynamic) are omitted.
 */
const buildHierarchicalQueryParams = (
  parsedPattern,
  params,
  originalPattern,
  patternObj,
) => {
  const queryParams = {};
  const processedParams = new Set();

  // Get pattern data for this pattern - use direct pattern object or null
  const patternData = patternObj;

  // Collect all ancestors by traversing parent chain - only if we have pattern data
  const ancestorPatterns = [];
  if (patternData) {
    let currentParent = patternData.parent;
    while (currentParent) {
      ancestorPatterns.unshift(currentParent); // Add to front for correct order
      // Move to next parent in the chain
      currentParent = currentParent.parent;
    }
  }

  debug(`Building params for ${originalPattern}`);
  debug(`parsedPattern:`, parsedPattern.original);
  debug(`params:`, params);
  debug(
    `ancestorPatterns:`,
    ancestorPatterns.map((p) => p.urlPatternRaw),
  );

  // Step 1: Add query parameters from ancestor patterns (oldest to newest)
  // This ensures ancestor parameters come first in their declaration order
  // ancestorPatterns is in correct order: root ancestor first, then immediate parent

  for (const ancestorPatternObj of ancestorPatterns) {
    for (const queryParam of ancestorPatternObj.parsedPattern.queryParams) {
      const paramName = queryParam.name;
      if (params[paramName] !== undefined && !processedParams.has(paramName)) {
        queryParams[paramName] = params[paramName];
        processedParams.add(paramName);

        debug(`Added ancestor param: ${paramName}=${params[paramName]}`);
      }
    }
  }

  // Step 2: Add query parameters from current pattern
  if (parsedPattern.queryParams) {
    debug(
      `Processing current pattern query params:`,
      parsedPattern.queryParams.map((q) => q.name),
    );

    for (const queryParam of parsedPattern.queryParams) {
      const paramName = queryParam.name;
      if (params[paramName] !== undefined && !processedParams.has(paramName)) {
        queryParams[paramName] = params[paramName];
        processedParams.add(paramName);

        debug(`Added current param: ${paramName}=${params[paramName]}`);
      }
    }
  }

  // Step 3: Add remaining parameters (extra params) alphabetically
  const extraParams = [];

  // Get all path parameter names to exclude them
  const pathParamNames = new Set(
    parsedPattern.segments.filter((s) => s.type === "param").map((s) => s.name),
  );

  for (const [key, value] of Object.entries(params)) {
    if (
      !pathParamNames.has(key) &&
      !processedParams.has(key) &&
      value !== undefined
    ) {
      extraParams.push([key, value]);
    }
  }

  // Sort extra params alphabetically for consistent order
  extraParams.sort(([a], [b]) => a.localeCompare(b));

  // Add sorted extra params
  for (const [key, value] of extraParams) {
    queryParams[key] = value;
  }

  return queryParams;
};

/**
 * Build a URL from a pattern and parameters
 */
const buildUrlFromPattern = (
  parsedPattern,
  params = {},
  originalPattern = null,
  patternObj = null,
) => {
  if (parsedPattern.segments.length === 0) {
    // Root route
    const queryParams = {};
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        queryParams[key] = value;
      }
    }
    const search = buildQueryString(queryParams);
    return `/${search ? `?${search}` : ""}`;
  }

  const segments = [];

  for (const patternSeg of parsedPattern.segments) {
    if (patternSeg.type === "literal") {
      segments.push(patternSeg.value);
    } else if (patternSeg.type === "param") {
      const value = params[patternSeg.name];

      // If value is provided, include it
      if (value !== undefined) {
        segments.push(encodeParamValue(value, false)); // Named parameters encode slashes
      } else if (!patternSeg.optional) {
        // For required parameters without values, keep the placeholder
        segments.push(`:${patternSeg.name}`);
      }
      // Optional parameters with undefined values are omitted
    }
  }

  let path = `/${segments.join("/")}`;

  // Handle trailing slash - only add if it serves a purpose
  if (parsedPattern.trailingSlash && !path.endsWith("/") && path !== "/") {
    // Only add trailing slash if the original pattern suggests there could be more content
    // For patterns like "/admin/:section/" where the slash is at the very end,
    // it's not needed in the generated URL if there are no more segments
    const lastSegment =
      parsedPattern.segments[parsedPattern.segments.length - 1];
    const hasMorePotentialContent =
      parsedPattern.wildcard || (lastSegment && lastSegment.type === "literal"); // Only add slash after literals, not parameters

    if (hasMorePotentialContent) {
      path += "/";
    }
  } else if (
    !parsedPattern.trailingSlash &&
    path.endsWith("/") &&
    path !== "/"
  ) {
    // Remove trailing slash for patterns without trailing slash
    path = path.slice(0, -1);
  }

  // Check if we'll have query parameters to decide on trailing slash removal
  const willHaveQueryParams =
    parsedPattern.queryParams.some((qp) => {
      const value = params[qp.name];
      return value !== undefined;
    }) ||
    Object.entries(params).some(([key, value]) => {
      const isPathParam = parsedPattern.segments.some(
        (s) => s.type === "param" && s.name === key,
      );
      const isQueryParam = parsedPattern.queryParams?.some(
        (qp) => qp.name === key,
      );
      return value !== undefined && !isPathParam && !isQueryParam;
    });

  // Remove trailing slash when we have query params for prettier URLs
  if (willHaveQueryParams && path.endsWith("/") && path !== "/") {
    path = path.slice(0, -1);
  }

  // Always remove trailing slash from simple paths (unless root) for cleaner URLs
  if (path.endsWith("/") && path !== "/" && !willHaveQueryParams) {
    path = path.slice(0, -1);
  }

  // Build query parameters respecting hierarchical order
  const queryParams = buildHierarchicalQueryParams(
    parsedPattern,
    params,
    originalPattern,
    patternObj,
  );

  const search = buildQueryString(queryParams);

  // No longer handle trailing slash inheritance here

  return path + (search ? `?${search}` : "");
};

/**
 * Check if childPattern is a child route of parentPattern
 * This determines parent-child relationships for signal clearing behavior.
 *
 * Route families vs parent-child relationships:
 * - Different families: preserve signals (e.g., "/" and "/settings")
 * - Parent-child: clear signals when navigating to parent (e.g., "/settings" and "/settings/:tab")
 *
 * E.g., "/admin/settings/:tab" is a child of "/admin/:section/"
 * Also, "/admin/?tab=something" is a child of "/admin/"
 */
const isChildPattern = (childPattern, parentPattern) => {
  if (!childPattern || !parentPattern) {
    return false;
  }

  // Split path and query parts
  const [childPath, childQuery] = childPattern.split("?");
  const [parentPath, parentQuery] = parentPattern.split("?");

  // Remove trailing slashes for path comparison
  const cleanChild = childPath.replace(/\/$/, "");
  const cleanParent = parentPath.replace(/\/$/, "");

  // CASE 1: Same path, child has query params, parent doesn't
  // E.g., "/admin/?tab=something" is child of "/admin/"
  if (cleanChild === cleanParent && childQuery && !parentQuery) {
    return true;
  }

  // CASE 2: Traditional path-based child relationship
  const childSegments = cleanChild.split("/").filter((s) => s);
  const parentSegments = cleanParent.split("/").filter((s) => s);

  // Child must have at least as many segments as parent (or more for specificity)
  if (childSegments.length < parentSegments.length) {
    return false;
  }

  let hasMoreSpecificSegment = false;

  // Check if all parent segments match child segments (allowing for parameters)
  for (let i = 0; i < parentSegments.length; i++) {
    const parentSeg = parentSegments[i];
    const childSeg = childSegments[i];

    if (parentSeg.startsWith(":")) {
      // Parent has parameter - child can have any value in that position
      // Child is more specific if it has a literal value for a parent parameter
      if (!childSeg.startsWith(":")) {
        hasMoreSpecificSegment = true;
      }
      continue;
    }

    // Parent has literal - child must match exactly
    if (parentSeg !== childSeg) {
      return false;
    }
  }

  // Child must be more specific (more segments OR more specific segments)
  return childSegments.length > parentSegments.length || hasMoreSpecificSegment;
};

/**
 * Register all patterns at once and build their relationships
 */
export const setupRoutePatterns = (routePatterns) => {
  const routePatternSet = new Set(); // Set of pattern objects
  // Phase 1: Fill pattern set
  for (const routePattern of routePatterns) {
    routePatternSet.add(routePattern);
  }
  // Phase 2: Determine parent-child relationships based on pattern analysis
  for (const routePattern of routePatternSet) {
    for (const otherRoutePattern of routePatternSet) {
      if (otherRoutePattern === routePattern) {
        continue;
      }
      if (
        !isChildPattern(
          routePattern.cleanPattern,
          otherRoutePattern.cleanPattern,
        )
      ) {
        continue;
      }
      const currentSegmentCount = routePattern.parent
        ? getPathSegmentCount(routePattern.parent.originalPattern)
        : 0;
      const otherSegmentCount = getPathSegmentCount(
        otherRoutePattern.originalPattern,
      );
      if (!routePattern.parent || otherSegmentCount > currentSegmentCount) {
        routePattern.parent = otherRoutePattern;
      }
      otherRoutePattern.children.push(routePattern);
    }
  }
  // Phase 2b: Compute family roots. Two patterns are in the same family when
  // their parent chains meet — one is ancestor of the other, or they share a
  // common ancestor. Each pattern has a single parent, so that is exactly:
  // same topmost ancestor (familyRoot equality).
  for (const routePattern of routePatternSet) {
    let root = routePattern;
    while (root.parent) {
      root = root.parent;
    }
    routePattern.familyRoot = root;
  }
  // Phase 3: Inherit search parameter connections from ancestors
  // Search params are global and should be inherited by descendants regardless of path segments
  for (const routePattern of routePatternSet) {
    let ancestorRoutePattern = routePattern.parent;
    while (ancestorRoutePattern) {
      // For each ancestor's query connection, check if it should be inherited
      for (const [
        paramName,
        ancestorConnection,
      ] of ancestorRoutePattern.queryConnectionMap) {
        // Skip if descendant already has this parameter
        if (routePattern.queryConnectionMap.has(paramName)) {
          continue;
        }

        // Check if child route is truly more specific than parent, or just using default values
        // If child has literal segments that match parent's parameter defaults, skip inheritance
        let shouldInherit = true;

        // Compare path segments to see if child is just parent with default values
        const childSegments = routePattern.pattern.segments;
        const parentSegments = ancestorRoutePattern.pattern.segments;

        for (
          let i = 0;
          i < Math.min(childSegments.length, parentSegments.length);
          i++
        ) {
          const childSeg = childSegments[i];
          const parentSeg = parentSegments[i];

          if (parentSeg.type === "param" && childSeg.type === "literal") {
            // Check if this literal value matches the parent parameter's default
            const parentConnection = ancestorRoutePattern.pathConnectionMap.get(
              parentSeg.name,
            );
            if (
              parentConnection &&
              parentConnection.getDefaultValue() === childSeg.value
            ) {
              // Child uses literal that matches parent's parameter default
              // This means they're essentially the same route, not parent-child
              shouldInherit = false;
              break;
            }
          }
        }

        if (shouldInherit) {
          // Create inherited connection
          const inheritedConnection = {
            ...ancestorConnection,
            inherited: true, // Mark as inherited for proper handling
          };
          routePattern.queryConnectionMap.set(paramName, inheritedConnection);
          routePattern.connections.push(inheritedConnection);

          debug(
            `[${routePattern.originalPattern}] Inherited search param "${paramName}" from ancestor [${ancestorRoutePattern.originalPattern}]`,
          );
        } else {
          debug(
            `[${routePattern.originalPattern}] Skipped inheriting "${paramName}" - child uses default values, not truly more specific`,
          );
        }
      }
      ancestorRoutePattern = ancestorRoutePattern.parent;
    }
  }
  // Phase 4: Precompute descendant path signals for each pattern (used by canReachLiteralValue)
  // Stored as a Map<segmentIndex, conn[]> for O(1) lookup by position.
  for (const routePattern of routePatternSet) {
    const descendantPathSignalsByIndex = new Map();
    const collectDescendantPathSignals = (patternObj) => {
      for (const conn of patternObj.connections) {
        if (conn.paramType === "path") {
          const paramSegment = patternObj.pattern.segments.find(
            (seg) => seg.type === "param" && seg.name === conn.paramName,
          );
          if (paramSegment) {
            const { index } = paramSegment;
            let conns = descendantPathSignalsByIndex.get(index);
            if (!conns) {
              conns = [];
              descendantPathSignalsByIndex.set(index, conns);
            }
            conns.push(conn);
          }
        }
      }
      for (const child of patternObj.children) {
        collectDescendantPathSignals(child);
      }
    };
    collectDescendantPathSignals(routePattern);
    routePattern.descendantPathSignals = descendantPathSignalsByIndex;
  }
  // Phase 4b: Flag path params whose values are ALSO declared as literal routes
  // ("/games/me/done" next to "/games/me/:section"). That declaration is the
  // only reliable statement that the param names pages rather than qualifying
  // one — read by shouldUseChildRoute to decide whether an ancestor url may
  // descend into it.
  for (const routePattern of routePatternSet) {
    for (const connection of routePattern.connections) {
      if (connection.paramType !== "path") {
        continue;
      }
      const paramSegment = routePattern.pattern.segments.find(
        (seg) => seg.type === "param" && seg.name === connection.paramName,
      );
      if (!paramSegment) {
        continue;
      }
      const { index } = paramSegment;
      const sharesPathUpTo = (otherSegments) => {
        for (let i = 0; i < index; i++) {
          const seg = routePattern.pattern.segments[i];
          const otherSeg = otherSegments[i];
          if (!otherSeg) {
            return false;
          }
          if (seg.type === "literal" && otherSeg.type === "literal") {
            if (seg.value !== otherSeg.value) {
              return false;
            }
          } else if (seg.type !== otherSeg.type) {
            return false;
          }
        }
        return true;
      };
      for (const otherPattern of routePatternSet) {
        if (otherPattern === routePattern) {
          continue;
        }
        const otherSegments = otherPattern.pattern.segments;
        const otherSegment = otherSegments[index];
        if (!otherSegment || otherSegment.type !== "literal") {
          continue;
        }
        if (!sharesPathUpTo(otherSegments)) {
          continue;
        }
        connection.namedByLiteralRoutes = true;
        break;
      }
    }
  }
  // Phase 5: Calculate depths for all patterns
  for (const routePattern of routePatternSet) {
    calculatePatternDepth(routePattern);
  }
  debug("Pattern registry updated");
};
// Store the most specific parent (closest parent in hierarchy)
const getPathSegmentCount = (pattern) => {
  // Only count path segments, not query parameters
  const pathPart = pattern.split("?")[0];
  return pathPart.split("/").filter(Boolean).length;
};
const calculatePatternDepth = (patternObj) => {
  if (patternObj.depth !== 0) {
    return patternObj.depth; // Already calculated
  }

  if (!patternObj.parent) {
    patternObj.depth = 0;
    return 0;
  }

  const parentDepth = calculatePatternDepth(patternObj.parent);
  patternObj.depth = parentDepth + 1;
  return patternObj.depth;
};

export const resolveRouteUrl = (relativeUrl) => {
  if (relativeUrl[0] === "/") {
    // we remove the leading slash because we want to resolve against baseUrl which may
    // not be the root url
    relativeUrl = relativeUrl.slice(1);
  }

  // we don't use URL constructor on PURPOSE (in case the relativeUrl contains invalid url chars)
  // and we want to support use cases where people WANT to produce invalid urls (for example rawUrlPart with spaces)
  // because these urls will be handled by non standard clients (like a backend service allowing url like stuff)
  if (baseUrl.endsWith("/")) {
    return `${baseUrl}${relativeUrl}`;
  }
  return `${baseUrl}/${relativeUrl}`;
};

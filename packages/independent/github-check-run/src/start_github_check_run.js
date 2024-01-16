/**
 *
 * https://github.com/IgnusG/jest-report-action/blob/c006b890ba3c3b650e6c55916a643ca82b64133b/tasks/github-api.js#L12
 * https://docs.github.com/fr/rest/checks/runs?apiVersion=2022-11-28#create-a-check-run
 */

import { createLogger, createDetailedMessage, UNICODE } from "@jsenv/humanize";

import { POST, PATCH } from "./internal/github_rest_api.js";

export const startGithubCheckRun = async ({
  logLevel,
  githubToken,
  repositoryOwner,
  repositoryName,
  commitSha,
  checkName,
  checkTitle,
  checkSummary,
  checkStatus = "in_progress",
}) => {
  if (typeof githubToken !== "string") {
    throw new TypeError(
      `githubToken must be a string but received ${githubToken}`,
    );
  }
  if (typeof repositoryOwner !== "string") {
    throw new TypeError(
      `repositoryOwner must be a string but received ${repositoryOwner}`,
    );
  }
  if (typeof repositoryName !== "string") {
    throw new TypeError(
      `repositoryName must be a string but received ${repositoryName}`,
    );
  }
  if (typeof commitSha !== "string") {
    throw new TypeError(`commitSha must be a string but received ${commitSha}`);
  }
  if (typeof checkName !== "string") {
    throw new TypeError(`checkName must be a string but received ${checkName}`);
  }

  const logger = createLogger({ logLevel });

  const checkApiURL = `https://api.github.com/repos/${repositoryOwner}/${repositoryName}/check-runs`;
  logger.debug(`POST ${checkApiURL} (for commit ${commitSha})`);
  let check;
  try {
    check = await POST({
      url: checkApiURL,
      githubToken,
      headers: {
        "accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: {
        head_sha: commitSha,
        status: checkStatus,
        name: checkName,
        output: {
          title: checkTitle,
          summary: checkSummary,
        },
      },
    });
    logger.debug(`${UNICODE.OK} check created ${check.html_url}`);
  } catch (e) {
    logger.error(
      createDetailedMessage(`${UNICODE.FAILURE} failed to create check`, {
        "error stack": e.stack,
      }),
    );
    return { progress: () => {}, fail: () => {}, pass: () => {} };
  }

  const updateState = async ({
    status,
    conclusion,
    title = check.title,
    summary = check.summary,
    annotations = [],
  }) => {
    let annotationsSent = 0;
    const annotationsBatch = annotations.slice(annotationsSent, 50);
    const body = {
      ...(status ? { status } : {}),
      ...(conclusion ? { conclusion } : {}),
      output: {
        title: title === undefined ? check.title : title,
        summary: summary === undefined ? check.summary : summary,
        ...(annotationsBatch.length ? { annotations: annotationsBatch } : {}),
      },
    };

    try {
      logger.debug(`PATCH check ${check.html_url}
--- body ---
${JSON.stringify(body, null, "  ")}`);
      check = await PATCH({
        url: check.url,
        githubToken,
        body,
      });
      logger.debug(`${UNICODE.OK} check updated`);
    } catch (e) {
      logger.error(
        createDetailedMessage(`${UNICODE.FAILURE} failed to update check`, {
          "error stack": e.stack,
        }),
      );
      return;
    }

    annotationsSent += annotationsBatch.length;
    while (annotationsSent < annotations.length) {
      const annotationsBatch = annotations.slice(annotationsSent, 50);
      check = await PATCH({
        url: check.url,
        githubToken,
        body: {
          head_sha: commitSha,
          output: {
            annotations: annotationsBatch,
          },
        },
      });
      annotationsSent += annotationsBatch.length;
    }
  };

  let lastProgressCall;
  let pendingAnnotations = [];
  let pendingAbortController;
  let pendingProgressPromise = Promise.resolve();
  let msBetweenProgressCalls = 500;

  return {
    progress: async ({ title, summary, annotations = [] }) => {
      if (check.conclusion === "failure") {
        throw new Error(`cannot progress() after fail()`);
      }
      if (check.conclusion === "success") {
        throw new Error(`cannot progress() after pass()`);
      }
      pendingProgressPromise = (async () => {
        const nowMs = Date.now();
        const isFirstCall = !lastProgressCall;
        lastProgressCall = nowMs;
        if (isFirstCall) {
          await updateState({
            title,
            summary,
            annotations,
          });
          return;
        }
        if (pendingAbortController) {
          pendingAbortController.abort();
        }
        const msEllapsedSinceLastProgressCall = nowMs - lastProgressCall;
        const msEllapsedIsBigEnough =
          msEllapsedSinceLastProgressCall > msBetweenProgressCalls;
        if (msEllapsedIsBigEnough) {
          annotations = [...pendingAnnotations, ...annotations];
          pendingAnnotations.length = 0;
          await updateState({
            title,
            summary,
            annotations,
          });
          return;
        }
        pendingAnnotations.push(...annotations);
        pendingAbortController = new AbortController();
        await new Promise((resolve) => {
          pendingAbortController.signal.onabort = resolve;
          setTimeout(resolve, msBetweenProgressCalls);
        });
        if (pendingAbortController && pendingAbortController.signal.aborted) {
          return;
        }
        pendingAbortController = null;
        await updateState({
          title,
          summary,
          annotations,
        });
      })();
      await pendingProgressPromise;
      pendingProgressPromise = Promise.resolve();
    },
    fail: async ({ title, summary, annotations } = {}) => {
      await pendingProgressPromise;
      if (pendingAbortController) {
        pendingAbortController.abort();
      }
      if (check.conclusion === "failure") {
        throw new Error(`already failed`);
      }
      if (check.conclusion === "success") {
        throw new Error(`cannot fail() after pass()`);
      }
      return updateState({
        status: "completed",
        conclusion: "failure",
        title,
        summary,
        annotations,
      });
    },
    pass: async ({ title, summary, annotations } = {}) => {
      await pendingProgressPromise;
      if (pendingAbortController) {
        pendingAbortController.abort();
      }
      if (check.conclusion === "failure") {
        throw new Error(`cannot pass() after fail()`);
      }
      if (check.conclusion === "success") {
        throw new Error(`already passed`);
      }
      return updateState({
        status: "completed",
        conclusion: "success",
        title,
        summary,
        annotations,
      });
    },
  };
};

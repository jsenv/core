// https://github.com/avajs/ava/blob/576f534b345259055c95fa0c2b33bef10847a2af/lib/fork.js#L23
// https://nodejs.org/api/worker_threads.html
// https://github.com/avajs/ava/blob/576f534b345259055c95fa0c2b33bef10847a2af/lib/worker/base.js
// import { Worker } from "node:worker_threads"

// export const nodeWorkerThread = {
//   name: "node_worker",
//   version: process.version.slice(1),
//   launch: async ({ env }) => {
//     // https://nodejs.org/api/worker_threads.html#new-workerfilename-options
//     const worker = new Worker(workerPath, {
//       argv: options.workerArgv,
//       env: {
//         NODE_ENV: "test",
//         JSENV: true,
//         ...process.env,
//       },
//       execArgv: [...execArgv, ...additionalExecArgv],
//       workerData: {
//         options,
//       },
//       trackUnmanagedFds: true,
//       stdin: true,
//       stdout: true,
//       stderr: true,
//     })
//   },
// }

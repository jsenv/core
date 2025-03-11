export const createAddLog = ({ fileResponsibleOfAdd, toAdd }) =>
  `${createAddCauseLog({ fileResponsibleOfAdd })} -> ${createAddEffectLog({ toAdd })}`

const createAddCauseLog = ({ fileResponsibleOfAdd }) => {
  if (fileResponsibleOfAdd.length === 1) {
    return `${fileResponsibleOfAdd[0]} added`
  }
  return `${fileResponsibleOfAdd.length} file added`
}

const createAddEffectLog = ({ toAdd }) => {
  if (toAdd.length === 1) {
    return `add ${toAdd[0].executionName} execution`
  }
  return `add ${toAdd.length} executions`
}

export const createRemoveLog = ({ fileResponsibleOfRemove, toRemove }) =>
  `${createRemoveCauseLog({ fileResponsibleOfRemove })} -> ${createRemoveEffectLog({ toRemove })}`

const createRemoveCauseLog = ({ fileResponsibleOfRemove }) => {
  if (fileResponsibleOfRemove.length === 1) {
    return `${fileResponsibleOfRemove[0]} removed`
  }
  return `${fileResponsibleOfRemove.length} file removed`
}

const createRemoveEffectLog = ({ toRemove }) => {
  if (toRemove.length === 1) {
    return `remove ${toRemove[0].executionName} execution`
  }
  return `remove ${toRemove.length} executions`
}

export const createRunLog = ({ fileResponsibleOfRun, toRun }) =>
  `${createRunCauseLog({ fileResponsibleOfRun })} -> ${createRunEffectLog({ toRun })}`

const createRunCauseLog = ({ fileResponsibleOfRun }) => {
  if (fileResponsibleOfRun.length === 1) {
    return `${fileResponsibleOfRun[0]} changed`
  }
  return `${fileResponsibleOfRun.length} file changed`
}

const createRunEffectLog = ({ toRun }) => {
  if (toRun.length === 1) {
    return `run ${toRun[0].executionName} execution`
  }
  return `run ${toRun.length} executions`
}

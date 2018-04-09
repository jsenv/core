// on va le changer
// le but final c'est de run une commande qui va parcourir project/cache
// et pour chaque folder/**, lire le cache.json pour voir si le cache est encore
// valide, si le fichier existe et non modifié (en utilisant le eTag)
// si un des deux est faux on supprime alors tout le dossier project/cache/file.js/

import { all } from "@dmail/action"
import { inspect } from "./inspect.js"
import { updateBranches } from "./cache.js"
import { removeFile } from "./helpers.js"

export const sync = ({ rootLocation, relativeLocation }) => {
  return inspect({ rootLocation, relativeLocation }).then(
    ({ cache, files, filesStatus, branches, branchesStatus }) => {
      const filesWithInvalidStatus = files.filter((file, index) => {
        const status = filesStatus[index]
        return (
          status === "dynamic-file-invalid-reference" ||
          status === "asset-invalid-reference" ||
          status === "no-reference"
        )
      })
      const branchesWithValidStatus = branches.filter((branch, index) => {
        return branchesStatus[index] === "valid"
      })

      return all([
        ...filesWithInvalidStatus.map((file) => removeFile(`${folder}/${file}`)),
        updateBranches({ cache, branches: branchesWithValidStatus }),
      ])
    },
  )
}

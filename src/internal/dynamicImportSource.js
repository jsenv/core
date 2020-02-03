// ZXhwb3J0IGRlZmF1bHQgNDI= is Buffer.from("export default 42").toString("base64")

(async () => {
  const moduleSource = "data:text/javascript;base64,ZXhwb3J0IGRlZmF1bHQgNDI="
  try {
    const namespace = await import(moduleSource)
    return namespace.default === 42
  }
  catch(e) {
    // see https://nodejs.org/api/vm.html#vm_constructor_new_vm_script_code_options
    if (e.code === 'ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING') {
      return true
    }
    return false
  }
})()
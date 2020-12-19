<template>
  <div id="app">
    {{ message }}
  </div>
</template>

<style>
#app {
  background: violet;
}
</style>

<script>
var app = new Vue({
  el: "#app",
  data: {
    message: "Hello Vue!",
  },
})
</script>

<template>
  <p>
    {{ text }}
  </p>
</template>

<script>
export default {
  props: {
    text: {
      type: String,
      default: "",
    },
  },
}
</script>

<style scoped>
p {
  background: violet;
}
</style>

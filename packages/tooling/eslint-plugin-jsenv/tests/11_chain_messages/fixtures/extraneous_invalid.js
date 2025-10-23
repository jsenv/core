// Test case: Extraneous parameter (user provided all expected params + one extra)
function validate({ email, phone }) {
  console.log(email, phone);
}
validate({ email: "test@example.com", phone: "123", extra: "unused" }); // 'extra' should trigger extraneous message

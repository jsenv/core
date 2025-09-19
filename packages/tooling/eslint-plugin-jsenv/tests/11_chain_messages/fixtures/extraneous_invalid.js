// Test case: Extraneous parameter (user provided all expected params + one extra)
function validate({ email, phone }) {
  return checkData(email, phone);
}
validate({ email: "test@example.com", phone: "123", extra: "unused" }); // 'extra' should trigger extraneous message

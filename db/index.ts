export function getDb() {
  throw new Error(
    "This local-only build does not enable D1. Shot records are stored on the current device and can be exported as JSON.",
  );
}

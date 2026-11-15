// DEMO ONLY. This is NOT a secure hash. It only makes the mock passwords look
// like hashes. The real backend will hash passwords with bcrypt on the server.

export function mockHash(text) {
  let h = 5381;
  for (const ch of text) {
    h = ((h << 5) + h + ch.charCodeAt(0)) | 0;
  }
  return "mock$" + (h >>> 0).toString(16).padStart(8, "0");
}

const chars =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789012345678901234567890123456789";
function generateString(l: number) {
  var s = "";
  for (let i = 0; i < l; i++) {
    s += chars[Math.floor(chars.length * 0.999 * Math.random())];
  }
  return s;
}

export default generateString;

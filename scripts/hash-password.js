import bcrypt from "bcrypt";
const pw = process.argv[2];
if (!pw || pw.length < 10) { console.error('Usage: node scripts/hash-password.js "a-password-of-10+-chars"'); process.exit(1); }
console.log(await bcrypt.hash(pw, 12));

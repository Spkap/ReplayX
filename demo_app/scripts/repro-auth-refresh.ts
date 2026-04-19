import { runAuthRefreshScenario } from "../src/auth/run-auth-refresh.js";

const idleFlagIndex = process.argv.indexOf("--idle-minutes");
const idleMinutes =
  idleFlagIndex >= 0 && process.argv[idleFlagIndex + 1] ? Number(process.argv[idleFlagIndex + 1]) : 30;

try {
  const result = runAuthRefreshScenario(idleMinutes);
  console.log(JSON.stringify({ ok: true, idleMinutes, result }, null, 2));
  process.exit(0);
} catch (error) {
  const message = error instanceof Error ? error.message : "UnknownError";
  console.error(JSON.stringify({ ok: false, idleMinutes, error: message }, null, 2));
  process.exit(1);
}

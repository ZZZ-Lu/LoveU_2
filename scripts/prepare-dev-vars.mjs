import {existsSync, readFileSync, readdirSync, writeFileSync} from "node:fs";

// Clean up any stale or orphaned dev server / workerd processes to ensure port 3000 is always free.
try {
  const myPid = process.pid;
  const myPpid = process.ppid;
  if (existsSync("/proc")) {
    const pids = readdirSync("/proc").filter((p) => /^\d+$/.test(p)).map(Number);
    for (const pid of pids) {
      if (pid === myPid || pid === myPpid || pid === 1) continue;
      try {
        const cmd = readFileSync(`/proc/${pid}/cmdline`, "utf8");
        if ((cmd.includes("vinext") || cmd.includes("workerd")) && !cmd.includes("prepare-dev-vars.mjs")) {
          process.kill(pid, "SIGKILL");
        }
      } catch {}
    }
  }
} catch {}

const keyNames = ["DEEPSEEK_API_KEY", "MOONSHOT_API_KEY", "DASHSCOPE_API_KEY"];

function readKey(path, keyName) {
  if (!existsSync(path)) return "";
  const match = readFileSync(path, "utf8").match(
    new RegExp(`^${keyName}=(.*)$`, "m"),
  );
  return match?.[1]?.trim() ?? "";
}

// Keep the local secret persistent between preview restarts. Prefer an
// explicitly supplied process value, then the existing Wrangler secret file,
// and finally the project's local environment file.
const values = Object.fromEntries(keyNames.map((keyName) => [keyName,
  process.env[keyName]?.trim() || readKey(".env.local", keyName) || readKey(".env.kimi.local", keyName) || readKey(".env.dashscope.local", keyName) || readKey(".dev.vars", keyName),
]));

if (!values.DEEPSEEK_API_KEY) {
  console.warn(
    "Notice: DEEPSEEK_API_KEY is not set yet. The application will run, and requests will prompt for the API key.",
  );
}

const lines = keyNames.filter((keyName) => values[keyName]).map((keyName) => `${keyName}=${values[keyName]}`);
writeFileSync(".dev.vars", `${lines.join("\n")}\n`, {encoding: "utf8"});
console.log(`Persistent API configuration loaded (${lines.map((line) => line.split("=")[0]).join(", ")}).`);

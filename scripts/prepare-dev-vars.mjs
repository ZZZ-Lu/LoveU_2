import {existsSync, readFileSync, writeFileSync} from "node:fs";

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

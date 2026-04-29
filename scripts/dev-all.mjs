import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const withSlack = process.argv.includes("--with-slack");
const parseEnvFile = (filePath) => {
  if (!existsSync(filePath)) {
    return {};
  }

  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const equalsIndex = line.indexOf("=");
        const key = line.slice(0, equalsIndex).trim();
        const rawValue = line.slice(equalsIndex + 1).trim();
        const value = rawValue.replace(/^['"]|['"]$/g, "");
        return [key, value];
      })
  );
};

const sharedEnv = withSlack
  ? {
      ...parseEnvFile(path.resolve(process.cwd(), "slack/.env")),
      ...process.env
    }
  : process.env;

if (withSlack) {
  sharedEnv.REPLAYX_SLACK_API_URL ||= "http://localhost:3000";
  sharedEnv.REPLAYX_DASHBOARD_URL ||= "http://localhost:3001";
  sharedEnv.REPLAYX_ORCHESTRATOR_URL ||= "http://localhost:3001";
}

const commands = [
  {
    name: "demo-app",
    command: "pnpm",
    args: ["demo-app"],
    ready: "Demo app -> http://127.0.0.1:4311"
  },
  {
    name: "dashboard",
    command: "pnpm",
    args: ["dashboard:dev"],
    ready: "Dashboard -> http://localhost:3001"
  }
];

if (withSlack) {
  commands.push({
    name: "slack",
    command: "npm",
    args: ["--prefix", "slack", "start"],
    ready: "Slack intake -> http://localhost:3000"
  });
}

let shuttingDown = false;
const children = [];

const shutdown = (signal) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill(signal);
    }
  }

  const exitCode = signal === "SIGINT" || signal === "SIGTERM" ? 0 : 1;
  setTimeout(() => process.exit(exitCode), 50);
};

for (const command of commands) {
  console.log(`[replayx] starting ${command.name}`);
  console.log(`[replayx] ${command.ready}`);

  const child = spawn(command.command, command.args, {
    stdio: "inherit",
    env: sharedEnv,
    shell: process.platform === "win32"
  });

  child.on("exit", (code, signal) => {
    if (shuttingDown) {
      return;
    }

    console.error(
      `[replayx] ${command.name} exited ${signal ? `via ${signal}` : `with code ${code ?? 1}`}`
    );
    shutdown("SIGTERM");
  });

  children.push(child);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

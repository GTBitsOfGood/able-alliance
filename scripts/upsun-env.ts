import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";

const [file, ...options] = process.argv.slice(2);
if (!file) {
  console.error("Usage: npm run upsun:env -- <env-file> [Upsun options]");
  process.exit(1);
}

const variables = parse(readFileSync(file));
for (const [name, value] of Object.entries(variables)) {
  console.log(`Setting ${name}...`);
  const result = spawnSync(
    "upsun",
    [
      "variable:create",
      "--update",
      "--level=environment",
      `--name=env:${name}`,
      `--value=${value}`,
      `--sensitive=true`,
      "--visible-build=true",
      "--visible-runtime=true",
      "--no-wait",
      "--yes",
      "--quiet",
      ...options,
    ],
    { stdio: "ignore", timeout: 120_000 },
  );
  if (result.error || result.status !== 0) {
    console.error(
      result.error &&
        "code" in result.error &&
        result.error.code === "ETIMEDOUT"
        ? `Timed out setting ${name}. Check the variable in Upsun before retrying.`
        : `Failed to set ${name}. Check your Upsun login and options.`,
    );
    process.exit(1);
  }
  console.log(`Submitted ${name}`);
}

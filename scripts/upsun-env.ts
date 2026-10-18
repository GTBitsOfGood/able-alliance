import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parse } from "dotenv";

const [file, ...requestedNames] = process.argv.slice(2);
if (!file) {
  console.error(
    "Usage: npm run upsun:env -- <env-file> [ENV_VAR ...] [-- <Upsun options>]",
  );
  process.exit(1);
}

const separatorIndex = requestedNames.indexOf("--");
const names =
  separatorIndex === -1
    ? requestedNames
    : requestedNames.slice(0, separatorIndex);
const options =
  separatorIndex === -1 ? [] : requestedNames.slice(separatorIndex + 1);

const variables = parse(readFileSync(file));
const selectedNames = names.length > 0 ? names : Object.keys(variables);
const missingNames = selectedNames.filter((name) => !(name in variables));
if (missingNames.length > 0) {
  console.error(`Variable(s) not found in ${file}: ${missingNames.join(", ")}`);
  process.exit(1);
}

for (const name of selectedNames) {
  const value = variables[name];
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

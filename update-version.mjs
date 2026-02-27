import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const hash = execSync("git rev-parse --short HEAD").toString().trim();
const date = new Date().toISOString().replace("T", " ").replace(/:\d{2}\.\d+Z$/, "");
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
const version = `${date} ${hash}`;
manifest.version = version;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");
console.log(`Updated manifest.json version to ${version}`);

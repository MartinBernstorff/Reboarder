import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";

const hash = execSync("git rev-parse --short HEAD").toString().trim();
const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = hash;
writeFileSync("manifest.json", JSON.stringify(manifest, null, "\t") + "\n");
console.log(`Updated manifest.json version to ${hash}`);

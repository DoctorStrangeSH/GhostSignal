import { readdirSync } from "node:fs";
import { resolve, relative } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(".");
const ignored = new Set([".git", "node_modules", "coverage", "dist"]);
const files = [];

function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory()) {
            if (!ignored.has(entry.name)) walk(resolve(directory, entry.name));
            continue;
        }
        if (entry.isFile() && entry.name.endsWith(".js")) {
            files.push(resolve(directory, entry.name));
        }
    }
}

walk(root);
let failed = 0;

for (const file of files) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) {
        failed++;
        process.stderr.write("\n[SYNTAX ERROR] " + relative(root, file) + "\n");
        process.stderr.write(result.stderr || result.stdout || "Unknown syntax error\n");
    }
}

if (failed > 0) {
    process.stderr.write("\nSyntax check failed for " + failed + " of " + files.length + " JavaScript files.\n");
    process.exitCode = 1;
} else {
    process.stdout.write("Syntax check passed: " + files.length + " JavaScript files.\n");
}

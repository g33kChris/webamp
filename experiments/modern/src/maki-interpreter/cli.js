#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const run = require("./interpreter");
const runtime = require("./runtime");
const System = require("./runtime/System");

function main() {
  const relativePath = process.argv[2];
  const data = fs.readFileSync(path.join(__dirname, relativePath));
  const system = new System();
  run({ runtime, data, system, log: true });
}

main();

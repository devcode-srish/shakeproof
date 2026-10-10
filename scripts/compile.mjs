// Compiles contracts/ShakeProof.sol with solc-js -> contracts/artifacts/ShakeProof.json
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const solc = require("solc");

const root = path.resolve(import.meta.dirname, "..");
const source = fs.readFileSync(path.join(root, "contracts/ShakeProof.sol"), "utf8");

function findImports(p) {
  const candidates = [path.join(root, "node_modules", p), path.join(root, p)];
  for (const c of candidates) if (fs.existsSync(c)) return { contents: fs.readFileSync(c, "utf8") };
  return { error: `not found: ${p}` };
}

const input = {
  language: "Solidity",
  sources: { "ShakeProof.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    evmVersion: "cancun",
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
const errors = (out.errors ?? []).filter((e) => e.severity === "error");
for (const e of out.errors ?? []) console.error(e.formattedMessage);
if (errors.length) process.exit(1);

const c = out.contracts["ShakeProof.sol"].ShakeProof;
fs.mkdirSync(path.join(root, "contracts/artifacts"), { recursive: true });
fs.writeFileSync(
  path.join(root, "contracts/artifacts/ShakeProof.json"),
  JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2),
);
console.log("Compiled ShakeProof OK. bytecode bytes:", c.evm.bytecode.object.length / 2);

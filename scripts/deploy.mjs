// Deploys ShakeProof to Monad testnet using RELAYER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY).
// Usage: RELAYER_PRIVATE_KEY=0x... npm run contract:deploy
import fs from "node:fs";
import path from "node:path";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const root = path.resolve(import.meta.dirname, "..");
const artifactPath = path.join(root, "contracts/artifacts/ShakeProof.json");
if (!fs.existsSync(artifactPath)) {
  console.error("Run `npm run contract:compile` first.");
  process.exit(1);
}
const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
const key = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.RELAYER_PRIVATE_KEY;
if (!key) {
  console.error("Set RELAYER_PRIVATE_KEY (funded with testnet MON) in your shell.");
  process.exit(1);
}

const provider = new JsonRpcProvider(rpc, chainId);
const wallet = new Wallet(key, provider);
console.log("Deployer:", wallet.address);
const factory = new ContractFactory(abi, bytecode, wallet);
const contract = await factory.deploy();
await contract.waitForDeployment();
const address = await contract.getAddress();
console.log("\nShakeProof deployed at:", address);
console.log("Add to .env.local:\nNEXT_PUBLIC_SHAKEPROOF_ADDRESS=" + address);

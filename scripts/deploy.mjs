// Deploys ShakeProof to Monad testnet using RELAYER_PRIVATE_KEY (or DEPLOYER_PRIVATE_KEY).
// Usage: RELAYER_PRIVATE_KEY=0x... npm run contract:deploy
import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

const root = path.resolve(import.meta.dirname, "..");
const { loadEnvConfig } = nextEnv;
loadEnvConfig(root);
const artifactPath = path.join(root, "contracts/artifacts/ShakeProof.json");
if (!fs.existsSync(artifactPath)) {
  console.error("Run `npm run contract:compile` first.");
  process.exit(1);
}
const { abi, bytecode } = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const rpc = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet-rpc.monad.xyz";
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
const key = (process.env.RELAYER_PRIVATE_KEY ?? "").trim();
if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.error("Set RELAYER_PRIVATE_KEY to a valid 32-byte hex key in .env.local.");
  process.exit(1);
}

const provider = new JsonRpcProvider(rpc, chainId);
const network = await provider.getNetwork();
if (Number(network.chainId) !== chainId) {
  throw new Error(`RPC chain mismatch: expected ${chainId}, received ${network.chainId}.`);
}

const wallet = new Wallet(key, provider);
const balance = await provider.getBalance(wallet.address);
if (balance === 0n) {
  throw new Error(`Relayer ${wallet.address} has no MON for deployment gas. Fund it on Monad testnet first.`);
}

console.log("Deployer:", wallet.address);
const factory = new ContractFactory(abi, bytecode, wallet);
const deployment = await factory.deploy();
const transaction = deployment.deploymentTransaction();
if (!transaction) throw new Error("Deployment transaction was not created.");
const receipt = await transaction.wait();
if (!receipt || receipt.status !== 1) throw new Error("Monad did not confirm the contract deployment.");

const contract = await deployment.waitForDeployment();
const address = await contract.getAddress();
const deployedCode = await provider.getCode(address);
if (deployedCode === "0x") throw new Error(`No contract bytecode found at ${address} after deployment.`);

const localEnvPath = path.join(root, ".env.local");
const localEnv = fs.existsSync(localEnvPath) ? fs.readFileSync(localEnvPath, "utf8") : "";
const addressSetting = `NEXT_PUBLIC_SHAKEPROOF_ADDRESS=${address}`;
const updatedEnv = /^NEXT_PUBLIC_SHAKEPROOF_ADDRESS=.*$/m.test(localEnv)
  ? localEnv.replace(/^NEXT_PUBLIC_SHAKEPROOF_ADDRESS=.*$/m, addressSetting)
  : `${localEnv}${localEnv && !localEnv.endsWith("\n") ? "\n" : ""}${addressSetting}\n`;
fs.writeFileSync(localEnvPath, updatedEnv);
const explorer = process.env.NEXT_PUBLIC_EXPLORER_TX_BASE ?? "https://testnet.monadvision.com/tx/";
console.log("\nContract address:", address);
console.log("Deployment transaction:", transaction.hash);
console.log("MonadVision:", `${explorer}${transaction.hash}`);
console.log("Contract address saved to .env.local. Restart the app to load it.");

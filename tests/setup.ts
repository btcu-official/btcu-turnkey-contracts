// Setup file to ensure sbtc-token contract is deployed before tests run
import { beforeAll } from "vitest";
import { Cl } from "@stacks/transactions";

beforeAll(() => {
  // Ensure the deployment plan includes the sBTC deployer wallet
  const accounts = simnet.getAccounts();
  
  // Verify sbtc-deployer wallet exists
  const sbtcDeployer = accounts.get("sbtc-deployer");
  
  if (!sbtcDeployer) {
    console.warn("Warning: sbtc-deployer wallet not found in accounts");
    console.log("Available accounts:", Array.from(accounts.keys()));
  }
});


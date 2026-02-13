import { ethers } from "ethers";
import axios from "axios";
import fs from "fs";
import { Config, MonitorItem } from "./config";

// Read config file
const config: Config = JSON.parse(fs.readFileSync("config.json", "utf8"));

// ERC20 token ABI
const erc20Abi = [
  {
    constant: true,
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "symbol",
    outputs: [{ name: "", type: "string" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

// Send Slack alert or log to console
async function sendSlackAlert(
  item: MonitorItem,
  balance: string,
  tokenSymbol: string,
): Promise<void> {
  const chainInfo = config.rpc[item.chainId];
  const chainName = chainInfo ? chainInfo.name : `Chain ${item.chainId}`;

  const message = {
    text: `⚠️ Balance Alert ⚠️`,
    attachments: [
      {
        fields: [
          {
            title: "Address",
            value: item.address,
            short: true,
          },
          {
            title: "Chain",
            value: `${chainName} (${item.chainId})`,
            short: true,
          },
          {
            title: "Token",
            value: tokenSymbol,
            short: true,
          },
          {
            title: "Current Balance",
            value: balance,
            short: true,
          },
          {
            title: "Threshold",
            value: item.threshold,
            short: true,
          },
        ],
      },
    ],
  };

  if (!config.slackWebhook) {
    console.log("Slack webhook is not configured, logging alert to console:");
    console.log(JSON.stringify(message, null, 2));
    console.log(
      `Alert would be sent for ${item.address} on ${chainName} (${item.chainId})`,
    );
    return;
  }

  try {
    await axios.post(config.slackWebhook, message);
    console.log(
      `Alert sent for ${item.address} on ${chainName} (${item.chainId})`,
    );
  } catch (error) {
    console.error("Error sending Slack alert:", error);
  }
}

// Check balance
async function checkBalance(item: MonitorItem): Promise<void> {
  const chainInfo = config.rpc[item.chainId];
  if (!chainInfo || !chainInfo.rpc) {
    console.error(`No RPC URL found for chain ID ${item.chainId}`);
    return;
  }

  const rpcUrl = chainInfo.rpc;
  const chainName = chainInfo.name;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  try {
    if (item.tokenType === "native") {
      const balance = await provider.getBalance(item.address);
      const balanceEth = ethers.formatEther(balance);
      const threshold = parseFloat(item.threshold);

      console.log(
        `Checking ${item.address} on ${chainName} (${item.chainId}): ${balanceEth} ETH`,
      );

      if (parseFloat(balanceEth) < threshold) {
        await sendSlackAlert(item, balanceEth, "ETH");
      }
    } else if (item.tokenType === "erc20" && item.tokenAddress) {
      const contract = new ethers.Contract(
        item.tokenAddress,
        erc20Abi,
        provider,
      );
      const balance = await contract.balanceOf(item.address);
      const decimals = await contract.decimals();
      const symbol = await contract.symbol();
      const balanceFormatted = parseFloat(
        ethers.formatUnits(balance, decimals),
      ).toFixed(4);
      const threshold = parseFloat(item.threshold);

      console.log(
        `Checking ${item.address} on ${chainName} (${item.chainId}): ${balanceFormatted} ${symbol}`,
      );

      if (parseFloat(balanceFormatted) < threshold) {
        await sendSlackAlert(item, balanceFormatted, symbol);
      }
    }
  } catch (error) {
    console.error(
      `Error checking balance for ${item.address} on chain ${item.chainId}:`,
      error,
    );
  }
}

// Main check function
async function checkAllBalances(): Promise<void> {
  console.log("\nChecking all balances...");
  for (const item of config.monitors) {
    await checkBalance(item);
  }
}

// Start monitoring
function startMonitoring(): void {
  console.log("Starting balance monitor...");
  checkAllBalances();
  setInterval(checkAllBalances, config.interval * 1000);
}

// Start application
startMonitoring();

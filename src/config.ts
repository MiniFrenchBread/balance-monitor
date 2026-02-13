export interface ChainInfo {
  rpc: string;
  name: string;
}

export interface ChainConfig {
  [chainId: number]: ChainInfo;
}

export interface MonitorItem {
  address: string;
  chainId: number;
  tokenType: "native" | "erc20";
  tokenAddress?: string;
  threshold: string;
}

export interface Config {
  rpc: ChainConfig;
  slackWebhook: string;
  interval: number;
  monitors: MonitorItem[];
}

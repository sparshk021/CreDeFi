import { BrowserProvider, JsonRpcSigner } from "ethers";
import { CHAIN_ID, CHAIN_NAME, CHAIN_RPC_URL } from "./constants";

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

export function isMetaMaskInstalled(): boolean {
  return typeof window !== "undefined" && !!window.ethereum?.isMetaMask;
}

export async function getProvider(): Promise<BrowserProvider> {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask is not installed");
  }
  return new BrowserProvider(window.ethereum!);
}

export async function connectWallet(): Promise<{
  address: string;
  signer: JsonRpcSigner;
  provider: BrowserProvider;
}> {
  const provider = await getProvider();

  await window.ethereum!.request({ method: "eth_requestAccounts" });

  const signer = await provider.getSigner();
  const address = await signer.getAddress();

  return { address, signer, provider };
}

/** Flatten MetaMask / JSON-RPC errors (message often lives on data.cause). */
function collectErrorText(err: unknown, depth = 0): string {
  if (depth > 5 || err == null) return "";
  if (typeof err === "string") return err;
  if (typeof err !== "object") return String(err);
  const e = err as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of ["message", "reason", "details", "shortMessage"]) {
    const v = e[key];
    if (typeof v === "string") parts.push(v);
  }
  for (const key of ["data", "cause", "error", "originalError", "info"]) {
    if (e[key] != null) {
      parts.push(collectErrorText(e[key], depth + 1));
    }
  }
  return parts.join(" ");
}

/** Chain not in wallet — need wallet_addEthereumChain before switch. */
function isChainNotAddedError(err: unknown): boolean {
  const e = err as {
    code?: number | string;
    data?: { originalError?: { code?: number } };
  };
  const code = typeof e.code === "string" ? Number(e.code) : e.code;
  if (code === 4902) return true;
  if (e.data?.originalError?.code === 4902) return true;
  const msg = collectErrorText(err).toLowerCase();
  if (msg.includes("unrecognized chain")) return true;
  if (msg.includes("wallet_addethereumchain")) return true;
  return false;
}

function isUserRejectedRequest(err: unknown): boolean {
  const e = err as { code?: number | string };
  const code = typeof e.code === "string" ? Number(e.code) : e.code;
  return code === 4001;
}

export async function ensureCorrectChain(): Promise<void> {
  if (!window.ethereum) return;

  const chainIdHex = `0x${CHAIN_ID.toString(16)}`;

  const getChainId = async (): Promise<string> => {
    const id = await window.ethereum!.request({ method: "eth_chainId" });
    return String(id).toLowerCase();
  };

  try {
    const current = await getChainId();
    if (current === chainIdHex.toLowerCase()) return;
  } catch {
    /* continue to switch */
  }

  const switchChain = async () => {
    await window.ethereum!.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chainIdHex }],
    });
  };

  const addChain = async () => {
    const params: Record<string, unknown> = {
      chainId: chainIdHex,
      chainName: CHAIN_NAME,
      nativeCurrency: {
        name: CHAIN_ID === 31337 ? "Ether" : "ETH",
        symbol: "ETH",
        decimals: 18,
      },
      rpcUrls: [CHAIN_RPC_URL],
    };
    // Omit block explorer for local / unknown chains
    if (CHAIN_ID !== 31337) {
      const explorer = process.env.NEXT_PUBLIC_CHAIN_EXPLORER_URL;
      if (explorer) {
        params.blockExplorerUrls = [explorer];
      }
    }

    await window.ethereum!.request({
      method: "wallet_addEthereumChain",
      params: [params],
    });
  };

  try {
    await switchChain();
  } catch (err: unknown) {
    if (isUserRejectedRequest(err)) throw err;
    if (!isChainNotAddedError(err)) {
      throw err;
    }
    try {
      await addChain();
      await switchChain();
    } catch (addErr: unknown) {
      if (isUserRejectedRequest(addErr)) throw addErr;
      const msg =
        collectErrorText(addErr) ||
        `Could not add chain ${CHAIN_ID}. Approve the network in MetaMask or start an RPC at ${CHAIN_RPC_URL}.`;
      throw new Error(msg);
    }
  }
}

export async function signMessage(
  signer: JsonRpcSigner,
  message: string
): Promise<string> {
  return signer.signMessage(message);
}

export function buildSignInMessage(address: string, nonce: string): string {
  return [
    "Welcome to CreDeFi!",
    "",
    "Sign this message to verify your wallet ownership.",
    "",
    `Wallet: ${address}`,
    `Nonce: ${nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join("\n");
}

export function onAccountsChanged(
  handler: (accounts: string[]) => void
): () => void {
  if (!window.ethereum) return () => {};
  const wrapped = (...args: unknown[]) => handler(args[0] as string[]);
  window.ethereum.on("accountsChanged", wrapped);
  return () => window.ethereum!.removeListener("accountsChanged", wrapped);
}

export function onChainChanged(handler: (chainId: string) => void): () => void {
  if (!window.ethereum) return () => {};
  const wrapped = (...args: unknown[]) => handler(args[0] as string);
  window.ethereum.on("chainChanged", wrapped);
  return () => window.ethereum!.removeListener("chainChanged", wrapped);
}

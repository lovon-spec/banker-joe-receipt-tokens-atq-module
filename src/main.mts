import type { ContractTag, ITagService } from "atq-types";
import fetch from "node-fetch";

// Messari-published Banker Joe Avalanche subgraph (subgraph H2VGe is the separate DEX).
// Source publisher: subgraphs.messari.eth, 0x7e8f317a45d67e27e095436d2e0d47171e7c769f.
// Banker Joe subgraph: 9NjYuG2BFU1BPacNdKymd9eNdfVCaJM6LhsgD8zSQgDK.
const endpoint = "https://gateway.thegraph.com/api/deployments/id/QmaPJBS9CXmzT1jFo84JPYgwdnWLTCDMBqa5xP5UGjBJrm";
type Pool = { id: string; name: string | null; outputToken: { id: string; name: string; symbol: string } | null; inputToken: { id: string; name: string; symbol: string } };
type Meta = { deployment: string; hasIndexingErrors: boolean; block: { number: number; hash: string } };

async function query(queryText: string, key: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(endpoint, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query: queryText }), signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Graph HTTP ${response.status}`);
    const result = await response.json() as { data?: Record<string, unknown>; errors?: unknown[] };
    if (!result.data || result.errors?.length) throw new Error("Graph response is incomplete or contains errors");
    return result.data;
  } finally { clearTimeout(timer); }
}

function meta(value: unknown): Meta {
  const m = value as Meta;
  if (!m || m.deployment !== "QmaPJBS9CXmzT1jFo84JPYgwdnWLTCDMBqa5xP5UGjBJrm" ||
      m.hasIndexingErrors !== false || !Number.isSafeInteger(m.block?.number) || m.block.number < 1 ||
      !/^0x[0-9a-f]{64}$/i.test(m.block.hash)) throw new Error("Invalid source deployment or indexed block");
  return m;
}

const service: ITagService = {
  async returnTags(chainId: string, apiKey: string | null): Promise<ContractTag[]> {
    if (chainId !== "43114") throw new Error(`Unsupported Chain ID: ${chainId}`);
    if (typeof apiKey !== "string" || !apiKey.trim()) throw new Error("A Graph API key is required");
    const initial = meta((await query("{ _meta { deployment hasIndexingErrors block { number hash } } }", apiKey))._meta);
    const atBlock = `block: { hash: ${JSON.stringify(initial.block.hash)} }`;
    const tags: ContractTag[] = [], addresses = new Set<string>(), labels = new Set<string>();
    let cursor = "";
    for (;;) {
      // Market IDs are unique contract addresses; there is no unique sequential market field. Use id_gt fallback.
      const data = await query(`{ _meta(${atBlock}) { deployment hasIndexingErrors block { number hash } }
        markets(first: 1000, orderBy: id, orderDirection: asc, where: { id_gt: ${JSON.stringify(cursor)} }, ${atBlock})
        { id name outputToken { id name symbol } inputToken { id name symbol } } }`, apiKey);
      const observed = meta(data._meta);
      if (observed.block.hash !== initial.block.hash || observed.block.number !== initial.block.number) throw new Error("Source block changed");
      if (!Array.isArray(data.markets) || data.markets.length > 1000) throw new Error("Invalid pool page");
      const pools = data.markets as Pool[];
      if (!pools.length) break;
      for (const pool of pools) {
        if (typeof pool.id !== "string" || pool.id <= cursor) throw new Error("Pool cursor did not advance");
        cursor = pool.id;
        if (!/^0x[0-9a-f]{40}$/i.test(pool.id) || /^0x0{40}$/i.test(pool.id) ||
            !pool.outputToken || pool.outputToken.id.toLowerCase() !== pool.id.toLowerCase() || typeof pool.outputToken.name !== "string" || !pool.outputToken.name.trim() || typeof pool.outputToken.symbol !== "string") throw new Error("Invalid pool metadata");
        const address = pool.id.toLowerCase();
        if (addresses.has(address)) throw new Error("Duplicate pool address");
        addresses.add(address);
        const name = pool.outputToken!.name.trim().replace(/\s+/g, " ");
        const label = (name.length > 34 ? name.slice(0, 31) + "..." : name) + ` (${address.slice(2, 12)})`;
        if (labels.has(label)) throw new Error("Ambiguous pool name");
        labels.add(label);
        tags.push({ "Contract Address": `eip155:43114:${address}`, "Project Name": "LFJ",
          "Public Name Tag": label, "UI/Website Link": "https://lfj.gg",
          "Public Note": `Banker Joe lending receipt token on Avalanche, from Trader Joe (now LFJ). Symbol: ${pool.outputToken!.symbol}. Underlying: ${pool.inputToken.symbol}. Market: ${pool.id}.` });
      }
      if (pools.length < 1000) break;
    }
    return tags;
  },
};

export async function returnTags(chainId: string, apiKey: string): Promise<ContractTag[]> {
  return service.returnTags(chainId, apiKey);
}

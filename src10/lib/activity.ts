import { getDb } from "@/lib/db";

export interface ActivityItem {
  id: string;
  trade_id: string;
  trade_title: string;
  label: string;
  detail: string;
  type: string;
  created_at: string;
}

/**
 * Recent activity across a person's transactions, newest first.
 * Read-only: it looks up the existing activity entries for the most recently
 * updated transactions. If anything goes wrong it returns an empty list so
 * the page still loads.
 */
export async function getRecentActivity(trades: any[], limit = 6, maxTrades = 30): Promise<ActivityItem[]> {
  try {
    if (!trades.length) return [];
    const titles = new Map<string, string>(trades.map((t) => [t.id, t.title]));
    const ids = [...trades]
      .sort((a, b) => ((b.updated_at || b.created_at) > (a.updated_at || a.created_at) ? 1 : -1))
      .slice(0, maxTrades)
      .map((t) => t.id);

    const db = getDb();
    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

    const snaps = await Promise.all(
      chunks.map((chunk) => db.collection("trade_events").where("trade_id", "in", chunk).get())
    );

    return snaps
      .flatMap((s) => s.docs.map((d) => d.data() as any))
      .sort((a, b) => (b.created_at > a.created_at ? 1 : -1))
      .slice(0, limit)
      .map((e) => ({
        id: e.id,
        trade_id: e.trade_id,
        trade_title: titles.get(e.trade_id) || "Transaction",
        label: e.label || "",
        detail: e.detail || "",
        type: e.type || "info",
        created_at: e.created_at || "",
      }));
  } catch (e: any) {
    console.error("[activity] failed to load:", e.message);
    return [];
  }
}

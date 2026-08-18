import { DurableObject } from "cloudflare:workers";

interface LogEntry {
	timestamp: string;
	method: string;
	url: string;
	headers: Record<string, string>;
}

/**
 * WorkflowStatusDO — repurposed as a single, globally-consistent request-log store.
 *
 * Cloudflare Worker isolate memory is per-edge-location, not global: a scanner's
 * requests (from GCP) and a manual check (from anywhere else) almost always land
 * on different isolates with separate memory, so a plain in-memory array can never
 * be read back reliably across both. A Durable Object has exactly one canonical
 * instance regardless of where a request originates, which is what actually makes
 * this work. Kept the original class name since it's already deployed/migrated —
 * this needs no new Cloudflare config.
 */
export class WorkflowStatusDO extends DurableObject {
	async logRequest(entry: LogEntry): Promise<void> {
		const logs = (await this.ctx.storage.get<LogEntry[]>("logs")) ?? [];
		logs.push(entry);
		await this.ctx.storage.put("logs", logs.slice(-200));
	}

	async getLogs(): Promise<LogEntry[]> {
		return (await this.ctx.storage.get<LogEntry[]>("logs")) ?? [];
	}

	// No-op: worker/workflow.ts (dead code, kept only so its export satisfies the
	// deploy check — see index.ts) still calls this from its notifyStep helper.
	async updateStep(_stepName: string, _status: string): Promise<void> {}
}

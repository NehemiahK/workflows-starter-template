// Re-exported only because Cloudflare's deploy check requires any class a previous
// version's Durable Object migration created to keep being exported (error 10064) —
// the versioned/gradual-deployments flow this repo's GitHub integration uses can't
// process a migration at all (error 10211), so neither adding nor removing one works.
// MyWorkflow is otherwise unused; WorkflowStatusDO is repurposed as the log store below.
export { MyWorkflow } from "./workflow";
export { WorkflowStatusDO } from "./durable-object";

/**
 * Minimal request-logging Worker for testing Web Bot Auth signature headers.
 *
 * Logs every incoming request (method, url, headers) via a single Durable Object
 * instance — not in-memory, since isolate memory is per-edge-location and a
 * scanner's requests won't land on the same isolate as a manual check — and
 * exposes the captured log as JSON at /__logs. Serves a plain test page for a
 * scanner to crawl/audit at every other path.
 */

const PAGE_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Web Bot Auth signing test page</title></head>
<body>
  <h1>Web Bot Auth signing test page</h1>
  <p>This page exists only to capture headers from an accessFlow scan for signature verification.</p>
  <a href="/other">A second page</a>
</body>
</html>`;

function getLogStore(env: Env) {
	const id = env.WORKFLOW_STATUS.idFromName("request-log");
	return env.WORKFLOW_STATUS.get(id);
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		const store = getLogStore(env);

		if (url.pathname === "/__logs") {
			const logs = await store.getLogs();
			return new Response(JSON.stringify(logs, null, 2), {
				headers: { "Content-Type": "application/json" },
			});
		}

		const headers: Record<string, string> = {};
		for (const [key, value] of request.headers.entries()) {
			headers[key] = value;
		}
		await store.logRequest({
			timestamp: new Date().toISOString(),
			method: request.method,
			url: url.pathname + url.search,
			headers,
		});

		if (url.pathname === "/robots.txt") {
			return new Response("User-agent: *\nAllow: /\n", {
				headers: { "Content-Type": "text/plain" },
			});
		}

		return new Response(PAGE_HTML, {
			headers: { "Content-Type": "text/html" },
		});
	},
} satisfies ExportedHandler<Env>;

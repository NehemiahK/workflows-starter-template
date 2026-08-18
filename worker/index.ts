/**
 * Minimal request-logging Worker for testing Web Bot Auth signature headers.
 *
 * Logs every incoming request (method, url, headers) in-memory, serves a
 * plain test page for a scanner to crawl/audit, and exposes the captured
 * log as JSON at /__logs so it can be checked externally afterward.
 */

let logs: Array<{ timestamp: string; method: string; url: string; headers: Record<string, string> }> = [];

const PAGE_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Web Bot Auth signing test page</title></head>
<body>
  <h1>Web Bot Auth signing test page</h1>
  <p>This page exists only to capture headers from an accessFlow scan for signature verification.</p>
  <a href="/other">A second page</a>
</body>
</html>`;

export default {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === "/__logs") {
			return new Response(JSON.stringify(logs, null, 2), {
				headers: { "Content-Type": "application/json" },
			});
		}

		const headers: Record<string, string> = {};
		for (const [key, value] of request.headers.entries()) {
			headers[key] = value;
		}
		logs.push({
			timestamp: new Date().toISOString(),
			method: request.method,
			url: url.pathname + url.search,
			headers,
		});
		if (logs.length > 200) logs = logs.slice(-200);

		if (url.pathname === "/robots.txt") {
			return new Response("User-agent: *\nAllow: /\n", {
				headers: { "Content-Type": "text/plain" },
			});
		}

		return new Response(PAGE_HTML, {
			headers: { "Content-Type": "text/html" },
		});
	},
} satisfies ExportedHandler;

import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the lighting continuity product", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /别穿帮灯光助手 V3/);
  assert.match(html, /让每一盏灯的数字/);
  assert.match(html, /hero-japan-train-clean\.mp4/);
  assert.match(html, /现场最终指令/);
  assert.match(html, /灯具功率/);
  assert.match(html, /灯具色温/);
  assert.doesNotMatch(html, /Your site is taking shape|codex-preview/);
});

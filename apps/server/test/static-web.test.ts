import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { afterEach, expect, it } from "vitest";
import { createApp } from "../src/index.js";

const servers: Array<{ close: (callback: () => void) => void }> = [];

afterEach(async () => {
  await Promise.all(servers.map(server => new Promise<void>(resolve => server.close(resolve))));
  servers.length = 0;
});

it("serves the built web app for React routes without replacing API routes", async () => {
  const webDistPath = mkdtempSync(join(tmpdir(), "rickie-web-dist-"));
  writeFileSync(join(webDistPath, "index.html"), "<!doctype html><title>Rickie Games</title><div id=\"root\"></div>");

  const server = createServer(createApp({ origin: "http://localhost:5173", webDistPath }));
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Expected an ephemeral TCP address");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const appRoute = await fetch(`${baseUrl}/room/ABC123`);
  expect(appRoute.status).toBe(200);
  expect(appRoute.headers.get("content-type")).toContain("text/html");
  expect(await appRoute.text()).toContain("Rickie Games");

  const apiRoute = await fetch(`${baseUrl}/api/games`);
  expect(apiRoute.status).toBe(200);
  expect(apiRoute.headers.get("content-type")).toContain("application/json");
});

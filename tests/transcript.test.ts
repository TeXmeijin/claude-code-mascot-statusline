import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { deriveSessionStateFromTranscript } from "../src/lib/transcript.js";

describe("deriveSessionStateFromTranscript", () => {
  it("detects running tools from transcript tail", async () => {
    const filePath = path.join(os.tmpdir(), "mascot-transcript-running.jsonl");
    await fs.writeFile(
      filePath,
      [
        JSON.stringify({ type: "user", timestamp: "2026-03-09T00:00:00.000Z", content: "check files" }),
        JSON.stringify({ type: "tool_use", timestamp: "2026-03-09T00:00:01.000Z", tool_name: "Read" })
      ].join("\n"),
      "utf8"
    );

    const state = await deriveSessionStateFromTranscript(filePath, new Date("2026-03-09T00:00:02.000Z"));
    expect(state?.currentState).toBe("tool_running");
    expect(state?.toolCountInTurn).toBe(1);
  });

  it("falls back to tool success and then idle from transcript activity", async () => {
    const filePath = path.join(os.tmpdir(), "mascot-transcript-success.jsonl");
    await fs.writeFile(
      filePath,
      [
        JSON.stringify({ type: "user", timestamp: "2026-03-09T00:00:00.000Z", content: "check files" }),
        JSON.stringify({ type: "tool_use", timestamp: "2026-03-09T00:00:01.000Z", tool_name: "Read" }),
        JSON.stringify({ type: "tool_result", timestamp: "2026-03-09T00:00:02.000Z", tool_name: "Read", tool_output: {} })
      ].join("\n"),
      "utf8"
    );

    const active = await deriveSessionStateFromTranscript(filePath, new Date("2026-03-09T00:00:03.000Z"));
    expect(active?.currentState).toBe("tool_success");

    const stale = await deriveSessionStateFromTranscript(filePath, new Date("2026-03-09T00:00:20.000Z"));
    expect(stale?.currentState).toBe("idle");
  });

  it("parses real transcript-style assistant tool use and final assistant text", async () => {
    const filePath = path.join(os.tmpdir(), "mascot-transcript-real-schema.jsonl");
    await fs.writeFile(
      filePath,
      [
        JSON.stringify({
          type: "user",
          timestamp: "2026-03-09T00:00:00.000Z",
          message: { role: "user", content: [{ type: "text", text: "check files" }] }
        }),
        JSON.stringify({
          type: "assistant",
          timestamp: "2026-03-09T00:00:01.000Z",
          message: { role: "assistant", content: [{ type: "tool_use", name: "Read", input: { file_path: "README.md" } }] }
        }),
        JSON.stringify({
          type: "user",
          timestamp: "2026-03-09T00:00:02.000Z",
          message: { role: "user", content: [{ type: "tool_result", tool_use_id: "toolu_1", content: "done" }] },
          toolUseResult: { filePath: "README.md" }
        }),
        JSON.stringify({
          type: "assistant",
          timestamp: "2026-03-09T00:00:03.000Z",
          message: { role: "assistant", content: [{ type: "text", text: "all set" }] }
        })
      ].join("\n"),
      "utf8"
    );

    const active = await deriveSessionStateFromTranscript(filePath, new Date("2026-03-09T00:00:03.500Z"));
    expect(active?.currentState).toBe("done");
    expect(active?.lastToolName).toBe("Read");

    const stale = await deriveSessionStateFromTranscript(filePath, new Date("2026-03-09T00:00:12.000Z"));
    expect(stale?.currentState).toBe("idle");
  });
});

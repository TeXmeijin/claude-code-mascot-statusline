import { describe, expect, it } from "vitest";

import { renderSprite, renderStatusLine, summarizeState } from "../src/lib/renderer.js";
import { createInitialSessionState, writeSessionState } from "../src/lib/state.js";

describe("renderStatusLine", () => {
  it("renders a block-based sprite when no state exists", async () => {
    const output = await renderStatusLine(
      {
        session_id: "missing-session",
        workspace: {
          project_dir: process.cwd(),
          current_dir: process.cwd()
        }
      },
      {
        widthHint: 120,
        forceColor: false,
        packName: "pixel-buddy"
      }
    );

    expect(output).toContain("██");
    expect(output).toContain("waiting");
    expect(output).not.toContain("/\\_/\\");
  });

  it("renders question state summary from persisted state", async () => {
    const now = new Date("2026-03-09T01:00:00.000Z");
    const state = createInitialSessionState("question-session", now);
    state.currentState = "question";
    state.lastStateChangedAt = now.toISOString();
    await writeSessionState(state);

    const output = await renderStatusLine(
      {
        session_id: "question-session",
        workspace: {
          project_dir: process.cwd(),
          current_dir: process.cwd()
        }
      },
      {
        widthHint: 120,
        forceColor: false,
        packName: "pixel-buddy",
        now
      }
    );

    expect(output).toContain("needs input");
    expect(output).toContain("██");
  });

  it("summarizes tool counts", () => {
    const state = createInitialSessionState("session-2", new Date("2026-03-09T00:00:00.000Z"));
    state.currentState = "thinking";
    state.toolCountInTurn = 3;

    expect(summarizeState("thinking", state, {}).full).toContain("thinking x3");
  });

  it("centers half-block rows with narrow visible spans", () => {
    const output = renderSprite(
      {
        rootDir: process.cwd(),
        manifestPath: "test",
        manifest: {
          name: "test",
          specVersion: 2,
          displayName: "Test",
          sprite: {
            width: 6,
            height: 4,
            palette: [null, "#ffffff"],
            renderMode: "half-block"
          },
          sprites: {},
          states: {},
          fallbacks: {
            unknown: "test"
          }
        }
      },
      [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0, 0],
        [0, 1, 1, 1, 0, 0]
      ],
      {
        colorEnabled: false,
        narrow: false
      }
    );

    expect(output.split("\n")[1]).toBe("  ███ ");
  });

  it("applies pack-level horizontal offset", () => {
    const output = renderSprite(
      {
        rootDir: process.cwd(),
        manifestPath: "test",
        manifest: {
          name: "test",
          specVersion: 2,
          displayName: "Test",
          sprite: {
            width: 2,
            height: 2,
            palette: [null, "#ffffff"],
            renderMode: "half-block",
            offsetX: 1
          },
          sprites: {},
          states: {},
          fallbacks: {
            unknown: "test"
          }
        }
      },
      [
        [1, 1],
        [1, 1]
      ],
      {
        colorEnabled: false,
        narrow: false
      }
    );

    expect(output).toBe(" ██");
  });

  it("supports claude-code-safe rendering for half-block sprites", () => {
    const output = renderSprite(
      {
        rootDir: process.cwd(),
        manifestPath: "test",
        manifest: {
          name: "test",
          specVersion: 2,
          displayName: "Test",
          sprite: {
            width: 2,
            height: 4,
            palette: [null, "#ffffff", "#000000"],
            renderMode: "half-block",
            pixelWidth: 1
          },
          sprites: {},
          states: {},
          fallbacks: {
            unknown: "test"
          }
        }
      },
      [
        [1, 0],
        [0, 2],
        [0, 0],
        [1, 1]
      ],
      {
        colorEnabled: false,
        narrow: false,
        renderProfile: "claude-code-safe"
      }
    );

    expect(output).toBe("▀▄\n▄▄");
  });

  it("fills transparent cells with explicit solid background in claude-code-safe color mode", () => {
    const output = renderSprite(
      {
        rootDir: process.cwd(),
        manifestPath: "test",
        manifest: {
          name: "test",
          specVersion: 2,
          displayName: "Test",
          sprite: {
            width: 2,
            height: 2,
            palette: [null, "#ffffff"],
            renderMode: "half-block",
            pixelWidth: 1
          },
          sprites: {},
          states: {},
          fallbacks: {
            unknown: "test"
          }
        }
      },
      [
        [0, 1],
        [0, 1]
      ],
      {
        colorEnabled: true,
        narrow: false,
        renderProfile: "claude-code-safe"
      }
    );

    expect(output).toContain("\u001b[48;2;0;0;0m\u00a0");
  });

  it("keeps claude-code-safe width close to half-block width", () => {
    const output = renderSprite(
      {
        rootDir: process.cwd(),
        manifestPath: "test",
        manifest: {
          name: "test",
          specVersion: 2,
          displayName: "Test",
          sprite: {
            width: 4,
            height: 4,
            palette: [null, "#ffffff"],
            renderMode: "half-block",
            pixelWidth: 2
          },
          sprites: {},
          states: {},
          fallbacks: {
            unknown: "test"
          }
        }
      },
      [
        [1, 0, 0, 1],
        [1, 0, 0, 1],
        [0, 1, 1, 0],
        [0, 1, 1, 0]
      ],
      {
        colorEnabled: false,
        narrow: false,
        renderProfile: "claude-code-safe"
      }
    );

    expect(output.split("\n")[0]).toHaveLength(4);
    expect(output.split("\n")[1]).toHaveLength(4);
  });
});

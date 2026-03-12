import fs from "node:fs/promises";
import os from "node:os";

await fs.mkdir(os.tmpdir(), { recursive: true });
const testHome = await fs.mkdtemp(`${os.tmpdir()}/claude-code-mascot-statusline-tests-`);
process.env.CLAUDE_MASCOT_HOME = testHome;

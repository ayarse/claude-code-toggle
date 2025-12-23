#!/usr/bin/env node
import { execSync, spawn } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { confirm, input, Separator, select } from "@inquirer/prompts";
import type { Choice, Config } from "./types";

const CLAUDE_DIR = join(homedir(), ".claude");

/**
 * Check if a command is available (cross-platform)
 */
function isCommandAvailable(cmd: string): boolean {
  try {
    const checkCmd =
      process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
    execSync(checkCmd, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Safe file read with error handling
 */
function safeReadFile(path: string): string | null {
  try {
    return readFileSync(path, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to read file: ${message}`);
    return null;
  }
}

/**
 * Safe file write with error handling
 */
function safeWriteFile(path: string, content: string): boolean {
  try {
    writeFileSync(path, content, "utf-8");
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to write file: ${message}`);
    return false;
  }
}

/**
 * Safe file delete with error handling
 */
function safeDeleteFile(path: string): boolean {
  try {
    unlinkSync(path);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`Failed to delete file: ${message}`);
    return false;
  }
}

function getConfigs(): Config[] {
  if (!existsSync(CLAUDE_DIR)) {
    return [];
  }

  const files = readdirSync(CLAUDE_DIR);
  const configs: Config[] = [];

  if (files.includes("settings.json")) {
    configs.push({
      name: "default",
      path: join(CLAUDE_DIR, "settings.json"),
    });
  }

  for (const file of files) {
    const match = file.match(/^settings\.(.+)\.json$/);
    if (match) {
      configs.push({
        name: match[1],
        path: join(CLAUDE_DIR, file),
      });
    }
  }

  return configs.sort((a, b) => {
    if (a.name === "default") return -1;
    if (b.name === "default") return 1;
    return a.name.localeCompare(b.name);
  });
}

function launchClaude(config: Config): void {
  console.log(`\nLaunching Claude with "${config.name}" configuration...\n`);

  const child = spawn("claude", ["--settings", config.path], {
    stdio: "inherit",
  });

  child.on("error", (err) => {
    console.error(`Failed to launch Claude: ${err.message}`);
    process.exit(1);
  });

  child.on("close", (code) => {
    process.exit(code ?? 0);
  });
}

async function createNewConfig(): Promise<Config | null> {
  const name = await input({
    message: "Enter a name for the new configuration:",
    validate: (value) => {
      if (!value.trim()) {
        return "Name cannot be empty";
      }
      if (!/^[\w-]+$/.test(value)) {
        return "Name can only contain letters, numbers, hyphens, and underscores";
      }
      if (value === "default") {
        return '"default" is reserved for settings.json';
      }
      const existingPath = join(CLAUDE_DIR, `settings.${value}.json`);
      if (existsSync(existingPath)) {
        return `Configuration "${value}" already exists`;
      }
      return true;
    },
  });

  const configPath = join(CLAUDE_DIR, `settings.${name}.json`);

  const configs = getConfigs();
  let initialContent = "{}";

  if (configs.length > 0) {
    const copyFrom = await select({
      message: "Initialize from:",
      choices: [
        { name: "Empty config", value: null },
        ...configs.map((c) => ({ name: c.name, value: c })),
      ],
      loop: false,
    });
    if (copyFrom) {
      const content = safeReadFile(copyFrom.path);
      if (content === null) {
        return null;
      }
      initialContent = content;
    }
  }

  if (!safeWriteFile(configPath, initialContent)) {
    return null;
  }

  console.log(`\nCreated "${name}" at ${configPath}`);

  return {
    name,
    path: configPath,
  };
}

async function editConfig(config: Config): Promise<void> {
  const editors = [
    { name: "Nano", value: "nano", available: false },
    { name: "Vim", value: "vim", available: false },
    { name: "VS Code", value: "code -w", available: false },
    { name: "Cursor", value: "cursor -w", available: false },
  ];

  for (const editor of editors) {
    const cmd = editor.value.split(" ")[0];
    editor.available = isCommandAvailable(cmd);
  }

  const availableEditors = editors.filter((e) => e.available);

  if (availableEditors.length === 0) {
    console.log("\nNo editors found. Install nano, vim, code, or cursor.");
    return;
  }

  const editorChoice = await select({
    message: "Choose an editor:",
    choices: availableEditors.map((e) => ({
      name: e.name,
      value: e.value,
    })),
    loop: false,
  });

  const [cmd, ...args] = editorChoice.split(" ");

  console.log(`\nOpening "${config.name}" in ${cmd}...`);

  return new Promise((resolve) => {
    const child = spawn(cmd, [...args, config.path], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", () => {
      console.log("Editor closed.");
      resolve();
    });

    child.on("error", (err) => {
      console.error(`Failed to open editor: ${err.message}`);
      resolve();
    });
  });
}

async function deleteConfig(config: Config): Promise<void> {
  const confirmed = await confirm({
    message: `Are you sure you want to delete "${config.name}"?`,
    default: false,
  });

  if (confirmed) {
    if (safeDeleteFile(config.path)) {
      console.log(`\nDeleted "${config.name}" configuration.`);
    }
  }
}

async function mainMenu(): Promise<void> {
  while (true) {
    const configs = getConfigs();

    console.log("\n--- Claude Code Settings Toggle ---\n");

    if (configs.length === 0) {
      console.log("No configurations found in ~/.claude/");
      console.log("Expected format: settings.{name}.json\n");
      const shouldCreate = await confirm({
        message: "Would you like to create a new configuration?",
        default: true,
      });
      if (shouldCreate) {
        await createNewConfig();
        continue;
      }
      break;
    }

    const choices: Array<{ name: string; value: Choice } | Separator> = [
      ...configs.map((c) => ({
        name: c.name,
        value: { type: "config" as const, config: c },
      })),
      new Separator(),
      { name: "+ Create new", value: { type: "action", action: "create" } },
      { name: "✎ Edit", value: { type: "action", action: "edit" } },
      { name: "✕ Delete", value: { type: "action", action: "delete" } },
      { name: "Exit", value: { type: "action", action: "exit" } },
    ];

    const choice = await select({
      message: "Select configuration:",
      choices,
      loop: false,
    });

    if (choice.type === "config") {
      launchClaude(choice.config);
      return;
    }

    const { action } = choice;

    switch (action) {
      case "exit":
        return;

      case "create":
        await createNewConfig();
        break;

      case "edit": {
        const configChoice = await select({
          message: "Select a configuration to edit:",
          choices: configs.map((c) => ({
            name: c.name,
            value: c,
          })),
          loop: false,
        });
        await editConfig(configChoice);
        break;
      }

      case "delete": {
        const deletableConfigs = configs.filter((c) => c.name !== "default");
        if (deletableConfigs.length === 0) {
          console.log("\nNo configurations to delete.");
          break;
        }
        const configChoice = await select({
          message: "Select a configuration to delete:",
          choices: deletableConfigs.map((c) => ({
            name: c.name,
            value: c,
          })),
          loop: false,
        });
        await deleteConfig(configChoice);
        break;
      }
    }
  }
}

process.on("SIGINT", () => {
  console.log("\n");
  process.exit(0);
});

mainMenu().catch((error) => {
  if (error.name === "ExitPromptError") {
    console.log("\n");
    process.exit(0);
  }
  console.error("Error:", error);
  process.exit(1);
});

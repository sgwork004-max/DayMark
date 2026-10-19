import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { buildPluginAPI, type PluginCommand } from "./PluginAPI.js";

export type { PluginCommand };

interface PluginMeta {
  name: string;
  description: string;
  commands: { key: string; label: string }[];
  code: string;
}

/** Parse header comments from a plugin JS file.
 *
 * // @plugin  My Plugin
 * // @description Does X
 * // @command myFn: Human Label
 */
function parsePluginMeta(code: string, filename: string): PluginMeta {
  const name        = code.match(/@plugin\s+(.+)/)?.[1]?.trim() ?? filename.replace(/\.js$/, "");
  const description = code.match(/@description\s+(.+)/)?.[1]?.trim() ?? "";
  const rawCommands = [...code.matchAll(/@command\s+(\w+):\s*(.+)/g)];
  const commands    = rawCommands.map((m) => ({ key: m[1] ?? "", label: m[2]?.trim() ?? m[1] ?? "" }));
  return { name, description, commands, code };
}

/** Load all plugins from `${vaultPath}/Plugins/*.js` */
export async function loadPlugins(vaultPath: string): Promise<PluginCommand[]> {
  const pluginsDir = `${vaultPath}/Plugins`;
  const api = buildPluginAPI();

  try {
    const entries = await readDir(pluginsDir);
    const commands: PluginCommand[] = [];

    for (const entry of entries) {
      if (!entry.name?.endsWith(".js")) continue;
      try {
        const code = await readTextFile(`${pluginsDir}/${entry.name}`);
        const meta = parsePluginMeta(code, entry.name);

        // Experimental plugin API. Plugins are not enabled in commercial builds.
        // eslint-disable-next-line no-new-func
        const pluginFactory = new Function("Manager", `
          "use strict";
          ${meta.code}
          return { ${meta.commands.map((c) => c.key).join(", ")} };
        `);

        let exports: Record<string, (() => void | Promise<void>) | undefined>;
        try {
          exports = pluginFactory(api) as Record<string, (() => void | Promise<void>) | undefined>;
        } catch (e) {
          console.warn(`Plugin "${meta.name}" failed to initialize:`, e);
          continue;
        }

        for (const { key, label } of meta.commands) {
          const fn = exports[key];
          if (typeof fn !== "function") continue;
          commands.push({
            pluginName: meta.name,
            commandKey: key,
            label,
            run: () => Promise.resolve(fn?.()),
          });
        }
      } catch (e) {
        console.warn(`Failed to load plugin ${entry.name}:`, e);
      }
    }

    return commands;
  } catch {
    // Plugins dir doesn't exist — that's fine
    return [];
  }
}

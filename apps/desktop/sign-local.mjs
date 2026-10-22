import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

if (process.platform === "darwin") {
  const root = path.dirname(fileURLToPath(import.meta.url));
  const targetDir = process.env.CARGO_TARGET_DIR
    ? path.resolve(process.env.CARGO_TARGET_DIR)
    : path.join(root, "src-tauri", "target");
  const app = path.join(targetDir, "release", "bundle", "macos", "DayMark.app");
  const entitlements = path.join(root, "src-tauri", "entitlements.plist");

  execFileSync("xattr", ["-cr", app], { stdio: "inherit" });
  execFileSync("codesign", [
    "--force",
    "--deep",
    "--options", "runtime",
    "--entitlements", entitlements,
    "--sign", "-",
    app,
  ], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", app], {
    stdio: "inherit",
  });
}

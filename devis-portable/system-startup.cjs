"use strict";

const defaultFs = require("node:fs/promises");
const defaultOs = require("node:os");
const defaultPath = require("node:path");

const LINUX_AUTOSTART_FILENAME = "ch.cliniquebellecour.bcdevis.desktop";
const LINUX_AUTOSTART_MARKER = "X-BCDevis-Autostart=true";

function cleanPath(value) {
  return String(value || "").trim();
}

function platformLabel(platform) {
  if (platform === "win32") return "Windows";
  if (platform === "darwin") return "macOS";
  if (platform === "linux") return "Linux";
  return platform || "Système inconnu";
}

function desktopExecQuote(value) {
  return `"${String(value).replace(/([\\"`$])/g, "\\$1")}"`;
}

function windowsLaunchPath({ env, execPath, path }) {
  const portableExecutable = cleanPath(env.PORTABLE_EXECUTABLE_FILE);
  if (portableExecutable) return path.resolve(portableExecutable);

  const portableDirectory = cleanPath(env.PORTABLE_EXECUTABLE_DIR);
  const portableFilename = cleanPath(env.PORTABLE_EXECUTABLE_APP_FILENAME);
  if (portableDirectory && portableFilename) return path.resolve(portableDirectory, portableFilename);

  return path.resolve(execPath);
}

function linuxLaunchPath({ env, execPath, path }) {
  return path.resolve(cleanPath(env.APPIMAGE) || execPath);
}

function linuxAutostartPath({ env, homedir, path }) {
  const configHome = cleanPath(env.XDG_CONFIG_HOME) || path.join(homedir(), ".config");
  return path.resolve(configHome, "autostart", LINUX_AUTOSTART_FILENAME);
}

function linuxDesktopEntry(launchPath) {
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Version=1.0",
    "Name=BCDevis",
    "Comment=Application locale de devis",
    `Exec=${desktopExecQuote(launchPath)}`,
    "Terminal=false",
    "StartupNotify=true",
    "X-GNOME-Autostart-enabled=true",
    LINUX_AUTOSTART_MARKER,
    ""
  ].join("\n");
}

function createStartupManager({
  app,
  platform = process.platform,
  env = process.env,
  execPath = process.execPath,
  fs = defaultFs,
  path = defaultPath,
  homedir = defaultOs.homedir
} = {}) {
  if (!app) throw new TypeError("L’application Electron est requise.");

  const baseStatus = {
    platform,
    platformLabel: platformLabel(platform)
  };

  function unavailable(reason) {
    return {
      ...baseStatus,
      available: false,
      enabled: false,
      registered: false,
      status: reason
    };
  }

  function packagedStatus() {
    if (!app.isPackaged) return unavailable("packaged-required");
    if (!["win32", "darwin", "linux"].includes(platform)) return unavailable("unsupported-platform");
    return null;
  }

  async function get() {
    const unavailableStatus = packagedStatus();
    if (unavailableStatus) return unavailableStatus;

    if (platform === "win32") {
      const launchPath = windowsLaunchPath({ env, execPath, path });
      const settings = app.getLoginItemSettings({ path: launchPath, args: [] });
      const registered = Boolean(settings.openAtLogin);
      const blocked = registered && settings.executableWillLaunchAtLogin === false;
      return {
        ...baseStatus,
        available: true,
        enabled: registered && !blocked,
        registered,
        status: blocked ? "blocked" : (registered ? "enabled" : "disabled"),
        launchPath
      };
    }

    if (platform === "darwin") {
      const settings = app.getLoginItemSettings();
      const registered = Boolean(settings.openAtLogin);
      return {
        ...baseStatus,
        available: true,
        enabled: registered,
        registered,
        status: settings.status || (registered ? "enabled" : "disabled")
      };
    }

    const launchPath = linuxLaunchPath({ env, execPath, path });
    const autostartPath = linuxAutostartPath({ env, homedir, path });
    try {
      const contents = await fs.readFile(autostartPath, "utf8");
      const registered = contents.includes(LINUX_AUTOSTART_MARKER);
      const enabled = registered
        && contents.includes(`Exec=${desktopExecQuote(launchPath)}`)
        && /^X-GNOME-Autostart-enabled\s*=\s*true\s*$/mi.test(contents);
      return {
        ...baseStatus,
        available: true,
        enabled,
        registered,
        status: enabled ? "enabled" : (registered ? "stale" : "disabled"),
        launchPath,
        autostartPath
      };
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      return {
        ...baseStatus,
        available: true,
        enabled: false,
        registered: false,
        status: "disabled",
        launchPath,
        autostartPath
      };
    }
  }

  async function set(enabled) {
    const shouldEnable = Boolean(enabled);
    const unavailableStatus = packagedStatus();
    if (unavailableStatus) return unavailableStatus;

    if (platform === "win32") {
      const launchPath = windowsLaunchPath({ env, execPath, path });
      app.setLoginItemSettings({
        openAtLogin: shouldEnable,
        path: launchPath,
        args: [],
        enabled: shouldEnable,
        name: "BCDevis"
      });
      return get();
    }

    if (platform === "darwin") {
      app.setLoginItemSettings({ openAtLogin: shouldEnable });
      return get();
    }

    const launchPath = linuxLaunchPath({ env, execPath, path });
    const autostartPath = linuxAutostartPath({ env, homedir, path });
    if (shouldEnable) {
      await fs.mkdir(path.dirname(autostartPath), { recursive: true });
      await fs.writeFile(autostartPath, linuxDesktopEntry(launchPath), { encoding: "utf8", mode: 0o644 });
    } else {
      await fs.unlink(autostartPath).catch((error) => {
        if (error?.code !== "ENOENT") throw error;
      });
    }
    return get();
  }

  return { get, set };
}

module.exports = {
  LINUX_AUTOSTART_FILENAME,
  LINUX_AUTOSTART_MARKER,
  createStartupManager,
  desktopExecQuote,
  linuxAutostartPath,
  linuxDesktopEntry,
  linuxLaunchPath,
  platformLabel,
  windowsLaunchPath
};

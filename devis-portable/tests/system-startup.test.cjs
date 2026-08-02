"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const {
  LINUX_AUTOSTART_MARKER,
  createStartupManager,
  desktopExecQuote
} = require("../system-startup.cjs");

const projectRoot = path.resolve(__dirname, "..", "..");
const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

async function testWindowsPortable() {
  let loginSettings = { openAtLogin: false, executableWillLaunchAtLogin: false };
  let lastWrite;
  let lastReadOptions;
  const fakeApp = {
    isPackaged: true,
    getLoginItemSettings(options) {
      lastReadOptions = options;
      return loginSettings;
    },
    setLoginItemSettings(settings) {
      lastWrite = settings;
      loginSettings = {
        openAtLogin: settings.openAtLogin,
        executableWillLaunchAtLogin: settings.openAtLogin && settings.enabled
      };
    }
  };
  const portablePath = "D:\\BCDevis\\BCDevis-4.22.0.exe";
  const manager = createStartupManager({
    app: fakeApp,
    platform: "win32",
    env: {
      PORTABLE_EXECUTABLE_FILE: portablePath,
      PORTABLE_EXECUTABLE_DIR: "D:\\BCDevis"
    },
    execPath: "C:\\Temp\\bcdevis-portable\\BCDevis.exe",
    path: path.win32
  });

  const enabled = await manager.set(true);
  assert.equal(enabled.enabled, true);
  assert.equal(enabled.launchPath, portablePath);
  assert.equal(lastWrite.path, portablePath, "Windows doit enregistrer le véritable EXE portable");
  assert.notEqual(lastWrite.path, "C:\\Temp\\bcdevis-portable\\BCDevis.exe");
  assert.deepEqual(lastWrite.args, []);
  assert.equal(lastWrite.name, "BCDevis");
  assert.equal(lastReadOptions.path, portablePath);

  const disabled = await manager.set(false);
  assert.equal(disabled.enabled, false);
  assert.equal(lastWrite.openAtLogin, false);
}

async function testMacOS() {
  let openAtLogin = false;
  let write;
  const fakeApp = {
    isPackaged: true,
    getLoginItemSettings() {
      return { openAtLogin, status: openAtLogin ? "enabled" : "not-registered" };
    },
    setLoginItemSettings(settings) {
      write = settings;
      openAtLogin = settings.openAtLogin;
    }
  };
  const manager = createStartupManager({
    app: fakeApp,
    platform: "darwin",
    env: {},
    execPath: "/Applications/BCDevis.app/Contents/MacOS/BCDevis",
    path: path.posix
  });

  assert.equal((await manager.get()).enabled, false);
  assert.equal((await manager.set(true)).enabled, true);
  assert.deepEqual(write, { openAtLogin: true });
}

async function testLinuxXdgAutostart() {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), "bcdevis-startup-"));
  try {
    const launchPath = path.join(tempRoot, "BCDevis $ portable.AppImage");
    const manager = createStartupManager({
      app: { isPackaged: true },
      platform: "linux",
      env: { XDG_CONFIG_HOME: path.join(tempRoot, "config"), APPIMAGE: launchPath },
      execPath: "/tmp/.mount-bcdevis/BCDevis",
      path
    });

    const enabled = await manager.set(true);
    assert.equal(enabled.enabled, true);
    assert.equal(enabled.launchPath, launchPath);
    const contents = await fsp.readFile(enabled.autostartPath, "utf8");
    assert.match(contents, /\[Desktop Entry\]/);
    assert.ok(contents.includes(LINUX_AUTOSTART_MARKER));
    assert.ok(contents.includes(`Exec=${desktopExecQuote(launchPath)}`));
    assert.ok(contents.includes("\\$"), "Les caractères spéciaux doivent être échappés dans Exec");

    const disabled = await manager.set(false);
    assert.equal(disabled.enabled, false);
    assert.equal(fs.existsSync(enabled.autostartPath), false);
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

async function testDevelopmentSafety() {
  const manager = createStartupManager({
    app: { isPackaged: false },
    platform: "win32",
    env: {},
    execPath: "C:\\Electron\\electron.exe",
    path: path.win32
  });
  assert.deepEqual(await manager.set(true), {
    platform: "win32",
    platformLabel: "Windows",
    available: false,
    enabled: false,
    registered: false,
    status: "packaged-required"
  });
}

function testDesktopContract() {
  const main = read("devis-portable/main.cjs");
  const preload = read("devis-portable/preload.cjs");
  const app = read("devis-portable/app.js");
  const index = read("devis-portable/index.html");

  assert.match(main, /createStartupManager/);
  assert.match(main, /bcdevis:startup-get/);
  assert.match(main, /bcdevis:startup-set/);
  assert.match(preload, /getLaunchAtLogin:/);
  assert.match(preload, /setLaunchAtLogin:/);
  assert.match(app, /launchAtLogin:\s*false/);
  assert.match(app, /refreshLaunchAtLoginSetting/);
  assert.match(index, /name="launchAtLogin" type="checkbox"/);
  assert.match(index, /Windows · macOS · Linux/);
}

(async () => {
  await testWindowsPortable();
  await testMacOS();
  await testLinuxXdgAutostart();
  await testDevelopmentSafety();
  testDesktopContract();
  console.log("SYSTEM_STARTUP_TESTS_OK");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import { app, BrowserWindow, session, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Network & Web Security bypasses for Quran API media access
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-running-insecure-content');
app.commandLine.appendSwitch('ignore-certificate-errors');

// Safe GPU acceleration & Linux sandboxing (avoids Linux X11/Wayland/Snap launch crashes)
if (process.platform === 'linux') {
  app.commandLine.appendSwitch('no-sandbox');
  app.commandLine.appendSwitch('disable-setuid-sandbox');
  app.commandLine.appendSwitch('disable-gpu-sandbox');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-features', 'VaapiVideoDecoder,UseOzonePlatform');
  app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
} else {
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

let mainWindow: BrowserWindow | null = null;

function resolveEntryHtml(): string {
  const appPath = app.getAppPath();
  const candidates = [
    path.join(appPath, 'dist', 'index.html'),
    path.join(appPath, 'index.html'),
    path.join(__dirname, '../dist/index.html'),
    path.join(__dirname, 'index.html'),
    path.join(process.cwd(), 'dist', 'index.html'),
    path.join(process.cwd(), 'index.html')
  ];

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return path.join(appPath, 'dist', 'index.html');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'CUTECUT PRO SETUP',
    backgroundColor: '#0a0a12',
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      allowRunningInsecureContent: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  });

  // Comprehensive CORS & Network Bypass Rules for quran.com and external cloud streams
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    
    responseHeaders['access-control-allow-origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['access-control-allow-methods'] = ['GET, POST, OPTIONS, PUT, DELETE'];
    responseHeaders['Access-Control-Allow-Methods'] = ['GET, POST, OPTIONS, PUT, DELETE'];
    responseHeaders['access-control-allow-headers'] = ['*'];
    responseHeaders['Access-Control-Allow-Headers'] = ['*'];

    callback({
      responseHeaders,
    });
  });

  const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:3000';
  
  if (process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(devUrl);
  } else {
    const entryHtml = resolveEntryHtml();
    mainWindow.loadFile(entryHtml).catch(() => {
      mainWindow?.loadURL(devUrl);
    });
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// System Hardware Info IPC Handler
ipcMain.handle('get-system-hardware-info', async () => {
  return {
    cpus: os.cpus().length,
    totalMemoryGb: Math.round((os.totalmem() / (1024 * 1024 * 1024)) * 10) / 10,
    freeMemoryGb: Math.round((os.freemem() / (1024 * 1024 * 1024)) * 10) / 10,
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    chromeVersion: process.versions.chrome
  };
});

// Register Native File Save IPC Handlers
ipcMain.handle('show-save-video-dialog', async (_event, defaultFilename: string) => {
  if (!mainWindow) return null;
  const ext = defaultFilename.endsWith('.mp4') ? 'mp4' : 'webm';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Exported Video',
    defaultPath: defaultFilename,
    filters: [
      { name: 'Video Files', extensions: [ext, 'webm', 'mp4'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (result.canceled || !result.filePath) return null;
  return result.filePath;
});

ipcMain.handle('save-video-buffer-to-disk', async (_event, { filePath, buffer }: { filePath: string; buffer: Uint8Array | number[] }) => {
  try {
    const nodeBuf = Buffer.from(buffer);
    if (nodeBuf.length === 0) {
      throw new Error('Received 0 bytes buffer - aborted write');
    }
    await fs.promises.writeFile(filePath, nodeBuf);
    return { success: true, bytesWritten: nodeBuf.length, filePath };
  } catch (err: any) {
    console.error('[Electron IPC] Failed to write video to disk:', err);
    return { success: false, error: err.message };
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

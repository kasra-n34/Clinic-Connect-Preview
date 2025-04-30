const { app, BrowserWindow } = require('electron');
const path = require('path');

// Function to create the browser window
function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
    },
  });

  // Load the `index.html` file
  win.loadFile(path.join(__dirname, 'index.html'));
}

// Listen for the app to be ready
app.on('ready', () => {
  createWindow();
});

// Quit the app when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Re-create the window if the app is activated (macOS behavior)
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

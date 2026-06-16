const SERVER_URL = 'http://localhost:5180';

// DOM Elements
const connectionBadge = document.getElementById('connection-status');
const fileSelect = document.getElementById('file-select');
const customPathInput = document.getElementById('custom-path-input');
const urlOutput = document.getElementById('url-output');
const copyUrlBtn = document.getElementById('copy-url-btn');
const refreshFilesBtn = document.getElementById('refresh-files-btn');
const exportFilenameInput = document.getElementById('export-filename');
const uploadScreenshotBtn = document.getElementById('upload-screenshot-btn');
const clearLogsBtn = document.getElementById('clear-logs-btn');
const logsConsole = document.getElementById('logs-console');

let generatedUrl = '';

// Helper to log messages in the popup console
function log(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const line = document.createElement('div');
  line.className = `log-line ${type}`;
  line.textContent = `[${timestamp}] ${message}`;
  logsConsole.appendChild(line);
  logsConsole.scrollTop = logsConsole.scrollHeight;
}

// Generate URL from absolute workspace file path
function generateUrl(absolutePath, filename) {
  if (!absolutePath) {
    generatedUrl = '';
    urlOutput.value = '';
    copyUrlBtn.setAttribute('disabled', 'true');
    return;
  }
  
  // Append filename to route pathname, and pass absolute path in the query string
  // This allows the production app's handleOpenURL to automatically grab the filename from the pathname suffix
  const safeFilename = encodeURIComponent(filename);
  const safePath = encodeURIComponent(absolutePath);
  
  generatedUrl = `${SERVER_URL}/api/get-file/${safeFilename}?path=${safePath}`;
  urlOutput.value = generatedUrl;
  copyUrlBtn.removeAttribute('disabled');
}

// Check connection to the local test server and fetch file list
async function checkServerConnection() {
  connectionBadge.className = 'status-badge checking';
  connectionBadge.textContent = 'Checking';
  
  try {
    const res = await fetch(`${SERVER_URL}/api/list-files`);
    if (!res.ok) throw new Error('Server returned error status');
    
    const data = await res.json();
    if (data.success && Array.isArray(data.files)) {
      connectionBadge.className = 'status-badge connected';
      connectionBadge.textContent = 'Connected';
      
      // Populate select
      populateFilesDropdown(data.files);
      fileSelect.removeAttribute('disabled');
      log('Connected to Pixelite Agent Test Server.', 'success');
    } else {
      throw new Error('Invalid response structure');
    }
  } catch (err) {
    connectionBadge.className = 'status-badge disconnected';
    connectionBadge.textContent = 'Offline';
    
    fileSelect.setAttribute('disabled', 'true');
    fileSelect.innerHTML = '<option value="">Server offline</option>';
    
    log(`Offline. Run the test server using "node agent-tests/server.cjs" to enable path mapping.`, 'error');
  }
}

// Populate files select dropdown
function populateFilesDropdown(files) {
  if (files.length === 0) {
    fileSelect.innerHTML = '<option value="">No files found in workspace</option>';
    return;
  }
  
  fileSelect.innerHTML = '<option value="">-- Choose a Workspace File --</option>';
  files.forEach(file => {
    const option = document.createElement('option');
    option.value = file.absolutePath;
    option.textContent = `${file.name} (${file.relativePath})`;
    option.dataset.name = file.name;
    fileSelect.appendChild(option);
  });
}

// Handle copying generated link to clipboard
async function copyLinkToClipboard() {
  if (!generatedUrl) return;
  
  try {
    await navigator.clipboard.writeText(generatedUrl);
    log('URL copied to clipboard!', 'success');
    
    // Animate copy button text feedback
    const originalText = copyUrlBtn.textContent;
    copyUrlBtn.textContent = 'Copied!';
    copyUrlBtn.style.background = 'var(--color-success)';
    copyUrlBtn.style.color = '#141416';
    
    setTimeout(() => {
      copyUrlBtn.textContent = originalText;
      copyUrlBtn.style.background = '';
      copyUrlBtn.style.color = '';
    }, 2000);
  } catch (err) {
    log('Failed to copy text: ' + err.message, 'error');
  }
}

// Perform screenshot capture and upload to the server
async function handleViewportScreenshotUpload() {
  let filename = exportFilenameInput.value.trim();
  if (!filename) {
    filename = 'agent_canvas_export.png';
  }
  if (!filename.endsWith('.png')) {
    filename += '.png';
  }
  
  log(`Capturing visible viewport...`, 'info');
  uploadScreenshotBtn.setAttribute('disabled', 'true');
  
  try {
    // Capture the visible viewport of the active tab
    // Requires activeTab and scripting permission
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, async (dataUrl) => {
      if (chrome.runtime.lastError) {
        log(`Capture failed: ${chrome.runtime.lastError.message}`, 'error');
        uploadScreenshotBtn.removeAttribute('disabled');
        return;
      }
      if (!dataUrl) {
        log('Failed to get image snapshot data from active tab.', 'error');
        uploadScreenshotBtn.removeAttribute('disabled');
        return;
      }
      
      const base64Content = dataUrl.split(',')[1];
      log(`Uploading screenshot to local server...`, 'info');
      
      try {
        const response = await fetch(`${SERVER_URL}/api/upload-base64`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            filename,
            content: base64Content,
          }),
        });
        
        const result = await response.json();
        if (result && result.success) {
          log(`Snapshot uploaded successfully as: ${result.filename}`, 'success');
          log(`Saved absolute path: ${result.absolutePath}`, 'info');
        } else {
          log(`Upload failed: ${result?.error || 'Unknown upload error'}`, 'error');
        }
      } catch (err) {
        log(`Failed to upload to test server: ${err.message}`, 'error');
      } finally {
        uploadScreenshotBtn.removeAttribute('disabled');
      }
    });
  } catch (err) {
    log(`Screenshot failure: ${err.message}`, 'error');
    uploadScreenshotBtn.removeAttribute('disabled');
  }
}

// Event Listeners

// Triggered when selecting a file from the workspace dropdown
fileSelect.addEventListener('change', () => {
  const selectedPath = fileSelect.value;
  const selectedOption = fileSelect.options[fileSelect.selectedIndex];
  
  if (selectedPath && selectedOption) {
    // Clear custom path input to prevent confusion
    customPathInput.value = '';
    const filename = selectedOption.dataset.name;
    generateUrl(selectedPath, filename);
    log(`Selected file: ${filename}. Copy link to import.`, 'info');
  } else {
    generateUrl('', '');
  }
});

// Triggered when entering a manual custom file path
customPathInput.addEventListener('input', () => {
  const cleanPath = customPathInput.value.trim();
  
  if (cleanPath) {
    // Reset dropdown selection
    fileSelect.value = '';
    
    // Extract filename from manual local file path
    const lastSlash = Math.max(cleanPath.lastIndexOf('/'), cleanPath.lastIndexOf('\\'));
    const filename = lastSlash !== -1 ? cleanPath.substring(lastSlash + 1) : cleanPath;
    
    generateUrl(cleanPath, filename);
  } else {
    generateUrl('', '');
  }
});

refreshFilesBtn.addEventListener('click', checkServerConnection);
copyUrlBtn.addEventListener('click', copyLinkToClipboard);
uploadScreenshotBtn.addEventListener('click', handleViewportScreenshotUpload);
clearLogsBtn.addEventListener('click', () => {
  logsConsole.innerHTML = '';
  log('Logs cleared.', 'info');
});

// Initial load check
document.addEventListener('DOMContentLoaded', checkServerConnection);

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 5180;
const WORKSPACE_DIR = path.resolve(__dirname, '..');
const UPLOAD_DIR = path.join(__dirname, 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Allowed extensions for importing/testing
const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.psd', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.bmp', '.tiff'
]);

// Helper to recursively list files in a directory
function getWorkspaceFiles(dir, fileList = []) {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = path.join(dir, file);
      let stat;
      try {
        stat = fs.statSync(filePath);
      } catch (e) {
        continue; // Skip broken symlinks or unreadable files
      }

      if (stat.isDirectory()) {
        // Exclude common directories to keep it fast
        if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.gemini' || file === '_tests') {
          continue;
        }
        getWorkspaceFiles(filePath, fileList);
      } else {
        const ext = path.extname(file).toLowerCase();
        if (ALLOWED_EXTENSIONS.has(ext)) {
          // Exclude large photoshop-javascript-ref-2020.pdf as requested
          if (file === 'photoshop-javascript-ref-2020.pdf') {
            continue;
          }
          fileList.push({
            name: file,
            relativePath: path.relative(WORKSPACE_DIR, filePath),
            absolutePath: filePath,
            size: stat.size,
            mtime: stat.mtime
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }
  return fileList;
}

const server = http.createServer((req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // 1. GET /api/list-files
  if (req.method === 'GET' && pathname === '/api/list-files') {
    const files = getWorkspaceFiles(WORKSPACE_DIR);
    
    // Explicitly add land tax PDF if it exists on disk
    const targetPath = "C:\\Users\\Kamlesh Kumar\\Downloads\\ANJANI BABU BHAGWANPUR RECIEPTS OF LAND TAX.pdf";
    if (fs.existsSync(targetPath)) {
      try {
        const stat = fs.statSync(targetPath);
        files.unshift({
          name: "ANJANI BABU BHAGWANPUR RECIEPTS OF LAND TAX.pdf",
          relativePath: "Downloads\\ANJANI BABU BHAGWANPUR RECIEPTS OF LAND TAX.pdf",
          absolutePath: targetPath,
          size: stat.size,
          mtime: stat.mtime
        });
      } catch (e) {
        console.error('Failed to stat land tax PDF:', e);
      }
    }
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, files }));
    return;
  }

  // 2. GET /api/get-file
  if (req.method === 'GET' && (pathname === '/api/get-file' || pathname.startsWith('/api/get-file/'))) {
    const filePath = parsedUrl.query.path;
    if (!filePath) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Path parameter is required' }));
      return;
    }

    // Resolve path and check existence
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: `File not found: ${filePath}` }));
      return;
    }

    // Optional basic security check: ensure it resides on the system
    // (We permit reading any file on the local machine since the developer authorized this server)
    try {
      const stat = fs.statSync(resolvedPath);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': stat.size,
        'Content-Disposition': `attachment; filename="${path.basename(resolvedPath)}"`
      });
      const readStream = fs.createReadStream(resolvedPath);
      readStream.pipe(res);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // 3. POST /api/upload
  if (req.method === 'POST' && pathname === '/api/upload') {
    const filename = parsedUrl.query.filename || `upload_${Date.now()}.bin`;
    // Sanitize filename to prevent directory traversal
    const safeFilename = path.basename(filename);
    const destPath = path.join(UPLOAD_DIR, safeFilename);

    const writeStream = fs.createWriteStream(destPath);
    req.pipe(writeStream);

    writeStream.on('finish', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'File uploaded successfully',
        filename: safeFilename,
        absolutePath: destPath
      }));
    });

    writeStream.on('error', (err) => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return;
  }

  // 4. POST /api/upload-base64
  if (req.method === 'POST' && pathname === '/api/upload-base64') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { filename, content } = payload;
        if (!filename || !content) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, error: 'filename and content are required' }));
          return;
        }

        const safeFilename = path.basename(filename);
        const destPath = path.join(UPLOAD_DIR, safeFilename);
        const buffer = Buffer.from(content, 'base64');

        fs.writeFileSync(destPath, buffer);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          message: 'Base64 file uploaded successfully',
          filename: safeFilename,
          absolutePath: destPath
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // 5. Default route (serve simple debug UI)
  if (pathname === '/' || pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Pixelite Test Server</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; background: #121212; color: #e0e0e0; }
          h1 { color: #ffffff; border-bottom: 1px solid #333; padding-bottom: 10px; }
          .status { color: #00ff66; font-weight: bold; }
          .card { background: #1e1e1e; padding: 20px; border-radius: 8px; border: 1px solid #333; margin-bottom: 20px; }
          code { background: #000; padding: 2px 6px; border-radius: 4px; color: #ff79c6; }
        </style>
      </head>
      <body>
        <h1>Pixelite Agent Test Server</h1>
        <p>Status: <span class="status">Running</span></p>
        
        <div class="card">
          <h2>Available APIs</h2>
          <ul>
            <li><code>GET /api/list-files</code> - Lists all PDF, PSD, and image files in the project.</li>
            <li><code>GET /api/get-file?path=&lt;absolute_path&gt;</code> - Retrieves a local file.</li>
            <li><code>POST /api/upload?filename=&lt;name&gt;</code> - Upload raw binary body to local <code>uploads/</code> directory.</li>
            <li><code>POST /api/upload-base64</code> - Upload JSON base64 body: <code>{ filename, content }</code>.</li>
          </ul>
        </div>
      </body>
      </html>
    `);
    return;
  }

  // Fallback 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: false, error: 'Not Found' }));
});

server.listen(PORT, () => {
  console.log(`[Test Server] Listening on http://localhost:${PORT}`);
});

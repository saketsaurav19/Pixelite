import React, { useState, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import './AgentTestPanel.css';

interface WorkspaceFile {
  name: string;
  relativePath: string;
  absolutePath: string;
  size: number;
}

interface AgentTestPanelProps {
  onImportFile: (file: File | Blob, name?: string, skipResize?: boolean) => Promise<void>;
  getMergedImageData: (format?: string) => string | null;
}

export const AgentTestPanel: React.FC<AgentTestPanelProps> = ({ onImportFile, getMergedImageData }) => {
  const [isActive, setIsActive] = useState(false);
  const [serverUrl, setServerUrl] = useState('http://localhost:5180');
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [files, setFiles] = useState<WorkspaceFile[]>([]);
  const [selectedPath, setSelectedPath] = useState('');
  const [customPath, setCustomPath] = useState('');
  const [status, setStatus] = useState('');
  const [uploadStatus, setUploadStatus] = useState('');
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);

  // Check URL parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('agent-test') === 'true' || process.env.NODE_ENV === 'development') {
      setIsActive(true);
    }
  }, []);

  // Poll connection & load files when panel is open
  useEffect(() => {
    if (!isActive) return;

    const checkConnection = async () => {
      setIsLoadingFiles(true);
      try {
        const res = await fetch(`${serverUrl}/api/list-files`);
        const data = await res.json();
        if (data.success) {
          setIsConnected(true);
          const loadedFiles = data.files || [];
          setFiles(loadedFiles);
          if (loadedFiles.length > 0 && !selectedPath && !customPath) {
            setSelectedPath(loadedFiles[0].absolutePath);
            setCustomPath(loadedFiles[0].absolutePath);
          }
        } else {
          setIsConnected(false);
        }
      } catch (err) {
        setIsConnected(false);
      } finally {
        setIsLoadingFiles(false);
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [isActive, serverUrl]);

  if (!isActive) return null;

  const getMimeType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return 'application/pdf';
      case 'psd': return 'application/x-photoshop';
      case 'png': return 'image/png';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'gif': return 'image/gif';
      case 'svg': return 'image/svg+xml';
      case 'webp': return 'image/webp';
      default: return 'application/octet-stream';
    }
  };

  const handleLoadFile = async (filePath: string) => {
    if (!filePath) {
      setStatus('Error: No file path specified.');
      return;
    }

    setStatus(`Fetching: ${filePath}...`);
    try {
      const response = await fetch(`${serverUrl}/api/get-file?path=${encodeURIComponent(filePath)}`);
      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const blob = await response.blob();
      const filename = filePath.split(/[/\\]/).pop() || 'test_file';
      const mimeType = getMimeType(filename);
      
      const file = new File([blob], filename, { type: mimeType });
      
      setStatus('Importing into application...');
      await onImportFile(file);
      setStatus(`Successfully loaded: ${filename}`);
    } catch (err: any) {
      console.error('[TestPanel] Load failed:', err);
      setStatus(`Failed: ${err.message}`);
    }
  };

  const handleUploadCurrentCanvas = async () => {
    setUploadStatus('Generating image from canvas...');
    const dataUrl = getMergedImageData('image/png');
    if (!dataUrl) {
      setUploadStatus('Error: Failed to export canvas image.');
      return;
    }

    setUploadStatus('Uploading image...');
    try {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const uploadName = `canvas_save_${Date.now()}.png`;

      const uploadRes = await fetch(`${serverUrl}/api/upload?filename=${uploadName}`, {
        method: 'POST',
        body: blob
      });

      const result = await uploadRes.json();
      if (result.success) {
        setUploadStatus(`Uploaded: ${result.filename} to server uploads folder.`);
      } else {
        setUploadStatus(`Upload failed: ${result.error}`);
      }
    } catch (err: any) {
      console.error('[TestPanel] Upload failed:', err);
      setUploadStatus(`Upload error: ${err.message}`);
    }
  };

  return (
    <div className="agent-test-panel">
      <div className="test-panel-header">
        <LucideIcons.Terminal size={14} className="header-icon" />
        <h4>Agent & Test Controller</h4>
        <span className={`status-badge ${isConnected ? 'connected' : 'disconnected'}`}>
          {isConnected ? 'Server Connected' : 'Server Disconnected'}
        </span>
      </div>

      <div className="test-panel-body">
        <div className="input-group">
          <label>Test Server URL</label>
          <div className="url-input-row">
            <input 
              type="text" 
              value={serverUrl} 
              onChange={(e) => setServerUrl(e.target.value)} 
              placeholder="http://localhost:5180"
            />
            <button onClick={() => setIsConnected(null)} title="Reconnect">
              <LucideIcons.RefreshCw size={12} />
            </button>
          </div>
        </div>

        <div className="input-group">
          <label>Select Workspace File</label>
          {isLoadingFiles ? (
            <div className="loading-files">Scanning workspace files...</div>
          ) : files.length === 0 ? (
            <div className="no-files">No testable files found in workspace.</div>
          ) : (
            <select 
              value={selectedPath} 
              onChange={(e) => {
                setSelectedPath(e.target.value);
                setCustomPath(e.target.value);
              }}
            >
              <option value="">-- Choose file --</option>
              {files.map((file, idx) => (
                <option key={idx} value={file.absolutePath}>
                  {file.relativePath} ({Math.round(file.size / 1024)} KB)
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="input-group">
          <label>Or Enter Custom File Path (Absolute)</label>
          <input 
            type="text" 
            value={customPath} 
            onChange={(e) => setCustomPath(e.target.value)}
            placeholder="C:\path\to\your\test.pdf"
          />
        </div>

        <div className="action-row">
          <button 
            className="action-btn primary" 
            onClick={() => handleLoadFile(customPath || selectedPath)}
            disabled={!isConnected}
          >
            <LucideIcons.FileUp size={14} />
            <span>Load File via Server</span>
          </button>
        </div>

        {status && <div className="status-message">{status}</div>}

        <hr className="divider" />

        <div className="input-group">
          <label>Test Server Upload</label>
          <p className="description-text">Upload current canvas view to test filesystem write access</p>
          <button 
            className="action-btn secondary"
            onClick={handleUploadCurrentCanvas}
            disabled={!isConnected}
          >
            <LucideIcons.UploadCloud size={14} />
            <span>Upload Current Canvas</span>
          </button>
        </div>

        {uploadStatus && <div className="status-message upload">{uploadStatus}</div>}
      </div>
    </div>
  );
};

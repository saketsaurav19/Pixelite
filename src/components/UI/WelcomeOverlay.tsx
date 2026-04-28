import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import './WelcomeOverlay.css';

interface WelcomeOverlayProps {
  onOpenImage: () => void;
}

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ onOpenImage }) => {
  const { addLayer, setDocumentSize, recordHistory } = useStore();
  const [showNewDocOptions, setShowNewDocOptions] = useState(false);
  const [newDocSize, setNewDocSize] = useState({ w: 1920, h: 1080 });

  const handleCreateNew = () => {
    setDocumentSize(newDocSize);
    addLayer({
      name: 'Background',
      type: 'paint',
      visible: true,
      locked: false,
      opacity: 1,
      position: { x: 0, y: 0 },
      blendMode: 'source-over'
    });
    recordHistory('New Document');
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { 
      opacity: 1,
      transition: { duration: 0.5, staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring' as const, damping: 25, stiffness: 120 } }
  };

  return (
    <motion.div 
      className="welcome-overlay"
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      <div className="welcome-bg-glow" />
      
      <motion.div className="welcome-content" variants={itemVariants}>
        <div className="welcome-header">
          <div className="welcome-logo">
            <img src="./icon1.png" width={48} height={48} alt="Pixelite" />
          </div>
          <motion.h1 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            Welcome to Pixelite
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            A high-performance photo editor for the modern web.
          </motion.p>
        </div>

        <div className="welcome-grid">
          <motion.div 
            className="welcome-card open-card"
            whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.05)' }}
            whileTap={{ scale: 0.98 }}
            onClick={onOpenImage}
          >
            <div className="card-icon">
              <LucideIcons.FolderOpen size={32} />
            </div>
            <div className="card-info">
              <h3>Open Image</h3>
              <p>Import a file from your computer or drag and drop it here.</p>
            </div>
            <div className="card-shortcut">Ctrl + O</div>
          </motion.div>

          {!showNewDocOptions ? (
            <motion.div 
              className="welcome-card new-card"
              whileHover={{ scale: 1.02, backgroundColor: 'rgba(255,255,255,0.05)' }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowNewDocOptions(true)}
            >
              <div className="card-icon">
                <LucideIcons.Plus size={32} />
              </div>
              <div className="card-info">
                <h3>New Document</h3>
                <p>Start with a blank canvas and create something from scratch.</p>
              </div>
            </motion.div>
          ) : (
            <motion.div 
              className="new-doc-form"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
            >
              <h3>New Canvas</h3>
              <div className="form-row">
                <div className="input-group">
                  <label>Width</label>
                  <input 
                    type="number" 
                    value={newDocSize.w} 
                    onChange={e => setNewDocSize({ ...newDocSize, w: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="input-group">
                  <label>Height</label>
                  <input 
                    type="number" 
                    value={newDocSize.h} 
                    onChange={e => setNewDocSize({ ...newDocSize, h: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="input-group orientation-group">
                  <label>Orientation</label>
                  <div className="orientation-toggle">
                    <button 
                      className={newDocSize.w >= newDocSize.h ? 'active' : ''}
                      onClick={() => {
                        if (newDocSize.w < newDocSize.h) {
                          setNewDocSize({ w: newDocSize.h, h: newDocSize.w });
                        }
                      }}
                      title="Landscape"
                    >
                      <LucideIcons.RectangleHorizontal size={18} />
                    </button>
                    <button 
                      className={newDocSize.h > newDocSize.w ? 'active' : ''}
                      onClick={() => {
                        if (newDocSize.h <= newDocSize.w) {
                          setNewDocSize({ w: newDocSize.h, h: newDocSize.w });
                        }
                      }}
                      title="Portrait"
                    >
                      <LucideIcons.RectangleVertical size={18} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-presets">
                <button onClick={() => setNewDocSize({ w: 1920, h: 1080 })}>Full HD</button>
                <button onClick={() => setNewDocSize({ w: 1080, h: 1080 })}>Square</button>
                <button onClick={() => setNewDocSize({ w: 1080, h: 1920 })}>Story</button>
                <button onClick={() => setNewDocSize({ w: 2480, h: 3508 })}>A4</button>
                <button onClick={() => setNewDocSize({ w: 1200, h: 1800 })}>4x6 Photo</button>
                <button onClick={() => setNewDocSize({ w: 1500, h: 2100 })}>5x7 Photo</button>
              </div>
              <div className="form-actions">
                <button className="btn-cancel" onClick={() => setShowNewDocOptions(false)}>Cancel</button>
                <button className="btn-create" onClick={handleCreateNew}>Create</button>
              </div>
            </motion.div>
          )}
        </div>

        <motion.div className="welcome-footer" variants={itemVariants}>
          <div className="footer-item">
            <LucideIcons.Globe size={16} />
            <span>Runs fully in browser • No server</span>
          </div>
          <div className="footer-item">
            <LucideIcons.Cpu size={16} />
            <span>GPU Accelerated</span>
          </div>
          <a 
            href="https://github.com/saketsaurav19/Pixelite" 
            target="_blank" 
            rel="noopener noreferrer"
            className="github-star-btn vpi-social-github"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            <span>Star on GitHub</span>
          </a>
        </motion.div>
      </motion.div>

      <motion.div 
        className="welcome-social"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
      >
        <p>Pixelite v0.8.0 • High-Performance Web Editor</p>
      </motion.div>
    </motion.div>
  );
};

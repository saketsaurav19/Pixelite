import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import * as LucideIcons from 'lucide-react';
import { RecentProjectsStorage } from '../../services/storage/RecentProjectsStorage';
import type { RecentProject } from '../../services/storage/RecentProjectsStorage';
import './Dialogs.css';

export const OpenRecentDialog: React.FC = () => {
  const { isOpenRecentDialogOpen, setIsOpenRecentDialogOpen, setLayers, setDocumentSize, setActiveLayerId } = useStore();
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecentProjects = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const projects = await RecentProjectsStorage.getRecentProjects();
      setRecentProjects(projects);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpenRecentDialogOpen) {
      loadRecentProjects();
    }
  }, [isOpenRecentDialogOpen, loadRecentProjects]);



  if (!isOpenRecentDialogOpen) return null;

  const handleOpenProject = async (id: string) => {
    const project = await RecentProjectsStorage.loadProjectState(id);
    if (project && project.stateSnapshot) {
      if (project.stateSnapshot.documentSize) {
        setDocumentSize(project.stateSnapshot.documentSize);
      }
      if (project.stateSnapshot.layers) {
        setLayers(project.stateSnapshot.layers);
      }
      if (project.stateSnapshot.activeLayerId !== undefined) {
        setActiveLayerId(project.stateSnapshot.activeLayerId);
      }
      setIsOpenRecentDialogOpen(false);
    } else {
      alert('Failed to load project state');
    }
  };

  const handleDeleteProject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await RecentProjectsStorage.deleteProject(id);
    loadRecentProjects();
  };

  return (
    <div className="dialog-overlay" onClick={() => setIsOpenRecentDialogOpen(false)}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()} style={{ width: '500px' }}>
        <div className="dialog-header">
          <h3>Open Recent Projects</h3>
          <button className="dialog-close" onClick={() => setIsOpenRecentDialogOpen(false)}>
            <LucideIcons.X size={18} />
          </button>
        </div>

        <div className="dialog-body" style={{ minHeight: '300px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px' }}>
              <p>Loading...</p>
            </div>
          ) : recentProjects.length === 0 ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', flexDirection: 'column', color: '#888' }}>
              <LucideIcons.FolderOpen size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <p>No recent projects found</p>
            </div>
          ) : (
            <div className="recent-projects-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentProjects.map(project => (
                <div
                  key={project.id}
                  className="recent-project-card"
                  onClick={() => handleOpenProject(project.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                >
                  <div className="recent-project-thumb" style={{ width: '80px', height: '80px', backgroundColor: '#000', borderRadius: '4px', overflow: 'hidden', marginRight: '16px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {project.thumbnailDataUrl ? (
                       <img src={project.thumbnailDataUrl} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    ) : (
                       <LucideIcons.Image size={24} color="#555" />
                    )}
                  </div>
                  <div className="recent-project-info" style={{ flexGrow: 1 }}>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: '#fff' }}>{project.name}</h4>
                    <p style={{ margin: '0', fontSize: '12px', color: '#aaa' }}>
                      {project.documentSize.w} x {project.documentSize.h} px
                    </p>
                    <p style={{ margin: '4px 0 0 0', fontSize: '11px', color: '#777' }}>
                      {new Date(project.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer', padding: '8px' }}
                    title="Remove from history"
                  >
                    <LucideIcons.Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

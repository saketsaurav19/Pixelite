import React from 'react';
import { X, Plus } from 'lucide-react';
import { useStore } from '../../store/useStore';
import './TabBar.css';

const TabBar: React.FC = () => {
  const { 
    documents, 
    activeDocumentId, 
    switchDocument,
    closeDocument,
    addDocument 
  } = useStore();

  return (
    <div className="tab-bar">
      <div className="tabs-container">
        {documents.map((doc) => (
          <div 
            key={doc.id} 
            className={`tab ${activeDocumentId === doc.id ? 'active' : ''}`}
            onClick={() => switchDocument(doc.id)}
          >
            <span className="tab-name">{doc.name}</span>
            <button 
              className="close-tab" 
              onClick={(e) => {
                e.stopPropagation();
                closeDocument(doc.id);
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <button className="new-tab-btn" onClick={() => addDocument()}>
        <Plus size={16} />
      </button>
    </div>
  );
};

export default TabBar;

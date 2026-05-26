import React, { useState, useRef, useEffect } from 'react';
import { FileMenu } from './FileMenu';
import './MenuSystem.css';

export const MenuBar: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = (menuName: string) => {
    if (activeMenu !== null) {
      setActiveMenu(menuName);
    }
  };

  const toggleMenu = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  return (
    <div className="main-menu-bar" ref={barRef}>
      <div className="logo" style={{ fontWeight: 'bold', padding: '0 12px', color: '#fff' }}>Px</div>

      <div
        className={`menu-bar-item ${activeMenu === 'file' ? 'active' : ''}`}
        onClick={() => toggleMenu('file')}
        onMouseEnter={() => handleMouseEnter('file')}
      >
        File
        {activeMenu === 'file' && <FileMenu onClose={() => setActiveMenu(null)} />}
      </div>

      <div className="menu-bar-item" onMouseEnter={() => handleMouseEnter('edit')} onClick={() => toggleMenu('edit')}>
        Edit
        {activeMenu === 'edit' && (
             <div className="menu-dropdown">
                 <div className="menu-item disabled">Undo</div>
                 <div className="menu-item disabled">Redo</div>
             </div>
        )}
      </div>

      <div className="menu-bar-item" onMouseEnter={() => handleMouseEnter('image')} onClick={() => toggleMenu('image')}>Image</div>
      <div className="menu-bar-item" onMouseEnter={() => handleMouseEnter('layer')} onClick={() => toggleMenu('layer')}>Layer</div>
      <div className="menu-bar-item" onMouseEnter={() => handleMouseEnter('select')} onClick={() => toggleMenu('select')}>Select</div>
      <div className="menu-bar-item" onMouseEnter={() => handleMouseEnter('filter')} onClick={() => toggleMenu('filter')}>Filter</div>
      <div className="menu-bar-item" onMouseEnter={() => handleMouseEnter('view')} onClick={() => toggleMenu('view')}>View</div>
      <div className="menu-bar-item" onMouseEnter={() => handleMouseEnter('window')} onClick={() => toggleMenu('window')}>Window</div>
      <div className="menu-bar-item" onMouseEnter={() => handleMouseEnter('help')} onClick={() => toggleMenu('help')}>Help</div>
    </div>
  );
};

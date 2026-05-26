import React, { useState, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FileMenu } from './FileMenu';
import './MenuSystem.css';

export const MenuBar: React.FC = () => {
  const { isMobileMenuOpen, setIsMobileMenuOpen } = useStore();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // Allow interaction if clicking on mobile menu toggle button, handled by App.tsx
      if (e.target instanceof Element && e.target.closest('.mobile-menu-btn')) return;
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
        // We do not close the mobile menu here, as it's handled by backdrop in App.tsx
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = (menuName: string) => {
    // Only trigger hover on desktop
    if (window.innerWidth > 768 && activeMenu !== null) {
      setActiveMenu(menuName);
    }
  };

  const toggleMenu = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  return (
    <nav className={`main-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`} ref={barRef}>
      <div className="mobile-menu-header">
        <span>Menu</span>
        <button onClick={() => setIsMobileMenuOpen(false)}>
          <LucideIcons.X size={20} />
        </button>
      </div>

      <div
        className={`menu-item-container ${activeMenu === 'file' ? 'active' : ''}`}
        onClick={() => toggleMenu('file')}
        onMouseEnter={() => handleMouseEnter('file')}
      >
        File
        <FileMenu onClose={() => setActiveMenu(null)} />
      </div>

      <div
        className={`menu-item-container ${activeMenu === 'edit' ? 'active' : ''}`}
        onMouseEnter={() => handleMouseEnter('edit')}
        onClick={() => toggleMenu('edit')}
      >
        Edit
        <div className="menu-dropdown edit-menu">
            <div className="menu-item disabled">Undo</div>
            <div className="menu-item disabled">Redo</div>
        </div>
      </div>

      <div className="menu-item-container" onMouseEnter={() => handleMouseEnter('image')} onClick={() => toggleMenu('image')}>Image</div>
      <div className="menu-item-container" onMouseEnter={() => handleMouseEnter('layer')} onClick={() => toggleMenu('layer')}>Layer</div>
      <div className="menu-item-container" onMouseEnter={() => handleMouseEnter('select')} onClick={() => toggleMenu('select')}>Select</div>
      <div className="menu-item-container" onMouseEnter={() => handleMouseEnter('filter')} onClick={() => toggleMenu('filter')}>Filter</div>
      <div className="menu-item-container" onMouseEnter={() => handleMouseEnter('view')} onClick={() => toggleMenu('view')}>View</div>
      <div className="menu-item-container" onMouseEnter={() => handleMouseEnter('window')} onClick={() => toggleMenu('window')}>Window</div>
      <div className="menu-item-container" onMouseEnter={() => handleMouseEnter('help')} onClick={() => toggleMenu('help')}>Help</div>
    </nav>
  );
};

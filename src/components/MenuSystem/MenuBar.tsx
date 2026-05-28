import React, { useState, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FileMenu } from './FileMenu';
import { staticMenus } from './menus';
import { isGroupItem, isLeafItem, type MenuItem } from './menus/types';
import './MenuSystem.css';

export const MenuBar: React.FC = () => {
  const { isMobileMenuOpen, setIsMobileMenuOpen } = useStore();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeSubmenus, setActiveSubmenus] = useState<Record<string, boolean>>({});
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('.mobile-menu-btn')) return;
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = (menuName: string) => {
    if (window.innerWidth > 768 && activeMenu !== null) {
      setActiveMenu(menuName);
    }
  };

  const toggleMenu = (menuName: string) => {
    setActiveMenu(activeMenu === menuName ? null : menuName);
  };

  const runAction = (action: (state: ReturnType<typeof useStore.getState>) => void) => {
    action(useStore.getState());
  };

  /**
   * Mobile only: toggle a specific submenu open/closed.
   * On desktop, submenus are controlled purely by CSS :hover — no JS needed.
   */
  const toggleSubmenu = (key: string) => {
    if (window.innerWidth > 768) return;
    setActiveSubmenus((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderMenuItems = (menuName: string, items: MenuItem[], path: string[] = []) => (
    <>
      {items.map((item, index) => {
        if ('divider' in item && item.divider) {
          return <div key={`${menuName}-divider-${path.join('-')}-${index}`} className="menu-divider" />;
        }

        if (isGroupItem(item)) {
          const submenuKey = `${menuName}:${[...path, item.label].join('>')}`;
          const isOpen = Boolean(activeSubmenus[submenuKey]);

          return (
            <div
              key={`${menuName}-${submenuKey}`}
              className={`menu-item has-submenu ${isOpen ? 'submenu-active' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleSubmenu(submenuKey);
              }}
            >
              <span className="menu-label">{item.label}</span>
              <LucideIcons.ChevronRight
                size={14}
                className={`submenu-icon ${isOpen ? 'rotated' : ''}`}
              />
              <div className={`submenu ${isOpen ? 'active' : ''}`}>
                {renderMenuItems(menuName, item.submenu, [...path, item.label])}
              </div>
            </div>
          );
        }

        if (isLeafItem(item)) {
          const enabled = item.isEnabled ? item.isEnabled(useStore.getState()) : true;
          return (
            <div
              key={`${menuName}-${[...path, item.label].join('>')}`}
              className={`menu-item ${enabled ? '' : 'disabled'}`}
              onClick={(e) => {
                e.stopPropagation();
                if (enabled) runAction(item.action);
              }}
            >
              <span className="menu-label">{item.isChecked && item.isChecked(useStore.getState()) ? "✓ " : ""}{item.label}</span>
              {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
            </div>
          );
        }

        return null;
      })}
    </>
  );

  const renderStaticMenu = (menuName: string) => {
    const menuItems = staticMenus[menuName] ?? [];
    return (
      <div className={`menu-dropdown ${menuName}-menu`}>
        {renderMenuItems(menuName, menuItems)}
      </div>
    );
  };

  const menus: { key: string; label: string; component?: React.ReactNode }[] = [
    { key: 'file',   label: 'File',   component: <FileMenu onClose={() => setActiveMenu(null)} /> },
    { key: 'edit',   label: 'Edit'   },
    { key: 'image',  label: 'Image'  },
    { key: 'layer',  label: 'Layer'  },
    { key: 'select', label: 'Select' },
    { key: 'filter', label: 'Filter' },
    { key: 'view',   label: 'View'   },
    { key: 'window', label: 'Window' },
    { key: 'help',   label: 'Help'   },
  ];

  return (
    <nav className={`main-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`} ref={barRef}>
      <div className="mobile-menu-header">
        <span>Menu</span>
        <button onClick={() => setIsMobileMenuOpen(false)}>
          <LucideIcons.X size={20} />
        </button>
      </div>

      {menus.map((menu) => (
        <div
          key={menu.key}
          className={`menu-item-container ${activeMenu === menu.key ? 'active' : ''}`}
          onClick={() => toggleMenu(menu.key)}
          onMouseEnter={() => handleMouseEnter(menu.key)}
        >
          {menu.label}
          {menu.component ?? renderStaticMenu(menu.key)}
        </div>
      ))}
    </nav>
  );
};
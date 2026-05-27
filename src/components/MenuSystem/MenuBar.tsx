import React, { useState, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import { useStore } from '../../store/useStore';
import { FileMenu } from './FileMenu';
import { staticMenus } from './menus';
import { isGroupItem, isLeafItem } from './menus/types';
import './MenuSystem.css';

export const MenuBar: React.FC = () => {
  const { isMobileMenuOpen, setIsMobileMenuOpen } = useStore();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [activeSubmenus, setActiveSubmenus] = useState<Record<string, string | null>>({});
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

  const toggleSubmenu = (menuName: string, submenuLabel: string) => {
    if (window.innerWidth > 768) return;
    setActiveSubmenus((prev) => ({
      ...prev,
      [menuName]: prev[menuName] === submenuLabel ? null : submenuLabel,
    }));
  };

  const renderStaticMenu = (menuName: string) => {
    const menuItems = staticMenus[menuName] ?? [];
    return (
      <div className={`menu-dropdown ${menuName}-menu`}>
        {menuItems.map((item, index) => {
          if ('divider' in item && item.divider) return <div key={`${menuName}-divider-${index}`} className="menu-divider" />;

          if (isGroupItem(item)) {
            const isSubmenuActive = activeSubmenus[menuName] === item.label;
            return (
              <div
                key={`${menuName}-${item.label}`}
                className={`menu-item has-submenu ${isSubmenuActive ? 'submenu-active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSubmenu(menuName, item.label);
                }}
              >
                <span className="menu-label">{item.label}</span>
                <LucideIcons.ChevronRight size={14} className={`submenu-icon ${isSubmenuActive ? 'rotated' : ''}`} />
                <div className={`submenu ${isSubmenuActive ? 'active' : ''}`}>
                  {item.submenu.map((subItem) => {
                    const enabled = subItem.isEnabled ? subItem.isEnabled(useStore.getState()) : true;
                    return (
                      <div
                        key={`${menuName}-${item.label}-${subItem.label}`}
                        className={`menu-item ${enabled ? '' : 'disabled'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (enabled) runAction(subItem.action);
                        }}
                      >
                        <span className="menu-label">{subItem.label}</span>
                        {subItem.shortcut && <span className="menu-shortcut">{subItem.shortcut}</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }

          if (isLeafItem(item)) {
            const enabled = item.isEnabled ? item.isEnabled(useStore.getState()) : true;
            return (
              <div
                key={`${menuName}-${item.label}`}
                className={`menu-item ${enabled ? '' : 'disabled'}`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (enabled) runAction(item.action);
                }}
              >
                <span className="menu-label">{item.label}</span>
                {item.shortcut && <span className="menu-shortcut">{item.shortcut}</span>}
              </div>
            );
          }

          return null;
        })}
      </div>
    );
  };

  const menus: { key: string; label: string; component?: React.ReactNode }[] = [
    { key: 'file', label: 'File', component: <FileMenu onClose={() => setActiveMenu(null)} /> },
    { key: 'edit', label: 'Edit' },
    { key: 'image', label: 'Image' },
    { key: 'layer', label: 'Layer' },
    { key: 'select', label: 'Select' },
    { key: 'filter', label: 'Filter' },
    { key: 'view', label: 'View' },
    { key: 'window', label: 'Window' },
    { key: 'help', label: 'Help' },
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

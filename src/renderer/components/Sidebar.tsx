import React from 'react';
import {
  LayoutGrid,
  FolderOpen,
  GitBranch,
  List,
  Settings,
} from 'lucide-react';

export type Page = 'home' | 'projects' | 'repos' | 'guidelines' | 'settings' | 'projectView';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const NavItem: React.FC<NavItemProps> = ({ icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      height: 32,
      width: '100%',
      padding: active ? '0 10px 0 8px' : '0 10px',
      borderRadius: 5,
      border: 'none',
      background: active ? '#161616' : 'transparent',
      borderLeft: active ? '2px solid #3B82F6' : '2px solid transparent',
      cursor: 'pointer',
      transition: 'all 0.12s ease',
      textAlign: 'left',
    }}
    onMouseEnter={e => {
      if (!active) {
        (e.currentTarget as HTMLButtonElement).style.background = '#141414';
        (e.currentTarget as HTMLButtonElement).querySelectorAll('.nav-icon, .nav-label').forEach(el => {
          (el as HTMLElement).style.color = '#fff';
        });
      }
    }}
    onMouseLeave={e => {
      if (!active) {
        (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
        (e.currentTarget as HTMLButtonElement).querySelectorAll('.nav-icon').forEach(el => {
          (el as HTMLElement).style.color = '#444';
        });
        (e.currentTarget as HTMLButtonElement).querySelectorAll('.nav-label').forEach(el => {
          (el as HTMLElement).style.color = '#555';
        });
      }
    }}
  >
    <span
      className="nav-icon"
      style={{
        display: 'flex',
        alignItems: 'center',
        color: active ? '#fff' : '#444',
        transition: 'color 0.12s ease',
        flexShrink: 0,
      }}
    >
      {icon}
    </span>
    <span
      className="nav-label"
      style={{
        fontSize: 13,
        fontWeight: 400,
        color: active ? '#fff' : '#555',
        transition: 'color 0.12s ease',
      }}
    >
      {label}
    </span>
  </button>
);

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
    { id: 'home',       label: 'Home',       icon: <LayoutGrid size={15} /> },
    { id: 'projects',   label: 'Projects',   icon: <FolderOpen size={15} /> },
    { id: 'repos',      label: 'Repos',      icon: <GitBranch size={15} /> },
    { id: 'guidelines', label: 'Guidelines', icon: <List size={15} /> },
  ];

  return (
    <div
      style={{
        width: 220,
        flexShrink: 0,
        height: '100vh',
        background: '#0a0a0a',
        borderRight: '1px solid #1c1c1c',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 52,
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          borderBottom: '1px solid #1c1c1c',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 14,
            height: 14,
            background: '#fff',
            borderRadius: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: "'Geist Mono', monospace",
              fontSize: 9,
              fontWeight: 700,
              color: '#000',
              lineHeight: 1,
            }}
          >
            R
          </span>
        </div>
        <span
          style={{
            marginLeft: 8,
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            letterSpacing: '-0.2px',
          }}
        >
          Refract
        </span>
      </div>

      {/* Nav items */}
      <nav
        style={{
          padding: '8px 8px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {navItems.map(item => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activePage === item.id}
            onClick={() => onNavigate(item.id)}
          />
        ))}
      </nav>

      {/* Settings pinned bottom */}
      <div
        style={{
          marginTop: 'auto',
          padding: 8,
          borderTop: '1px solid #1c1c1c',
        }}
      >
        <NavItem
          icon={<Settings size={15} />}
          label="Settings"
          active={activePage === 'settings'}
          onClick={() => onNavigate('settings')}
        />
      </div>
    </div>
  );
};

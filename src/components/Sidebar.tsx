import React from 'react';
import { cn } from '../lib/utils';
import { 
  LayoutDashboard, 
  FolderOpen, 
  GitBranch, 
  GraduationCap, 
  Settings, 
  LogOut,
  User
} from 'lucide-react';
import { LogoMark } from './Logo';
import { useAuth } from '../lib/AuthContext';

export type Page = 'home' | 'projects' | 'repos' | 'guidelines' | 'settings' | 'projectView' | 'reports' | 'chat' | 'deals' | 'accounts' | 'competitors' | 'feedback' | 'review';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate }) => {
  const { profile, session, signOut } = useAuth();
  
  const userEmail = session?.user?.email ?? '';
  const userName  = profile?.name ?? userEmail.split('@')[0] ?? 'User';

  const navItems = [
    { id: 'home', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'repos', label: 'Repositories', icon: GitBranch },
    { id: 'guidelines', label: 'Guidelines', icon: GraduationCap },
  ];

  return (
    <div className="flex h-screen w-[240px] shrink-0 flex-col bg-background border-r border-border select-none">
      {/* Header */}
      <div className="flex h-[64px] shrink-0 items-center gap-3 px-6 border-b border-border">
        <LogoMark size={20} className="text-foreground" />
        <span className="font-semibold tracking-tight text-foreground" style={{ fontSize: '18px', letterSpacing: '-0.18px', fontFamily: 'var(--font-display)' }}>
          Refract
        </span>
      </div>
      
      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2">
        <div className="section-label px-2 mb-4">
          Workspace
        </div>
        
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as Page)}
              className={cn(
                "flex w-full items-center gap-3 px-3 py-2.5 text-[15px] transition-all duration-200 outline-none rounded-[10px]",
                isActive 
                  ? "bg-accent text-foreground font-medium" 
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )}
            >
              <Icon size={18} className={isActive ? "text-foreground" : "text-muted-foreground"} />
              <span style={{ letterSpacing: '-0.15px' }}>{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      {/* Footer (User & Settings) */}
      <div className="shrink-0 p-4 space-y-2 border-t border-border">
        <button
          onClick={() => onNavigate('settings')}
          className={cn(
            "flex w-full items-center gap-3 px-3 py-2.5 text-[15px] transition-all duration-200 outline-none rounded-[10px]",
            activePage === 'settings'
              ? "bg-accent text-foreground font-medium" 
              : "text-muted-foreground hover:bg-card hover:text-foreground"
          )}
        >
          <Settings size={18} />
          <span style={{ letterSpacing: '-0.15px' }}>Settings</span>
        </button>
        
        <div className="flex items-center gap-3 px-3 py-3 mt-2 rounded-[10px] bg-card">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-foreground">
            <User size={14} />
          </div>
          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
            <span className="truncate text-[13px] font-medium text-foreground" style={{ letterSpacing: '-0.13px' }}>{userName}</span>
            <span className="truncate text-[11px] text-muted-foreground">{userEmail}</span>
          </div>
        </div>
        
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-[14px] font-medium text-muted-foreground transition-all duration-200 hover:text-[#ff5577] hover:bg-[#ff5577]/10 rounded-[10px] outline-none"
        >
          <LogOut size={16} />
          <span style={{ letterSpacing: '-0.14px' }}>Sign Out</span>
        </button>
      </div>
    </div>
  );
};

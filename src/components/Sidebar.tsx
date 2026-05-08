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
    <div className="flex h-screen w-[240px] shrink-0 flex-col border-r border-border bg-background select-none">
      {/* Header */}
      <div className="flex h-[54px] shrink-0 items-center gap-3 border-b border-border px-5">
        <LogoMark size={16} className="text-foreground" />
        <span className="font-semibold tracking-tight text-foreground" style={{ fontSize: '14px', letterSpacing: '-0.3px' }}>
          Refract
        </span>
      </div>
      
      {/* Main Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        <div className="section-label px-2 mb-3 text-[10px] uppercase tracking-wider text-muted-foreground">
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
                "flex w-full items-center gap-3 px-2 py-2 text-sm transition-all duration-200 outline-none",
                isActive 
                  ? "bg-muted text-foreground font-medium shadow-[0_0_0_1px_var(--border)]" 
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon size={16} className={isActive ? "text-foreground" : "text-muted-foreground"} />
              {item.label}
            </button>
          );
        })}
      </nav>
      
      {/* Footer (User & Settings) */}
      <div className="shrink-0 border-t border-border p-3 space-y-1">
        <button
          onClick={() => onNavigate('settings')}
          className={cn(
            "flex w-full items-center gap-3 px-2 py-2 text-sm transition-all duration-200 outline-none",
            activePage === 'settings'
              ? "bg-muted text-foreground font-medium shadow-[0_0_0_1px_var(--border)]" 
              : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          )}
        >
          <Settings size={16} />
          Settings
        </button>
        
        <div className="my-2 h-[1px] w-full bg-border" />
        
        <div className="flex items-center gap-3 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center bg-muted text-muted-foreground shadow-[0_0_0_1px_var(--border)]">
            <User size={14} />
          </div>
          <div className="flex flex-col min-w-0 flex-1 overflow-hidden">
            <span className="truncate text-sm font-medium text-foreground">{userName}</span>
            <span className="truncate text-[10px] text-muted-foreground">{userEmail}</span>
          </div>
        </div>
        
        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 px-2 py-2 text-sm font-medium text-muted-foreground transition-all duration-200 hover:text-destructive outline-none"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </div>
  );
};

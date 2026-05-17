import React from 'react'
import { LogoMark } from './Logo'

export const SplashScreen: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        width: '100%',
        background: 'var(--background)',
      }}
    >
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(0.96); }
        }
        .splash-logo {
          animation: breathe 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <div className="splash-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LogoMark size={48} className="text-foreground" />
      </div>
    </div>
  )
}

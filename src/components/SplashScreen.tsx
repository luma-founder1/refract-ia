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
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        .splash-logo {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
      `}</style>

      <div className="splash-logo" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LogoMark size={48} className="text-foreground" />
      </div>
    </div>
  )
}

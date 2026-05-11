import React, { useState } from 'react'
import { Zap, Activity, Wrench, ArrowRight } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'

interface OnboardingPageProps {
  onComplete: () => void
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onComplete }) => {
  const { profile, refreshProfile } = useAuth()
  const [loading, setLoading] = useState(false)

  const handleComplete = async () => {
    setLoading(true)

    try {
      if (!profile?.id) throw new Error('No user profile')

      // Update onboarding_completed in the users table
      const { error } = await supabase
        .from('users')
        .update({ onboarding_completed: true })
        .eq('id', profile.id)

      if (error) throw error

      // Refresh profile to update local state
      await refreshProfile()

      // Trigger completion callback
      onComplete()
    } catch (err) {
      console.error('[onboarding] failed to mark as complete:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '64px 40px', height: '100vh', overflowY: 'auto', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>

      {/* Welcome Section */}
      <div style={{ animation: 'fadeUp 0.4s ease', maxWidth: 600, textAlign: 'center', marginBottom: 64 }}>
        <h1 style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--foreground)', marginBottom: 16 }}>
          Welcome to Refract
        </h1>
        <p style={{ fontSize: 16, color: 'var(--muted-foreground)', lineHeight: 1.6, marginBottom: 32 }}>
          Analyze and refactor your code with AI-powered insights. Here's what you can do:
        </p>
      </div>

      {/* Feature Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 48, maxWidth: 1000 }}>
        <div className="card" style={{ padding: 32, textAlign: 'center', animation: 'fadeUp 0.4s ease 0.1s both' }}>
          <div style={{ marginBottom: 16, color: 'var(--foreground)', display: 'flex', justifyContent: 'center' }}>
            <Zap size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--foreground)', marginBottom: 8 }}>
            Real AST Analysis
          </h3>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
            Detects any types, dead state, circular deps, useEffect without deps and more.
          </p>
        </div>

        <div className="card" style={{ padding: 32, textAlign: 'center', animation: 'fadeUp 0.4s ease 0.2s both' }}>
          <div style={{ marginBottom: 16, color: 'var(--foreground)', display: 'flex', justifyContent: 'center' }}>
            <Activity size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--foreground)', marginBottom: 8 }}>
            Health Score
          </h3>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
            0-100 score per project. See degradation before it becomes a problem.
          </p>
        </div>

        <div className="card" style={{ padding: 32, textAlign: 'center', animation: 'fadeUp 0.4s ease 0.3s both' }}>
          <div style={{ marginBottom: 16, color: 'var(--foreground)', display: 'flex', justifyContent: 'center' }}>
            <Wrench size={28} />
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--foreground)', marginBottom: 8 }}>
            Safe Apply
          </h3>
          <p style={{ fontSize: 14, color: 'var(--muted-foreground)', lineHeight: 1.6 }}>
            Suggestions with diff before applying. Patch by anchor, not by line.
          </p>
        </div>
      </div>

      {/* CTA Button */}
      <button
        onClick={handleComplete}
        disabled={loading}
        className="btn btn-primary"
        style={{
          fontSize: 16,
          padding: '12px 28px',
          animation: 'fadeUp 0.4s ease 0.4s both',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        Get Started
        <ArrowRight size={18} />
      </button>
    </div>
  )
}

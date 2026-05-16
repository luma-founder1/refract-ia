import React, { useEffect, useState } from 'react'
import { Check, ChevronRight, Globe, Loader2, LogOut, ShieldAlert, User2, Sun, Moon } from 'lucide-react'
import { useAuth } from '../lib/AuthContext'
import { useTheme } from '../lib/ThemeContext'
import { openPricingUrl } from '../lib/billing'
import { supabase, UserProfile } from '../lib/supabase'

const C = {
  bg: 'var(--canvas)',
  surface: 'var(--surface-card)',
  border: 'var(--hairline)',
  text: 'var(--ink)',
  muted: 'var(--ink-muted)',
  subtle: 'var(--surface-strong)',
  green: 'var(--semantic-success)',
  red: 'var(--semantic-error)',
}

type LanguageOption = {
  label: string
  value: UserProfile['language']
}

type PlanOption = {
  name: UserProfile['plan']
  title: string
  price: string
  description: string
}

const languageOptions: LanguageOption[] = [
  { label: 'English', value: 'en' },
  { label: 'Português', value: 'pt' },
  { label: 'Español', value: 'es' },
  { label: 'Français', value: 'fr' },
  { label: 'Deutsch', value: 'de' },
]

const planOptions: PlanOption[] = [
  { name: 'free', title: 'Free', price: '$0', description: 'For trying Refract with the basics.' },
  { name: 'pro', title: 'Pro', price: '$20', description: 'For solo builders who want more velocity.' },
  { name: 'team', title: 'Team', price: '$49', description: 'For small teams reviewing code together.' },
  { name: 'enterprise', title: 'Enterprise', price: '$1500', description: 'For larger orgs with premium support needs.' },
]

const planRank: Record<UserProfile['plan'], number> = {
  free: 0,
  pro: 1,
  team: 2,
  enterprise: 3,
}

const toPlanLabel = (plan: UserProfile['plan']) => {
  switch (plan) {
    case 'free':
      return 'Free'
    case 'pro':
      return 'Pro'
    case 'team':
      return 'Team'
    case 'enterprise':
      return 'Enterprise'
  }
}

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="section-label" style={{ marginBottom: 12 }}>
    {children}
  </p>
)

const cardStyle: React.CSSProperties = {
  background: C.surface,
  border: `1px solid ${C.border}`,
  borderRadius: '12px',
  padding: 20,
}

export const SettingsPage: React.FC = () => {
  const { profile, refreshProfile, signOut } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [name, setName] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState<UserProfile['language']>('en')
  const [isSavingName, setIsSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)
  const [isSavingLanguage, setIsSavingLanguage] = useState(false)
  const [languageSaved, setLanguageSaved] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  useEffect(() => {
    setName(profile?.name ?? '')
  }, [profile?.name])

  useEffect(() => {
    setSelectedLanguage(profile?.language ?? 'en')
  }, [profile?.language])

  useEffect(() => {
    if (!nameSaved) return

    const timeoutId = window.setTimeout(() => setNameSaved(false), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [nameSaved])

  useEffect(() => {
    if (!languageSaved) return

    const timeoutId = window.setTimeout(() => setLanguageSaved(false), 1800)
    return () => window.clearTimeout(timeoutId)
  }, [languageSaved])

  const handleSaveProfile = async () => {
    if (!profile || isSavingName) return

    const trimmedName = name.trim()
    if (!trimmedName || trimmedName === profile.name) return

    setIsSavingName(true)
    setNameSaved(false)

    try {
      const { error } = await supabase
        .from('users')
        .update({ name: trimmedName })
        .eq('id', profile.id)

      if (error) throw error

      await refreshProfile()
      setName(trimmedName)
      setNameSaved(true)
    } catch (error) {
      console.error('[settings] failed to save name:', error)
    } finally {
      setIsSavingName(false)
    }
  }

  const handleLanguageChange = async (event: React.ChangeEvent<HTMLSelectElement>) => {
    if (!profile || isSavingLanguage) return

    const nextLanguage = event.target.value as UserProfile['language']
    const previousLanguage = profile.language
    if (nextLanguage === previousLanguage) return

    setSelectedLanguage(nextLanguage)
    setIsSavingLanguage(true)
    setLanguageSaved(false)

    try {
      const { error } = await supabase
        .from('users')
        .update({ language: nextLanguage })
        .eq('id', profile.id)

      if (error) throw error

      await refreshProfile()
      setLanguageSaved(true)
    } catch (error) {
      setSelectedLanguage(previousLanguage)
      console.error('[settings] failed to update language:', error)
    } finally {
      setIsSavingLanguage(false)
    }
  }

  const handleUpgrade = () => {
    if (openPricingUrl()) return
    window.alert('Billing is not yet configured in this build. Set VITE_PRICING_URL to enable upgrades.')
  }

  const handleSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)
    try {
      await signOut()
    } finally {
      setIsSigningOut(false)
    }
  }

  if (!profile) {
    return (
      <div style={{ padding: '32px 36px', height: '100%', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--canvas)' }}>
        <h1 className="page-title" style={{ marginBottom: 24 }}>Settings</h1>
        <div style={{ ...cardStyle, maxWidth: 640 }}>
          <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>Profile unavailable</p>
          <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5 }}>
            We could not load your account data right now. Refresh the session and try again.
          </p>
        </div>
      </div>
    )
  }

  const isNameDirty = name.trim().length > 0 && name.trim() !== profile.name
  const currentPlanRank = planRank[profile.plan]

  return (
    <div style={{ padding: '32px 36px', height: '100%', overflowY: 'auto', boxSizing: 'border-box', background: 'var(--canvas)' }}>
      <h1 className="page-title" style={{ marginBottom: 32, fontSize: '26px', fontWeight: 400, letterSpacing: '-0.325px' }}>Settings</h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32, maxWidth: 760, paddingBottom: 48 }}>
        <section>
          <SectionLabel>Profile</SectionLabel>
          <div style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 34, height: 34, borderRadius: '8px', background: C.subtle, display: 'grid', placeItems: 'center' }}>
                <User2 size={16} color={C.text} />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 2 }}>Your profile</p>
                <p style={{ fontSize: 14, color: C.muted }}>Update the visible account details stored in Supabase.</p>
              </div>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, color: C.text, marginBottom: 8 }}>Name</label>
                <input
                  className="input"
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="Your name"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, color: C.text, marginBottom: 8 }}>Email</label>
                <input
                  className="input"
                  value={profile.email}
                  readOnly
                  disabled
                  style={{ opacity: 0.6, cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
              <button
                onClick={handleSaveProfile}
                className="btn btn-primary btn-sm"
                disabled={!isNameDirty || isSavingName}
                style={{ minWidth: 126, justifyContent: 'center' }}
              >
                {isSavingName ? <Loader2 size={14} className="spin" /> : null}
                {isSavingName ? 'Saving...' : 'Save changes'}
              </button>
              {nameSaved && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 14, color: C.green }}>
                  <Check size={14} />
                  Saved
                </span>
              )}
            </div>
          </div>
        </section>

        <section>
          <SectionLabel>Preferences</SectionLabel>
          <div style={cardStyle}>
            {/* Theme Toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              <div style={{ width: 34, height: 34, borderRadius: '8px', background: C.subtle, display: 'grid', placeItems: 'center' }}>
                {theme === 'dark' ? <Moon size={16} color={C.text} /> : <Sun size={16} color={C.text} />}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 2 }}>Appearance</p>
                <p style={{ fontSize: 14, color: C.muted }}>Choose your preferred theme.</p>
              </div>
              <button
                onClick={toggleTheme}
                className="btn btn-secondary btn-sm"
                style={{ minWidth: 100, justifyContent: 'center', gap: 8 }}
              >
                {theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}
                {theme === 'dark' ? 'Dark' : 'Light'}
              </button>
            </div>

            {/* Language */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 34, height: 34, borderRadius: '8px', background: C.subtle, display: 'grid', placeItems: 'center' }}>
                <Globe size={16} color={C.text} />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 2 }}>Language</p>
                <p style={{ fontSize: 14, color: C.muted }}>Saved immediately after you change it.</p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 280px', minWidth: 220 }}>
                <select
                  className="input"
                  value={selectedLanguage}
                  onChange={handleLanguageChange}
                  disabled={isSavingLanguage}
                  style={{ appearance: 'none', cursor: isSavingLanguage ? 'progress' : 'pointer' }}
                >
                  {languageOptions.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <span style={{ fontSize: 14, color: isSavingLanguage ? C.text : languageSaved ? C.green : C.muted }}>
                {isSavingLanguage ? 'Saving...' : languageSaved ? 'Saved' : 'Auto-saves'}
              </span>
            </div>
          </div>
        </section>

        <section>
          <SectionLabel>Plan</SectionLabel>
          <div style={{ ...cardStyle, paddingBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>Your current plan</p>
                <p style={{ fontSize: 14, color: C.muted }}>Temporary upgrade action opens the public pricing page.</p>
              </div>
              <span className="badge badge-muted" style={{ fontSize: 11, padding: '4px 10px', textTransform: 'capitalize' }}>
                {toPlanLabel(profile.plan)}
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              {planOptions.map(plan => {
                const rank = planRank[plan.name]
                const isCurrentPlan = plan.name === profile.plan
                const canUpgrade = rank > currentPlanRank

                return (
                  <div
                    key={plan.name}
                    style={{
                      background: isCurrentPlan ? 'rgba(245, 78, 0, 0.06)' : 'var(--canvas-soft)',
                      border: `1px solid ${isCurrentPlan ? 'rgba(245, 78, 0, 0.25)' : 'var(--hairline)'}`,
                      borderRadius: '12px',
                      padding: 16,
                      minHeight: 190,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                      <p style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{plan.title}</p>
                      {isCurrentPlan ? (
                        <span className="badge badge-success" style={{ fontSize: 10, padding: '2px 8px' }}>Current</span>
                      ) : null}
                    </div>

                    <p style={{ fontSize: 22, fontWeight: 600, color: C.text, letterSpacing: '-0.03em', marginBottom: 8 }}>
                      {plan.price}
                      <span style={{ fontSize: 14, fontWeight: 500, color: C.muted, marginLeft: 4 }}>
                        {plan.name === 'enterprise' ? '/mo+' : '/mo'}
                      </span>
                    </p>
                    <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.5, marginBottom: 18 }}>
                      {plan.description}
                    </p>

                    <div style={{ marginTop: 'auto' }}>
                      {canUpgrade ? (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ width: '100%', justifyContent: 'space-between' }}
                          onClick={handleUpgrade}
                        >
                          <span>Upgrade</span>
                          <ChevronRight size={14} />
                        </button>
                      ) : (
                        <div
                          style={{
                            width: '100%',
                            minHeight: 34,
                            borderRadius: '8px',
                            background: C.subtle,
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: 14,
                            color: isCurrentPlan ? C.text : C.muted,
                            fontWeight: 500,
                          }}
                        >
                          {isCurrentPlan ? 'Active plan' : 'Included below your tier'}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        <section>
          <SectionLabel>Danger Zone</SectionLabel>
          <div style={{ ...cardStyle, borderColor: 'rgba(207, 45, 86, 0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
              <div style={{ width: 34, height: 34, borderRadius: '8px', background: 'rgba(207, 45, 86, 0.08)', display: 'grid', placeItems: 'center' }}>
                <ShieldAlert size={16} color={C.red} />
              </div>
              <div>
                <p style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 2 }}>Sensitive actions</p>
                <p style={{ fontSize: 14, color: C.muted }}>These actions affect your session and account access.</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSignOut}
                disabled={isSigningOut}
                style={{ minWidth: 120, justifyContent: 'center' }}
              >
                {isSigningOut ? <Loader2 size={14} className="spin" /> : <LogOut size={14} />}
                {isSigningOut ? 'Signing out...' : 'Sign out'}
              </button>

              <button
                onClick={() => window.alert('Contact support')}
                style={{
                  minWidth: 140,
                  height: 34,
                  padding: '0 14px',
                  borderRadius: '8px',
                  border: '1px solid rgba(207, 45, 86, 0.25)',
                  background: 'rgba(207, 45, 86, 0.08)',
                  color: C.red,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete account
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

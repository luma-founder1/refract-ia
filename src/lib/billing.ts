const configuredPricingUrl = (import.meta.env.VITE_PRICING_URL as string | undefined)?.trim() ?? ''

export const hasPricingUrl = configuredPricingUrl.length > 0

export function openPricingUrl(): boolean {
  if (!hasPricingUrl) return false

  window.open(configuredPricingUrl, '_blank', 'noopener,noreferrer')
  return true
}

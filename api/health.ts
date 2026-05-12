export default function handler(_req: any, res: any) {
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'unknown',
  })
}

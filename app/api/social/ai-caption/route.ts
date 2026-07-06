import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// AI caption + hashtag assistant. Calls the Claude Messages API directly (no SDK
// dependency in this project). Requires ANTHROPIC_API_KEY. Returns { caption,
// hashtags[] } tailored to the target platform.
//
// body: { topic, platform?, tone?, existing?, want_hashtags? }

const PLATFORM_HINTS: Record<string, string> = {
  x: 'X/Twitter: max 280 characters, punchy, 1-2 hashtags.',
  instagram: 'Instagram: engaging, can be longer, up to ~15 relevant hashtags, emoji friendly.',
  facebook: 'Facebook: conversational, a clear call to action, few hashtags.',
  linkedin: 'LinkedIn: professional tone, insight-led, 3-5 hashtags.',
  tiktok: 'TikTok: casual, trend-aware, a few hashtags.',
  youtube: 'YouTube: a compelling title-style line plus a short description.',
  threads: 'Threads: casual and conversational, minimal hashtags.',
  bluesky: 'Bluesky: concise, authentic, minimal hashtags.',
  pinterest: 'Pinterest: descriptive and keyword-rich, a few hashtags.',
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'AI captions are not configured. Set ANTHROPIC_API_KEY.' }, { status: 503 })
  }

  const body = await req.json().catch(() => ({}))
  const topic = String(body.topic || '').trim()
  if (!topic) return NextResponse.json({ error: 'Describe what the post is about.' }, { status: 400 })

  const platform = String(body.platform || 'instagram')
  const tone = String(body.tone || 'friendly and engaging')
  const existing = String(body.existing || '').trim()
  const wantHashtags = body.want_hashtags !== false

  const hint = PLATFORM_HINTS[platform] || 'A general social post.'
  const prompt = [
    `Write a social media caption for ${platform}.`,
    hint,
    `Tone: ${tone}.`,
    `Topic / brief: ${topic}`,
    existing ? `Improve on this draft: "${existing}"` : '',
    wantHashtags ? 'Also suggest relevant hashtags.' : 'Do not include hashtags.',
    'Respond as strict JSON only, no prose, in the form {"caption": string, "hashtags": string[]}. Hashtags must not include the # symbol.',
  ].filter(Boolean).join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err?.error?.message || 'AI request failed' }, { status: 502 })
    }
    const data: any = await res.json()
    const text = (data?.content || []).filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
    // Parse the JSON out of the response (tolerate stray text around it).
    let parsed: any = null
    try {
      const match = text.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(match ? match[0] : text)
    } catch {
      parsed = { caption: text.trim(), hashtags: [] }
    }
    const caption = String(parsed.caption || '').trim()
    const hashtags = Array.isArray(parsed.hashtags)
      ? parsed.hashtags.map((h: any) => String(h).replace(/^#/, '').trim()).filter(Boolean)
      : []
    return NextResponse.json({ caption, hashtags })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'AI request error' }, { status: 500 })
  }
}

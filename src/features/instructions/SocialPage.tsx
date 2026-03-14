/**
 * Social Media Scope — /instructions/social
 * Content system, posting cadence, platform setup, brand consistency.
 */

import { Link } from 'react-router-dom'
import { ArrowLeft, Image, Calendar, Share2, CheckCircle2 } from 'lucide-react'

export default function SocialPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/instructions" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social Media Scope & Instructions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Content system, posting SOP, platform setup</p>
        </div>
      </div>

      {/* Section 1: Content System */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b bg-purple-50">
          <div className="rounded-lg bg-purple-100 p-2">
            <Calendar className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h2 className="font-semibold">1. Content System</h2>
            <p className="text-xs text-muted-foreground">Monthly planning and content repurposing</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold mb-2">1-Month Content Calendar</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-500" /> Plan 4 weeks of content at the start of each month</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-500" /> Mix of service spotlights, before/after, local proof, and educational content</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-500" /> Align with local events, seasons, and promotions</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-purple-500" /> Client approval required before scheduling</li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Repurpose Job Photos</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2"><Image className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" /> Request job site photos from client after each completed job</li>
              <li className="flex items-start gap-2"><Image className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" /> Before/after photo sets are highest-performing content type</li>
              <li className="flex items-start gap-2"><Image className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" /> Tag location and service in captions for local SEO signals</li>
              <li className="flex items-start gap-2"><Image className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" /> Repurpose across FB, IG, GBP posts, and YouTube Shorts</li>
            </ul>
          </div>
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs font-semibold text-muted-foreground mb-1">Posting SOP</p>
            <ol className="space-y-1 text-sm list-decimal list-inside">
              <li>Draft caption with local keywords and call-to-action</li>
              <li>Select and optimize image(s) for platform dimensions</li>
              <li>Schedule via approved social tool (minimum 2 days before post date)</li>
              <li>Cross-post to GBP as a weekly update post</li>
              <li>Monitor engagement and respond to comments within 24 hours</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Section 2: Weekly Posts */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b bg-blue-50">
          <div className="rounded-lg bg-blue-100 p-2">
            <Share2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold">2. Weekly Posts</h2>
            <p className="text-xs text-muted-foreground">2–4 posts per week cadence</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { day: 'Monday', type: 'Service Spotlight', color: 'bg-blue-50 border-blue-200' },
              { day: 'Wednesday', type: 'Before/After or Local Proof', color: 'bg-green-50 border-green-200' },
              { day: 'Friday', type: 'Educational or Tip', color: 'bg-amber-50 border-amber-200' },
              { day: 'Weekend (Optional)', type: 'Community or Promotional', color: 'bg-purple-50 border-purple-200' },
            ].map(d => (
              <div key={d.day} className={`rounded-lg border ${d.color} p-3 text-center`}>
                <p className="text-xs font-bold text-muted-foreground">{d.day}</p>
                <p className="text-sm mt-1">{d.type}</p>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-2">Content Types</h3>
            <div className="grid sm:grid-cols-2 gap-2 text-sm">
              {[
                'Before/after job photos (roofing, chimney, etc.)',
                'Local landmark + service combination shots',
                'Team in action photos',
                'Customer review screenshots',
                '5-star review highlights',
                'Seasonal tips relevant to services',
                'FAQs about services',
                'Community involvement / local news',
              ].map(c => (
                <div key={c} className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-500" />
                  {c}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Social Setup */}
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b bg-green-50">
          <div className="rounded-lg bg-green-100 p-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold">3. Social Setup Checklist</h2>
            <p className="text-xs text-muted-foreground">Platform-by-platform setup requirements</p>
          </div>
        </div>
        <div className="p-5 space-y-4">
          {[
            {
              platform: 'Facebook Business Page',
              color: 'border-blue-200',
              items: [
                'Business name + category + description',
                'Profile photo (logo) and cover photo (1640×924)',
                'Contact info (phone, website, address)',
                'Services listed with descriptions and prices',
                'Hours of operation',
                'Call-to-action button (Call Now, Book Now)',
                'Connected to Instagram',
              ],
            },
            {
              platform: 'Instagram Business Account',
              color: 'border-purple-200',
              items: [
                'Business account (not personal)',
                'Bio with location and service keywords (150 chars)',
                'Link in bio (website or Linktree)',
                'Profile photo matches Facebook',
                'Highlights created (Services, Reviews, Before/After)',
                'Connected to Facebook for cross-posting',
              ],
            },
            {
              platform: 'YouTube Channel',
              color: 'border-red-200',
              items: [
                'Channel name matches business name',
                'Channel description with service keywords',
                'Custom channel art (2560×1440)',
                'Playlists organized by service type',
                'Location tags enabled on videos',
              ],
            },
            {
              platform: 'LinkedIn Company Page',
              color: 'border-blue-300',
              items: [
                'Company page (not personal)',
                'Logo + cover image uploaded',
                'About section with full service description',
                'Industry and size correctly set',
                'Website and contact info complete',
              ],
            },
          ].map(p => (
            <div key={p.platform} className={`rounded-lg border ${p.color} p-4`}>
              <h3 className="font-semibold text-sm mb-2">{p.platform}</h3>
              <ul className="space-y-1.5 text-sm">
                {p.items.map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Brand Consistency */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
            <h3 className="font-semibold text-sm text-amber-800 mb-2">Brand Consistency Requirements</h3>
            <ul className="space-y-1.5 text-sm text-amber-700">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Same logo used across all platforms (PNG with transparent background)</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Consistent brand colors in all cover images</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Same phone number and website URL across all platforms</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> NAP (Name, Address, Phone) must match GBP exactly</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> Caption tone: professional, local, and trust-building</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

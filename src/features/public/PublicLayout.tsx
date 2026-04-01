export function PublicLayout({ title, updated, children }: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">JZ</span>
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              JZ Smart Media - Operations Hub
            </span>
          </div>
          <h1 className="text-3xl font-bold mb-2">{title}</h1>
          <p className="text-sm text-muted-foreground">Last updated: {updated}</p>
        </div>

        {/* Content */}
        <div className="space-y-8">{children}</div>

        {/* Footer */}
        <div className="mt-16 pt-8 border-t border-border text-sm text-muted-foreground flex flex-wrap gap-4">
          <a href="/privacy-policy" className="hover:text-foreground transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-foreground transition-colors">Terms of Use</a>
          <a href="/support" className="hover:text-foreground transition-colors">Support</a>
          <a href="/docs" className="hover:text-foreground transition-colors">Documentation</a>
          <span className="ml-auto">© 2026 JZ Smart Media</span>
        </div>
      </div>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-3 text-foreground">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-3
        [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5
        [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono">
        {children}
      </div>
    </section>
  )
}

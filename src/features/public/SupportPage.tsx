import { PublicLayout, Section } from './PublicLayout'

export default function SupportPage() {
  return (
    <PublicLayout title="Support" updated="April 1, 2026">
      <Section title="Get Help">
        <p>
          JZ Smart Media Operations Hub is an internal tool. If you are experiencing issues,
          please reach out through one of the channels below.
        </p>
      </Section>

      <Section title="Contact">
        <ul>
          <li>
            <strong>Email:</strong>{' '}
            <a href="mailto:yarden@jzsmartmedia.com" className="text-primary hover:underline">
              yarden@jzsmartmedia.com
            </a>
          </li>
          <li>
            <strong>Website:</strong>{' '}
            <a href="https://jzsmartmedia.com" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
              jzsmartmedia.com
            </a>
          </li>
          <li><strong>Response time:</strong> Within 1 business day</li>
        </ul>
      </Section>

      <Section title="Common Issues">
        <div className="space-y-4">
          <div>
            <p className="font-medium text-foreground mb-1">Can't log in?</p>
            <p>Contact your administrator to verify your account is active and your email is correct.
              New accounts must be created by an admin — there is no self-signup.</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Zoom connection not working?</p>
            <p>Go to Settings → Zoom → Disconnect and reconnect. If the issue persists, contact support.</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Missing tasks or clients?</p>
            <p>Your page access is controlled by your role. If you believe you're missing access,
              ask your project manager to review your permissions in User Management.</p>
          </div>
          <div>
            <p className="font-medium text-foreground mb-1">Notifications not appearing?</p>
            <p>Notifications are sent daily at 8 AM EST. If reminders are missing, the daily
              automation may not have run yet — they will arrive the following morning.</p>
          </div>
        </div>
      </Section>

      <Section title="Zoom Integration Support">
        <p>
          If you encounter issues with the Zoom integration specifically (scopes, token errors, meeting creation),
          please email{' '}
          <a href="mailto:yarden@jzsmartmedia.com" className="text-primary hover:underline">
            yarden@jzsmartmedia.com
          </a>{' '}
          with the error message and the page you were on.
        </p>
      </Section>

      <Section title="Application Info">
        <ul>
          <li><strong>App name:</strong> JZ Smart Media Operations Hub</li>
          <li><strong>Developer:</strong> JZ Smart Media</li>
          <li><strong>Platform:</strong> Web (Vercel)</li>
          <li><strong>Backend:</strong> Supabase</li>
        </ul>
      </Section>
    </PublicLayout>
  )
}

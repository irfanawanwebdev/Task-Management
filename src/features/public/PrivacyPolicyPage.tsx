import { PublicLayout, Section } from './PublicLayout'

export default function PrivacyPolicyPage() {
  return (
    <PublicLayout title="Privacy Policy" updated="April 1, 2026">
      <Section title="Overview">
        <p>
          JZ Smart Media ("we", "our", "us") operates the JZ Smart Media Operations Hub — an internal
          management platform used exclusively by JZ Smart Media employees and authorized personnel.
          This Privacy Policy explains how we collect, use, and protect information when you use this application.
        </p>
      </Section>

      <Section title="Information We Collect">
        <ul>
          <li><strong>Account information:</strong> Name and work email address used for login via Supabase Auth.</li>
          <li><strong>OAuth tokens:</strong> When you connect a third-party integration (e.g. Zoom, Google), we store
            the OAuth access token and refresh token securely in our database to perform actions on your behalf.</li>
          <li><strong>Usage data:</strong> Task updates, meeting records, client notes, and other operational data
            you enter into the platform.</li>
          <li><strong>Personal tasks:</strong> Tasks you create in the "My Tasks" section are private and visible
            only to you.</li>
        </ul>
      </Section>

      <Section title="How We Use Your Information">
        <ul>
          <li>To authenticate you and control access to features based on your role.</li>
          <li>To perform actions on connected services (e.g. creating Zoom meetings) on your behalf using stored tokens.</li>
          <li>To send you in-app notifications about tasks, deadlines, and meetings.</li>
          <li>To generate operational reports and track client delivery progress.</li>
        </ul>
      </Section>

      <Section title="Zoom Integration">
        <p>
          When you connect your Zoom account, we request access to the following scopes:
        </p>
        <ul>
          <li><code>meeting:read:list_meetings</code> — to list your scheduled meetings.</li>
          <li><code>meeting:write:meeting</code> — to create meetings on your behalf.</li>
          <li><code>user:read:email</code> — to identify which Zoom account is connected.</li>
        </ul>
        <p>
          Zoom tokens are stored securely and are used solely within this internal application.
          They are never shared with third parties.
        </p>
      </Section>

      <Section title="Data Storage & Security">
        <p>
          All data is stored in a Supabase PostgreSQL database hosted on AWS infrastructure.
          Row-level security (RLS) policies ensure users can only access data they are authorized to view.
          OAuth tokens are stored encrypted and are scoped to individual users.
        </p>
      </Section>

      <Section title="Data Retention">
        <p>
          Data is retained as long as your account is active. Upon account deletion, all associated
          personal data including OAuth tokens and personal tasks is permanently removed.
        </p>
      </Section>

      <Section title="Third-Party Services">
        <p>This application integrates with the following services:</p>
        <ul>
          <li><strong>Supabase</strong> — authentication and database</li>
          <li><strong>Zoom</strong> — meeting creation and management</li>
          <li><strong>Vercel</strong> — application hosting</li>
        </ul>
      </Section>

      <Section title="Contact">
        <p>
          For privacy-related questions, contact at:{' '}
          <a href="mailto:yarden@jzsmartmedia.com" className="text-primary hover:underline">
            yarden@jzsmartmedia.com
          </a>
        </p>
      </Section>
    </PublicLayout>
  )
}

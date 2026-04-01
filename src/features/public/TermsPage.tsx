import { PublicLayout, Section } from './PublicLayout'

export default function TermsPage() {
  return (
    <PublicLayout title="Terms of Use" updated="April 1, 2026">
      <Section title="Acceptance of Terms">
        <p>
          By accessing or using JZ Smart Media Operations Hub ("the App"), you agree to these Terms of Use.
          This application is intended solely for use by JZ Smart Media employees and authorized personnel.
          Unauthorized use is strictly prohibited.
        </p>
      </Section>

      <Section title="Authorized Use">
        <ul>
          <li>Access is granted only to individuals with an active account created by a JZ Smart Media administrator.</li>
          <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
          <li>You may not share your account with others or attempt to access accounts that are not your own.</li>
          <li>The App must only be used for legitimate JZ Smart Media business operations.</li>
        </ul>
      </Section>

      <Section title="Acceptable Conduct">
        <p>You agree not to:</p>
        <ul>
          <li>Use the App to store, transmit, or share any unlawful, harmful, or inappropriate content.</li>
          <li>Attempt to reverse-engineer, decompile, or tamper with the application.</li>
          <li>Interfere with the security or integrity of the platform or its data.</li>
          <li>Use automated scripts or bots to interact with the application.</li>
        </ul>
      </Section>

      <Section title="Third-Party Integrations">
        <p>
          When you connect third-party services such as Zoom, you also agree to their respective terms of service.
          JZ Smart Media is not responsible for the availability or conduct of third-party platforms.
        </p>
      </Section>

      <Section title="Data Ownership">
        <p>
          All client data, task records, and operational content entered into the App belongs to JZ Smart Media.
          Personal tasks created in the "My Tasks" section are private to each individual user.
        </p>
      </Section>

      <Section title="Intellectual Property">
        <p>
          The JZ Smart Media Operations Hub, including its design, code, and content, is the property of
          JZ Smart Media. No part of this application may be reproduced or distributed without written permission.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          Access to the App may be revoked at any time by a JZ Smart Media administrator. Upon termination,
          you must immediately cease all use of the App and its data.
        </p>
      </Section>

      <Section title="Limitation of Liability">
        <p>
          The App is provided "as is" for internal business use. JZ Smart Media makes no warranties regarding
          uptime, accuracy, or fitness for a particular purpose beyond its intended operational use.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          For questions regarding these terms, contact:{' '}
          <a href="mailto:yarden@jzsmartmedia.com" className="text-primary hover:underline">
            yarden@jzsmartmedia.com
          </a>
        </p>
      </Section>
    </PublicLayout>
  )
}

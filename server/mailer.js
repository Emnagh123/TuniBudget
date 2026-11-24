// Sends the password reset email.
//
// In development the link is printed in the server console, so the flow can be tested without an
// email account. In production you must connect a real email provider here (for example with the
// provider's HTTPS API through fetch). Until then, reset links cannot reach users and an error is logged.

let settings = { isProduction: false };
export function configureMailer(config) {
  settings = { isProduction: config.isProduction };
}

export async function sendPasswordResetEmail({ to, fullName, link, minutes }) {
  const subject = "Reset your TuniBudget password";
  const body =
    `Hello ${fullName},\n\n` +
    `Someone asked to reset the password of your TuniBudget account. Open this link to choose a new one:\n${link}\n\n` +
    `The link works once and expires in ${minutes} minutes. If you did not ask for this, ignore this email: your password stays the same.`;

  if (!settings.isProduction) {
    console.log(`\n[mailer] (development) Email to ${to}\nSubject: ${subject}\n\n${body}\n`);
    return;
  }

  // TODO(production): send `subject` and `body` to `to` with your email provider.
  console.error(JSON.stringify({ level: "error", message: "No email provider configured: password reset email not sent." }));
}

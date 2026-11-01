
export async function onRequestPost({ request, env }) {
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };

  const respond = (status, body) =>
    new Response(JSON.stringify(body), { status, headers });

  if (!env.RESEND_API_KEY) {
    return respond(500, { error: "Contact service is not configured." });
  }

  const origin = request.headers.get("Origin");
  if (origin && ![
    "https://backupsteward.com",
    "https://www.backupsteward.com"
  ].includes(origin)) {
    return respond(403, { error: "Request origin not allowed." });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return respond(400, { error: "Invalid submission." });
  }

  // Spam honeypot
  if (String(data.website || "").trim()) {
    return respond(200, { message: "Thank you. Your enquiry has been received." });
  }

  const name = String(data.name || "").trim();
  const email = String(data.email || "").trim();
  const platform = String(data.platform || "").trim();
  const problem = String(data.problem || "").trim();

  if (!name || !email || !platform || !problem) {
    return respond(400, { error: "Please complete all required fields." });
  }

  if (
    name.length > 100 ||
    email.length > 254 ||
    platform.length > 100 ||
    problem.length > 3000
  ) {
    return respond(400, { error: "One or more fields are too long." });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond(400, { error: "Please enter a valid email address." });
  }

  const safe = value => value.replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  const textBody =
    "New BackupSteward website enquiry\n\n" +
    "Name: " + name + "\n" +
    "Email: " + email + "\n" +
    "Backup platform: " + platform + "\n\n" +
    "Problem or requirement:\n" + problem;

  const htmlBody =
    "<h2>New BackupSteward website enquiry</h2>" +
    "<p><strong>Name:</strong> " + safe(name) + "</p>" +
    "<p><strong>Email:</strong> " + safe(email) + "</p>" +
    "<p><strong>Backup platform:</strong> " + safe(platform) + "</p>" +
    "<p><strong>Problem or requirement:</strong><br>" +
    safe(problem).replace(/\n/g, "<br>") + "</p>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + env.RESEND_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "BackupSteward Website <enquiries@send.backupsteward.com>",
        to: ["contact@backupsteward.com"],
        reply_to: email,
        subject: "New BackupSteward enquiry from " + name,
        text: textBody,
        html: htmlBody
      })
    });

    if (!response.ok) {
      return respond(502, {
        error: "Unable to send your enquiry right now. Please try again."
      });
    }

    return respond(200, {
      message: "Thank you! Your enquiry has been sent successfully. We will get back to you."
    });

  } catch {
    return respond(502, {
      error: "Unable to send your enquiry right now. Please try again."
    });
  }
}

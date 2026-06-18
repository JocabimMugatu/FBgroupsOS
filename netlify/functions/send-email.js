// netlify/functions/send-email.js
//
// Single serverless function handling both email flows for Group Reach:
//   1. type: "apply"    -> notifies you + sends applicant a confirmation
//   2. type: "playbook" -> notifies you + sends requester the playbook
//
// Requires environment variable RESEND_API_KEY set in Netlify dashboard
// (Site settings -> Environment variables). Never hardcode the key here.

const RESEND_API_URL = 'https://api.resend.com/emails';
const FROM_ADDRESS = 'Group Reach <hello@groupreach.xyz>';
const NOTIFY_TO = 'fsukevin.newman@gmail.com';
const PLAYBOOK_URL = 'https://groupreach.xyz/playbook-download.html';

async function sendViaResend(payload) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY environment variable is not set in Netlify. Add it under Site settings -> Environment variables, then redeploy.');
  }
  const res = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Resend error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------- APPLY FLOW ----------

function buildApplyInternalEmail({ name, email, company, website, revenue, ltv, about, hangout, groups }) {
  return {
    from: FROM_ADDRESS,
    to: [NOTIFY_TO],
    reply_to: email,
    subject: `New Group Reach Application — ${company}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto">
        <h2 style="font-family:Arial,sans-serif;color:#111;margin-bottom:20px">New Application</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Company:</strong> ${escapeHtml(company)}</p>
        <p><strong>Website:</strong> ${escapeHtml(website) || 'Not provided'}</p>
        <p><strong>Monthly Revenue / Stage:</strong> ${escapeHtml(revenue) || 'Not provided'}</p>
        <p><strong>Average Customer Value / LTV:</strong> ${escapeHtml(ltv) || 'Not provided'}</p>
        <p style="margin-top:16px"><strong>Product &amp; ICP:</strong></p>
        <blockquote style="border-left:3px solid #1A56FF;padding-left:12px;color:#444;margin-left:0">
          ${escapeHtml(about).replace(/\n/g, '<br>')}
        </blockquote>
        <p style="margin-top:16px"><strong>Where buyers hang out online:</strong></p>
        <blockquote style="border-left:3px solid #12B76A;padding-left:12px;color:#444;margin-left:0">
          ${escapeHtml(hangout || 'Not provided').replace(/\n/g, '<br>')}
        </blockquote>
        <p style="margin-top:16px"><strong>Known relevant groups / competitors:</strong></p>
        <p style="color:#444">${escapeHtml(groups || 'Not provided')}</p>
      </div>
    `
  };
}

function buildApplyConfirmationEmail({ name, email }) {
  const firstName = (name || '').split(' ')[0] || 'there';
  return {
    from: FROM_ADDRESS,
    to: [email],
    reply_to: NOTIFY_TO,
    subject: 'Your Group Reach application — what happens next',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.6">
        <p>Hey ${escapeHtml(firstName)},</p>
        <p>Thanks for applying to Group Reach. We received your application and review every submission personally — you'll hear back from us within <strong>1 business day</strong>.</p>
        <p>In the meantime, if you want a head start on understanding the methodology, here's our full <a href="${PLAYBOOK_URL}" style="color:#1A56FF">Group Infiltration Playbook</a> — the exact framework we use for every client.</p>
        <p>Talk soon,<br>The Group Reach Team</p>
      </div>
    `
  };
}

// ---------- PLAYBOOK FLOW ----------

function buildPlaybookInternalEmail({ email }) {
  return {
    from: FROM_ADDRESS,
    to: [NOTIFY_TO],
    reply_to: email,
    subject: `Playbook requested — ${email}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
        <h2 style="font-family:Arial,sans-serif;color:#111">New Playbook Request</h2>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
      </div>
    `
  };
}

function buildPlaybookDeliveryEmail({ email }) {
  return {
    from: FROM_ADDRESS,
    to: [email],
    reply_to: NOTIFY_TO,
    subject: 'Your Group Infiltration Playbook is here',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#222;line-height:1.6">
        <p>Hey,</p>
        <p>Here's the full Group Infiltration Playbook — the group mapping framework, the 4-1-1 content cadence, intent signal monitoring, and word-for-word DM scripts we use for every client.</p>
        <p style="margin:28px 0">
          <a href="${PLAYBOOK_URL}" style="background:#1A56FF;color:#fff;padding:14px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">Open the Playbook →</a>
        </p>
        <p>If you'd rather we just run this for you, you can <a href="https://groupreach.xyz/#apply" style="color:#1A56FF">apply for a spot</a> any time.</p>
        <p>Talk soon,<br>The Group Reach Team</p>
      </div>
    `
  };
}

// ---------- HANDLER ----------

exports.handler = async function (event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { type } = body;

  try {
    if (type === 'apply') {
      const { name, email, company, website, revenue, ltv, about, hangout, groups } = body;
      if (!name || !email || !company || !about) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields' }) };
      }
      await sendViaResend(buildApplyInternalEmail({ name, email, company, website, revenue, ltv, about, hangout, groups }));
      await sendViaResend(buildApplyConfirmationEmail({ name, email }));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (type === 'playbook') {
      const { email } = body;
      if (!email) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing email' }) };
      }
      await sendViaResend(buildPlaybookInternalEmail({ email }));
      await sendViaResend(buildPlaybookDeliveryEmail({ email }));
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown type' }) };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to send email' }) };
  }
};

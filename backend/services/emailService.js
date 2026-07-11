const { query } = require('../config/db');

/**
 * Send an email notification.
 * Uses Resend if RESEND_API_KEY is set, otherwise logs to console.
 * Fire-and-forget with notification_log recording.
 */
const sendEmail = async ({ to, subject, html, userId, type }) => {
  try {
    if (process.env.RESEND_API_KEY) {
      // Use Resend SDK
      const { Resend } = require('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: 'Rent Finder <onboarding@resend.dev>',
        to,
        subject,
        html
      });

      console.log(`📧 Email sent to ${to}: ${subject}`);
    } else {
      // Development mode — log to console
      console.log(`\n📧 [DEV EMAIL] To: ${to}`);
      console.log(`   Subject: ${subject}`);
      console.log(`   Body: ${html.substring(0, 200)}...\n`);
    }

    // Log success
    await query(
      `INSERT INTO notification_log (user_id, type, email_to, status)
       VALUES ($1, $2, $3, 'sent')`,
      [userId, type, to]
    );

  } catch (err) {
    console.error(`❌ Email failed to ${to}:`, err.message);
    
    // Log failure
    try {
      await query(
        `INSERT INTO notification_log (user_id, type, email_to, status, error_message)
         VALUES ($1, $2, $3, 'failed', $4)`,
        [userId, type, to, err.message]
      );
    } catch (logErr) {
      console.error('Failed to log notification error:', logErr.message);
    }
  }
};

// ── Email Templates ─────────────────────────────────────────────

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

/**
 * Notify owner when a high-compatibility tenant shows interest.
 */
const notifyHighScoreInterest = async ({ owner, tenant, listing, score }) => {
  await sendEmail({
    to: owner.email,
    subject: `🔥 High-match tenant interested in your listing!`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e;">New Interest Request!</h2>
        <p>Hi <strong>${owner.name}</strong>,</p>
        <p><strong>${tenant.name}</strong> has expressed interest in your listing:</p>
        <div style="background: #f0f4ff; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;">📍 <strong>${listing.location}</strong></p>
          <p style="margin: 4px 0;">💰 ₹${listing.rent}/month • ${listing.room_type}</p>
          <p style="margin: 4px 0;">🎯 Compatibility Score: <strong style="color: #16a34a; font-size: 1.2em;">${score}/100</strong></p>
        </div>
        <p>This is a high-compatibility match! Review and respond on the platform.</p>
        <a href="${frontendUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 12px;">View on Platform</a>
      </div>
    `,
    userId: owner.id,
    type: 'high_score_interest'
  });
};

/**
 * Notify tenant when their interest is accepted.
 */
const notifyInterestAccepted = async ({ tenant, owner, listing }) => {
  await sendEmail({
    to: tenant.email,
    subject: `✅ Your interest has been accepted!`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e;">Great news, ${tenant.name}! 🎉</h2>
        <p><strong>${owner.name}</strong> has accepted your interest in:</p>
        <div style="background: #f0fdf4; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;">📍 <strong>${listing.location}</strong></p>
          <p style="margin: 4px 0;">💰 ₹${listing.rent}/month • ${listing.room_type}</p>
        </div>
        <p>You can now <strong>chat directly</strong> with the owner on the platform!</p>
        <a href="${frontendUrl}" style="display: inline-block; background: #16a34a; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 12px;">Start Chatting</a>
      </div>
    `,
    userId: tenant.id,
    type: 'interest_accepted'
  });
};

/**
 * Notify tenant when their interest is declined.
 */
const notifyInterestDeclined = async ({ tenant, owner, listing }) => {
  await sendEmail({
    to: tenant.email,
    subject: `Interest update for ${listing.location}`,
    html: `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1a1a2e;">Update on your interest</h2>
        <p>Hi ${tenant.name},</p>
        <p>Unfortunately, <strong>${owner.name}</strong> has declined your interest in:</p>
        <div style="background: #fef2f2; border-radius: 12px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;">📍 <strong>${listing.location}</strong></p>
          <p style="margin: 4px 0;">💰 ₹${listing.rent}/month • ${listing.room_type}</p>
        </div>
        <p>Don't worry — there are plenty of other listings that match your preferences!</p>
        <a href="${frontendUrl}" style="display: inline-block; background: #4f46e5; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 12px;">Browse More Listings</a>
      </div>
    `,
    userId: tenant.id,
    type: 'interest_declined'
  });
};

module.exports = { sendEmail, notifyHighScoreInterest, notifyInterestAccepted, notifyInterestDeclined };

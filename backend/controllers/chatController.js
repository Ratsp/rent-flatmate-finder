const { query } = require('../config/db');

/**
 * GET /api/chat/:interestRequestId/messages
 * Fetch chat history for an interest request.
 * Only accessible by the tenant or listing owner of the accepted interest.
 */
const getMessages = async (req, res) => {
  try {
    const { interestRequestId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Verify access: user must be tenant or owner, and interest must be accepted
    const interest = await query(
      `SELECT ir.tenant_id, ir.status, l.owner_id
       FROM interest_requests ir
       JOIN listings l ON l.id = ir.listing_id
       WHERE ir.id = $1`,
      [interestRequestId]
    );

    if (interest.rows.length === 0) {
      return res.status(404).json({ error: 'Interest request not found' });
    }

    const ir = interest.rows[0];

    if (ir.status !== 'accepted') {
      return res.status(403).json({ error: 'Chat is only available for accepted interests' });
    }

    if (req.user.id !== ir.tenant_id && req.user.id !== ir.owner_id) {
      return res.status(403).json({ error: 'You are not a participant in this chat' });
    }

    // Fetch messages with sender info
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const result = await query(
      `SELECT m.*, u.name AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.interest_request_id = $1
       ORDER BY m.sent_at ASC
       LIMIT $2 OFFSET $3`,
      [interestRequestId, parseInt(limit), offset]
    );

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) FROM messages WHERE interest_request_id = $1',
      [interestRequestId]
    );

    res.json({
      messages: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count)
      }
    });

  } catch (err) {
    console.error('GetMessages error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /api/chat/rooms
 * Get all chat rooms (accepted interest requests) for the current user.
 */
const getChatRooms = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await query(
      `SELECT ir.id AS interest_request_id, ir.status, ir.created_at,
              l.location, l.rent, l.room_type,
              CASE WHEN ir.tenant_id = $1 THEN u_owner.name ELSE u_tenant.name END AS chat_partner_name,
              CASE WHEN ir.tenant_id = $1 THEN 'owner' ELSE 'tenant' END AS partner_role,
              (SELECT content FROM messages WHERE interest_request_id = ir.id ORDER BY sent_at DESC LIMIT 1) AS last_message,
              (SELECT sent_at FROM messages WHERE interest_request_id = ir.id ORDER BY sent_at DESC LIMIT 1) AS last_message_at,
              (SELECT COUNT(*) FROM messages WHERE interest_request_id = ir.id AND sender_id != $1 AND read_at IS NULL) AS unread_count
       FROM interest_requests ir
       JOIN listings l ON l.id = ir.listing_id
       JOIN users u_owner ON u_owner.id = l.owner_id
       JOIN users u_tenant ON u_tenant.id = ir.tenant_id
       WHERE ir.status = 'accepted'
         AND (ir.tenant_id = $1 OR l.owner_id = $1)
       ORDER BY last_message_at DESC NULLS LAST`,
      [userId]
    );

    res.json({ rooms: result.rows });

  } catch (err) {
    console.error('GetChatRooms error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { getMessages, getChatRooms };

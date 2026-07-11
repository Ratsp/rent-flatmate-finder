const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

/**
 * Initialize Socket.IO chat server with JWT auth and room-based messaging.
 * @param {import('socket.io').Server} io - Socket.IO server instance
 */
const initChatSocket = (io) => {
  // ── Auth Middleware ────────────────────────────────────────────
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, email, role }
      next();
    } catch (err) {
      return next(new Error('Invalid token'));
    }
  });

  // ── Connection Handler ─────────────────────────────────────────
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.user.email} (${socket.user.role})`);

    // ── Join Chat Room ───────────────────────────────────────────
    socket.on('join_room', async ({ interest_request_id }) => {
      try {
        if (!interest_request_id) {
          socket.emit('error', { message: 'interest_request_id is required' });
          return;
        }

        // Verify: interest is accepted AND user is a participant
        const result = await query(
          `SELECT ir.tenant_id, ir.status, l.owner_id
           FROM interest_requests ir
           JOIN listings l ON l.id = ir.listing_id
           WHERE ir.id = $1`,
          [interest_request_id]
        );

        if (result.rows.length === 0) {
          socket.emit('error', { message: 'Interest request not found' });
          return;
        }

        const ir = result.rows[0];

        // Must be accepted
        if (ir.status !== 'accepted') {
          socket.emit('error', { message: 'Chat is only available for accepted interest requests' });
          return;
        }

        // User must be either the tenant or the owner
        if (socket.user.id !== ir.tenant_id && socket.user.id !== ir.owner_id) {
          socket.emit('error', { message: 'You are not a participant in this chat' });
          return;
        }

        // Join the room
        const roomId = `chat_${interest_request_id}`;
        socket.join(roomId);
        socket.currentRoom = roomId;
        socket.interestRequestId = interest_request_id;

        console.log(`💬 ${socket.user.email} joined room: ${roomId}`);
        socket.emit('room_joined', { room: roomId, interest_request_id });

      } catch (err) {
        console.error('Join room error:', err.message);
        socket.emit('error', { message: 'Failed to join chat room' });
      }
    });

    // ── Send Message ─────────────────────────────────────────────
    socket.on('send_message', async ({ content }) => {
      try {
        if (!socket.interestRequestId) {
          socket.emit('error', { message: 'Join a room first' });
          return;
        }

        if (!content || content.trim().length === 0) {
          socket.emit('error', { message: 'Message content is required' });
          return;
        }

        // Persist message to database
        const result = await query(
          `INSERT INTO messages (interest_request_id, sender_id, content)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [socket.interestRequestId, socket.user.id, content.trim()]
        );

        const message = {
          ...result.rows[0],
          sender_name: socket.user.email // Will be enriched on client side
        };

        // Broadcast to all in the room (including sender for confirmation)
        io.to(socket.currentRoom).emit('receive_message', message);

      } catch (err) {
        console.error('Send message error:', err.message);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // ── Typing Indicator (ephemeral) ─────────────────────────────
    socket.on('typing', ({ is_typing }) => {
      if (socket.currentRoom) {
        socket.to(socket.currentRoom).emit('typing', {
          user_id: socket.user.id,
          is_typing: !!is_typing
        });
      }
    });

    // ── Mark Messages as Read ────────────────────────────────────
    socket.on('mark_read', async ({ message_ids }) => {
      try {
        if (!message_ids || message_ids.length === 0) return;

        await query(
          `UPDATE messages SET read_at = now()
           WHERE id = ANY($1) AND sender_id != $2 AND read_at IS NULL`,
          [message_ids, socket.user.id]
        );
      } catch (err) {
        console.error('Mark read error:', err.message);
      }
    });

    // ── Disconnect ───────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.user.email}`);
    });
  });
};

module.exports = { initChatSocket };

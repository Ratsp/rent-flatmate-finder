const express = require('express');
const router = express.Router();
const { getMessages, getChatRooms } = require('../controllers/chatController');
const { authenticate } = require('../middleware/auth');

// All chat routes require authentication
router.get('/rooms', authenticate, getChatRooms);
router.get('/:interestRequestId/messages', authenticate, getMessages);

module.exports = router;

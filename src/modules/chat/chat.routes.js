const express = require('express');
const { getConversations, getMessages, sendMessage } = require('./chat.controller');
const { protect } = require('../../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

router.get('/conversations', getConversations);
router.get('/:conversationId/messages', getMessages);
router.post('/messages', sendMessage);

module.exports = router;

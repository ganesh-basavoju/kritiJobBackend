const Message = require('../../models/Message');
const User = require('../../models/User');

// @desc    Get all conversations for current user
// @route   GET /api/chat/conversations
// @access  Private
exports.getConversations = async (req, res, next) => {
  try {
    // Find unique conversationIds involving the user.
    // Since we used a simple schema where conversationId is a string, we need to aggregate messages
    // OR we should have used a Conversation model.
    // Given the constraints and simplicity, let's aggregate based on senderId/receiverId.
    
    // Better Approach for this simple schema: 
    // Find distinct conversationIds where senderId or receiverId is current user.
    const conversations = await Message.aggregate([
        {
            $match: {
                $or: [{ senderId: req.user._id }, { receiverId: req.user._id }]
            }
        },
        {
            $sort: { createdAt: -1 }
        },
        {
            $group: {
                _id: "$conversationId",
                lastMessage: { $first: "$$ROOT" }
            }
        }
    ]);

    // Populate user details for each conversation
    // We need to figure out who the "other" person is.
    const populatedConversations = await Promise.all(conversations.map(async (conv) => {
        const msg = conv.lastMessage;
        const otherUserId = msg.senderId.toString() === req.user.id ? msg.receiverId : msg.senderId;
        const otherUser = await User.findById(otherUserId).select('name role status'); // Add avatar if available in User model (it's not, it's in Profile. Keep simple).
        return {
            ...conv,
            otherUser
        };
    }));

    res.status(200).json({
      success: true,
      data: populatedConversations
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/chat/:conversationId/messages
// @access  Private
exports.getMessages = async (req, res, next) => {
  try {
    const messages = await Message.find({ conversationId: req.params.conversationId })
        .sort({ createdAt: 1 });

    res.status(200).json({
      success: true,
      data: messages
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Send a message (REST fallback, though Socket is primary)
// @route   POST /api/chat/messages
// @access  Private
exports.sendMessage = async (req, res, next) => {
  try {
    const { receiverId, content } = req.body;

    // Generate Conversation ID (sorted ids)
    const conversationId = [req.user.id, receiverId].sort().join('_');

    const message = await Message.create({
        conversationId,
        senderId: req.user.id,
        receiverId,
        content
    });

    // Emit socket event if user is online (handled by client listening)
    const io = require('../../config/socket').getIO();
    io.to(receiverId).emit('receive_message', message);

    res.status(201).json({
      success: true,
      data: message
    });
  } catch (error) {
    next(error);
  }
};
// @desc    Initiate or Get Conversation Details
// @route   POST /api/chat
// @access  Private
exports.initiateChat = async (req, res, next) => {
  try {
    const { userId } = req.body; // The other user's ID

    if (!userId) {
        return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const otherUser = await User.findById(userId);
    if (!otherUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Deterministic Conversation ID
    const conversationId = [req.user.id, userId].sort().join('_');

    res.status(200).json({
      success: true,
      data: {
          _id: conversationId,
          otherUser: {
              _id: otherUser._id,
              name: otherUser.name,
              avatarUrl: otherUser.avatarUrl // If exists
          }
      }
    });
  } catch (error) {
    next(error);
  }
};

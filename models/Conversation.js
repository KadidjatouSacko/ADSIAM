// models/Conversation.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Conversation = sequelize.define('Conversation', {
    nom: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.STRING, defaultValue: 'formateur' },
    avatar: { type: DataTypes.STRING }
  }, {
    tableName: 'conversations',
    underscored: true,
    timestamps: true
  });

  const ConversationParticipant = sequelize.define('ConversationParticipant', {
    role: { type: DataTypes.STRING, defaultValue: 'participant' }
  }, {
    tableName: 'conversation_participants',
    underscored: true,
    timestamps: false
  });

  return { Conversation, ConversationParticipant };
};

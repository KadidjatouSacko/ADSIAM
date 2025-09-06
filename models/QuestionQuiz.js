// models/QuestionQuiz.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const QuestionQuiz = sequelize.define('QuestionQuiz', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    quiz_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'quiz',
        key: 'id'
      }
    },
    question: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    type_question: {
      type: DataTypes.ENUM('qcm', 'vrai_faux', 'texte_libre', 'correspondance'),
      allowNull: false
    },
    points: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    ordre: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    explication: {
      type: DataTypes.TEXT
    },
    media_url: {
      type: DataTypes.TEXT
    },
    obligatoire: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'questions_quiz',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat'
  });

  return QuestionQuiz;
};

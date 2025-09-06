// models/ReponseQuestion.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ReponseQuestion = sequelize.define('ReponseQuestion', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    question_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'questions_quiz',
        key: 'id'
      }
    },
    texte_reponse: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    est_correcte: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    ordre: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    explication: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'reponses_questions',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat'
  });

  return ReponseQuestion;
};

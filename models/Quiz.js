// models/Quiz.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Quiz = sequelize.define('Quiz', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    partie_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'parties_modules',
        key: 'id'
      }
    },
    titre: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT
    },
    instructions: {
      type: DataTypes.TEXT
    },
    duree_limite_minutes: {
      type: DataTypes.INTEGER
    },
    nombre_tentatives_max: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    },
    note_passage: {
      type: DataTypes.DECIMAL(3, 1),
      defaultValue: 70.0
    },
    melanger_questions: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    afficher_resultats_immediats: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    obligatoire: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'quiz',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat'
  });

  return Quiz;
};

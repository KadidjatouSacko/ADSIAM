// models/TentativeQuiz.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const TentativeQuiz = sequelize.define('TentativeQuiz', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    quiz_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'quiz',
        key: 'id'
      }
    },
    numero_tentative: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1
    },
    score: {
      type: DataTypes.DECIMAL(5, 2)
    },
    pourcentage: {
      type: DataTypes.DECIMAL(5, 2)
    },
    temps_passe_secondes: {
      type: DataTypes.INTEGER
    },
    terminee: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    date_debut: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    date_fin: {
      type: DataTypes.DATE
    },
    reponses_utilisateur: {
      type: DataTypes.JSONB
    }
  }, {
    tableName: 'tentatives_quiz',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'quiz_id', 'numero_tentative']
      }
    ]
  });

  return TentativeQuiz;
};

// models/EvaluationModule.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const EvaluationModule = sequelize.define('EvaluationModule', {
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
    module_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'modules',
        key: 'id'
      }
    },
    note_finale: {
      type: DataTypes.DECIMAL(5, 2)
    },
    pourcentage: {
      type: DataTypes.DECIMAL(5, 2)
    },
    temps_total_minutes: {
      type: DataTypes.INTEGER
    },
    date_debut: {
      type: DataTypes.DATE
    },
    date_fin: {
      type: DataTypes.DATE
    },
    statut: {
      type: DataTypes.ENUM('en_cours', 'termine', 'valide', 'echec'),
      defaultValue: 'en_cours'
    },
    commentaires: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'evaluations_modules',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat',
    indexes: [
      {
        unique: true,
        fields: ['user_id', 'module_id']
      }
    ]
  });

  return EvaluationModule;
};
// models/TelechargementDocument.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const TelechargementDocument = sequelize.define('TelechargementDocument', {
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
    document_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'documents_parties',
        key: 'id'
      }
    },
    date_telechargement: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    adresse_ip: {
      type: DataTypes.INET
    },
    user_agent: {
      type: DataTypes.TEXT
    }
  }, {
    tableName: 'telechargements_documents',
    timestamps: false
  });

  return TelechargementDocument;
};
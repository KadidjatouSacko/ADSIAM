// models/DocumentPartie.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const DocumentPartie = sequelize.define('DocumentPartie', {
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
    nom_fichier: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    chemin_fichier: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    type_document: {
      type: DataTypes.STRING(50)
    },
    taille_fichier: {
      type: DataTypes.BIGINT
    },
    telechargements_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    acces_connecte_uniquement: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'documents_parties',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat'
  });

  return DocumentPartie;
};

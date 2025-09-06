// models/VideoPartie.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const VideoPartie = sequelize.define('VideoPartie', {
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
      type: DataTypes.STRING(255)
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
    url_video: {
      type: DataTypes.TEXT
    },
    duree_secondes: {
      type: DataTypes.INTEGER
    },
    taille_fichier: {
      type: DataTypes.BIGINT
    },
    format_video: {
      type: DataTypes.STRING(20)
    },
    qualite: {
      type: DataTypes.STRING(20)
    },
    acces_connecte_uniquement: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'videos_parties',
    timestamps: true,
    createdAt: 'createdat',
    updatedAt: 'updatedat'
  });

  return VideoPartie;
};
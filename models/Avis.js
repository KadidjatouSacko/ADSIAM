// models/Avis.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Avis = sequelize.define('Avis', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    formation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'formations',
        key: 'id'
      }
    },
    nom_utilisateur: {
      type: DataTypes.STRING,
      allowNull: false
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false
    },
    ville: {
      type: DataTypes.STRING,
      allowNull: true
    },
    note: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5
      }
    },
    commentaire: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    verifie: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'avis',
    timestamps: true
  });

  return Avis;
};

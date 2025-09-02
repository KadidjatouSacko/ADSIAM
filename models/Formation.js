// models/Formation.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Formation = sequelize.define('Formation', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    titre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    icone: {
      type: DataTypes.STRING,
      defaultValue: '📚'
    },
    niveau: {
      type: DataTypes.ENUM('debutant', 'intermediaire', 'avance', 'expert'),
      defaultValue: 'debutant'
    },
    duree_heures: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    nombre_modules: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    prix: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.00
    },
    prix_original: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true
    },
    gratuit: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    domaine: {
      type: DataTypes.ENUM('communication', 'hygiene', 'ergonomie', 'urgences', 'nutrition', 'pathologies'),
      allowNull: false
    },
    badge: {
      type: DataTypes.STRING,
      allowNull: true
    },
    populaire: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    nouveau: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    certifiant: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    actif: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'formations',
    timestamps: true
  });

  return Formation;
};

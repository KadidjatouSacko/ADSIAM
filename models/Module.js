// models/Module.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Module = sequelize.define('Module', {
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
    titre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    ordre: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    duree_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 15
    },
    type_contenu: {
      type: DataTypes.ENUM('video', 'pdf', 'quiz', 'exercice'),
      defaultValue: 'video'
    },
    disponible: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'modules',
    timestamps: true
  });

  return Module;
};

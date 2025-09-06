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
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [3, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    duree_minutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 480
      }
    },
    type_contenu: {
      type: DataTypes.ENUM('video', 'quiz', 'document', 'pratique'),
      allowNull: true,
      defaultValue: 'video'
    },
    ordre: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1
      }
    },
    disponible: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      defaultValue: true
    }
  }, {
    tableName: 'modules',
    timestamps: true,
    indexes: [
      { fields: ['formation_id'] },
      { fields: ['ordre'] },
      { fields: ['disponible'] }
    ]
  });

  return Module;
};
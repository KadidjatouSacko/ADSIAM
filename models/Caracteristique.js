// models/Caracteristique.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Caracteristique = sequelize.define('Caracteristique', {
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
    icone: {
      type: DataTypes.STRING,
      defaultValue: '✓'
    }
  }, {
    tableName: 'caracteristiques',
    timestamps: true
  });

  return Caracteristique;
};

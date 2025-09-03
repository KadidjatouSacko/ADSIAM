import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ProgressionModule = sequelize.define('ProgressionModule', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    module_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    inscription_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    statut: {
      type: DataTypes.STRING,
      defaultValue: 'non_commence'
    },
    temps_passe_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    progression_pourcentage: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    note: {
      type: DataTypes.DECIMAL(5,2),
      allowNull: true
    },
    date_debut: {
      type: DataTypes.DATE,
      allowNull: true
    },
    date_fin: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'progressions_modules',
    timestamps: true
  });

  return ProgressionModule;
};

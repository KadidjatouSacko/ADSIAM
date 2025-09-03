import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Inscription = sequelize.define('Inscription', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    formation_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    date_inscription: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    date_fin_prevue: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    statut: {
      type: DataTypes.STRING,
      defaultValue: 'en_cours'
    },
    progression_pourcentage: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    temps_total_minutes: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    note_finale: {
      type: DataTypes.DECIMAL(5,2),
      allowNull: true
    },
    certifie: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    date_certification: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    tableName: 'inscriptions',
    timestamps: true
  });

  return Inscription;
};

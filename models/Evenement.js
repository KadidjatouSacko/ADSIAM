import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Evenement = sequelize.define('Evenement', {
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
      allowNull: true
    },
    type_evenement: {
      type: DataTypes.STRING,
      defaultValue: 'cours'
    },
    date_debut: {
      type: DataTypes.DATE,
      allowNull: false
    },
    date_fin: {
      type: DataTypes.DATE,
      allowNull: false
    },
    formation_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    formateur_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    lieu: {
      type: DataTypes.STRING,
      allowNull: true
    },
    lien_visio: {
      type: DataTypes.STRING,
      allowNull: true
    },
    max_participants: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    statut: {
      type: DataTypes.STRING,
      defaultValue: 'prevu'
    },
    couleur: {
      type: DataTypes.STRING,
      defaultValue: '#3498db'
    }
  }, {
    tableName: 'evenements',
    timestamps: true
  });

  return Evenement;
};

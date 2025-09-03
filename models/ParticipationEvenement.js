import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ParticipationEvenement = sequelize.define('ParticipationEvenement', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    evenement_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    statut_participation: {
      type: DataTypes.STRING,
      defaultValue: 'inscrit'
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'participations_evenements',
    timestamps: true
  });

  return ParticipationEvenement;
};

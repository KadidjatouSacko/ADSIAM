import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Etudiant = sequelize.define('Etudiant', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    prenom: {
      type: DataTypes.STRING,
      allowNull: false
    },
    nom: {
      type: DataTypes.STRING,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false
    },
    telephone: {
      type: DataTypes.STRING,
      allowNull: true
    },
    profession: {
      type: DataTypes.ENUM('aide_domicile','autre'),
      defaultValue: 'aide_domicile'
    },
    actif: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'etudiants',
    timestamps: true
  });

  return Etudiant;
};

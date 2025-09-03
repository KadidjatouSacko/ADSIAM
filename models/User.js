// models/User.js
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    prenom: { type: DataTypes.STRING, allowNull: false },
    nom: { type: DataTypes.STRING, allowNull: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    mot_de_passe: { type: DataTypes.STRING, allowNull: false },
    telephone: { type: DataTypes.STRING, allowNull: true },
    date_naissance: { type: DataTypes.DATEONLY, allowNull: true },
    photo_profil: { type: DataTypes.STRING, allowNull: true },
    type_utilisateur: {
      type: DataTypes.ENUM('etudiant', 'salarié', 'administrateur', 'etudiant_entreprise'),
      allowNull: false,
      defaultValue: 'etudiant'
    },
    statut: {
      type: DataTypes.ENUM('actif', 'inactif', 'suspendu'),
      allowNull: false,
      defaultValue: 'actif'
    },
    date_inscription: { type: DataTypes.DATE, allowNull: true },
    derniere_connexion: { type: DataTypes.DATE, allowNull: true },
    role: {
      type: DataTypes.ENUM('administrateur', 'salarié', 'etudiant_entreprise', 'etudiant'),
      allowNull: false,
      defaultValue: 'etudiant'
    }
  }, {
    tableName: 'users',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  });

  return User;
};

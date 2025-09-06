import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    prenom: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50]
      }
    },
    nom: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [2, 50]
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        notEmpty: true
      }
    },
    mot_de_passe: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [6, 255]
      }
    },
    telephone: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        is: /^[0-9+\-\s()]*$/
      }
    },
    date_naissance: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    photo_profil: {
      type: DataTypes.STRING,
      allowNull: true
    },
    type_utilisateur: {
      type: DataTypes.ENUM('etudiant', 'formateur', 'administrateur'),
      allowNull: false,
      defaultValue: 'etudiant'
    },
    statut: {
      type: DataTypes.ENUM('actif', 'inactif', 'suspendu'),
      allowNull: false,
      defaultValue: 'actif'
    },
    date_inscription: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW
    },
    derniere_connexion: {
      type: DataTypes.DATE,
      allowNull: true
    },
    role: {
      type: DataTypes.ENUM('admin', 'formateur', 'apprenant'),
      allowNull: false,
      defaultValue: 'apprenant'
    },
    societe_rattachee: {
      type: DataTypes.STRING,
      allowNull: true
    }
  }, {
    tableName: 'users',
    timestamps: false,
    indexes: [
      { fields: ['email'], unique: true },
      { fields: ['type_utilisateur'] },
      { fields: ['statut'] },
      { fields: ['role'] }
    ]
  });

  return User;
};
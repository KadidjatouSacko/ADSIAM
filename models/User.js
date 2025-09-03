import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';

export const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },

    prenom: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Le prénom est obligatoire' },
            len: { args: [2, 100], msg: 'Le prénom doit contenir entre 2 et 100 caractères' }
        }
    },

    nom: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Le nom est obligatoire' },
            len: { args: [2, 100], msg: 'Le nom doit contenir entre 2 et 100 caractères' }
        }
    },

    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: { msg: 'Format d\'email invalide' },
            notEmpty: { msg: 'L\'email est obligatoire' }
        }
    },

    mot_de_passe: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            len: { args: [8, 255], msg: 'Le mot de passe doit contenir au moins 8 caractères' }
        }
    },

    telephone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },

    societe_rattachee: {
        type: DataTypes.STRING(150),
        allowNull: true
    },

    role: {
        type: DataTypes.ENUM('admin', 'instructeur', 'etudiant'),
        allowNull: false,
        defaultValue: 'etudiant'
    },

    statut: {
        type: DataTypes.ENUM('actif', 'inactif', 'en_attente', 'suspendu'),
        allowNull: false,
        defaultValue: 'en_attente'
    },

    derniere_connexion: {
        type: DataTypes.DATE,
        allowNull: true
    },

    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },

    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'users', // 🔥 garde bien la table existante
    timestamps: true
});


// 🔒 Hash du mot de passe avant création
User.beforeCreate(async (user) => {
    if (user.mot_de_passe) {
        const salt = await bcrypt.genSalt(10);
        user.mot_de_passe = await bcrypt.hash(user.mot_de_passe, salt);
    }
});

// 🔒 Hash si le mot de passe est modifié
User.beforeUpdate(async (user) => {
    if (user.changed('mot_de_passe')) {
        const salt = await bcrypt.genSalt(10);
        user.mot_de_passe = await bcrypt.hash(user.mot_de_passe, salt);
    }
});

// ✅ Méthode pour comparer un mot de passe
// ✅ Méthode pour comparer un mot de passe
User.prototype.checkPassword = async function(mot_de_passe) {
    return await bcrypt.compare(mot_de_passe, this.mot_de_passe);
};

// ✅ Helpers
User.prototype.getNomComplet = function() {
    return `${this.prenom} ${this.nom}`;
};

User.prototype.isActive = function() {
    return this.statut === 'actif';
};

User.prototype.hasRole = function(role) {
    return this.role === role;
};

// ✅ Recherche par email
User.findByEmail = function(email) {
    return this.findOne({
        where: { email: email.toLowerCase() }
    });
};

export default User;

// models/Entreprise.js
import { DataTypes } from 'sequelize';
import { sequelize } from './index.js';

const Entreprise = sequelize.define('Entreprise', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    nom: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Le nom de l\'entreprise est obligatoire' },
            len: { args: [2, 255], msg: 'Le nom doit contenir entre 2 et 255 caractères' }
        }
    },
    siret: {
        type: DataTypes.STRING(14),
        allowNull: false,
        unique: {
            name: 'unique_siret',
            msg: 'Ce numéro SIRET est déjà enregistré'
        },
        validate: {
            notEmpty: { msg: 'Le numéro SIRET est obligatoire' },
            len: { args: [14, 14], msg: 'Le SIRET doit contenir exactement 14 chiffres' },
            isNumeric: { msg: 'Le SIRET ne doit contenir que des chiffres' }
        }
    },
    secteur_activite: {
        type: DataTypes.ENUM('aide_domicile', 'ehpad', 'hopital', 'clinique', 'centre_soins', 'autre'),
        allowNull: false,
        defaultValue: 'aide_domicile'
    },
    adresse: {
        type: DataTypes.TEXT,
        allowNull: false,
        validate: {
            notEmpty: { msg: 'L\'adresse est obligatoire' }
        }
    },
    ville: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'La ville est obligatoire' }
        }
    },
    code_postal: {
        type: DataTypes.STRING(5),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Le code postal est obligatoire' },
            len: { args: [5, 5], msg: 'Le code postal doit contenir 5 chiffres' },
            isNumeric: { msg: 'Le code postal ne doit contenir que des chiffres' }
        }
    },
    telephone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            is: { 
                args: /^(?:\+33|0)[1-9](?:[0-9]{8})$/,
                msg: 'Format de téléphone invalide'
            }
        }
    },
    email_contact: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: {
            name: 'unique_email_entreprise',
            msg: 'Cette adresse email est déjà utilisée'
        },
        validate: {
            notEmpty: { msg: 'L\'email de contact est obligatoire' },
            isEmail: { msg: 'Format d\'email invalide' }
        }
    },
    site_web: {
        type: DataTypes.STRING(255),
        allowNull: true,
        validate: {
            isUrl: { msg: 'URL du site web invalide' }
        }
    },
    logo: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    nombre_employes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
            min: { args: 1, msg: 'Le nombre d\'employés doit être positif' }
        }
    },
    personne_contact_nom: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Le nom de la personne de contact est obligatoire' }
        }
    },
    personne_contact_prenom: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'Le prénom de la personne de contact est obligatoire' }
        }
    },
    personne_contact_fonction: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    personne_contact_telephone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            is: { 
                args: /^(?:\+33|0)[1-9](?:[0-9]{8})$/,
                msg: 'Format de téléphone invalide'
            }
        }
    },
    personne_contact_email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
            notEmpty: { msg: 'L\'email de la personne de contact est obligatoire' },
            isEmail: { msg: 'Format d\'email invalide' }
        }
    },
    statut: {
        type: DataTypes.ENUM('en_attente', 'actif', 'suspendu', 'inactif'),
        allowNull: false,
        defaultValue: 'en_attente'
    },
    type_contrat: {
        type: DataTypes.ENUM('standard', 'premium', 'enterprise', 'personnalise'),
        allowNull: false,
        defaultValue: 'standard'
    },
    date_debut_contrat: {
        type: DataTypes.DATE,
        allowNull: true
    },
    date_fin_contrat: {
        type: DataTypes.DATE,
        allowNull: true
    },
    nombre_licences_max: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 10,
        validate: {
            min: { args: 1, msg: 'Le nombre de licences doit être positif' }
        }
    },
    nombre_licences_utilisees: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        validate: {
            min: { args: 0, msg: 'Le nombre de licences utilisées ne peut être négatif' }
        }
    },
    tarif_mensuel: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        validate: {
            min: { args: 0, msg: 'Le tarif ne peut être négatif' }
        }
    },
    reduction_pourcentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true,
        defaultValue: 0,
        validate: {
            min: { args: 0, msg: 'La réduction ne peut être négative' },
            max: { args: 100, msg: 'La réduction ne peut dépasser 100%' }
        }
    },
    formations_autorisees: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: []
    },
    preferences: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {}
    },
    notes_internes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    derniere_activite: {
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
    tableName: 'entreprises',
    timestamps: true,
    indexes: [
        { fields: ['siret'], unique: true },
        { fields: ['email_contact'], unique: true },
        { fields: ['statut'] },
        { fields: ['secteur_activite'] },
        { fields: ['type_contrat'] },
        { fields: ['ville'] }
    ],
    hooks: {
        beforeValidate: (entreprise) => {
            // Nettoyer les données
            if (entreprise.siret) {
                entreprise.siret = entreprise.siret.replace(/\s/g, '');
            }
            if (entreprise.telephone) {
                entreprise.telephone = entreprise.telephone.replace(/\s/g, '');
            }
            if (entreprise.personne_contact_telephone) {
                entreprise.personne_contact_telephone = entreprise.personne_contact_telephone.replace(/\s/g, '');
            }
        },
        beforeSave: (entreprise) => {
            // Vérifier que les licences utilisées ne dépassent pas le maximum
            if (entreprise.nombre_licences_utilisees > entreprise.nombre_licences_max) {
                throw new Error('Le nombre de licences utilisées ne peut dépasser le maximum autorisé');
            }
        }
    }
});

// Méthodes d'instance
Entreprise.prototype.getLicencesDisponibles = function() {
    return this.nombre_licences_max - this.nombre_licences_utilisees;
};

Entreprise.prototype.getPourcentageUtilisation = function() {
    if (this.nombre_licences_max === 0) return 0;
    return Math.round((this.nombre_licences_utilisees / this.nombre_licences_max) * 100);
};

Entreprise.prototype.isContratActif = function() {
    const now = new Date();
    return this.statut === 'actif' && 
           (!this.date_fin_contrat || this.date_fin_contrat > now);
};

Entreprise.prototype.getJoursRestants = function() {
    if (!this.date_fin_contrat) return null;
    const now = new Date();
    const diff = this.date_fin_contrat - now;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

// Méthodes de classe
Entreprise.findActiveEntreprises = function() {
    return this.findAll({
        where: { statut: 'actif' },
        order: [['nom', 'ASC']]
    });
};

Entreprise.findBySiret = function(siret) {
    return this.findOne({
        where: { siret: siret.replace(/\s/g, '') }
    });
};

Entreprise.getStatistiques = async function() {
    const stats = await this.findAll({
        attributes: [
            [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
            [sequelize.fn('SUM', sequelize.literal("CASE WHEN statut = 'actif' THEN 1 ELSE 0 END")), 'actives'],
            [sequelize.fn('SUM', sequelize.literal("CASE WHEN statut = 'en_attente' THEN 1 ELSE 0 END")), 'en_attente'],
            [sequelize.fn('SUM', sequelize.col('nombre_licences_max')), 'licences_totales'],
            [sequelize.fn('SUM', sequelize.col('nombre_licences_utilisees')), 'licences_utilisees'],
            [sequelize.fn('AVG', sequelize.col('tarif_mensuel')), 'tarif_moyen']
        ]
    });
    
    return stats[0];
};

export default Entreprise;
import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';
import { Op } from 'sequelize';

export const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    
    firstName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Le prénom est obligatoire'
            },
            len: {
                args: [2, 100],
                msg: 'Le prénom doit contenir entre 2 et 100 caractères'
            }
        }
    },
    
    lastName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: {
                msg: 'Le nom est obligatoire'
            },
            len: {
                args: [2, 100],
                msg: 'Le nom doit contenir entre 2 et 100 caractères'
            }
        }
    },
    
    email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: {
            msg: 'Cette adresse email est déjà utilisée'
        },
        validate: {
            isEmail: {
                msg: 'Format d\'email invalide'
            },
            notEmpty: {
                msg: 'L\'email est obligatoire'
            }
        }
    },
    
    password: {
        type: DataTypes.STRING(255),
        allowNull: true, // null pour les connexions sociales
        validate: {
            len: {
                args: [8, 255],
                msg: 'Le mot de passe doit contenir au moins 8 caractères'
            }
        }
    },
    
    avatar: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    
 role: {
    type: DataTypes.ENUM('admin', 'instructor', 'student'), // valeurs anglaises
    allowNull: false,
    defaultValue: 'student'
},

    
    status: {
        type: DataTypes.ENUM('active', 'inactive', 'pending_verification', 'suspended'),
        allowNull: false,
        defaultValue: 'pending_verification'
    },
    
    // Vérification email
    emailVerifiedAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    
    emailVerificationToken: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    
    // Réinitialisation mot de passe
    passwordResetToken: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    
    passwordResetExpires: {
        type: DataTypes.DATE,
        allowNull: true
    },
    
    // Authentification sociale
    socialProvider: {
        type: DataTypes.ENUM('google', 'microsoft'),
        allowNull: true
    },
    
    socialId: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    
    // Sécurité
    failedLoginAttempts: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    
    lockedUntil: {
        type: DataTypes.DATE,
        allowNull: true
    },
    
    // Refresh token pour "Se souvenir de moi"
    refreshToken: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    
    refreshTokenExpires: {
        type: DataTypes.DATE,
        allowNull: true
    },
    
    // Informations de connexion
    lastLoginAt: {
        type: DataTypes.DATE,
        allowNull: true
    },
    
    lastLoginIp: {
        type: DataTypes.STRING(45), // Support IPv6
        allowNull: true
    },
    
    // Préférences utilisateur
    preferences: {
        type: DataTypes.JSON,
        defaultValue: {
            language: 'fr',
            notifications: {
                email: true,
                push: false,
                sms: false
            },
            theme: 'light'
        }
    },
    
    // Métadonnées
    createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    
    updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    
    deletedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'users',
    timestamps: true,
    paranoid: true, // Soft delete
    
    // Index pour améliorer les performances
    indexes: [
        {
            unique: true,
            fields: ['email']
        },
        {
            fields: ['emailVerificationToken']
        },
        {
            fields: ['passwordResetToken']
        },
        {
            fields: ['refreshToken']
        },
        {
            fields: ['socialProvider', 'socialId']
        },
        {
            fields: ['status']
        },
        {
            fields: ['role']
        },
        {
            fields: ['createdAt']
        }
    ],
    
    // Scopes pour les requêtes courantes
    scopes: {
        active: {
            where: {
                status: 'active'
            }
        },
        
        verified: {
            where: {
                emailVerifiedAt: {
                    [Op.ne]: null
                }
            }
        },
        
        students: {
            where: {
                role: 'student'
            }
        },
        
        instructors: {
            where: {
                role: 'instructor'
            }
        },
        
        admins: {
            where: {
                role: 'admin'
            }
        },
        
        withoutPassword: {
            attributes: {
                exclude: ['password', 'passwordResetToken', 'refreshToken', 'emailVerificationToken']
            }
        }
    }
});

// Méthodes d'instance
User.prototype.getFullName = function() {
    return `${this.firstName} ${this.lastName}`;
};

User.prototype.isVerified = function() {
    return this.emailVerifiedAt !== null;
};

User.prototype.isActive = function() {
    return this.status === 'active';
};

User.prototype.isLocked = function() {
    return this.lockedUntil && this.lockedUntil > new Date();
};

User.prototype.canLogin = function() {
    return this.isActive() && this.isVerified() && !this.isLocked();
};

User.prototype.hasRole = function(role) {
    return this.role === role;
};

User.prototype.hasPermission = function(permission) {
    const permissions = {
        admin: [
            'manage_users',
            'manage_courses', 
            'manage_content',
            'view_analytics',
            'manage_settings',
            'access_admin_panel'
        ],
        instructor: [
            'create_courses',
            'edit_own_courses', 
            'view_students',
            'grade_assignments',
            'manage_own_content'
        ],
        student: [
            'enroll_courses',
            'view_courses',
            'submit_assignments', 
            'view_grades',
            'update_profile'
        ]
    };
    
    return permissions[this.role]?.includes(permission) || false;
};

// Méthodes statiques
User.findByEmail = function(email) {
    return this.findOne({
        where: { email: email.toLowerCase() }
    });
};

User.findByVerificationToken = function(token) {
    return this.findOne({
        where: { emailVerificationToken: token }
    });
};

User.findByPasswordResetToken = function(token) {
    return this.findOne({
        where: { 
            passwordResetToken: token,
            passwordResetExpires: {
                [Op.gt]: new Date()
            }
        }
    });
};

User.findBySocialId = function(provider, socialId) {
    return this.findOne({
        where: {
            socialProvider: provider,
            socialId: socialId
        }
    });
};

User.getActiveCount = async function() {
    return await this.count({
        where: { status: 'active' }
    });
};

User.getStudentsCount = async function() {
    return await this.count({
        where: { 
            role: 'student',
            status: 'active'
        }
    });
};

User.getRecentRegistrations = function(days = 7) {
    return this.findAll({
        where: {
            createdAt: {
                [Op.gte]: new Date(Date.now() - days * 24 * 60 * 60 * 1000)
            }
        },
        order: [['createdAt', 'DESC']]
    });
};

// Hooks Sequelize
User.beforeCreate(async (user) => {
    // Normaliser l'email
    if (user.email) {
        user.email = user.email.toLowerCase().trim();
    }
    
    // Normaliser les noms
    if (user.firstName) {
        user.firstName = user.firstName.trim();
    }
    if (user.lastName) {
        user.lastName = user.lastName.trim();
    }
});

User.beforeUpdate(async (user) => {
    // Normaliser l'email si modifié
    if (user.changed('email')) {
        user.email = user.email.toLowerCase().trim();
    }
    
    // Normaliser les noms si modifiés
    if (user.changed('firstName')) {
        user.firstName = user.firstName.trim();
    }
    if (user.changed('lastName')) {
        user.lastName = user.lastName.trim();
    }
});

// Export du modèle avec import Op pour les requêtes

export { Op };
export default User;

import validator from 'validator';

// Validation pour la connexion
export const validateLogin = (req, res, next) => {
    const { email, password } = req.body;
    const errors = [];

    // Validation email
    if (!email) {
        errors.push({
            field: 'email',
            message: 'L\'email est obligatoire'
        });
    } else if (!validator.isEmail(email)) {
        errors.push({
            field: 'email',
            message: 'Format d\'email invalide'
        });
    }

    // Validation mot de passe
    if (!password) {
        errors.push({
            field: 'password',
            message: 'Le mot de passe est obligatoire'
        });
    } else if (password.length < 1) {
        errors.push({
            field: 'password',
            message: 'Le mot de passe ne peut pas être vide'
        });
    }

    if (errors.length > 0) {
        return res.status(422).json({
            success: false,
            message: 'Données de connexion invalides',
            errors
        });
    }

    next();
};

// Validation pour l'inscription
export const validateRegistration = (req, res, next) => {
    const { firstName, lastName, email, password, confirmPassword } = req.body;
    const errors = [];

    // Validation prénom
    if (!firstName) {
        errors.push({
            field: 'firstName',
            message: 'Le prénom est obligatoire'
        });
    } else if (!validator.isLength(firstName.trim(), { min: 2, max: 50 })) {
        errors.push({
            field: 'firstName',
            message: 'Le prénom doit contenir entre 2 et 50 caractères'
        });
    } else if (!validator.matches(firstName.trim(), /^[a-zA-ZÀ-ÿ\s-']+$/)) {
        errors.push({
            field: 'firstName',
            message: 'Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'
        });
    }

    // Validation nom
    if (!lastName) {
        errors.push({
            field: 'lastName',
            message: 'Le nom est obligatoire'
        });
    } else if (!validator.isLength(lastName.trim(), { min: 2, max: 50 })) {
        errors.push({
            field: 'lastName',
            message: 'Le nom doit contenir entre 2 et 50 caractères'
        });
    } else if (!validator.matches(lastName.trim(), /^[a-zA-ZÀ-ÿ\s-']+$/)) {
        errors.push({
            field: 'lastName',
            message: 'Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes'
        });
    }

    // Validation email
    if (!email) {
        errors.push({
            field: 'email',
            message: 'L\'email est obligatoire'
        });
    } else if (!validator.isEmail(email)) {
        errors.push({
            field: 'email',
            message: 'Format d\'email invalide'
        });
    } else if (!validator.isLength(email, { max: 255 })) {
        errors.push({
            field: 'email',
            message: 'L\'email ne peut pas dépasser 255 caractères'
        });
    }

    // Validation mot de passe
    if (!password) {
        errors.push({
            field: 'password',
            message: 'Le mot de passe est obligatoire'
        });
    } else {
        const passwordErrors = validatePasswordStrength(password);
        errors.push(...passwordErrors);
    }

    // Validation confirmation mot de passe
    if (!confirmPassword) {
        errors.push({
            field: 'confirmPassword',
            message: 'La confirmation du mot de passe est obligatoire'
        });
    } else if (password !== confirmPassword) {
        errors.push({
            field: 'confirmPassword',
            message: 'Les mots de passe ne correspondent pas'
        });
    }

    if (errors.length > 0) {
        return res.status(422).json({
            success: false,
            message: 'Données d\'inscription invalides',
            errors
        });
    }

    next();
};

// Validation pour la réinitialisation de mot de passe
export const validatePasswordReset = (req, res, next) => {
    const { token, password, confirmPassword } = req.body;
    const errors = [];

    // Validation token
    if (!token) {
        errors.push({
            field: 'token',
            message: 'Token de réinitialisation manquant'
        });
    } else if (!validator.isLength(token, { min: 32, max: 64 })) {
        errors.push({
            field: 'token',
            message: 'Token de réinitialisation invalide'
        });
    }

    // Validation nouveau mot de passe
    if (!password) {
        errors.push({
            field: 'password',
            message: 'Le nouveau mot de passe est obligatoire'
        });
    } else {
        const passwordErrors = validatePasswordStrength(password);
        errors.push(...passwordErrors);
    }

    // Validation confirmation
    if (!confirmPassword) {
        errors.push({
            field: 'confirmPassword',
            message: 'La confirmation du mot de passe est obligatoire'
        });
    } else if (password !== confirmPassword) {
        errors.push({
            field: 'confirmPassword',
            message: 'Les mots de passe ne correspondent pas'
        });
    }

    if (errors.length > 0) {
        return res.status(422).json({
            success: false,
            message: 'Données de réinitialisation invalides',
            errors
        });
    }

    next();
};

// Validation pour mise à jour du profil
export const validateProfileUpdate = (req, res, next) => {
    const { firstName, lastName, avatar } = req.body;
    const errors = [];

    // Validation prénom (optionnel mais doit être valide si fourni)
    if (firstName !== undefined) {
        if (!firstName || !firstName.trim()) {
            errors.push({
                field: 'firstName',
                message: 'Le prénom ne peut pas être vide'
            });
        } else if (!validator.isLength(firstName.trim(), { min: 2, max: 50 })) {
            errors.push({
                field: 'firstName',
                message: 'Le prénom doit contenir entre 2 et 50 caractères'
            });
        } else if (!validator.matches(firstName.trim(), /^[a-zA-ZÀ-ÿ\s-']+$/)) {
            errors.push({
                field: 'firstName',
                message: 'Le prénom ne peut contenir que des lettres, espaces, tirets et apostrophes'
            });
        }
    }

    // Validation nom (optionnel mais doit être valide si fourni)
    if (lastName !== undefined) {
        if (!lastName || !lastName.trim()) {
            errors.push({
                field: 'lastName',
                message: 'Le nom ne peut pas être vide'
            });
        } else if (!validator.isLength(lastName.trim(), { min: 2, max: 50 })) {
            errors.push({
                field: 'lastName',
                message: 'Le nom doit contenir entre 2 et 50 caractères'
            });
        } else if (!validator.matches(lastName.trim(), /^[a-zA-ZÀ-ÿ\s-']+$/)) {
            errors.push({
                field: 'lastName',
                message: 'Le nom ne peut contenir que des lettres, espaces, tirets et apostrophes'
            });
        }
    }

    // Validation avatar (URL optionnelle)
    if (avatar !== undefined && avatar !== null && avatar !== '') {
        if (!validator.isURL(avatar, { protocols: ['http', 'https'] })) {
            errors.push({
                field: 'avatar',
                message: 'L\'URL de l\'avatar doit être valide'
            });
        }
    }

    if (errors.length > 0) {
        return res.status(422).json({
            success: false,
            message: 'Données de profil invalides',
            errors
        });
    }

    next();
};

// Validation pour changement de mot de passe
export const validatePasswordChange = (req, res, next) => {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;
    const errors = [];

    // Validation mot de passe actuel
    if (!currentPassword) {
        errors.push({
            field: 'currentPassword',
            message: 'Le mot de passe actuel est obligatoire'
        });
    }

    // Validation nouveau mot de passe
    if (!newPassword) {
        errors.push({
            field: 'newPassword',
            message: 'Le nouveau mot de passe est obligatoire'
        });
    } else {
        const passwordErrors = validatePasswordStrength(newPassword);
        errors.push(...passwordErrors.map(error => ({
            ...error,
            field: 'newPassword'
        })));
    }

    // Validation confirmation
    if (!confirmNewPassword) {
        errors.push({
            field: 'confirmNewPassword',
            message: 'La confirmation du nouveau mot de passe est obligatoire'
        });
    } else if (newPassword !== confirmNewPassword) {
        errors.push({
            field: 'confirmNewPassword',
            message: 'Les nouveaux mots de passe ne correspondent pas'
        });
    }

    // Vérifier que le nouveau mot de passe est différent
    if (currentPassword && newPassword && currentPassword === newPassword) {
        errors.push({
            field: 'newPassword',
            message: 'Le nouveau mot de passe doit être différent de l\'ancien'
        });
    }

    if (errors.length > 0) {
        return res.status(422).json({
            success: false,
            message: 'Données de changement de mot de passe invalides',
            errors
        });
    }

    next();
};

// Validation pour email de récupération
export const validateForgotPassword = (req, res, next) => {
    const { email } = req.body;
    const errors = [];

    if (!email) {
        errors.push({
            field: 'email',
            message: 'L\'email est obligatoire'
        });
    } else if (!validator.isEmail(email)) {
        errors.push({
            field: 'email',
            message: 'Format d\'email invalide'
        });
    }

    if (errors.length > 0) {
        return res.status(422).json({
            success: false,
            message: 'Email invalide',
            errors
        });
    }

    next();
};

// Fonction utilitaire pour valider la force du mot de passe
function validatePasswordStrength(password) {
    const errors = [];

    if (!validator.isLength(password, { min: 8, max: 128 })) {
        errors.push({
            field: 'password',
            message: 'Le mot de passe doit contenir entre 8 et 128 caractères'
        });
        return errors; // Pas besoin de vérifier le reste si trop court
    }

    // Vérifier la complexité
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    let complexity = 0;
    if (hasLowercase) complexity++;
    if (hasUppercase) complexity++;
    if (hasNumbers) complexity++;
    if (hasSpecialChars) complexity++;

    if (complexity < 3) {
        errors.push({
            field: 'password',
            message: 'Le mot de passe doit contenir au moins 3 des éléments suivants : minuscules, majuscules, chiffres, caractères spéciaux'
        });
    }

    // Vérifier les mots de passe trop communs
    const commonPasswords = [
        'password', 'password123', '123456', '123456789', 'qwerty',
        'abc123', 'password1', 'admin', 'letmein', 'welcome',
        'monkey', '1234567890', 'password!', 'Password1'
    ];

    if (commonPasswords.includes(password.toLowerCase())) {
        errors.push({
            field: 'password',
            message: 'Ce mot de passe est trop commun, veuillez en choisir un autre'
        });
    }

    // Vérifier les répétitions
    if (/(.)\1{2,}/.test(password)) {
        errors.push({
            field: 'password',
            message: 'Le mot de passe ne peut pas contenir plus de 2 caractères identiques consécutifs'
        });
    }

    // Vérifier les séquences
    if (hasSequentialChars(password)) {
        errors.push({
            field: 'password',
            message: 'Le mot de passe ne peut pas contenir de séquences évidentes (123, abc, etc.)'
        });
    }

    return errors;
}

// Fonction pour détecter les séquences de caractères
function hasSequentialChars(str) {
    const sequences = [
        'abcdefghijklmnopqrstuvwxyz',
        '0123456789',
        'qwertyuiop',
        'asdfghjkl',
        'zxcvbnm'
    ];

    const lowerStr = str.toLowerCase();

    for (let seq of sequences) {
        for (let i = 0; i <= seq.length - 3; i++) {
            const subseq = seq.substr(i, 3);
            const reverseSubseq = subseq.split('').reverse().join('');
            
            if (lowerStr.includes(subseq) || lowerStr.includes(reverseSubseq)) {
                return true;
            }
        }
    }

    return false;
}

// Middleware générique pour valider les paramètres d'URL
export const validateParams = (schema) => {
    return (req, res, next) => {
        const errors = [];

        Object.keys(schema).forEach(param => {
            const value = req.params[param];
            const rules = schema[param];

            if (rules.required && (!value || value.trim() === '')) {
                errors.push({
                    field: param,
                    message: `Le paramètre ${param} est obligatoire`
                });
                return;
            }

            if (value) {
                if (rules.type === 'int' && !validator.isInt(value)) {
                    errors.push({
                        field: param,
                        message: `Le paramètre ${param} doit être un entier`
                    });
                }

                if (rules.type === 'uuid' && !validator.isUUID(value)) {
                    errors.push({
                        field: param,
                        message: `Le paramètre ${param} doit être un UUID valide`
                    });
                }

                if (rules.min && value.length < rules.min) {
                    errors.push({
                        field: param,
                        message: `Le paramètre ${param} doit contenir au moins ${rules.min} caractères`
                    });
                }

                if (rules.max && value.length > rules.max) {
                    errors.push({
                        field: param,
                        message: `Le paramètre ${param} ne peut pas dépasser ${rules.max} caractères`
                    });
                }
            }
        });

        if (errors.length > 0) {
            return res.status(422).json({
                success: false,
                message: 'Paramètres invalides',
                errors
            });
        }

        next();
    };
};

// Middleware pour nettoyer et normaliser les données
export const sanitizeData = (req, res, next) => {
    // Nettoyer les chaînes de caractères
    const sanitizeString = (str) => {
        if (typeof str !== 'string') return str;
        return str.trim().replace(/\s+/g, ' '); // Supprimer espaces multiples
    };

    // Récursivement nettoyer l'objet
    const sanitizeObject = (obj) => {
        if (obj === null || typeof obj !== 'object') return obj;
        
        if (Array.isArray(obj)) {
            return obj.map(sanitizeObject);
        }

        const sanitized = {};
        for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];
                if (typeof value === 'string') {
                    sanitized[key] = sanitizeString(value);
                } else if (typeof value === 'object') {
                    sanitized[key] = sanitizeObject(value);
                } else {
                    sanitized[key] = value;
                }
            }
        }
        return sanitized;
    };

    req.body = sanitizeObject(req.body);
    req.query = sanitizeObject(req.query);
    
    next();
};
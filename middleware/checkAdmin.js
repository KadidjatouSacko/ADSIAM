// middleware/checkAdmin.js
import { User } from '../models/User.js';

export const checkAdmin = async (req, res, next) => {
    console.log('🔍 CheckAdmin - req.user:', req.user);
    console.log('🔍 CheckAdmin - req.session.userId:', req.session?.userId);
    
    let user = req.user;
    
    // Si pas d'utilisateur dans req.user mais session existe, le charger
    if (!user && req.session?.userId) {
        try {
            const dbUser = await User.findByPk(req.session.userId);
            if (dbUser) {
                user = {
                    userId: dbUser.id,
                    id: dbUser.id,
                    prenom: dbUser.prenom,
                    nom: dbUser.nom,
                    email: dbUser.email,
                    role: dbUser.role,
                    statut: dbUser.statut
                };
                console.log('✅ Utilisateur chargé depuis session:', user.role);
            }
        } catch (error) {
            console.error('Erreur chargement utilisateur:', error);
        }
    }
    
    if (!user) {
        console.log('❌ Pas d\'utilisateur trouvé');
        return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }

    if (user.role !== 'admin') {
        console.log('❌ Rôle incorrect:', user.role);
        return res.status(403).render('errors/403', {
            title: 'Accès refusé',
            message: 'Vous n\'avez pas les permissions nécessaires.',
            user: user
        });
    }

    console.log('✅ Admin autorisé:', user.email);
    req.admin = user;
    next();
};

// Middleware pour les vérifications d'autorisation spécifiques
export const checkAdminPermissions = (permission) => {
    return (req, res, next) => {
        if (!req.admin) {
            return res.status(403).json({ error: 'Non autorisé' });
        }

        // Ici vous pouvez ajouter une logique de permissions plus granulaire
        // Par exemple, vérifier des permissions spécifiques dans la base de données
        
        next();
    };
};

// Middleware pour les API admin (retourne JSON)
export const checkAdminAPI = (req, res, next) => {
    if (!req.session || !req.session.user) {
        return res.status(401).json({ error: 'Non authentifié' });
    }

    if (req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accès refusé' });
    }

    req.admin = {
        id: req.session.user.id,
        prenom: req.session.user.prenom,
        nom: req.session.user.nom,
        email: req.session.user.email
    };

    next();
};
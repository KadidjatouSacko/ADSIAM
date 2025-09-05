// middleware/checkAdmin.js
export const checkAdmin = (req, res, next) => {
    // Vérifier si l'utilisateur est connecté
    if (!req.session || !req.session.user) {
        return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
    }

    // Vérifier si l'utilisateur a le rôle admin
    if (req.session.user.role !== 'admin') {
        return res.status(403).render('errors/403', {
            title: 'Accès refusé',
            message: 'Vous n\'avez pas les permissions nécessaires pour accéder à cette page.',
            user: req.session.user
        });
    }

    // Ajouter les informations admin à la requête
    req.admin = {
        id: req.session.user.id,
        prenom: req.session.user.prenom,
        nom: req.session.user.nom,
        email: req.session.user.email
    };

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
/**
 * Middleware de vérification du rôle société
 * Vérifie que l'utilisateur connecté a le rôle 'societe'
 */

export const checkCompany = async (req, res, next) => {
    try {
        // Vérification de l'authentification
        if (!req.session?.userId) {
            req.flash('error', 'Vous devez être connecté pour accéder à cet espace.');
            return res.redirect('/auth/login');
        }

        // Vérification du rôle société
        if (!req.session.user || req.session.user.role !== 'societe') {
            req.flash('error', 'Accès réservé aux entreprises partenaires.');
            return res.redirect('/dashboard');
        }

        // Vérification du statut actif
        if (req.session.user.statut !== 'actif') {
            req.flash('warning', 'Votre compte entreprise est en attente d\'activation. Contactez notre équipe.');
            return res.redirect('/dashboard');
        }

        next();
    } catch (error) {
        console.error('Erreur middleware checkCompany:', error);
        req.flash('error', 'Erreur d\'authentification. Veuillez vous reconnecter.');
        res.redirect('/auth/login');
    }
};
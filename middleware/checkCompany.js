// middleware/checkCompany.js - Version améliorée avec gestion des statuts

import { sequelize } from '../models/index.js';

export const checkCompany = async (req, res, next) => {
    try {
        console.log('🏢 CheckCompany middleware - Vérification accès entreprise');
        
        // Vérifier si l'utilisateur est connecté
        if (!req.session?.userId) {
            console.log('❌ Utilisateur non connecté - Redirection vers login');
            req.flash('error', 'Veuillez vous connecter pour accéder à l\'espace entreprise.');
            return res.redirect('/auth/login');
        }

        // Récupérer les données utilisateur depuis la session ou la DB
        let user = req.session.user;
        
        // Si pas de données en session, les récupérer de la DB
        if (!user || !user.role) {
            console.log('🔄 Récupération des données utilisateur depuis la DB');
            const { QueryTypes } = await import('sequelize');
            
            const userData = await sequelize.query(`
                SELECT 
                    id, prenom, nom, email, role, statut, 
                    type_utilisateur, societe_rattachee,
                    CASE 
                        WHEN type_utilisateur = 'aide_domicile' THEN 'Aide à domicile'
                        WHEN type_utilisateur = 'aide_soignant' THEN 'Aide-soignant'
                        WHEN type_utilisateur = 'formateur' THEN 'Formateur'
                        WHEN role = 'societe' THEN 'Entreprise'
                        WHEN role = 'admin' THEN 'Administrateur'
                        ELSE 'Étudiant'
                    END as type_display
                FROM users 
                WHERE id = :userId
            `, {
                type: QueryTypes.SELECT,
                replacements: { userId: req.session.userId }
            });
            
            if (!userData[0]) {
                console.log('❌ Utilisateur non trouvé en DB');
                req.session.destroy();
                return res.redirect('/auth/login');
            }
            
            // Mettre à jour la session
            user = userData[0];
            req.session.user = user;
        }

        console.log(`👤 Utilisateur: ${user.prenom} ${user.nom} (Role: ${user.role}, Statut: ${user.statut})`);

        // Vérifier si l'utilisateur est une entreprise
        if (user.role !== 'societe') {
            console.log(`❌ Accès refusé - Role: ${user.role} (attendu: societe)`);
            req.flash('error', 'Accès non autorisé. Cette section est réservée aux entreprises.');
            
            // Rediriger vers le bon dashboard selon le rôle
            if (user.role === 'admin') {
                return res.redirect('/admin');
            } else {
                return res.redirect('/dashboard');
            }
        }

        // AMÉLIORATION: Gestion flexible des statuts
        switch (user.statut) {
            case 'actif':
                // Accès normal autorisé
                console.log('✅ Compte actif - Accès autorisé');
                break;
                
            case 'en_attente':
                // Accès limité avec message d'information
                console.log('⚠️ Compte en attente - Accès limité autorisé');
                req.flash('warning', 'Votre compte entreprise est en cours de validation. Certaines fonctionnalités peuvent être limitées.');
                res.locals.accountPending = true;
                break;
                
            case 'suspendu':
                console.log(`❌ Compte suspendu`);
                req.flash('error', 'Votre compte entreprise a été suspendu. Contactez notre support pour plus d\'informations.');
                return res.redirect('/auth/login');
                
            case 'inactif':
                console.log(`❌ Compte inactif`);
                req.flash('error', 'Votre compte entreprise est inactif. Contactez notre support pour le réactiver.');
                return res.redirect('/auth/login');
                
            default:
                console.log(`⚠️ Statut inconnu: ${user.statut} - Accès autorisé avec avertissement`);
                req.flash('info', 'Statut de compte non reconnu. Contactez le support si vous rencontrez des problèmes.');
                break;
        }

        // Ajouter l'utilisateur à req pour les controllers
        req.user = user;
        
        // Variables pour les vues
        res.locals.currentUser = user;
        res.locals.isCompany = true;
        res.locals.companyName = user.societe_rattachee;
        res.locals.accountStatus = user.statut;
        res.locals.canManageEmployees = user.statut === 'actif';
        res.locals.canCreateInvoices = user.statut === 'actif';
        
        console.log('✅ Accès entreprise autorisé');
        next();

    } catch (error) {
        console.error('💥 Erreur middleware checkCompany:', error);
        req.flash('error', 'Erreur lors de la vérification des permissions.');
        res.redirect('/auth/login');
    }
};
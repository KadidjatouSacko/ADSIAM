import express from 'express';
import { sequelize } from '../models/index.js';
import { QueryTypes } from 'sequelize';
import DashboardController from '../controllers/DashboardController.js';

const router = express.Router();

// ========================================
// 🛡️ MIDDLEWARE D'AUTHENTIFICATION
// ========================================

// Middleware d'authentification pour les routes protégées
const requireAuth = (req, res, next) => {
    if (!req.session?.userId) {
        req.flash('info', 'Veuillez vous connecter pour accéder à cette page.');
        return res.redirect('/auth/login');
    }
    next();
};

// Middleware pour enrichir les données utilisateur dans les vues
const enrichUserData = async (req, res, next) => {
    if (req.session?.userId) {
        try {
            const userData = await sequelize.query(`
                SELECT 
                    u.*,
                    CASE 
                        WHEN u.type_utilisateur = 'aide_domicile' THEN 'Aide à domicile'
                        WHEN u.type_utilisateur = 'aide_soignant' THEN 'Aide-soignant'
                        WHEN u.type_utilisateur = 'formateur' THEN 'Formateur'
                        ELSE 'Étudiant'
                    END as type_display
                FROM utilisateurs u 
                WHERE u.id = :userId
            `, {
                type: QueryTypes.SELECT,
                replacements: { userId: req.session.userId }
            });
            
            if (userData[0]) {
                req.session.user = userData[0];
                res.locals.currentUser = userData[0];
                res.locals.hasRole = (role) => userData[0].type_utilisateur === role;
                res.locals.isActive = () => userData[0].statut === 'actif';
            }
        } catch (error) {
            console.error('❌ Erreur enrichissement utilisateur:', error);
        }
    }
    next();
};

// ========================================
// 📊 ROUTES PRINCIPALES DU DASHBOARD
// ========================================

// Dashboard principal - remplace votre route existante dans index.js
router.get('/dashboard', requireAuth, enrichUserData, DashboardController.dashboard);

// ========================================
// 🔧 API ROUTES POUR DONNÉES DYNAMIQUES
// ========================================

// Rafraîchir les statistiques en temps réel
router.get('/api/dashboard/stats', requireAuth, DashboardController.refreshStats);

// Inscription à un événement
router.post('/api/evenements/:eventId/inscription', requireAuth, DashboardController.inscriptionEvenement);

// Récupérer les modules d'une formation
router.get('/api/formation/:formationId/modules', requireAuth, async (req, res) => {
    try {
        const { formationId } = req.params;
        const userId = req.session.userId;
        
        console.log(`🔍 Récupération modules formation ${formationId} pour utilisateur ${userId}`);
        
        const modules = await DashboardController.getModulesProgression(userId, formationId);
        res.json({ success: true, modules });
        
    } catch (error) {
        console.error('💥 Erreur modules:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// Marquer une notification comme lue
router.post('/api/notifications/:notificationId/read', requireAuth, async (req, res) => {
    try {
        const { notificationId } = req.params;
        const userId = req.session.userId;
        
        await sequelize.query(`
            UPDATE notifications 
            SET lu = true, date_lecture = NOW() 
            WHERE id = :notificationId AND user_id = :userId
        `, {
            type: QueryTypes.UPDATE,
            replacements: { notificationId, userId }
        });
        
        console.log(`✅ Notification ${notificationId} marquée comme lue pour utilisateur ${userId}`);
        res.json({ success: true });
        
    } catch (error) {
        console.error('💥 Erreur notification:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// Marquer un message comme lu
router.post('/api/messages/:messageId/read', requireAuth, async (req, res) => {
    try {
        const { messageId } = req.params;
        const userId = req.session.userId;
        
        await sequelize.query(`
            UPDATE messages 
            SET lu = true, date_lecture = NOW() 
            WHERE id = :messageId AND (destinataire_id = :userId OR receiver_id = :userId)
        `, {
            type: QueryTypes.UPDATE,
            replacements: { messageId, userId }
        });
        
        console.log(`✅ Message ${messageId} marqué comme lu pour utilisateur ${userId}`);
        res.json({ success: true });
        
    } catch (error) {
        console.error('💥 Erreur message:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// Récupérer les notifications avec pagination
router.get('/api/notifications', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        const query = `
            SELECT 
                n.*,
                CASE 
                    WHEN n.createdat >= NOW() - INTERVAL '1 day' THEN 'Aujourd''hui'
                    WHEN n.createdat >= NOW() - INTERVAL '7 days' THEN 'Cette semaine'
                    ELSE 'Plus ancienne'
                END as periode
            FROM notifications n
            WHERE n.user_id = :userId
            ORDER BY n.createdat DESC
            LIMIT :limit OFFSET :offset
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { userId, limit, offset }
        });
        
        // Compter le total
        const countResult = await sequelize.query(`
            SELECT COUNT(*) as count FROM notifications WHERE user_id = :userId
        `, {
            type: QueryTypes.SELECT,
            replacements: { userId }
        });
        
        res.json({
            success: true,
            notifications: result,
            total: parseInt(countResult[0].count),
            page,
            totalPages: Math.ceil(countResult[0].count / limit)
        });
        
    } catch (error) {
        console.error('💥 Erreur notifications:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// Recherche dans le dashboard
router.get('/api/search', requireAuth, async (req, res) => {
    try {
        const { q } = req.query;
        const userId = req.session.userId;
        
        if (!q || q.length < 2) {
            return res.json({ success: false, message: 'Terme de recherche trop court' });
        }
        
        const searchTerm = `%${q}%`;
        
        // Rechercher dans les formations
        const formationsQuery = `
            SELECT 
                f.id,
                f.titre,
                f.description,
                f.icone,
                'formation' as type
            FROM formations f
            JOIN inscriptions i ON f.id = i.formation_id
            WHERE i.user_id = :userId
            AND (f.titre ILIKE :searchTerm OR f.description ILIKE :searchTerm)
            LIMIT 5
        `;
        
        // Rechercher dans les modules
        const modulesQuery = `
            SELECT 
                m.id,
                m.titre,
                m.description,
                f.titre as formation_titre,
                'module' as type
            FROM modules m
            JOIN formations f ON m.formation_id = f.id
            JOIN inscriptions i ON f.id = i.formation_id
            WHERE i.user_id = :userId
            AND (m.titre ILIKE :searchTerm OR m.description ILIKE :searchTerm)
            LIMIT 5
        `;
        
        const [formationsResult, modulesResult] = await Promise.all([
            sequelize.query(formationsQuery, {
                type: QueryTypes.SELECT,
                replacements: { userId, searchTerm }
            }),
            sequelize.query(modulesQuery, {
                type: QueryTypes.SELECT,
                replacements: { userId, searchTerm }
            })
        ]);
        
        const results = [
            ...formationsResult,
            ...modulesResult
        ];
        
        console.log(`🔍 Recherche "${q}" - ${results.length} résultats trouvés`);
        res.json({
            success: true,
            results,
            query: q
        });
        
    } catch (error) {
        console.error('💥 Erreur recherche:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// Télécharger un certificat
router.get('/certificat/:inscriptionId/download', requireAuth, async (req, res) => {
    try {
        const { inscriptionId } = req.params;
        const userId = req.session.userId;
        
        // Vérifier que l'utilisateur a bien ce certificat
        const query = `
            SELECT 
                i.*,
                f.titre as formation_titre,
                u.prenom,
                u.nom
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            JOIN utilisateurs u ON i.user_id = u.id
            WHERE i.id = :inscriptionId 
            AND i.user_id = :userId 
            AND i.certifie = true
        `;
        
        const result = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements: { inscriptionId, userId }
        });
        
        if (result.length === 0) {
            return res.status(404).json({ error: 'Certificat introuvable' });
        }
        
        const certification = result[0];
        
        console.log(`📄 Téléchargement certificat ${inscriptionId} pour ${certification.prenom} ${certification.nom}`);
        
        // Ici vous pourriez générer un PDF avec puppeteer ou jsPDF
        // Pour l'exemple, on retourne les données du certificat
        res.json({
            success: true,
            certificat: {
                id: certification.id,
                formation: certification.formation_titre,
                etudiant: `${certification.prenom} ${certification.nom}`,
                date: certification.date_certification,
                note: certification.note_finale
            }
        });
        
    } catch (error) {
        console.error('💥 Erreur téléchargement certificat:', error);
        res.status(500).json({ success: false, error: 'Erreur serveur' });
    }
});

// ========================================
// 📄 PAGES ANNEXES DU DASHBOARD
// ========================================

// Mes Formations
router.get('/mes-formations', requireAuth, enrichUserData, (req, res) => {
    console.log('📚 Accès page Mes Formations');
    res.render('dashboard/formations', {
        title: 'Mes Formations - ADSIAM',
        layout: 'layouts/main'
    });
});

// Ma Progression
router.get('/ma-progression', requireAuth, enrichUserData, (req, res) => {
    console.log('📈 Accès page Ma Progression');
    res.render('dashboard/progression', {
        title: 'Ma Progression - ADSIAM',
        layout: 'layouts/main'
    });
});

// Mes Certifications
router.get('/mes-certifications', requireAuth, enrichUserData, (req, res) => {
    console.log('🏆 Accès page Mes Certifications');
    res.render('dashboard/certifications', {
        title: 'Mes Certifications - ADSIAM',
        layout: 'layouts/main'
    });
});

// Événements
router.get('/evenements', requireAuth, enrichUserData, (req, res) => {
    console.log('📅 Accès page Événements');
    res.render('dashboard/evenements', {
        title: 'Événements - ADSIAM',
        layout: 'layouts/main'
    });
});

// Messages
router.get('/mes-messages', requireAuth, enrichUserData, (req, res) => {
    console.log('💬 Accès page Messages');
    res.render('dashboard/messages', {
        title: 'Messages - ADSIAM',
        layout: 'layouts/main'
    });
});

// Support
router.get('/support', requireAuth, enrichUserData, (req, res) => {
    console.log('🎧 Accès page Support');
    res.render('dashboard/support', {
        title: 'Support - ADSIAM',
        layout: 'layouts/main'
    });
});

// Mon Profil
router.get('/mon-profil', requireAuth, enrichUserData, (req, res) => {
    console.log('⚙️ Accès page Mon Profil');
    res.render('dashboard/profil', {
        title: 'Mon Profil - ADSIAM',
        layout: 'layouts/main'
    });
});

// Mes Statistiques
router.get('/mes-statistiques', requireAuth, enrichUserData, (req, res) => {
    console.log('📊 Accès page Mes Statistiques');
    res.render('dashboard/statistiques', {
        title: 'Mes Statistiques - ADSIAM',
        layout: 'layouts/main'
    });
});

// Page complète des Notifications
router.get('/notifications', requireAuth, enrichUserData, (req, res) => {
    console.log('🔔 Accès page Notifications');
    res.render('dashboard/notifications', {
        title: 'Notifications - ADSIAM',
        layout: 'layouts/main'
    });
});

// ========================================
// 🎯 ROUTES SPÉCIFIQUES FORMATIONS
// ========================================

// Accès à une formation spécifique
router.get('/formation/:formationId', requireAuth, enrichUserData, async (req, res) => {
    try {
        const { formationId } = req.params;
        const userId = req.session.userId;
        
        // Vérifier que l'utilisateur est inscrit à cette formation
        const inscriptionQuery = `
            SELECT 
                i.*,
                f.titre,
                f.description,
                f.icone,
                f.nombre_modules,
                f.duree_heures
            FROM inscriptions i
            JOIN formations f ON i.formation_id = f.id
            WHERE i.user_id = :userId AND i.formation_id = :formationId
        `;
        
        const inscription = await sequelize.query(inscriptionQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId, formationId }
        });
        
        if (inscription.length === 0) {
            req.flash('error', 'Vous n\'êtes pas inscrit à cette formation');
            return res.redirect('/dashboard');
        }
        
        console.log(`🎓 Accès formation ${formationId}: ${inscription[0].titre}`);
        res.render('dashboard/formation-detail', {
            title: `${inscription[0].titre} - ADSIAM`,
            layout: 'layouts/main',
            formation: inscription[0]
        });
        
    } catch (error) {
        console.error('💥 Erreur accès formation:', error);
        req.flash('error', 'Erreur lors de l\'accès à la formation');
        res.redirect('/dashboard');
    }
});

// Accès à un module spécifique
router.get('/formation/:formationId/module/:moduleId', requireAuth, enrichUserData, async (req, res) => {
    try {
        const { formationId, moduleId } = req.params;
        const userId = req.session.userId;
        
        // Vérifier l'accès au module
        const moduleQuery = `
            SELECT 
                m.*,
                f.titre as formation_titre,
                pm.statut,
                pm.progression_pourcentage,
                -- Vérifier si le module est débloqué
                CASE 
                    WHEN m.ordre = 1 THEN true
                    WHEN EXISTS (
                        SELECT 1 FROM progressions_modules pm2 
                        JOIN modules m2 ON pm2.module_id = m2.id
                        JOIN inscriptions i2 ON pm2.inscription_id = i2.id
                        WHERE i2.user_id = :userId 
                        AND m2.formation_id = :formationId 
                        AND m2.ordre = m.ordre - 1 
                        AND pm2.statut = 'termine'
                    ) THEN true
                    ELSE false
                END as accessible
            FROM modules m
            JOIN formations f ON m.formation_id = f.id
            LEFT JOIN progressions_modules pm ON (
                pm.module_id = m.id 
                AND pm.inscription_id = (
                    SELECT id FROM inscriptions 
                    WHERE user_id = :userId AND formation_id = :formationId
                )
            )
            WHERE m.id = :moduleId AND m.formation_id = :formationId
        `;
        
        const module = await sequelize.query(moduleQuery, {
            type: QueryTypes.SELECT,
            replacements: { userId, formationId, moduleId }
        });
        
        if (module.length === 0) {
            req.flash('error', 'Module introuvable');
            return res.redirect('/dashboard');
        }
        
        if (!module[0].accessible) {
            req.flash('warning', 'Ce module n\'est pas encore accessible. Terminez d\'abord les modules précédents.');
            return res.redirect(`/formation/${formationId}`);
        }
        
        console.log(`📖 Accès module ${moduleId}: ${module[0].titre}`);
        res.render('dashboard/module-detail', {
            title: `${module[0].titre} - ADSIAM`,
            layout: 'layouts/main',
            module: module[0]
        });
        
    } catch (error) {
        console.error('💥 Erreur accès module:', error);
        req.flash('error', 'Erreur lors de l\'accès au module');
        res.redirect('/dashboard');
    }
});

// ========================================
// 📡 SERVER-SENT EVENTS POUR TEMPS RÉEL
// ========================================

// Stream des notifications en temps réel
router.get('/api/sse/notifications', requireAuth, (req, res) => {
    const userId = req.session.userId;
    
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
    });

    let intervalId;

    // Fonction pour envoyer les notifications
    const sendNotifications = async () => {
        try {
            const result = await sequelize.query(`
                SELECT COUNT(*) as count 
                FROM notifications 
                WHERE user_id = :userId AND lu = false
            `, {
                type: QueryTypes.SELECT,
                replacements: { userId }
            });
            
            const count = result[0].count;
            res.write(`data: ${JSON.stringify({ 
                type: 'notification_count', 
                count: parseInt(count) 
            })}\n\n`);
            
        } catch (error) {
            console.error('💥 Erreur SSE notifications:', error);
        }
    };

    // Envoyer immédiatement puis toutes les 30 secondes
    sendNotifications();
    intervalId = setInterval(sendNotifications, 30000);

    // Nettoyer quand la connexion se ferme
    req.on('close', () => {
        clearInterval(intervalId);
        console.log(`📡 SSE fermé pour utilisateur ${userId}`);
    });
    
    console.log(`📡 SSE ouvert pour utilisateur ${userId}`);
});

// ========================================
// ⚠️ MIDDLEWARE D'ERREUR
// ========================================

// Middleware d'erreur spécifique aux routes API
router.use('/api/*', (error, req, res, next) => {
    console.error('💥 Erreur API Dashboard:', error);
    res.status(500).json({
        success: false,
        error: 'Erreur interne du serveur',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Une erreur est survenue'
    });
});

// ========================================
// 📝 DEBUG ET LOGS
// ========================================

// Log des routes dashboard utilisées
router.use((req, res, next) => {
    if (req.originalUrl.startsWith('/dashboard') || 
        req.originalUrl.startsWith('/mes-') || 
        req.originalUrl.startsWith('/api/dashboard')) {
        console.log(`📊 Dashboard route: ${req.method} ${req.originalUrl} - User: ${req.session?.userId || 'Non connecté'}`);
    }
    next();
});

console.log('✅ Routes Dashboard chargées avec succès');




export default router;
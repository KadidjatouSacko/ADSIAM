import { User, Formation, Inscription, ProgressionModule, Evenement  } from '../models/index.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
// Afficher profil existant
export const showProfil = async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await User.findByPk(userId);
        const progressions = await ProgressionModule.findAll({ where: { user_id: userId } });

        res.render('etudiants/profil', { user, progressions, successMessage: req.flash?.('success') });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de l'affichage du profil");
    }
};

// Afficher page création
export const showCreateProfil = (req, res) => {
    res.render('etudiants/nouveauProfil', { successMessage: req.flash?.('success') });
};

// Créer un profil
export const createProfil = async (req, res) => {
    try {
        const { prenom, nom, email, telephone, date_naissance, adresse, ville, code_postal, statut_professionnel, experience, presentation } = req.body;
        const newUser = await User.create({
            prenom, nom, email, telephone, date_naissance, adresse, ville, code_postal, statut: statut_professionnel, experience, presentation
        });

        req.session.userId = newUser.id; // on peut connecter automatiquement
        req.flash?.('success', 'Profil créé avec succès !');
        res.redirect('/etudiants/profil');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de la création du profil");
    }
};

// Afficher page modification
export const showUpdateProfil = async (req, res) => {
    try {
        const userId = req.session.userId;
        const user = await User.findByPk(userId);
        res.render('etudiants/nouveauProfil', { user, successMessage: req.flash?.('success') });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de l'affichage de la modification");
    }
};

// Mettre à jour profil
export const updateProfil = async (req, res) => {
    try {
        const userId = req.session.userId;
        await User.update(req.body, { where: { id: userId } });

        req.flash?.('success', 'Modifications sauvegardées avec succès !');
        res.redirect('/etudiants/profil');
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de la mise à jour du profil");
    }
};

// Supprimer profil
export const deleteProfil = async (req, res) => {
    try {
        const userId = req.session.userId;
        await User.destroy({ where: { id: userId } });
        req.session.destroy(() => {
            res.redirect('/'); // redirige après suppression
        });
    } catch (err) {
        console.error(err);
        res.status(500).send("Erreur lors de la suppression du profil");
    }
};

export async function showDashboard(req, res) {
    try {
        // Étudiant connecté
        const userId = req.user?.id;
        if (!userId) return res.status(401).send('Utilisateur introuvable');

        // Récupérer l'utilisateur et ses données liées
        const user = await User.findByPk(userId, {
            include: [
                { 
                    model: Inscription, 
                    as: 'inscriptions',
                    include: [{ model: Formation, as: 'formation' }]
                },
                { model: Evenement, as: 'evenements' },
                { model: ProgressionModule, as: 'progressions' }
            ]
        });

        if (!user) return res.status(404).send('Utilisateur introuvable');

        // Construire les données dynamiques pour le dashboard
        const progressions = user.progressions.map(p => ({
            titre: p.moduleNom,
            progression_pourcentage: p.pourcentage,
            moduleActuel: p.moduleActuel,
            modulesTotal: p.modulesTotal,
            tempsRestant: p.tempsRestant
        }));

        const stats = [
            { label: 'Formations terminées', value: user.inscriptions.length },
            { label: 'Progression globale', value: Math.round(user.progressions.reduce((a,b)=>a+b.pourcentage,0)/user.progressions.length || 0) }
        ];

        const activites = user.activites || []; // exemple : si tu as une table activité
        const actionsRapides = user.actionsRapides || [];
        const evenements = user.evenements.map(evt => ({
            titre: evt.titre,
            jour: evt.date.getDate(),
            mois: evt.date.toLocaleString('fr-FR', { month: 'short' }),
            heure: evt.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
            lieu: evt.lieu
        }));

        res.render('etudiants/dashboard-etudiant',{
        user: { ...user.dataValues, stats, activites, actionsRapides, evenements }, 
            progressions 
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
};

export async function showFormations(req, res) {
    try {
        // Vérifier que l'utilisateur est connecté
        const userId = req.user?.id;
        if (!userId) return res.status(401).send('Utilisateur introuvable');

        // Récupérer l'étudiant avec ses inscriptions et progressions
        const user = await User.findByPk(userId, {
            include: [
                { 
                    model: Inscription, 
                    as: 'inscriptions',
                    include: [{ model: Formation, as: 'formation' }]
                },
                { model: ProgressionModule, as: 'progressions' }
            ]
        });

        if (!user) return res.status(404).send('Utilisateur introuvable');

        // Construire les données dynamiques pour chaque formation
        const formations = user.inscriptions.map(ins => {
            const f = ins.formation;
            const prog = user.progressions.find(p => p.formationId === f.id) || {};
            return {
                id: f.id,
                titre: f.titre,
                description: f.description,
                categorie: f.categorie,
                niveau: f.niveau,
                modulesTotal: f.modulesTotal,
                tempsTotal: f.tempsTotal,
                progressionPourcentage: prog.pourcentage || 0,
                moduleActuel: prog.moduleActuel || 0,
                dernierAcces: ins.dernierAcces,
                statut: ins.statut, // "completed", "in-progress", "not-started"
                certificat: ins.certificatDisponible || false
            };
        });

        // Calcul des stats globales
        const stats = {
            total: formations.length,
            terminees: formations.filter(f => f.statut === 'completed').length,
            enCours: formations.filter(f => f.statut === 'in-progress').length,
            progressionMoyenne: formations.length
                ? Math.round(formations.reduce((sum, f) => sum + f.progressionPourcentage, 0) / formations.length)
                : 0
        };

        // Renvoyer toutes les données à la vue
        res.render('etudiants/formations-etudiant', {
            user,
            formations,
            stats
        });

    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
};

export async function showMessagerie(req, res) {
    try {
        const userId = req.user?.id;
        if (!userId) return res.status(401).send('Utilisateur introuvable');

        // Récupérer l'utilisateur avec ses conversations et messages
        const user = await User.findByPk(userId, {
            include: [
                {
                    model: Conversation,
                    as: 'conversations',
                    include: [
                        { model: Message, as: 'messages', order: [['createdAt', 'ASC']] }
                    ]
                }
            ]
        });

        if (!user) return res.status(404).send('Utilisateur introuvable');

        // Calculer les stats
        const stats = {
            unreadMessages: user.conversations.reduce(
                (sum, c) => sum + c.messages.filter(m => !m.lu && m.receiverId === userId).length, 0
            ),
            activeFormateurs: [...new Set(user.conversations
                .filter(c => c.type === 'formateur')
                .map(c => c.participants.filter(p => p.role === 'formateur').map(f => f.id))
                .flat()
            )].length,
            totalConversations: user.conversations.length,
            avgResponseTime: '24h' // exemple, tu peux calculer depuis timestamps
        };

        res.render('etudiants/messagerie-etudiant', { user, conversations: user.conversations, stats });
    } catch (err) {
        console.error(err);
        res.status(500).send('Erreur serveur');
    }
};
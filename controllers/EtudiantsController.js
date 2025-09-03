import { User, ProgressionModule } from '../models/index.js';

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

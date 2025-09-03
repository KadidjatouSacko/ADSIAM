import express from 'express';
import FormationController from "../controllers/FormationController.js";

const router = express.Router();

// Routes principales
router.get('/', FormationController.accueil.bind(FormationController));
router.get('/formations', FormationController.catalogue.bind(FormationController));
router.get('/formations/:id', FormationController.detail.bind(FormationController));
router.get('/contact', FormationController.contact.bind(FormationController));
router.post('/contact', FormationController.traitementContact.bind(FormationController));

// API pour recherche (optionnel)
router.get('/api/recherche', FormationController.recherche.bind(FormationController));

// Redirections pour compatibilité
router.get('/formations/catalogue', (req, res) => res.redirect('/formations'));
router.get('/formation/:id', (req, res) => res.redirect(`/formations/${req.params.id}`));



// Dashboard etudiant//


export default router;
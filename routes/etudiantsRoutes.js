import { Router } from 'express';
import { showProfil, updateProfil, deleteProfil, createProfil } from '../controllers/EtudiantsController.js';

const router = Router();

// Middleware test si pas d'auth
const isAuthenticated = (req, res, next) => {
  req.session = req.session || {};
  req.session.userId = 1; // user test
  next();
};

// Routes CRUD profil
router.get('/etudiants/profil', isAuthenticated, showProfil);
router.post('/etudiants/profil/modifier', isAuthenticated, updateProfil);
router.post('/etudiants/profil/supprimer', isAuthenticated, deleteProfil);

// Route pour afficher le formulaire de création
router.get('/etudiant/profil/nouveau', (req, res) => {
  res.render('etudiants/nouveauProfil', { user: null, successMessage: null });
});

// Route pour traiter la création
router.post('/etudiant/profil/nouveau', createProfil);

export default router;

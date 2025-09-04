import { Router } from 'express';
import { showProfil, updateProfil, deleteProfil, createProfil, showDashboard, showFormations, showMessagerie } from '../controllers/EtudiantsController.js';
import { isStudent, ensureAuth } from '../middleware/auth.js';

const router = Router();

// Middleware test si pas d'auth
const isAuthenticated = (req, res, next) => {
  req.session = req.session || {};
  req.session.userId = 1; // user test
  next();
};

// Routes CRUD profil
router.get('/etudiants/profil', isStudent, showProfil);
router.post('/etudiants/profil/modifier', isStudent, updateProfil);
router.post('/etudiants/profil/supprimer', isStudent, deleteProfil);

// Route pour afficher le formulaire de création
router.get('/etudiant/profil/nouveau', isStudent, (req, res) => {
  res.render('etudiants/nouveauProfil', { user: null, successMessage: null });
});

// Route pour traiter la création
router.post('/etudiant/profil/nouveau', isStudent, createProfil);


//dashboard Etudiant //
router.get('/etudiant/dashboard', isStudent, showDashboard);
router.get('/etudiant/formations', isStudent, showFormations);
router.get('/messagerie', ensureAuth, showMessagerie);



export default router;

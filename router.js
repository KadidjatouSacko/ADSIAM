import express from 'express';
const router = express.Router();

// ----- VISITEURS -----
router.get('/', (req, res) => {
    res.render('Visiteurs/home', {
        title: 'Accueil',
        header: 'partials/header-visiteur',
        footer: 'partials/footer',
        currentPage: 'home'
    });
});

router.get('/formations', (req, res) => {
    res.render('Visiteurs/formations', {
        title: 'Formations',
        header: 'partials/header-visiteur',
        footer: 'partials/footer',
        currentPage: 'formations'
    });
});

router.get('/formation/:id', (req, res) => {
    res.render('Visiteurs/formation', {
        title: 'Formation',
        header: 'partials/header-visiteur',
        footer: 'partials/footer',
        currentPage: 'formations'
    });
});

router.get('/contact', (req, res) => {
    res.render('Visiteurs/contact', {
        title: 'Contact',
        header: 'partials/header-visiteur',
        footer: 'partials/footer',
        currentPage: 'contact'
    });
});

// ----- ETUDIANTS -----
router.get('/etudiant/dashboard', (req, res) => {
    res.render('Etudiants/dashboard-etudiant', {
        title: 'Tableau de bord',
        header: 'partials/header-etudiant',
        footer: 'partials/footer',
        currentPage: 'dashboard'
    });
});

router.get('/etudiant/formations', (req, res) => {
    res.render('Etudiants/formations-etudiant', {
        title: 'Mes formations',
        header: 'partials/header-etudiant',
        footer: 'partials/footer',
        currentPage: 'formations'
    });
});

router.get('/etudiant/planning', (req, res) => {
    res.render('Etudiants/planning-calendrier', {
        title: 'Planning',
        header: 'partials/header-etudiant',
        footer: 'partials/footer',
        currentPage: 'planning'
    });
});

router.get('/etudiant/profil', (req, res) => {
    res.render('Etudiants/profil', {
        title: 'Profil',
        header: 'partials/header-etudiant',
        footer: 'partials/footer',
        currentPage: 'profil'
    });
});

export default router;

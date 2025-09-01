import express from 'express';
const router = express.Router();

// ----- VISITEURS -----
router.get('/', (req, res) => {
    res.render('Visiteurs/home', {
        title: 'ADSIAM | Formation Excellence Aide à Domicile & EHPAD',
        header: 'partials/header',
        footer: 'partials/footer',
        currentPage: 'home'
    });
});

router.get('/formations', (req, res) => {
    res.render('Visiteurs/formations', {
        title: 'Catalogue Formations | ADSIAM - Aide à Domicile & EHPAD',
        header: 'partials/header',
        footer: 'partials/footer',
        currentPage: 'formations'
    });
});

router.get('/formation/:slug', (req, res) => {
    res.render('Visiteurs/formation', {
        title: 'Formation + :slug',
        header: 'partials/header',
        footer: 'partials/footer',
        currentPage: 'formations'
    });
});

router.get('/contact', (req, res) => {
    res.render('Visiteurs/contact', {
        title: 'Contact & Support | ADSIAM+ - Nous sommes là pour vous aider',
        header: 'partials/header',
        footer: 'partials/footer',
        currentPage: 'contact'
    });
});

// ----- ETUDIANTS -----
router.get('/etudiant/dashboard', (req, res) => {
    res.render('Etudiants/dashboard-etudiant', {
        title: 'Tableau de Bord | ADSIAM Formations',
        header: 'partials/header-etudiant',
        footer: 'partials/footer',
        currentPage: 'dashboard'
    });
});

router.get('/etudiant/formations', (req, res) => {
    res.render('Etudiants/formations-etudiant', {
        title: 'Mes Formations | ADSIAM Étudiant',
        header: 'partials/header-etudiant',
        footer: 'partials/footer',
        currentPage: 'formations'
    });
});

router.get('/etudiant/planning', (req, res) => {
    res.render('Etudiants/planning-calendrier', {
        title: 'Planning & Calendrier | ADSIAM Étudiant',
        header: 'partials/header-etudiant',
        footer: 'partials/footer',
        currentPage: 'planning'
    });
});

router.get('/etudiant/profil', (req, res) => {
    res.render('Etudiants/profil', {
        title: 'Mon Profil | ADSIAM Étudiant',
        header: 'partials/header-etudiant',
        footer: 'partials/footer',
        currentPage: 'profil'
    });
});

export default router;

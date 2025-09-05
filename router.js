// import express from 'express';
// import FormationController from './controllers/FormationController.js';

// const router = express.Router();

// // ----- VISITEURS -----
// router.get('/', (req, res) => {
//     res.render('Visiteurs/home', {
//         title: 'ADSIAM | Formation Excellence Aide à Domicile & EHPAD',
//         header: 'partials/header',
//         footer: 'partials/footer',
//         currentPage: 'home'
//     });
// });

// router.get('/formations', (req, res) => {
//     res.render('Visiteurs/formations', {
//         title: 'Catalogue Formations | ADSIAM - Aide à Domicile & EHPAD',
//         header: 'partials/header',
//         footer: 'partials/footer',
//         currentPage: 'formations'
//     });
// });

// router.get('/formation/:slug', (req, res) => {
//     res.render('Visiteurs/formation', {
//         title: 'Formation + :slug',
//         header: 'partials/header',
//         footer: 'partials/footer',
//         currentPage: 'formations'
//     });
// });

// router.get('/contact', (req, res) => {
//     res.render('Visiteurs/contact', {
//         title: 'Contact & Support | ADSIAM+ - Nous sommes là pour vous aider',
//         header: 'partials/header',
//         footer: 'partials/footer',
//         currentPage: 'contact'
//     });
// });

// // ----- ETUDIANTS -----
// router.get('/etudiant/dashboard', (req, res) => {
//     res.render('Etudiants/dashboard-etudiant', {
//         title: 'Tableau de Bord | ADSIAM Formations',
//         currentPage: 'dashboard'
//     });
// });

// router.get('/etudiant/formations', (req, res) => {
//     res.render('Etudiants/formations-etudiant', {
//         title: 'Mes Formations | ADSIAM Étudiant',
//         currentPage: 'formations'
//     });
// });

// router.get('/etudiant/planning', (req, res) => {
//     res.render('Etudiants/planning-calendrier', {
//         title: 'Planning & Calendrier | ADSIAM Étudiant',
//         currentPage: 'planning'
//     });
// });

// router.get('/etudiant/profil', (req, res) => {
//     res.render('Etudiants/profil', {
//         title: 'Mon Profil | ADSIAM Étudiant',
//         header: 'partials/header-etudiant',
//         footer: 'partials/footer',
//         currentPage: 'profil'
//     });
// });


// // ----- ENTREPRISES -----
// router.get('/entreprise/dashboard', (req, res) => {
//     res.render('entreprises/dashboard-entreprise', {
//         title: 'Tableau de Bord | ADSIAM Entreprise',
//         header: 'partials/header', // ou header spécifique si tu veux en créer un
//         footer: 'partials/footer',
//         currentPage: 'dashboard-entreprise'
//     });
// });

// router.get('/entreprise/inscription', (req, res) => {
//     res.render('entreprises/inscription-entreprise', {
//         title: 'Inscription | ADSIAM Entreprise',
//         header: 'partials/header',
//         footer: 'partials/footer',
//         currentPage: 'inscription-entreprise'
//     });
// });

// router.get('/entreprise/salaries', (req, res) => {
//     res.render('entreprises/salaries-entreprise', {
//         title: 'Gestion des Salariés | ADSIAM Entreprise',
//         header: 'partials/header',
//         footer: 'partials/footer',
//         currentPage: 'salaries-entreprise'
//     });
// });

// router.get('/entreprise/facturation', (req, res) => {
//     res.render('entreprises/facturation-entreprise', {
//         title: 'Facturation | ADSIAM Entreprise',
//         header: 'partials/header',
//         footer: 'partials/footer',
//         currentPage: 'facturation-entreprise'
//     });
// });

// router.get('/entreprise/rapport-formation', (req, res) => {
//     res.render('entreprises/rapport-formation-entreprise', {
//         title: 'Rapports de Formation | ADSIAM Entreprise',
//         header: 'partials/header',
//         footer: 'partials/footer',
//         currentPage: 'rapport-formation-entreprise'
//     });
// });

// // ...dans router.js...
// router.get('/entreprise/catalogue', (req, res) => {
//     res.render('entreprises/catalogue-formations');
// });
// router.get('/entreprise/formations-en-cours', (req, res) => {
//     res.render('entreprises/formations-en-cours');
// });
// router.get('/entreprise/certifications', (req, res) => {
//     res.render('entreprises/certifications');
// });
// router.get('/entreprise/support', (req, res) => {
//     res.render('entreprises/support');
// });
// router.get('/entreprise/centre-aide', (req, res) => {
//     res.render('entreprises/centre-aide');
// });

// router.get('/etudiant/progression', (req, res) => {
//     res.render('etudiants/progression-etudiant');
// });

// router.get('/etudiant/messagerie', (req, res) => {
//     res.render('etudiants/messagerie-etudiant');
// });

// // ----- SALARIÉS -----
// router.get('/salarie/dashboard', (req, res) => {
//     res.render('salaries/dashboard-salarie', {
//         title: 'Tableau de Bord | ADSIAM Salarié',
//         header: 'partials/header-salarie', // tu peux créer un header spécifique salarié si besoin
//         footer: 'partials/footer',
//         currentPage: 'dashboard',
//         css: '/css/dashboard-salarie.css' // si tu veux un css spécifique
//     });
// });


// // // Routes principales
// // router.get('/', FormationController.accueil.bind(FormationController));
// // router.get('/formations', FormationController.catalogue.bind(FormationController));
// router.get('/formations/:id', FormationController.detail.bind(FormationController));
// // router.get('/contact', FormationController.contact.bind(FormationController));
// // router.post('/contact', FormationController.traitementContact.bind(FormationController));

// // // API pour recherche (optionnel)
// // router.get('/api/recherche', FormationController.recherche.bind(FormationController));

// // // Redirections pour compatibilité
// // router.get('/formations/catalogue', (req, res) => res.redirect('/formations'));
// // router.get('/formation/:id', (req, res) => res.redirect(`/formations/${req.params.id}`));

// export default router;

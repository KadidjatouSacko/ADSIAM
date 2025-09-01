import express from "express";
const router = express.Router();

router.get("/", (req, res) => res.redirect("/accueil"));

// ---------------------- VISITEURS ---------------------- //
router.get("/accueil", (req, res) => res.render("Visiteurs/home"));
router.get("/formations", (req, res) => res.render("Visiteurs/formations"));
router.get("/formation", (req, res) => res.render("Visiteurs/formation"));
router.get("/contact", (req, res) => res.render("Visiteurs/contact"));

// ---------------------- ÉTUDIANTS ---------------------- //
router.get("/etudiant/dashboard", (req, res) => res.render("etudiants/dashboard-etudiant"));
router.get("/etudiant/formations", (req, res) => res.render("etudiants/formations-etudiant"));
router.get("/etudiant/planning", (req, res) => res.render("etudiants/planning-calendrier"));
router.get("/etudiant/profil", (req, res) => res.render("etudiants/profil"));

export default router;

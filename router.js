import express from "express";
const router = express.Router();

// Exemple route page d’accueil
router.get("/", (req, res) => {
  res.render("index", { title: "Accueil" });
});

export default router;

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import router from "./router.js";
import { sequelize } from "./config/database.js";
import dotenv from 'dotenv';


const app = express();
const PORT = process.env.PORT || 3000;

// Pour avoir __dirname avec ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config(); // charge les variables du .env

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, "public")));

// View engine (EJS)
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Routes
app.use("/", router);

// Test DB connection & start server
sequelize.authenticate()
  .then(() => {
    console.log("✅ Connecté à PostgreSQL avec Sequelize");
    app.listen(PORT, () => {
      console.log(`🚀 Serveur lancé sur http://localhost:${PORT}`);
    });
  })
  .catch(err => {
    console.error("❌ Erreur de connexion à la base :", err);
  });

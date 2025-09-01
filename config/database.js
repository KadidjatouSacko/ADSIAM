import { Sequelize } from "sequelize";

export const sequelize = new Sequelize(
  "nom_de_ta_base",   // nom BDD
  "ton_utilisateur",  // utilisateur
  "ton_mot_de_passe", // mot de passe
  {
    host: "localhost",
    dialect: "postgres",
    logging: false
  }
);

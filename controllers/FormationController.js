// controllers/FormationController.js
import { Formation, Module, Caracteristique, Avis } from '../models/index.js';
import { Op } from 'sequelize';

class FormationController {
  
  // Page d'accueil avec formations populaires
  async accueil(req, res) {
    try {
      const formations = await Formation.findAll({
        include: [
          { model: Caracteristique, as: 'caracteristiques' },
          { model: Avis, as: 'avis' }
        ],
        where: { actif: true },
        limit: 6,
        order: [['populaire', 'DESC'], ['createdAt', 'DESC']]
      });

      // Calculer les stats
      const stats = {
        totalFormations: await Formation.count({ where: { actif: true } }),
        totalModules: await Module.count(),
        professionnelsFormes: 2847,
        tauxSatisfaction: 97
      };

      // Calculer la note moyenne pour chaque formation
      formations.forEach(formation => {
        if (formation.avis?.length > 0) {
          const totalNotes = formation.avis.reduce((sum, avis) => sum + avis.note, 0);
          formation.dataValues.noteMoyenne = (totalNotes / formation.avis.length).toFixed(1);
          formation.dataValues.nombreAvis = formation.avis.length;
        } else {
          formation.dataValues.noteMoyenne = 0;
          formation.dataValues.nombreAvis = 0;
        }
      });

      res.render('visiteurs/home', { formations, stats });
    } catch (error) {
      console.error('Erreur accueil:', error);
      res.status(500).render('error', { message: 'Erreur serveur' });
    }
  }

  // Catalogue des formations avec filtres
  async catalogue(req, res) {
    try {
      const { 
        niveau, 
        duree, 
        prix, 
        domaine, 
        recherche,
        page = 1,
        tri = 'populaire'
      } = req.query;

      // Construire les filtres
      const where = { actif: true };
      
      if (niveau) where.niveau = niveau;
      if (domaine) where.domaine = domaine;
      if (prix === 'gratuit') where.gratuit = true;
      if (prix === 'payant') where.gratuit = false;
      
      if (recherche) {
        where[Op.or] = [
          { titre: { [Op.iLike]: `%${recherche}%` } },
          { description: { [Op.iLike]: `%${recherche}%` } }
        ];
      }

      // Gestion de la durée
      if (duree === 'courte') where.nombre_modules = { [Op.lte]: 3 };
      if (duree === 'moyenne') where.nombre_modules = { [Op.between]: [4, 6] };
      if (duree === 'longue') where.nombre_modules = { [Op.gte]: 7 };

      // Configuration du tri
      const orderMap = {
        'populaire': [['populaire', 'DESC']],
        'prix_croissant': [['prix', 'ASC']],
        'prix_decroissant': [['prix', 'DESC']],
        'niveau': [['niveau', 'ASC']],
        'duree': [['duree_heures', 'ASC']]
      };

      const order = orderMap[tri] || [['populaire', 'DESC']];

      const limit = 9;
      const offset = (parseInt(page) - 1) * limit;

      const { count, rows: formations } = await Formation.findAndCountAll({
        where,
        include: [
          { model: Caracteristique, as: 'caracteristiques' },
          { 
            model: Avis, 
            as: 'avis',
            attributes: ['note'],
            separate: true
          }
        ],
        order,
        limit,
        offset
      });

      // Calculer les moyennes et stats
      formations.forEach(formation => {
        if (formation.avis?.length > 0) {
          const totalNotes = formation.avis.reduce((sum, avis) => sum + avis.note, 0);
          formation.dataValues.noteMoyenne = (totalNotes / formation.avis.length).toFixed(1);
          formation.dataValues.nombreAvis = formation.avis.length;
        } else {
          formation.dataValues.noteMoyenne = 0;
          formation.dataValues.nombreAvis = 0;
        }
      });

      const totalPages = Math.ceil(count / limit);

      res.render('visiteurs/formations', { 
        formations, 
        filtres: { niveau, duree, prix, domaine, recherche, tri },
        pagination: {
          page: parseInt(page),
          totalPages,
          totalFormations: count
        }
      });
    } catch (error) {
      console.error('Erreur catalogue:', error);
      res.status(500).render('error', { message: 'Erreur serveur' });
    }
  }

  // Détail d'une formation
async detail(req, res) {
  try {
    const { id } = req.params;

    const formation = await Formation.findByPk(id, {
      include: [
        { 
          model: Module, 
          as: 'modules',
          order: [['ordre', 'ASC']] // Tri des modules
        },
        { 
          model: Caracteristique, 
          as: 'caracteristiques' 
        },
        { 
          model: Avis, 
          as: 'avis',
          separate: true,       // Nécessaire pour limit + order
          limit: 10,
          order: [['createdat', 'DESC']] // ← Utilise le nom exact de colonne dans ta table
        }
      ]
    });

    if (!formation || !formation.actif) {
      return res.status(404).render('error', { 
        message: 'Formation non trouvée',
        error: { status: 404 }
      });
    }

    // Calculer la note moyenne
    if (formation.avis?.length > 0) {
      const totalNotes = formation.avis.reduce((sum, avis) => sum + avis.note, 0);
      formation.dataValues.noteMoyenne = (totalNotes / formation.avis.length).toFixed(1);
      formation.dataValues.nombreAvis = formation.avis.length;
    } else {
      formation.dataValues.noteMoyenne = 0;
      formation.dataValues.nombreAvis = 0;
    }

    // Formations similaires
    const formationsSimilaires = await Formation.findAll({
      where: {
        domaine: formation.domaine,
        id: { [Op.ne]: formation.id },
        actif: true
      },
      limit: 3,
      include: [
        { 
          model: Avis, 
          as: 'avis',
          separate: true,
          limit: 10,
          order: [['createdat', 'DESC']]
        }
      ]
    });

    // Calculer les moyennes pour les formations similaires
    formationsSimilaires.forEach(f => {
      if (f.avis?.length > 0) {
        const totalNotes = f.avis.reduce((sum, avis) => sum + avis.note, 0);
        f.dataValues.noteMoyenne = (totalNotes / f.avis.length).toFixed(1);
        f.dataValues.nombreAvis = f.avis.length;
      } else {
        f.dataValues.noteMoyenne = 0;
        f.dataValues.nombreAvis = 0;
      }
    });

    res.render('visiteurs/formation', { formation, formationsSimilaires });
  } catch (error) {
    console.error('Erreur détail formation:', error);
    res.status(500).render('error', { message: 'Erreur serveur' });
  }
}




  // Page de contact
  async contact(req, res) {
    try {
      const { success, error } = req.query;
      res.render('visiteurs/contact', { success, error });
    } catch (error) {
      console.error('Erreur page contact:', error);
      res.status(500).render('error', { message: 'Erreur serveur' });
    }
  }

  // Traitement du formulaire de contact
  async traitementContact(req, res) {
    try {
      const { firstName, lastName, email, phone, subject, message } = req.body;
      
      // Validation basique
      if (!firstName || !lastName || !email || !subject || !message) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ 
            success: false, 
            message: 'Tous les champs obligatoires doivent être remplis' 
          });
        }
        return res.redirect('/contact?error=missing_fields');
      }

      // Ici vous pourriez sauvegarder en BDD ou envoyer un email
      console.log('📧 Nouveau message de contact:', {
        firstName, lastName, email, phone, subject, message,
        timestamp: new Date().toISOString()
      });

      // Simulation d'un traitement (email, etc.)
      await new Promise(resolve => setTimeout(resolve, 100));

      // Réponse selon le type de requête
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ 
          success: true, 
          message: 'Message envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.' 
        });
      }

      res.redirect('/contact?success=1');
    } catch (error) {
      console.error('Erreur traitement contact:', error);
      
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erreur lors de l\'envoi du message' 
        });
      }
      
      res.redirect('/contact?error=1');
    }
  }

  // API pour recherche en temps réel (optionnel)
  async recherche(req, res) {
    try {
      const { q } = req.query;
      
      if (!q || q.length < 2) {
        return res.json([]);
      }

      const formations = await Formation.findAll({
        where: {
          [Op.and]: [
            { actif: true },
            {
              [Op.or]: [
                { titre: { [Op.iLike]: `%${q}%` } },
                { description: { [Op.iLike]: `%${q}%` } }
              ]
            }
          ]
        },
        limit: 5,
        attributes: ['id', 'titre', 'icone', 'prix', 'gratuit']
      });

      res.json(formations);
    } catch (error) {
      console.error('Erreur recherche:', error);
      res.status(500).json({ error: 'Erreur de recherche' });
    }
  }
}

export default new FormationController();
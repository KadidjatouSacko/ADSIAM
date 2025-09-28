// controllers/FormationController.js - Version complète et optimisée
import { Formation, Module, Caracteristique, Avis, Inscription, User } from '../models/index.js';
import { Op } from 'sequelize';

class FormationController {
  
  // Page d'accueil avec formations populaires
  async accueil(req, res) {
    try {
      console.log('🏠 Chargement page d\'accueil');

      // Récupérer les formations populaires avec toutes les données nécessaires
      const formations = await Formation.findAll({
        include: [
          { 
            model: Caracteristique, 
            as: 'caracteristiques',
            limit: 4 // Limiter pour éviter trop de données
          },
          { 
            model: Avis, 
            as: 'avis',
            attributes: ['note'],
            separate: true,
            limit: 100 // Pour calculer la moyenne
          },
          {
            model: Inscription,
            as: 'inscriptions',
            attributes: ['id'],
            separate: true
          }
        ],
        where: { actif: true },
        limit: 6,
        order: [
          ['populaire', 'DESC'], 
          ['createdAt', 'DESC']
        ]
      });

      // Calculer les statistiques globales
      const [totalFormations, totalModules, totalInscriptions] = await Promise.all([
        Formation.count({ where: { actif: true } }),
        Module.count(),
        Inscription.count()
      ]);

      const stats = {
        totalFormations,
        totalModules,
        professionnelsFormes: totalInscriptions > 0 ? totalInscriptions : 2847,
        tauxSatisfaction: 97
      };

      // Enrichir chaque formation avec ses statistiques
      const formationsEnrichies = formations.map(formation => {
        const formationData = formation.toJSON();
        
        // Calculer la note moyenne
        if (formationData.avis && formationData.avis.length > 0) {
          const totalNotes = formationData.avis.reduce((sum, avis) => sum + avis.note, 0);
          formationData.noteMoyenne = (totalNotes / formationData.avis.length).toFixed(1);
          formationData.nombreAvis = formationData.avis.length;
        } else {
          formationData.noteMoyenne = 0;
          formationData.nombreAvis = 0;
        }

        // Nombre d'inscriptions
        formationData.nombreInscriptions = formationData.inscriptions ? formationData.inscriptions.length : 0;

        return formationData;
      });

      console.log(`✅ ${formationsEnrichies.length} formations chargées pour l'accueil`);

      res.render('visiteurs/home', { 
        formations: formationsEnrichies, 
        stats,
        title: 'ADSIAM - Formation Excellence Aide à Domicile & EHPAD'
      });

    } catch (error) {
      console.error('❌ Erreur accueil:', error);
      res.status(500).render('error', { 
        message: 'Erreur lors du chargement de la page d\'accueil',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  }

  // Catalogue des formations avec filtres avancés
  async catalogue(req, res) {
    try {
      console.log('📚 Chargement catalogue avec filtres:', req.query);

      const { 
        niveau, 
        duree, 
        prix, 
        domaine, 
        recherche,
        page = 1,
        tri = 'populaire',
        limit = 9
      } = req.query;

      // Construction des filtres WHERE
      const where = { actif: true };
      
      if (niveau) where.niveau = niveau;
      if (domaine) where.domaine = domaine;
      
      // Gestion des filtres de prix
      if (prix === 'gratuit') {
        where.gratuit = true;
      } else if (prix === 'payant') {
        where.gratuit = false;
      } else if (prix === 'moins50') {
        where.prix = { [Op.lt]: 50 };
        where.gratuit = false;
      } else if (prix === '50-100') {
        where.prix = { [Op.between]: [50, 100] };
        where.gratuit = false;
      }
      
      // Recherche textuelle
      if (recherche && recherche.trim()) {
        where[Op.or] = [
          { titre: { [Op.iLike]: `%${recherche.trim()}%` } },
          { description: { [Op.iLike]: `%${recherche.trim()}%` } }
        ];
      }

      // Gestion de la durée par nombre de modules
      if (duree === 'courte') {
        where.nombre_modules = { [Op.lte]: 3 };
      } else if (duree === 'moyenne') {
        where.nombre_modules = { [Op.between]: [4, 6] };
      } else if (duree === 'longue') {
        where.nombre_modules = { [Op.gte]: 7 };
      }

      // Configuration du tri
      const orderMap = {
        'populaire': [['populaire', 'DESC'], ['createdAt', 'DESC']],
        'prix_croissant': [['gratuit', 'DESC'], ['prix', 'ASC']],
        'prix_decroissant': [['gratuit', 'ASC'], ['prix', 'DESC']],
        'niveau': [['niveau', 'ASC'], ['titre', 'ASC']],
        'duree': [['duree_heures', 'ASC'], ['titre', 'ASC']],
        'recent': [['createdAt', 'DESC']],
        'alphabetique': [['titre', 'ASC']]
      };

      const order = orderMap[tri] || orderMap['populaire'];
      const offset = (parseInt(page) - 1) * parseInt(limit);

      // Requête principale avec pagination
      const { count, rows: formations } = await Formation.findAndCountAll({
        where,
        include: [
          { 
            model: Caracteristique, 
            as: 'caracteristiques',
            limit: 3
          },
          { 
            model: Avis, 
            as: 'avis',
            attributes: ['note'],
            separate: true,
            limit: 50
          }
        ],
        order,
        limit: parseInt(limit),
        offset,
        distinct: true // Important pour le count avec les includes
      });

      // Enrichir les formations avec les moyennes
      const formationsEnrichies = formations.map(formation => {
        const formationData = formation.toJSON();
        
        if (formationData.avis && formationData.avis.length > 0) {
          const totalNotes = formationData.avis.reduce((sum, avis) => sum + avis.note, 0);
          formationData.noteMoyenne = (totalNotes / formationData.avis.length).toFixed(1);
          formationData.nombreAvis = formationData.avis.length;
        } else {
          formationData.noteMoyenne = 0;
          formationData.nombreAvis = 0;
        }

        return formationData;
      });

      const totalPages = Math.ceil(count / parseInt(limit));

      console.log(`✅ Catalogue: ${formations.length}/${count} formations trouvées`);

      res.render('visiteurs/formations', { 
        formations: formationsEnrichies, 
        filtres: { niveau, duree, prix, domaine, recherche, tri },
        pagination: {
          page: parseInt(page),
          totalPages,
          totalFormations: count,
          hasNext: parseInt(page) < totalPages,
          hasPrev: parseInt(page) > 1,
          limit: parseInt(limit)
        },
        title: 'Catalogue des formations - ADSIAM'
      });

    } catch (error) {
      console.error('❌ Erreur catalogue:', error);
      res.status(500).render('error', { 
        message: 'Erreur lors du chargement du catalogue',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  }

  // Détail d'une formation avec toutes les informations
  async detail(req, res) {
    try {
      const { id } = req.params;
      console.log(`🔍 Chargement détail formation ID: ${id}`);

      // Vérifier que l'ID est un nombre valide
      if (!id || isNaN(parseInt(id))) {
        return res.status(404).render('errors/404', { 
          message: 'Formation non trouvée',
          title: 'Formation non trouvée - ADSIAM'
        });
      }

      const formation = await Formation.findByPk(id, {
        include: [
          { 
            model: Module, 
            as: 'modules',
            order: [['ordre', 'ASC']],
            separate: true
          },
          { 
            model: Caracteristique, 
            as: 'caracteristiques',
            separate: true
          },
          { 
            model: Avis, 
            as: 'avis',
            separate: true,
            limit: 10,
            order: [['createdat', 'DESC']],
            where: { verifie: true }, // Seulement les avis vérifiés
            required: false
          }
        ]
      });

      if (!formation || !formation.actif) {
        return res.status(404).render('errors/404', { 
          message: 'Formation non trouvée ou non disponible',
          title: 'Formation non trouvée - ADSIAM'
        });
      }

      // Calculer la note moyenne et le nombre d'avis
      if (formation.avis && formation.avis.length > 0) {
        const totalNotes = formation.avis.reduce((sum, avis) => sum + avis.note, 0);
        formation.dataValues.noteMoyenne = (totalNotes / formation.avis.length).toFixed(1);
        formation.dataValues.nombreAvis = formation.avis.length;
      } else {
        formation.dataValues.noteMoyenne = 0;
        formation.dataValues.nombreAvis = 0;
      }

      // Récupérer les formations similaires (même domaine, différent ID)
      const formationsSimilaires = await Formation.findAll({
        where: {
          domaine: formation.domaine,
          id: { [Op.ne]: formation.id },
          actif: true
        },
        include: [
          { 
            model: Avis, 
            as: 'avis',
            attributes: ['note'],
            separate: true,
            limit: 20
          }
        ],
        limit: 3,
        order: [['populaire', 'DESC'], ['createdAt', 'DESC']]
      });

      // Enrichir les formations similaires
      formationsSimilaires.forEach(f => {
        if (f.avis && f.avis.length > 0) {
          const totalNotes = f.avis.reduce((sum, avis) => sum + avis.note, 0);
          f.dataValues.noteMoyenne = (totalNotes / f.avis.length).toFixed(1);
          f.dataValues.nombreAvis = f.avis.length;
        } else {
          f.dataValues.noteMoyenne = 0;
          f.dataValues.nombreAvis = 0;
        }
      });

      console.log(`✅ Formation "${formation.titre}" chargée avec ${formation.modules.length} modules`);

      res.render('visiteurs/formation', { 
        formation, 
        formationsSimilaires,
        title: `${formation.titre} - Formation ADSIAM`
      });

    } catch (error) {
      console.error('❌ Erreur détail formation:', error);
      res.status(500).render('error', { 
        message: 'Erreur lors du chargement de la formation',
        error: process.env.NODE_ENV === 'development' ? error : {}
      });
    }
  }

  // Page de contact
  async contact(req, res) {
    try {
      const { success, error } = req.query;
      
      res.render('visiteurs/contact', { 
        success: success === '1',
        error: error === '1',
        title: 'Contact - ADSIAM'
      });
    } catch (error) {
      console.error('❌ Erreur page contact:', error);
      res.status(500).render('error', { message: 'Erreur serveur' });
    }
  }

  // Traitement du formulaire de contact amélioré
  async traitementContact(req, res) {
    try {
      const { 
        firstName, 
        lastName, 
        email, 
        phone, 
        subject, 
        message,
        files // Si des fichiers sont uploadés
      } = req.body;
      
      console.log('📧 Nouveau message de contact:', { firstName, lastName, email, subject });

      // Validation renforcée
      const errors = [];
      
      if (!firstName || firstName.trim().length < 2) {
        errors.push('Le prénom doit contenir au moins 2 caractères');
      }
      
      if (!lastName || lastName.trim().length < 2) {
        errors.push('Le nom doit contenir au moins 2 caractères');
      }
      
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push('L\'email n\'est pas valide');
      }
      
      if (!subject) {
        errors.push('Le sujet est requis');
      }
      
      if (!message || message.trim().length < 10) {
        errors.push('Le message doit contenir au moins 10 caractères');
      }

      if (errors.length > 0) {
        if (req.xhr || req.headers.accept?.includes('application/json')) {
          return res.status(400).json({ 
            success: false, 
            message: 'Erreurs de validation',
            errors
          });
        }
        return res.redirect('/contact?error=validation');
      }

      // Simulation d'envoi d'email (à remplacer par votre service d'email)
      const emailData = {
        from: email,
        to: 'contact@adsiam.fr',
        subject: `[ADSIAM Contact] ${subject}`,
        html: `
          <h2>Nouveau message de contact</h2>
          <p><strong>Nom:</strong> ${firstName} ${lastName}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Téléphone:</strong> ${phone || 'Non renseigné'}</p>
          <p><strong>Sujet:</strong> ${subject}</p>
          <p><strong>Message:</strong></p>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <p><em>Envoyé depuis le site ADSIAM le ${new Date().toLocaleString('fr-FR')}</em></p>
        `,
        timestamp: new Date().toISOString()
      };

      // TODO: Intégrer avec votre service d'email (Nodemailer, SendGrid, etc.)
      console.log('📧 Email à envoyer:', emailData);

      // Simulation d'un délai d'envoi
      await new Promise(resolve => setTimeout(resolve, 200));

      // Optionnel: Sauvegarder en base de données
      /*
      await Message.create({
        expediteur_nom: `${firstName} ${lastName}`,
        expediteur_email: email,
        expediteur_telephone: phone,
        sujet: subject,
        contenu: message,
        type_message: 'contact',
        statut: 'nouveau'
      });
      */

      // Réponse selon le type de requête
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.json({ 
          success: true, 
          message: 'Message envoyé avec succès ! Nous vous répondrons dans les plus brefs délais.' 
        });
      }

      res.redirect('/contact?success=1');

    } catch (error) {
      console.error('❌ Erreur traitement contact:', error);
      
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(500).json({ 
          success: false, 
          message: 'Erreur lors de l\'envoi du message. Veuillez réessayer.' 
        });
      }
      
      res.redirect('/contact?error=1');
    }
  }

  // API pour recherche en temps réel optimisée
  async recherche(req, res) {
    try {
      const { q, limit = 5 } = req.query;
      
      if (!q || q.trim().length < 2) {
        return res.json({ success: true, formations: [] });
      }

      const searchTerm = q.trim();
      console.log(`🔍 Recherche: "${searchTerm}"`);

      const formations = await Formation.findAll({
        where: {
          [Op.and]: [
            { actif: true },
            {
              [Op.or]: [
                { titre: { [Op.iLike]: `%${searchTerm}%` } },
                { description: { [Op.iLike]: `%${searchTerm}%` } },
                { domaine: { [Op.iLike]: `%${searchTerm}%` } }
              ]
            }
          ]
        },
        attributes: ['id', 'titre', 'icone', 'prix', 'gratuit', 'domaine', 'niveau'],
        limit: parseInt(limit),
        order: [
          ['populaire', 'DESC'],
          ['titre', 'ASC']
        ]
      });

      // Enrichir avec des informations supplémentaires
      const formationsEnrichies = formations.map(f => ({
        ...f.toJSON(),
        url: `/formations/${f.id}`,
        prixFormate: f.gratuit ? 'Gratuit' : `${f.prix}€`
      }));

      res.json({ 
        success: true, 
        formations: formationsEnrichies,
        total: formationsEnrichies.length
      });

    } catch (error) {
      console.error('❌ Erreur recherche:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur de recherche' 
      });
    }
  }

  // Méthode pour obtenir les domaines disponibles
  async getDomaines(req, res) {
    try {
      const domaines = await Formation.findAll({
        attributes: [
          'domaine',
          [Formation.sequelize.fn('COUNT', Formation.sequelize.col('id')), 'count']
        ],
        where: { actif: true },
        group: ['domaine'],
        order: [
          [Formation.sequelize.fn('COUNT', Formation.sequelize.col('id')), 'DESC']
        ]
      });

      const domainesFormates = domaines.map(d => ({
        value: d.domaine,
        label: d.domaine.charAt(0).toUpperCase() + d.domaine.slice(1),
        count: parseInt(d.dataValues.count)
      }));

      res.json({
        success: true,
        domaines: domainesFormates
      });

    } catch (error) {
      console.error('❌ Erreur getDomaines:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des domaines' 
      });
    }
  }

  // Méthode pour les statistiques publiques
  async getStatistiques(req, res) {
    try {
      const [
        totalFormations,
        totalModules,
        totalInscriptions,
        moyenneAvis
      ] = await Promise.all([
        Formation.count({ where: { actif: true } }),
        Module.count(),
        Inscription.count(),
        Avis.findOne({
          attributes: [
            [Avis.sequelize.fn('AVG', Avis.sequelize.col('note')), 'moyenne']
          ],
          where: { verifie: true }
        })
      ]);

      const stats = {
        formationsDisponibles: totalFormations,
        modulesTotaux: totalModules,
        professionnelsFormes: totalInscriptions || 2847,
        noteMoyenne: moyenneAvis?.dataValues?.moyenne ? 
          parseFloat(moyenneAvis.dataValues.moyenne).toFixed(1) : 4.8,
        tauxSatisfaction: 97
      };

      res.json({
        success: true,
        stats
      });

    } catch (error) {
      console.error('❌ Erreur getStatistiques:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la récupération des statistiques' 
      });
    }
  }

  // Méthode pour vérifier la disponibilité d'une formation
  async verifierDisponibilite(req, res) {
    try {
      const { id } = req.params;
      
      const formation = await Formation.findByPk(id, {
        attributes: ['id', 'titre', 'actif', 'prix', 'gratuit']
      });

      if (!formation) {
        return res.status(404).json({
          success: false,
          message: 'Formation non trouvée'
        });
      }

      res.json({
        success: true,
        disponible: formation.actif,
        formation: {
          id: formation.id,
          titre: formation.titre,
          prix: formation.prix,
          gratuit: formation.gratuit
        }
      });

    } catch (error) {
      console.error('❌ Erreur vérification disponibilité:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Erreur lors de la vérification' 
      });
    }
  }

  
}

export default new FormationController();
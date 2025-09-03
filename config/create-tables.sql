-- =====================================================
-- ADSIAM - Creation de la table utilisateurs
-- Version nettoyee sans caracteres speciaux
-- =====================================================

-- Supprimer la table existante si elle existe
DROP TABLE IF EXISTS utilisateurs CASCADE;

-- Creer la table utilisateurs
CREATE TABLE utilisateurs (
    -- Cle primaire
    id SERIAL PRIMARY KEY,
    
    -- Informations personnelles
    prenom VARCHAR(100) NOT NULL,
    nom VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    telephone VARCHAR(20),
    
    -- Authentification
    mot_de_passe VARCHAR(255), -- NULL pour les connexions sociales
    
    -- Profil professionnel
    type_utilisateur VARCHAR(50) NOT NULL DEFAULT 'aide-domicile',
    -- Options: aide-domicile, auxiliaire-vie, aide-soignant, infirmier, responsable, autre
    
    experience VARCHAR(20),
    -- Options: 0-1, 1-3, 3-5, 5-10, 10+
    
    etablissement VARCHAR(200),
    ville VARCHAR(100),
    code_postal VARCHAR(10),
    
    -- Roles et statuts
    role VARCHAR(20) NOT NULL DEFAULT 'apprenant',
    -- Options: administrateur, formateur, apprenant
    
    statut VARCHAR(30) NOT NULL DEFAULT 'en_attente_verification',
    -- Options: actif, inactif, en_attente_verification, suspendu
    
    -- Verification email
    email_verifie_le TIMESTAMP,
    token_verification_email VARCHAR(255),
    
    -- Reinitialisation mot de passe
    token_reinitialisation VARCHAR(255),
    expiration_token_reinitialisation TIMESTAMP,
    
    -- Authentification sociale
    fournisseur_social VARCHAR(20), -- google ou microsoft
    id_social VARCHAR(255),
    
    -- Securite
    tentatives_connexion_echouees INTEGER DEFAULT 0,
    verrouille_jusqu TIMESTAMP,
    
    -- Session et "Se souvenir de moi"
    token_actualisation TEXT,
    expiration_token_actualisation TIMESTAMP,
    
    -- Informations de connexion
    derniere_connexion_le TIMESTAMP,
    derniere_connexion_ip INET,
    
    -- Preferences utilisateur (JSON)
    preferences JSONB DEFAULT '{"langue": "fr", "notifications": {"email": true, "push": false, "sms": false}, "theme": "clair"}',
    
    -- Consentements RGPD
    accepte_conditions BOOLEAN DEFAULT FALSE,
    accepte_newsletter BOOLEAN DEFAULT FALSE,
    accepte_cookies BOOLEAN DEFAULT FALSE,
    date_acceptation_conditions TIMESTAMP,
    
    -- Avatar/Photo de profil
    avatar TEXT, -- URL ou base64
    
    -- Metadonnees
    cree_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    modifie_le TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    supprime_le TIMESTAMP -- Soft delete
);

-- =====================================================
-- INDEX pour ameliorer les performances
-- =====================================================

-- Index uniques
CREATE UNIQUE INDEX idx_utilisateurs_email ON utilisateurs(email);
CREATE UNIQUE INDEX idx_utilisateurs_token_verification ON utilisateurs(token_verification_email) WHERE token_verification_email IS NOT NULL;
CREATE UNIQUE INDEX idx_utilisateurs_token_reinitialisation ON utilisateurs(token_reinitialisation) WHERE token_reinitialisation IS NOT NULL;

-- Index composes pour les connexions sociales
CREATE INDEX idx_utilisateurs_social ON utilisateurs(fournisseur_social, id_social) WHERE fournisseur_social IS NOT NULL;

-- Index sur les champs frequemment utilises
CREATE INDEX idx_utilisateurs_statut ON utilisateurs(statut);
CREATE INDEX idx_utilisateurs_role ON utilisateurs(role);
CREATE INDEX idx_utilisateurs_type ON utilisateurs(type_utilisateur);
CREATE INDEX idx_utilisateurs_email_verifie ON utilisateurs(email_verifie_le);
CREATE INDEX idx_utilisateurs_cree_le ON utilisateurs(cree_le);

-- Index pour les requetes de securite
CREATE INDEX idx_utilisateurs_tentatives_connexion ON utilisateurs(tentatives_connexion_echouees, verrouille_jusqu);

-- Index partiel pour les utilisateurs actifs
CREATE INDEX idx_utilisateurs_actifs ON utilisateurs(id) WHERE statut = 'actif' AND supprime_le IS NULL;

-- =====================================================
-- TRIGGER pour la mise a jour automatique de modifie_le
-- =====================================================

CREATE OR REPLACE FUNCTION maj_modifie_le()
RETURNS TRIGGER AS $$
BEGIN
    NEW.modifie_le = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trigger_maj_modifie_le
    BEFORE UPDATE ON utilisateurs
    FOR EACH ROW
    EXECUTE FUNCTION maj_modifie_le();

-- =====================================================
-- CONTRAINTES ET VALIDATIONS
-- =====================================================

-- Contrainte sur l'email (format basique)
ALTER TABLE utilisateurs ADD CONSTRAINT chk_email_format 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- Contrainte sur les roles
ALTER TABLE utilisateurs ADD CONSTRAINT chk_role_valide 
    CHECK (role IN ('administrateur', 'formateur', 'apprenant'));

-- Contrainte sur les statuts
ALTER TABLE utilisateurs ADD CONSTRAINT chk_statut_valide 
    CHECK (statut IN ('actif', 'inactif', 'en_attente_verification', 'suspendu'));

-- Contrainte sur les types d'utilisateur
ALTER TABLE utilisateurs ADD CONSTRAINT chk_type_utilisateur_valide 
    CHECK (type_utilisateur IN ('aide-domicile', 'auxiliaire-vie', 'aide-soignant', 'infirmier', 'responsable', 'autre'));

-- Contrainte sur l'experience
ALTER TABLE utilisateurs ADD CONSTRAINT chk_experience_valide 
    CHECK (experience IS NULL OR experience IN ('0-1', '1-3', '3-5', '5-10', '10+'));

-- Contrainte sur les fournisseurs sociaux
ALTER TABLE utilisateurs ADD CONSTRAINT chk_fournisseur_social_valide 
    CHECK (fournisseur_social IS NULL OR fournisseur_social IN ('google', 'microsoft'));

-- Si connexion sociale, alors pas de mot de passe obligatoire
ALTER TABLE utilisateurs ADD CONSTRAINT chk_auth_coherente 
    CHECK (
        (fournisseur_social IS NULL AND mot_de_passe IS NOT NULL) OR
        (fournisseur_social IS NOT NULL AND id_social IS NOT NULL)
    );

-- =====================================================
-- VUES UTILES
-- =====================================================

-- Vue des utilisateurs actifs (sans donnees sensibles)
CREATE VIEW vue_utilisateurs_actifs AS
SELECT 
    id,
    prenom,
    nom,
    email,
    type_utilisateur,
    experience,
    etablissement,
    ville,
    role,
    statut,
    email_verifie_le IS NOT NULL as email_verifie,
    avatar,
    derniere_connexion_le,
    cree_le
FROM utilisateurs 
WHERE statut = 'actif' 
  AND supprime_le IS NULL;

-- Vue des statistiques utilisateurs
CREATE VIEW vue_stats_utilisateurs AS
SELECT 
    COUNT(*) as total_utilisateurs,
    COUNT(*) FILTER (WHERE statut = 'actif') as utilisateurs_actifs,
    COUNT(*) FILTER (WHERE email_verifie_le IS NOT NULL) as utilisateurs_verifies,
    COUNT(*) FILTER (WHERE role = 'apprenant') as apprenants,
    COUNT(*) FILTER (WHERE role = 'formateur') as formateurs,
    COUNT(*) FILTER (WHERE role = 'administrateur') as administrateurs,
    COUNT(*) FILTER (WHERE type_utilisateur = 'aide-domicile') as aides_domicile,
    COUNT(*) FILTER (WHERE type_utilisateur = 'aide-soignant') as aides_soignants,
    COUNT(*) FILTER (WHERE cree_le >= CURRENT_DATE - INTERVAL '30 days') as nouveaux_30j,
    COUNT(*) FILTER (WHERE derniere_connexion_le >= CURRENT_DATE - INTERVAL '7 days') as actifs_7j
FROM utilisateurs 
WHERE supprime_le IS NULL;

-- =====================================================
-- FONCTIONS UTILES
-- =====================================================

-- Fonction pour obtenir le nom complet
CREATE OR REPLACE FUNCTION nom_complet_utilisateur(user_id INTEGER)
RETURNS TEXT AS $$
DECLARE
    resultat TEXT;
BEGIN
    SELECT CONCAT(prenom, ' ', nom) INTO resultat
    FROM utilisateurs 
    WHERE id = user_id;
    
    RETURN COALESCE(resultat, 'Utilisateur inconnu');
END;
$$ LANGUAGE plpgsql;

-- Fonction pour verifier si un utilisateur peut se connecter
CREATE OR REPLACE FUNCTION peut_se_connecter(user_id INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    user_record RECORD;
BEGIN
    SELECT statut, email_verifie_le, verrouille_jusqu 
    INTO user_record
    FROM utilisateurs 
    WHERE id = user_id AND supprime_le IS NULL;
    
    IF user_record IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verifier le statut
    IF user_record.statut != 'actif' THEN
        RETURN FALSE;
    END IF;
    
    -- Verifier l'email
    IF user_record.email_verifie_le IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Verifier le verrouillage
    IF user_record.verrouille_jusqu IS NOT NULL AND user_record.verrouille_jusqu > CURRENT_TIMESTAMP THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour nettoyer les tokens expires
CREATE OR REPLACE FUNCTION nettoyer_tokens_expires()
RETURNS INTEGER AS $$
DECLARE
    nb_nettoyes INTEGER := 0;
    nb_temp INTEGER;
BEGIN
    -- Nettoyer les tokens de reinitialisation expires
    UPDATE utilisateurs 
    SET 
        token_reinitialisation = NULL,
        expiration_token_reinitialisation = NULL
    WHERE expiration_token_reinitialisation < CURRENT_TIMESTAMP
      AND token_reinitialisation IS NOT NULL;
    
    GET DIAGNOSTICS nb_temp = ROW_COUNT;
    nb_nettoyes := nb_nettoyes + nb_temp;
    
    -- Nettoyer les tokens d'actualisation expires
    UPDATE utilisateurs 
    SET 
        token_actualisation = NULL,
        expiration_token_actualisation = NULL
    WHERE expiration_token_actualisation < CURRENT_TIMESTAMP
      AND token_actualisation IS NOT NULL;
    
    GET DIAGNOSTICS nb_temp = ROW_COUNT;
    nb_nettoyes := nb_nettoyes + nb_temp;
    
    RETURN nb_nettoyes;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- DONNEES DE TEST
-- =====================================================

-- Inserer un administrateur par defaut
INSERT INTO utilisateurs (
    prenom, nom, email, mot_de_passe, role, statut, type_utilisateur,
    email_verifie_le, accepte_conditions, date_acceptation_conditions
) VALUES (
    'Admin',
    'ADSIAM',
    'admin@adsiam.fr',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewytaGtQh3AcKdgq', -- admin123
    'administrateur',
    'actif',
    'autre',
    CURRENT_TIMESTAMP,
    TRUE,
    CURRENT_TIMESTAMP
);

-- Inserer des utilisateurs de test
INSERT INTO utilisateurs (
    prenom, nom, email, mot_de_passe, role, statut, type_utilisateur, experience,
    email_verifie_le, accepte_conditions, date_acceptation_conditions, accepte_newsletter
) VALUES 
(
    'Marie',
    'Dupont',
    'marie.dupont@email.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewytaGtQh3AcKdgq', -- password123
    'apprenant',
    'actif',
    'aide-domicile',
    '3-5',
    CURRENT_TIMESTAMP,
    TRUE,
    CURRENT_TIMESTAMP,
    TRUE
),
(
    'Jean',
    'Martin',
    'jean.martin@email.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewytaGtQh3AcKdgq', -- motdepasse456
    'apprenant',
    'actif',
    'aide-soignant',
    '5-10',
    CURRENT_TIMESTAMP,
    TRUE,
    CURRENT_TIMESTAMP,
    FALSE
),
(
    'Sophie',
    'Bernard',
    'sophie.bernard@email.com',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewytaGtQh3AcKdgq', -- secret789
    'formateur',
    'actif',
    'infirmier',
    '10+',
    CURRENT_TIMESTAMP,
    TRUE,
    CURRENT_TIMESTAMP,
    TRUE
);

-- =====================================================
-- COMMENTAIRES ET DOCUMENTATION
-- =====================================================

COMMENT ON TABLE utilisateurs IS 'Table des utilisateurs de la plateforme ADSIAM';

COMMENT ON COLUMN utilisateurs.id IS 'Identifiant unique de l utilisateur';
COMMENT ON COLUMN utilisateurs.prenom IS 'Prenom de l utilisateur';
COMMENT ON COLUMN utilisateurs.nom IS 'Nom de famille de l utilisateur';
COMMENT ON COLUMN utilisateurs.email IS 'Adresse email unique de l utilisateur';
COMMENT ON COLUMN utilisateurs.telephone IS 'Numero de telephone (optionnel)';
COMMENT ON COLUMN utilisateurs.mot_de_passe IS 'Mot de passe hache (NULL pour connexions sociales)';
COMMENT ON COLUMN utilisateurs.type_utilisateur IS 'Type de professionnel';
COMMENT ON COLUMN utilisateurs.experience IS 'Annees d experience dans le domaine';
COMMENT ON COLUMN utilisateurs.role IS 'Role sur la plateforme';
COMMENT ON COLUMN utilisateurs.statut IS 'Statut du compte';
COMMENT ON COLUMN utilisateurs.preferences IS 'Preferences utilisateur en format JSON';
COMMENT ON COLUMN utilisateurs.accepte_conditions IS 'Acceptation des conditions d utilisation (RGPD)';
COMMENT ON COLUMN utilisateurs.supprime_le IS 'Date de suppression (soft delete)';

-- =====================================================
-- TESTS ET VERIFICATIONS
-- =====================================================

-- Afficher les statistiques
SELECT * FROM vue_stats_utilisateurs;

-- Test des fonctions
SELECT nom_complet_utilisateur(1) as nom_admin;
SELECT peut_se_connecter(1) as admin_peut_se_connecter;

-- Verifier la creation des utilisateurs
SELECT 
    id, 
    prenom, 
    nom, 
    email, 
    role, 
    statut,
    type_utilisateur
FROM utilisateurs 
ORDER BY id;

-- Test de nettoyage des tokens (ne devrait rien faire pour l'instant)
SELECT nettoyer_tokens_expires() as tokens_nettoyes;

-- Afficher la structure de la table
\d utilisateurs;
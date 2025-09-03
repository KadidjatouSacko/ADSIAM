import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Configuration de la base de données
const config = {
    development: {
        username: process.env.DB_USER || 'adsiam_user',
        password: process.env.DB_PASSWORD || 'adsiam_password',
        database: process.env.DB_NAME || 'adsiam_development',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT) || 5432,
        dialect: 'postgres',
        logging: console.log,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        define: {
            timestamps: true,
            underscored: false,
            underscoredAll: false,
            createdAt: 'createdAt',
            updatedAt: 'updatedAt'
        }
    },
    test: {
        username: process.env.DB_USER_TEST || 'adsiam_test',
        password: process.env.DB_PASSWORD_TEST || 'adsiam_test',
        database: process.env.DB_NAME_TEST || 'adsiam_test',
        host: process.env.DB_HOST_TEST || 'localhost',
        port: parseInt(process.env.DB_PORT_TEST) || 5432,
        dialect: 'postgres',
        logging: false,
        pool: {
            max: 5,
            min: 0,
            acquire: 30000,
            idle: 10000
        }
    },
    production: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT) || 5432,
        dialect: 'postgres',
        logging: false,
        pool: {
            max: 20,
            min: 0,
            acquire: 60000,
            idle: 10000
        },
        dialectOptions: {
            ssl: process.env.DB_SSL === 'true' ? {
                require: true,
                rejectUnauthorized: false
            } : false,
            connectTimeout: 60000
        },
        define: {
            timestamps: true,
            underscored: false,
            underscoredAll: false,
            createdAt: 'createdAt',
            updatedAt: 'updatedAt'
        }
    }
};

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Création de l'instance Sequelize
export const sequelize = new Sequelize(
    dbConfig.database,
    dbConfig.username,
    dbConfig.password,
    {
        host: dbConfig.host,
        port: dbConfig.port,
        dialect: dbConfig.dialect,
        logging: dbConfig.logging,
        pool: dbConfig.pool,
        dialectOptions: dbConfig.dialectOptions,
        define: dbConfig.define,
        
        // Options de sécurité
        retry: {
            match: [
                /ConnectionError/,
                /ConnectionRefusedError/,
                /ConnectionTimedOutError/,
                /TimeoutError/,
                /SequelizeConnectionError/,
                /SequelizeConnectionRefusedError/,
                /SequelizeHostNotFoundError/,
                /SequelizeHostNotReachableError/,
                /SequelizeInvalidConnectionError/,
                /SequelizeConnectionTimedOutError/
            ],
            max: 5
        },
        
        // Hooks globaux
        hooks: {
            beforeConnect: async (config) => {
                console.log('🔌 Connexion à PostgreSQL en cours...');
            },
            afterConnect: async (connection, config) => {
                console.log('✅ Connecté à PostgreSQL');
            },
            beforeDisconnect: async (connection) => {
                console.log('🔌 Déconnexion de PostgreSQL...');
            },
            afterDisconnect: async (connection) => {
                console.log('✅ Déconnecté de PostgreSQL');
            }
        }
    }
);

// Test de la connexion
export const testConnection = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connexion à la base de données établie avec succès');
        return true;
    } catch (error) {
        console.error('❌ Impossible de se connecter à la base de données:', error);
        return false;
    }
};

// Synchronisation des modèles
export const syncDatabase = async (options = {}) => {
    try {
        const syncOptions = {
            alter: env === 'development',
            force: options.force || false,
            ...options
        };
        
        await sequelize.sync(syncOptions);
        console.log('✅ Base de données synchronisée');
        
        // Créer les index personnalisés si nécessaire
        await createCustomIndexes();
        
        return true;
    } catch (error) {
        console.error('❌ Erreur lors de la synchronisation:', error);
        return false;
    }
};

// Création d'index personnalisés
const createCustomIndexes = async () => {
    try {
        const queryInterface = sequelize.getQueryInterface();
        
        // Index composites pour les performances
        const indexes = [
            {
                table: 'users',
                name: 'idx_users_email_status',
                fields: ['email', 'status'],
                unique: false
            },
            {
                table: 'users',
                name: 'idx_users_role_status',
                fields: ['role', 'status'],
                unique: false
            },
            {
                table: 'users',
                name: 'idx_users_created_at',
                fields: ['createdAt'],
                unique: false
            },
            {
                table: 'users',
                name: 'idx_users_last_login',
                fields: ['lastLoginAt'],
                unique: false
            }
        ];
        
        for (const index of indexes) {
            try {
                await queryInterface.addIndex(index.table, index.fields, {
                    name: index.name,
                    unique: index.unique
                });
                console.log(`✅ Index ${index.name} créé`);
            } catch (error) {
                // Index peut déjà exister
                if (!error.message.includes('already exists')) {
                    console.warn(`⚠️  Erreur création index ${index.name}:`, error.message);
                }
            }
        }
    } catch (error) {
        console.warn('⚠️  Erreur lors de la création des index:', error.message);
    }
};

// Utilitaires pour les migrations et seeders
export const createTables = async () => {
    try {
        // Importer tous les modèles pour s'assurer qu'ils sont enregistrés
        await import('../models/User.js');
        
        // Autres modèles à importer ici
        // await import('../models/Course.js');
        // await import('../models/Enrollment.js');
        
        await syncDatabase({ force: false });
        console.log('✅ Tables créées avec succès');
        return true;
    } catch (error) {
        console.error('❌ Erreur lors de la création des tables:', error);
        return false;
    }
};

// Utilitaire pour nettoyer la base de données (test/dev)
export const cleanDatabase = async () => {
    if (env === 'production') {
        throw new Error('Cannot clean production database');
    }
    
    try {
        await sequelize.drop();
        console.log('🗑️  Base de données nettoyée');
        return true;
    } catch (error) {
        console.error('❌ Erreur lors du nettoyage:', error);
        return false;
    }
};

// Fonction pour exécuter des requêtes SQL brutes
export const executeQuery = async (query, options = {}) => {
    try {
        const [results, metadata] = await sequelize.query(query, {
            type: options.type || Sequelize.QueryTypes.SELECT,
            ...options
        });
        return results;
    } catch (error) {
        console.error('❌ Erreur lors de l\'exécution de la requête:', error);
        throw error;
    }
};

// Statistiques de la base de données
export const getDatabaseStats = async () => {
    try {
        const stats = {
            timestamp: new Date().toISOString(),
            tables: {}
        };
        
        // Statistiques des utilisateurs
        const userStats = await executeQuery(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN status = 'active' THEN 1 END) as active,
                COUNT(CASE WHEN role = 'student' THEN 1 END) as students,
                COUNT(CASE WHEN role = 'instructor' THEN 1 END) as instructors,
                COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
                COUNT(CASE WHEN "emailVerifiedAt" IS NOT NULL THEN 1 END) as verified
            FROM users
        `);
        
        stats.tables.users = userStats[0];
        
        // Taille de la base de données
        const sizeQuery = `
            SELECT 
                pg_size_pretty(pg_database_size(current_database())) as database_size,
                pg_size_pretty(pg_total_relation_size('users')) as users_table_size
        `;
        
        const sizeStats = await executeQuery(sizeQuery);
        stats.database_size = sizeStats[0];
        
        return stats;
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des statistiques:', error);
        return null;
    }
};

// Fonction pour vérifier la santé de la base de données
export const healthCheck = async () => {
    try {
        const startTime = Date.now();
        
        // Test de connectivité
        await sequelize.authenticate();
        
        // Test de performance avec une requête simple
        await executeQuery('SELECT 1 as health_check');
        
        const responseTime = Date.now() - startTime;
        
        return {
            status: 'healthy',
            responseTime,
            connection: 'active',
            database: dbConfig.database,
            host: dbConfig.host,
            port: dbConfig.port
        };
    } catch (error) {
        return {
            status: 'unhealthy',
            error: error.message,
            connection: 'failed'
        };
    }
};

// Backup utilitaire (pour développement)
export const createBackup = async (filename) => {
    if (env === 'production') {
        throw new Error('Use proper backup tools for production');
    }
    
    try {
        const { spawn } = await import('child_process');
        const backupFile = filename || `backup_${Date.now()}.sql`;
        
        return new Promise((resolve, reject) => {
            const pg_dump = spawn('pg_dump', [
                '-h', dbConfig.host,
                '-p', dbConfig.port,
                '-U', dbConfig.username,
                '-d', dbConfig.database,
                '-f', backupFile,
                '--no-password'
            ], {
                env: { ...process.env, PGPASSWORD: dbConfig.password }
            });
            
            pg_dump.on('close', (code) => {
                if (code === 0) {
                    console.log(`✅ Backup créé: ${backupFile}`);
                    resolve(backupFile);
                } else {
                    reject(new Error(`pg_dump exited with code ${code}`));
                }
            });
            
            pg_dump.on('error', reject);
        });
    } catch (error) {
        console.error('❌ Erreur lors du backup:', error);
        throw error;
    }
};

// Export de la configuration pour usage externe
export { config };
export default sequelize;
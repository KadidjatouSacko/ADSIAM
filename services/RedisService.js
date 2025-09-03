import Redis from 'ioredis';

export class RedisService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.connect();
    }

    /**
     * Établir la connexion Redis
     */
    connect() {
        try {
            const redisConfig = {
                host: process.env.REDIS_HOST || 'localhost',
                port: parseInt(process.env.REDIS_PORT) || 6379,
                password: process.env.REDIS_PASSWORD || undefined,
                db: parseInt(process.env.REDIS_DB) || 0,
                retryDelayOnFailover: 100,
                maxRetriesPerRequest: 3,
                lazyConnect: true,
                keepAlive: 30000,
                connectTimeout: 10000,
                commandTimeout: 5000
            };

            // Configuration pour Redis Cloud/External
            if (process.env.REDIS_URL) {
                this.client = new Redis(process.env.REDIS_URL);
            } else {
                this.client = new Redis(redisConfig);
            }

            this.setupEventHandlers();
            
            // Tentative de connexion
            this.client.connect().catch(error => {
                console.error('Failed to connect to Redis:', error.message);
                this.handleConnectionError();
            });

        } catch (error) {
            console.error('Redis connection setup failed:', error);
            this.handleConnectionError();
        }
    }

    /**
     * Configurer les gestionnaires d'événements Redis
     */
    setupEventHandlers() {
        this.client.on('connect', () => {
            console.log('🔗 Redis connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
        });

        this.client.on('ready', () => {
            console.log('✅ Redis ready');
        });

        this.client.on('error', (error) => {
            console.error('❌ Redis error:', error.message);
            this.isConnected = false;
        });

        this.client.on('close', () => {
            console.log('🔌 Redis connection closed');
            this.isConnected = false;
        });

        this.client.on('reconnecting', (time) => {
            console.log(`🔄 Redis reconnecting in ${time}ms`);
        });

        this.client.on('end', () => {
            console.log('🛑 Redis connection ended');
            this.isConnected = false;
        });
    }

    /**
     * Gérer les erreurs de connexion
     */
    handleConnectionError() {
        this.isConnected = false;
        
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Backoff exponentiel
            
            console.log(`Attempting to reconnect to Redis (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
            
            setTimeout(() => {
                this.connect();
            }, delay);
        } else {
            console.error('Max Redis reconnection attempts reached. Running without cache.');
        }
    }

    /**
     * Vérifier si Redis est disponible
     */
    isAvailable() {
        return this.isConnected && this.client && this.client.status === 'ready';
    }

    /**
     * Exécuter une commande Redis avec fallback
     */
    async executeCommand(command, ...args) {
        if (!this.isAvailable()) {
            console.warn(`Redis not available for command: ${command}`);
            return null;
        }

        try {
            return await this.client[command](...args);
        } catch (error) {
            console.error(`Redis ${command} command failed:`, error.message);
            return null;
        }
    }

    /**
     * Stocker une valeur avec expiration
     */
    async setex(key, seconds, value) {
        return this.executeCommand('setex', key, seconds, JSON.stringify(value));
    }

    /**
     * Stocker une valeur sans expiration
     */
    async set(key, value) {
        return this.executeCommand('set', key, JSON.stringify(value));
    }

    /**
     * Récupérer une valeur
     */
    async get(key) {
        const result = await this.executeCommand('get', key);
        if (result === null) return null;
        
        try {
            return JSON.parse(result);
        } catch (error) {
            console.error(`Failed to parse Redis value for key ${key}:`, error);
            return result; // Retourner la valeur brute si parsing échoue
        }
    }

    /**
     * Supprimer une ou plusieurs clés
     */
    async del(...keys) {
        return this.executeCommand('del', ...keys);
    }

    /**
     * Vérifier si une clé existe
     */
    async exists(key) {
        return this.executeCommand('exists', key);
    }

    /**
     * Incrémenter une valeur
     */
    async incr(key) {
        return this.executeCommand('incr', key);
    }

    /**
     * Décrémenter une valeur
     */
    async decr(key) {
        return this.executeCommand('decr', key);
    }

    /**
     * Incrémenter de N
     */
    async incrby(key, increment) {
        return this.executeCommand('incrby', key, increment);
    }

    /**
     * Obtenir le TTL d'une clé
     */
    async ttl(key) {
        return this.executeCommand('ttl', key);
    }

    /**
     * Définir une expiration sur une clé existante
     */
    async expire(key, seconds) {
        return this.executeCommand('expire', key, seconds);
    }

    /**
     * Obtenir toutes les clés correspondant à un pattern
     */
    async keys(pattern = '*') {
        return this.executeCommand('keys', pattern);
    }

    /**
     * Vider toutes les données de la DB actuelle
     */
    async flushdb() {
        return this.executeCommand('flushdb');
    }

    /**
     * Obtenir des informations sur Redis
     */
    async info() {
        return this.executeCommand('info');
    }

    /**
     * Ping Redis
     */
    async ping() {
        return this.executeCommand('ping');
    }

    /**
     * Operations sur les Hash (HSET, HGET, etc.)
     */
    async hset(key, field, value) {
        return this.executeCommand('hset', key, field, JSON.stringify(value));
    }

    async hget(key, field) {
        const result = await this.executeCommand('hget', key, field);
        if (result === null) return null;
        
        try {
            return JSON.parse(result);
        } catch (error) {
            return result;
        }
    }

    async hgetall(key) {
        const result = await this.executeCommand('hgetall', key);
        if (!result) return {};
        
        const parsed = {};
        Object.keys(result).forEach(field => {
            try {
                parsed[field] = JSON.parse(result[field]);
            } catch (error) {
                parsed[field] = result[field];
            }
        });
        
        return parsed;
    }

    async hdel(key, ...fields) {
        return this.executeCommand('hdel', key, ...fields);
    }

    async hexists(key, field) {
        return this.executeCommand('hexists', key, field);
    }

    /**
     * Operations sur les Sets
     */
    async sadd(key, ...members) {
        return this.executeCommand('sadd', key, ...members.map(m => JSON.stringify(m)));
    }

    async srem(key, ...members) {
        return this.executeCommand('srem', key, ...members.map(m => JSON.stringify(m)));
    }

    async smembers(key) {
        const result = await this.executeCommand('smembers', key);
        if (!result) return [];
        
        return result.map(member => {
            try {
                return JSON.parse(member);
            } catch (error) {
                return member;
            }
        });
    }

    async sismember(key, member) {
        return this.executeCommand('sismember', key, JSON.stringify(member));
    }

    /**
     * Operations sur les Sorted Sets
     */
    async zadd(key, score, member) {
        return this.executeCommand('zadd', key, score, JSON.stringify(member));
    }

    async zrem(key, member) {
        return this.executeCommand('zrem', key, JSON.stringify(member));
    }

    async zrange(key, start, stop, withScores = false) {
        const args = withScores ? [key, start, stop, 'WITHSCORES'] : [key, start, stop];
        const result = await this.executeCommand('zrange', ...args);
        
        if (!result) return [];
        
        if (withScores) {
            const parsed = [];
            for (let i = 0; i < result.length; i += 2) {
                parsed.push({
                    member: JSON.parse(result[i]),
                    score: parseFloat(result[i + 1])
                });
            }
            return parsed;
        }
        
        return result.map(member => JSON.parse(member));
    }

    /**
     * Cache avec TTL automatique
     */
    async cache(key, dataFunction, ttlSeconds = 3600) {
        // Essayer de récupérer depuis le cache
        const cached = await this.get(key);
        if (cached !== null) {
            return cached;
        }

        // Si pas en cache, exécuter la fonction et mettre en cache
        try {
            const data = await dataFunction();
            await this.setex(key, ttlSeconds, data);
            return data;
        } catch (error) {
            console.error(`Cache function failed for key ${key}:`, error);
            throw error;
        }
    }

    /**
     * Invalidation de cache par pattern
     */
    async invalidatePattern(pattern) {
        const keys = await this.keys(pattern);
        if (keys && keys.length > 0) {
            return this.del(...keys);
        }
        return 0;
    }

    /**
     * Rate limiting avec sliding window
     */
    async rateLimit(key, maxRequests, windowSeconds) {
        const now = Date.now();
        const window = windowSeconds * 1000;
        const pipeline = this.client.pipeline();

        // Supprimer les entrées anciennes
        pipeline.zremrangebyscore(key, 0, now - window);
        
        // Compter les requêtes actuelles
        pipeline.zcard(key);
        
        // Ajouter cette requête
        pipeline.zadd(key, now, now);
        
        // Définir l'expiration
        pipeline.expire(key, windowSeconds);

        const results = await pipeline.exec();
        const currentCount = results[1][1] || 0;

        return {
            allowed: currentCount < maxRequests,
            count: currentCount + 1,
            remaining: Math.max(0, maxRequests - currentCount - 1),
            resetTime: new Date(now + window)
        };
    }

    /**
     * Session storage
     */
    async setSession(sessionId, sessionData, ttlSeconds = 3600) {
        const key = `session:${sessionId}`;
        return this.setex(key, ttlSeconds, sessionData);
    }

    async getSession(sessionId) {
        const key = `session:${sessionId}`;
        return this.get(key);
    }

    async deleteSession(sessionId) {
        const key = `session:${sessionId}`;
        return this.del(key);
    }

    /**
     * User data caching
     */
    async cacheUser(userId, userData, ttlSeconds = 1800) {
        const key = `user:${userId}`;
        return this.setex(key, ttlSeconds, userData);
    }

    async getCachedUser(userId) {
        const key = `user:${userId}`;
        return this.get(key);
    }

    async invalidateUser(userId) {
        const key = `user:${userId}`;
        return this.del(key);
    }

    /**
     * Lock distribution pour éviter les races conditions
     */
    async acquireLock(lockKey, ttlSeconds = 10) {
        const key = `lock:${lockKey}`;
        const value = Date.now() + Math.random(); // Valeur unique
        
        const result = await this.executeCommand('set', key, value, 'EX', ttlSeconds, 'NX');
        
        if (result === 'OK') {
            return {
                acquired: true,
                value,
                release: () => this.releaseLock(key, value)
            };
        }
        
        return { acquired: false };
    }

    async releaseLock(lockKey, lockValue) {
        const script = `
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                return redis.call("DEL", KEYS[1])
            else
                return 0
            end
        `;
        
        return this.executeCommand('eval', script, 1, lockKey, lockValue);
    }

    /**
     * Health check de Redis
     */
    async healthCheck() {
        try {
            const start = Date.now();
            const pong = await this.ping();
            const latency = Date.now() - start;
            
            return {
                status: pong === 'PONG' ? 'healthy' : 'unhealthy',
                latency,
                connected: this.isAvailable(),
                info: await this.info()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                connected: false
            };
        }
    }

    /**
     * Fermer la connexion Redis
     */
    async disconnect() {
        if (this.client) {
            await this.client.quit();
            console.log('Redis connection closed gracefully');
        }
    }
}

// Export d'une instance singleton
export const redisService = new RedisService();
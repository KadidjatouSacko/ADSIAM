import Redis from 'ioredis';

class RedisService {
    constructor() {
        this.client = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
        this.client.on('connect', () => console.log('✅ Redis connecté'));
        this.client.on('error', err => console.error('❌ Redis erreur:', err));
    }

    async get(key) {
        return await this.client.get(key);
    }

    async set(key, value, expireSeconds = null) {
        if (expireSeconds) {
            return await this.client.set(key, value, 'EX', expireSeconds);
        }
        return await this.client.set(key, value);
    }

    async incr(key) {
        return await this.client.incr(key);
    }

    async del(key) {
        return await this.client.del(key);
    }

    async ttl(key) {
        return await this.client.ttl(key);
    }

    async keys(pattern = '*') {
        return await this.client.keys(pattern);
    }

    async disconnect() {
        await this.client.quit();
    }
}

export default new RedisService();
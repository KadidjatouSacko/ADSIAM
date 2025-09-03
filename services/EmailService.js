import nodemailer from 'nodemailer';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class EmailService {
    constructor() {
        this.transporter = this.createTransport();
        this.templates = new Map();
        this.loadTemplates();
    }

    /**
     * Créer le transporteur d'emails
     */
    createTransport() {
        const config = {
            host: process.env.SMTP_HOST || 'localhost',
            port: parseInt(process.env.SMTP_PORT) || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        };

        // Configuration pour différents fournisseurs
        if (process.env.EMAIL_PROVIDER === 'gmail') {
            config.service = 'gmail';
        } else if (process.env.EMAIL_PROVIDER === 'outlook') {
            config.service = 'hotmail';
        } else if (process.env.EMAIL_PROVIDER === 'sendgrid') {
            config.host = 'smtp.sendgrid.net';
            config.port = 587;
        }

        return nodemailer.createTransport(config);
    }

    /**
     * Charger les templates d'emails
     */
    async loadTemplates() {
        try {
            const templatesDir = path.join(__dirname, '../templates/emails');
            
            // Template de vérification d'email
            this.templates.set('verification', await this.loadTemplate('verification.html'));
            
            // Template de réinitialisation de mot de passe
            this.templates.set('password-reset', await this.loadTemplate('password-reset.html'));
            
            // Template de bienvenue
            this.templates.set('welcome', await this.loadTemplate('welcome.html'));
            
            // Template de notification
            this.templates.set('notification', await this.loadTemplate('notification.html'));
            
        } catch (error) {
            console.error('Error loading email templates:', error);
            // Utiliser des templates par défaut
            this.loadDefaultTemplates();
        }
    }

    /**
     * Charger un template depuis un fichier
     */
    async loadTemplate(filename) {
        const templatePath = path.join(__dirname, '../templates/emails', filename);
        return await fs.readFile(templatePath, 'utf8');
    }

    /**
     * Charger les templates par défaut en cas d'erreur
     */
    loadDefaultTemplates() {
        this.templates.set('verification', this.getDefaultVerificationTemplate());
        this.templates.set('password-reset', this.getDefaultPasswordResetTemplate());
        this.templates.set('welcome', this.getDefaultWelcomeTemplate());
        this.templates.set('notification', this.getDefaultNotificationTemplate());
    }

    /**
     * Envoyer l'email de vérification
     */
    async sendVerificationEmail(user, token) {
        const verificationUrl = `${process.env.APP_URL}/auth/verify-email/${token}`;
        
        const html = this.renderTemplate('verification', {
            firstName: user.firstName,
            lastName: user.lastName,
            verificationUrl,
            appName: 'ADSIAM',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@adsiam.fr'
        });

        const mailOptions = {
            from: {
                name: 'ADSIAM Formation',
                address: process.env.FROM_EMAIL || 'noreply@adsiam.fr'
            },
            to: user.email,
            subject: '🎓 Vérifiez votre compte ADSIAM',
            html,
            text: this.htmlToText(html)
        };

        return this.sendEmail(mailOptions);
    }

    /**
     * Envoyer l'email de réinitialisation de mot de passe
     */
    async sendPasswordResetEmail(user, token) {
        const resetUrl = `${process.env.APP_URL}/auth/reset-password/${token}`;
        
        const html = this.renderTemplate('password-reset', {
            firstName: user.firstName,
            lastName: user.lastName,
            resetUrl,
            appName: 'ADSIAM',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@adsiam.fr',
            expirationTime: '1 heure'
        });

        const mailOptions = {
            from: {
                name: 'ADSIAM Formation',
                address: process.env.FROM_EMAIL || 'noreply@adsiam.fr'
            },
            to: user.email,
            subject: '🔐 Réinitialisation de votre mot de passe ADSIAM',
            html,
            text: this.htmlToText(html)
        };

        return this.sendEmail(mailOptions);
    }

    /**
     * Envoyer l'email de bienvenue
     */
    async sendWelcomeEmail(user) {
        const dashboardUrl = `${process.env.APP_URL}/dashboard`;
        const supportUrl = `${process.env.APP_URL}/contact`;
        
        const html = this.renderTemplate('welcome', {
            firstName: user.firstName,
            lastName: user.lastName,
            dashboardUrl,
            supportUrl,
            appName: 'ADSIAM',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@adsiam.fr'
        });

        const mailOptions = {
            from: {
                name: 'ADSIAM Formation',
                address: process.env.FROM_EMAIL || 'noreply@adsiam.fr'
            },
            to: user.email,
            subject: '🎉 Bienvenue sur ADSIAM - Votre formation commence maintenant !',
            html,
            text: this.htmlToText(html)
        };

        return this.sendEmail(mailOptions);
    }

    /**
     * Envoyer un email de notification générique
     */
    async sendNotificationEmail(user, subject, content, options = {}) {
        const html = this.renderTemplate('notification', {
            firstName: user.firstName,
            lastName: user.lastName,
            subject,
            content,
            appName: 'ADSIAM',
            supportEmail: process.env.SUPPORT_EMAIL || 'support@adsiam.fr',
            actionUrl: options.actionUrl || '',
            actionText: options.actionText || ''
        });

        const mailOptions = {
            from: {
                name: options.fromName || 'ADSIAM Formation',
                address: options.fromEmail || process.env.FROM_EMAIL || 'noreply@adsiam.fr'
            },
            to: user.email,
            subject: `📧 ${subject}`,
            html,
            text: this.htmlToText(html)
        };

        return this.sendEmail(mailOptions);
    }

    /**
     * Envoyer un email personnalisé
     */
    async sendCustomEmail(to, subject, html, options = {}) {
        const mailOptions = {
            from: {
                name: options.fromName || 'ADSIAM Formation',
                address: options.fromEmail || process.env.FROM_EMAIL || 'noreply@adsiam.fr'
            },
            to,
            subject,
            html,
            text: options.text || this.htmlToText(html),
            attachments: options.attachments || []
        };

        return this.sendEmail(mailOptions);
    }

    /**
     * Envoyer l'email
     */
    async sendEmail(mailOptions) {
        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Email sent successfully:', {
                messageId: info.messageId,
                to: mailOptions.to,
                subject: mailOptions.subject
            });
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('Email sending failed:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Rendre un template avec des variables
     */
    renderTemplate(templateName, variables) {
        let template = this.templates.get(templateName);
        
        if (!template) {
            console.warn(`Template ${templateName} not found, using default`);
            template = this.getDefaultNotificationTemplate();
        }

        // Remplacer les variables dans le template
        Object.keys(variables).forEach(key => {
            const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
            template = template.replace(regex, variables[key] || '');
        });

        return template;
    }

    /**
     * Convertir HTML en texte brut
     */
    htmlToText(html) {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gis, '')
            .replace(/<script[^>]*>.*?<\/script>/gis, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Template de vérification par défaut
     */
    getDefaultVerificationTemplate() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Vérifiez votre compte ADSIAM</title>
            <style>
                body { 
                    font-family: 'Inter', Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #2f2f2f; 
                    background: #f5f5f7; 
                    margin: 0; 
                    padding: 0; 
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: #ffffff; 
                    border-radius: 20px; 
                    overflow: hidden; 
                    box-shadow: 0 20px 60px rgba(0,0,0,0.1); 
                }
                .header { 
                    background: linear-gradient(135deg, #e7a6b7, #a5bfd4); 
                    color: white; 
                    padding: 3rem 2rem; 
                    text-align: center; 
                }
                .header h1 { 
                    margin: 0; 
                    font-size: 2rem; 
                    font-weight: 300; 
                }
                .content { 
                    padding: 3rem 2rem; 
                }
                .button { 
                    display: inline-block; 
                    background: linear-gradient(135deg, #e7a6b7, #a5bfd4); 
                    color: white; 
                    padding: 1rem 2rem; 
                    border-radius: 50px; 
                    text-decoration: none; 
                    font-weight: 600; 
                    margin: 2rem 0; 
                }
                .footer { 
                    background: #f5f5f7; 
                    padding: 2rem; 
                    text-align: center; 
                    color: #6f6f6f; 
                    font-size: 0.9rem; 
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎓 ADSIAM</h1>
                    <p>Plateforme de formation professionnelle</p>
                </div>
                <div class="content">
                    <h2>Bonjour {{firstName}} {{lastName}},</h2>
                    <p>Bienvenue sur ADSIAM ! Pour activer votre compte et accéder à nos formations, veuillez vérifier votre adresse email en cliquant sur le bouton ci-dessous :</p>
                    <div style="text-align: center;">
                        <a href="{{verificationUrl}}" class="button">✅ Vérifier mon email</a>
                    </div>
                    <p>Ce lien est valide pendant 24 heures. Si vous n'avez pas créé de compte sur {{appName}}, vous pouvez ignorer cet email.</p>
                </div>
                <div class="footer">
                    <p>Besoin d'aide ? Contactez-nous à <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
                    <p>&copy; 2025 ADSIAM. Tous droits réservés.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Template de réinitialisation par défaut
     */
    getDefaultPasswordResetTemplate() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Réinitialisation mot de passe ADSIAM</title>
            <style>
                body { 
                    font-family: 'Inter', Arial, sans-serif; 
                    line-height: 1.6; 
                    color: #2f2f2f; 
                    background: #f5f5f7; 
                    margin: 0; 
                    padding: 0; 
                }
                .container { 
                    max-width: 600px; 
                    margin: 0 auto; 
                    background: #ffffff; 
                    border-radius: 20px; 
                    overflow: hidden; 
                    box-shadow: 0 20px 60px rgba(0,0,0,0.1); 
                }
                .header { 
                    background: linear-gradient(135deg, #e7a6b7, #a5bfd4); 
                    color: white; 
                    padding: 3rem 2rem; 
                    text-align: center; 
                }
                .header h1 { 
                    margin: 0; 
                    font-size: 2rem; 
                    font-weight: 300; 
                }
                .content { 
                    padding: 3rem 2rem; 
                }
                .button { 
                    display: inline-block; 
                    background: linear-gradient(135deg, #e7a6b7, #a5bfd4); 
                    color: white; 
                    padding: 1rem 2rem; 
                    border-radius: 50px; 
                    text-decoration: none; 
                    font-weight: 600; 
                    margin: 2rem 0; 
                }
                .warning { 
                    background: #fff3cd; 
                    border: 1px solid #ffeaa7; 
                    border-radius: 10px; 
                    padding: 1rem; 
                    margin: 2rem 0; 
                }
                .footer { 
                    background: #f5f5f7; 
                    padding: 2rem; 
                    text-align: center; 
                    color: #6f6f6f; 
                    font-size: 0.9rem; 
                }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🔐 ADSIAM</h1>
                    <p>Réinitialisation de mot de passe</p>
                </div>
                <div class="content">
                    <h2>Bonjour {{firstName}} {{lastName}},</h2>
                    <p>Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :</p>
                                        <div style="text-align: center;">
                        <a href="{{resetUrl}}" class="button">🔑 Réinitialiser mon mot de passe</a>
                    </div>
                    <div class="warning">
                        <p>Ce lien expirera dans {{expirationTime}}. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.</p>
                    </div>
                </div>
                <div class="footer">
                    <p>Besoin d'aide ? Contactez-nous à <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
                    <p>&copy; 2025 ADSIAM. Tous droits réservés.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Template de bienvenue par défaut
     */
    getDefaultWelcomeTemplate() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Bienvenue sur ADSIAM</title>
            <style>
                body { font-family: 'Inter', Arial, sans-serif; background: #f5f5f7; margin:0; padding:0; color:#2f2f2f;}
                .container { max-width:600px; margin:0 auto; background:#fff; border-radius:20px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.1);}
                .header { background:linear-gradient(135deg, #e7a6b7, #a5bfd4); color:white; padding:3rem 2rem; text-align:center;}
                .header h1 { margin:0; font-size:2rem; font-weight:300; }
                .content { padding:3rem 2rem; }
                .button { display:inline-block; background:linear-gradient(135deg, #e7a6b7, #a5bfd4); color:white; padding:1rem 2rem; border-radius:50px; text-decoration:none; font-weight:600; margin:2rem 0;}
                .footer { background:#f5f5f7; padding:2rem; text-align:center; color:#6f6f6f; font-size:0.9rem;}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>🎉 ADSIAM</h1>
                    <p>Bienvenue dans votre espace formation</p>
                </div>
                <div class="content">
                    <h2>Bonjour {{firstName}} {{lastName}},</h2>
                    <p>Nous sommes ravis de vous accueillir sur ADSIAM ! Accédez à votre tableau de bord pour commencer vos formations :</p>
                    <div style="text-align:center;">
                        <a href="{{dashboardUrl}}" class="button">➡️ Accéder au tableau de bord</a>
                    </div>
                    <p>Pour toute question, contactez notre support : <a href="{{supportUrl}}">{{supportEmail}}</a></p>
                </div>
                <div class="footer">
                    <p>&copy; 2025 ADSIAM. Tous droits réservés.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }

    /**
     * Template de notification par défaut
     */
    getDefaultNotificationTemplate() {
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Notification ADSIAM</title>
            <style>
                body { font-family: 'Inter', Arial, sans-serif; background:#f5f5f7; margin:0; padding:0; color:#2f2f2f;}
                .container { max-width:600px; margin:0 auto; background:#fff; border-radius:20px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.1);}
                .header { background:linear-gradient(135deg, #e7a6b7, #a5bfd4); color:white; padding:3rem 2rem; text-align:center;}
                .header h1 { margin:0; font-size:2rem; font-weight:300; }
                .content { padding:3rem 2rem; }
                .button { display:inline-block; background:linear-gradient(135deg, #e7a6b7, #a5bfd4); color:white; padding:1rem 2rem; border-radius:50px; text-decoration:none; font-weight:600; margin:2rem 0;}
                .footer { background:#f5f5f7; padding:2rem; text-align:center; color:#6f6f6f; font-size:0.9rem;}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📧 Notification ADSIAM</h1>
                </div>
                <div class="content">
                    <h2>Bonjour {{firstName}} {{lastName}},</h2>
                    <p>{{content}}</p>
                    {{#if actionUrl}}
                    <div style="text-align:center;">
                        <a href="{{actionUrl}}" class="button">{{actionText}}</a>
                    </div>
                    {{/if}}
                </div>
                <div class="footer">
                    <p>Besoin d'aide ? Contactez-nous à <a href="mailto:{{supportEmail}}">{{supportEmail}}</a></p>
                    <p>&copy; 2025 ADSIAM. Tous droits réservés.</p>
                </div>
            </div>
        </body>
        </html>
        `;
    }
}

export default new EmailService();
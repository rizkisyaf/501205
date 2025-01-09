import { logger } from "../utils/logger";

export interface SystemNotification {
    type: "system_start" | "system_stop";
    message: string;
    timestamp: string;
}

export interface TradeNotification {
    type: "trade_executed" | "trade_closed";
    message: string;
    timestamp: string;
    details: {
        longExchange: string;
        shortExchange: string;
        symbol: string;
        size: string;
        leverage: number;
    };
}

export interface ErrorNotification {
    type: "system_error" | "trade_error";
    message: string;
    timestamp: string;
}

export interface NotificationConfig {
    enabled: boolean;
    telegram?: {
        botToken?: string;
        chatId?: string;
    };
    discord?: {
        webhookUrl?: string;
    };
}

export class NotificationService {
    private config: NotificationConfig;

    constructor(config: NotificationConfig) {
        this.config = config;
    }

    async sendSystemNotification(notification: SystemNotification): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            logger.info(`[${notification.type}] ${notification.message}`);
            await this.sendToTelegram(notification);
            await this.sendToDiscord(notification);
        } catch (error) {
            logger.error("Error sending system notification:", error);
        }
    }

    async sendTradeNotification(notification: TradeNotification): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            logger.info(`[${notification.type}] ${notification.message}`, notification.details);
            await this.sendToTelegram(notification);
            await this.sendToDiscord(notification);
        } catch (error) {
            logger.error("Error sending trade notification:", error);
        }
    }

    async sendErrorNotification(notification: ErrorNotification): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        try {
            logger.error(`[${notification.type}] ${notification.message}`);
            await this.sendToTelegram(notification);
            await this.sendToDiscord(notification);
        } catch (error) {
            logger.error("Error sending error notification:", error);
        }
    }

    private async sendToTelegram(notification: SystemNotification | TradeNotification | ErrorNotification): Promise<void> {
        if (!this.config.telegram?.botToken || !this.config.telegram?.chatId) {
            return;
        }

        try {
            const message = this.formatMessage(notification);
            const url = `https://api.telegram.org/bot${this.config.telegram.botToken}/sendMessage`;
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    chat_id: this.config.telegram.chatId,
                    text: message,
                    parse_mode: "HTML"
                })
            });

            if (!response.ok) {
                throw new Error(`Telegram API error: ${response.statusText}`);
            }
        } catch (error) {
            logger.error("Error sending Telegram notification:", error);
        }
    }

    private async sendToDiscord(notification: SystemNotification | TradeNotification | ErrorNotification): Promise<void> {
        if (!this.config.discord?.webhookUrl) {
            return;
        }

        try {
            const message = this.formatMessage(notification);
            const response = await fetch(this.config.discord.webhookUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    content: message
                })
            });

            if (!response.ok) {
                throw new Error(`Discord API error: ${response.statusText}`);
            }
        } catch (error) {
            logger.error("Error sending Discord notification:", error);
        }
    }

    private formatMessage(notification: SystemNotification | TradeNotification | ErrorNotification): string {
        let message = `<b>[${notification.type}]</b>\n${notification.message}`;

        if ("details" in notification) {
            message += "\n\nDetails:";
            for (const [key, value] of Object.entries(notification.details)) {
                message += `\n${key}: ${value}`;
            }
        }

        return message;
    }
} 
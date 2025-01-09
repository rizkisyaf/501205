import { logger } from "../utils/logger";

interface TradeDetails {
    exchange: string;
    symbol: string;
    side: string;
    size: number | string;
    price: number | string;
}

interface SystemNotification {
    type: "system_start" | "system_stop" | "system_update";
    message: string;
    timestamp: string;
}

interface TradeNotification {
    type: "trade_executed" | "trade_closed" | "trade_failed";
    message: string;
    trade: TradeDetails;
    details?: Record<string, any>;
    timestamp: string;
}

interface ErrorNotification {
    type: "system_error" | "trade_error";
    message: string;
    error: string;
    timestamp: string;
}

export interface NotificationConfig {
    enabled: boolean;
    telegram?: {
        botToken?: string;
        chatId?: string;
    };
}

export class NotificationService {
    private readonly config: NotificationConfig;

    constructor(config: NotificationConfig) {
        this.config = {
            enabled: config.enabled || false,
            telegram: config.telegram
        };
    }

    async sendSystemNotification(notification: SystemNotification): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        const message = this.formatMessage(notification);
        await this.sendToTelegram(message);
    }

    async sendTradeNotification(notification: TradeNotification): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        const message = this.formatMessage(notification);
        await this.sendToTelegram(message);
    }

    async sendErrorNotification(notification: ErrorNotification): Promise<void> {
        if (!this.config.enabled) {
            return;
        }

        const message = this.formatMessage(notification);
        await this.sendToTelegram(message);
    }

    private formatMessage(notification: SystemNotification | TradeNotification | ErrorNotification): string {
        const header = `<b>[${notification.type}]</b>\n`;
        
        if ('error' in notification) {
            return `${header}${notification.message}\n\nError: ${notification.error}`;
        }

        if ('trade' in notification) {
            const trade = notification.trade;
            return `${header}${notification.message}\n\nTrade Details:\n` +
                `Exchange: ${trade.exchange}\n` +
                `Symbol: ${trade.symbol}\n` +
                `Side: ${trade.side}\n` +
                `Size: ${trade.size}\n` +
                `Price: ${trade.price}\n` +
                `Timestamp: ${notification.timestamp}`;
        }

        return `${header}${notification.message}`;
    }

    private async sendToTelegram(message: string): Promise<void> {
        try {
            const botToken = this.config.telegram?.botToken;
            const chatId = this.config.telegram?.chatId;

            if (!botToken || !chatId) {
                logger.warn("Telegram notifications not configured properly. Missing botToken or chatId");
                return;
            }

            const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
            logger.debug("Sending Telegram notification:", message, { chatId, url });

            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: "HTML"
                })
            });

            if (!response.ok) {
                throw new Error(`Telegram API error: ${response.statusText}`);
            }

            const result = await response.json();
            logger.debug("Telegram notification sent successfully:", result);
        } catch (error) {
            logger.error("Error sending Telegram notification:", error);
        }
    }
} 
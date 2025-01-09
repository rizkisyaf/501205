import { createConnector } from './connectors';
import { defaultConfig } from './defaultConfig';
import { FundingArbitrageAgent } from './agent/FundingArbitrageAgent';
import { logger } from './utils/logger';
import { ExchangeConfig } from './types';
import { NotificationService } from './services/NotificationService';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the correct path
const envPath = resolve(__dirname, '../.env');
logger.debug(`Loading environment variables from: ${envPath}`);
dotenv.config({ path: envPath });

// Debug environment variables
logger.debug('Environment variables:', {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ? 'present' : 'missing',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ? 'present' : 'missing',
    BINANCE_API_KEY: process.env.BINANCE_API_KEY ? 'present' : 'missing',
    BINANCE_API_SECRET: process.env.BINANCE_API_SECRET ? 'present' : 'missing',
    USE_TESTNET: process.env.USE_TESTNET
});

// Update defaultConfig with environment variables
defaultConfig.notifications.telegram = {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || ''
};

defaultConfig.exchanges.binance = {
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_API_SECRET || '',
    testnet: process.env.USE_TESTNET === 'true'
};

defaultConfig.exchanges.bybit = {
    apiKey: process.env.BYBIT_API_KEY || '',
    apiSecret: process.env.BYBIT_API_SECRET || '',
    testnet: process.env.USE_TESTNET === 'true'
};

export async function main() {
    try {
        logger.info("Starting funding arbitrage bot...");
        logger.info("Configuration:", {
            symbols: defaultConfig.symbols,
            exchanges: Object.keys(defaultConfig.exchanges),
            monitoringInterval: defaultConfig.monitoringInterval,
            tradingEnabled: defaultConfig.tradingEnabled
        });

        // Test Telegram notifications first
        logger.info("Testing Telegram notifications...");
        logger.debug("Telegram configuration:", {
            botToken: defaultConfig.notifications.telegram.botToken ? 'present' : 'missing',
            chatId: defaultConfig.notifications.telegram.chatId ? 'present' : 'missing',
            botTokenLength: defaultConfig.notifications.telegram.botToken?.length || 0,
            chatIdLength: defaultConfig.notifications.telegram.chatId?.length || 0
        });

        const notificationService = new NotificationService(defaultConfig.notifications);

        await notificationService.sendSystemNotification({
            type: "system_start",
            message: "Testing Telegram notifications. If you see this, the bot is working!",
            timestamp: new Date().toISOString()
        });

        logger.info("Initializing exchange connectors...");
        const connectors = new Map();
        for (const [exchange, config] of Object.entries(defaultConfig.exchanges)) {
            logger.info(`Setting up ${exchange} connector...`, {
                testnet: config.testnet,
                apiKeyLength: config.apiKey?.length || 0
            });
            const connector = createConnector(exchange, {
                apiKey: config.apiKey || '',
                apiSecret: config.apiSecret || '',
                testnet: config.testnet || false,
            } as ExchangeConfig);
            connectors.set(exchange, connector);
        }

        logger.info("Starting arbitrage agent...");
        const agent = new FundingArbitrageAgent(defaultConfig, connectors);
        await agent.start();

        logger.info("Agent started successfully. Press Ctrl+C to stop.");

        // Keep the process running
        process.on('SIGINT', async () => {
            logger.info('Shutting down...');
            await agent.stop();
            process.exit(0);
        });
    } catch (error) {
        logger.error('Error starting the agent:', error);
        process.exit(1);
    }
} 
import { PluginConfig } from "./config";

export const defaultConfig: PluginConfig = {
    // Exchange settings
    exchanges: {
        binance: {
            apiKey: process.env.BINANCE_API_KEY || "",
            apiSecret: process.env.BINANCE_API_SECRET || "",
            testnet: process.env.BINANCE_TESTNET === "true",
        },
        bybit: {
            apiKey: process.env.BYBIT_API_KEY || "",
            apiSecret: process.env.BYBIT_API_SECRET || "",
            testnet: process.env.BYBIT_TESTNET === "true",
        },
        okx: {
            apiKey: process.env.OKX_API_KEY || "",
            apiSecret: process.env.OKX_API_SECRET || "",
            testnet: process.env.OKX_TESTNET === "true",
        },
    },
    symbols: ["BTC-USDT", "ETH-USDT"],

    // Trading parameters
    initialBalance: 10000, // 10,000 USDT
    basePositionSize: 1000, // 1,000 USDT
    maxPositionSize: 10000, // 10,000 USDT
    maxPositionSizePercent: 10, // 10% of balance
    maxSizeMultiplier: 1.5, // Maximum size multiplier based on funding rate difference
    defaultLeverage: 1, // Default leverage
    minFundingDiff: 0.001, // 0.1% minimum funding rate difference
    minProfitThreshold: 100, // Minimum profit in USDT

    // Risk management
    riskManagement: {
        maxLeverage: 3,
        maxPositionsPerSymbol: 2,
        maxTotalPositions: 6,
        maxDrawdown: 0.1, // 10% maximum drawdown
        takeProfitPercentage: 0.05, // 5% take profit
        stopLossPercentage: 0.02, // 2% stop loss
    },

    // Notifications
    notifications: {
        telegram: {
            botToken: process.env.TELEGRAM_BOT_TOKEN || "",
            chatId: process.env.TELEGRAM_CHAT_ID || "",
        },
        discord: {
            webhookUrl: process.env.DISCORD_WEBHOOK || "",
        },
    },

    // Monitoring settings
    monitoringInterval: 60000, // 1 minute
    tradingEnabled: true,
}; 
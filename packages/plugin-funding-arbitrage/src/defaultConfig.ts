import { PluginConfig } from './config';

export const defaultConfig: PluginConfig = {
    // Exchange settings
    exchanges: {
        binance: {
            apiKey: process.env.BINANCE_API_KEY,
            apiSecret: process.env.BINANCE_API_SECRET,
            testnet: process.env.USE_TESTNET === "true",
        },
        bybit: {
            apiKey: process.env.BYBIT_API_KEY,
            apiSecret: process.env.BYBIT_API_SECRET,
            testnet: process.env.USE_TESTNET === "true",
        }
    },
    
    // Trading pairs to monitor
    symbols: ['BTC-PERP', 'ETH-PERP'],
    
    // Screener settings
    screener: {
        enabled: true,
        refreshInterval: 5000, // 5 seconds
        maxOpportunities: 10, // Top 10 opportunities
        minSpreadThreshold: 0.0005, // 0.05% minimum spread
        syncThreshold: 60000, // 60 seconds max data age
    },

    // Trading parameters - adjusted for testnet
    initialBalance: 1000, // 1,000 USDT for testnet
    basePositionSize: 100, // 100 USDT for testnet
    maxPositionSize: 1000, // 1,000 USDT for testnet
    maxPositionSizePercent: 50, // 50% of balance for testnet
    maxSizeMultiplier: 2.0, // Maximum size multiplier based on funding rate difference
    defaultLeverage: 2, // Default leverage
    minFundingDiff: 0.0005, // 0.05% minimum funding rate difference for testnet
    minProfitThreshold: 10, // 10 USDT minimum profit for testnet

    // Risk management - adjusted for testnet
    riskManagement: {
        maxLeverage: 3,
        maxPositionsPerSymbol: 2,
        maxTotalPositions: 4,
        maxDrawdown: 0.2, // 20% maximum drawdown for testnet
        takeProfitPercentage: 0.02, // 2% take profit
        stopLossPercentage: 0.01, // 1% stop loss
    },

    // Notifications
    notifications: {
        enabled: true,
        telegram: {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID,
        }
    },

    // Monitoring settings
    monitoringInterval: 60000, // 1 minute
    tradingEnabled: true, // Enable trading
}; 
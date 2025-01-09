import { NotificationConfig } from './services/NotificationService';

export interface PluginConfig {
    exchanges: {
        [key: string]: {
            apiKey?: string;
            apiSecret?: string;
            testnet?: boolean;
        };
    };
    
    symbols: string[];
    
    screener: {
        enabled: boolean;
        refreshInterval: number;
        maxOpportunities: number;
        minSpreadThreshold: number;
        syncThreshold: number;
    };

    initialBalance: number;
    basePositionSize: number;
    maxPositionSize: number;
    maxPositionSizePercent: number;
    maxSizeMultiplier: number;
    defaultLeverage: number;
    minFundingDiff: number;
    minProfitThreshold: number;

    riskManagement: {
        maxLeverage: number;
        maxPositionsPerSymbol: number;
        maxTotalPositions: number;
        maxDrawdown: number;
        takeProfitPercentage: number;
        stopLossPercentage: number;
    };

    notifications: {
        enabled: boolean;
        telegram?: {
            botToken?: string;
            chatId?: string;
        };
    };

    monitoringInterval: number;
    tradingEnabled: boolean;
}

export const DEFAULT_CONFIG: PluginConfig = {
    exchanges: {
        binance: {
            apiKey: process.env.BINANCE_API_KEY || '',
            apiSecret: process.env.BINANCE_API_SECRET || '',
            testnet: true
        },
        bybit: {
            apiKey: process.env.BYBIT_API_KEY || '',
            apiSecret: process.env.BYBIT_API_SECRET || '',
            testnet: true
        }
    },
    screener: {
        enabled: true,
        refreshInterval: 60000,
        maxOpportunities: 5,
        minSpreadThreshold: 0.001,
        syncThreshold: 0.0005
    },
    initialBalance: 10000,
    basePositionSize: 1000,
    maxPositionSize: 10000,
    maxPositionSizePercent: 10,
    maxSizeMultiplier: 1.5,
    defaultLeverage: 1,
    minFundingDiff: 0.001,
    minProfitThreshold: 100,
    riskManagement: {
        maxLeverage: 10,
        maxPositionsPerSymbol: 2,
        maxTotalPositions: 6,
        maxDrawdown: 0.1,
        takeProfitPercentage: 0.01,
        stopLossPercentage: 0.02
    },
    notifications: {
        enabled: true,
        telegram: {
            botToken: process.env.TELEGRAM_BOT_TOKEN || '',
            chatId: process.env.TELEGRAM_CHAT_ID || ''
        }
    },
    monitoringInterval: 60000,
    tradingEnabled: true,
    symbols: ['BTC-PERP', 'ETH-PERP', 'SOL-PERP']
}; 
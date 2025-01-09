import { z } from 'zod';
import { ExchangeConfig } from './types';

export const FundingArbitrageConfigSchema = z.object({
    symbols: z.array(z.string()),
    exchanges: z.record(z.string(), z.object({
        apiKey: z.string(),
        apiSecret: z.string(),
        testnet: z.boolean().optional(),
        passphrase: z.string().optional()
    })),
    basePositionSize: z.number().min(0),
    maxPositionSize: z.number().min(0),
    maxPositionSizePercent: z.number().min(0).max(1),
    maxSizeMultiplier: z.number().min(1),
    minFundingDiff: z.number().min(0),
    minProfitThreshold: z.number().min(0),
    defaultLeverage: z.number().min(1).max(100),
    initialBalance: z.number().min(0),
    riskManagement: z.object({
        maxPositionSize: z.number().min(0),
        maxPositionsPerSymbol: z.number().min(0),
        maxTotalPositions: z.number().min(0),
        maxLeverage: z.number().min(1),
        maxDrawdown: z.number().min(0).max(1),
        stopLossPercentage: z.number().min(0).max(100),
        takeProfitPercentage: z.number().min(0),
        maxDrawdownPercentage: z.number().min(0).max(100)
    }),
    notifications: z.object({
        enabled: z.boolean(),
        telegram: z.object({
            botToken: z.string().optional(),
            chatId: z.string().optional()
        }).optional(),
        discord: z.object({
            webhookUrl: z.string().optional()
        }).optional()
    }),
    monitoringInterval: z.number().min(1000),
    tradingEnabled: z.boolean()
});

export type FundingArbitrageConfig = z.infer<typeof FundingArbitrageConfigSchema>;

export const DEFAULT_CONFIG: FundingArbitrageConfig = {
    symbols: ['BTC-PERP', 'ETH-PERP'],
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
        },
        okx: {
            apiKey: process.env.OKX_API_KEY || '',
            apiSecret: process.env.OKX_API_SECRET || '',
            passphrase: process.env.OKX_PASSPHRASE || '',
            testnet: true
        }
    },
    basePositionSize: 100,
    maxPositionSize: 1000,
    maxPositionSizePercent: 0.1,
    maxSizeMultiplier: 1.5,
    minFundingDiff: 0.001, // 0.1%
    minProfitThreshold: 0.002, // 0.2%
    defaultLeverage: 3,
    initialBalance: 1000,
    riskManagement: {
        maxPositionSize: 1000,
        maxPositionsPerSymbol: 2,
        maxTotalPositions: 6,
        maxLeverage: 3,
        maxDrawdown: 0.1,
        stopLossPercentage: 2,
        takeProfitPercentage: 5,
        maxDrawdownPercentage: 10
    },
    notifications: {
        enabled: true,
        telegram: {
            botToken: process.env.TELEGRAM_BOT_TOKEN,
            chatId: process.env.TELEGRAM_CHAT_ID
        },
        discord: {
            webhookUrl: process.env.DISCORD_WEBHOOK
        }
    },
    monitoringInterval: 60000,
    tradingEnabled: true
}; 
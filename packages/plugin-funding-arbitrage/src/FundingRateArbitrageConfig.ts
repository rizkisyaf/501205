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
    }).required(),
    notifications: z.object({
        enabled: z.boolean(),
        telegram: z.object({
            botToken: z.string().optional(),
            chatId: z.string().optional()
        }).optional(),
        discord: z.object({
            webhookUrl: z.string().optional()
        }).optional()
    }).required(),
    monitoringInterval: z.number().min(1000),
    tradingEnabled: z.boolean()
}); 
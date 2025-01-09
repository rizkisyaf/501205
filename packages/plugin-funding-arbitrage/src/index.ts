import { FundingArbitrageAgent } from './agent/FundingArbitrageAgent';
import { DEFAULT_CONFIG } from './config';
import type { ExchangeConnector, MarketData, TradeRequest, ExchangeConfig } from './connectors';
import { BinanceConnector, BybitConnector, OKXConnector, createConnector } from './connectors';
import type { Position } from './types';
import { MarketDataService } from './services/MarketDataService';
import { RiskManagementService } from './services/RiskManagementService';
import { NotificationService } from './services/NotificationService';
import { TradeExecutionService } from './services/TradeExecutionService';
import { logger } from './utils/logger';
import { main } from './example';

// Run the main function
main().catch(error => {
    logger.error('Unhandled error:', error);
    process.exit(1);
});

export {
    FundingArbitrageAgent,
    DEFAULT_CONFIG,
    ExchangeConnector,
    MarketData,
    TradeRequest,
    ExchangeConfig,
    BinanceConnector,
    BybitConnector,
    OKXConnector,
    createConnector,
    Position,
    MarketDataService,
    RiskManagementService,
    NotificationService,
    TradeExecutionService
};

interface Plugin {
    name: string;
    description: string;
    actions: any[];
    providers: any[];
    evaluators: any[];
    services: any[];
    clients: any[];
}

const manifest: Plugin = {
    name: 'funding-arbitrage',
    description: 'A plugin for funding rate arbitrage between different perpetual markets',
    actions: [],
    providers: [],
    evaluators: [],
    services: [],
    clients: []
};

export default manifest; 
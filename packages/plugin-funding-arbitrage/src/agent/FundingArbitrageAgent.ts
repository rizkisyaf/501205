import { logger } from "../utils/logger";
import { PluginConfig } from "../config";
import { ExchangeConnector } from "../connectors";
import { MarketDataService } from "../services/MarketDataService";
import { RiskManagementService } from "../services/RiskManagementService";
import { NotificationService } from "../services/NotificationService";
import { TradeExecutionService } from "../services/TradeExecutionService";
import { Position } from "../types";
import { FundingRateScreener } from "../FundingRateScreener";
import Decimal from "decimal.js";
import { DateTime } from "luxon";

export class FundingArbitrageAgent {
    private config: PluginConfig;
    private connectors: Map<string, ExchangeConnector>;
    private marketDataService: MarketDataService;
    private riskManagementService: RiskManagementService;
    private notificationService: NotificationService;
    private tradeExecutionService: TradeExecutionService;
    private screener: FundingRateScreener;
    private isRunning: boolean = false;
    private monitoringInterval: NodeJS.Timeout | null = null;

    constructor(
        config: PluginConfig,
        connectors: Map<string, ExchangeConnector>
    ) {
        this.config = config;
        this.connectors = connectors;
        this.marketDataService = new MarketDataService(connectors);
        this.riskManagementService = new RiskManagementService(
            config.riskManagement,
            config.initialBalance
        );
        this.notificationService = new NotificationService({
            enabled: true,
            telegram: config.notifications.telegram
        });
        this.tradeExecutionService = new TradeExecutionService(
            connectors,
            this.riskManagementService,
            this.notificationService
        );
        this.screener = new FundingRateScreener();

        // Listen for screener updates
        this.screener.on('update', (opportunities) => {
            logger.info('New opportunities found:', opportunities);
        });
    }

    async start(): Promise<void> {
        if (this.isRunning) {
            logger.warn("Agent is already running");
            return;
        }

        try {
            this.isRunning = true;
            await this.notificationService.sendSystemNotification({
                type: "system_start",
                message: "Funding arbitrage agent started",
                timestamp: DateTime.now().toISO()
            });

            // Start screener auto-refresh
            if (this.config.screener.enabled) {
                this.screener.startAutoRefresh(this.config.screener.refreshInterval);
            }

            // Start monitoring loop
            this.monitoringInterval = setInterval(
                () => this.monitor(),
                this.config.monitoringInterval
            );

            logger.info("Agent started successfully");
        } catch (error) {
            this.isRunning = false;
            logger.error("Error starting agent:", error);
            await this.notificationService.sendErrorNotification({
                type: "system_error",
                message: "Error starting agent",
                error: error instanceof Error ? error.message : String(error),
                timestamp: DateTime.now().toISO()
            });
            throw error;
        }
    }

    async stop(): Promise<void> {
        if (!this.isRunning) {
            logger.warn("Agent is not running");
            return;
        }

        try {
            this.isRunning = false;
            if (this.monitoringInterval) {
                clearInterval(this.monitoringInterval);
                this.monitoringInterval = null;
            }

            await this.notificationService.sendSystemNotification({
                type: "system_stop",
                message: "Funding arbitrage agent stopped",
                timestamp: DateTime.now().toISO()
            });

            logger.info("Agent stopped successfully");
        } catch (error) {
            logger.error("Error stopping agent:", error);
            await this.notificationService.sendErrorNotification({
                type: "system_error",
                message: "Error stopping agent",
                error: error instanceof Error ? error.message : String(error),
                timestamp: DateTime.now().toISO()
            });
            throw error;
        }
    }

    private async monitor(): Promise<void> {
        try {
            // Get top opportunities from screener
            const opportunities = this.screener.getTopOpportunities(this.config.screener.maxOpportunities);

            // Filter opportunities based on minimum spread threshold
            const validOpportunities = opportunities.filter(opp => 
                opp.rawSpread >= this.config.screener.minSpreadThreshold &&
                opp.synced
            );

            // Process opportunities
            for (const opportunity of validOpportunities) {
                logger.info("Found arbitrage opportunity:", {
                    symbol: opportunity.symbol,
                    longExchange: opportunity.longExchange,
                    shortExchange: opportunity.shortExchange,
                    fundingDiff: opportunity.rawSpread.toString(),
                    expectedProfit: (opportunity.rawSpread * this.config.basePositionSize).toString()
                });

                if (this.config.tradingEnabled) {
                    await this.executeArbitrage({
                        symbol: opportunity.symbol,
                        longExchange: opportunity.longExchange,
                        shortExchange: opportunity.shortExchange,
                        fundingDiff: new Decimal(opportunity.rawSpread),
                        expectedProfit: new Decimal(opportunity.rawSpread).mul(this.config.basePositionSize)
                    });
                }
            }

            // Update positions and check for take profit / stop loss
            await this.managePositions();
        } catch (error) {
            logger.error("Error in monitoring loop:", error);
            await this.notificationService.sendErrorNotification({
                type: "system_error",
                message: "Error in monitoring loop",
                error: error instanceof Error ? error.message : String(error),
                timestamp: DateTime.now().toISO()
            });
        }
    }

    private async executeArbitrage(opportunity: any): Promise<void> {
        try {
            const baseSize = new Decimal(this.config.basePositionSize);
            const maxSize = new Decimal(this.config.maxPositionSize);
            const sizeMultiplier = new Decimal(opportunity.expectedProfit)
                .mul(this.config.maxSizeMultiplier)
                .plus(1);

            const tradeSize = Decimal.min(
                baseSize.mul(sizeMultiplier),
                maxSize
            );

            const longRequest = {
                symbol: opportunity.symbol,
                exchange: opportunity.longExchange,
                side: "long" as const,
                size: tradeSize,
                leverage: this.config.defaultLeverage
            };

            const shortRequest = {
                symbol: opportunity.symbol,
                exchange: opportunity.shortExchange,
                side: "short" as const,
                size: tradeSize,
                leverage: this.config.defaultLeverage
            };

            await this.tradeExecutionService.executeArbitrageTrade(
                longRequest,
                shortRequest
            );
        } catch (error) {
            logger.error("Error executing arbitrage:", error);
            await this.notificationService.sendErrorNotification({
                type: "trade_error",
                message: "Error executing arbitrage",
                error: error instanceof Error ? error.message : String(error),
                timestamp: DateTime.now().toISO()
            });
        }
    }

    private async managePositions(): Promise<void> {
        try {
            const positions = await this.getAllPositions();
            this.riskManagementService.updateMetrics(positions);

            for (const position of positions) {
                const marketData = this.marketDataService.getLatestMarketData(
                    position.symbol,
                    position.exchange
                );

                if (!marketData) {
                    continue;
                }

                // Check take profit
                if (this.riskManagementService.shouldTakeProfit(position)) {
                    await this.closePosition(position);
                    continue;
                }

                // Check stop loss
                if (this.riskManagementService.shouldStopLoss(position)) {
                    await this.closePosition(position);
                    continue;
                }
            }
        } catch (error) {
            logger.error("Error managing positions:", error);
            await this.notificationService.sendErrorNotification({
                type: "system_error",
                message: "Error managing positions",
                error: error instanceof Error ? error.message : String(error),
                timestamp: DateTime.now().toISO()
            });
        }
    }

    private async getAllPositions(): Promise<Position[]> {
        const positions: Position[] = [];
        for (const [exchange, connector] of this.connectors) {
            // Get all symbols from screener opportunities
            const opportunities = this.screener.getTopOpportunities();
            const symbols = [...new Set(opportunities.map(opp => opp.symbol))];
            
            // Get positions for each symbol
            for (const symbol of symbols) {
                const position = await connector.getPosition(symbol);
                if (position) {
                    positions.push(position);
                }
            }
        }
        return positions;
    }

    private async closePosition(position: Position): Promise<void> {
        try {
            const connector = this.connectors.get(position.exchange);
            if (!connector) {
                throw new Error(`No connector found for exchange ${position.exchange}`);
            }

            const success = await connector.closePosition(position.symbol);
            if (!success) {
                throw new Error(`Failed to close position for ${position.symbol} on ${position.exchange}`);
            }

            await this.notificationService.sendTradeNotification({
                type: "trade_closed",
                message: `Closed position for ${position.symbol} on ${position.exchange}`,
                trade: {
                    exchange: position.exchange,
                    symbol: position.symbol,
                    side: position.side,
                    size: position.size.toString(),
                    price: position.entryPrice.toString()
                },
                timestamp: DateTime.now().toISO()
            });
        } catch (error) {
            logger.error("Error closing position:", error);
            await this.notificationService.sendErrorNotification({
                type: "trade_error",
                message: "Error closing position",
                error: error instanceof Error ? error.message : String(error),
                timestamp: DateTime.now().toISO()
            });
        }
    }
} 
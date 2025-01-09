import { logger } from "../utils/logger";
import { PluginConfig } from "../config";
import { ExchangeConnector } from "../connectors";
import { MarketDataService } from "../services/MarketDataService";
import { RiskManagementService, RiskManagementConfig } from "../services/RiskManagementService";
import { NotificationService, NotificationConfig } from "../services/NotificationService";
import { TradeExecutionService } from "../services/TradeExecutionService";
import { Position } from "../types";
import Decimal from "decimal.js";
import { DateTime } from "luxon";

export class FundingArbitrageAgent {
    private config: PluginConfig;
    private connectors: Map<string, ExchangeConnector>;
    private marketDataService: MarketDataService;
    private riskManagementService: RiskManagementService;
    private notificationService: NotificationService;
    private tradeExecutionService: TradeExecutionService;
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
            config.riskManagement as RiskManagementConfig,
            config.initialBalance
        );
        this.notificationService = new NotificationService({
            enabled: true,
            ...config.notifications
        });
        this.tradeExecutionService = new TradeExecutionService(
            connectors,
            this.riskManagementService,
            this.notificationService
        );
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

            // Initial market data update
            await this.marketDataService.fetchMarketData(this.config.symbols);

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
                message: `Error starting agent: ${error}`,
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
                message: `Error stopping agent: ${error}`,
                timestamp: DateTime.now().toISO()
            });
            throw error;
        }
    }

    private async monitor(): Promise<void> {
        try {
            // Update market data
            await this.marketDataService.fetchMarketData(this.config.symbols);

            // Find arbitrage opportunities
            const opportunities = this.marketDataService.findArbitrageOpportunities(
                this.config.symbols,
                this.config.minFundingDiff,
                this.config.minProfitThreshold
            );

            // Sort opportunities by expected profit
            opportunities.sort((a, b) =>
                b.expectedProfit.minus(a.expectedProfit).toNumber()
            );

            // Process opportunities
            for (const opportunity of opportunities) {
                logger.info("Found arbitrage opportunity:", {
                    symbol: opportunity.symbol,
                    longExchange: opportunity.longExchange,
                    shortExchange: opportunity.shortExchange,
                    fundingDiff: opportunity.fundingDiff.toString(),
                    expectedProfit: opportunity.expectedProfit.toString()
                });

                if (this.config.tradingEnabled) {
                    await this.executeArbitrage(opportunity);
                }
            }

            // Update positions and check for take profit / stop loss
            await this.managePositions();
        } catch (error) {
            logger.error("Error in monitoring loop:", error);
            await this.notificationService.sendErrorNotification({
                type: "system_error",
                message: `Error in monitoring loop: ${error}`,
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
                message: `Error executing arbitrage: ${error}`,
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
                message: `Error managing positions: ${error}`,
                timestamp: DateTime.now().toISO()
            });
        }
    }

    private async getAllPositions(): Promise<Position[]> {
        const positions: Position[] = [];
        for (const [exchange, connector] of this.connectors) {
            for (const symbol of this.config.symbols) {
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

            await connector.closePosition(position.symbol);
        } catch (error) {
            logger.error("Error closing position:", error);
            await this.notificationService.sendErrorNotification({
                type: "trade_error",
                message: `Error closing position: ${error}`,
                timestamp: DateTime.now().toISO()
            });
        }
    }
} 
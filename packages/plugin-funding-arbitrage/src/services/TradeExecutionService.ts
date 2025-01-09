import { logger } from "../utils/logger";
import { ExchangeConnector, TradeRequest } from "../connectors";
import { Position } from "../types";
import { RiskManagementService, TradeValidation } from "./RiskManagementService";
import { NotificationService } from "./NotificationService";
import Decimal from "decimal.js";
import { DateTime } from "luxon";

export class TradeExecutionService {
    private positions: Map<string, Position> = new Map();
    private connectors: Map<string, ExchangeConnector>;
    private riskService: RiskManagementService;
    private notificationService: NotificationService;

    constructor(
        connectors: Map<string, ExchangeConnector>,
        riskService: RiskManagementService,
        notificationService: NotificationService
    ) {
        this.connectors = connectors;
        this.riskService = riskService;
        this.notificationService = notificationService;
    }

    async executeArbitrageTrade(
        longTrade: TradeRequest,
        shortTrade: TradeRequest
    ): Promise<boolean> {
        try {
            // Validate trades
            const longValidation: TradeValidation = {
                symbol: longTrade.symbol,
                size: longTrade.size,
                leverage: longTrade.leverage,
                currentPrice: longTrade.limitPrice || new Decimal(0),
                unrealizedPnl: new Decimal(0)
            };

            const shortValidation: TradeValidation = {
                symbol: shortTrade.symbol,
                size: shortTrade.size,
                leverage: shortTrade.leverage,
                currentPrice: shortTrade.limitPrice || new Decimal(0),
                unrealizedPnl: new Decimal(0)
            };

            const longValid = this.riskService.validateTrade(longValidation);
            const shortValid = this.riskService.validateTrade(shortValidation);

            if (!longValid || !shortValid) {
                logger.warn("Trade validation failed");
                return false;
            }

            // Execute trades
            const longConnector = this.connectors.get(longTrade.exchange);
            const shortConnector = this.connectors.get(shortTrade.exchange);

            if (!longConnector || !shortConnector) {
                logger.error("Connector not found for one or both exchanges");
                return false;
            }

            const [longPosition, shortPosition] = await Promise.all([
                longConnector.executeTrade(longTrade),
                shortConnector.executeTrade(shortTrade)
            ]);

            // Store positions
            const longKey = `${longTrade.exchange}:${longTrade.symbol}:long`;
            const shortKey = `${shortTrade.exchange}:${shortTrade.symbol}:short`;

            this.positions.set(longKey, longPosition);
            this.positions.set(shortKey, shortPosition);

            await this.notificationService.sendTradeNotification({
                type: "trade_executed",
                message: `Arbitrage trade executed for ${longTrade.symbol}`,
                timestamp: DateTime.now().toISO(),
                trade: {
                    exchange: longTrade.exchange,
                    symbol: longTrade.symbol,
                    side: longTrade.side,
                    size: longTrade.size.toString(),
                    price: longTrade.limitPrice?.toString() || "market"
                },
                details: {
                    longExchange: longTrade.exchange,
                    shortExchange: shortTrade.exchange,
                    symbol: longTrade.symbol,
                    size: longTrade.size.toString(),
                    leverage: longTrade.leverage
                }
            });

            return true;
        } catch (error) {
            logger.error("Error executing arbitrage trade:", error);
            await this.notificationService.sendErrorNotification({
                type: "trade_error",
                message: "Error executing arbitrage trade",
                error: error instanceof Error ? error.message : String(error),
                timestamp: DateTime.now().toISO()
            });
            return false;
        }
    }

    getPosition(symbol: string, exchange: string, side: "long" | "short"): Position | undefined {
        return this.positions.get(`${exchange}:${symbol}:${side}`);
    }

    getActivePositions(): Position[] {
        return Array.from(this.positions.values());
    }
} 
import { logger } from "../utils/logger";
import { Position } from "../types";
import Decimal from "decimal.js";

export interface RiskMetrics {
    totalPositions: number;
    totalExposure: Decimal;
    maxDrawdown: Decimal;
    currentDrawdown: Decimal;
    positionsPerSymbol: Map<string, number>;
}

export interface TradeValidation {
    symbol: string;
    size: Decimal;
    leverage: number;
    currentPrice: Decimal;
    unrealizedPnl: Decimal;
}

export interface RiskManagementConfig {
    maxPositionSize: number;
    maxPositionsPerSymbol: number;
    maxTotalPositions: number;
    maxLeverage: number;
    maxDrawdown: number;
    stopLossPercentage: number;
    takeProfitPercentage: number;
    maxDrawdownPercentage: number;
}

export class RiskManagementService {
    private metrics: RiskMetrics;
    private maxPositionSize: Decimal;
    private maxPositionsPerSymbol: number;
    private maxTotalPositions: number;
    private maxLeverage: number;
    private maxDrawdown: Decimal;
    private stopLossPercentage: Decimal;
    private takeProfitPercentage: Decimal;
    private initialBalance: Decimal;

    constructor(config: RiskManagementConfig, initialBalance: number) {
        this.maxPositionSize = new Decimal(config.maxPositionSize);
        this.maxPositionsPerSymbol = config.maxPositionsPerSymbol;
        this.maxTotalPositions = config.maxTotalPositions;
        this.maxLeverage = config.maxLeverage;
        this.maxDrawdown = new Decimal(config.maxDrawdown);
        this.stopLossPercentage = new Decimal(config.stopLossPercentage).div(100);
        this.takeProfitPercentage = new Decimal(config.takeProfitPercentage).div(100);
        this.initialBalance = new Decimal(initialBalance);

        this.metrics = {
            totalPositions: 0,
            totalExposure: new Decimal(0),
            maxDrawdown: new Decimal(0),
            currentDrawdown: new Decimal(0),
            positionsPerSymbol: new Map()
        };
    }

    validateTrade(request: TradeValidation): boolean {
        // Check position size
        if (request.size.gt(this.maxPositionSize)) {
            logger.warn("Trade rejected: Position size exceeds maximum");
            return false;
        }

        // Check leverage
        if (request.leverage > this.maxLeverage) {
            logger.warn("Trade rejected: Leverage exceeds maximum");
            return false;
        }

        // Check positions per symbol
        const currentPositions = this.metrics.positionsPerSymbol.get(request.symbol) || 0;
        if (currentPositions >= this.maxPositionsPerSymbol) {
            logger.warn("Trade rejected: Maximum positions per symbol reached");
            return false;
        }

        // Check total positions
        if (this.metrics.totalPositions >= this.maxTotalPositions) {
            logger.warn("Trade rejected: Maximum total positions reached");
            return false;
        }

        // Check drawdown
        const potentialDrawdown = this.calculatePotentialDrawdown(request);
        if (potentialDrawdown.gt(this.maxDrawdown)) {
            logger.warn("Trade rejected: Potential drawdown exceeds maximum");
            return false;
        }

        return true;
    }

    shouldTakeProfit(position: Position): boolean {
        const unrealizedPnlPercent = position.unrealizedPnl.div(
            position.size.mul(position.entryPrice)
        );
        return unrealizedPnlPercent.gte(this.takeProfitPercentage);
    }

    shouldStopLoss(position: Position): boolean {
        const unrealizedPnlPercent = position.unrealizedPnl.div(
            position.size.mul(position.entryPrice)
        );
        return unrealizedPnlPercent.lte(this.stopLossPercentage.neg());
    }

    updateMetrics(positions: Position[]): void {
        const positionsPerSymbol = new Map<string, number>();
        let totalExposure = new Decimal(0);

        for (const position of positions) {
            // Update positions per symbol
            const currentCount = positionsPerSymbol.get(position.symbol) || 0;
            positionsPerSymbol.set(position.symbol, currentCount + 1);

            // Update total exposure
            totalExposure = totalExposure.add(
                position.size.mul(position.entryPrice).mul(position.leverage)
            );
        }

        this.metrics = {
            totalPositions: positions.length,
            totalExposure,
            maxDrawdown: this.calculateMaxDrawdown(positions),
            currentDrawdown: this.calculateCurrentDrawdown(positions),
            positionsPerSymbol
        };
    }

    private calculatePotentialDrawdown(request: TradeValidation): Decimal {
        const positionValue = request.size.mul(request.currentPrice);
        const maxLoss = positionValue.mul(request.leverage).mul(this.stopLossPercentage);
        return maxLoss.div(this.initialBalance);
    }

    private calculateMaxDrawdown(positions: Position[]): Decimal {
        let maxDrawdown = new Decimal(0);
        for (const position of positions) {
            const drawdown = position.unrealizedPnl.div(this.initialBalance);
            if (drawdown.lt(maxDrawdown)) {
                maxDrawdown = drawdown;
            }
        }
        return maxDrawdown;
    }

    private calculateCurrentDrawdown(positions: Position[]): Decimal {
        const totalPnl = positions.reduce(
            (sum, position) => sum.add(position.unrealizedPnl),
            new Decimal(0)
        );
        return totalPnl.div(this.initialBalance);
    }

    getMetrics(): RiskMetrics {
        return this.metrics;
    }
} 
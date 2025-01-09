import { ExchangeConnector, MarketData, TradeRequest, ExchangeConfig } from "./index";
import { Position } from "../types";
import Decimal from "decimal.js";
import { logger } from "../utils/logger";
import { DateTime } from "luxon";

interface BinanceTickerResponse {
    symbol: string;
    lastPrice: string;
    volume: string;
    time: number;
}

interface BinancePremiumIndexResponse {
    symbol: string;
    lastFundingRate: string;
    nextFundingTime: number;
}

interface BinanceOrderResponse {
    symbol: string;
    orderId: number;
    avgPrice: string;
    executedQty: string;
    status: string;
}

interface BinancePositionResponse {
    symbol: string;
    positionAmt: string;
    entryPrice: string;
    unRealizedProfit: string;
    leverage: string;
    updateTime: number;
}

interface BinanceBalanceResponse {
    asset: string;
    balance: string;
    availableBalance: string;
}

export class BinanceConnector implements ExchangeConnector {
    readonly exchange = "binance";
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly testnet: boolean;
    private readonly baseUrl: string;

    constructor(config: ExchangeConfig) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.testnet = config.testnet || false;
        this.baseUrl = this.testnet
            ? "https://testnet.binancefuture.com"
            : "https://fapi.binance.com";
    }

    async fetchMarketData(symbol: string): Promise<MarketData> {
        try {
            const response = await fetch(`${this.baseUrl}/fapi/v1/ticker/24hr?symbol=${symbol}`);
            if (!response.ok) {
                throw new Error(`Binance API error: ${response.statusText}`);
            }
            const data = await response.json() as BinanceTickerResponse;
            
            const fundingRate = await this.fetchFundingRate(symbol);
            
            return {
                symbol,
                exchange: this.exchange,
                lastPrice: new Decimal(data.lastPrice),
                fundingRate,
                timestamp: Date.now()
            };
        } catch (error) {
            logger.error("Error fetching Binance market data:", error);
            throw error;
        }
    }

    async fetchFundingRate(symbol: string): Promise<Decimal> {
        try {
            const response = await fetch(`${this.baseUrl}/fapi/v1/premiumIndex?symbol=${symbol}`);
            if (!response.ok) {
                throw new Error(`Binance API error: ${response.statusText}`);
            }
            const data = await response.json() as BinancePremiumIndexResponse;
            return new Decimal(data.lastFundingRate);
        } catch (error) {
            logger.error("Error fetching Binance funding rate:", error);
            throw error;
        }
    }

    async executeTrade(request: TradeRequest): Promise<Position> {
        try {
            // Set leverage first
            await this.setLeverage(request.symbol, request.leverage);

            // Create the order
            const side = request.side === "long" ? "BUY" : "SELL";
            const type = request.limitPrice ? "LIMIT" : "MARKET";
            
            const orderParams = new URLSearchParams({
                symbol: request.symbol,
                side,
                type,
                quantity: request.size.toString(),
                timestamp: Date.now().toString()
            });

            if (request.limitPrice) {
                orderParams.append("price", request.limitPrice.toString());
            }

            const signature = this.sign(orderParams.toString());
            orderParams.append("signature", signature);

            const response = await fetch(`${this.baseUrl}/fapi/v1/order`, {
                method: "POST",
                headers: {
                    "X-MBX-APIKEY": this.apiKey,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: orderParams
            });

            if (!response.ok) {
                throw new Error(`Binance API error: ${response.statusText}`);
            }

            const data = await response.json() as BinanceOrderResponse;
            
            return {
                symbol: request.symbol,
                exchange: this.exchange,
                side: request.side,
                size: request.size,
                leverage: request.leverage,
                entryPrice: new Decimal(data.avgPrice),
                unrealizedPnl: new Decimal(0),
                fundingPaid: new Decimal(0),
                openTime: DateTime.now(),
                lastUpdateTime: DateTime.now()
            };
        } catch (error) {
            logger.error("Error executing Binance trade:", error);
            throw error;
        }
    }

    async getPosition(symbol: string): Promise<Position | null> {
        try {
            const timestamp = Date.now();
            const params = new URLSearchParams({
                symbol,
                timestamp: timestamp.toString()
            });

            const signature = this.sign(params.toString());
            params.append("signature", signature);

            const response = await fetch(`${this.baseUrl}/fapi/v2/positionRisk?${params}`, {
                headers: {
                    "X-MBX-APIKEY": this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Binance API error: ${response.statusText}`);
            }

            const positions = await response.json() as BinancePositionResponse[];
            const position = positions.find(p => p.symbol === symbol && Number(p.positionAmt) !== 0);

            if (!position) {
                return null;
            }

            return {
                symbol,
                exchange: this.exchange,
                side: Number(position.positionAmt) > 0 ? "long" : "short",
                size: new Decimal(Math.abs(Number(position.positionAmt))),
                leverage: Number(position.leverage),
                entryPrice: new Decimal(position.entryPrice),
                unrealizedPnl: new Decimal(position.unRealizedProfit),
                fundingPaid: new Decimal(0), // Need to fetch separately
                openTime: DateTime.fromMillis(position.updateTime),
                lastUpdateTime: DateTime.now()
            };
        } catch (error) {
            logger.error("Error fetching Binance position:", error);
            throw error;
        }
    }

    async closePosition(symbol: string): Promise<boolean> {
        try {
            const position = await this.getPosition(symbol);
            if (!position) {
                return true; // No position to close
            }

            // Create market order in opposite direction
            const request: TradeRequest = {
                symbol,
                exchange: this.exchange,
                side: position.side === "long" ? "short" : "long",
                size: position.size,
                leverage: position.leverage
            };

            await this.executeTrade(request);
            return true;
        } catch (error) {
            logger.error("Error closing Binance position:", error);
            return false;
        }
    }

    async getBalance(): Promise<Decimal> {
        try {
            const timestamp = Date.now();
            const params = new URLSearchParams({
                timestamp: timestamp.toString()
            });

            const signature = this.sign(params.toString());
            params.append("signature", signature);

            const response = await fetch(`${this.baseUrl}/fapi/v2/balance?${params}`, {
                headers: {
                    "X-MBX-APIKEY": this.apiKey
                }
            });

            if (!response.ok) {
                throw new Error(`Binance API error: ${response.statusText}`);
            }

            const balances = await response.json() as BinanceBalanceResponse[];
            const usdtBalance = balances.find(b => b.asset === "USDT");
            return new Decimal(usdtBalance?.balance || 0);
        } catch (error) {
            logger.error("Error fetching Binance balance:", error);
            throw error;
        }
    }

    async setLeverage(symbol: string, leverage: number): Promise<boolean> {
        try {
            const timestamp = Date.now();
            const params = new URLSearchParams({
                symbol,
                leverage: leverage.toString(),
                timestamp: timestamp.toString()
            });

            const signature = this.sign(params.toString());
            params.append("signature", signature);

            const response = await fetch(`${this.baseUrl}/fapi/v1/leverage`, {
                method: "POST",
                headers: {
                    "X-MBX-APIKEY": this.apiKey,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: params
            });

            return response.ok;
        } catch (error) {
            logger.error("Error setting Binance leverage:", error);
            return false;
        }
    }

    private sign(queryString: string): string {
        const crypto = require('crypto');
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }
} 
import { ExchangeConnector, MarketData, TradeRequest, ExchangeConfig } from "./index";
import { Position } from "../types";
import Decimal from "decimal.js";
import { logger } from "../utils/logger";
import { DateTime } from "luxon";

interface OKXResponse<T> {
    code: string;
    msg: string;
    data: T;
}

interface OKXTickerData {
    instId: string;
    last: string;
    lastSz: string;
    askPx: string;
    askSz: string;
    bidPx: string;
    bidSz: string;
    open24h: string;
    high24h: string;
    low24h: string;
    volCcy24h: string;
    vol24h: string;
    ts: string;
}

interface OKXFundingRateData {
    fundingRate: string;
    fundingTime: string;
    instId: string;
    instType: string;
    nextFundingRate: string;
    nextFundingTime: string;
}

interface OKXOrderData {
    ordId: string;
    clOrdId: string;
    tag: string;
    px: string;
    sz: string;
    pnl: string;
    accFillSz: string;
    fillPx: string;
    tradeId: string;
    fillSz: string;
    fillTime: string;
    state: string;
}

interface OKXPositionData {
    instId: string;
    posSide: string;
    pos: string;
    avgPx: string;
    upl: string;
    lever: string;
    liqPx: string;
    margin: string;
    mgnMode: string;
    mmr: string;
    cTime: string;
    uTime: string;
}

interface OKXBalanceData {
    details: Array<{
        ccy: string;
        eq: string;
        cashBal: string;
        availEq: string;
    }>;
}

export class OKXConnector implements ExchangeConnector {
    readonly exchange = "okx";
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly passphrase: string;
    private readonly testnet: boolean;
    private readonly baseUrl: string;

    constructor(config: ExchangeConfig & { passphrase: string }) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.passphrase = config.passphrase;
        this.testnet = config.testnet || false;
        this.baseUrl = this.testnet
            ? "https://www.okx.com/api/v5/public"
            : "https://www.okx.com/api/v5";
    }

    async fetchMarketData(symbol: string): Promise<MarketData> {
        try {
            const response = await fetch(`${this.baseUrl}/market/ticker?instId=${symbol}`);
            if (!response.ok) {
                throw new Error(`OKX API error: ${response.statusText}`);
            }
            const data = await response.json() as OKXResponse<OKXTickerData[]>;
            const ticker = data.data[0];
            
            const fundingRate = await this.fetchFundingRate(symbol);
            
            return {
                symbol,
                exchange: this.exchange,
                lastPrice: new Decimal(ticker.last),
                fundingRate,
                timestamp: parseInt(ticker.ts)
            };
        } catch (error) {
            logger.error("Error fetching OKX market data:", error);
            throw error;
        }
    }

    async fetchFundingRate(symbol: string): Promise<Decimal> {
        try {
            const response = await fetch(`${this.baseUrl}/public/funding-rate?instId=${symbol}`);
            if (!response.ok) {
                throw new Error(`OKX API error: ${response.statusText}`);
            }
            const data = await response.json() as OKXResponse<OKXFundingRateData[]>;
            return new Decimal(data.data[0].fundingRate);
        } catch (error) {
            logger.error("Error fetching OKX funding rate:", error);
            throw error;
        }
    }

    async executeTrade(request: TradeRequest): Promise<Position> {
        try {
            // Set leverage first
            await this.setLeverage(request.symbol, request.leverage);

            const timestamp = new Date().toISOString();
            const path = "/api/v5/trade/order";
            const method = "POST";
            
            const body = {
                instId: request.symbol,
                tdMode: "cross",
                side: request.side === "long" ? "buy" : "sell",
                ordType: request.limitPrice ? "limit" : "market",
                sz: request.size.toString(),
                px: request.limitPrice?.toString()
            };

            const sign = this.sign(timestamp, method, path, JSON.stringify(body));
            
            const response = await fetch(`${this.baseUrl}${path}`, {
                method,
                headers: {
                    "OK-ACCESS-KEY": this.apiKey,
                    "OK-ACCESS-SIGN": sign,
                    "OK-ACCESS-TIMESTAMP": timestamp,
                    "OK-ACCESS-PASSPHRASE": this.passphrase,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                throw new Error(`OKX API error: ${response.statusText}`);
            }

            const data = await response.json() as OKXResponse<OKXOrderData[]>;
            const order = data.data[0];
            
            return {
                symbol: request.symbol,
                exchange: this.exchange,
                side: request.side,
                size: request.size,
                leverage: request.leverage,
                entryPrice: new Decimal(order.fillPx || order.px),
                unrealizedPnl: new Decimal(order.pnl || 0),
                fundingPaid: new Decimal(0),
                openTime: DateTime.now(),
                lastUpdateTime: DateTime.now()
            };
        } catch (error) {
            logger.error("Error executing OKX trade:", error);
            throw error;
        }
    }

    async getPosition(symbol: string): Promise<Position | null> {
        try {
            const timestamp = new Date().toISOString();
            const path = `/api/v5/account/positions?instId=${symbol}`;
            const method = "GET";
            const sign = this.sign(timestamp, method, path, "");
            
            const response = await fetch(`${this.baseUrl}${path}`, {
                headers: {
                    "OK-ACCESS-KEY": this.apiKey,
                    "OK-ACCESS-SIGN": sign,
                    "OK-ACCESS-TIMESTAMP": timestamp,
                    "OK-ACCESS-PASSPHRASE": this.passphrase
                }
            });

            if (!response.ok) {
                throw new Error(`OKX API error: ${response.statusText}`);
            }

            const data = await response.json() as OKXResponse<OKXPositionData[]>;
            const position = data.data[0];

            if (!position || Number(position.pos) === 0) {
                return null;
            }

            return {
                symbol,
                exchange: this.exchange,
                side: position.posSide === "long" ? "long" : "short",
                size: new Decimal(Math.abs(Number(position.pos))),
                leverage: Number(position.lever),
                entryPrice: new Decimal(position.avgPx),
                unrealizedPnl: new Decimal(position.upl),
                fundingPaid: new Decimal(0),
                openTime: DateTime.fromISO(position.cTime),
                lastUpdateTime: DateTime.fromISO(position.uTime)
            };
        } catch (error) {
            logger.error("Error fetching OKX position:", error);
            throw error;
        }
    }

    async closePosition(symbol: string): Promise<boolean> {
        try {
            const position = await this.getPosition(symbol);
            if (!position) {
                return true;
            }

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
            logger.error("Error closing OKX position:", error);
            return false;
        }
    }

    async getBalance(): Promise<Decimal> {
        try {
            const timestamp = new Date().toISOString();
            const path = "/api/v5/account/balance?ccy=USDT";
            const method = "GET";
            const sign = this.sign(timestamp, method, path, "");
            
            const response = await fetch(`${this.baseUrl}${path}`, {
                headers: {
                    "OK-ACCESS-KEY": this.apiKey,
                    "OK-ACCESS-SIGN": sign,
                    "OK-ACCESS-TIMESTAMP": timestamp,
                    "OK-ACCESS-PASSPHRASE": this.passphrase
                }
            });

            if (!response.ok) {
                throw new Error(`OKX API error: ${response.statusText}`);
            }

            const data = await response.json() as OKXResponse<OKXBalanceData[]>;
            const balance = data.data[0].details.find(d => d.ccy === "USDT");
            return new Decimal(balance?.availEq || "0");
        } catch (error) {
            logger.error("Error fetching OKX balance:", error);
            throw error;
        }
    }

    async setLeverage(symbol: string, leverage: number): Promise<boolean> {
        try {
            const timestamp = new Date().toISOString();
            const path = "/api/v5/account/set-leverage";
            const method = "POST";
            
            const body = {
                instId: symbol,
                lever: leverage.toString(),
                mgnMode: "cross"
            };

            const sign = this.sign(timestamp, method, path, JSON.stringify(body));
            
            const response = await fetch(`${this.baseUrl}${path}`, {
                method,
                headers: {
                    "OK-ACCESS-KEY": this.apiKey,
                    "OK-ACCESS-SIGN": sign,
                    "OK-ACCESS-TIMESTAMP": timestamp,
                    "OK-ACCESS-PASSPHRASE": this.passphrase,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(body)
            });

            return response.ok;
        } catch (error) {
            logger.error("Error setting OKX leverage:", error);
            return false;
        }
    }

    private sign(timestamp: string, method: string, path: string, body: string): string {
        const message = timestamp + method + path + body;
        const crypto = require('crypto');
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(message)
            .digest('base64');
    }
} 
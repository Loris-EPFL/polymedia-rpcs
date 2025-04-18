import { SuiClient } from "@mysten/sui/client";
import React, { useState } from "react";

import { RpcLatencyResult, generateRandomAddress, measureRpcLatency } from "@polymedia/suitcase-core";
import { LinkExternal } from "@polymedia/suitcase-react";
import { RPC_ENDPOINTS as ORIGINAL_RPC_ENDPOINTS } from "@polymedia/suitcase-core";


const RPC_ENDPOINTS = {
    ...ORIGINAL_RPC_ENDPOINTS,
    mainnet: [
      ...ORIGINAL_RPC_ENDPOINTS.mainnet,
      "https://sui.obsuidian.xyz:2020",
      "https://sui.obsuidian.xyz:443",
      "https://sui.obsuidian.xyz",  // Add your custom RPC endpoint
      "http://sui.obsuidian.xyz",
      "http://sui.obsuidian.xyz:443",
     "http://sui.obsuidian.xyz:80",
      "http://45.10.161.136:2220",
      "http://localhost:2220",
     "https://sui.obsuidian.xyz:443/json-rpc/"
    ]
  };

export const PageHome: React.FC = () =>
    {
        /* State */

    const network = "mainnet";
    const numRounds = 11; // the 1st round is discarded due to DNS and TLS overhead

    const [ rpcs, setRpcs ] = useState<RpcUrl[]>(
        RPC_ENDPOINTS[network].map(url => ( { url, enabled: true } ))
    );
    const [ testType, setTestType ] = useState<"multiGetObjects" | "queryTransactionBlocks">("multiGetObjects");
    const [ results, setResults ] = useState<AggregateResult[]>([]);
    const [ isRunning, setIsRunning ] = useState<boolean>(false);
    const [ progress, setProgress ] = useState<number>(0);

    /* Functions */

    const runTest = async () =>
    {
        setIsRunning(true);
        setProgress(0.5 / numRounds * 100);

        const allResults: RpcLatencyResult[][] = [];
        const endpoints = rpcs.filter(rpc => rpc.enabled).map(rpc => rpc.url);
        const rpcRequest = async (client: SuiClient) => {
            if (testType === "multiGetObjects") {
                await client.multiGetObjects({
                    ids: Array.from({ length: 20 }, () => generateRandomAddress()),
                    options: { showContent: true, showType: true, showDisplay: true },
                });
            } else if (testType === "queryTransactionBlocks") {
                const bidderPackageId = "0x7bfe75f51565a2e03e169c85a50c490ee707692a14d5417e2b97740da0d48627";
                await client.queryTransactionBlocks({
                    filter: { MoveFunction: {
                        package: bidderPackageId, module: "auction", function: "admin_creates_auction"
                    }},
                    options: { showEffects: true, showObjectChanges: true, showInput: true },
                });
            }
        };

        // Measure latency multiple times for each endpoint
        for (let i = 0; i < numRounds; i++) {
            const newResults = await measureRpcLatency({ endpoints, rpcRequest });
            allResults.push(newResults);
            setProgress((i + 1.5) / numRounds * 100);
        }

        // Calculate average/P50/P90 latency for each endpoint
        const aggregateResults: AggregateResult[] = endpoints.map((endpoint, i) =>
        {
            const latencies: number[] = [];
            let hasError = false;

            // Collect all latency measurements for the current endpoint.
            // Ignore the first round due to DNS and TLS overhead.
            for (let round = 1; round < numRounds; round++) {
                const result = allResults[round][i];
                if (result.latency !== undefined) {
                    latencies.push(result.latency);
                } else {
                    hasError = true;
                    break;
                }
            }

            if (!hasError && latencies.length > 0) {
                return {
                    endpoint,
                    average: calculateAverage(latencies),
                    p50: calculatePercentile(latencies, 0.5),
                    p90: calculatePercentile(latencies, 0.9),
                    error: false,
                };
            } else {
                return {
                    endpoint,
                    average: NaN,
                    p50: NaN,
                    p90: NaN,
                    error: true,
                };
            }
        });

        // Sort the results from fastest to slowest
        aggregateResults.sort((a, b) => {
            if (a.error && !b.error) return 1;
            if (!a.error && b.error) return -1;
            return a.average - b.average;
        });

        setResults(aggregateResults);
        setIsRunning(false);
    };

    const onRpcCheckboxChange = (url: string) => {
        setRpcs(prevRpcs =>
            prevRpcs.map(rpc =>
                rpc.url !== url ? rpc : { ...rpc, enabled: !rpc.enabled }
            )
        );
    };

    /* HTML */

    return <>
    <h1><span className="rainbow">Sui RPC tools</span></h1>

    <div className="section">
        <h2><span className="rainbow">LATENCY TEST</span></h2>

        <p style={{paddingBottom: "0.5rem"}}>Select the RPCs you want to test:</p>

        <div id="rpc-wrap">
        <div id="rpc-selector">
        {rpcs.map(rpc => (
            <div key={rpc.url} className="rpc">
            <label>
                <input
                    type="checkbox"
                    checked={rpc.enabled}
                    onChange={() => onRpcCheckboxChange(rpc.url)}
                />
                {rpc.url}
            </label>
            </div>
        ))}
        </div>
        </div>

        <p>
            Select the type of test:
        </p>
        <div className="radio-group">
            <div
                className="radio-option"
                onClick={() => setTestType("multiGetObjects")}
            >
                <input
                    type="radio"
                    checked={testType === "multiGetObjects"}
                    onChange={() => setTestType("multiGetObjects")}
                />
                <label>multiGetObjects</label>
            </div>
            <div
                className="radio-option"
                onClick={() => setTestType("queryTransactionBlocks")}
            >
                <input
                    type="radio"
                    checked={testType === "queryTransactionBlocks"}
                    onChange={() => setTestType("queryTransactionBlocks")}
                />
                <label>queryTransactionBlocks</label>
            </div>
        </div>

        <br/>
        <br/>

        <div id="btnOrProgress">
        {!isRunning
            ? <button className="btn" onClick={runTest} disabled={isRunning}>
                TEST
            </button>
            : <div className="progress-bar-container">
                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>
        }
        </div>
    </div>

    {results.length > 0 &&
    <div className="section">
        <h2><span className={`rainbow ${isRunning ? "running" : ""}`}>RESULTS</span></h2>

        <div id="results" className={isRunning ? "running" : ""}>
        <div className="result header">
            <div className="endpoint">ENDPOINT</div>
            <div className="latency">AVG</div>
            <div className="latency">P50</div>
            <div className="latency">P90</div>
        </div>
            {results.map(result =>
                <ResultRow result={result} key={result.endpoint} />
            )}
        </div>
    </div>}

    <div className="section">
        <h2><span className="rainbow">ABOUT</span></h2>
        <div className="tight">
            <p>▸ The app sends {numRounds-1} requests to each RPC and measures the response times (latency). The results are shown in milliseconds.</p>
            <p>▸ "AVG" is the average latency of all requests sent to the RPC.</p>
            <p>▸ "P50" is the 50th percentile (median) latency for the RPC. This means 50% of the requests were faster.</p>
            <p>▸ "P90" is the 90th percentile latency for the RPC. This means 90% of the requests were faster.</p>
        </div>
    </div>

    <div className="section">
        <h2><span className="rainbow">DEV TOOLS</span></h2>

        <p>
            The NPM package <b><i>@polymedia/suitcase-core</i></b> provides functions to measure RPC latency and instantiate <i>SuiClient</i> using the lowest latency endpoint for each user: <b><i>measureRpcLatency()</i></b> and <b><i>newLowLatencySuiClient()</i></b>.
        </p>
        <p>
            <LinkExternal href="https://github.com/juzybits/polymedia-rpcs">
                Read the code
            </LinkExternal>
        </p>
    </div>
    </>;
};

export const ResultRow: React.FC<{
    result: AggregateResult;
}> = ({
    result,
}) => {
    return <div className="result">
        <div className="endpoint">{result.endpoint}</div>
        {!result.error ? <>
            <div className="latency">{result.average.toFixed(0)}</div>
            <div className="latency">{result.p50.toFixed(0)}</div>
            <div className="latency">{result.p90.toFixed(0)}</div>
        </> : <>
            <div className="latency"></div>
            <div className="latency"></div>
            <div className="latency text-red">Error</div>
        </>}
    </div>;
};

/* Types */

export type RpcUrl = {
    url: string;
    enabled: boolean;
};

export type AggregateResult = {
    endpoint: string;
    average: number;
    p50: number;
    p90: number;
    error: boolean;
};

/* Functions */

function calculateAverage(latencies: number[]): number {
    const sum = latencies.reduce((acc, curr) => acc + curr, 0);
    return sum / latencies.length;
}

function calculatePercentile(data: number[], percentile: number): number {
    if (data.length === 0) return NaN;

    // Sort the data
    data.sort((a, b) => a - b);

    // Calculate rank
    const rank = percentile * (data.length - 1);
    const lowerIndex = Math.floor(rank);
    const upperIndex = Math.ceil(rank);

    // If rank is an integer, return the value at that rank
    if (lowerIndex === upperIndex) {
        return data[lowerIndex];
    }

    // Interpolate between the closest ranks
    const lowerValue = data[lowerIndex];
    const upperValue = data[upperIndex];
    const weight = rank - lowerIndex;

    return lowerValue + (upperValue - lowerValue) * weight;
}

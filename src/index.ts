import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const server = new Server({
  name: "currencyrate-mcp-server",
  version: "1.0.0",
},{
  capabilities: {
    tools: {}
  }
});

// Register the tools with the server
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_all_currencies",
        description: "Lists currencies of all countries and currency codes\
          This tool should be used first to actual currency code before calling get_currency_rate_details tool.",
        inputSchema: {
          type: "object",
          properties: {
          },
          required: []
        }
      },
      {
        name: "get_currency_rate_details",
        description: "Returns the current currency exchange rate details of a currency. \
          This tool should be used after using the list_all_currencies tool.",
        inputSchema: {
          type: "object",
          properties: {
            symbol: {
              type: "string",
              description: "The symbol of the currency to get the exchange rate for."
            }
          },
          required: ["symbol"]
        }
      }
    ]
  }
});

type CurrencyInfo = { name: string; symbol: string };

// Register the request handler for the tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    switch (request.params.name) {
      case "list_all_currencies":
        const allCurrencies = await fetch("https://api.vatcomply.com/currencies");
        const data = await allCurrencies.json();
        const result = Object.entries(data as Record<string, CurrencyInfo>).map(([code, { name, symbol }]) => ({
          code,
          name,
          symbol
        }));
        return {
            content: [
              { type: "text", text: JSON.stringify(result, null, 2) }
            ]
        }

      case "get_currency_rate_details":
        if (!request.params.arguments) {
          throw new Error("Arguments are required");
        }
        const currencySymbol = request.params.arguments.symbol;
        const exchangeRates = await fetch(`https://api.vatcomply.com/rates?base=${currencySymbol}`);
        return {
          content: [
            { type: "text", text: JSON.stringify(await exchangeRates.json(), null, 2) }
          ]
        }

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  } catch (error) {
    console.error("Error handling request:", error);
    return {
      content: [
        { type: "text", text: `Error: ${error}` }
      ],
      isError: true
    };
  }
})

async function runServer() {
  // Start receiving messages on stdin and sending messages on stdout
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
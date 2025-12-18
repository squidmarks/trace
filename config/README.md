# Configuration Files

## models.json

Defines AI model configurations including pricing for cost tracking.

### Structure

```json
{
  "analysis": {
    "model-name": {
      "name": "Human-readable name",
      "provider": "openai",
      "inputCostPer1M": 0.00,  // USD per 1M input tokens
      "outputCostPer1M": 0.00, // USD per 1M output tokens
      "supportsVision": true,
      "maxTokens": 128000,
      "contextWindow": 128000
    }
  },
  "embeddings": {
    "model-name": {
      "name": "Human-readable name",
      "provider": "openai",
      "costPer1M": 0.00,  // USD per 1M tokens
      "dimensions": 1536
    }
  },
  "chat": {
    // Same structure as analysis
  }
}
```

### Usage

Models are selected via environment variables:

```bash
ANALYSIS_MODEL=gpt-4o-mini      # For PDF page analysis
EMBEDDING_MODEL=text-embedding-3-small  # For vector embeddings
CHAT_MODEL=gpt-4o-mini          # For chat responses
```

### Pricing Updates

Update pricing from: https://openai.com/api/pricing/

**Last Updated**: December 18, 2025

### Cost Tracking

The system automatically:
1. Tracks token usage for each API call
2. Calculates cost using pricing from this file
3. Aggregates cost per indexing job
4. Displays cost to users on completion
5. Stores cost in MongoDB for auditing

### Adding New Models

To add a new model:

1. Add entry to appropriate section in `models.json`
2. Include accurate pricing
3. Set environment variable to use it
4. Test cost tracking accuracy

Example:

```json
{
  "analysis": {
    "gpt-5": {
      "name": "GPT-5",
      "provider": "openai",
      "inputCostPer1M": 5.00,
      "outputCostPer1M": 15.00,
      "supportsVision": true,
      "maxTokens": 256000,
      "contextWindow": 256000
    }
  }
}
```

Then set: `ANALYSIS_MODEL=gpt-5`


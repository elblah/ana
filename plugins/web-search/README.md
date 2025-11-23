# Web Search Plugin

This plugin adds web search capability to AI Coder using DuckDuckGo Lite HTML parsing.

## Features

- **web_search**: Search the web for information using DuckDuckGo
- **get_url_content**: Fetch and read the full text content of a URL using lynx browser

## Tools

### web_search
- **Purpose**: Search the internet for current information
- **Parameters**:
  - `query` (required): Search query string
  - `max_results` (optional): Maximum number of results to return (1-50)
- **Auto-approved**: Yes

### get_url_content  
- **Purpose**: Fetch and read full content of specific URLs
- **Parameters**:
  - `url` (required): The URL to fetch content from (http/https only)
- **Auto-approved**: No (requires user approval for security)

## Configuration

### HTTP/HTTPS
- Set `ALLOW_HTTP=1` to allow HTTP URLs (default: HTTPS only)
- When HTTP is disabled, HTTP URLs are automatically upgraded to HTTPS

### Dependencies
- **lynx**: Required for `get_url_content` tool
  - Install with: `sudo apt install lynx`

## Usage Examples

```
web_search(query="latest TypeScript features")
web_search(query="Bun vs Node.js performance", max_results=5)
get_url_content(url="https://bun.sh/docs")
```

## Security Notes

- `web_search` is auto-approved for efficiency
- `get_url_content` requires approval each time it's used
- URL content is truncated at 8000 characters to prevent overload

## Implementation

- Uses DuckDuckGo Lite HTML parsing (no external API dependencies)
- Handles redirects and URL processing automatically  
- Filters out irrelevant results (DuckDuckGo internal links, etc.)
- Robust error handling and timeout management

## Compatibility

- Works with any HTTP/HTTPS URL
- Compatible with DuckDuckGo Lite's current HTML structure
- Graceful fallback when lynx is not available
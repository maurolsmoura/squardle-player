# Squardle Player Usage Guide

This NestJS application provides endpoints to interact with the Squardle game automatically.

## Setup

1. **Start the browser instance:**

   ```bash
   npm run browser:start
   ```

   This launches a Chrome browser with remote debugging enabled.

2. **Start the NestJS server:**
   ```bash
   npm run start:dev
   ```
   This starts the server on `http://localhost:3000`.

## API Endpoints

### POST `/squardle/play`

Starts a new freeplay Squardle game.

**Example:**

```bash
curl -X POST http://localhost:3000/squardle/play
```

**Response:**

```json
{
  "message": "New Squardle game started successfully",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

### GET `/squardle/board`

Retrieves the current board state as a JSON response.

**Example:**

```bash
curl http://localhost:3000/squardle/board
```

**Response:**

```json
[
  [
    {
      "x": 0,
      "y": 0,
      "letter": null,
      "hints": [
        {
          "letter": "C",
          "type": "White"
        }
      ]
    }
    // ... more cells
  ]
  // ... more rows
]
```

## Cell Structure

Each cell in the 5x5 board contains:

- `x`, `y`: Coordinates (0-4)
- `letter`: The current letter in the cell (null if empty)
- `hints`: Array of hint objects from previous guesses

## Hint Types

The `HintType` enum includes various hint types based on Squardle's color system:

- `White`: Wrong letter
- `Black`: Letter not in word
- `HorizontalSimple`: Correct letter, wrong position (horizontal word)
- `VerticalSimple`: Correct letter, wrong position (vertical word)
- `HorizontalDouble`: Correct letter, correct position (horizontal word)
- `VerticalDouble`: Correct letter, correct position (vertical word)
- And many more complex combinations...

## Workflow

1. Start browser: `npm run browser:start`
2. Start server: `npm run start:dev`
3. Start new game: `POST /squardle/play`
4. Get board state: `GET /squardle/board`
5. Repeat step 4 as needed to monitor game progress

## Notes

- The browser must be started before using the endpoints
- The service connects to the existing browser instance rather than launching its own
- Board state extraction is based on the actual DOM elements and their styling
- The service maintains the connection to the same page between requests

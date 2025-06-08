# Squardle Player

Automated Squardle gameplay using NestJS and browser automation.

## 🎥 Demo Video

[![Squardle Player Demo](https://img.youtube.com/vi/DX--Gy4t9V8/maxresdefault.jpg)](https://youtu.be/DX--Gy4t9V8)

_Click the image above to watch the demo video_

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Browser

```bash
npm run browser:start
```

### 3. Start Service

```bash
npm run start:dev
```

### 4. Start Game

```bash
POST /play
```

### 5. Automate Gameplay

```bash
POST /squardle/auto/play
```

## API Documentation and UI

- **UI to interact with all commands**: `http://localhost:3000/api`

- **OpenAPI JSON**: `http://localhost:3000/api-json`

## Usage

1. Start the browser and service
2. Use `/play` to initialize the game
3. Use `/squardle/auto/play` to let AI play automatically
4. Check `/squardle/auto/status` to monitor progress

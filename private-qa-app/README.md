# Private Q&A Application

A full-stack React.js and Node.js application for private document management and question answering.

## Project Structure

```
private-qa-app/
├── server/          # Node.js Express backend
│   ├── server.js    # Main server file
│   ├── package.json
│   └── uploads/     # Uploaded files directory
└── client/          # React frontend with Vite
    ├── src/
    │   ├── components/   # Reusable components
    │   ├── pages/        # Page components
    │   ├── App.jsx
    │   └── main.jsx
    ├── index.html
    └── vite.config.js
```

## Features

- 📄 **Document Upload**: Upload and manage multiple documents
- ❓ **Q&A System**: Ask questions about uploaded documents
- 📊 **Source Attribution**: See which documents answered your question
- 🎨 **Modern UI**: Beautiful, responsive design with animations
- ⚡ **Fast Performance**: Built with Vite and optimized components

## Installation

### Server Setup

```bash
cd server
npm install
```

### Client Setup

```bash
cd client
npm install
```

## Running the Application

### Start the Backend Server

```bash
cd server
npm run dev
# or
npm start
```

The server will run on `http://localhost:5000`

### Start the Frontend Dev Server

In a new terminal:

```bash
cd client
npm run dev
```

The frontend will run on `http://localhost:3000`

## API Endpoints

### Documents

- **GET** `/api/documents` - Get all uploaded documents
- **POST** `/api/upload` - Upload a new document

### Q&A

- **POST** `/api/ask` - Ask a question and get an answer

### Health

- **GET** `/api/health` - Check server status

## Technologies Used

### Frontend

- React 18
- Vite
- Framer Motion (animations)
- Axios (HTTP client)
- CSS Modules

### Backend

- Node.js
- Express.js
- Multer (file uploads)
- CORS

## Next Steps

1. Replace mock Q&A responses with actual AI/ML models (LangChain, OpenAI API, etc.)
2. Add a database (MongoDB, PostgreSQL) for persistent storage
3. Implement user authentication
4. Add document processing and chunking
5. Implement vector embeddings for semantic search
6. Deploy to production

## License

MIT
